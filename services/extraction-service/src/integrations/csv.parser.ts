// File: services/extraction-service/src/integrations/csv.parser.ts
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createLogger } from "@shared/logger";
import { ExtractedField, ExtractedLineItem } from "../domain/events";

const log = createLogger({ serviceName: "extraction-service" });

export type CsvParseResult = {
  fields: ExtractedField[];
  lineItems: ExtractedLineItem[];
  rowCount: number;
  warnings: string[];
};

/**
 * Downloads a CSV from S3 and parses it as a bank export.
 *
 * Supports common bank CSV column layouts:
 *   - date, description/merchant, amount, balance, type/category
 *
 * Each CSV row becomes one line item. Top-level summary fields
 * (e.g. total debit/credit) are computed and emitted as fields.
 */
export async function parseCSV(input: {
  s3: S3Client;
  bucket: string;
  key: string;
}): Promise<CsvParseResult> {
  log.info({ bucket: input.bucket, key: input.key }, "Downloading CSV from S3");

  const body = await downloadS3Object(input.s3, input.bucket, input.key);
  const lines = body.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { fields: [], lineItems: [], rowCount: 0, warnings: ["CSV has no data rows"] };
  }

  const headers = parseCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
  const warnings: string[] = [];

  // Detect column indices by common header aliases
  const colIdx = {
    date: findCol(headers, ["date", "transaction date", "posted date", "trans date"]),
    description: findCol(headers, ["description", "merchant", "name", "payee", "memo", "details"]),
    amount: findCol(headers, ["amount", "transaction amount", "debit/credit", "value"]),
    debit: findCol(headers, ["debit", "withdrawal", "charge"]),
    credit: findCol(headers, ["credit", "deposit", "payment"]),
    balance: findCol(headers, ["balance", "running balance"]),
    type: findCol(headers, ["type", "transaction type", "category"])
  };

  if (colIdx.date === -1) warnings.push("No 'date' column detected");
  if (colIdx.description === -1) warnings.push("No 'description/merchant' column detected");
  if (colIdx.amount === -1 && colIdx.debit === -1) warnings.push("No 'amount' or 'debit' column detected");

  const lineItems: ExtractedLineItem[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]);

    const description = colIdx.description !== -1 ? cols[colIdx.description]?.trim() : undefined;

    // Determine amount: prefer explicit amount col, fall back to debit - credit
    let totalPrice: number | undefined;
    if (colIdx.amount !== -1) {
      totalPrice = parseAmount(cols[colIdx.amount]);
    } else if (colIdx.debit !== -1) {
      const debit = parseAmount(cols[colIdx.debit]);
      const credit = colIdx.credit !== -1 ? parseAmount(cols[colIdx.credit]) : 0;
      totalPrice = (debit ?? 0) - (credit ?? 0);
    }

    if (totalPrice !== undefined) {
      if (totalPrice < 0) totalCredit += Math.abs(totalPrice);
      else totalDebit += totalPrice;
    }

    lineItems.push({
      description,
      totalPrice,
      confidence: 1 // CSV is structured data — full confidence
    });
  }

  const rowCount = lineItems.length;

  const fields: ExtractedField[] = [
    { key: "row_count", value: String(rowCount), confidence: 1 },
    { key: "total_debit", value: totalDebit.toFixed(2), confidence: 1 },
    { key: "total_credit", value: totalCredit.toFixed(2), confidence: 1 }
  ];

  log.info({ rowCount, totalDebit, totalCredit }, "CSV parsed");

  return { fields, lineItems, rowCount, warnings };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function downloadS3Object(s3: S3Client, bucket: string, key: string): Promise<string> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`Empty S3 object: s3://${bucket}/${key}`);
  return res.Body.transformToString("utf-8");
}

function findCol(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseAmount(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

/**
 * Minimal RFC 4180-compatible CSV row parser.
 * Handles quoted fields containing commas and escaped quotes.
 */
function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }

  result.push(current);
  return result;
}