// File: services/extraction-service/src/integrations/bedrock.enricher.ts
import {
  BedrockRuntimeClient,
  InvokeModelCommand
} from "@aws-sdk/client-bedrock-runtime";
import { createLogger } from "@shared/logger";
import { ExtractedField, ExtractedLineItem } from "../domain/events";

const log = createLogger({ serviceName: "extraction-service" });

const MODEL_ID = "anthropic.claude-3-5-haiku-20241022-v1:0";

export type EnrichedFields = {
  merchant?: string;
  date?: string;       // ISO YYYY-MM-DD
  amount?: number;
  currency?: string;   // 3-letter code
  category?: string;
  confidence: number;
};

export function createBedrockClient(): BedrockRuntimeClient {
  // Bedrock must always hit real AWS — no endpoint override
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? "us-east-1"
  });
}

/**
 * Sends raw Textract output to Claude Haiku for normalisation.
 *
 * Returns enriched fields that are merged alongside the raw Textract fields
 * in the ExtractionCompletedEvent so downstream services (transactions,
 * categorization) get clean, structured data without a separate API call.
 *
 * Failures are non-fatal: if Bedrock is unavailable the extraction still
 * completes with raw Textract fields only.
 */
export async function enrichWithClaude(input: {
  bedrock: BedrockRuntimeClient;
  rawFields: ExtractedField[];
  rawLineItems: ExtractedLineItem[];
  source: string;
}): Promise<EnrichedFields> {
  const rawFieldsText = input.rawFields
    .map(f => `${f.key}: ${f.value}${f.confidence != null ? ` (confidence: ${f.confidence.toFixed(2)})` : ""}`)
    .join("\n");

  const lineItemsText = input.rawLineItems.length > 0
    ? `\nLine items (${input.rawLineItems.length} total, showing first 10):\n` +
      input.rawLineItems.slice(0, 10)
        .map(li => `  - ${li.description ?? "?"}: ${li.totalPrice ?? "?"}${li.date ? ` on ${li.date}` : ""}`)
        .join("\n")
    : "";

  const prompt = `You are a financial document parser. Extract structured transaction fields from this raw Textract output.

Document type: ${input.source}

Raw extracted fields:
${rawFieldsText}${lineItemsText}

Return ONLY a JSON object with these fields (omit any you cannot confidently determine):
{
  "merchant": "clean, human-readable vendor name",
  "date": "YYYY-MM-DD",
  "amount": <total as a positive number>,
  "currency": "3-letter ISO code (default USD)",
  "category": "one of: Dining, Groceries, Transport, Entertainment, Healthcare, Shopping, Utilities, Travel, Subscriptions, Other",
  "confidence": <0.0–1.0>
}

Rules:
- merchant: strip location/store codes (e.g. "STARBUCKS #1234 SEATTLE WA" → "Starbucks")
- date: normalise any format to YYYY-MM-DD
- amount: final charged total (positive number)
- confidence: 0.9+ if most fields are clear, 0.6–0.8 if some ambiguity, <0.6 if guessing
- Reply with ONLY the JSON, no markdown fences, no explanation`;

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }]
  });

  log.info(
    { source: input.source, fieldCount: input.rawFields.length },
    "Calling Bedrock Claude Haiku for extraction enrichment"
  );

  try {
    const res = await input.bedrock.send(
      new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: Buffer.from(body)
      })
    );

    const responseBody = JSON.parse(Buffer.from(res.body).toString("utf-8"));
    const text: string = responseBody.content?.[0]?.text ?? "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as Partial<EnrichedFields>;

    log.info(
      { merchant: parsed.merchant, amount: parsed.amount, category: parsed.category, date: parsed.date },
      "Claude Haiku enrichment result"
    );

    return {
      merchant:   parsed.merchant,
      date:       parsed.date,
      amount:     typeof parsed.amount   === "number" ? parsed.amount   : undefined,
      currency:   parsed.currency ?? "USD",
      category:   parsed.category,
      confidence: typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.7
    };
  } catch (err) {
    log.warn({ err }, "Claude Haiku enrichment failed — extraction continues with raw Textract fields only");
    return { confidence: 0 };
  }
}
