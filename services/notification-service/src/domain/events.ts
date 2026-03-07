// File: services/notification-service/src/domain/events.ts

// ── Inbound ───────────────────────────────────────────────────────────────────

export type AnomalyDetectedEvent = {
  type: "anomaly.detected.v1";
  occurredAt: string;
  correlationId: string;
  workspaceId: string;
  anomalyId: string;
  transactionId: string;
  anomalyType: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  metadata: Record<string, unknown>;
};

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
  };
};

export type InboundEvent = AnomalyDetectedEvent | TransactionUpsertedEvent;