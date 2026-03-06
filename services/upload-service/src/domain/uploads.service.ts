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

import { createSnsClient, publishEvent, mustGetEventsTopicArn } from "../integrations/sns.publisher";

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

type UploadUploadedEvent = {
  type: "upload.uploaded.v1";
  occurredAt: string;
  correlationId: string;
  workspaceId: string;
  uploadFileId: string;
  storageBucket: string;
  storageKey: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  source: "receipt" | "bank_csv" | "manual";
  checksumSha256?: string;
};

@Injectable()
export class UploadsService {
  private readonly log = createLogger({ serviceName: "upload-service" });

  private readonly s3 = createS3Client();
  private readonly repo = new UploadFilesRepo(createDdbClient(), mustGetEnv("DDB_UPLOADFILES_TABLE"));

  private readonly sns = createSnsClient();
  private readonly eventsTopicArn = mustGetEventsTopicArn();

  // Dev-only finalize dedupe (single instance). Real idempotency store comes later.
  private readonly finalizeDedupe = new Map<string, boolean>();

  async createUpload(input: CreateUploadInput) {
    const correlationId = getOrCreateCorrelationId(input.correlationId);
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

    const now = new Date().toISOString();
    const uploadFileId = uuidv4();

    const storageBucket = mustGetEnv("UPLOADS_BUCKET");
    const storageKey = `${input.workspaceId}/${uploadFileId}/${sanitizeFileName(input.request.originalFileName)}`;

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
      { correlationId, idempotencyKey, workspaceId: input.workspaceId, uploadFileId, storageBucket, storageKey },
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

    // 1) Ensure object exists in S3
    await verifyObjectExists({
      s3: this.s3,
      bucket: record.storageBucket,
      key: record.storageKey
    });

    // 2) Update DynamoDB status
    await this.repo.updateStatus(input.workspaceId, input.uploadFileId, "UPLOADED");

    // 3) Publish event via shared publisher
    const evt: UploadUploadedEvent = {
      type: "upload.uploaded.v1",
      occurredAt: new Date().toISOString(),
      correlationId,
      workspaceId: record.workspaceId,
      uploadFileId: record.id,
      storageBucket: record.storageBucket,
      storageKey: record.storageKey,
      originalFileName: record.originalFileName,
      contentType: record.contentType,
      sizeBytes: record.sizeBytes,
      source: record.source,
      checksumSha256: input.request.checksumSha256 ?? record.checksumSha256
    };

    await publishEvent(this.sns, {
      topicArn: this.eventsTopicArn,
      message: evt,
      messageAttributes: {
        eventType: { DataType: "String", StringValue: evt.type },
        workspaceId: { DataType: "String", StringValue: evt.workspaceId },
        uploadFileId: { DataType: "String", StringValue: evt.uploadFileId }
      }
    });

    this.finalizeDedupe.set(dedupeKey, true);

    this.log.info(
      { correlationId, workspaceId: input.workspaceId, uploadFileId: input.uploadFileId, eventType: evt.type },
      "upload finalized (s3 verified + ddb updated + sns published)"
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
    const existing = await this.repo.get(input.workspaceId, input.uploadFileId);
    if (!existing) throw new NotFoundException("UploadFile not found");

    // TODO: implement real delete (S3 object removal + DDB hard delete) in a later iteration
    await this.repo.updateStatus(input.workspaceId, input.uploadFileId, "FAILED");

    this.log.warn(
      { workspaceId: input.workspaceId, uploadFileId: input.uploadFileId, actorUserId: input.actorUserId },
      "upload marked FAILED (soft delete placeholder)"
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