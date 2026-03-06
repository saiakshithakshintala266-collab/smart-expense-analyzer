// File: services/transactions-service/src/domain/transactions.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

import { createLogger } from "@shared/logger";
import { getOrCreateCorrelationId } from "@shared/observability";

import { createDdbClient } from "../db/ddb.client";
import { TransactionsRepo, TransactionRecord, TransactionSource } from "../db/transactions.repo";
import { createSnsClient, publishEvent, mustGetEventsTopicArn } from "../integrations/sns.publisher";

import {
  ExtractionCompletedEvent,
  TransactionUpsertedEvent,
  TransactionCategoryOverriddenEvent
} from "./events";
import { normalizeExtraction } from "./normalizer";

@Injectable()
export class TransactionsService {
  private readonly log = createLogger({ serviceName: "transactions-service" });

  private readonly repo = new TransactionsRepo(
    createDdbClient(),
    mustGetEnv("DDB_TRANSACTIONS_TABLE")
  );

  private readonly sns = createSnsClient();
  private readonly eventsTopicArn = mustGetEventsTopicArn();

  // ── Event handler ─────────────────────────────────────────────────────────

  async handleExtractionCompleted(event: ExtractionCompletedEvent): Promise<void> {
    const correlationId = getOrCreateCorrelationId(event.correlationId);
    const now = new Date().toISOString();

    this.log.info(
      { correlationId, extractedDocumentId: event.extractedDocumentId, source: event.source },
      "Handling extraction.completed.v1"
    );

    // Idempotency — skip if already processed this extraction
    const existing = await this.repo.getByExtractedDocumentId(
      event.extractedDocumentId
    );

    if (existing) {
      this.log.info(
        { correlationId, extractedDocumentId: event.extractedDocumentId },
        "Transaction already exists for this extraction — skipping (idempotent)"
      );
      return;
    }

    const records = normalizeExtraction(event, uuidv4, now);

    this.log.info({ correlationId, count: records.length, source: event.source }, "Normalized transactions");

    for (const record of records) {
      await this.repo.put(record);
      await this.publishUpserted(record, "CREATED", correlationId);
    }
  }

  // ── HTTP operations ───────────────────────────────────────────────────────

  async getTransaction(workspaceId: string, transactionId: string): Promise<TransactionRecord> {
    const record = await this.repo.get(workspaceId, transactionId);
    if (!record || record.status === "DELETED") throw new NotFoundException("Transaction not found");
    return record;
  }

  async listTransactions(
    workspaceId: string,
    opts: {
      dateFrom?: string;
      dateTo?: string;
      category?: string;
      source?: TransactionSource;
      limit?: number;
      nextPageToken?: string;
    }
  ) {
    return this.repo.listByWorkspace(workspaceId, { ...opts, status: "ACTIVE" });
  }

  async correctTransaction(
    workspaceId: string,
    transactionId: string,
    actorUserId: string,
    correlationId: string,
    patch: { merchantOverride?: string; notes?: string; category?: string }
  ): Promise<TransactionRecord> {
    const cid = getOrCreateCorrelationId(correlationId);
    const record = await this.repo.get(workspaceId, transactionId);
    if (!record || record.status === "DELETED") throw new NotFoundException("Transaction not found");

    const isCategoryOverride = patch.category !== undefined && patch.category !== record.category;
    const now = new Date().toISOString();

    await this.repo.updateCorrections(workspaceId, transactionId, {
      ...patch,
      ...(isCategoryOverride
        ? { categoryOverriddenByUserId: actorUserId, categoryOverriddenAt: now }
        : {})
    });

    const updated = await this.repo.get(workspaceId, transactionId);
    if (!updated) throw new NotFoundException("Transaction not found after update");

    await this.publishUpserted(updated, "UPDATED", cid);

    if (isCategoryOverride) {
      await this.publishCategoryOverridden({
        record: updated,
        previousCategory: record.category,
        newCategory: patch.category!,
        overriddenByUserId: actorUserId,
        correlationId: cid
      });
    }

    this.log.info({ correlationId: cid, workspaceId, transactionId, patch }, "Transaction corrected");
    return updated;
  }

  async deleteTransaction(
    workspaceId: string,
    transactionId: string,
    actorUserId: string,
    correlationId: string
  ): Promise<void> {
    const cid = getOrCreateCorrelationId(correlationId);
    const record = await this.repo.get(workspaceId, transactionId);
    if (!record || record.status === "DELETED") throw new NotFoundException("Transaction not found");

    await this.repo.softDelete(workspaceId, transactionId);
    await this.publishUpserted({ ...record, status: "DELETED" }, "DELETED", cid);

    this.log.info({ correlationId: cid, workspaceId, transactionId, actorUserId }, "Transaction deleted");
  }

  async createManual(
    workspaceId: string,
    actorUserId: string,
    correlationId: string,
    input: { merchant: string; amount: number; currency: string; date: string; category?: string; notes?: string }
  ): Promise<TransactionRecord> {
    const cid = getOrCreateCorrelationId(correlationId);
    const now = new Date().toISOString();

    const record: TransactionRecord = {
      id: uuidv4(),
      workspaceId,
      source: "manual",
      merchant: input.merchant,
      amount: input.amount,
      currency: input.currency,
      date: input.date,
      category: input.category,
      notes: input.notes,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now
    };

    await this.repo.put(record);
    await this.publishUpserted(record, "CREATED", cid);

    this.log.info({ correlationId: cid, workspaceId, transactionId: record.id }, "Manual transaction created");
    return record;
  }

  // ── Publishers ────────────────────────────────────────────────────────────

  private async publishUpserted(
    record: TransactionRecord,
    operation: "CREATED" | "UPDATED" | "DELETED",
    correlationId: string
  ): Promise<void> {
    const evt: TransactionUpsertedEvent = {
      type: "transaction.upserted.v1",
      occurredAt: new Date().toISOString(),
      correlationId,
      workspaceId: record.workspaceId,
      transactionId: record.id,
      operation,
      snapshot: {
        merchant: record.merchantOverride ?? record.merchant,
        amount: record.amount,
        currency: record.currency,
        date: record.date,
        category: record.category,
        source: record.source,
        uploadFileId: record.uploadFileId,
        extractedDocumentId: record.extractedDocumentId
      }
    };

    await publishEvent(this.sns, {
      topicArn: this.eventsTopicArn,
      message: evt,
      messageAttributes: {
        eventType: { DataType: "String", StringValue: evt.type },
        workspaceId: { DataType: "String", StringValue: evt.workspaceId },
        transactionId: { DataType: "String", StringValue: evt.transactionId },
        operation: { DataType: "String", StringValue: evt.operation }
      }
    });
  }

  private async publishCategoryOverridden(input: {
    record: TransactionRecord;
    previousCategory: string | undefined;
    newCategory: string;
    overriddenByUserId: string;
    correlationId: string;
  }): Promise<void> {
    const evt: TransactionCategoryOverriddenEvent = {
      type: "transaction.category.overridden.v1",
      occurredAt: new Date().toISOString(),
      correlationId: input.correlationId,
      workspaceId: input.record.workspaceId,
      transactionId: input.record.id,
      previousCategory: input.previousCategory,
      newCategory: input.newCategory,
      overriddenByUserId: input.overriddenByUserId
    };

    await publishEvent(this.sns, {
      topicArn: this.eventsTopicArn,
      message: evt,
      messageAttributes: {
        eventType: { DataType: "String", StringValue: evt.type },
        workspaceId: { DataType: "String", StringValue: evt.workspaceId },
        transactionId: { DataType: "String", StringValue: evt.transactionId }
      }
    });
  }
}

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}