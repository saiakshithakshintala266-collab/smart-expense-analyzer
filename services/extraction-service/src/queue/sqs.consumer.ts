// File: services/extraction-service/src/queue/sqs.consumer.ts
import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand
} from "@aws-sdk/client-sqs";
import { createLogger } from "@shared/logger";
import { ExtractionService } from "../domain/extraction.service";
import { UploadUploadedEvent } from "../domain/events";

@Injectable()
export class SqsConsumerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = createLogger({ serviceName: "extraction-service" });
  private readonly sqs: SQSClient;
  private readonly queueUrl: string;
  private running = false;

  constructor(private readonly extractionService: ExtractionService) {
    const endpoint = process.env.AWS_ENDPOINT_URL;
    this.sqs = new SQSClient({
      region: process.env.AWS_REGION ?? "us-east-1",
      ...(endpoint ? { endpoint } : {})
    });
    this.queueUrl = mustGetEnv("SQS_EXTRACTION_QUEUE_URL");
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
            WaitTimeSeconds: 20, // long-polling
            VisibilityTimeout: 60,
            MessageAttributeNames: ["All"],
            AttributeNames: ["All"]
          })
        );

        const messages = res.Messages ?? [];

        for (const msg of messages) {
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

    let event: UploadUploadedEvent | null = null;

    try {
      // SNS wraps the message in an envelope when delivered to SQS
      const outer = JSON.parse(body) as { Message?: string; Type?: string };
      const inner = outer.Message ? JSON.parse(outer.Message) : JSON.parse(body);
      event = inner as UploadUploadedEvent;

      if (event.type !== "upload.uploaded.v1") {
        this.log.warn({ eventType: event.type }, "Skipping unknown event type");
        await this.deleteMessage(receiptHandle);
        return;
      }

      await this.extractionService.processUpload(event);
      await this.deleteMessage(receiptHandle);

      this.log.info(
        { uploadFileId: event.uploadFileId, workspaceId: event.workspaceId },
        "Message processed and deleted"
      );
    } catch (err) {
      this.log.error(
        { err, uploadFileId: event?.uploadFileId },
        "Failed to process message — returning to queue"
      );

      // Shorten visibility so it retries sooner (default backoff)
      if (receiptHandle) {
        await this.sqs
          .send(
            new ChangeMessageVisibilityCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: receiptHandle,
              VisibilityTimeout: 10
            })
          )
          .catch(() => {});
      }
    }
  }

  private async deleteMessage(receiptHandle: string): Promise<void> {
    await this.sqs.send(
      new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle
      })
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