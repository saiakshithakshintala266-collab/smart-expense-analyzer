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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";

export default function InsightsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [daily, setDaily] = useState<DailyAnalytics[]>([]);
  const [trends, setTrends] = useState<
    { yearMonth: string; totalAmount: number; transactionCount: number }[]
  >([]);

  useEffect(() => {
    async function load() {
      const [summaryRes, dailyRes, trendsRes] = await Promise.allSettled([
        analyticsApi.getSummary(),
        analyticsApi.getDaily(),
        analyticsApi.getTrends(),
      ]);

      if (summaryRes.status === "fulfilled") {
        setSummary(summaryRes.value);
      }

      if (dailyRes.status === "fulfilled") {
        const data = dailyRes.value;
        setDaily(Array.isArray(data) ? data : data.items ?? []);
      }

      if (trendsRes.status === "fulfilled") {
        const data = trendsRes.value;
        setTrends(Array.isArray(data) ? data : data.items ?? []);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avgDaily = daily.length
    ? daily.reduce((sum, d) => sum + d.totalAmount, 0) / daily.length
    : 0;

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <PageHeader
        title="Insights"
        description="AI-powered spending analysis"
        icon={TrendingUp}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total spent"
          value={summary ? formatCurrency(summary.totalAmount) : "—"}
          subtext={summary?.yearMonth}
          trend="neutral"
        />
        <StatCard
          label="Avg daily spend"
          value={avgDaily ? formatCurrency(avgDaily) : "—"}
          subtext={`over ${daily.length} days`}
          trend="neutral"
        />
        <StatCard
          label="Transactions"
          value={summary ? String(summary.transactionCount) : "—"}
          subtext="this month"
          trend="neutral"
        />
        <StatCard
          label="Top category"
          value={summary?.byCategory?.[0]?.category ?? "—"}
          subtext={
            summary?.byCategory?.[0]
              ? formatCurrency(summary.byCategory[0].totalAmount)
              : undefined
          }
          trend="neutral"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">
            Daily spend
          </h2>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={daily} barSize={8}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
                  tickFormatter={(value) =>
                    new Date(value).getDate().toString()
                  }
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
                  tickFormatter={(value) => `$${value}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{
                    background: "hsl(224 15% 11%)",
                    border: "1px solid hsl(224 15% 18%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="totalAmount" radius={[3, 3, 0, 0]}>
                  {daily.map((_, index) => (
                    <Cell
                      key={index}
                      fill="hsl(162 73% 37%)"
                      fillOpacity={0.8}
                    />
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

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">
            Monthly trends
          </h2>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trends}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(224 15% 18%)"
                />
                <XAxis
                  dataKey="yearMonth"
                  tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
                  tickFormatter={(value) => `$${value}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
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

      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
          Spending by category
        </h2>
        {summary?.byCategory?.length ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              {summary.byCategory.map((category) => {
                const max = summary.byCategory[0].totalAmount;
                const percent = (category.totalAmount / max) * 100;

                return (
                  <div
                    key={category.category}
                    className="flex items-center gap-3"
                  >
                    <span className="w-28 truncate text-xs text-muted-foreground">
                      {category.category}
                    </span>
                    <div className="h-2 flex-1 rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-xs font-medium text-foreground">
                      {formatCurrency(category.totalAmount)}
                    </span>
                  </div>
                );
              })}
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={summary.byCategory}
                layout="vertical"
                barSize={12}
              >
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
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{
                    background: "hsl(224 15% 11%)",
                    border: "1px solid hsl(224 15% 18%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="totalAmount"
                  radius={[0, 3, 3, 0]}
                  fill="hsl(162 73% 37%)"
                  fillOpacity={0.8}
                />
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

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
          Top merchants
        </h2>
        {summary?.topMerchants?.length ? (
          <div className="divide-y divide-border">
            {summary.topMerchants.map((merchant, index) => (
              <div
                key={merchant.merchant}
                className="flex items-center gap-3 py-3"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-xs font-medium text-muted-foreground">
                  {index + 1}
                </div>
                <span className="flex-1 text-sm capitalize text-foreground">
                  {merchant.merchant.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {merchant.transactionCount} txns
                </span>
                <span className="text-sm font-medium text-foreground">
                  {formatCurrency(merchant.totalAmount)}
                </span>
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