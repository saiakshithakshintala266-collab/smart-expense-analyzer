// File: services/extraction-service/src/domain/events.ts

// ── Inbound ──────────────────────────────────────────────────────────────────

export type UploadUploadedEvent = {
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
  source: "receipt" | "bank_csv" | "manual" | "bank_statement";
  checksumSha256?: string;
};

// ── Outbound ─────────────────────────────────────────────────────────────────

export type ExtractedField = {
  key: string;
  value: string;
  confidence?: number;
};

export type ExtractedLineItem = {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  date?: string;
  confidence?: number;
};

export type ExtractionCompletedEvent = {
  type: "extraction.completed.v1";
  occurredAt: string;
  correlationId: string;
  workspaceId: string;
  uploadFileId: string;
  extractedDocumentId: string;
  source: "receipt" | "bank_csv" | "manual" | "bank_statement";
  extractionMethod: "textract" | "csv_parser";
  fields: ExtractedField[];
  lineItems: ExtractedLineItem[];
  rawTextractJobId?: string;
  csvRowCount?: number;
  warnings: string[];
};

export type ExtractionFailedEvent = {
  type: "extraction.failed.v1";
  occurredAt: string;
  correlationId: string;
  workspaceId: string;
  uploadFileId: string;
  reason: string;
};