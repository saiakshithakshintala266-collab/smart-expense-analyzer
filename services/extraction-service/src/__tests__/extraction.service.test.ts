// File: services/extraction-service/src/__tests__/extraction.service.test.ts
import { makeUploadUploadedEvent, createMockSnsClient } from "@shared/testing";

// ── Mocks BEFORE import ───────────────────────────────────────────────────────

const mockRepo = {
  put:               jest.fn().mockResolvedValue(undefined),
  get:               jest.fn().mockResolvedValue(null),
  getByUploadFileId: jest.fn().mockResolvedValue(null),
  updateStatus:      jest.fn().mockResolvedValue(undefined),
  listByWorkspace:   jest.fn().mockResolvedValue([])
};

jest.mock("../db/ddb.client", () => ({ createDdbClient: () => ({ send: jest.fn() }) }));
jest.mock("../db/extracteddocs.repo", () => ({
  ExtractedDocsRepo: jest.fn().mockImplementation(() => mockRepo)
}));
jest.mock("../integrations/textract.extractor", () => ({
  createTextractClient:     () => ({}),
  createS3ClientForTextract: () => ({}),
  extractWithTextract: jest.fn().mockResolvedValue({
    fields: [
      { key: "vendor_name", value: "Starbucks", confidence: 0.99 },
      { key: "total",       value: "5.50",       confidence: 0.97 },
      { key: "date",        value: "2026-03-01", confidence: 0.95 },
      { key: "currency",    value: "USD",         confidence: 0.98 }
    ],
    lineItems: [],
    warnings: [],
    rawTextractJobId: "job-abc"
  })
}));
jest.mock("../integrations/csv.parser", () => ({
  parseCSV: jest.fn().mockResolvedValue({
    fields: [],
    lineItems: [
      { description: "Coffee", totalPrice: 5.00, confidence: 0.99 },
      { description: "Lunch",  totalPrice: 12.50, confidence: 0.98 }
    ],
    rowCount: 2,
    warnings: []
  })
}));
jest.mock("../integrations/sns.publisher", () => ({
  createSnsClient: () => createMockSnsClient(),
  publishEvent: jest.fn().mockResolvedValue(undefined),
  mustGetEventsTopicArn: jest.fn().mockReturnValue("arn:aws:sns:us-east-1:000000000000:sea-events")
}));

import { ExtractionService } from "../domain/extraction.service";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.DDB_EXTRACTED_DOCS_TABLE = "ExtractedDocs"; // ← real env var name
  process.env.EVENTS_TOPIC_ARN         = "arn:aws:sns:us-east-1:000000000000:sea-events";
  process.env.AWS_REGION               = "us-east-1";
  process.env.UPLOADS_BUCKET           = "sea-uploads-dev";
  jest.clearAllMocks();
  mockRepo.put.mockResolvedValue(undefined);
  mockRepo.getByUploadFileId.mockResolvedValue(null);
  mockRepo.updateStatus.mockResolvedValue(undefined);
  const { extractWithTextract } = require("../integrations/textract.extractor");
  extractWithTextract.mockResolvedValue({
    fields: [{ key: "vendor_name", value: "Starbucks", confidence: 0.99 }],
    lineItems: [], warnings: [], rawTextractJobId: "job-abc"
  });
  const { parseCSV } = require("../integrations/csv.parser");
  parseCSV.mockResolvedValue({
    fields: [], lineItems: [
      { description: "Coffee", totalPrice: 5.00, confidence: 0.99 },
      { description: "Lunch",  totalPrice: 12.50, confidence: 0.98 }
    ], rowCount: 2, warnings: []
  });
});

// ── processUpload — receipt ───────────────────────────────────────────────────

describe("ExtractionService.processUpload — receipt", () => {
  it("saves initial PROCESSING record then COMPLETED record and publishes extraction.completed.v1", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");
    const service = new ExtractionService();

    await service.processUpload(makeUploadUploadedEvent({ source: "receipt" }));

    // put called twice: initial PROCESSING record + final COMPLETED record
    expect(mockRepo.put).toHaveBeenCalledTimes(2);
    expect(mockRepo.put.mock.calls[0][0].status).toBe("PROCESSING");
    expect(mockRepo.put.mock.calls[1][0].status).toBe("COMPLETED");

    expect(publishEvent).toHaveBeenCalledTimes(1);
    const evt = publishEvent.mock.calls[0][1].message;
    expect(evt.type).toBe("extraction.completed.v1");
    expect(evt.source).toBe("receipt");
    expect(evt.extractionMethod).toBe("textract");
  });

  it("skips if upload already has COMPLETED extraction (idempotency)", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");
    // Returns existing COMPLETED doc
    mockRepo.getByUploadFileId.mockResolvedValueOnce({ id: "existing-doc", status: "COMPLETED" });

    const service = new ExtractionService();
    await service.processUpload(makeUploadUploadedEvent({ source: "receipt" }));

    expect(mockRepo.put).not.toHaveBeenCalled();
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it("sets status FAILED, publishes extraction.failed.v1, and rethrows on textract error", async () => {
    const { extractWithTextract } = require("../integrations/textract.extractor");
    const { publishEvent } = require("../integrations/sns.publisher");
    extractWithTextract.mockRejectedValueOnce(new Error("Textract timeout"));

    const service = new ExtractionService();
    await expect(
      service.processUpload(makeUploadUploadedEvent({ source: "receipt" }))
    ).rejects.toThrow("Textract timeout");

    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), "FAILED", "Textract timeout"
    );
    // publishes extraction.failed.v1
    expect(publishEvent).toHaveBeenCalledTimes(1);
    expect(publishEvent.mock.calls[0][1].message.type).toBe("extraction.failed.v1");
  });
});

// ── processUpload — bank_csv ──────────────────────────────────────────────────

describe("ExtractionService.processUpload — bank_csv", () => {
  it("uses csv_parser and publishes extraction.completed.v1 with lineItems", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");
    const service = new ExtractionService();

    await service.processUpload(makeUploadUploadedEvent({ source: "bank_csv" }));

    expect(publishEvent).toHaveBeenCalledTimes(1);
    const evt = publishEvent.mock.calls[0][1].message;
    expect(evt.type).toBe("extraction.completed.v1");
    expect(evt.source).toBe("bank_csv");
    expect(evt.extractionMethod).toBe("csv_parser");
    expect(evt.lineItems).toHaveLength(2);
  });

  it("sets status FAILED, publishes extraction.failed.v1, and rethrows on CSV parse error", async () => {
    const { parseCSV } = require("../integrations/csv.parser");
    const { publishEvent } = require("../integrations/sns.publisher");
    parseCSV.mockRejectedValueOnce(new Error("Invalid CSV format"));

    const service = new ExtractionService();
    await expect(
      service.processUpload(makeUploadUploadedEvent({ source: "bank_csv" }))
    ).rejects.toThrow("Invalid CSV format");

    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), "FAILED", "Invalid CSV format"
    );
    expect(publishEvent.mock.calls[0][1].message.type).toBe("extraction.failed.v1");
  });
});