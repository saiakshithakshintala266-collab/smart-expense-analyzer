// File: services/chat-service/src/domain/tool.executor.ts
import { createLogger } from "@shared/logger";

const log = createLogger({ serviceName: "chat-service" });

type ToolInput = Record<string, unknown>;

/**
 * Executes a tool call by fetching data from the appropriate downstream service.
 * In LocalStack/dev, we call the services directly via HTTP.
 * In production these would be internal VPC calls.
 */
export async function executeTool(
  toolName: string,
  toolInput: ToolInput,
  workspaceId: string
): Promise<unknown> {
  const analyticsBase = mustGetEnv("ANALYTICS_SERVICE_URL");
  const anomalyBase = mustGetEnv("ANOMALY_SERVICE_URL");

  log.info({ toolName, toolInput, workspaceId }, "Executing tool");

  switch (toolName) {
    case "get_monthly_summary": {
      const yearMonth = (toolInput.yearMonth as string) ?? currentYearMonth();
      const url = `${analyticsBase}/workspaces/${workspaceId}/analytics/summary?yearMonth=${yearMonth}`;
      return await fetchJson(url);
    }

    case "get_spending_trends": {
      const url = `${analyticsBase}/workspaces/${workspaceId}/analytics/trends`;
      return await fetchJson(url);
    }

    case "get_merchant_summary": {
      const yearMonth = (toolInput.yearMonth as string) ?? currentYearMonth();
      // merchant data is embedded in monthly summary topMerchants
      const url = `${analyticsBase}/workspaces/${workspaceId}/analytics/summary?yearMonth=${yearMonth}`;
      const data = await fetchJson(url) as { topMerchants?: unknown[] };
      return { yearMonth, merchants: data.topMerchants ?? [] };
    }

    case "get_anomalies": {
      const status = toolInput.status as string | undefined;
      const url = status
        ? `${anomalyBase}/workspaces/${workspaceId}/anomalies?status=${status}`
        : `${anomalyBase}/workspaces/${workspaceId}/anomalies`;
      return await fetchJson(url);
    }

    case "get_daily_breakdown": {
      const yearMonth = (toolInput.yearMonth as string) ?? currentYearMonth();
      const url = `${analyticsBase}/workspaces/${workspaceId}/analytics/daily?yearMonth=${yearMonth}`;
      return await fetchJson(url);
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Upstream request failed: ${res.status} ${res.statusText} — ${url}`);
  }
  return res.json();
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}