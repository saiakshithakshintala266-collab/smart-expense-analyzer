// File: services/transactions-service/src/domain/events.ts

// ── Inbound ───────────────────────────────────────────────────────────────────

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
  rawTextractJobId?: string;
  csvRowCount?: number;
  warnings: string[];
};

// ── Outbound ──────────────────────────────────────────────────────────────────

export type TransactionUpsertedEvent = {
  type: "transaction.upserted.v1";
  occurredAt: string;
  correlationId: string;
  workspaceId: string;
  transactionId: string;
  operation: "CREATED" | "UPDATED" | "DELETED";
  snapshot: {
    merchant: string;
    amount: number;
    currency: string;
    date: string;
    category?: string;
    source: "receipt" | "bank_csv" | "manual";
    uploadFileId?: string;
    extractedDocumentId?: string;
  };
};

export type TransactionCategoryOverriddenEvent = {
  type: "transaction.category.overridden.v1";
  occurredAt: string;
  correlationId: string;
  workspaceId: string;
  transactionId: string;
  previousCategory?: string;
  newCategory: string;
  overriddenByUserId: string;
};