// File: services/analytics-service/src/domain/analytics.service.ts
import { Injectable } from "@nestjs/common";
import { createLogger } from "@shared/logger";
import { getOrCreateCorrelationId } from "@shared/observability";

import { createDdbClient } from "../db/ddb.client";
import { AnalyticsRepo, MonthOverMonthTrend } from "../db/analytics.repo";
import { TransactionUpsertedEvent } from "./events";

@Injectable()
export class AnalyticsService {
  private readonly log = createLogger({ serviceName: "analytics-service" });

  private readonly repo = new AnalyticsRepo(
    createDdbClient(),
    mustGetEnv("DDB_ANALYTICS_TABLE")
  );

  /**
   * Handles transaction.upserted.v1 events.
   *
   * CREATED  → increment all aggregations by +amount, +1 count
   * DELETED  → decrement all aggregations by -amount, -1 count
   * UPDATED  → no-op for now (amount changes are rare and complex;
   *             a future improvement could diff old vs new snapshot)
   */
  async handleTransactionUpserted(event: TransactionUpsertedEvent): Promise<void> {
    const correlationId = getOrCreateCorrelationId(event.correlationId);
    const { operation, snapshot, workspaceId, transactionId } = event;

    if (operation === "UPDATED") {
      this.log.info(
        { correlationId, transactionId },
        "Skipping UPDATED — analytics does not diff updates"
      );
      return;
    }

    const { amount, currency, date, category, source, merchant } = snapshot;

    // Determine sign — DELETED reverses the aggregation
    const sign = operation === "DELETED" ? -1 : 1;
    const delta = amount * sign;
    const countDelta = 1 * sign;

    const yearMonth = date.slice(0, 7); // YYYY-MM

    this.log.info(
      { correlationId, transactionId, operation, yearMonth, date, amount: delta },
      "Updating analytics aggregations"
    );

    // Run all increments in parallel
    await Promise.all([
      // Monthly total
      this.repo.incrementMonthly(workspaceId, yearMonth, delta, currency, countDelta),

      // Category breakdown (use "Uncategorized" if no category yet)
      this.repo.incrementCategory(
        workspaceId,
        yearMonth,
        category ?? "Uncategorized",
        delta,
        currency,
        countDelta
      ),

      // Source breakdown
      this.repo.incrementSource(workspaceId, yearMonth, source, delta, currency, countDelta),

      // Merchant totals
      this.repo.incrementMerchant(workspaceId, yearMonth, merchant, delta, currency, countDelta),

      // Daily totals
      this.repo.incrementDaily(workspaceId, date, delta, currency, countDelta)
    ]);

    this.log.info(
      { correlationId, transactionId, yearMonth, date },
      "Analytics aggregations updated"
    );
  }

  // ── Query methods (called by HTTP routes) ─────────────────────────────────

  async getMonthlySummary(workspaceId: string, yearMonth: string) {
    const [monthly, categories, sources, merchants] = await Promise.all([
      this.repo.getMonthlySummaries(workspaceId, yearMonth, yearMonth),
      this.repo.getCategoryBreakdown(workspaceId, yearMonth),
      this.repo.getSourceBreakdown(workspaceId, yearMonth),
      this.repo.getMerchantSummaries(workspaceId, yearMonth, 10)
    ]);

    const summary = monthly[0] ?? { yearMonth, totalAmount: 0, transactionCount: 0, currency: "USD" };

    return {
      yearMonth,
      totalAmount: summary.totalAmount,
      transactionCount: summary.transactionCount,
      currency: summary.currency,
      byCategory: categories,
      bySource: sources,
      topMerchants: merchants
    };
  }

  async getDailySummaries(workspaceId: string, yearMonth: string) {
    const fromDate = `${yearMonth}-01`;
    // Last day of month — use next month minus 1 day trick
    const [year, month] = yearMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = `${yearMonth}-${String(lastDay).padStart(2, "0")}`;

    return this.repo.getDailySummaries(workspaceId, fromDate, toDate);
  }

  async getMonthOverMonthTrends(workspaceId: string): Promise<MonthOverMonthTrend[]> {
    // Last 12 months
    const now = new Date();
    const months: string[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const fromYearMonth = months[0];
    const toYearMonth = months[months.length - 1];

    const summaries = await this.repo.getMonthlySummaries(workspaceId, fromYearMonth, toYearMonth);

    // Build a map for fast lookup
    const byMonth = new Map(summaries.map((s) => [s.yearMonth, s]));

    // Build trend array with delta vs previous month
    return months.map((ym, i) => {
      const current = byMonth.get(ym);
      const previous = i > 0 ? byMonth.get(months[i - 1]) : undefined;

      const totalAmount = current?.totalAmount ?? 0;
      const prevAmount = previous?.totalAmount ?? 0;

      const deltaAmount = i > 0 ? totalAmount - prevAmount : undefined;
      const deltaPercent =
        i > 0 && prevAmount !== 0
          ? Math.round(((totalAmount - prevAmount) / prevAmount) * 100 * 10) / 10
          : undefined;

      return {
        yearMonth: ym,
        totalAmount,
        transactionCount: current?.transactionCount ?? 0,
        deltaAmount,
        deltaPercent
      };
    });
  }
}

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}