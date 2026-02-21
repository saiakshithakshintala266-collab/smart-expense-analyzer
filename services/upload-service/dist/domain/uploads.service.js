"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsService = void 0;
const common_1 = require("@nestjs/common");
const uuid_1 = require("uuid");
const logger_1 = require("@shared/logger");
const observability_1 = require("@shared/observability");
const idempotency_1 = require("@shared/idempotency");
let UploadsService = class UploadsService {
    constructor() {
        this.log = (0, logger_1.createLogger)({ serviceName: "upload-service" });
        this.uploadsByWorkspace = new Map();
        this.finalizeDedupe = new Map();
    }
    createUpload(input) {
        const correlationId = (0, observability_1.getOrCreateCorrelationId)(input.correlationId);
        const idempotencyKey = (0, idempotency_1.normalizeIdempotencyKey)(input.idempotencyKey);
        const now = new Date().toISOString();
        const uploadFileId = (0, uuid_1.v4)();
        const storageBucket = process.env.UPLOADS_BUCKET ?? "local-dev-bucket";
        const storageKey = `${input.workspaceId}/${uploadFileId}/${sanitizeFileName(input.request.originalFileName)}`;
        const record = {
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
    finalizeUpload(input) {
        const correlationId = (0, observability_1.getOrCreateCorrelationId)(input.correlationId);
        const idempotencyKey = (0, idempotency_1.normalizeIdempotencyKey)(input.idempotencyKey);
        const record = this.getWorkspaceMap(input.workspaceId).get(input.uploadFileId);
        if (!record)
            throw new common_1.NotFoundException("UploadFile not found");
        const dedupeKey = `${input.workspaceId}:${input.uploadFileId}:${idempotencyKey ?? "no-key"}`;
        if (this.finalizeDedupe.get(dedupeKey)) {
            this.log.info({ correlationId, dedupeKey }, "finalize deduped");
            return { uploadFileId: input.uploadFileId, status: record.status };
        }
        if (record.status !== "QUEUED" && record.status !== "UPLOADED") {
            throw new common_1.ConflictException(`Cannot finalize from status=${record.status}`);
        }
        record.status = "UPLOADED";
        record.updatedAt = new Date().toISOString();
        record.checksumSha256 = input.request.checksumSha256 ?? record.checksumSha256;
        this.finalizeDedupe.set(dedupeKey, true);
        this.log.info({ correlationId, workspaceId: input.workspaceId, uploadFileId: input.uploadFileId }, "upload finalized");
        return { uploadFileId: input.uploadFileId, status: record.status };
    }
    getUpload(input) {
        const record = this.getWorkspaceMap(input.workspaceId).get(input.uploadFileId);
        if (!record)
            throw new common_1.NotFoundException("UploadFile not found");
        return record;
    }
    listUploads(input) {
        const items = Array.from(this.getWorkspaceMap(input.workspaceId).values()).filter((r) => {
            if (input.status && r.status !== input.status)
                return false;
            if (input.source && r.source !== input.source)
                return false;
            return true;
        });
        return { items, nextPageToken: null };
    }
    deleteUpload(input) {
        const ws = this.getWorkspaceMap(input.workspaceId);
        if (!ws.has(input.uploadFileId))
            throw new common_1.NotFoundException("UploadFile not found");
        ws.delete(input.uploadFileId);
        this.log.warn({ workspaceId: input.workspaceId, uploadFileId: input.uploadFileId, actorUserId: input.actorUserId }, "upload deleted (dev store only)");
    }
    getWorkspaceMap(workspaceId) {
        const existing = this.uploadsByWorkspace.get(workspaceId);
        if (existing)
            return existing;
        const created = new Map();
        this.uploadsByWorkspace.set(workspaceId, created);
        return created;
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = __decorate([
    (0, common_1.Injectable)()
], UploadsService);
function sanitizeFileName(name) {
    return name.replace(/[^\w.\-]+/g, "_").slice(0, 128);
}
//# sourceMappingURL=uploads.service.js.map