import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { createLogger } from "@shared/logger";
import { getOrCreateCorrelationId } from "@shared/observability";
import { normalizeIdempotencyKey } from "@shared/idempotency";
import { CreateUploadRequestDto, FinalizeUploadRequestDto } from "../routes/uploads.dto";

type UploadStatus = "QUEUED" | "UPLOADED" | "PROCESSING" | "COMPLETED" | "FAILED";

type UploadRecord = {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  storageBucket: string;
  storageKey: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  status: UploadStatus;
  source: "receipt" | "bank_csv" | "manual";
  checksumSha256?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

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

  private readonly uploadsByWorkspace = new Map<string, Map<string, UploadRecord>>();
  private readonly finalizeDedupe = new Map<string, boolean>();

  createUpload(input: CreateUploadInput) {
    const correlationId = getOrCreateCorrelationId(input.correlationId);
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

    const now = new Date().toISOString();
    const uploadFileId = uuidv4();

    const storageBucket = process.env.UPLOADS_BUCKET ?? "local-dev-bucket";
    const storageKey = `${input.workspaceId}/${uploadFileId}/${sanitizeFileName(input.request.originalFileName)}`;

    const record: UploadRecord = {
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

    this.getWorkspaceMap(input.workspaceId).set(uploadFileId, record);

    const presignedUrl = `http://localhost:4566/${storageBucket}/${storageKey}?signature=dev`;

    this.log.info({ correlationId, idempotencyKey, workspaceId: input.workspaceId, uploadFileId }, "upload created");

    return {
      uploadFile: record,
      presignedUrl,
      method: "PUT",
      headers: {},
      expiresInSeconds: 900
    };
  }

  finalizeUpload(input: FinalizeUploadInput) {
    const correlationId = getOrCreateCorrelationId(input.correlationId);
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

    const record = this.getWorkspaceMap(input.workspaceId).get(input.uploadFileId);
    if (!record) throw new NotFoundException("UploadFile not found");

    const dedupeKey = `${input.workspaceId}:${input.uploadFileId}:${idempotencyKey ?? "no-key"}`;
    if (this.finalizeDedupe.get(dedupeKey)) {
      this.log.info({ correlationId, dedupeKey }, "finalize deduped");
      return { uploadFileId: input.uploadFileId, status: record.status };
    }

    if (record.status !== "QUEUED" && record.status !== "UPLOADED") {
      throw new ConflictException(`Cannot finalize from status=${record.status}`);
    }

    record.status = "UPLOADED";
    record.updatedAt = new Date().toISOString();
    record.checksumSha256 = input.request.checksumSha256 ?? record.checksumSha256;

    this.finalizeDedupe.set(dedupeKey, true);

    this.log.info({ correlationId, workspaceId: input.workspaceId, uploadFileId: input.uploadFileId }, "upload finalized");

    return { uploadFileId: input.uploadFileId, status: record.status };
  }

  getUpload(input: { workspaceId: string; uploadFileId: string }) {
    const record = this.getWorkspaceMap(input.workspaceId).get(input.uploadFileId);
    if (!record) throw new NotFoundException("UploadFile not found");
    return record;
  }

  listUploads(input: { workspaceId: string; status?: string; source?: string }) {
    const items = Array.from(this.getWorkspaceMap(input.workspaceId).values()).filter((r) => {
      if (input.status && r.status !== input.status) return false;
      if (input.source && r.source !== input.source) return false;
      return true;
    });
    return { items, nextPageToken: null };
  }

  deleteUpload(input: { workspaceId: string; uploadFileId: string; actorUserId: string }) {
    const ws = this.getWorkspaceMap(input.workspaceId);
    if (!ws.has(input.uploadFileId)) throw new NotFoundException("UploadFile not found");
    ws.delete(input.uploadFileId);

    this.log.warn({ workspaceId: input.workspaceId, uploadFileId: input.uploadFileId, actorUserId: input.actorUserId }, "upload deleted (dev store only)");
  }

  private getWorkspaceMap(workspaceId: string): Map<string, UploadRecord> {
    const existing = this.uploadsByWorkspace.get(workspaceId);
    if (existing) return existing;
    const created = new Map<string, UploadRecord>();
    this.uploadsByWorkspace.set(workspaceId, created);
    return created;
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 128);
}
