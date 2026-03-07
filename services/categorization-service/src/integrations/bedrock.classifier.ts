// File: services/categorization-service/src/integrations/bedrock.classifier.ts
import {
  BedrockRuntimeClient,
  InvokeModelCommand
} from "@aws-sdk/client-bedrock-runtime";
import { createLogger } from "@shared/logger";
import { Category, ALL_CATEGORIES } from "../domain/rules.engine";

const log = createLogger({ serviceName: "categorization-service" });

const MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0";

export function createBedrockClient(): BedrockRuntimeClient {
  // Bedrock is not available in LocalStack — client is only used on real AWS
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? "us-east-1"
    // No endpoint override — Bedrock must hit real AWS
  });
}

export type BedrockResult = {
  category: Category;
  confidence: number;
};

/**
 * Uses Claude Haiku via Bedrock to classify a transaction into a category.
 *
 * LOCAL DEV: Returns "Other" with low confidence when AWS_ENDPOINT_URL is set
 * (LocalStack environment) since Bedrock is not available locally.
 */
export async function classifyWithBedrock(input: {
  client: BedrockRuntimeClient;
  merchant: string;
  amount: number;
  currency: string;
}): Promise<BedrockResult> {

  // ── LocalStack mock bypass ────────────────────────────────────────────────
  if (process.env.AWS_ENDPOINT_URL) {
    log.warn(
      { merchant: input.merchant },
      "LocalStack detected — returning mock Bedrock result (Bedrock not available locally)"
    );
    return { category: "Other", confidence: 0.5 };
  }

  // ── Real Bedrock (AWS) ────────────────────────────────────────────────────
  const categoriesList = ALL_CATEGORIES.join(", ");

  const prompt = `You are a financial transaction categorizer.

Categorize the following transaction into exactly one of these categories:
${categoriesList}

Transaction:
- Merchant: ${input.merchant}
- Amount: ${input.currency} ${input.amount}

Rules:
1. Reply with ONLY a JSON object, no explanation, no markdown.
2. Format: {"category": "<category>", "confidence": <0.0-1.0>}
3. confidence should reflect how certain you are (0.9+ for obvious matches, 0.6-0.8 for likely, below 0.6 for guesses)
4. If genuinely uncertain, use "Other" with low confidence.`;

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 100,
    messages: [{ role: "user", content: prompt }]
  });

  log.info({ merchant: input.merchant, modelId: MODEL_ID }, "Calling Bedrock for categorization");

  const res = await input.client.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: Buffer.from(body)
    })
  );

  const responseBody = JSON.parse(Buffer.from(res.body).toString("utf-8"));
  const text: string = responseBody.content?.[0]?.text ?? "";

  try {
    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as { category: string; confidence: number };

    // Validate category is one of our known categories
    const category = ALL_CATEGORIES.includes(parsed.category as Category)
      ? (parsed.category as Category)
      : "Other";

    const confidence = typeof parsed.confidence === "number"
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0.6;

    log.info({ merchant: input.merchant, category, confidence }, "Bedrock categorization result");

    return { category, confidence };
  } catch {
    log.warn({ merchant: input.merchant, text }, "Failed to parse Bedrock response — defaulting to Other");
    return { category: "Other", confidence: 0.4 };
  }
}