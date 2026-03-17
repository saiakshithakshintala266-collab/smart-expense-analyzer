"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { analyticsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { AnalyticsSummary, DailyAnalytics } from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell
} from "recharts";

export default function InsightsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [daily, setDaily] = useState<DailyAnalytics[]>([]);
  const [trends, setTrends] = useState<{ yearMonth: string; totalAmount: number; transactionCount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      const trendsData = await analyticsApi.getTrends().catch(() => []);
      const rawTrends = Array.isArray(trendsData) ? trendsData : [];
      setTrends(rawTrends);

      const months = rawTrends
        .filter((t: { totalAmount: number }) => t.totalAmount > 0)
        .sort((a: { yearMonth: string }, b: { yearMonth: string }) => b.yearMonth.localeCompare(a.yearMonth));

      const latestMonth = months[0]?.yearMonth;

      const [summaryRes, dailyRes] = await Promise.allSettled([
        analyticsApi.getSummary(latestMonth ? { yearMonth: latestMonth } : undefined),
        analyticsApi.getDaily(),
      ]);

      if (summaryRes.status === "fulfilled") setSummary(summaryRes.value);
      if (dailyRes.status === "fulfilled") {
        const data = dailyRes.value;
        setDaily(Array.isArray(data) ? data : data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  // All-time totals from trends
  const totalSpentAllTime = trends.reduce((sum, t) => sum + t.totalAmount, 0);
  const totalTxAllTime = trends.reduce((sum, t) => sum + t.transactionCount, 0);
  const avgMonthly = trends.length > 0 ? totalSpentAllTime / trends.filter(t => t.totalAmount > 0).length : 0;

  const avgDaily = daily.length
    ? daily.reduce((sum, d) => sum + d.totalAmount, 0) / daily.length
    : 0;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Insights"
        description="AI-powered spending analysis"
        icon={TrendingUp}
      />

      {/* Stat cards — all time */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total spent (all time)"
          value={totalSpentAllTime > 0 ? formatCurrency(totalSpentAllTime) : "—"}
          subtext={`${trends.filter(t => t.totalAmount > 0).length} month(s) of data`}
          trend="neutral"
        />
        <StatCard
          label="Avg monthly spend"
          value={avgMonthly > 0 ? formatCurrency(avgMonthly) : "—"}
          subtext="across all months"
          trend="neutral"
        />
        <StatCard
          label="Total transactions"
          value={totalTxAllTime > 0 ? String(totalTxAllTime) : "—"}
          subtext="all time"
          trend="neutral"
        />
        <StatCard
          label="Top category"
          value={summary?.byCategory?.[0]?.category ?? "—"}
          subtext={summary?.byCategory?.[0] ? formatCurrency(summary.byCategory[0].totalAmount) : undefined}
          trend="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily spend */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-1">Daily spend</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Avg: {avgDaily > 0 ? formatCurrency(avgDaily) : "—"} / day
          </p>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={daily} barSize={8}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
                  tickFormatter={(v) => new Date(v).getDate().toString()}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
                  tickFormatter={(v) => `$${v}`}
                  axisLine={false}
                  tickLine={false}
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
                <Bar dataKey="totalAmount" radius={[3, 3, 0, 0]}>
                  {daily.map((_, i) => (
                    <Cell key={i} fill="hsl(162 73% 37%)" fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="No daily data"
              description="Upload a statement to see daily spending."
            />
          )}
        </div>

        {/* Monthly trends */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Monthly trends</h2>
          {trends.filter(t => t.totalAmount > 0).length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={[...trends].filter(t => t.totalAmount > 0).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(224 15% 18%)" />
                <XAxis
                  dataKey="yearMonth"
                  tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
                  tickFormatter={(v) => `$${v}`}
                  axisLine={false}
                  tickLine={false}
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
                <Legend />
                <Line
                  type="monotone"
                  dataKey="totalAmount"
                  stroke="hsl(162 73% 37%)"
                  strokeWidth={2}
                  dot={{ fill: "hsl(162 73% 37%)", r: 4 }}
                  name="Total spent"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="No trend data"
              description="Upload multiple months of statements to see trends."
            />
          )}
        </div>
      </div>

      {/* Category breakdown — latest month */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-1">
          Spending by category
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          {summary?.yearMonth ? `Latest month: ${summary.yearMonth}` : "Latest month"}
        </p>
        {summary?.byCategory?.length ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col gap-3">
              {summary.byCategory.map((cat) => {
                const max = summary.byCategory[0].totalAmount;
                const pct = (cat.totalAmount / max) * 100;
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28 truncate">{cat.category}</span>
                    <div className="flex-1 h-2 rounded-full bg-secondary">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-foreground w-16 text-right">
                      {formatCurrency(cat.totalAmount)}
                    </span>
                  </div>
                );
              })}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={summary.byCategory} layout="vertical" barSize={12}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="category"
                  tick={{ fontSize: 11, fill: "hsl(215 16% 57%)" }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
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
                <Bar dataKey="totalAmount" radius={[0, 3, 3, 0]} fill="hsl(162 73% 37%)" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No category data"
            description="Upload a statement to see spending by category."
          />
        )}
      </div>

      {/* Top merchants — latest month */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-1">Top merchants</h2>
        <p className="text-xs text-muted-foreground mb-4">
          {summary?.yearMonth ? `Latest month: ${summary.yearMonth}` : "Latest month"}
        </p>
        {summary?.topMerchants?.length ? (
          <div className="divide-y divide-border">
            {summary.topMerchants.map((m, i) => (
              <div key={m.merchant} className="flex items-center gap-3 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-xs font-medium text-muted-foreground">
                  {i + 1}
                </div>
                <span className="flex-1 text-sm text-foreground capitalize">
                  {m.merchant.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-muted-foreground">{m.transactionCount} txns</span>
                <span className="text-sm font-medium text-foreground">{formatCurrency(m.totalAmount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No merchant data"
            description="Upload a statement to see top merchants."
          />
        )}
      </div>
    </div>
  );
}