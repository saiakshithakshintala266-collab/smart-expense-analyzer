// File: services/chat-service/src/domain/tools.ts
/**
 * Tool definitions passed to Bedrock.
 * Bedrock will call these to fetch data before composing a natural language answer.
 */

export const EXPENSE_TOOLS = [
  {
    name: "get_monthly_summary",
    description:
      "Get total spend, transaction count, category breakdown, source breakdown and top merchants for a given month. Use this for questions about total spend, monthly breakdowns, or category spending in a specific month.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          yearMonth: {
            type: "string",
            description: "Month to query in YYYY-MM format, e.g. '2026-03'. If not specified by the user, use the current month."
          }
        },
        required: ["yearMonth"]
      }
    }
  },
  {
    name: "get_spending_trends",
    description:
      "Get monthly spend totals for the last 12 months including delta and percentage change month-over-month. Use this for trend questions like 'am I spending more than last month?' or 'show me my spending over time'.",
    inputSchema: {
      json: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    name: "get_merchant_summary",
    description:
      "Get spending breakdown by merchant for a given month, including total amount and transaction count per merchant. Use this for merchant-specific questions like 'how much did I spend at Starbucks?' or 'which merchant do I spend the most at?'.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          yearMonth: {
            type: "string",
            description: "Month to query in YYYY-MM format. If not specified by the user, use the current month."
          }
        },
        required: ["yearMonth"]
      }
    }
  },
  {
    name: "get_anomalies",
    description:
      "Get a list of detected anomalies (duplicate charges, unusual amounts, rapid repeats, etc.) for the workspace. Use this for questions about alerts, suspicious transactions, or anomalies.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["OPEN", "DISMISSED"],
            description: "Filter by anomaly status. Omit to get all anomalies."
          }
        },
        required: []
      }
    }
  },
  {
    name: "get_daily_breakdown",
    description:
      "Get daily spend totals for a given month. Use this for questions about spending on specific days or daily patterns.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          yearMonth: {
            type: "string",
            description: "Month to query in YYYY-MM format. If not specified by the user, use the current month."
          }
        },
        required: ["yearMonth"]
      }
    }
  }
] as const;

export type ToolName = (typeof EXPENSE_TOOLS)[number]["name"];