// File: services/extraction-service/src/integrations/textract.extractor.ts
import {
  TextractClient,
  AnalyzeExpenseCommand,
  AnalyzeExpenseCommandInput,
  StartDocumentAnalysisCommand,
  GetDocumentAnalysisCommand,
  ExpenseDocument,
  Block
} from "@aws-sdk/client-textract";
import { S3Client } from "@aws-sdk/client-s3";
import { createLogger } from "@shared/logger";
import { ExtractedField, ExtractedLineItem } from "../domain/events";

const log = createLogger({ serviceName: "extraction-service" });

export function createTextractClient(): TextractClient {
  const accessKeyId = process.env.TEXTRACT_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.TEXTRACT_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.TEXTRACT_ENDPOINT_URL;
  return new TextractClient({
    region: process.env.TEXTRACT_REGION ?? process.env.AWS_REGION ?? "us-east-1",
    ...(endpoint ? { endpoint } : {}),
    ...(accessKeyId && secretAccessKey ? {
      credentials: { accessKeyId, secretAccessKey }
    } : {})
  });
}

export function createS3ClientForTextract(): S3Client {
  const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE ?? "false").toLowerCase() === "true";
  const endpoint = process.env.S3_ENDPOINT_URL;
  return new S3Client({
    region: process.env.AWS_REGION ?? "us-east-1",
    ...(endpoint ? { endpoint, forcePathStyle } : {}),
  });
}

export type TextractResult = {
  fields: ExtractedField[];
  lineItems: ExtractedLineItem[];
  warnings: string[];
};

export async function extractWithTextract(input: {
  textract: TextractClient;
  bucket: string;
  key: string;
  contentType: string;
  source?: string;
}): Promise<TextractResult> {

  if (process.env.USE_MOCK_TEXTRACT === "true") {
    log.warn({ bucket: input.bucket, key: input.key }, "Mock Textract enabled — returning mock result");
    return mockTextractResult();
  }

  if (input.source === "bank_statement") {
    return extractBankStatement({ textract: input.textract, bucket: input.bucket, key: input.key });
  }

  return extractReceipt({ textract: input.textract, bucket: input.bucket, key: input.key });
}

// ── Bank Statement — StartDocumentAnalysis (async, supports PDF) ──────────────

async function extractBankStatement(input: {
  textract: TextractClient;
  bucket: string;
  key: string;
}): Promise<TextractResult> {
  log.info({ bucket: input.bucket, key: input.key }, "Calling Textract StartDocumentAnalysis (TABLES) for bank statement PDF");

  const startRes = await input.textract.send(new StartDocumentAnalysisCommand({
    DocumentLocation: {
      S3Object: { Bucket: input.bucket, Name: input.key }
    },
    FeatureTypes: ["TABLES"],
    OutputConfig: {
      S3Bucket: input.bucket,
      S3Prefix: "textract-output"
    }
  }));

  const jobId = startRes.JobId;
  if (!jobId) throw new Error("Textract did not return a JobId");

  log.info({ jobId }, "Textract job started — polling for completion");

  const blocks: Block[] = [];

  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(r => setTimeout(r, 3000));

    const getRes = await input.textract.send(new GetDocumentAnalysisCommand({
      JobId: jobId
    }));

    if (getRes.JobStatus === "FAILED") {
      throw new Error(`Textract job failed: ${getRes.StatusMessage}`);
    }

    if (getRes.JobStatus === "SUCCEEDED") {
      blocks.push(...(getRes.Blocks ?? []));

      let pageToken = getRes.NextToken;
      while (pageToken) {
        const pageRes = await input.textract.send(new GetDocumentAnalysisCommand({
          JobId: jobId,
          NextToken: pageToken
        }));
        blocks.push(...(pageRes.Blocks ?? []));
        pageToken = pageRes.NextToken;
      }
      break;
    }

    log.info({ jobId, attempt, status: getRes.JobStatus }, "Textract job still processing...");
  }

  log.info({ jobId, blockCount: blocks.length }, "Textract job completed");

  const lineItems = parseBankStatementTables(blocks);
  const warnings: string[] = [];

  if (lineItems.length === 0) {
    warnings.push("No transactions found in table extraction — check document format");
  }

  return {
    fields: [
      { key: "document_type", value: "bank_statement", confidence: 1.0 },
      { key: "currency", value: "USD", confidence: 1.0 },
    ],
    lineItems,
    warnings
  };
}

