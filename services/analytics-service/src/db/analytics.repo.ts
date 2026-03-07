// File: services/analytics-service/src/db/analytics.repo.ts
/**
 * DynamoDB key design for AnalyticsSummaries table
 *
 * ── Monthly totals ────────────────────────────────────────────────────────────
 *   PK = WS#<workspaceId>   SK = MONTHLY#<YYYY-MM>
 *   Fields: totalAmount, transactionCount, currency
 *
 * ── Category breakdown (per month) ───────────────────────────────────────────
 *   PK = WS#<workspaceId>   SK = CAT#<YYYY-MM>#<category>
 *   Fields: totalAmount, transactionCount, currency
 *
 * ── Source breakdown (per month) ─────────────────────────────────────────────
 *   PK = WS#<workspaceId>   SK = SRC#<YYYY-MM>#<source>
 *   Fields: totalAmount, transactionCount, currency
 *
 * ── Merchant totals (per month) ───────────────────────────────────────────────
 *   PK = WS#<workspaceId>   SK = MERCHANT#<YYYY-MM>#<merchant>
 *   Fields: totalAmount, transactionCount, currency
 *
 * ── Daily totals ──────────────────────────────────────────────────────────────
 *   PK = WS#<workspaceId>   SK = DAILY#<YYYY-MM-DD>
 *   Fields: totalAmount, transactionCount, currency
 */

import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export type MonthlySummary = {
  yearMonth: string;          // YYYY-MM
  totalAmount: number;
  transactionCount: number;
  currency: string;
};

export type CategoryBreakdown = {
  yearMonth: string;
  category: string;
  totalAmount: number;
  transactionCount: number;
  currency: string;
};

export type SourceBreakdown = {
  yearMonth: string;
  source: string;
  totalAmount: number;
  transactionCount: number;
  currency: string;
};

export type MerchantSummary = {
  yearMonth: string;
  merchant: string;
  totalAmount: number;
  transactionCount: number;
  currency: string;
};

export type DailySummary = {
  date: string;               // YYYY-MM-DD
  totalAmount: number;
  transactionCount: number;
  currency: string;
};

export type MonthOverMonthTrend = {
  yearMonth: string;
  totalAmount: number;
  transactionCount: number;
  deltaAmount?: number;       // vs previous month
  deltaPercent?: number;      // vs previous month
};

export class AnalyticsRepo {
  constructor(
    private readonly ddb: DynamoDBClient,
    private readonly tableName: string
  ) {}

  // ── Upsert helpers (atomic ADD) ───────────────────────────────────────────

  async incrementMonthly(
    workspaceId: string,
    yearMonth: string,
    amount: number,
    currency: string,
    countDelta: number
  ): Promise<void> {
    await this.increment(
      pk(workspaceId),
      `MONTHLY#${yearMonth}`,
      amount,
      currency,
      countDelta
    );
  }

  async incrementCategory(
    workspaceId: string,
    yearMonth: string,
    category: string,
    amount: number,
    currency: string,
    countDelta: number
  ): Promise<void> {
    await this.increment(
      pk(workspaceId),
      `CAT#${yearMonth}#${category}`,
      amount,
      currency,
      countDelta
    );
  }

  async incrementSource(
    workspaceId: string,
    yearMonth: string,
    source: string,
    amount: number,
    currency: string,
    countDelta: number
  ): Promise<void> {
    await this.increment(
      pk(workspaceId),
      `SRC#${yearMonth}#${source}`,
      amount,
      currency,
      countDelta
    );
  }

  async incrementMerchant(
    workspaceId: string,
    yearMonth: string,
    merchant: string,
    amount: number,
    currency: string,
    countDelta: number
  ): Promise<void> {
    // Truncate merchant to 64 chars for SK safety
    const safeMerchant = merchant.slice(0, 64)
  .replace(/[^a-zA-Z0-9 _\-]/g, "")
  .replace(/ +/g, "_")
  .toLowerCase();
    await this.increment(
      pk(workspaceId),
      `MERCHANT#${yearMonth}#${safeMerchant}`,
      amount,
      currency,
      countDelta
    );
  }

  async incrementDaily(
    workspaceId: string,
    date: string,
    amount: number,
    currency: string,
    countDelta: number
  ): Promise<void> {
    await this.increment(
      pk(workspaceId),
      `DAILY#${date}`,
      amount,
      currency,
      countDelta
    );
  }

