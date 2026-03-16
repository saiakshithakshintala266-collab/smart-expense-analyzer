// File: services/chat-service/src/db/ddb.client.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export function createDdbClient(): DynamoDBClient {
  const endpoint = process.env.DDB_ENDPOINT_URL ?? process.env.AWS_ENDPOINT_URL;
  const hasStaticCreds =
    !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;

  return new DynamoDBClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    ...(endpoint ? { endpoint } : {}),
    ...(hasStaticCreds
      ? {
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
            ...(process.env.AWS_SESSION_TOKEN
              ? { sessionToken: process.env.AWS_SESSION_TOKEN }
              : {}),
          },
        }
      : {}),
  });
}