// File: services/notification-service/src/integrations/email.templates.ts

export type AnomalyEmailInput = {
  workspaceId: string;
  anomalyType: string;
  severity: string;
  description: string;
  transactionId: string;
  occurredAt: string;
};

export type DigestEmailInput = {
  workspaceId: string;
  weekKey: string;
  transactionCount: number;
  totalAmount: number;
  currency: string;
};

const SEVERITY_COLOR: Record<string, string> = {
  HIGH: "#dc2626",
  MEDIUM: "#d97706",
  LOW: "#2563eb"
};

const SEVERITY_LABEL: Record<string, string> = {
  HIGH: "🔴 High",
  MEDIUM: "🟡 Medium",
  LOW: "🔵 Low"
};

export function anomalyEmailTemplate(input: AnomalyEmailInput): {
  subject: string;
  bodyText: string;
  bodyHtml: string;
} {
  const color = SEVERITY_COLOR[input.severity] ?? "#6b7280";
  const severityLabel = SEVERITY_LABEL[input.severity] ?? input.severity;
  const formattedType = input.anomalyType.replace(/_/g, " ").toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const subject = `[${input.severity}] ${formattedType} detected in your workspace`;

  const bodyText = [
    `Smart Expense Analyzer — Anomaly Alert`,
    ``,
    `Severity: ${input.severity}`,
    `Type: ${formattedType}`,
    `Description: ${input.description}`,
    `Transaction ID: ${input.transactionId}`,
    `Detected at: ${new Date(input.occurredAt).toLocaleString()}`,
    ``,
    `Log in to review this transaction.`
  ].join("\n");

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: ${color}; padding: 20px 24px;">
      <h1 style="color: white; margin: 0; font-size: 18px;">⚠️ Anomaly Detected</h1>
    </div>
    <div style="padding: 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">Severity</td>
          <td style="padding: 8px 0; font-weight: 600; color: ${color};">${severityLabel}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Type</td>
          <td style="padding: 8px 0; font-weight: 500;">${formattedType}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px; vertical-align: top;">Description</td>
          <td style="padding: 8px 0;">${input.description}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Transaction</td>
          <td style="padding: 8px 0; font-family: monospace; font-size: 13px;">${input.transactionId}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Detected at</td>
          <td style="padding: 8px 0;">${new Date(input.occurredAt).toLocaleString()}</td>
        </tr>
      </table>
      <div style="margin-top: 24px;">
        <a href="#" style="background: #1d4ed8; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Review Transaction →
        </a>
      </div>
    </div>
    <div style="padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">Smart Expense Analyzer · Workspace ${input.workspaceId}</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, bodyText, bodyHtml };
}

export function digestEmailTemplate(input: DigestEmailInput): {
  subject: string;
  bodyText: string;
  bodyHtml: string;
} {
  const subject = `Your weekly expense summary — ${input.weekKey}`;
  const formattedAmount = `${input.currency} ${input.totalAmount.toFixed(2)}`;

  const bodyText = [
    `Smart Expense Analyzer — Weekly Digest`,
    ``,
    `Week: ${input.weekKey}`,
    `Total Spend: ${formattedAmount}`,
    `Transactions: ${input.transactionCount}`,
    ``,
    `Log in to see the full breakdown.`
  ].join("\n");

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #1d4ed8; padding: 20px 24px;">
      <h1 style="color: white; margin: 0; font-size: 18px;">📊 Weekly Expense Summary</h1>
    </div>
    <div style="padding: 24px;">
      <p style="color: #6b7280; font-size: 14px; margin-top: 0;">Week of ${input.weekKey}</p>
      <div style="display: flex; gap: 16px; margin: 24px 0;">
        <div style="flex: 1; background: #eff6ff; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #1d4ed8;">${formattedAmount}</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Total Spend</div>
        </div>
        <div style="flex: 1; background: #f0fdf4; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: #16a34a;">${input.transactionCount}</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Transactions</div>
        </div>
      </div>
      <a href="#" style="background: #1d4ed8; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
        View Full Breakdown →
      </a>
    </div>
    <div style="padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">Smart Expense Analyzer · Workspace ${input.workspaceId}</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, bodyText, bodyHtml };
}