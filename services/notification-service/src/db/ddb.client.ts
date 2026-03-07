// File: services/notification-service/src/db/ddb.client.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export function createDdbClient(): DynamoDBClient {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  return new DynamoDBClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    ...(endpoint ? { endpoint } : {})
  });
}