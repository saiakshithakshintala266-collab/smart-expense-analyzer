// File: shared/libs/testing/src/localstack/seeder.ts
import {
  DynamoDBClient,
  PutItemCommand,
  DeleteItemCommand,
  QueryCommand,
  BatchWriteItemCommand
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export async function seedItem(
  ddb: DynamoDBClient,
  tableName: string,
  item: Record<string, unknown>
): Promise<void> {
  await ddb.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall(item, { removeUndefinedValues: true })
    })
  );
}

export async function deleteItem(
  ddb: DynamoDBClient,
  tableName: string,
  pk: string,
  sk: string
): Promise<void> {
  await ddb.send(
    new DeleteItemCommand({
      TableName: tableName,
      Key: marshall({ PK: pk, SK: sk })
    })
  );
}

/**
 * Delete all items under a given PK — used for post-test cleanup.
 */
export async function cleanupByPk(
  ddb: DynamoDBClient,
  tableName: string,
  pk: string
): Promise<void> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: marshall({ ":pk": pk })
    })
  );

  const items = res.Items ?? [];
  if (items.length === 0) return;

  for (const chunk of chunkArray(items, 25)) {
    await ddb.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [tableName]: chunk.map((item) => {
            const u = unmarshall(item);
            return { DeleteRequest: { Key: marshall({ PK: u.PK, SK: u.SK }) } };
          })
        }
      })
    );
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}