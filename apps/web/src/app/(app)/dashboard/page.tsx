"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard, TrendingUp, Receipt, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { analyticsApi, transactionsApi, anomalyApi } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AnalyticsSummary, Transaction, Anomaly } from "@/types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function DashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [daily, setDaily] = useState<{ date: string; totalAmount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [summaryRes, txRes, anomalyRes, dailyRes] = await Promise.allSettled([
          analyticsApi.getSummary(),
          transactionsApi.list({ nextPageToken: undefined }),
          anomalyApi.list(),
          analyticsApi.getDaily(),
        ]);
        if (summaryRes.status === "fulfilled") setSummary(summaryRes.value);
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
    load();
  }, []);

  const unacknowledged = anomalies.filter((a) => !a.acknowledged).length;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Dashboard"
        description={summary?.yearMonth ?? "Overview"}
        icon={LayoutDashboard}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total spent"
          value={summary ? formatCurrency(summary.totalAmount) : "—"}
          icon={TrendingUp}
          subtext={summary ? `${summary.transactionCount} transactions` : undefined}
          trend="neutral"
        />
        <StatCard
          label="Top category"
          value={summary?.byCategory?.[0]?.category ?? "—"}
          subtext={summary?.byCategory?.[0] ? formatCurrency(summary.byCategory[0].amount) : undefined}
          trend="neutral"
        />
        <StatCard
          label="Largest expense"
          value={summary?.topMerchants?.[0] ? formatCurrency(summary.topMerchants[0].amount) : "—"}
          subtext={summary?.topMerchants?.[0]?.merchant}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily spend chart */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Daily spend</h2>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={daily} barSize={8}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
                  tickFormatter={(v) => new Date(v).getDate().toString()}
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
                  {daily.map((_, i) => (
                    <Cell key={i} fill="hsl(162 73% 37%)" fillOpacity={0.8} />
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
          <h2 className="text-sm font-medium text-muted-foreground mb-4">By category</h2>
          {summary?.byCategory?.length ? (
            <div className="flex flex-col gap-2">
              {summary.byCategory.slice(0, 5).map((cat) => {
                const max = summary.byCategory[0].amount;
                const pct = (cat.amount / max) * 100;
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 truncate">{cat.category}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-secondary">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-foreground w-16 text-right">
                      {formatCurrency(cat.amount)}
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
                  {tx.category}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}