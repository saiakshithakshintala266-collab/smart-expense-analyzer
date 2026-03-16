// File: services/chat-service/src/integrations/bedrock.client.ts
import {
  BedrockRuntimeClient,
  ConverseCommand,
  Message as BedrockMessage,
  ContentBlock,
  Tool
} from "@aws-sdk/client-bedrock-runtime";
import { createLogger } from "@shared/logger";
import { EXPENSE_TOOLS } from "../domain/tools";
import { executeTool } from "../domain/tool.executor";

const log = createLogger({ serviceName: "chat-service" });

const MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
const MAX_TOOL_ROUNDS = 5; // prevent infinite loops

const SYSTEM_PROMPT = `You are a helpful financial assistant for the Smart Expense Analyzer. 
You help users understand their spending patterns, identify anomalies, and make sense of their financial data.

When answering questions:
- Always fetch real data using the available tools before answering
- Be concise and friendly
- Format currency amounts clearly (e.g. $42.00)
- When showing trends, highlight notable changes
- If data is empty or missing, say so clearly rather than guessing
- Today's date is ${new Date().toISOString().slice(0, 10)}`;

export function createBedrockClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: process.env.BEDROCK_REGION ?? process.env.AWS_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.BEDROCK_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? "test",
      secretAccessKey: process.env.BEDROCK_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? "test",
    },
  });
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Runs the agentic tool-use loop:
 * 1. Send messages + tools to Bedrock
 * 2. If Bedrock calls a tool → execute it → append result → loop
 * 3. When Bedrock returns a text response → done
 */
