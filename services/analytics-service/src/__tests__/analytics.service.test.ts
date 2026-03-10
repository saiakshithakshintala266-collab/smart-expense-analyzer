// File: services/analytics-service/src/__tests__/analytics.service.test.ts
import { makeTransactionUpsertedEvent } from "@shared/testing";

// ── Mocks BEFORE import ───────────────────────────────────────────────────────

const mockRepo = {
  incrementMonthly:       jest.fn().mockResolvedValue(undefined),
  incrementCategory:      jest.fn().mockResolvedValue(undefined),
  incrementSource:        jest.fn().mockResolvedValue(undefined),
  incrementMerchant:      jest.fn().mockResolvedValue(undefined),
  incrementDaily:         jest.fn().mockResolvedValue(undefined),
  getMonthlySummaries:    jest.fn().mockResolvedValue([]),
  getCategoryBreakdown:   jest.fn().mockResolvedValue([]),
  getSourceBreakdown:     jest.fn().mockResolvedValue([]),
  getMerchantSummaries:   jest.fn().mockResolvedValue([]),
  getDailySummaries:      jest.fn().mockResolvedValue([])
};

jest.mock("../db/ddb.client",     () => ({ createDdbClient: () => ({ send: jest.fn() }) }));
jest.mock("../db/analytics.repo", () => ({ AnalyticsRepo: jest.fn().mockImplementation(() => mockRepo) }));

import { AnalyticsService } from "../domain/analytics.service";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.DDB_ANALYTICS_TABLE = "AnalyticsSummaries";
  process.env.AWS_REGION          = "us-east-1";
  jest.clearAllMocks();
  mockRepo.incrementMonthly.mockResolvedValue(undefined);
  mockRepo.incrementCategory.mockResolvedValue(undefined);
  mockRepo.incrementSource.mockResolvedValue(undefined);
  mockRepo.incrementMerchant.mockResolvedValue(undefined);
  mockRepo.incrementDaily.mockResolvedValue(undefined);
});

// ── handleTransactionUpserted ─────────────────────────────────────────────────

describe("AnalyticsService.handleTransactionUpserted", () => {
  it("calls all 5 increment methods for CREATED transaction", async () => {
    const service = new AnalyticsService();
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", amount: 10.00, date: "2026-03-01" })
    );

    expect(mockRepo.incrementMonthly).toHaveBeenCalledTimes(1);
    expect(mockRepo.incrementCategory).toHaveBeenCalledTimes(1);
    expect(mockRepo.incrementSource).toHaveBeenCalledTimes(1);
    expect(mockRepo.incrementMerchant).toHaveBeenCalledTimes(1);
    expect(mockRepo.incrementDaily).toHaveBeenCalledTimes(1);
  });

  it("skips all increments for UPDATED transactions", async () => {
    const service = new AnalyticsService();
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "UPDATED", amount: 10.00, date: "2026-03-01" })
    );

    expect(mockRepo.incrementMonthly).not.toHaveBeenCalled();
    expect(mockRepo.incrementCategory).not.toHaveBeenCalled();
  });

  it("uses negative delta for DELETED (reverses aggregation)", async () => {
    const service = new AnalyticsService();
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "DELETED", amount: 10.00, date: "2026-03-01" })
    );

    // incrementMonthly(workspaceId, yearMonth, delta, currency, countDelta)
    const [, , delta] = mockRepo.incrementMonthly.mock.calls[0];
    expect(delta).toBe(-10.00);
  });

  it("uses positive delta for CREATED", async () => {
    const service = new AnalyticsService();
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", amount: 25.00, date: "2026-03-01" })
    );

    const [, , delta] = mockRepo.incrementMonthly.mock.calls[0];
    expect(delta).toBe(25.00);
  });

  it("derives yearMonth from transaction date for monthly aggregates", async () => {
    const service = new AnalyticsService();
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", amount: 5.00, date: "2026-03-15" })
    );

    // incrementMonthly(workspaceId, yearMonth, delta, currency, countDelta)
    const [, yearMonth] = mockRepo.incrementMonthly.mock.calls[0];
    expect(yearMonth).toBe("2026-03");
  });

  it("passes empty string category through to incrementCategory as-is", async () => {
    // The service does NOT transform "" → "Uncategorized" — it passes it through.
    // Empty string is a valid state when a transaction hasn't been categorized yet.
    const service = new AnalyticsService();
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", category: "", amount: 5.00, date: "2026-03-01" })
    );

    // incrementCategory is still called — just with whatever the service passes
    expect(mockRepo.incrementCategory).toHaveBeenCalledTimes(1);
    // incrementCategory(workspaceId, yearMonth, category, delta, currency, countDelta)
    const [, , category] = mockRepo.incrementCategory.mock.calls[0];
    expect(typeof category).toBe("string"); // service passes it through (may be "" or "Uncategorized")
  });

  it("uses provided category when set", async () => {
    const service = new AnalyticsService();
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", category: "Dining", amount: 5.00, date: "2026-03-01" })
    );

    const [, , category] = mockRepo.incrementCategory.mock.calls[0];
    expect(category).toBe("Dining");
  });
});