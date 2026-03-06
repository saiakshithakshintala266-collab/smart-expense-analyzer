// File: services/transactions-service/src/db/transactions.repo.ts
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export type TransactionStatus = "ACTIVE" | "DELETED";
export type TransactionSource = "receipt" | "bank_csv" | "manual";

export type TransactionRecord = {
  id: string;
  workspaceId: string;
  uploadFileId?: string;
  extractedDocumentId?: string;
  source: TransactionSource;
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  category?: string;
  categoryOverriddenByUserId?: string;
  categoryOverriddenAt?: string;
  merchantOverride?: string;
  notes?: string;
  extractionConfidence?: number;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
};

type DbItem = TransactionRecord & { PK: string; SK: string; GSI1PK?: string; GSI1SK?: string; GSI2PK?: string };

export class TransactionsRepo {
  constructor(
    private readonly ddb: DynamoDBClient,
    private readonly tableName: string
  ) {}

  async put(record: TransactionRecord): Promise<void> {
    const item: DbItem = {
      ...record,
      PK: pk(record.workspaceId),
      SK: sk(record.id),
      GSI1PK: gsi1pk(record.workspaceId),
      GSI1SK: gsi1sk(record.date, record.id),
      ...(record.extractedDocumentId ? { GSI2PK: gsi2pk(record.extractedDocumentId) } : {})
    };

    await this.ddb.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(item, { removeUndefinedValues: true })
      })
    );
  }

  async get(workspaceId: string, id: string): Promise<TransactionRecord | null> {
    const res = await this.ddb.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: pk(workspaceId), SK: sk(id) })
      })
    );
    if (!res.Item) return null;
    return stripKeys(unmarshall(res.Item) as DbItem);
  }

  async listByWorkspace(
    workspaceId: string,
    opts: {
      limit?: number;
      dateFrom?: string;
      dateTo?: string;
      category?: string;
      source?: TransactionSource;
      status?: TransactionStatus;
      nextPageToken?: string;
    } = {}
  ) {
    const limit = opts.limit ?? 50;

    let keyCondition = "PK = :pk";
    const exprValues: Record<string, unknown> = { ":pk": pk(workspaceId) };

    const res = await this.ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: marshall(exprValues),
        Limit: limit,
        ScanIndexForward: false,
        ...(opts.nextPageToken
          ? { ExclusiveStartKey: JSON.parse(Buffer.from(opts.nextPageToken, "base64").toString()) }
          : {})
      })
    );

    let items = (res.Items ?? []).map((i) => stripKeys(unmarshall(i) as DbItem));

    // In-memory filters
    if (opts.dateFrom) items = items.filter((r) => r.date >= opts.dateFrom!);
    if (opts.dateTo) items = items.filter((r) => r.date <= opts.dateTo!);
    if (opts.category) items = items.filter((r) => r.category === opts.category);
    if (opts.source) items = items.filter((r) => r.source === opts.source);
    const statusFilter = opts.status ?? "ACTIVE";
    items = items.filter((r) => r.status === statusFilter);

    const nextPageToken = res.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64")
      : null;

    return { items, nextPageToken };
  }

  async updateCorrections(
    workspaceId: string,
    id: string,
    patch: {
      merchantOverride?: string;
      notes?: string;
      category?: string;
      categoryOverriddenByUserId?: string;
      categoryOverriddenAt?: string;
    }
  ): Promise<void> {
    const sets: string[] = ["updatedAt = :u"];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = { ":u": new Date().toISOString() };

    if (patch.merchantOverride !== undefined) {
      sets.push("merchantOverride = :mo");
      values[":mo"] = patch.merchantOverride;
    }
    if (patch.notes !== undefined) {
      sets.push("#notes = :n");
      names["#notes"] = "notes";
      values[":n"] = patch.notes;
    }
    if (patch.category !== undefined) {
      sets.push("#cat = :c");
      names["#cat"] = "category";
      values[":c"] = patch.category;
    }
    if (patch.categoryOverriddenByUserId !== undefined) {
      sets.push("categoryOverriddenByUserId = :cou");
      values[":cou"] = patch.categoryOverriddenByUserId;
    }
    if (patch.categoryOverriddenAt !== undefined) {
      sets.push("categoryOverriddenAt = :coa");
      values[":coa"] = patch.categoryOverriddenAt;
    }

    await this.ddb.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: pk(workspaceId), SK: sk(id) }),
        UpdateExpression: `SET ${sets.join(", ")}`,
        ...(Object.keys(names).length > 0 ? { ExpressionAttributeNames: names } : {}),
        ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true })
      })
    );
  }

  async softDelete(workspaceId: string, id: string): Promise<void> {
    await this.ddb.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: pk(workspaceId), SK: sk(id) }),
        UpdateExpression: "SET #s = :s, updatedAt = :u",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: marshall({ ":s": "DELETED", ":u": new Date().toISOString() })
      })
    );
  }

  async getByExtractedDocumentId(
    extractedDocumentId: string
  ): Promise<TransactionRecord | null> {
    const res = await this.ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :gsi2pk",
        ExpressionAttributeValues: marshall({ ":gsi2pk": gsi2pk(extractedDocumentId) }),
        Limit: 1
      })
    );
    if (!res.Items || res.Items.length === 0) return null;
    return stripKeys(unmarshall(res.Items[0]) as DbItem);
  }
}

function pk(workspaceId: string): string { return `WS#${workspaceId}`; }
function sk(id: string): string { return `TXN#${id}`; }
function gsi1pk(workspaceId: string): string { return `WS#${workspaceId}`; }
function gsi1sk(date: string, id: string): string { return `DATE#${date}#${id}`; }
function gsi2pk(extractedDocumentId: string): string { return `EXTRACTION#${extractedDocumentId}`; }

function stripKeys(item: DbItem): TransactionRecord {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { PK, SK, GSI1PK, GSI1SK, GSI2PK, ...rest } = item;
  return rest;
}