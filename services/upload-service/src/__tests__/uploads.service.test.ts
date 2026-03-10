// File: services/upload-service/src/__tests__/uploads.service.test.ts
import { createMockDdbClient, createMockSnsClient } from "@shared/testing";

// ── Mock all dependencies BEFORE importing the service ───────────────────────

const mockRepo = {
  put:          jest.fn().mockResolvedValue(undefined),
  get:          jest.fn().mockResolvedValue(null),
  updateStatus: jest.fn().mockResolvedValue(undefined),
  listByWorkspace: jest.fn().mockResolvedValue([])
};

jest.mock("../db/ddb.client", () => ({
  createDdbClient: () => createMockDdbClient()
}));

jest.mock("../db/uploadfiles.repo", () => ({
  UploadFilesRepo: jest.fn().mockImplementation(() => mockRepo)
}));

jest.mock("../integrations/s3.presign", () => ({
  presignPutObject: jest.fn().mockResolvedValue(
    "http://localhost:4566/sea-uploads-dev/ws-test/file.jpg?sig=abc"
  )
}));

jest.mock("../integrations/s3.verify", () => ({
  verifyObjectExists: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../integrations/sns.publisher", () => ({
  createSnsClient: () => createMockSnsClient(),
  publishEvent: jest.fn().mockResolvedValue(undefined),
  mustGetEventsTopicArn: jest.fn().mockReturnValue("arn:aws:sns:us-east-1:000000000000:sea-events")
}));

// Import AFTER mocks are set up
import { UploadsService } from "../domain/uploads.service";

// ── Setup ─────────────────────────────────────────────────────────────────────

