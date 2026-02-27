import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export function createDdbClient(): DynamoDBClient {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  const region = process.env.AWS_REGION ?? "us-east-1";
  return new DynamoDBClient({ region, endpoint });
}