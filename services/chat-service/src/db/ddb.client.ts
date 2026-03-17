import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export function createDdbClient(): DynamoDBClient {
  const endpoint = process.env.DDB_ENDPOINT_URL;
  return new DynamoDBClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    ...(endpoint ? { endpoint } : {})
  });
}