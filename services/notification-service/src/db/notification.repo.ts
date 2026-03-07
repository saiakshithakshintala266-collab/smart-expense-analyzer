// File: services/notification-service/src/db/notification.repo.ts
/**
 * DynamoDB key design for Notifications table
 *
 * ── In-app notifications ──────────────────────────────────────────────────────
 *   PK = WS#<workspaceId>   SK = NOTIF#<createdAt>#<notificationId>
 *   Fields: notificationId, title, body, type, severity, referenceId, status, createdAt
 *
 * ── Email throttle records ────────────────────────────────────────────────────
 *   PK = WS#<workspaceId>   SK = THROTTLE#<anomalyType>
 *   Fields: lastSentAt, ttl (auto-expires after 1 hour via DynamoDB TTL)
 *
 * ── Weekly digest state ───────────────────────────────────────────────────────
 *   PK = WS#<workspaceId>   SK = DIGEST#<YYYY-WW>
 *   Fields: transactionCount, totalAmount, lastUpdatedAt
 */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export type NotificationStatus = "UNREAD" | "READ";

export type NotificationRecord = {
  notificationId: string;
  workspaceId: string;
  title: string;
  body: string;
  type: "ANOMALY" | "DIGEST";
  severity?: "LOW" | "MEDIUM" | "HIGH";
  referenceId?: string;   // anomalyId or transactionId
  status: NotificationStatus;
  createdAt: string;
};

export class NotificationRepo {
  constructor(
    private readonly ddb: DynamoDBClient,
    private readonly tableName: string
  ) {}

  // ── In-app notifications ──────────────────────────────────────────────────

  async save(record: NotificationRecord): Promise<void> {
    await this.ddb.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          PK: pk(record.workspaceId),
          SK: `NOTIF#${record.createdAt}#${record.notificationId}`,
          ...record
        }, { removeUndefinedValues: true })
      })
    );
  }

  async list(
    workspaceId: string,
    opts: { status?: NotificationStatus; limit?: number } = {}
  ): Promise<NotificationRecord[]> {
    const res = await this.ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: marshall({
          ":pk": pk(workspaceId),
          ":prefix": "NOTIF#"
        }),
        ScanIndexForward: false,
        Limit: opts.limit ?? 50
      })
    );

    const items = (res.Items ?? []).map((i) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { PK, SK, ...rest } = unmarshall(i);
      return rest as NotificationRecord;
    });

    if (opts.status) return items.filter((n) => n.status === opts.status);
    return items;
  }

  async markRead(workspaceId: string, notificationId: string, createdAt: string): Promise<void> {
    await this.ddb.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({
          PK: pk(workspaceId),
          SK: `NOTIF#${createdAt}#${notificationId}`
        }),
        UpdateExpression: "SET #s = :s",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: marshall({ ":s": "READ" })
      })
    );
  }

  async markAllRead(workspaceId: string): Promise<void> {
    const unread = await this.list(workspaceId, { status: "UNREAD", limit: 100 });
    await Promise.all(
      unread.map((n) => this.markRead(workspaceId, n.notificationId, n.createdAt))
    );
  }

  async unreadCount(workspaceId: string): Promise<number> {
    const unread = await this.list(workspaceId, { status: "UNREAD", limit: 100 });
    return unread.length;
  }

  // ── Email throttle ────────────────────────────────────────────────────────

  async isThrottled(workspaceId: string, anomalyType: string): Promise<boolean> {
    const res = await this.ddb.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: pk(workspaceId), SK: `THROTTLE#${anomalyType}` })
      })
    );

    if (!res.Item) return false;
    const item = unmarshall(res.Item);
    const lastSentAt = new Date(item.lastSentAt as string).getTime();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return lastSentAt > oneHourAgo;
  }

  async setThrottle(workspaceId: string, anomalyType: string): Promise<void> {
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour TTL
    await this.ddb.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({ PK: pk(workspaceId), SK: `THROTTLE#${anomalyType}`, lastSentAt: now, ttl })
      })
    );
  }

  // ── Weekly digest ─────────────────────────────────────────────────────────

  async incrementDigest(
    workspaceId: string,
    weekKey: string,   // YYYY-WW
    amount: number
  ): Promise<void> {
    await this.ddb.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: pk(workspaceId), SK: `DIGEST#${weekKey}` }),
        UpdateExpression: "ADD transactionCount :c, totalAmount :a SET lastUpdatedAt = :u",
        ExpressionAttributeValues: marshall({ ":c": 1, ":a": amount, ":u": new Date().toISOString() })
      })
    );
  }

  async getDigest(
    workspaceId: string,
    weekKey: string
  ): Promise<{ transactionCount: number; totalAmount: number } | null> {
    const res = await this.ddb.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: pk(workspaceId), SK: `DIGEST#${weekKey}` })
      })
    );

    if (!res.Item) return null;
    const item = unmarshall(res.Item);
    return {
      transactionCount: Number(item.transactionCount ?? 0),
      totalAmount: Number(item.totalAmount ?? 0)
    };
  }
}

function pk(workspaceId: string): string {
  return `WS#${workspaceId}`;
}