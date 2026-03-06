// File: services/extraction-service/src/domain/extraction.service.ts
import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

import { createLogger } from "@shared/logger";
import { getOrCreateCorrelationId } from "@shared/observability";

import { createDdbClient } from "../db/ddb.client";
import { ExtractedDocsRepo, ExtractedDocRecord } from "../db/extracteddocs.repo";

import {
  createTextractClient,
  createS3ClientForTextract,
  extractWithTextract
} from "../integrations/textract.extractor";
import { parseCSV } from "../integrations/csv.parser";
import { createSnsClient, publishEvent, mustGetEventsTopicArn } from "../integrations/sns.publisher";

import {
  UploadUploadedEvent,
  ExtractionCompletedEvent,
  ExtractionFailedEvent
} from "./events";

@Injectable()
export class ExtractionService {
  private readonly log = createLogger({ serviceName: "extraction-service" });

  private readonly repo = new ExtractedDocsRepo(
    createDdbClient(),
    mustGetEnv("DDB_EXTRACTED_DOCS_TABLE")
  );

  private readonly textract = createTextractClient();
  private readonly s3 = createS3ClientForTextract();
  private readonly sns = createSnsClient();
  private readonly eventsTopicArn = mustGetEventsTopicArn();

  /**
   * Entry point called by SqsConsumerService for each upload.uploaded.v1 event.
   */
  async processUpload(event: UploadUploadedEvent): Promise<void> {
    const correlationId = getOrCreateCorrelationId(event.correlationId);
    const now = new Date().toISOString();
    const extractedDocumentId = uuidv4();

    this.log.info(
      { correlationId, uploadFileId: event.uploadFileId, source: event.source, contentType: event.contentType },
      "Processing upload"
    );

    // ── Idempotency check ─────────────────────────────────────────────────
    // If a COMPLETED doc already exists for this uploadFileId, skip.
    // Handles SQS redeliveries after previous failures cleanly.
    const existing = await this.repo.getByUploadFileId(event.workspaceId, event.uploadFileId);
    if (existing?.status === "COMPLETED") {
      this.log.info(
        { correlationId, uploadFileId: event.uploadFileId, extractedDocumentId: existing.id },
        "Extraction already COMPLETED for this upload — skipping (idempotent)"
      );
      return;
    }
    // ─────────────────────────────────────────────────────────────────────

    // Write initial PROCESSING record
    const record: ExtractedDocRecord = {
      id: extractedDocumentId,
      workspaceId: event.workspaceId,
      uploadFileId: event.uploadFileId,
      status: "PROCESSING",
      source: event.source,
      extractionMethod: resolveExtractionMethod(event),
      fields: [],
      lineItems: [],
      warnings: [],
      createdAt: now,
      updatedAt: now
    };

    await this.repo.put(record);

    try {
      if (record.extractionMethod === "textract") {
        await this.runTextract(event, record, correlationId);
      } else {
        await this.runCsvParser(event, record, correlationId);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);

      this.log.error({ correlationId, uploadFileId: event.uploadFileId, err }, "Extraction failed");

      await this.repo.updateStatus(event.workspaceId, extractedDocumentId, "FAILED", reason);

      const failedEvt: ExtractionFailedEvent = {
        type: "extraction.failed.v1",
        occurredAt: new Date().toISOString(),
        correlationId,
        workspaceId: event.workspaceId,
        uploadFileId: event.uploadFileId,
        reason
      };

      await publishEvent(this.sns, {
        topicArn: this.eventsTopicArn,
        message: failedEvt,
        messageAttributes: {
          eventType: { DataType: "String", StringValue: failedEvt.type },
          workspaceId: { DataType: "String", StringValue: failedEvt.workspaceId },
          uploadFileId: { DataType: "String", StringValue: failedEvt.uploadFileId }
        }
      });

      throw err; // Re-throw so SQS consumer handles visibility timeout
    }
  }

  private async runTextract(
    event: UploadUploadedEvent,
    record: ExtractedDocRecord,
    correlationId: string
  ): Promise<void> {
    const result = await extractWithTextract({
      textract: this.textract,
      bucket: event.storageBucket,
      key: event.storageKey,
      contentType: event.contentType
    });

    // Update DDB with results
    const updatedRecord: ExtractedDocRecord = {
      ...record,
      status: "COMPLETED",
      fields: result.fields,
      lineItems: result.lineItems,
      warnings: result.warnings,
      updatedAt: new Date().toISOString()
    };

    await this.repo.put(updatedRecord);

    await this.publishCompleted(updatedRecord, event, correlationId);
  }

  private async runCsvParser(
    event: UploadUploadedEvent,
    record: ExtractedDocRecord,
    correlationId: string
  ): Promise<void> {
    const result = await parseCSV({
      s3: this.s3,
      bucket: event.storageBucket,
      key: event.storageKey
    });

    const updatedRecord: ExtractedDocRecord = {
      ...record,
      status: "COMPLETED",
      fields: result.fields,
      lineItems: result.lineItems,
      csvRowCount: result.rowCount,
      warnings: result.warnings,
      updatedAt: new Date().toISOString()
    };

    await this.repo.put(updatedRecord);

    await this.publishCompleted(updatedRecord, event, correlationId);
  }

  private async publishCompleted(
    record: ExtractedDocRecord,
    event: UploadUploadedEvent,
    correlationId: string
  ): Promise<void> {
    const completedEvt: ExtractionCompletedEvent = {
      type: "extraction.completed.v1",
      occurredAt: new Date().toISOString(),
      correlationId,
      workspaceId: record.workspaceId,
      uploadFileId: record.uploadFileId,
      extractedDocumentId: record.id,
      source: record.source,
      extractionMethod: record.extractionMethod,
      fields: record.fields,
      lineItems: record.lineItems,
      csvRowCount: record.csvRowCount,
      warnings: record.warnings
    };

    await publishEvent(this.sns, {
      topicArn: this.eventsTopicArn,
      message: completedEvt,
      messageAttributes: {
        eventType: { DataType: "String", StringValue: completedEvt.type },
        workspaceId: { DataType: "String", StringValue: completedEvt.workspaceId },
        uploadFileId: { DataType: "String", StringValue: completedEvt.uploadFileId },
        extractedDocumentId: { DataType: "String", StringValue: completedEvt.extractedDocumentId }
      }
    });

    this.log.info(
      {
        correlationId,
        uploadFileId: record.uploadFileId,
        extractedDocumentId: record.id,
        extractionMethod: record.extractionMethod,
        fieldCount: record.fields.length,
        lineItemCount: record.lineItems.length
      },
      "Extraction completed — event published"
    );
  }

  // ── Query helpers (used by ExtractionController) ─────────────────────────

  async getByUploadFileId(workspaceId: string, uploadFileId: string) {
    return this.repo.getByUploadFileId(workspaceId, uploadFileId);
  }

  async getById(workspaceId: string, extractedDocumentId: string) {
    return this.repo.get(workspaceId, extractedDocumentId);
  }

  async list(workspaceId: string) {
    return this.repo.listByWorkspace(workspaceId);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveExtractionMethod(event: UploadUploadedEvent): "textract" | "csv_parser" {
  if (event.source === "bank_csv") return "csv_parser";

  const ct = event.contentType.toLowerCase();
  if (ct === "text/csv" || ct === "application/csv") return "csv_parser";

  // receipt / image / PDF → Textract
  return "textract";
}

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}