"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { analyticsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { AnalyticsSummary } from "@/types";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

type TrendRow = {
  yearMonth: string;
  totalAmount: number;
  transactionCount: number;
  deltaAmount?: number;
  deltaPercent?: number;
};

type MonthStat = TrendRow & {
  topMerchant?: string;
  topMerchantAmount?: number;
};

export default function InsightsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trends, setTrends] = useState<TrendRow[]>([]);
  const [monthStats, setMonthStats] = useState<MonthStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const trendsRes = await analyticsApi.getTrends({ months: 6 }).catch(() => null);
        const trendData: TrendRow[] =
          trendsRes ? (Array.isArray(trendsRes) ? trendsRes : trendsRes.items ?? []) : [];

        setTrends(trendData);

        const allTimeAmount = trendData.reduce((s, t) => s + (t.totalAmount ?? 0), 0);
        const allTimeCount  = trendData.reduce((s, t) => s + (t.transactionCount ?? 0), 0);

        // Active months only (months with spend)
        const activeMonths = trendData.filter((t) => t.totalAmount > 0);
        const mostRecentYm = [...activeMonths].reverse()[0]?.yearMonth
          ?? new Date().toISOString().slice(0, 7);

        // Fetch per-month summaries in parallel to get top merchants
        const summaryResults = await Promise.allSettled(
          activeMonths.map((t) => analyticsApi.getSummary({ yearMonth: t.yearMonth }))
        );

        const summaryByMonth = new Map<string, AnalyticsSummary>();
        summaryResults.forEach((res, i) => {
          if (res.status === "fulfilled") {
            summaryByMonth.set(activeMonths[i].yearMonth, res.value);
          }
        });

        // Build enriched monthly stats (most recent first)
        const stats: MonthStat[] = [...activeMonths].reverse().map((t) => {
          const s = summaryByMonth.get(t.yearMonth);
          return {
            ...t,
            topMerchant: s?.topMerchants?.[0]?.merchant,
            topMerchantAmount: s?.topMerchants?.[0]?.totalAmount,
          };
        });
        setMonthStats(stats);

        // Use most recent month's summary for the all-time totals section
        const mostRecentSummary = summaryByMonth.get(mostRecentYm);
        if (mostRecentSummary) {
          setSummary({ ...mostRecentSummary, totalAmount: allTimeAmount, transactionCount: allTimeCount });
        } else if (allTimeAmount > 0) {
          setSummary({ yearMonth: mostRecentYm, totalAmount: allTimeAmount, transactionCount: allTimeCount, currency: "USD", bySource: [], topMerchants: [] });
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <PageHeader title="Insights" description="Spending analysis" icon={TrendingUp} />
        <div className="py-16 text-center text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const hasData = summary && (summary.transactionCount > 0 || trends.length > 0);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Insights"
        description="Spending analysis"
        icon={TrendingUp}
      />

      {!hasData ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No data yet — upload a bank statement or receipt to see insights.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* All-time summary stats */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">All-time spent</p>
                <p className="text-xl font-semibold text-foreground">{formatCurrency(summary.totalAmount)}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Total transactions</p>
                <p className="text-xl font-semibold text-foreground">{summary.transactionCount}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Avg per transaction</p>
                <p className="text-xl font-semibold text-foreground">
                  {summary.transactionCount > 0
                    ? formatCurrency(summary.totalAmount / summary.transactionCount)
                    : "—"}
                </p>
              </div>
            </div>
          )}

          {/* Spending trend chart */}
          {trends.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-medium text-muted-foreground mb-4">Monthly spending trend</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(224 15% 18%)" />
                  <XAxis
                    dataKey="yearMonth"
                    tick={{ fontSize: 11, fill: "hsl(215 16% 57%)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(215 16% 57%)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v))}
                    contentStyle={{
                      background: "hsl(224 15% 11%)",
                      border: "1px solid hsl(224 15% 18%)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalAmount"
                    stroke="hsl(162 73% 37%)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(162 73% 37%)", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Monthly breakdown table */}
          {monthStats.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-medium text-muted-foreground">Monthly breakdown</h2>
              </div>
              {/* Table header */}
              <div className="grid grid-cols-12 gap-3 px-5 py-2.5 bg-secondary/40 border-b border-border">
                <div className="col-span-2 text-xs font-medium text-muted-foreground">Month</div>
                <div className="col-span-2 text-xs font-medium text-muted-foreground text-right">Spent</div>
                <div className="col-span-2 text-xs font-medium text-muted-foreground text-right">Txns</div>
                <div className="col-span-2 text-xs font-medium text-muted-foreground text-right">Avg</div>
                <div className="col-span-2 text-xs font-medium text-muted-foreground">Top merchant</div>
                <div className="col-span-2 text-xs font-medium text-muted-foreground text-right">vs prev</div>
              </div>
              <div className="divide-y divide-border">
                {monthStats.map((row) => {
                  const avg = row.transactionCount > 0 ? row.totalAmount / row.transactionCount : 0;
                  const delta = row.deltaAmount;
                  const isUp = delta !== undefined && delta > 0;
                  const isDown = delta !== undefined && delta < 0;
                  return (
                    <div key={row.yearMonth} className="grid grid-cols-12 gap-3 px-5 py-3.5 hover:bg-secondary/20 transition-colors">
                      <div className="col-span-2 flex items-center">
                        <span className="text-sm font-medium text-foreground">{row.yearMonth}</span>
                      </div>
                      <div className="col-span-2 flex items-center justify-end">
                        <span className="text-sm text-foreground">{formatCurrency(row.totalAmount)}</span>
                      </div>
                      <div className="col-span-2 flex items-center justify-end">
                        <span className="text-sm text-foreground">{row.transactionCount}</span>
                      </div>
                      <div className="col-span-2 flex items-center justify-end">
                        <span className="text-sm text-muted-foreground">{avg > 0 ? formatCurrency(avg) : "—"}</span>
                      </div>
                      <div className="col-span-2 flex items-center min-w-0">
                        {row.topMerchant ? (
                          <span className="text-xs text-muted-foreground truncate" title={row.topMerchant}>
                            {row.topMerchant}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        {delta === undefined ? (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        ) : (
                          <>
                            {isUp && <TrendingUp className="h-3 w-3 text-red-400 flex-shrink-0" />}
                            {isDown && <TrendingDown className="h-3 w-3 text-emerald-400 flex-shrink-0" />}
                            {!isUp && !isDown && <Minus className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />}
                            <span className={`text-xs font-medium ${isUp ? "text-red-400" : isDown ? "text-emerald-400" : "text-muted-foreground"}`}>
                              {isUp ? "+" : ""}{formatCurrency(Math.abs(delta))}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All-time top merchants */}
          {summary?.topMerchants?.length ? (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-medium text-muted-foreground mb-4">Top merchants (most recent month)</h2>
              <div className="flex flex-col gap-2.5">
                {summary.topMerchants.slice(0, 7).map((m, i) => {
                  const max = summary.topMerchants[0].totalAmount;
                  const pct = (m.totalAmount / max) * 100;
                  return (
                    <div key={m.merchant} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                      <span className="text-xs text-muted-foreground w-32 truncate">{m.merchant}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-foreground w-16 text-right">
                        {formatCurrency(m.totalAmount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
