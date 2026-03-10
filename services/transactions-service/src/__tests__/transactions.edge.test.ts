// File: services/transactions-service/src/__tests__/transactions.edge.test.ts
import { makeExtractionCompletedEvent, createMockSnsClient } from "@shared/testing";

// ── Mock all dependencies BEFORE importing the service ───────────────────────

const mockRepo = {
  put:                      jest.fn().mockResolvedValue(undefined),
  getByExtractedDocumentId: jest.fn().mockResolvedValue(null),
  get:                      jest.fn().mockResolvedValue(null),
  listByWorkspace:          jest.fn().mockResolvedValue([]),
  updateCorrections:        jest.fn().mockResolvedValue(undefined),
  softDelete:               jest.fn().mockResolvedValue(undefined)
};

jest.mock("../db/ddb.client", () => ({
  createDdbClient: () => ({ send: jest.fn().mockResolvedValue({}) })
}));

jest.mock("../db/transactions.repo", () => ({
  TransactionsRepo: jest.fn().mockImplementation(() => mockRepo)
}));

jest.mock("../integrations/sns.publisher", () => ({
  createSnsClient: () => createMockSnsClient(),
  publishEvent: jest.fn().mockResolvedValue(undefined),
  mustGetEventsTopicArn: jest.fn().mockReturnValue("arn:aws:sns:us-east-1:000000000000:sea-events")
}));

// Import AFTER mocks are set up
import { TransactionsService } from "../domain/transactions.service";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.DDB_TRANSACTIONS_TABLE = "Transactions";
  process.env.EVENTS_TOPIC_ARN       = "arn:aws:sns:us-east-1:000000000000:sea-events";
  process.env.AWS_REGION             = "us-east-1";
  jest.clearAllMocks();
  mockRepo.put.mockResolvedValue(undefined);
  mockRepo.getByExtractedDocumentId.mockResolvedValue(null);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TransactionsService — edge cases", () => {
  it("does not upsert or publish for CSV with no line items", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");
    const service = new TransactionsService();

    await service.handleExtractionCompleted(
      makeExtractionCompletedEvent({ source: "bank_csv", lineItems: [] })
    );

    expect(mockRepo.put).not.toHaveBeenCalled();
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it("skips processing if extractedDocumentId already processed (idempotency)", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");
    mockRepo.getByExtractedDocumentId.mockResolvedValueOnce({ id: "existing-txn" });

    const service = new TransactionsService();
    await service.handleExtractionCompleted(
      makeExtractionCompletedEvent({
        lineItems: [{ description: "Coffee", totalPrice: 5.00 }]
      })
    );

    expect(mockRepo.put).not.toHaveBeenCalled();
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it("publishes transaction.upserted.v1 with CREATED for new transactions", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");

    const service = new TransactionsService();
    await service.handleExtractionCompleted(
      makeExtractionCompletedEvent({
        lineItems: [{ description: "Coffee", totalPrice: 5.00 }]
      })
    );

    expect(publishEvent).toHaveBeenCalledTimes(1);
    const evt = publishEvent.mock.calls[0][1].message;
    expect(evt.type).toBe("transaction.upserted.v1");
    expect(evt.operation).toBe("CREATED");
  });

  it("publishes one event per line item for bank_csv with multiple items", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");

    const service = new TransactionsService();
    await service.handleExtractionCompleted(
      makeExtractionCompletedEvent({
        source: "bank_csv",
        lineItems: [
          { description: "Coffee",   totalPrice: 5.00 },
          { description: "Sandwich", totalPrice: 12.50 }
        ]
      })
    );

    expect(publishEvent).toHaveBeenCalledTimes(2);
    publishEvent.mock.calls.forEach((call: any[]) => {
      expect(call[1].message.operation).toBe("CREATED");
    });
  });

  it("handles line item with no totalPrice without crashing", async () => {
    const service = new TransactionsService();
    await expect(
      service.handleExtractionCompleted(
        makeExtractionCompletedEvent({
          source: "bank_csv",
          lineItems: [{ description: "Mystery item" }]  // no totalPrice
        })
      )
    ).resolves.not.toThrow();
  });


});