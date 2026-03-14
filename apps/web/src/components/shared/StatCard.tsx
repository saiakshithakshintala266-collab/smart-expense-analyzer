import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  subtext?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
}

export function StatCard({ label, value, subtext, icon: Icon, trend }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      {subtext && (
        <div className={cn(
          "text-xs mt-1",
          trend === "up" && "text-emerald-400",
          trend === "down" && "text-rose-400",
          trend === "neutral" && "text-muted-foreground",
          !trend && "text-muted-foreground"
        )}>
          {subtext}
        </div>
      )}
    </div>
  );
}