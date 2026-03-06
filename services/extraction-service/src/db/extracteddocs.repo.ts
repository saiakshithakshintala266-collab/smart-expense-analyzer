// File: services/extraction-service/src/db/extracteddocs.repo.ts
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ExtractedField, ExtractedLineItem } from "../domain/events";

export type ExtractionStatus = "PROCESSING" | "COMPLETED" | "FAILED";

export type ExtractedDocRecord = {
  id: string;                          // extractedDocumentId (uuid)
  workspaceId: string;
  uploadFileId: string;
  status: ExtractionStatus;
  source: "receipt" | "bank_csv" | "manual";
  extractionMethod: "textract" | "csv_parser";
  fields: ExtractedField[];
  lineItems: ExtractedLineItem[];
  rawTextractJobId?: string;
  csvRowCount?: number;
  warnings: string[];
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

type DbItem = ExtractedDocRecord & { PK: string; SK: string };

export class ExtractedDocsRepo {
  constructor(
    private readonly ddb: DynamoDBClient,
    private readonly tableName: string
  ) {}

  async put(record: ExtractedDocRecord): Promise<void> {
    const item: DbItem = {
      ...record,
      PK: pk(record.workspaceId),
      SK: sk(record.id)
    };

    await this.ddb.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(item, { removeUndefinedValues: true })
      })
    );
  }

  async get(workspaceId: string, id: string): Promise<ExtractedDocRecord | null> {
    const res = await this.ddb.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: pk(workspaceId), SK: sk(id) })
      })
    );
    if (!res.Item) return null;
    return stripKeys(unmarshall(res.Item) as DbItem);
  }

  async updateStatus(
    workspaceId: string,
    id: string,
    status: ExtractionStatus,
    errorMessage?: string
  ): Promise<void> {
    await this.ddb.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: pk(workspaceId), SK: sk(id) }),
        UpdateExpression: "SET #s = :s, updatedAt = :u" + (errorMessage ? ", errorMessage = :e" : ""),
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: marshall(
          {
            ":s": status,
            ":u": new Date().toISOString(),
            ...(errorMessage ? { ":e": errorMessage } : {})
          },
          { removeUndefinedValues: true }
        )
      })
    );
  }

  async listByWorkspace(workspaceId: string, limit = 50) {
    const res = await this.ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: marshall({ ":pk": pk(workspaceId) }),
        Limit: limit,
        ScanIndexForward: false
      })
    );

    const items = (res.Items ?? []).map((i) => stripKeys(unmarshall(i) as DbItem));
    return { items, nextPageToken: null as string | null };
  }

  async getByUploadFileId(workspaceId: string, uploadFileId: string): Promise<ExtractedDocRecord | null> {
    // GSI would be ideal here; for MVP we query + filter
    const res = await this.listByWorkspace(workspaceId, 100);
    return res.items.find((r) => r.uploadFileId === uploadFileId) ?? null;
  }
}

function pk(workspaceId: string): string {
  return `WS#${workspaceId}`;
}

function sk(docId: string): string {
  return `EXTRACTED#${docId}`;
}

function stripKeys(item: DbItem): ExtractedDocRecord {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { PK, SK, ...rest } = item;
  return rest;
}