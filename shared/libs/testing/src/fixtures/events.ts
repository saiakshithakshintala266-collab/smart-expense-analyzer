// File: shared/libs/testing/src/fixtures/events.ts
import { v4 as uuidv4 } from "uuid";

// ── Types (inlined to avoid cross-service import issues in shared lib) ─────────

type ExtractedField    = { key: string; value: string; confidence?: number };
type ExtractedLineItem = { description?: string; quantity?: number; unitPrice?: number; totalPrice?: number; confidence?: number };

// ── upload.uploaded.v1 ────────────────────────────────────────────────────────

export function makeUploadUploadedEvent(overrides: Partial<{
  uploadFileId: string;
  workspaceId: string;
  storageBucket: string;
  storageKey: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  source: "receipt" | "bank_csv" | "manual";
  correlationId: string;
}> = {}) {
  const uploadFileId = overrides.uploadFileId ?? uuidv4();
  const workspaceId  = overrides.workspaceId  ?? "ws-test-1";
  return {
    type:             "upload.uploaded.v1" as const,
    occurredAt:       new Date().toISOString(),
    correlationId:    overrides.correlationId    ?? uuidv4(),
    uploadFileId,
    workspaceId,
    storageBucket:    overrides.storageBucket    ?? "sea-uploads-dev",
    storageKey:       overrides.storageKey       ?? `${workspaceId}/${uploadFileId}/receipt.jpg`,
    originalFileName: overrides.originalFileName ?? "receipt.jpg",
    contentType:      overrides.contentType      ?? "image/jpeg",
    sizeBytes:        overrides.sizeBytes        ?? 1024,
    source:           overrides.source           ?? ("receipt" as const)
  };
}

// ── extraction.completed.v1 ───────────────────────────────────────────────────

export function makeExtractionCompletedEvent(overrides: Partial<{
  uploadFileId: string;
  workspaceId: string;
  extractedDocumentId: string;
  correlationId: string;
  source: "receipt" | "bank_csv" | "manual";
  extractionMethod: "textract" | "csv_parser";
  fields: ExtractedField[];
  lineItems: ExtractedLineItem[];
  warnings: string[];
}> = {}) {
  return {
    type:                "extraction.completed.v1" as const,
    occurredAt:          new Date().toISOString(),
    correlationId:       overrides.correlationId       ?? uuidv4(),
    uploadFileId:        overrides.uploadFileId        ?? uuidv4(),
    workspaceId:         overrides.workspaceId         ?? "ws-test-1",
    extractedDocumentId: overrides.extractedDocumentId ?? uuidv4(),
    source:              overrides.source              ?? ("receipt" as const),
    extractionMethod:    overrides.extractionMethod    ?? ("textract" as const),
    fields:              overrides.fields              ?? [],
    lineItems:           overrides.lineItems           ?? [],
    warnings:            overrides.warnings            ?? []
  };
}

// ── transaction.upserted.v1 ───────────────────────────────────────────────────

export function makeTransactionUpsertedEvent(overrides: Partial<{
  transactionId: string;
  workspaceId: string;
  correlationId: string;
  operation: "CREATED" | "UPDATED" | "DELETED";
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  source: "receipt" | "bank_csv" | "manual";
}> = {}) {
  return {
    type:          "transaction.upserted.v1" as const,
    occurredAt:    new Date().toISOString(),
    correlationId: overrides.correlationId ?? uuidv4(),
    workspaceId:   overrides.workspaceId   ?? "ws-test-1",
    transactionId: overrides.transactionId ?? uuidv4(),
    operation:     overrides.operation     ?? ("CREATED" as const),
    snapshot: {
      merchant: overrides.merchant  ?? "Starbucks",
      amount:   overrides.amount    ?? 5.50,
      currency: overrides.currency  ?? "USD",
      date:     overrides.date      ?? new Date().toISOString().slice(0, 10),
      // Use 'in' check so callers can explicitly pass undefined to omit the category
      ...("category" in overrides ? { category: overrides.category } : { category: "Dining" }),
      source:   overrides.source    ?? ("receipt" as const)
    }
  };
}

// ── anomaly.detected.v1 ───────────────────────────────────────────────────────

export function makeAnomalyDetectedEvent(overrides: Partial<{
  anomalyId: string;
  workspaceId: string;
  transactionId: string;
  correlationId: string;
  anomalyType: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
}> = {}) {
  return {
    type:          "anomaly.detected.v1" as const,
    occurredAt:    new Date().toISOString(),
    correlationId: overrides.correlationId ?? uuidv4(),
    workspaceId:   overrides.workspaceId   ?? "ws-test-1",
    anomalyId:     overrides.anomalyId     ?? uuidv4(),
    transactionId: overrides.transactionId ?? uuidv4(),
    anomalyType:   overrides.anomalyType   ?? "DUPLICATE_CHARGE",
    severity:      overrides.severity      ?? ("HIGH" as const),
    description:   overrides.description   ?? "Possible duplicate charge detected",
    metadata:      {}
  };
}