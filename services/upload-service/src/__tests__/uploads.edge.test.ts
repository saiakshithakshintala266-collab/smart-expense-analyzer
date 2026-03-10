// File: services/upload-service/src/__tests__/uploads.edge.test.ts
import { createMockDdbClient, createMockSnsClient } from "@shared/testing";

// ── Mock all dependencies BEFORE importing the service ───────────────────────

const mockRepo = {
  put:             jest.fn().mockResolvedValue(undefined),
  get:             jest.fn().mockResolvedValue(null),
  updateStatus:    jest.fn().mockResolvedValue(undefined),
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
    "http://localhost:4566/sea-uploads-dev/ws/f.jpg?sig=abc"
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
  id: "up-done", workspaceId: "ws-test-1",
  storageBucket: "sea-uploads-dev", storageKey: "ws-test-1/up-done/f.jpg",
  status: "QUEUED", source: "receipt", contentType: "image/jpeg",
  originalFileName: "f.jpg", sizeBytes: 100, createdByUserId: "u",
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
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

const validRequest = {
  workspaceId: "ws-test-1",
  actorUserId: "u",
  correlationId: "test-correlation-id",
  request: { originalFileName: "f.jpg", contentType: "image/jpeg", sizeBytes: 100, source: "receipt" as const }
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("UploadsService — edge cases", () => {
  it("preserves very long filenames (>200 chars)", async () => {
    const service = new UploadsService();
    const longName = "a".repeat(200) + ".jpg";
    const { uploadFile } = await service.createUpload({
      ...validRequest,
      request: { ...validRequest.request, originalFileName: longName }
    });
    expect(uploadFile.originalFileName).toBe(longName);
  });

  it("handles filenames with special characters", async () => {
    const service = new UploadsService();
    const { uploadFile } = await service.createUpload({
      ...validRequest,
      request: { ...validRequest.request, originalFileName: "my receipt (2026) #1.jpg" }
    });
    expect(uploadFile.originalFileName).toBe("my receipt (2026) #1.jpg");
  });

  it("handles zero sizeBytes", async () => {
    const service = new UploadsService();
    const { uploadFile } = await service.createUpload({
      ...validRequest,
      request: { ...validRequest.request, sizeBytes: 0 }
    });
    expect(uploadFile.sizeBytes).toBe(0);
  });

  it("returns UPLOADED status when finalizing an already UPLOADED record (idempotent)", async () => {
    mockRepo.get.mockResolvedValueOnce({ ...baseRecord, status: "UPLOADED" });
    const service = new UploadsService();
    const result = await service.finalizeUpload({
      workspaceId: "ws-test-1", uploadFileId: "up-done",
      actorUserId: "u", correlationId: "test-correlation-id", request: {}
    });
    expect(result.status).toBe("UPLOADED");
  });

  it("persists record before presign — put is called even if presign fails", async () => {
    const { presignPutObject } = require("../integrations/s3.presign");
    presignPutObject.mockRejectedValueOnce(new Error("S3 presign error"));
    const service = new UploadsService();
    await expect(service.createUpload(validRequest)).rejects.toThrow("S3 presign error");
    // Service saves to DDB first, then calls presign — put will have been called
    expect(mockRepo.put).toHaveBeenCalledTimes(1);
  });
});