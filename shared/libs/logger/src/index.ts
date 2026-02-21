import pino from "pino";
import type { Logger } from "pino";


export type LoggerOptions = {
  level?: string;
  serviceName: string;
};

export function createLogger(opts: LoggerOptions): Logger {
  return pino({
    level: opts.level ?? process.env.LOG_LEVEL ?? "info",
    base: { service: opts.serviceName }
  });
}
