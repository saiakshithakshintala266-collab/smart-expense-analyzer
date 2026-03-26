// File: services/analytics-service/src/domain/events.ts

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
    date: string;           // YYYY-MM-DD
    source: "receipt" | "bank_csv" | "manual";
    uploadFileId?: string;
    extractedDocumentId?: string;
  };
};