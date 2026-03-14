import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export function createDdbClient() {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    ...(endpoint ? { endpoint } : {}),
  });
  return DynamoDBDocumentClient.from(client);
}