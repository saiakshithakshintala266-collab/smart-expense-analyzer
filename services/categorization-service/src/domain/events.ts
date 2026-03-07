// File: services/categorization-service/src/domain/events.ts

// ── Inbound ───────────────────────────────────────────────────────────────────

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

// ── Outbound ──────────────────────────────────────────────────────────────────

export type CategorizationMethod = "rules" | "llm" | "fallback";

export type CategorizationCompletedEvent = {
  type: "categorization.completed.v1";
  occurredAt: string;
  correlationId: string;
  workspaceId: string;
  transactionId: string;
  category: string;
  confidence: number;        // 0–1
  method: CategorizationMethod;
  skippedReason?: string;    // set when categorization was skipped
};