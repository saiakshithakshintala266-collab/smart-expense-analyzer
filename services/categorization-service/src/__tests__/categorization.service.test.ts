// File: services/categorization-service/src/__tests__/categorization.service.test.ts
import { makeTransactionUpsertedEvent, createMockSnsClient } from "@shared/testing";

// ── Mocks BEFORE import ───────────────────────────────────────────────────────

jest.mock("../integrations/bedrock.classifier", () => ({
  createBedrockClient: () => ({}),
  classifyWithBedrock: jest.fn().mockResolvedValue({ category: "Dining", confidence: 0.92 })
}));
jest.mock("../integrations/sns.publisher", () => ({
  createSnsClient: () => createMockSnsClient(),
  publishEvent: jest.fn().mockResolvedValue(undefined),
  mustGetEventsTopicArn: jest.fn().mockReturnValue("arn:aws:sns:us-east-1:000000000000:sea-events")
}));
// rules.engine is NOT mocked — it's a pure function we test through

import { CategorizationService } from "../domain/categorization.service";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.EVENTS_TOPIC_ARN = "arn:aws:sns:us-east-1:000000000000:sea-events";
  process.env.AWS_REGION       = "us-east-1";
  jest.clearAllMocks();
  const { classifyWithBedrock } = require("../integrations/bedrock.classifier");
  classifyWithBedrock.mockResolvedValue({ category: "Dining", confidence: 0.92 });
});

// ── handleTransactionUpserted ─────────────────────────────────────────────────

describe("CategorizationService.handleTransactionUpserted", () => {
  it("skips DELETED transactions without publishing", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");
    const service = new CategorizationService();

    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "DELETED" })
    );

    expect(publishEvent).not.toHaveBeenCalled();
  });

  it("skips UPDATED transactions that already have a category (user override)", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");
    const service = new CategorizationService();

    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "UPDATED", category: "Travel" })
    );

    expect(publishEvent).not.toHaveBeenCalled();
  });

  it("categorizes via rules engine for known merchant (Uber → Transport)", async () => {
    const { classifyWithBedrock } = require("../integrations/bedrock.classifier");
    const { publishEvent } = require("../integrations/sns.publisher");
    const service = new CategorizationService();

    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", merchant: "Uber", category: "" })
    );

    // Rules engine matches "uber" → Transport. Bedrock must NOT be called.
    expect(classifyWithBedrock).not.toHaveBeenCalled();
    expect(publishEvent).toHaveBeenCalledTimes(1);
    const evt = publishEvent.mock.calls[0][1].message;
    expect(evt.type).toBe("categorization.completed.v1");
    expect(evt.method).toBe("rules");
    expect(evt.category).toBe("Transport");
  });

  it("falls back to Bedrock for merchant with no rule match", async () => {
    // Use a merchant name that is guaranteed to not match any rules keyword.
    // Confirmed from logs: "XYZ-Unknown-Shop-42" matched "Shopping" via rules engine.
    // Use a truly unrecognisable string instead.
    const { classifyWithBedrock } = require("../integrations/bedrock.classifier");
    const { publishEvent } = require("../integrations/sns.publisher");
    const service = new CategorizationService();

    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", merchant: "ZZZZ-NO-MATCH-QQQQ", category: "" })
    );

    expect(classifyWithBedrock).toHaveBeenCalledTimes(1);
    expect(publishEvent).toHaveBeenCalledTimes(1);
    const evt = publishEvent.mock.calls[0][1].message;
    expect(evt.method).toBe("llm");
    expect(evt.category).toBe("Dining"); // from mock
  });

  it("defaults to category 'Other' with method 'fallback' if Bedrock throws", async () => {
    const { classifyWithBedrock } = require("../integrations/bedrock.classifier");
    const { publishEvent } = require("../integrations/sns.publisher");
    classifyWithBedrock.mockRejectedValueOnce(new Error("Bedrock unavailable"));

    const service = new CategorizationService();
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", merchant: "XYZ-Unknown", category: "" })
    );

    const evt = publishEvent.mock.calls[0][1].message;
    expect(evt.category).toBe("Other");
    expect(evt.method).toBe("fallback");
  });

  it("publishes categorization.completed.v1 with correct transactionId", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");
    const service = new CategorizationService();

    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", transactionId: "txn-abc-123", merchant: "Uber", category: "" })
    );

    const evt = publishEvent.mock.calls[0][1].message;
    expect(evt.transactionId).toBe("txn-abc-123");
  });
});