// ── Table parsing ─────────────────────────────────────────────────────────────

function detectStatementYear(blocks: Block[]): number {
  const currentYear = new Date().getFullYear();

  for (const block of blocks) {
    if (block.BlockType !== "LINE" && block.BlockType !== "WORD") continue;
    const text = block.Text ?? "";
    const yearMatch = text.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      if (Math.abs(year - currentYear) <= 2) {
        return year;
      }
    }
  }

  return currentYear;
}

function parseBankStatementTables(blocks: Block[]): ExtractedLineItem[] {
  const blockMap = new Map<string, Block>();
  for (const block of blocks) {
    if (block.Id) blockMap.set(block.Id, block);
  }

  const statementYear = detectStatementYear(blocks);
  log.info({ statementYear }, "Detected statement year");

  const tables = blocks.filter(b => b.BlockType === "TABLE");
  const allLineItems: ExtractedLineItem[] = [];

  for (const table of tables) {
    const rows = extractTableRows(table, blockMap);
    const items = parseTransactionRows(rows, statementYear);
    allLineItems.push(...items);
  }

  return allLineItems;
}

function extractTableRows(table: Block, blockMap: Map<string, Block>): string[][] {
  const cellMap = new Map<string, string>();

  for (const rel of table.Relationships ?? []) {
    if (rel.Type !== "CHILD") continue;
    for (const cellId of rel.Ids ?? []) {
      const cell = blockMap.get(cellId);
      if (!cell || cell.BlockType !== "CELL") continue;

      const rowIndex = cell.RowIndex ?? 0;
      const colIndex = cell.ColumnIndex ?? 0;
      const key = `${rowIndex}-${colIndex}`;

      let text = "";
      for (const cellRel of cell.Relationships ?? []) {
        if (cellRel.Type !== "CHILD") continue;
        for (const wordId of cellRel.Ids ?? []) {
          const word = blockMap.get(wordId);
          if (word?.BlockType === "WORD") {
            text += (text ? " " : "") + (word.Text ?? "");
          }
        }
      }
      cellMap.set(key, text.trim());
    }
  }

  if (cellMap.size === 0) return [];

  const maxRow = Math.max(...[...cellMap.keys()].map(k => parseInt(k.split("-")[0])));
  const maxCol = Math.max(...[...cellMap.keys()].map(k => parseInt(k.split("-")[1])));

  const rows: string[][] = [];
  for (let r = 1; r <= maxRow; r++) {
    const row: string[] = [];
    for (let c = 1; c <= maxCol; c++) {
      row.push(cellMap.get(`${r}-${c}`) ?? "");
    }
    rows.push(row);
  }

  return rows;
}

function parseTransactionRows(rows: string[][], statementYear?: number): ExtractedLineItem[] {
  if (rows.length < 2) return [];

  const headerRow = rows[0].map(h => h.toLowerCase().trim());

  let dateCol = -1;
  let descCol = -1;
  let amountCol = -1;

  for (let i = 0; i < headerRow.length; i++) {
    const h = headerRow[i];
    if (dateCol === -1 && (h.includes("transaction") || h.includes("date") || h === "date")) {
      dateCol = i;
    }
    if (descCol === -1 && (h.includes("description") || h.includes("merchant") || h.includes("memo"))) {
      descCol = i;
    }
    if (amountCol === -1 && h.includes("amount")) {
      amountCol = i;
    }
  }

  if (dateCol === -1 && descCol === -1 && amountCol === -1) {
    if (rows[0].length >= 3) {
      dateCol = 0;
      descCol = rows[0].length === 3 ? 1 : 2;
      amountCol = rows[0].length - 1;
    } else {
      return [];
    }
  }

  const items: ExtractedLineItem[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(cell => !cell.trim())) continue;

    const description = descCol >= 0 ? row[descCol]?.trim() : "";
    const dateRaw = dateCol >= 0 ? row[dateCol]?.trim() : "";
    const amountRaw = amountCol >= 0 ? row[amountCol]?.trim() : "";

    if (!description && !amountRaw) continue;

    if (description?.toLowerCase().includes("description") ||
        description?.toLowerCase().includes("total")) continue;

    const amount = parseTransactionAmount(amountRaw);
    if (amount === undefined) continue;
    if (amount <= 0) continue;

    const date = parseDateString(dateRaw, statementYear);

    items.push({
      description: description || "Unknown",
      totalPrice: amount,
      date,
      confidence: 0.85
    });
  }

  return items;
}

