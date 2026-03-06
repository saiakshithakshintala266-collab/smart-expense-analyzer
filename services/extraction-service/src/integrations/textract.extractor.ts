// File: services/extraction-service/src/integrations/textract.extractor.ts
import {
  TextractClient,
  AnalyzeExpenseCommand,
  AnalyzeExpenseCommandInput,
  ExpenseDocument
} from "@aws-sdk/client-textract";
import { S3Client } from "@aws-sdk/client-s3";
import { createLogger } from "@shared/logger";
import { ExtractedField, ExtractedLineItem } from "../domain/events";

const log = createLogger({ serviceName: "extraction-service" });

export function createTextractClient(): TextractClient {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  return new TextractClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    ...(endpoint ? { endpoint } : {})
  });
}

export function createS3ClientForTextract(): S3Client {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  return new S3Client({
    region: process.env.AWS_REGION ?? "us-east-1",
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "false").toLowerCase() === "true",
    ...(endpoint ? { endpoint } : {})
  });
}

export type TextractResult = {
  fields: ExtractedField[];
  lineItems: ExtractedLineItem[];
  warnings: string[];
};

/**
 * Uses Textract AnalyzeExpense (synchronous) for receipts/images/PDFs.
 *
 * LOCAL DEV: Textract is a LocalStack Pro feature so we return mock data
 * whenever AWS_ENDPOINT_URL is set (i.e. pointing at LocalStack).
 * On real AWS the full Textract path runs.
 */
export async function extractWithTextract(input: {
  textract: TextractClient;
  bucket: string;
  key: string;
  contentType: string;
}): Promise<TextractResult> {

  // ── LocalStack mock bypass ──────────────────────────────────────────────
  if (process.env.AWS_ENDPOINT_URL) {
    log.warn(
      { bucket: input.bucket, key: input.key },
      "LocalStack detected — returning mock Textract result (Textract is a Pro feature)"
    );
    return {
      fields: [
        { key: "vendor_name",          value: "Mock Merchant (LocalStack)", confidence: 0.99 },
        { key: "total",                value: "42.00",                      confidence: 0.95 },
        { key: "currency",             value: "USD",                        confidence: 0.99 },
        { key: "invoice_receipt_date", value: new Date().toISOString().slice(0, 10), confidence: 0.90 },
        { key: "tax",                  value: "3.50",                       confidence: 0.88 }
      ],
      lineItems: [
        { description: "Mock Item 1", quantity: 1, unitPrice: 20.00, totalPrice: 20.00, confidence: 0.95 },
        { description: "Mock Item 2", quantity: 2, unitPrice: 11.00, totalPrice: 22.00, confidence: 0.92 }
      ],
      warnings: ["mock_textract_localstack"]
    };
  }

  // ── Real Textract (AWS) ─────────────────────────────────────────────────
  const params: AnalyzeExpenseCommandInput = {
    Document: {
      S3Object: {
        Bucket: input.bucket,
        Name: input.key
      }
    }
  };

  log.info({ bucket: input.bucket, key: input.key }, "Calling Textract AnalyzeExpense");

  const res = await input.textract.send(new AnalyzeExpenseCommand(params));

  const docs = res.ExpenseDocuments ?? [];

  if (docs.length === 0) {
    return { fields: [], lineItems: [], warnings: ["Textract returned no expense documents"] };
  }

  const doc = docs[0];
  const warnings: string[] = [];

  if (docs.length > 1) {
    warnings.push(`Textract found ${docs.length} expense documents — only first used`);
  }

  const fields = extractSummaryFields(doc);
  const lineItems = extractLineItems(doc);

  return { fields, lineItems, warnings };
}

function extractSummaryFields(doc: ExpenseDocument): ExtractedField[] {
  const fields: ExtractedField[] = [];

  for (const group of doc.SummaryFields ?? []) {
    const key = group.Type?.Text?.toLowerCase() ?? "unknown";
    const value = group.ValueDetection?.Text ?? "";
    const confidence = group.ValueDetection?.Confidence
      ? group.ValueDetection.Confidence / 100
      : undefined;

    if (value) {
      fields.push({ key, value, confidence });
    }
  }

  return fields;
}

function extractLineItems(doc: ExpenseDocument): ExtractedLineItem[] {
  const items: ExtractedLineItem[] = [];

  for (const group of doc.LineItemGroups ?? []) {
    for (const row of group.LineItems ?? []) {
      const item: ExtractedLineItem = {};
      let minConfidence = 1;

      for (const field of row.LineItemExpenseFields ?? []) {
        const type = field.Type?.Text?.toLowerCase() ?? "";
        const text = field.ValueDetection?.Text ?? "";
        const conf = field.ValueDetection?.Confidence
          ? field.ValueDetection.Confidence / 100
          : 1;

        minConfidence = Math.min(minConfidence, conf);

        switch (type) {
          case "item":
          case "product_code":
            item.description = text;
            break;
          case "quantity":
            item.quantity = parseFloat(text) || undefined;
            break;
          case "unit_price":
            item.unitPrice = parseFloat(text.replace(/[^0-9.]/g, "")) || undefined;
            break;
          case "price":
            item.totalPrice = parseFloat(text.replace(/[^0-9.]/g, "")) || undefined;
            break;
        }
      }

      item.confidence = minConfidence;

      if (item.description || item.totalPrice) {
        items.push(item);
      }
    }
  }

  return items;
}