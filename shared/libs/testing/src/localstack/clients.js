"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOPIC_ARN = exports.TABLE_NAMES = exports.QUEUE_URLS = void 0;
exports.createTestDdbClient = createTestDdbClient;
exports.createTestSnsClient = createTestSnsClient;
exports.createTestSqsClient = createTestSqsClient;
exports.purgeQueue = purgeQueue;
exports.waitForMessage = waitForMessage;
exports.sleep = sleep;
// File: shared/libs/testing/src/localstack/clients.ts
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const client_sns_1 = require("@aws-sdk/client-sns");
const client_sqs_1 = require("@aws-sdk/client-sqs");
const LOCALSTACK_ENDPOINT = "http://localhost:4566";
const REGION = "us-east-1";
const AWS_CREDS = {
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    region: REGION,
    endpoint: LOCALSTACK_ENDPOINT
};
function createTestDdbClient() {
    return new client_dynamodb_1.DynamoDBClient(AWS_CREDS);
}
function createTestSnsClient() {
    return new client_sns_1.SNSClient(AWS_CREDS);
}
function createTestSqsClient() {
    return new client_sqs_1.SQSClient(AWS_CREDS);
}
exports.QUEUE_URLS = {
    extraction: "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/sea-extraction-queue",
    transactions: "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/sea-transactions-queue",
    categorization: "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/sea-categorization-queue",
    analytics: "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/sea-analytics-queue",
    anomaly: "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/sea-anomaly-queue",
    notifications: "http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/sea-notifications-queue"
};
exports.TABLE_NAMES = {
    uploadFiles: "UploadFiles",
    extractedDocs: "ExtractedDocs",
    transactions: "Transactions",
    analyticsSummaries: "AnalyticsSummaries",
    anomalyDetections: "AnomalyDetections",
    notifications: "Notifications",
    chatConversations: "ChatConversations"
};
exports.TOPIC_ARN = "arn:aws:sns:us-east-1:000000000000:sea-events";
/**
 * Purge a queue before a test to ensure a clean state.
 */
async function purgeQueue(sqs, queueUrl) {
    try {
        await sqs.send(new client_sqs_1.PurgeQueueCommand({ QueueUrl: queueUrl }));
        await sleep(500);
    }
    catch {
        // Queue might already be empty — ignore
    }
}
/**
 * Poll a queue until a message matching the predicate arrives, or timeout.
 * Automatically deletes matched messages to keep queues clean between tests.
 */
async function waitForMessage(sqs, queueUrl, predicate, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const res = await sqs.send(new client_sqs_1.ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 2
        }));
        for (const msg of res.Messages ?? []) {
            try {
                const outer = JSON.parse(msg.Body ?? "{}");
                const inner = outer.Message ? JSON.parse(outer.Message) : outer;
                if (predicate(inner)) {
                    // Clean up matched message
                    if (msg.ReceiptHandle) {
                        await sqs.send(new client_sqs_1.DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: msg.ReceiptHandle }));
                    }
                    return inner;
                }
            }
            catch {
                // Skip malformed messages
            }
        }
    }
    throw new Error(`waitForMessage timed out after ${timeoutMs}ms on queue: ${queueUrl}`);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=clients.js.map