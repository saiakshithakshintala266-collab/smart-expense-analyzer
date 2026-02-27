// File: services/upload-service/src/domain/uploads.service.ts
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { createLogger } from "@shared/logger";
import { getOrCreateCorrelationId } from "@shared/observability";
import { normalizeIdempotencyKey } from "@shared/idempotency";
import { CreateUploadRequestDto, FinalizeUploadRequestDto } from "../routes/uploads.dto";

import { createS3Client } from "../integrations/s3.client";
import { presignPutObject } from "../integrations/s3.presign";
import { verifyObjectExists } from "../integrations/s3.verify";

import { createDdbClient } from "../db/ddb.client";
import { UploadFilesRepo, UploadFileRecord, UploadStatus } from "../db/uploadfiles.repo";

type CreateUploadInput = {
  workspaceId: string;
  actorUserId: string;
  correlationId: string;
  idempotencyKey?: string;
  request: CreateUploadRequestDto;
};

type FinalizeUploadInput = {
  workspaceId: string;
  uploadFileId: string;
  actorUserId: string;
  correlationId: string;
  idempotencyKey?: string;
  request: FinalizeUploadRequestDto;
};

@Injectable()
export class UploadsService {
  private readonly log = createLogger({ serviceName: "upload-service" });

  private readonly s3 = createS3Client();
  private readonly repo = new UploadFilesRepo(
    createDdbClient(),
    mustGetEnv("DDB_UPLOADFILES_TABLE")
  );

  // Dev-only finalize dedupe (single instance). Real idempotency store comes later.
  private readonly finalizeDedupe = new Map<string, boolean>();

  async createUpload(input: CreateUploadInput) {
    const correlationId = getOrCreateCorrelationId(input.correlationId);
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

    const now = new Date().toISOString();
    const uploadFileId = uuidv4();

    const storageBucket = mustGetEnv("UPLOADS_BUCKET");
    const storageKey = `${input.workspaceId}/${uploadFileId}/${sanitizeFileName(
      input.request.originalFileName
    )}`;

    const record: UploadFileRecord = {
      id: uploadFileId,
      workspaceId: input.workspaceId,
      createdByUserId: input.actorUserId,
      storageBucket,
      storageKey,
      originalFileName: input.request.originalFileName,
      contentType: input.request.contentType,
      sizeBytes: input.request.sizeBytes,
      status: "QUEUED",
      source: input.request.source,
      checksumSha256: input.request.checksumSha256,
      createdAt: now,
      updatedAt: now
    };

    await this.repo.put(record);

    const expiresInSeconds = toInt(process.env.PRESIGN_EXPIRES_SECONDS, 900);

    const presignedUrl = await presignPutObject({
      s3: this.s3,
      bucket: storageBucket,
      key: storageKey,
      contentType: record.contentType,
      expiresInSeconds
    });

    this.log.info(
      { correlationId, idempotencyKey, workspaceId: input.workspaceId, uploadFileId },
      "upload created (ddb + s3 presign)"
    );

    return {
      uploadFile: record,
      presignedUrl,
      method: "PUT" as const,
      headers: {} as Record<string, string>,
      expiresInSeconds
    };
  }

  async finalizeUpload(input: FinalizeUploadInput) {
    const correlationId = getOrCreateCorrelationId(input.correlationId);
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

    const record = await this.repo.get(input.workspaceId, input.uploadFileId);
    if (!record) throw new NotFoundException("UploadFile not found");

    const dedupeKey = `${input.workspaceId}:${input.uploadFileId}:${idempotencyKey ?? "no-key"}`;
    if (this.finalizeDedupe.get(dedupeKey)) {
      this.log.info({ correlationId, dedupeKey }, "finalize deduped (dev-only)");
      return { uploadFileId: input.uploadFileId, status: record.status };
    }

    if (record.status !== "QUEUED" && record.status !== "UPLOADED") {
      throw new ConflictException(`Cannot finalize from status=${record.status}`);
    }

    // Ensure object exists in S3 (real presign upload step)
    await verifyObjectExists({
      s3: this.s3,
      bucket: record.storageBucket,
      key: record.storageKey
    });

    // Update status in DynamoDB
    await this.repo.updateStatus(input.workspaceId, input.uploadFileId, "UPLOADED");

    this.finalizeDedupe.set(dedupeKey, true);

    this.log.info(
      { correlationId, workspaceId: input.workspaceId, uploadFileId: input.uploadFileId },
      "upload finalized (s3 verified + ddb updated)"
    );

    return { uploadFileId: input.uploadFileId, status: "UPLOADED" as UploadStatus };
  }

  async getUpload(input: { workspaceId: string; uploadFileId: string }) {
    const record = await this.repo.get(input.workspaceId, input.uploadFileId);
    if (!record) throw new NotFoundException("UploadFile not found");
    return record;
  }

  async listUploads(input: { workspaceId: string; status?: string; source?: string }) {
    const res = await this.repo.listByWorkspace(input.workspaceId, 50);

    const items = res.items.filter((r) => {
      if (input.status && r.status !== input.status) return false;
      if (input.source && r.source !== input.source) return false;
      return true;
    });

    return { items, nextPageToken: res.nextPageToken };
  }

  async deleteUpload(input: { workspaceId: string; uploadFileId: string; actorUserId: string }) {
    // Optional for Phase 2.5: you can implement DDB delete + S3 delete later.
    // For now, keep behavior predictable: ensure it exists; then mark FAILED or delete record based on repo capability.
    const existing = await this.repo.get(input.workspaceId, input.uploadFileId);
    if (!existing) throw new NotFoundException("UploadFile not found");

    await this.repo.updateStatus(input.workspaceId, input.uploadFileId, "FAILED");

    this.log.warn(
      { workspaceId: input.workspaceId, uploadFileId: input.uploadFileId, actorUserId: input.actorUserId },
      "upload marked FAILED (delete semantics TODO: s3+ddb delete)"
    );
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 128);
}

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function toInt(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}