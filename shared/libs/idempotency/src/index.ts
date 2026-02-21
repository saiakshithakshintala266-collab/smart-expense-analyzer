export const IDEMPOTENCY_HEADER = "idempotency-key";

export function normalizeIdempotencyKey(value?: string): string | null {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : null;
}