const baseRecord = {
  id: "upload-123",
  workspaceId: "ws-test-1",
  createdByUserId: "user-1",
  storageBucket: "sea-uploads-dev",
  storageKey: "ws-test-1/upload-123/receipt.jpg",
  originalFileName: "receipt.jpg",
  contentType: "image/jpeg",
  sizeBytes: 1024,
  status: "QUEUED",
  source: "receipt",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

beforeEach(() => {
  process.env.DDB_UPLOADFILES_TABLE   = "UploadFiles";
  process.env.UPLOADS_BUCKET          = "sea-uploads-dev";
  process.env.PRESIGN_EXPIRES_SECONDS = "900";
  process.env.EVENTS_TOPIC_ARN        = "arn:aws:sns:us-east-1:000000000000:sea-events";
  process.env.AWS_REGION              = "us-east-1";
  jest.clearAllMocks();
  mockRepo.put.mockResolvedValue(undefined);
  mockRepo.get.mockResolvedValue(null);
  mockRepo.updateStatus.mockResolvedValue(undefined);
});

// ── createUpload ──────────────────────────────────────────────────────────────

describe("UploadsService.createUpload", () => {
  const validInput = {
    workspaceId: "ws-test-1",
    actorUserId: "user-1",
    correlationId: "test-correlation-id",
    request: {
      originalFileName: "receipt.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1024,
      source: "receipt" as const
    }
  };

  it("returns uploadFile with QUEUED status and a presignedUrl", async () => {
    const service = new UploadsService();
    const result = await service.createUpload(validInput);

    expect(result.uploadFile.status).toBe("QUEUED");
    expect(result.uploadFile.workspaceId).toBe("ws-test-1");
    expect(result.uploadFile.originalFileName).toBe("receipt.jpg");
    expect(result.presignedUrl).toContain("localhost:4566");
    expect(result.method).toBe("PUT");
    expect(result.expiresInSeconds).toBe(900);
  });

  it("generates a unique ID per upload", async () => {
    const service = new UploadsService();
    const [r1, r2] = await Promise.all([
      service.createUpload({ ...validInput, request: { ...validInput.request, originalFileName: "a.jpg" } }),
      service.createUpload({ ...validInput, request: { ...validInput.request, originalFileName: "b.jpg" } })
    ]);
    expect(r1.uploadFile.id).not.toBe(r2.uploadFile.id);
  });

  it("sets storageKey as workspaceId/uploadId/filename", async () => {
    const service = new UploadsService();
    const { uploadFile } = await service.createUpload({
      workspaceId: "ws-abc",
      actorUserId: "user-1",
    correlationId: "test-correlation-id",
      request: { originalFileName: "doc.pdf", contentType: "application/pdf", sizeBytes: 500, source: "receipt" as const }
    });
    expect(uploadFile.storageKey).toMatch(/^ws-abc\/.+\/doc\.pdf$/);
  });

  it("persists the record via repo.put", async () => {
    const service = new UploadsService();
    await service.createUpload(validInput);
    expect(mockRepo.put).toHaveBeenCalledTimes(1);
  });

  it("handles bank_csv source", async () => {
    const service = new UploadsService();
    const { uploadFile } = await service.createUpload({
      ...validInput,
      request: { originalFileName: "export.csv", contentType: "text/csv", sizeBytes: 512, source: "bank_csv" as const }
    });
    expect(uploadFile.source).toBe("bank_csv");
    expect(uploadFile.contentType).toBe("text/csv");
  });

  it("throws if repo.put fails", async () => {
    mockRepo.put.mockRejectedValueOnce(new Error("DynamoDB write failed"));
    const service = new UploadsService();
    await expect(service.createUpload(validInput)).rejects.toThrow("DynamoDB write failed");
  });
});

// ── finalizeUpload ────────────────────────────────────────────────────────────

describe("UploadsService.finalizeUpload", () => {
  const finalizeInput = {
    workspaceId: "ws-test-1",
    uploadFileId: "upload-123",
    actorUserId: "user-1",
    correlationId: "test-correlation-id",
    request: {}
  };

  it("updates status to UPLOADED and publishes upload.uploaded.v1", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");
    mockRepo.get.mockResolvedValueOnce(baseRecord);

    const service = new UploadsService();
    const result = await service.finalizeUpload(finalizeInput);

    expect(result.status).toBe("UPLOADED");
    expect(mockRepo.updateStatus).toHaveBeenCalledWith("ws-test-1", "upload-123", "UPLOADED");
    expect(publishEvent).toHaveBeenCalledTimes(1);
    const evt = publishEvent.mock.calls[0][1].message;
    expect(evt.type).toBe("upload.uploaded.v1");
    expect(evt.uploadFileId).toBe("upload-123");
    expect(evt.workspaceId).toBe("ws-test-1");
  });

  it("throws NotFoundException if upload record not found", async () => {
    mockRepo.get.mockResolvedValueOnce(null);
    const service = new UploadsService();
    await expect(service.finalizeUpload(finalizeInput)).rejects.toThrow();
  });

  it("throws if S3 object verification fails", async () => {
    const { verifyObjectExists } = require("../integrations/s3.verify");
    verifyObjectExists.mockRejectedValueOnce(new Error("S3 object not found"));
    mockRepo.get.mockResolvedValueOnce(baseRecord);
    const service = new UploadsService();
    await expect(service.finalizeUpload(finalizeInput)).rejects.toThrow("S3 object not found");
  });

  it("does not publish event if S3 verification fails", async () => {
    const { verifyObjectExists } = require("../integrations/s3.verify");
    const { publishEvent } = require("../integrations/sns.publisher");
    verifyObjectExists.mockRejectedValueOnce(new Error("S3 object not found"));
    mockRepo.get.mockResolvedValueOnce(baseRecord);
    const service = new UploadsService();
    await expect(service.finalizeUpload(finalizeInput)).rejects.toThrow();
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it("throws if SNS publish fails", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");
    publishEvent.mockRejectedValueOnce(new Error("SNS unavailable"));
    mockRepo.get.mockResolvedValueOnce(baseRecord);
    const service = new UploadsService();
    await expect(service.finalizeUpload(finalizeInput)).rejects.toThrow("SNS unavailable");
  });
});