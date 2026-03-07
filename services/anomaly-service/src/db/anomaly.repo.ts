// File: services/anomaly-service/src/db/anomaly.repo.ts
/**
 * DynamoDB key design for AnomalyDetections table
 *
 * ── Anomaly records ───────────────────────────────────────────────────────────
 *   PK = WS#<workspaceId>   SK = ANOMALY#<createdAt>#<anomalyId>
 *   Fields: anomalyId, transactionId, anomalyType, severity, description, metadata, status
 *
 * ── Recent transactions index (for duplicate + rapid repeat detection) ────────
 *   PK = WS#<workspaceId>   SK = TXN_IDX#<merchant_normalized>#<YYYY-MM-DDTHH:MM:SS>#<transactionId>
 *   Fields: transactionId, merchant, amount, date, occurredAt
 *
 * ── Merchant first-seen index ─────────────────────────────────────────────────
 *   PK = WS#<workspaceId>   SK = MERCHANT_SEEN#<merchant_normalized>
 *   Fields: firstSeenAt, transactionId
 *
 * ── Monthly spend index (for category spike detection) ───────────────────────
 *   PK = WS#<workspaceId>   SK = CAT_SPEND#<YYYY-MM>#<category>
 *   Fields: totalAmount, transactionCount
 */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { AnomalyType, AnomalySeverity } from "../domain/events";

export type AnomalyRecord = {
  anomalyId: string;
  workspaceId: string;
  transactionId: string;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  metadata: Record<string, unknown>;
  status: "OPEN" | "DISMISSED";
  createdAt: string;
};

export type TxnIndexRecord = {
  transactionId: string;
  merchant: string;
  merchantNormalized: string;
  amount: number;
  date: string;
  occurredAt: string;
};

export class AnomalyRepo {
  constructor(
    private readonly ddb: DynamoDBClient,
    private readonly tableName: string
  ) {}

  // ── Anomaly records ───────────────────────────────────────────────────────

  async saveAnomaly(record: AnomalyRecord): Promise<void> {
    await this.ddb.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          PK: pk(record.workspaceId),
          SK: `ANOMALY#${record.createdAt}#${record.anomalyId}`,
          ...record
        }, { removeUndefinedValues: true })
      })
    );
  }

  async listAnomalies(
    workspaceId: string,
    opts: { limit?: number; status?: "OPEN" | "DISMISSED" } = {}
  ): Promise<AnomalyRecord[]> {
    const res = await this.ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: marshall({
          ":pk": pk(workspaceId),
          ":prefix": "ANOMALY#"
        }),
        ScanIndexForward: false,
        Limit: opts.limit ?? 50
      })
    );

    const items = (res.Items ?? []).map((i) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { PK, SK, ...rest } = unmarshall(i);
      return rest as AnomalyRecord;
    });

    if (opts.status) return items.filter((a) => a.status === opts.status);
    return items;
  }

  // ── Transaction index (duplicate + rapid repeat) ──────────────────────────

  async indexTransaction(workspaceId: string, record: TxnIndexRecord): Promise<void> {
    await this.ddb.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          PK: pk(workspaceId),
          SK: `TXN_IDX#${record.merchantNormalized}#${record.occurredAt}#${record.transactionId}`,
          ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 day TTL
          ...record
        }, { removeUndefinedValues: true })
      })
    );
  }

  async getRecentTransactionsForMerchant(
    workspaceId: string,
    merchantNormalized: string,
    sinceIso: string
  ): Promise<TxnIndexRecord[]> {
    const res = await this.ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND SK BETWEEN :from AND :to",
        ExpressionAttributeValues: marshall({
          ":pk": pk(workspaceId),
          ":from": `TXN_IDX#${merchantNormalized}#${sinceIso}`,
          ":to": `TXN_IDX#${merchantNormalized}#\xFF`
        }),
        ScanIndexForward: false
      })
    );

    return (res.Items ?? []).map((i) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { PK, SK, ttl, ...rest } = unmarshall(i);
      return rest as TxnIndexRecord;
    });
  }

  // ── Merchant first-seen ───────────────────────────────────────────────────

  async getMerchantFirstSeen(
    workspaceId: string,
    merchantNormalized: string
  ): Promise<{ firstSeenAt: string; transactionId: string } | null> {
    const res = await this.ddb.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: pk(workspaceId),
          SK: `MERCHANT_SEEN#${merchantNormalized}`
        })
      })
    );

    if (!res.Item) return null;
    const item = unmarshall(res.Item);
    return { firstSeenAt: item.firstSeenAt as string, transactionId: item.transactionId as string };
  }

  async setMerchantFirstSeen(
    workspaceId: string,
    merchantNormalized: string,
    firstSeenAt: string,
    transactionId: string
  ): Promise<void> {
    await this.ddb.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({ PK: pk(workspaceId), SK: `MERCHANT_SEEN#${merchantNormalized}`, firstSeenAt, transactionId }),
        ConditionExpression: "attribute_not_exists(PK)" // only set if not exists
      })
    ).catch(() => {
      // Condition failed = merchant already seen, that's fine
    });
  }

  // ── Category monthly spend ────────────────────────────────────────────────

  async incrementCategorySpend(
    workspaceId: string,
    yearMonth: string,
    category: string,
    amount: number
  ): Promise<void> {
    await this.ddb.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: pk(workspaceId), SK: `CAT_SPEND#${yearMonth}#${category}` }),
        UpdateExpression: "ADD totalAmount :a, transactionCount :c",
        ExpressionAttributeValues: marshall({ ":a": amount, ":c": 1 })
      })
    );
  }

  async getCategorySpendHistory(
    workspaceId: string,
    category: string,
    months: string[]    // YYYY-MM array
  ): Promise<{ yearMonth: string; totalAmount: number; transactionCount: number }[]> {
    const results = await Promise.all(
      months.map(async (ym) => {
        const res = await this.ddb.send(
          new GetItemCommand({
            TableName: this.tableName,
            Key: marshall({ PK: pk(workspaceId), SK: `CAT_SPEND#${ym}#${category}` })
          })
        );
        if (!res.Item) return { yearMonth: ym, totalAmount: 0, transactionCount: 0 };
        const item = unmarshall(res.Item);
        return {
          yearMonth: ym,
          totalAmount: Number(item.totalAmount ?? 0),
          transactionCount: Number(item.transactionCount ?? 0)
        };
      })
    );
    return results;
  }

  // ── Monthly workspace average (for large amount detection) ───────────────

  async getMonthlyWorkspaceAverage(
    workspaceId: string,
    months: string[]
  ): Promise<number> {
    // Sum all category spends across months to get total workspace spend
    const res = await this.ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND SK BETWEEN :from AND :to",
        ExpressionAttributeValues: marshall({
          ":pk": pk(workspaceId),
          ":from": `CAT_SPEND#${months[0]}#`,
          ":to": `CAT_SPEND#${months[months.length - 1]}#\xFF`
        })
      })
    );

    if (!res.Items || res.Items.length === 0) return 0;

    const items = res.Items.map((i) => unmarshall(i));
    const totalSpend = items.reduce((sum, i) => sum + Number(i.totalAmount ?? 0), 0);
    return totalSpend / months.length;
  }
}

function pk(workspaceId: string): string {
  return `WS#${workspaceId}`;
}

export function normalizeMerchant(merchant: string): string {
  return merchant.toLowerCase().trim().replace(/[^a-z0-9]/g, "_").slice(0, 64);
}