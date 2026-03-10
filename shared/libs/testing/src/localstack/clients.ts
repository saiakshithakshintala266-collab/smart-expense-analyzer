// File: shared/libs/testing/src/localstack/clients.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SNSClient } from "@aws-sdk/client-sns";
import {
  SQSClient,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from "@aws-sdk/client-sqs";

const LOCALSTACK_ENDPOINT = "http://localhost:4566";
const REGION = "us-east-1";

const AWS_CREDS = {
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
  region: REGION,
  endpoint: LOCALSTACK_ENDPOINT
};

export function createTestDdbClient(): DynamoDBClient {
  return new DynamoDBClient(AWS_CREDS);
}

export function createTestSnsClient(): SNSClient {
  return new SNSClient(AWS_CREDS);
}

export function createTestSqsClient(): SQSClient {
  return new SQSClient(AWS_CREDS);
}

export const QUEUE_URLS = {
  extraction:    "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/sea-extraction-queue",
  transactions:  "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/sea-transactions-queue",
  categorization:"http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/sea-categorization-queue",
  analytics:     "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/sea-analytics-queue",
  anomaly:       "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/sea-anomaly-queue",
  notifications: "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/sea-notifications-queue"
};

export const TABLE_NAMES = {
  uploadFiles:       "UploadFiles",
  extractedDocs:     "ExtractedDocs",
  transactions:      "Transactions",
  analyticsSummaries:"AnalyticsSummaries",
  anomalyDetections: "AnomalyDetections",
  notifications:     "Notifications",
  chatConversations: "ChatConversations"
};

export const TOPIC_ARN = "arn:aws:sns:us-east-1:000000000000:sea-events";

/**
 * Purge a queue before a test to ensure a clean state.
 */
export async function purgeQueue(sqs: SQSClient, queueUrl: string): Promise<void> {
  try {
    await sqs.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));
    await sleep(500);
  } catch {
    // Queue might already be empty — ignore
  }
}

/**
 * Poll a queue until a message matching the predicate arrives, or timeout.
 * Automatically deletes matched messages to keep queues clean between tests.
 */
export async function waitForMessage(
  sqs: SQSClient,
  queueUrl: string,
  predicate: (body: unknown) => boolean,
  timeoutMs = 15000
): Promise<unknown> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 2
      })
    );

    for (const msg of res.Messages ?? []) {
      try {
        const outer = JSON.parse(msg.Body ?? "{}") as { Message?: string };
        const inner = outer.Message ? JSON.parse(outer.Message) : outer;
        if (predicate(inner)) {
          // Clean up matched message
          if (msg.ReceiptHandle) {
            await sqs.send(
              new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: msg.ReceiptHandle })
            );
          }
          return inner;
        }
      } catch {
        // Skip malformed messages
      }
    }
  }

  throw new Error(`waitForMessage timed out after ${timeoutMs}ms on queue: ${queueUrl}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}