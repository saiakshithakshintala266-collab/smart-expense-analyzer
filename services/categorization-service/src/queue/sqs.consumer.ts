// File: services/categorization-service/src/queue/sqs.consumer.ts
import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand
} from "@aws-sdk/client-sqs";
import { createLogger } from "@shared/logger";
import { CategorizationService } from "../domain/categorization.service";
import { TransactionUpsertedEvent } from "../domain/events";

@Injectable()
export class SqsConsumerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = createLogger({ serviceName: "categorization-service" });
  private readonly sqs: SQSClient;
  private readonly queueUrl: string;
  private running = false;

  constructor(private readonly categorizationService: CategorizationService) {
    const endpoint = process.env.AWS_ENDPOINT_URL;
    this.sqs = new SQSClient({
      region: process.env.AWS_REGION ?? "us-east-1",
      ...(endpoint ? { endpoint } : {})
    });
    this.queueUrl = mustGetEnv("SQS_CATEGORIZATION_QUEUE_URL");
  }

  onApplicationBootstrap(): void {
    this.running = true;
    void this.poll();
    this.log.info({ queueUrl: this.queueUrl }, "SQS consumer started");
  }

  onApplicationShutdown(): void {
    this.running = false;
    this.log.info("SQS consumer stopping");
  }

  private async poll(): Promise<void> {
    while (this.running) {
      try {
        const res = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 5,
            WaitTimeSeconds: 20,
            VisibilityTimeout: 60,
            MessageAttributeNames: ["All"],
            AttributeNames: ["All"]
          })
        );

        for (const msg of res.Messages ?? []) {
          if (!this.running) break;
          await this.handleMessage(msg.Body, msg.ReceiptHandle);
        }
      } catch (err) {
        if (this.running) {
          this.log.error({ err }, "SQS poll error — retrying in 5s");
          await sleep(5000);
        }
      }
    }
  }

  private async handleMessage(body: string | undefined, receiptHandle: string | undefined): Promise<void> {
    if (!body || !receiptHandle) return;

    let event: TransactionUpsertedEvent | null = null;

    try {
      const outer = JSON.parse(body) as { Message?: string };
      const inner = outer.Message ? JSON.parse(outer.Message) : JSON.parse(body);
      event = inner as TransactionUpsertedEvent;

      if (event.type !== "transaction.upserted.v1") {
        this.log.warn({ eventType: event.type }, "Skipping unknown event type");
        await this.deleteMessage(receiptHandle);
        return;
      }

      await this.categorizationService.handleTransactionUpserted(event);
      await this.deleteMessage(receiptHandle);

      this.log.info(
        { transactionId: event.transactionId, operation: event.operation },
        "Message processed and deleted"
      );
    } catch (err) {
      this.log.error({ err, transactionId: event?.transactionId }, "Failed to process message");

      if (receiptHandle) {
        await this.sqs
          .send(new ChangeMessageVisibilityCommand({
            QueueUrl: this.queueUrl,
            ReceiptHandle: receiptHandle,
            VisibilityTimeout: 10
          }))
          .catch(() => {});
      }
    }
  }

  private async deleteMessage(receiptHandle: string): Promise<void> {
    await this.sqs.send(
      new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: receiptHandle })
    );
  }
}

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}