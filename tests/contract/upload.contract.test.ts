// File: tests/contract/upload.contract.test.ts
import request from "supertest";
import { ValidationPipe, NotFoundException, ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { AppModule } from "../../services/upload-service/src/module/app.module";
import { UploadsService } from "../../services/upload-service/src/domain/uploads.service";

const mockRecord = {
  id: "test-upload-id",
  workspaceId: "ws-test-1",
  createdByUserId: "dev-user",
  storageBucket: "sea-uploads-dev",
  storageKey: "ws-test-1/test-upload-id/receipt.jpg",
  originalFileName: "receipt.jpg",
  contentType: "image/jpeg",
  sizeBytes: 1024,
  status: "QUEUED",
  source: "receipt",
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z"
};

const mockService = {
  createUpload: jest.fn().mockResolvedValue({
    uploadFile: mockRecord,
    presignedUrl: "http://localhost:4566/sea-uploads-dev/ws-test-1/test-upload-id/receipt.jpg?sig=abc",
    method: "PUT",
    headers: {},
    expiresInSeconds: 900
  }),
  finalizeUpload: jest.fn().mockResolvedValue({ uploadFileId: mockRecord.id, status: "UPLOADED" }),
  getUpload: jest.fn().mockResolvedValue(mockRecord),
  listUploads: jest.fn().mockResolvedValue({ items: [mockRecord], nextPageToken: null }),
  deleteUpload: jest.fn().mockResolvedValue(undefined)
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;

beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(UploadsService)
    .useValue(mockService)
    .compile();

  app = module.createNestApplication(new FastifyAdapter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  // FIX: Must bind to '127.0.0.1' explicitly. Fastify with port 0 alone may bind to
  // '0.0.0.0' or '::' depending on OS, and supertest's getHttpServer() then can't
  // connect — causing empty bodies and unhandled exceptions becoming 500s.
  await app.listen(0, "127.0.0.1");
});

afterAll(async () => { await app.close(); });

beforeEach(() => {
  jest.clearAllMocks();
  mockService.createUpload.mockResolvedValue({
    uploadFile: mockRecord,
    presignedUrl: "http://localhost:4566/sea-uploads-dev/ws-test-1/test-upload-id/receipt.jpg?sig=abc",
    method: "PUT",
    headers: {},
    expiresInSeconds: 900
  });
  mockService.finalizeUpload.mockResolvedValue({ uploadFileId: mockRecord.id, status: "UPLOADED" });
  mockService.getUpload.mockResolvedValue(mockRecord);
});

// ── GET /health ───────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app.getHttpServer()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("upload-service");
  });
});

// ── POST /workspaces/:workspaceId/uploads ─────────────────────────────────────

describe("POST /workspaces/:workspaceId/uploads", () => {
  const validBody = { originalFileName: "receipt.jpg", contentType: "image/jpeg", sizeBytes: 1024, source: "receipt" };

  it("201 — returns uploadFile and presignedUrl", async () => {
    const res = await request(app.getHttpServer())
      .post("/workspaces/ws-test-1/uploads")
      .set("X-Debug-Role", "admin")
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.uploadFile.status).toBe("QUEUED");
    expect(res.body.uploadFile.workspaceId).toBe("ws-test-1");
    expect(res.body.presignedUrl).toBeTruthy();
    expect(res.body.method).toBe("PUT");
    expect(res.body.expiresInSeconds).toBe(900);
  });

  it("201 — passes workspaceId from path to service", async () => {
    await request(app.getHttpServer())
      .post("/workspaces/ws-test-1/uploads")
      .set("X-Debug-Role", "admin")
      .send(validBody);

    expect(mockService.createUpload).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws-test-1" })
    );
  });

  it("400 — missing originalFileName", async () => {
    const { originalFileName: _, ...body } = validBody;
    const res = await request(app.getHttpServer())
      .post("/workspaces/ws-test-1/uploads").set("X-Debug-Role", "admin").send(body);
    expect(res.status).toBe(400);
  });

  it("400 — missing contentType", async () => {
    const { contentType: _, ...body } = validBody;
    const res = await request(app.getHttpServer())
      .post("/workspaces/ws-test-1/uploads").set("X-Debug-Role", "admin").send(body);
    expect(res.status).toBe(400);
  });

  it("400 — missing sizeBytes", async () => {
    const { sizeBytes: _, ...body } = validBody;
    const res = await request(app.getHttpServer())
      .post("/workspaces/ws-test-1/uploads").set("X-Debug-Role", "admin").send(body);
    expect(res.status).toBe(400);
  });

  it("401 — missing X-Debug-Role header", async () => {
    const res = await request(app.getHttpServer())
      .post("/workspaces/ws-test-1/uploads").send(validBody);
    expect(res.status).toBe(401);
  });
});

// ── POST /workspaces/:workspaceId/uploads/:id/finalize ────────────────────────

describe("POST /workspaces/:workspaceId/uploads/:id/finalize", () => {
  it("200 — returns UPLOADED status", async () => {
    const res = await request(app.getHttpServer())
      .post("/workspaces/ws-test-1/uploads/test-upload-id/finalize")
      .set("X-Debug-Role", "admin")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("UPLOADED");
  });

  it("404 — upload not found", async () => {
    mockService.finalizeUpload.mockRejectedValueOnce(new NotFoundException("Upload not found"));
    const res = await request(app.getHttpServer())
      .post("/workspaces/ws-test-1/uploads/nonexistent/finalize")
      .set("X-Debug-Role", "admin")
      .send({});
    expect(res.status).toBe(404);
  });

  it("409 — already finalized", async () => {
    mockService.finalizeUpload.mockRejectedValueOnce(new ConflictException("Already finalized"));
    const res = await request(app.getHttpServer())
      .post("/workspaces/ws-test-1/uploads/test-upload-id/finalize")
      .set("X-Debug-Role", "admin")
      .send({});
    expect(res.status).toBe(409);
  });
});

// ── GET /workspaces/:workspaceId/uploads/:id ──────────────────────────────────

describe("GET /workspaces/:workspaceId/uploads/:id", () => {
  it("200 — returns the upload record", async () => {
    const res = await request(app.getHttpServer())
      .get("/workspaces/ws-test-1/uploads/test-upload-id")
      .set("X-Debug-Role", "admin");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("test-upload-id");
    expect(res.body.workspaceId).toBe("ws-test-1");
  });

  it("404 — upload not found", async () => {
    mockService.getUpload.mockRejectedValueOnce(new NotFoundException("Upload not found"));
    const res = await request(app.getHttpServer())
      .get("/workspaces/ws-test-1/uploads/nonexistent")
      .set("X-Debug-Role", "admin");
    expect(res.status).toBe(404);
  });
});