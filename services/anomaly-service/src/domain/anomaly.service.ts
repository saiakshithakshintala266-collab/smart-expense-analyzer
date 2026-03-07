// File: services/anomaly-service/src/domain/anomaly.service.ts
import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

import { createLogger } from "@shared/logger";
import { getOrCreateCorrelationId } from "@shared/observability";

import { createDdbClient } from "../db/ddb.client";
import { AnomalyRepo, normalizeMerchant } from "../db/anomaly.repo";
import { createSnsClient, publishEvent, mustGetEventsTopicArn } from "../integrations/sns.publisher";

import {
  TransactionUpsertedEvent,
  AnomalyDetectedEvent
} from "./events";

import {
  detectDuplicate,
  detectUnusuallyLargeAmount,
  detectRapidRepeat,
  detectLargeRoundNumber,
  detectFirstTimeMerchant,
  detectCategorySpendSpike,
  DetectionResult
} from "./detectors";

@Injectable()
export class AnomalyService {
  private readonly log = createLogger({ serviceName: "anomaly-service" });

  private readonly repo = new AnomalyRepo(
    createDdbClient(),
    mustGetEnv("DDB_ANOMALY_TABLE")
  );

  private readonly sns = createSnsClient();
  private readonly eventsTopicArn = mustGetEventsTopicArn();

  async handleTransactionUpserted(event: TransactionUpsertedEvent): Promise<void> {
    const correlationId = getOrCreateCorrelationId(event.correlationId);

    // Only process CREATED transactions
    if (event.operation !== "CREATED") {
      this.log.info(
        { correlationId, transactionId: event.transactionId, operation: event.operation },
        "Skipping non-CREATED transaction"
      );
      return;
    }

    const { snapshot, workspaceId, transactionId } = event;
    const now = new Date().toISOString();

    const tx = {
      transactionId,
      workspaceId,
      merchant: snapshot.merchant,
      amount: snapshot.amount,
      currency: snapshot.currency,
      date: snapshot.date,
      category: snapshot.category,
      occurredAt: now
    };

    this.log.info(
      { correlationId, transactionId, merchant: tx.merchant, amount: tx.amount },
      "Running anomaly detectors"
    );

    // Run all detectors in parallel
    const [duplicate, largeAmount, rapidRepeat, firstTime, categorySpike] = await Promise.all([
      detectDuplicate(this.repo, tx),
      detectUnusuallyLargeAmount(this.repo, tx),
      detectRapidRepeat(this.repo, tx),
      detectFirstTimeMerchant(this.repo, tx),
      detectCategorySpendSpike(this.repo, tx)
    ]);

    // Sync detector (no async needed)
    const roundNumber = detectLargeRoundNumber(tx);

    const detections = [duplicate, largeAmount, rapidRepeat, roundNumber, firstTime, categorySpike]
      .filter((d): d is DetectionResult & NonNullable<DetectionResult> => d !== null);

    this.log.info(
      { correlationId, transactionId, detectionCount: detections.length },
      `Found ${detections.length} anomalie(s)`
    );

    // Index this transaction for future duplicate/rapid-repeat detection
    await this.repo.indexTransaction(workspaceId, {
      transactionId,
      merchant: tx.merchant,
      merchantNormalized: normalizeMerchant(tx.merchant),
      amount: tx.amount,
      date: tx.date,
      occurredAt: now
    });

    // Update category spend index
    if (snapshot.category) {
      const yearMonth = tx.date.slice(0, 7);
      await this.repo.incrementCategorySpend(workspaceId, yearMonth, snapshot.category, tx.amount);
    }

    // Save and publish each anomaly
    for (const detection of detections) {
      const anomalyId = uuidv4();

      await this.repo.saveAnomaly({
        anomalyId,
        workspaceId,
        transactionId,
        anomalyType: detection.anomalyType,
        severity: detection.severity,
        description: detection.description,
        metadata: detection.metadata,
        status: "OPEN",
        createdAt: now
      });

      const evt: AnomalyDetectedEvent = {
        type: "anomaly.detected.v1",
        occurredAt: now,
        correlationId,
        workspaceId,
        anomalyId,
        transactionId,
        anomalyType: detection.anomalyType,
        severity: detection.severity,
        description: detection.description,
        metadata: detection.metadata
      };

      await publishEvent(this.sns, {
        topicArn: this.eventsTopicArn,
        message: evt,
        messageAttributes: {
          eventType: { DataType: "String", StringValue: evt.type },
          workspaceId: { DataType: "String", StringValue: evt.workspaceId },
          anomalyType: { DataType: "String", StringValue: evt.anomalyType },
          severity: { DataType: "String", StringValue: evt.severity }
        }
      });

      this.log.info(
        { correlationId, transactionId, anomalyId, anomalyType: detection.anomalyType, severity: detection.severity },
        "Anomaly detected, saved and published"
      );
    }
  }

  // ── HTTP ──────────────────────────────────────────────────────────────────

  async listAnomalies(workspaceId: string, status?: "OPEN" | "DISMISSED") {
    return this.repo.listAnomalies(workspaceId, { status });
  }
}

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}