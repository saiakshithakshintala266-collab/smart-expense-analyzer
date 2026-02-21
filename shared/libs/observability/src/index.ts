import { nanoid } from "nanoid";

export const CORRELATION_HEADER = "x-correlation-id";

export function getOrCreateCorrelationId(headerValue?: string): string {
  const v = (headerValue ?? "").trim();
  return v.length > 0 ? v : nanoid(16);
}
