// File: services/upload-service/src/db/uploadfiles.repo.ts
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export type UploadStatus = "QUEUED" | "UPLOADED" | "PROCESSING" | "COMPLETED" | "FAILED";
export type UploadSource = "receipt" | "bank_csv" | "manual";

export type UploadFileRecord = {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  storageBucket: string;
  storageKey: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  status: UploadStatus;
  source: UploadSource;
  checksumSha256?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

type DbItem = UploadFileRecord & { PK: string; SK: string };

export class UploadFilesRepo {
  constructor(
    private readonly ddb: DynamoDBClient,
    private readonly tableName: string
  ) {}

  async put(record: UploadFileRecord): Promise<void> {
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

  async get(workspaceId: string, id: string): Promise<UploadFileRecord | null> {
    const res = await this.ddb.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: pk(workspaceId), SK: sk(id) })
      })
    );

    if (!res.Item) return null;
    const parsed = unmarshall(res.Item) as DbItem;
    return stripKeys(parsed);
  }

  async updateStatus(workspaceId: string, id: string, status: UploadStatus): Promise<void> {
    await this.ddb.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ PK: pk(workspaceId), SK: sk(id) }),
        UpdateExpression: "SET #s = :s, updatedAt = :u",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: marshall({
          ":s": status,
          ":u": new Date().toISOString()
        })
      })
    );
  }

  async listByWorkspace(workspaceId: string, limit = 50) {
    const res = await this.ddb.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: marshall({ ":pk": pk(workspaceId) }),
        Limit: limit
      })
    );

    const items = (res.Items ?? []).map((i) => stripKeys(unmarshall(i) as DbItem));
    return { items, nextPageToken: null as string | null };
  }
}

function pk(workspaceId: string): string {
  return `WS#${workspaceId}`;
}

function sk(uploadFileId: string): string {
  return `UPLOAD#${uploadFileId}`;
}

function stripKeys(item: DbItem): UploadFileRecord {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { PK, SK, ...rest } = item;
  return rest;
}