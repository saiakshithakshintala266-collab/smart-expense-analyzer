"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { anomalyApi } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";
import type { Anomaly } from "@/types";
import toast from "react-hot-toast";

const SEVERITY_STYLES = {
  high:   { badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",   bar: "bg-rose-500" },
  medium: { badge: "bg-amber-500/10 text-amber-400 border-amber-500/20", bar: "bg-amber-500" },
  low:    { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", bar: "bg-emerald-500" },
};

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unreviewed" | "reviewed">("all");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await anomalyApi.list();
      setAnomalies(Array.isArray(data) ? data : data.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  const filtered = anomalies.filter((a) => {
    if (filter === "unreviewed") return !a.acknowledged;
    if (filter === "reviewed") return a.acknowledged;
    return true;
  });

  const highCount = anomalies.filter((a) => a.severity === "high" && !a.acknowledged).length;
  const medCount = anomalies.filter((a) => a.severity === "medium" && !a.acknowledged).length;
  const lowCount = anomalies.filter((a) => a.severity === "low" && !a.acknowledged).length;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Anomalies"
        description={`${anomalies.filter((a) => !a.acknowledged).length} unreviewed anomalies`}
        icon={AlertTriangle}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
          <div className="text-xs text-rose-400 mb-1">High severity</div>
          <div className="text-2xl font-semibold text-foreground">{highCount}</div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="text-xs text-amber-400 mb-1">Medium severity</div>
          <div className="text-2xl font-semibold text-foreground">{medCount}</div>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="text-xs text-emerald-400 mb-1">Low severity</div>
          <div className="text-2xl font-semibold text-foreground">{lowCount}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "unreviewed", "reviewed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground border border-border"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Anomaly list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No anomalies found"
            description="Your transactions look normal. Upload more statements to get anomaly detection."
          />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((anomaly) => {
              const severity = anomaly.severity?.toLowerCase() as keyof typeof SEVERITY_STYLES ?? "low";
              const styles = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low;
              return (
                <div
                  key={anomaly.id}
                  className={cn(
                    "flex items-start gap-4 px-5 py-4 border-l-2",
                    severity === "high" ? "border-l-rose-500" :
                    severity === "medium" ? "border-l-amber-500" :
                    "border-l-emerald-500"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium capitalize", styles.badge)}>
                        {severity}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {anomaly.type?.toLowerCase().replace(/_/g, " ")}
                      </span>
                      {anomaly.acknowledged && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Reviewed
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{anomaly.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(anomaly.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}