// File: services/transactions-service/src/domain/normalizer.ts
import { v4 as uuidv4 } from "uuid";
import { ExtractionCompletedEvent, ExtractedField } from "./events";
import { TransactionRecord, TransactionSource } from "../db/transactions.repo";

/**
 * Maps an extraction.completed.v1 event into one or more canonical TransactionRecords.
 *
 * Receipt / image → single transaction (summary fields)
 * Bank CSV        → one transaction per line item (each row = one expense)
 */
export function normalizeExtraction(
  event: ExtractionCompletedEvent,
  idGenerator: () => string,
  now: string
): TransactionRecord[] {
  if (event.source === "bank_csv") {
    return normalizeCsvRows(event, idGenerator, now);
  }

  // Bank statement PDFs arrive with source="receipt" but produce multiple line items.
  // If there are line items with prices, create one transaction per line item.
  const hasLineItems = event.lineItems.some(li => li.totalPrice !== undefined && li.totalPrice > 0);
  if (hasLineItems) {
    return normalizeCsvRows(event, idGenerator, now);
  }

  return [normalizeReceiptOrImage(event, idGenerator, now)];
}

// ── Receipt / image ───────────────────────────────────────────────────────────

function normalizeReceiptOrImage(
  event: ExtractionCompletedEvent,
  idGenerator: () => string,
  now: string
): TransactionRecord {
  const fields = indexFields(event.fields);

  const merchant =
    fields["vendor_name"] ??
    fields["merchant"] ??
    fields["supplier_name"] ??
    fields["name"] ??
    "Unknown Merchant";

  const amountRaw =
    fields["total"] ??
    fields["amount_due"] ??
    fields["amount_paid"] ??
    fields["subtotal"] ??
    "";

  const amount = parseAmount(amountRaw) ?? 0;
  const currency = normalizeCurrency(fields["currency"] ?? fields["currency_code"]) ?? "USD";

  const dateRaw =
    fields["invoice_receipt_date"] ??
    fields["date"] ??
    fields["transaction_date"] ??
    "";

  const date = parseDate(dateRaw) ?? now.slice(0, 10);

  const confidences = event.fields
    .map((f) => f.confidence)
    .filter((c): c is number => c !== undefined);
  const extractionConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : undefined;

  return {
    id: idGenerator(),
    workspaceId: event.workspaceId,
    uploadFileId: event.uploadFileId,
    extractedDocumentId: event.extractedDocumentId,
    source: event.source,
    merchant,
    amount,
    currency,
    date,
    extractionConfidence,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now
  };
}

// ── Bank CSV ──────────────────────────────────────────────────────────────────

function normalizeCsvRows(
  event: ExtractionCompletedEvent,
  idGenerator: () => string,
  now: string
): TransactionRecord[] {
  const fields = indexFields(event.fields);
  const currency = normalizeCurrency(fields["currency"]) ?? "USD";

  return event.lineItems
    .filter((item) => item.totalPrice !== undefined || item.description)
    .map((item) => ({
      id: idGenerator(),
      workspaceId: event.workspaceId,
      uploadFileId: event.uploadFileId,
      extractedDocumentId: event.extractedDocumentId,
      source: event.source,
      merchant: item.description?.trim() || "Unknown Merchant",
      amount: item.totalPrice ?? 0,
      currency,
      date: item.date ?? now.slice(0, 10),
      extractionConfidence: item.confidence,
      status: "ACTIVE" as const,
      createdAt: now,
      updatedAt: now
    }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function indexFields(fields: ExtractedField[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of fields) {
    map[f.key.toLowerCase()] = f.value;
  }
  return map;
}

function parseAmount(raw: string): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

function normalizeCurrency(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const upper = raw.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  const symbolMap: Record<string, string> = {
    "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₹": "INR"
  };
  return symbolMap[upper] ?? "USD";
}

function parseDate(raw: string): string | undefined {
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const mdy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return undefined;
}