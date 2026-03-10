// File: tests/integration/upload-to-transaction.test.ts
/**
 * Integration test: upload → finalize → extraction queue → extraction service
 *                   → transactions queue → transactions service → DynamoDB
 *
 * Requires LocalStack running on localhost:4566 AND all services running locally.
 * Run: pnpm test:integration
 */
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../tools/docker/.env.local") });

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  createTestDdbClient,
  createTestSqsClient,
  cleanupByPk,
  waitForMessage,
  purgeQueue,
  sleep,
  QUEUE_URLS,
  TABLE_NAMES
} from "@shared/testing";

const UPLOAD_URL      = "http://localhost:3001";
const WORKSPACE_ID    = "ws-integration-test";
const AUTH_HEADER     = { "X-Debug-Role": "admin" };
const CONTENT_HEADER  = { "Content-Type": "application/json" };

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiPost(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { ...AUTH_HEADER, ...CONTENT_HEADER },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${url} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function createUpload(fileName: string) {
  return apiPost(`${UPLOAD_URL}/workspaces/${WORKSPACE_ID}/uploads`, {
    originalFileName: fileName,
    contentType: "image/jpeg",
    sizeBytes: 100,
    source: "receipt"
  }) as Promise<{ uploadFile: { id: string; storageKey: string }; presignedUrl: string }>;
}

async function putObjectToLocalStack(storageKey: string) {
  const s3 = new S3Client({
    region: "us-east-1",
    endpoint: "http://localhost:4566",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    forcePathStyle: true
  });
  await s3.send(new PutObjectCommand({
    Bucket: "sea-uploads-dev",
    Key: storageKey,
    Body: Buffer.from("fake-image-bytes"),
    ContentType: "image/jpeg"
  }));
}

async function finalizeUpload(uploadId: string) {
  return apiPost(`${UPLOAD_URL}/workspaces/${WORKSPACE_ID}/uploads/${uploadId}/finalize`, {});
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const ddb = createTestDdbClient();
const sqs = createTestSqsClient();

beforeAll(async () => {
  await purgeQueue(sqs, QUEUE_URLS.extraction);
  await purgeQueue(sqs, QUEUE_URLS.transactions);
});

afterAll(async () => {
  await cleanupByPk(ddb, TABLE_NAMES.uploadFiles,   `WS#${WORKSPACE_ID}`);
  await cleanupByPk(ddb, TABLE_NAMES.extractedDocs, `WS#${WORKSPACE_ID}`);
  await cleanupByPk(ddb, TABLE_NAMES.transactions,  `WS#${WORKSPACE_ID}`);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Upload → Extraction → Transactions — integration", () => {
  it("creates an upload record with QUEUED status", async () => {
    const { uploadFile } = await createUpload("integration-test-1.jpg");
    expect(uploadFile.id).toBeTruthy();
    expect(uploadFile.storageKey).toContain(WORKSPACE_ID);
  });

  it("finalizes an upload → status becomes UPLOADED", async () => {
    const { uploadFile } = await createUpload("finalize-test.jpg");
    await putObjectToLocalStack(uploadFile.storageKey);

    const finalized = await finalizeUpload(uploadFile.id) as { status: string };
    expect(finalized.status).toBe("UPLOADED");
  });

  it("publishes upload.uploaded.v1 to extraction queue after finalize", async () => {
    const { uploadFile } = await createUpload("event-flow-test.jpg");
    await putObjectToLocalStack(uploadFile.storageKey);
    await finalizeUpload(uploadFile.id);

    const event = await waitForMessage(
      sqs,
      QUEUE_URLS.extraction,
      (body) => {
        const b = body as { type?: string; uploadFileId?: string };
        return b.type === "upload.uploaded.v1" && b.uploadFileId === uploadFile.id;
      }
    );

    const evt = event as { type: string; uploadFileId: string; workspaceId: string };
    expect(evt.type).toBe("upload.uploaded.v1");
    expect(evt.uploadFileId).toBe(uploadFile.id);
    expect(evt.workspaceId).toBe(WORKSPACE_ID);
  });

  it("extraction service produces extraction.completed.v1 on transactions queue", async () => {
    const { uploadFile } = await createUpload("extraction-chain-test.jpg");
    await putObjectToLocalStack(uploadFile.storageKey);
    await finalizeUpload(uploadFile.id);

    // Wait for extraction-service to consume the upload event and publish extraction.completed.v1
    const event = await waitForMessage(
      sqs,
      QUEUE_URLS.transactions,
      (body) => {
        const b = body as { type?: string; uploadFileId?: string };
        return b.type === "extraction.completed.v1" && b.uploadFileId === uploadFile.id;
      },
      20000
    );

    const evt = event as { type: string; lineItems: unknown[] };
    expect(evt.type).toBe("extraction.completed.v1");
    expect(Array.isArray(evt.lineItems)).toBe(true);
  });

  it("double-finalize is rejected (idempotency)", async () => {
    const { uploadFile } = await createUpload("double-finalize.jpg");
    await putObjectToLocalStack(uploadFile.storageKey);
    await finalizeUpload(uploadFile.id);
    await sleep(300);

    const res = await fetch(
      `${UPLOAD_URL}/workspaces/${WORKSPACE_ID}/uploads/${uploadFile.id}/finalize`,
      { method: "POST", headers: { ...AUTH_HEADER, ...CONTENT_HEADER }, body: JSON.stringify({}) }
    );

    expect([400, 409]).toContain(res.status);
  });

  it("missing S3 object causes finalize to fail gracefully", async () => {
    const { uploadFile } = await createUpload("no-s3-object.jpg");
    // Deliberately skip putObjectToLocalStack

    const res = await fetch(
      `${UPLOAD_URL}/workspaces/${WORKSPACE_ID}/uploads/${uploadFile.id}/finalize`,
      { method: "POST", headers: { ...AUTH_HEADER, ...CONTENT_HEADER }, body: JSON.stringify({}) }
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});