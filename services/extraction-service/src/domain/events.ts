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
  source: "receipt" | "bank_csv" | "manual";
  checksumSha256?: string;
};

// ── Outbound ─────────────────────────────────────────────────────────────────

export type ExtractedField = {
  key: string;       // e.g. "merchant", "total", "date", "tax", "currency"
  value: string;
  confidence?: number; // 0–1, from Textract or parser
};

export type ExtractedLineItem = {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  confidence?: number;
};

export type ExtractionCompletedEvent = {
  type: "extraction.completed.v1";
  occurredAt: string;
  correlationId: string;
  workspaceId: string;
  uploadFileId: string;
  extractedDocumentId: string;
  source: "receipt" | "bank_csv" | "manual";
  extractionMethod: "textract" | "csv_parser";
  fields: ExtractedField[];
  lineItems: ExtractedLineItem[];
  rawTextractJobId?: string;       // for receipts/PDFs
  csvRowCount?: number;            // for bank CSVs
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