export async function chat(
  bedrock: BedrockRuntimeClient,
  history: ChatMessage[],
  userMessage: string,
  workspaceId: string
): Promise<string> {
  // ── LocalStack mock ───────────────────────────────────────────────────────
  if (process.env.AWS_ENDPOINT_URL) {
    log.warn({ workspaceId }, "LocalStack detected — returning mock chat response");
    return await mockChatResponse(userMessage, workspaceId);
  }

  // ── Build message history ─────────────────────────────────────────────────
  const messages: BedrockMessage[] = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: [{ text: m.content } as ContentBlock]
    })),
    { role: "user", content: [{ text: userMessage } as ContentBlock] }
  ];

  const tools = EXPENSE_TOOLS.map((t) => ({
    toolSpec: {
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    }
  })) as unknown as Tool[];

  // ── Agentic loop ──────────────────────────────────────────────────────────
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await bedrock.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: SYSTEM_PROMPT }],
        messages,
        toolConfig: { tools }
      })
    );

    const outputMessage = res.output?.message;
    if (!outputMessage) throw new Error("No output message from Bedrock");

    messages.push(outputMessage);

    // Text response — we're done
    if (res.stopReason === "end_turn") {
      const textBlock = outputMessage.content?.find((b) => "text" in b) as
        | { text: string }
        | undefined;
      return textBlock?.text ?? "I'm sorry, I couldn't generate a response.";
    }

    // Tool use — execute each tool and append results
    if (res.stopReason === "tool_use") {
      const toolResults: ContentBlock[] = [];

      for (const block of outputMessage.content ?? []) {
        if (!("toolUse" in block) || !block.toolUse) continue;

        const { toolUseId, name, input } = block.toolUse;

        log.info({ round, toolName: name, toolInput: input, workspaceId }, "Bedrock calling tool");

        try {
          const result = await executeTool(
            name!,
            (input ?? {}) as Record<string, unknown>,
            workspaceId
          );

          toolResults.push({
            toolResult: {
              toolUseId,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content: [{ json: result as any }]
            }
          });
        } catch (err) {
          log.error({ err, toolName: name }, "Tool execution failed");
          toolResults.push({
            toolResult: {
              toolUseId,
              status: "error",
              content: [{ text: `Tool error: ${(err as Error).message}` }]
            }
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unexpected stop reason
    log.warn({ stopReason: res.stopReason }, "Unexpected stop reason");
    break;
  }

  return "I'm sorry, I wasn't able to complete the request. Please try again.";
}

// ── LocalStack mock ───────────────────────────────────────────────────────────
async function mockChatResponse(userMessage: string, workspaceId: string): Promise<string> {
  const lower = userMessage.toLowerCase();

  if (lower.includes("anomal") || lower.includes("alert") || lower.includes("suspicious")) {
    try {
      const anomalyBase = process.env.ANOMALY_SERVICE_URL ?? "http://localhost:3006";
      const res = await fetch(`${anomalyBase}/workspaces/${workspaceId}/anomalies`);
      const anomalies = await res.json() as Array<{ anomalyType: string; severity: string; description: string }>;
      if (anomalies.length === 0) return "You have no anomalies detected at this time. Everything looks clean!";
      const lines = anomalies.map((a) => `• **${a.anomalyType}** (${a.severity}): ${a.description}`);
      return `You have ${anomalies.length} anomaly/anomalies detected:\n\n${lines.join("\n")}`;
    } catch {
      return "I found some anomalies but couldn't fetch the details right now.";
    }
  }

  if (lower.includes("trend") || lower.includes("last month") || lower.includes("compare") || lower.includes("more than") || lower.includes("over time")) {
    try {
      const analyticsBase = process.env.ANALYTICS_SERVICE_URL ?? "http://localhost:3005";
      const res = await fetch(`${analyticsBase}/workspaces/${workspaceId}/analytics/trends`);
      const trends = await res.json() as Array<{ yearMonth: string; totalAmount: number; deltaAmount?: number }>;
      const recent = trends.filter((t) => t.totalAmount > 0).slice(-3);
      if (recent.length === 0) return "You don't have enough spending history to show trends yet.";
      const lines = recent.map((t) => {
        const delta = t.deltaAmount !== undefined ? ` (${t.deltaAmount >= 0 ? "+" : ""}$${t.deltaAmount.toFixed(2)})` : "";
        return `• ${t.yearMonth}: **$${t.totalAmount.toFixed(2)}**${delta}`;
      });
      const last = recent[recent.length - 1];
      const prev = recent[recent.length - 2];
      let comparison = "";
      if (last && prev && prev.totalAmount > 0) {
        comparison = last.totalAmount > prev.totalAmount
          ? `\n\nYou are spending **more** than last month (+$${(last.totalAmount - prev.totalAmount).toFixed(2)}).`
          : `\n\nYou are spending **less** than last month (-$${(prev.totalAmount - last.totalAmount).toFixed(2)}).`;
      }
      return `Here are your recent spending trends:\n\n${lines.join("\n")}${comparison}`;
    } catch {
      return "I couldn't fetch your trends right now. Please try again.";
    }
  }

  if (lower.includes("merchant") || lower.includes("starbucks") || lower.includes("most at") || lower.includes("shop")) {
    try {
      const analyticsBase = process.env.ANALYTICS_SERVICE_URL ?? "http://localhost:3005";
      const ym = new Date().toISOString().slice(0, 7);
      const res = await fetch(`${analyticsBase}/workspaces/${workspaceId}/analytics/summary?yearMonth=${ym}`);
      const summary = await res.json() as { topMerchants?: Array<{ merchant: string; totalAmount: number; transactionCount: number }> };
      const merchants = summary.topMerchants ?? [];
      if (merchants.length === 0) return `No merchant data found for ${ym}.`;
      const lines = merchants.map((m, i) => `${i + 1}. **${m.merchant}** — $${m.totalAmount.toFixed(2)} (${m.transactionCount} transaction(s))`);
      return `Your top merchants in ${ym}:\n\n${lines.join("\n")}`;
    } catch {
      return "I couldn't fetch merchant data right now. Please try again.";
    }
  }

  if (lower.includes("categor") || lower.includes("dining") || lower.includes("groceries") || lower.includes("transport") || lower.includes("subscript") || lower.includes("entertainment") || lower.includes("healthcare")) {
    try {
      const analyticsBase = process.env.ANALYTICS_SERVICE_URL ?? "http://localhost:3005";
      const ym = new Date().toISOString().slice(0, 7);
      const res = await fetch(`${analyticsBase}/workspaces/${workspaceId}/analytics/summary?yearMonth=${ym}`);
      const summary = await res.json() as { byCategory?: Array<{ category: string; totalAmount: number; transactionCount: number }> };
      const categories = summary.byCategory ?? [];
      if (categories.length === 0) return `No category data found for ${ym}.`;
      const lines = categories.map((c) => `• **${c.category}**: $${c.totalAmount.toFixed(2)} (${c.transactionCount} transaction(s))`);
      return `Your spending by category in ${ym}:\n\n${lines.join("\n")}`;
    } catch {
      return "I couldn't fetch category data right now. Please try again.";
    }
  }

  if (lower.includes("spend") || lower.includes("total") || lower.includes("month") || lower.includes("how much")) {
    try {
      const analyticsBase = process.env.ANALYTICS_SERVICE_URL ?? "http://localhost:3005";
      const ym = new Date().toISOString().slice(0, 7);
      const res = await fetch(`${analyticsBase}/workspaces/${workspaceId}/analytics/summary?yearMonth=${ym}`);
      const summary = await res.json() as { totalAmount: number; transactionCount: number; currency: string };
      return `In ${ym}, you've spent **$${summary.totalAmount.toFixed(2)}** across **${summary.transactionCount}** transaction(s).`;
    } catch {
      return "I couldn't fetch your spending data right now. Please try again.";
    }
  }

  return `I'm your Smart Expense Analyzer assistant! I can help you with:\n\n• Your monthly spending totals\n• Category and merchant breakdowns\n• Spending trends over time\n• Anomalies and alerts\n\nWhat would you like to know?`;
}