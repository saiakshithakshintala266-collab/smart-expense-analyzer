// File: services/anomaly-service/src/domain/detectors.ts
import { AnomalyType, AnomalySeverity } from "./events";
import { AnomalyRepo, normalizeMerchant } from "../db/anomaly.repo";

export type DetectionResult = {
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  metadata: Record<string, unknown>;
} | null;

type TransactionInput = {
  transactionId: string;
  workspaceId: string;
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  category?: string;
  occurredAt: string;
};

// ── 1. Duplicate charge ───────────────────────────────────────────────────────
// Same merchant + same amount within 7 days
export async function detectDuplicate(
  repo: AnomalyRepo,
  tx: TransactionInput
): Promise<DetectionResult> {
  const merchantNorm = normalizeMerchant(tx.merchant);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const recent = await repo.getRecentTransactionsForMerchant(
    tx.workspaceId,
    merchantNorm,
    since
  );

  const duplicate = recent.find(
    (r) => r.transactionId !== tx.transactionId && Math.abs(r.amount - tx.amount) < 0.01
  );

  if (!duplicate) return null;

  return {
    anomalyType: "DUPLICATE_CHARGE",
    severity: "HIGH",
    description: `Possible duplicate charge: ${tx.merchant} charged ${tx.currency} ${tx.amount} again within 7 days`,
    metadata: {
      originalTransactionId: duplicate.transactionId,
      originalOccurredAt: duplicate.occurredAt,
      merchant: tx.merchant,
      amount: tx.amount,
      currency: tx.currency
    }
  };
}

// ── 2. Unusually large amount ─────────────────────────────────────────────────
// Amount > 3x the workspace monthly average over last 3 months
export async function detectUnusuallyLargeAmount(
  repo: AnomalyRepo,
  tx: TransactionInput
): Promise<DetectionResult> {
  const now = new Date();
  const months: string[] = [];

  for (let i = 3; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const avgMonthlySpend = await repo.getMonthlyWorkspaceAverage(tx.workspaceId, months);

  if (avgMonthlySpend === 0) return null; // Not enough history

  const avgTransactionAmount = avgMonthlySpend / 30; // rough daily average
  const threshold = avgTransactionAmount * 3;

  if (tx.amount <= threshold) return null;

  return {
    anomalyType: "UNUSUALLY_LARGE_AMOUNT",
    severity: tx.amount > threshold * 2 ? "HIGH" : "MEDIUM",
    description: `Unusually large charge: ${tx.merchant} charged ${tx.currency} ${tx.amount}, which is ${(tx.amount / avgTransactionAmount).toFixed(1)}x your average transaction`,
    metadata: {
      amount: tx.amount,
      averageTransactionAmount: Math.round(avgTransactionAmount * 100) / 100,
      threshold: Math.round(threshold * 100) / 100,
      multiplier: Math.round((tx.amount / avgTransactionAmount) * 10) / 10
    }
  };
}

// ── 3. Rapid repeat charges ───────────────────────────────────────────────────
// Same merchant 3+ times within 1 hour
export async function detectRapidRepeat(
  repo: AnomalyRepo,
  tx: TransactionInput
): Promise<DetectionResult> {
  const merchantNorm = normalizeMerchant(tx.merchant);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago

  const recent = await repo.getRecentTransactionsForMerchant(
    tx.workspaceId,
    merchantNorm,
    since
  );

  // Count including current transaction
  const count = recent.filter((r) => r.transactionId !== tx.transactionId).length + 1;

  if (count < 3) return null;

  return {
    anomalyType: "RAPID_REPEAT_CHARGE",
    severity: count >= 5 ? "HIGH" : "MEDIUM",
    description: `Rapid repeat charges: ${tx.merchant} has been charged ${count} times in the last hour`,
    metadata: {
      merchant: tx.merchant,
      chargeCount: count,
      windowMinutes: 60,
      recentTransactionIds: recent.map((r) => r.transactionId)
    }
  };
}

// ── 4. Large round number ─────────────────────────────────────────────────────
// Amount is a suspiciously round number >= 500
const ROUND_NUMBER_THRESHOLD = 500;

export function detectLargeRoundNumber(tx: TransactionInput): DetectionResult {
  if (tx.amount < ROUND_NUMBER_THRESHOLD) return null;
  if (tx.amount % 100 !== 0) return null; // Must be divisible by 100

  return {
    anomalyType: "LARGE_ROUND_NUMBER",
    severity: tx.amount >= 1000 ? "MEDIUM" : "LOW",
    description: `Large round-number charge: ${tx.merchant} charged exactly ${tx.currency} ${tx.amount}`,
    metadata: { amount: tx.amount, merchant: tx.merchant }
  };
}

// ── 5. First-time merchant ────────────────────────────────────────────────────
export async function detectFirstTimeMerchant(
  repo: AnomalyRepo,
  tx: TransactionInput
): Promise<DetectionResult> {
  const merchantNorm = normalizeMerchant(tx.merchant);
  const existing = await repo.getMerchantFirstSeen(tx.workspaceId, merchantNorm);

  if (existing) return null; // Already seen this merchant

  // Record first seen
  await repo.setMerchantFirstSeen(
    tx.workspaceId,
    merchantNorm,
    tx.occurredAt,
    tx.transactionId
  );

  return {
    anomalyType: "FIRST_TIME_MERCHANT",
    severity: "LOW",
    description: `First time seeing merchant: ${tx.merchant}`,
    metadata: { merchant: tx.merchant, amount: tx.amount, currency: tx.currency }
  };
}

// ── 6. Category spend spike ───────────────────────────────────────────────────
// Current month category spend > 2x the average of last 3 months
export async function detectCategorySpendSpike(
  repo: AnomalyRepo,
  tx: TransactionInput
): Promise<DetectionResult> {
  if (!tx.category) return null;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const historyMonths: string[] = [];
  for (let i = 3; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    historyMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const history = await repo.getCategorySpendHistory(tx.workspaceId, tx.category, historyMonths);
  const historicalAmounts = history.map((h) => h.totalAmount).filter((a) => a > 0);

  if (historicalAmounts.length === 0) return null; // No history to compare

  const avgHistorical = historicalAmounts.reduce((a, b) => a + b, 0) / historicalAmounts.length;
  if (avgHistorical === 0) return null;

  // Get current month spend for this category (after adding this transaction)
  const currentHistory = await repo.getCategorySpendHistory(tx.workspaceId, tx.category, [currentMonth]);
  const currentSpend = (currentHistory[0]?.totalAmount ?? 0) + tx.amount;

  if (currentSpend <= avgHistorical * 2) return null;

  return {
    anomalyType: "CATEGORY_SPEND_SPIKE",
    severity: currentSpend > avgHistorical * 3 ? "HIGH" : "MEDIUM",
    description: `Category spend spike in ${tx.category}: ${tx.currency} ${Math.round(currentSpend)} this month vs average of ${tx.currency} ${Math.round(avgHistorical)} over last 3 months`,
    metadata: {
      category: tx.category,
      currentMonthSpend: Math.round(currentSpend),
      averageMonthlySpend: Math.round(avgHistorical),
      multiplier: Math.round((currentSpend / avgHistorical) * 10) / 10
    }
  };
}