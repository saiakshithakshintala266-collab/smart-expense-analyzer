// File: services/anomaly-service/src/__tests__/anomaly.service.test.ts
import { makeTransactionUpsertedEvent, createMockSnsClient } from "@shared/testing";

// ── Mocks BEFORE import ───────────────────────────────────────────────────────

const mockRepo = {
  indexTransaction:                jest.fn().mockResolvedValue(undefined),
  incrementCategorySpend:          jest.fn().mockResolvedValue(undefined),
  saveAnomaly:                     jest.fn().mockResolvedValue(undefined),
  listAnomalies:                   jest.fn().mockResolvedValue([]),
  getRecentTransactionsForMerchant: jest.fn().mockResolvedValue([]),
  getMerchantFirstSeen:            jest.fn().mockResolvedValue("2026-01-01"), // seen before by default
  setMerchantFirstSeen:            jest.fn().mockResolvedValue(undefined),
  getCategorySpendHistory:         jest.fn().mockResolvedValue([]),
  getMonthlyWorkspaceAverage:      jest.fn().mockResolvedValue(0)
};

jest.mock("../db/ddb.client",   () => ({ createDdbClient: () => ({ send: jest.fn() }) }));
jest.mock("../db/anomaly.repo", () => ({
  AnomalyRepo: jest.fn().mockImplementation(() => mockRepo),
  normalizeMerchant: jest.fn((m: string) => m.toLowerCase().trim())
}));
jest.mock("../integrations/sns.publisher", () => ({
  createSnsClient: () => createMockSnsClient(),
  publishEvent: jest.fn().mockResolvedValue(undefined),
  mustGetEventsTopicArn: jest.fn().mockReturnValue("arn:aws:sns:us-east-1:000000000000:sea-events")
}));

import { AnomalyService } from "../domain/anomaly.service";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.DDB_ANOMALY_TABLE = "AnomalyDetections";
  process.env.EVENTS_TOPIC_ARN  = "arn:aws:sns:us-east-1:000000000000:sea-events";
  process.env.AWS_REGION        = "us-east-1";
  jest.clearAllMocks();
  mockRepo.indexTransaction.mockResolvedValue(undefined);
  mockRepo.incrementCategorySpend.mockResolvedValue(undefined);
  mockRepo.saveAnomaly.mockResolvedValue(undefined);
  mockRepo.getRecentTransactionsForMerchant.mockResolvedValue([]);
  // Default: merchant HAS been seen before → no FIRST_TIME_MERCHANT anomaly
  mockRepo.getMerchantFirstSeen.mockResolvedValue("2026-01-01");
  mockRepo.setMerchantFirstSeen.mockResolvedValue(undefined);
  mockRepo.getCategorySpendHistory.mockResolvedValue([]);
  mockRepo.getMonthlyWorkspaceAverage.mockResolvedValue(0);
});

// ── handleTransactionUpserted ─────────────────────────────────────────────────

describe("AnomalyService.handleTransactionUpserted", () => {
  it("skips non-CREATED transactions without any repo calls", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");
    const service = new AnomalyService();

    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "UPDATED" })
    );

    expect(mockRepo.indexTransaction).not.toHaveBeenCalled();
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it("indexes the transaction after running detectors", async () => {
    const service = new AnomalyService();
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", merchant: "Starbucks", amount: 5.50, date: "2026-03-01" })
    );

    expect(mockRepo.indexTransaction).toHaveBeenCalledTimes(1);
    const [, indexedTx] = mockRepo.indexTransaction.mock.calls[0];
    expect(indexedTx.merchant).toBe("Starbucks");
    expect(indexedTx.amount).toBe(5.50);
  });

  it("increments category spend when category is set", async () => {
    const service = new AnomalyService();
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", category: "Dining", amount: 15.00, date: "2026-03-01" })
    );

    expect(mockRepo.incrementCategorySpend).toHaveBeenCalledTimes(1);
    const [, yearMonth, category] = mockRepo.incrementCategorySpend.mock.calls[0];
    expect(yearMonth).toBe("2026-03");
    expect(category).toBe("Dining");
  });

  it("does not increment category spend when category is empty", async () => {
    const service = new AnomalyService();
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", category: "", date: "2026-03-01" })
    );

    expect(mockRepo.incrementCategorySpend).not.toHaveBeenCalled();
  });

  it("detects LARGE_ROUND_NUMBER (>=500, divisible by 100) and saves + publishes anomaly", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");
    const service = new AnomalyService();

    // $1000 is >=500 and divisible by 100 → triggers LARGE_ROUND_NUMBER
    // getMerchantFirstSeen returns "2026-01-01" (seen before) → no FIRST_TIME_MERCHANT
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", amount: 1000.00, merchant: "Unknown", date: "2026-03-01" })
    );

    const anomalyTypes = mockRepo.saveAnomaly.mock.calls.map((c: any[]) => c[0].anomalyType);
    expect(anomalyTypes).toContain("LARGE_ROUND_NUMBER");

    // At least one publish for the LARGE_ROUND_NUMBER anomaly
    const publishedTypes = publishEvent.mock.calls.map((c: any[]) => c[1].message.anomalyType);
    expect(publishedTypes).toContain("LARGE_ROUND_NUMBER");
  });

  it("does not detect anomaly for small normal transaction from known merchant", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");
    const service = new AnomalyService();

    // $3.75 — below all thresholds, merchant already seen (getMerchantFirstSeen → "2026-01-01")
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", amount: 3.75, merchant: "Starbucks", date: "2026-03-01" })
    );

    expect(mockRepo.saveAnomaly).not.toHaveBeenCalled();
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it("detects FIRST_TIME_MERCHANT when getMerchantFirstSeen returns null", async () => {
    const { publishEvent } = require("../integrations/sns.publisher");
    // Override default: merchant NOT seen before
    mockRepo.getMerchantFirstSeen.mockResolvedValueOnce(null);

    const service = new AnomalyService();
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", amount: 5.00, merchant: "Brand New Store", date: "2026-03-01" })
    );

    const anomalyTypes = mockRepo.saveAnomaly.mock.calls.map((c: any[]) => c[0].anomalyType);
    expect(anomalyTypes).toContain("FIRST_TIME_MERCHANT");
    expect(publishEvent).toHaveBeenCalled();
  });
});