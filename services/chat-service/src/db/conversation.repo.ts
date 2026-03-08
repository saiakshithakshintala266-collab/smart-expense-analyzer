// File: services/chat-service/src/db/conversation.repo.ts
/**
 * DynamoDB key design for ChatConversations table
 *
 * ── Conversation metadata ─────────────────────────────────────────────────────
 *   PK = WS#<workspaceId>   SK = CONV#<createdAt>#<conversationId>
 *   Fields: conversationId, title, messageCount, createdAt, updatedAt
 *
 * ── Messages ──────────────────────────────────────────────────────────────────
 *   PK = CONV#<conversationId>   SK = MSG#<createdAt>#<messageId>
 *   Fields: messageId, role, content, createdAt
 *   TTL: 90 days
 */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export type MessageRole = "user" | "assistant";

export type Message = {
  messageId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

export type Conversation = {
  conversationId: string;
  workspaceId: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

export class ConversationRepo {
  constructor(
    private readonly ddb: DynamoDBClient,
    private readonly tableName: string
  ) {}

  // ── Conversations ─────────────────────────────────────────────────────────

  async createConversation(conv: Conversation): Promise<void> {
    await this.ddb.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          PK: `WS#${conv.workspaceId}`,
          SK: `CONV#${conv.createdAt}#${conv.conversationId}`,
          ...conv
        }, { removeUndefinedValues: true })
      })
    );
  }

  async listConversations(workspaceId: string, limit = 20): Promise<Conversation[]> {
    const res = await this.ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: marshall({
          ":pk": `WS#${workspaceId}`,
          ":prefix": "CONV#"
        }),
        ScanIndexForward: false,
        Limit: limit
      })
    );

    return (res.Items ?? []).map((i) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { PK, SK, ...rest } = unmarshall(i);
      return rest as Conversation;
    });
  }

  async updateConversation(
    workspaceId: string,
    conversationId: string,
    createdAt: string,
    updates: { title?: string; messageCount?: number; updatedAt: string }
  ): Promise<void> {
    const expressions: string[] = ["updatedAt = :u"];
    const values: Record<string, unknown> = { ":u": updates.updatedAt };

    if (updates.title) {
      expressions.push("title = :t");
      values[":t"] = updates.title;
    }
    if (updates.messageCount !== undefined) {
      expressions.push("messageCount = :m");
      values[":m"] = updates.messageCount;
    }

    await this.ddb.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: `WS#${workspaceId}`, SK: `CONV#${createdAt}#${conversationId}` }),
        UpdateExpression: `SET ${expressions.join(", ")}`,
        ExpressionAttributeValues: marshall(values)
      })
    );
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  async addMessage(conversationId: string, msg: Message): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90; // 90 day TTL
    await this.ddb.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          PK: `CONV#${conversationId}`,
          SK: `MSG#${msg.createdAt}#${msg.messageId}`,
          conversationId,
          ttl,
          ...msg
        }, { removeUndefinedValues: true })
      })
    );
  }

  async getMessages(conversationId: string, limit = 20): Promise<Message[]> {
    const res = await this.ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: marshall({
          ":pk": `CONV#${conversationId}`,
          ":prefix": "MSG#"
        }),
        ScanIndexForward: true, // oldest first for conversation history
        Limit: limit
      })
    );

    return (res.Items ?? []).map((i) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { PK, SK, ttl, conversationId: _cid, ...rest } = unmarshall(i);
      return rest as Message;
    });
  }
}