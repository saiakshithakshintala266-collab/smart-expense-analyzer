// File: services/transactions-service/src/__tests__/normalizer.test.ts
import { normalizeExtraction } from "../domain/normalizer";
import { ExtractionCompletedEvent } from "../domain/events";
import { v4 as uuidv4 } from "uuid";

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = "2026-03-01T12:00:00.000Z";
let idCounter = 0;
const idGen = () => `test-id-${++idCounter}`;

function makeEvent(overrides: Partial<ExtractionCompletedEvent> = {}): ExtractionCompletedEvent {
  return {
    type: "extraction.completed.v1",
    occurredAt: NOW,
    correlationId: uuidv4(),
    uploadFileId: "upload-123",
    workspaceId: "ws-test-1",
    extractedDocumentId: "doc-123",
    source: "receipt",
    extractionMethod: "textract",
    fields: [],
    lineItems: [],
    warnings: [],
    ...overrides
  };
}

beforeEach(() => { idCounter = 0; });

// ── Receipt / image path ──────────────────────────────────────────────────────

describe("normalizeExtraction — receipt/image (textract)", () => {
  it("maps vendor_name field to merchant", () => {
    const event = makeEvent({
      fields: [{ key: "vendor_name", value: "Starbucks", confidence: 0.99 }]
    });
    const [txn] = normalizeExtraction(event, idGen, NOW);
    expect(txn.merchant).toBe("Starbucks");
  });

  it("falls back to 'Unknown Merchant' when no merchant field present", () => {
    const [txn] = normalizeExtraction(makeEvent({ fields: [] }), idGen, NOW);
    expect(txn.merchant).toBe("Unknown Merchant");
  });

  it("parses total field as amount", () => {
    const event = makeEvent({
      fields: [
        { key: "vendor_name", value: "Shop", confidence: 0.99 },
        { key: "total", value: "$12.50", confidence: 0.95 }
      ]
    });
    const [txn] = normalizeExtraction(event, idGen, NOW);
    expect(txn.amount).toBe(12.50);
  });

  it("defaults amount to 0 when no amount field present", () => {
    const [txn] = normalizeExtraction(makeEvent({ fields: [] }), idGen, NOW);
    expect(txn.amount).toBe(0);
  });

  it("parses invoice_receipt_date field as date", () => {
    const event = makeEvent({
      fields: [{ key: "invoice_receipt_date", value: "2026-03-01", confidence: 0.98 }]
    });
    const [txn] = normalizeExtraction(event, idGen, NOW);
    expect(txn.date).toBe("2026-03-01");
  });

  it("falls back to today when no date field present", () => {
    const [txn] = normalizeExtraction(makeEvent({ fields: [] }), idGen, NOW);
    expect(txn.date).toBe("2026-03-01");
  });

  it("parses MM/DD/YYYY date format", () => {
    const event = makeEvent({
      fields: [{ key: "date", value: "03/15/2026", confidence: 0.9 }]
    });
    const [txn] = normalizeExtraction(event, idGen, NOW);
    expect(txn.date).toBe("2026-03-15");
  });

  it("defaults currency to USD", () => {
    const [txn] = normalizeExtraction(makeEvent({ fields: [] }), idGen, NOW);
    expect(txn.currency).toBe("USD");
  });

  it("normalises $ symbol to USD", () => {
    const event = makeEvent({
      fields: [{ key: "currency", value: "$", confidence: 0.9 }]
    });
    const [txn] = normalizeExtraction(event, idGen, NOW);
    expect(txn.currency).toBe("USD");
  });

  it("preserves 3-letter currency codes (EUR)", () => {
    const event = makeEvent({
      fields: [{ key: "currency", value: "EUR", confidence: 0.9 }]
    });
    const [txn] = normalizeExtraction(event, idGen, NOW);
    expect(txn.currency).toBe("EUR");
  });

  it("sets status to ACTIVE", () => {
    const [txn] = normalizeExtraction(makeEvent(), idGen, NOW);
    expect(txn.status).toBe("ACTIVE");
  });

  it("sets workspaceId, uploadFileId, extractedDocumentId from event", () => {
    const [txn] = normalizeExtraction(makeEvent(), idGen, NOW);
    expect(txn.workspaceId).toBe("ws-test-1");
    expect(txn.uploadFileId).toBe("upload-123");
    expect(txn.extractedDocumentId).toBe("doc-123");
  });

  it("uses idGenerator for transaction ID", () => {
    const [txn] = normalizeExtraction(makeEvent(), idGen, NOW);
    expect(txn.id).toBe("test-id-1");
  });

  it("returns exactly one transaction for a receipt", () => {
    expect(normalizeExtraction(makeEvent(), idGen, NOW)).toHaveLength(1);
  });

  it("calculates average extractionConfidence from all fields", () => {
    const event = makeEvent({
      fields: [
        { key: "vendor_name", value: "Shop", confidence: 0.8 },
        { key: "total",       value: "10",   confidence: 0.6 }
      ]
    });
    const [txn] = normalizeExtraction(event, idGen, NOW);
    expect(txn.extractionConfidence).toBeCloseTo(0.7);
  });
});

// ── Bank CSV path ─────────────────────────────────────────────────────────────

describe("normalizeExtraction — bank CSV", () => {
  it("returns one transaction per line item", () => {
    const event = makeEvent({
      source: "bank_csv",
      lineItems: [
        { description: "Starbucks",    totalPrice: 5.50  },
        { description: "Pret A Manger", totalPrice: 12.00 }
      ]
    });
    expect(normalizeExtraction(event, idGen, NOW)).toHaveLength(2);
  });

  it("returns empty array for CSV with no line items", () => {
    const event = makeEvent({ source: "bank_csv", lineItems: [] });
    expect(normalizeExtraction(event, idGen, NOW)).toHaveLength(0);
  });

  it("trims description whitespace into merchant name", () => {
    const event = makeEvent({
      source: "bank_csv",
      lineItems: [{ description: "  Amazon  ", totalPrice: 29.99 }]
    });
    const [txn] = normalizeExtraction(event, idGen, NOW);
    expect(txn.merchant).toBe("Amazon");
  });

  it("defaults merchant to 'Unknown Merchant' when description is empty", () => {
    const event = makeEvent({
      source: "bank_csv",
      lineItems: [{ description: "", totalPrice: 10.00 }]
    });
    const [txn] = normalizeExtraction(event, idGen, NOW);
    expect(txn.merchant).toBe("Unknown Merchant");
  });

  it("defaults amount to 0 when totalPrice is undefined", () => {
    const event = makeEvent({
      source: "bank_csv",
      lineItems: [{ description: "Shop" }]
    });
    const [txn] = normalizeExtraction(event, idGen, NOW);
    expect(txn.amount).toBe(0);
  });

  it("generates unique IDs across all line items", () => {
    const event = makeEvent({
      source: "bank_csv",
      lineItems: [
        { description: "A", totalPrice: 1 },
        { description: "B", totalPrice: 2 },
        { description: "C", totalPrice: 3 }
      ]
    });
    const ids = normalizeExtraction(event, idGen, NOW).map((t) => t.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("sets source to bank_csv on all transactions", () => {
    const event = makeEvent({
      source: "bank_csv",
      lineItems: [{ description: "Shop", totalPrice: 10 }]
    });
    const [txn] = normalizeExtraction(event, idGen, NOW);
    expect(txn.source).toBe("bank_csv");
  });
});