function parseTransactionAmount(raw: string): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  const inParens = cleaned.match(/^\(([0-9.]+)\)$/);
  if (inParens) return -parseFloat(inParens[1]);
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

function parseDateString(raw: string, statementYear?: number): string | undefined {
  if (!raw) return undefined;

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // MM/DD/YYYY or MM-DD-YYYY
  const mdy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // MM/DD or MM-DD without year — use statement year
  const md = raw.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (md) {
    const [, m, d] = md;
    const year = statementYear ?? new Date().getFullYear();
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return undefined;
}

// ── Receipt — AnalyzeExpense ──────────────────────────────────────────────────

async function extractReceipt(input: {
  textract: TextractClient;
  bucket: string;
  key: string;
}): Promise<TextractResult> {
  log.info({ bucket: input.bucket, key: input.key }, "Calling Textract AnalyzeExpense for receipt");

  const params: AnalyzeExpenseCommandInput = {
    Document: {
      S3Object: { Bucket: input.bucket, Name: input.key }
    }
  };

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

  return {
    fields: extractSummaryFields(doc),
    lineItems: extractLineItems(doc),
    warnings
  };
}

function extractSummaryFields(doc: ExpenseDocument): ExtractedField[] {
  const fields: ExtractedField[] = [];
  for (const group of doc.SummaryFields ?? []) {
    const key = group.Type?.Text?.toLowerCase() ?? "unknown";
    const value = group.ValueDetection?.Text ?? "";
    const confidence = group.ValueDetection?.Confidence
      ? group.ValueDetection.Confidence / 100
      : undefined;
    if (value) fields.push({ key, value, confidence });
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
          ? field.ValueDetection.Confidence / 100 : 1;
        minConfidence = Math.min(minConfidence, conf);
        switch (type) {
          case "item":
          case "product_code": item.description = text; break;
          case "quantity": item.quantity = parseFloat(text) || undefined; break;
          case "unit_price": item.unitPrice = parseFloat(text.replace(/[^0-9.]/g, "")) || undefined; break;
          case "price": item.totalPrice = parseFloat(text.replace(/[^0-9.]/g, "")) || undefined; break;
        }
      }
      item.confidence = minConfidence;
      if (item.description || item.totalPrice) items.push(item);
    }
  }
  return items;
}

// ── Mock ──────────────────────────────────────────────────────────────────────

function mockTextractResult(): TextractResult {
  return {
    fields: [
      { key: "vendor_name", value: "Mock Merchant (LocalStack)", confidence: 0.99 },
      { key: "total", value: "42.00", confidence: 0.95 },
      { key: "currency", value: "USD", confidence: 0.99 },
      { key: "invoice_receipt_date", value: new Date().toISOString().slice(0, 10), confidence: 0.90 },
    ],
    lineItems: [
      { description: "Mock Item 1", quantity: 1, unitPrice: 20.00, totalPrice: 20.00, confidence: 0.95 },
      { description: "Mock Item 2", quantity: 2, unitPrice: 11.00, totalPrice: 22.00, confidence: 0.92 }
    ],
    warnings: ["mock_textract_localstack"]
  };
}