  // ── Query methods ─────────────────────────────────────────────────────────

  async getMonthlySummaries(
    workspaceId: string,
    fromYearMonth: string,
    toYearMonth: string
  ): Promise<MonthlySummary[]> {
    const items = await this.queryRange(
      workspaceId,
      `MONTHLY#${fromYearMonth}`,
      `MONTHLY#${toYearMonth}\xFF`
    );

    return items.map((item) => ({
      yearMonth: (item.SK as string).replace("MONTHLY#", ""),
      totalAmount: Number(item.totalAmount ?? 0),
      transactionCount: Number(item.transactionCount ?? 0),
      currency: (item.currency as string) ?? "USD"
    }));
  }

  async getCategoryBreakdown(
    workspaceId: string,
    yearMonth: string
  ): Promise<CategoryBreakdown[]> {
    const items = await this.queryRange(
      workspaceId,
      `CAT#${yearMonth}#`,
      `CAT#${yearMonth}\xFF`
    );

    return items.map((item) => {
      const parts = (item.SK as string).split("#");
      return {
        yearMonth,
        category: parts.slice(2).join("#"),
        totalAmount: Number(item.totalAmount ?? 0),
        transactionCount: Number(item.transactionCount ?? 0),
        currency: (item.currency as string) ?? "USD"
      };
    });
  }

  async getSourceBreakdown(
    workspaceId: string,
    yearMonth: string
  ): Promise<SourceBreakdown[]> {
    const items = await this.queryRange(
      workspaceId,
      `SRC#${yearMonth}#`,
      `SRC#${yearMonth}\xFF`
    );

    return items.map((item) => {
      const parts = (item.SK as string).split("#");
      return {
        yearMonth,
        source: parts.slice(2).join("#"),
        totalAmount: Number(item.totalAmount ?? 0),
        transactionCount: Number(item.transactionCount ?? 0),
        currency: (item.currency as string) ?? "USD"
      };
    });
  }

  async getMerchantSummaries(
    workspaceId: string,
    yearMonth: string,
    limit = 20
  ): Promise<MerchantSummary[]> {
    const items = await this.queryRange(
      workspaceId,
      `MERCHANT#${yearMonth}#`,
      `MERCHANT#${yearMonth}\xFF`,
      limit
    );

    return items
      .map((item) => {
        const parts = (item.SK as string).split("#");
        return {
          yearMonth,
          merchant: parts.slice(2).join("#"),
          totalAmount: Number(item.totalAmount ?? 0),
          transactionCount: Number(item.transactionCount ?? 0),
          currency: (item.currency as string) ?? "USD"
        };
      })
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }

  async getDailySummaries(
    workspaceId: string,
    fromDate: string,
    toDate: string
  ): Promise<DailySummary[]> {
    const items = await this.queryRange(
      workspaceId,
      `DAILY#${fromDate}`,
      `DAILY#${toDate}\xFF`
    );

    return items.map((item) => ({
      date: (item.SK as string).replace("DAILY#", ""),
      totalAmount: Number(item.totalAmount ?? 0),
      transactionCount: Number(item.transactionCount ?? 0),
      currency: (item.currency as string) ?? "USD"
    }));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async increment(
    pkVal: string,
    skVal: string,
    amount: number,
    currency: string,
    countDelta: number
  ): Promise<void> {
    await this.ddb.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: pkVal, SK: skVal }),
        UpdateExpression:
          "ADD totalAmount :a, transactionCount :c SET currency = if_not_exists(currency, :cur), updatedAt = :u",
        ExpressionAttributeValues: marshall({
          ":a": amount,
          ":c": countDelta,
          ":cur": currency,
          ":u": new Date().toISOString()
        })
      })
    );
  }

  private async queryRange(
    workspaceId: string,
    skFrom: string,
    skTo: string,
    limit?: number
  ): Promise<Record<string, unknown>[]> {
    const res = await this.ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND SK BETWEEN :from AND :to",
        ExpressionAttributeValues: marshall({
          ":pk": pk(workspaceId),
          ":from": skFrom,
          ":to": skTo
        }),
        ...(limit ? { Limit: limit } : {}),
        ScanIndexForward: true
      })
    );

    return (res.Items ?? []).map((i) => unmarshall(i));
  }
}

function pk(workspaceId: string): string {
  return `WS#${workspaceId}`;
}