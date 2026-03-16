"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeUploadUploadedEvent = makeUploadUploadedEvent;
exports.makeExtractionCompletedEvent = makeExtractionCompletedEvent;
exports.makeTransactionUpsertedEvent = makeTransactionUpsertedEvent;
exports.makeAnomalyDetectedEvent = makeAnomalyDetectedEvent;
// File: shared/libs/testing/src/fixtures/events.ts
const uuid_1 = require("uuid");
// ── upload.uploaded.v1 ────────────────────────────────────────────────────────
function makeUploadUploadedEvent(overrides = {}) {
    const uploadFileId = overrides.uploadFileId ?? (0, uuid_1.v4)();
    const workspaceId = overrides.workspaceId ?? "ws-test-1";
    return {
        type: "upload.uploaded.v1",
        occurredAt: new Date().toISOString(),
        correlationId: overrides.correlationId ?? (0, uuid_1.v4)(),
        uploadFileId,
        workspaceId,
        storageBucket: overrides.storageBucket ?? "sea-uploads-dev",
        storageKey: overrides.storageKey ?? `${workspaceId}/${uploadFileId}/receipt.jpg`,
        originalFileName: overrides.originalFileName ?? "receipt.jpg",
        contentType: overrides.contentType ?? "image/jpeg",
        sizeBytes: overrides.sizeBytes ?? 1024,
        source: overrides.source ?? "receipt"
    };
}
// ── extraction.completed.v1 ───────────────────────────────────────────────────
function makeExtractionCompletedEvent(overrides = {}) {
    return {
        type: "extraction.completed.v1",
        occurredAt: new Date().toISOString(),
        correlationId: overrides.correlationId ?? (0, uuid_1.v4)(),
        uploadFileId: overrides.uploadFileId ?? (0, uuid_1.v4)(),
        workspaceId: overrides.workspaceId ?? "ws-test-1",
        extractedDocumentId: overrides.extractedDocumentId ?? (0, uuid_1.v4)(),
        source: overrides.source ?? "receipt",
        extractionMethod: overrides.extractionMethod ?? "textract",
        fields: overrides.fields ?? [],
        lineItems: overrides.lineItems ?? [],
        warnings: overrides.warnings ?? []
    };
}
// ── transaction.upserted.v1 ───────────────────────────────────────────────────
function makeTransactionUpsertedEvent(overrides = {}) {
    return {
        type: "transaction.upserted.v1",
        occurredAt: new Date().toISOString(),
        correlationId: overrides.correlationId ?? (0, uuid_1.v4)(),
        workspaceId: overrides.workspaceId ?? "ws-test-1",
        transactionId: overrides.transactionId ?? (0, uuid_1.v4)(),
        operation: overrides.operation ?? "CREATED",
        snapshot: {
            merchant: overrides.merchant ?? "Starbucks",
            amount: overrides.amount ?? 5.50,
            currency: overrides.currency ?? "USD",
            date: overrides.date ?? new Date().toISOString().slice(0, 10),
            // Use 'in' check so callers can explicitly pass undefined to omit the category
            ...("category" in overrides ? { category: overrides.category } : { category: "Dining" }),
            source: overrides.source ?? "receipt"
        }
    };
}
// ── anomaly.detected.v1 ───────────────────────────────────────────────────────
function makeAnomalyDetectedEvent(overrides = {}) {
    return {
        type: "anomaly.detected.v1",
        occurredAt: new Date().toISOString(),
        correlationId: overrides.correlationId ?? (0, uuid_1.v4)(),
        workspaceId: overrides.workspaceId ?? "ws-test-1",
        anomalyId: overrides.anomalyId ?? (0, uuid_1.v4)(),
        transactionId: overrides.transactionId ?? (0, uuid_1.v4)(),
        anomalyType: overrides.anomalyType ?? "DUPLICATE_CHARGE",
        severity: overrides.severity ?? "HIGH",
        description: overrides.description ?? "Possible duplicate charge detected",
        metadata: {}
    };
}
//# sourceMappingURL=events.js.map