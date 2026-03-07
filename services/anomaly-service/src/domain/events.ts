// File: services/anomaly-service/src/domain/events.ts

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
    category?: string;
    source: "receipt" | "bank_csv" | "manual";
    uploadFileId?: string;
    extractedDocumentId?: string;
  };
};

// ── Outbound ──────────────────────────────────────────────────────────────────

export type AnomalyType =
  | "DUPLICATE_CHARGE"
  | "UNUSUALLY_LARGE_AMOUNT"
  | "RAPID_REPEAT_CHARGE"
  | "LARGE_ROUND_NUMBER"
  | "FIRST_TIME_MERCHANT"
  | "CATEGORY_SPEND_SPIKE";

export type AnomalySeverity = "LOW" | "MEDIUM" | "HIGH";

export type AnomalyDetectedEvent = {
  type: "anomaly.detected.v1";
  occurredAt: string;
  correlationId: string;
  workspaceId: string;
  anomalyId: string;
  transactionId: string;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  metadata: Record<string, unknown>;
};