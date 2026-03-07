// File: services/categorization-service/src/domain/categorization.service.ts
import { Injectable } from "@nestjs/common";

import { createLogger } from "@shared/logger";
import { getOrCreateCorrelationId } from "@shared/observability";

import { applyRules } from "./rules.engine";
import { createBedrockClient, classifyWithBedrock } from "../integrations/bedrock.classifier";
import { createSnsClient, publishEvent, mustGetEventsTopicArn } from "../integrations/sns.publisher";

import type {
  TransactionUpsertedEvent,
  CategorizationCompletedEvent,
  CategorizationMethod
} from "./events";

@Injectable()
export class CategorizationService {
  private readonly log = createLogger({ serviceName: "categorization-service" });

  private readonly bedrock = createBedrockClient();
  private readonly sns = createSnsClient();
  private readonly eventsTopicArn = mustGetEventsTopicArn();

  /**
   * Entry point called by SqsConsumerService for each transaction.upserted.v1 event.
   *
   * Logic:
   * 1. Skip DELETED operations
   * 2. Skip if user manually overrode the category (categoryOverriddenByUserId present in snapshot)
   * 3. Try rules engine first
   * 4. Fall back to Bedrock LLM if no rule matched
   * 5. Publish categorization.completed.v1
   */
  async handleTransactionUpserted(event: TransactionUpsertedEvent): Promise<void> {
    const correlationId = getOrCreateCorrelationId(event.correlationId);

    // 1) Skip deleted transactions
    if (event.operation === "DELETED") {
      this.log.info(
        { correlationId, transactionId: event.transactionId },
        "Skipping DELETED transaction"
      );
      return;
    }

    const { merchant, amount, currency, category } = event.snapshot;

    // 2) Skip if user manually overrode the category
    // The snapshot carries the current category — if it was set by a
    // category.overridden event, we respect it and don't re-categorize.
    // We detect this by checking if category exists on an UPDATED event
    // (transactions-service sets categoryOverriddenByUserId on override,
    // but we only have the snapshot here — so we skip UPDATED if category already set)
    if (event.operation === "UPDATED" && category) {
      this.log.info(
        { correlationId, transactionId: event.transactionId, category },
        "Skipping UPDATED transaction — category already set (respecting user override)"
      );
      return;
    }

    this.log.info(
      { correlationId, transactionId: event.transactionId, merchant, operation: event.operation },
      "Categorizing transaction"
    );

    // 3) Try rules engine
    const ruleMatch = applyRules(merchant);

    let resultCategory: string;
    let resultConfidence: number;
    let method: "rules" | "llm" | "fallback";

    if (ruleMatch) {
      resultCategory = ruleMatch.category;
      resultConfidence = ruleMatch.confidence;
      method = "rules";

      this.log.info(
        { correlationId, transactionId: event.transactionId, category: resultCategory, confidence: resultConfidence },
        "Categorized by rules engine"
      );
    } else {
      // 4) Fall back to Bedrock LLM
      this.log.info(
        { correlationId, transactionId: event.transactionId, merchant },
        "No rule matched — falling back to Bedrock LLM"
      );

      try {
        const bedrockResult = await classifyWithBedrock({
          client: this.bedrock,
          merchant,
          amount,
          currency
        });

        resultCategory = bedrockResult.category;
        resultConfidence = bedrockResult.confidence;
        method = "llm";

        this.log.info(
          { correlationId, transactionId: event.transactionId, category: resultCategory, confidence: resultConfidence },
          "Categorized by Bedrock LLM"
        );
      } catch (err) {
        // If Bedrock fails, fall back to "Other"
        this.log.error(
          { correlationId, transactionId: event.transactionId, err },
          "Bedrock classification failed — defaulting to Other"
        );
        resultCategory = "Other";
        resultConfidence = 0.3;
        method = "fallback";
      }
    }

    // 5) Publish categorization.completed.v1
    const evt: CategorizationCompletedEvent = {
      type: "categorization.completed.v1",
      occurredAt: new Date().toISOString(),
      correlationId,
      workspaceId: event.workspaceId,
      transactionId: event.transactionId,
      category: resultCategory,
      confidence: resultConfidence,
      method
    };

    await publishEvent(this.sns, {
      topicArn: this.eventsTopicArn,
      message: evt,
      messageAttributes: {
        eventType: { DataType: "String", StringValue: evt.type },
        workspaceId: { DataType: "String", StringValue: evt.workspaceId },
        transactionId: { DataType: "String", StringValue: evt.transactionId },
        method: { DataType: "String", StringValue: evt.method }
      }
    });

    this.log.info(
      { correlationId, transactionId: event.transactionId, category: resultCategory, method },
      "categorization.completed.v1 published"
    );
  }
}