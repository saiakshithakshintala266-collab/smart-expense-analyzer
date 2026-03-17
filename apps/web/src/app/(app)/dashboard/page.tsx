"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard, TrendingUp, TrendingDown, Receipt, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { analyticsApi, transactionsApi, anomalyApi } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AnalyticsSummary, Transaction, Anomaly } from "@/types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function DashboardPage() {
  const [summaries, setSummaries] = useState<AnalyticsSummary[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [daily, setDaily] = useState<{ date: string; totalAmount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      const trendsData = await analyticsApi.getTrends().catch(() => []);
      const trends = Array.isArray(trendsData) ? trendsData : [];
      const months = trends
        .filter((t: { totalAmount: number }) => t.totalAmount > 0)
        .sort((a: { yearMonth: string }, b: { yearMonth: string }) => b.yearMonth.localeCompare(a.yearMonth));

      const summaryResults = await Promise.all(
        months.map((t: { yearMonth: string }) =>
          analyticsApi.getSummary({ yearMonth: t.yearMonth }).catch(() => null)
        )
      );
      const validSummaries = summaryResults.filter(Boolean) as AnalyticsSummary[];
      setSummaries(validSummaries);

      const [txRes, anomalyRes, dailyRes] = await Promise.allSettled([
        transactionsApi.list({ nextPageToken: undefined }),
        anomalyApi.list(),
        analyticsApi.getDaily(),
      ]);
      if (txRes.status === "fulfilled") setTransactions((txRes.value.items ?? []).slice(0, 5));
      if (anomalyRes.status === "fulfilled") {
        const data = anomalyRes.value;
        setAnomalies(Array.isArray(data) ? data : data.items ?? []);
      }
      if (dailyRes.status === "fulfilled") {
        const data = dailyRes.value;
        setDaily(Array.isArray(data) ? data : data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  // Aggregate totals across all months
  const totalSpent = summaries.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalTransactions = summaries.reduce((sum, s) => sum + s.transactionCount, 0);

  // Latest and previous month
  const latestSummary = summaries[0] ?? null;
  const prevSummary = summaries[1] ?? null;

  // Month-over-month comparison
  const momDiff = latestSummary && prevSummary
    ? latestSummary.totalAmount - prevSummary.totalAmount
    : null;
  const momPct = momDiff !== null && prevSummary && prevSummary.totalAmount > 0
    ? ((momDiff / prevSummary.totalAmount) * 100).toFixed(1)
    : null;

  // Top category across all months
  const categoryMap = new Map<string, number>();
  for (const s of summaries) {
    for (const c of s.byCategory ?? []) {
      categoryMap.set(c.category, (categoryMap.get(c.category) ?? 0) + c.totalAmount);
    }
  }
  const topCategory = [...categoryMap.entries()].sort((a, b) => b[1] - a[1])[0];

  // Top merchant across all months
  const merchantMap = new Map<string, number>();
  for (const s of summaries) {
    for (const m of s.topMerchants ?? []) {
      merchantMap.set(m.merchant, (merchantMap.get(m.merchant) ?? 0) + m.totalAmount);
    }
  }
  const topMerchant = [...merchantMap.entries()].sort((a, b) => b[1] - a[1])[0];

  const unacknowledged = anomalies.filter((a) => !a.acknowledged).length;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Dashboard"
        description={summaries.length > 0 ? `${summaries.length} month${summaries.length > 1 ? "s" : ""} of data` : "Overview"}
        icon={LayoutDashboard}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total spent (all time)"
          value={totalSpent > 0 ? formatCurrency(totalSpent) : "—"}
          icon={TrendingUp}
          subtext={totalTransactions > 0 ? `${totalTransactions} transactions` : undefined}
          trend="neutral"
        />
        <StatCard
          label="Top category"
          value={topCategory?.[0] ?? "—"}
          subtext={topCategory ? formatCurrency(topCategory[1]) : undefined}
          trend="neutral"
        />
        <StatCard
          label="Top merchant"
          value={topMerchant ? topMerchant[0].replace(/_/g, " ") : "—"}
          subtext={topMerchant ? formatCurrency(topMerchant[1]) : undefined}
          trend="neutral"
        />
        <StatCard
          label="Anomalies"
          value={String(unacknowledged)}
          subtext={unacknowledged > 0 ? "Needs review" : "All clear"}
          icon={AlertTriangle}
          trend={unacknowledged > 0 ? "down" : "up"}
        />
      </div>

      {/* Month over month comparison */}
      {latestSummary && (
        <div className="rounded-xl border border-border bg-card p-4 mb-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Month-over-month comparison</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Latest month</p>
              <p className="text-lg font-semibold text-foreground">{latestSummary.yearMonth}</p>
              <p className="text-sm text-foreground">{formatCurrency(latestSummary.totalAmount)}</p>
              <p className="text-xs text-muted-foreground">{latestSummary.transactionCount} transactions</p>
            </div>
            {prevSummary && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Previous month</p>
                <p className="text-lg font-semibold text-foreground">{prevSummary.yearMonth}</p>
                <p className="text-sm text-foreground">{formatCurrency(prevSummary.totalAmount)}</p>
                <p className="text-xs text-muted-foreground">{prevSummary.transactionCount} transactions</p>
              </div>
            )}
            {momDiff !== null && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Change</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {momDiff > 0
                    ? <TrendingUp className="h-4 w-4 text-rose-400" />
                    : <TrendingDown className="h-4 w-4 text-emerald-400" />
                  }
                  <p className={`text-lg font-semibold ${momDiff > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {momDiff > 0 ? "+" : ""}{formatCurrency(momDiff)}
                  </p>
                </div>
                {momPct && (
                  <p className={`text-xs ${momDiff > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {momDiff > 0 ? "+" : ""}{momPct}% vs previous month
                  </p>
                )}
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Avg per month</p>
              <p className="text-lg font-semibold text-foreground">
                {summaries.length > 0 ? formatCurrency(totalSpent / summaries.length) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">across {summaries.length} month{summaries.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly spending chart */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Monthly spending</h2>
          {summaries.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={[...summaries].reverse()} barSize={24}>
                <XAxis
                  dataKey="yearMonth"
                  tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v))}
                  contentStyle={{
                    background: "hsl(224 15% 11%)",
                    border: "1px solid hsl(224 15% 18%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="totalAmount" radius={[3, 3, 0, 0]}>
                  {[...summaries].reverse().map((_, i, arr) => (
                    <Cell
                      key={i}
                      fill="hsl(162 73% 37%)"
                      fillOpacity={i === arr.length - 1 ? 1 : 0.5}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              No data yet — upload a statement to get started
            </div>
          )}
        </div>

        {/* Spending by category */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">By category (all time)</h2>
          {categoryMap.size > 0 ? (
            <div className="flex flex-col gap-2">
              {[...categoryMap.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cat, amount]) => {
                  const max = [...categoryMap.values()].sort((a, b) => b - a)[0];
                  const pct = (amount / max) * 100;
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-28 truncate">{cat}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary">
                        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-foreground w-16 text-right">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              No category data yet
            </div>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">Recent transactions</h2>
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No transactions yet"
            description="Upload a bank statement or receipt to see your transactions here."
          />
        ) : (
          <div className="divide-y divide-border">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-xs font-medium text-muted-foreground flex-shrink-0">
                  {tx.merchant.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{tx.merchant}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {tx.category ?? "Uncategorized"}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {formatCurrency(tx.amount, tx.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}