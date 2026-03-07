// File: services/notification-service/src/domain/notification.service.ts
import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

import { createLogger } from "@shared/logger";
import { getOrCreateCorrelationId } from "@shared/observability";

import { createDdbClient } from "../db/ddb.client";
import { NotificationRepo } from "../db/notification.repo";
import { createSesClient, sendEmail } from "../integrations/ses.sender";
import { anomalyEmailTemplate, digestEmailTemplate } from "../integrations/email.templates";

import { AnomalyDetectedEvent, TransactionUpsertedEvent } from "./events";

@Injectable()
export class NotificationService {
  private readonly log = createLogger({ serviceName: "notification-service" });

  private readonly repo = new NotificationRepo(
    createDdbClient(),
    mustGetEnv("DDB_NOTIFICATIONS_TABLE")
  );

  private readonly ses = createSesClient();
  private readonly notifyEmail = process.env.NOTIFY_EMAIL ?? "";

  // ── Anomaly handler ───────────────────────────────────────────────────────

  async handleAnomalyDetected(event: AnomalyDetectedEvent): Promise<void> {
    const correlationId = getOrCreateCorrelationId(event.correlationId);

    // Only notify for MEDIUM and HIGH severity
    if (event.severity === "LOW") {
      this.log.info(
        { correlationId, anomalyId: event.anomalyId, severity: event.severity },
        "Skipping LOW severity anomaly"
      );
      return;
    }

    const now = new Date().toISOString();

    this.log.info(
      { correlationId, anomalyId: event.anomalyId, anomalyType: event.anomalyType, severity: event.severity },
      "Processing anomaly notification"
    );

    // ── In-app notification (always) ──────────────────────────────────────
    const notificationId = uuidv4();
    await this.repo.save({
      notificationId,
      workspaceId: event.workspaceId,
      title: formatAnomalyTitle(event.anomalyType, event.severity),
      body: event.description,
      type: "ANOMALY",
      severity: event.severity,
      referenceId: event.anomalyId,
      status: "UNREAD",
      createdAt: now
    });

    this.log.info(
      { correlationId, notificationId, anomalyType: event.anomalyType },
      "In-app notification saved"
    );

    // ── Email notification (throttled per anomaly type per hour) ──────────
    if (!this.notifyEmail) {
      this.log.warn({ correlationId }, "NOTIFY_EMAIL not set — skipping email");
      return;
    }

    const throttled = await this.repo.isThrottled(event.workspaceId, event.anomalyType);
    if (throttled) {
      this.log.info(
        { correlationId, anomalyType: event.anomalyType },
        "Email throttled — already sent this anomaly type in the last hour"
      );
      return;
    }

    const template = anomalyEmailTemplate({
      workspaceId: event.workspaceId,
      anomalyType: event.anomalyType,
      severity: event.severity,
      description: event.description,
      transactionId: event.transactionId,
      occurredAt: event.occurredAt
    });

    await sendEmail(this.ses, { to: this.notifyEmail, ...template });
    await this.repo.setThrottle(event.workspaceId, event.anomalyType);

    this.log.info(
      { correlationId, to: this.notifyEmail, anomalyType: event.anomalyType },
      "Anomaly email sent"
    );
  }

  // ── Transaction handler (weekly digest) ───────────────────────────────────

  async handleTransactionUpserted(event: TransactionUpsertedEvent): Promise<void> {
    const correlationId = getOrCreateCorrelationId(event.correlationId);

    if (event.operation !== "CREATED") return;

    const weekKey = getWeekKey(new Date(event.snapshot.date));

    await this.repo.incrementDigest(
      event.workspaceId,
      weekKey,
      event.snapshot.amount
    );

    this.log.info(
      { correlationId, transactionId: event.transactionId, weekKey, amount: event.snapshot.amount },
      "Digest updated"
    );
  }

  // ── HTTP methods ──────────────────────────────────────────────────────────

  async listNotifications(workspaceId: string, status?: "UNREAD" | "READ") {
    const notifications = await this.repo.list(workspaceId, { status });
    const unreadCount = await this.repo.unreadCount(workspaceId);
    return { notifications, unreadCount };
  }

  async markRead(workspaceId: string, notificationId: string, createdAt: string): Promise<void> {
    await this.repo.markRead(workspaceId, notificationId, createdAt);
  }

  async markAllRead(workspaceId: string): Promise<void> {
    await this.repo.markAllRead(workspaceId);
  }

  async sendWeeklyDigest(workspaceId: string): Promise<void> {
    if (!this.notifyEmail) {
      this.log.warn({}, "NOTIFY_EMAIL not set — skipping weekly digest email");
      return;
    }

    const weekKey = getWeekKey(new Date());
    const digest = await this.repo.getDigest(workspaceId, weekKey);

    if (!digest || digest.transactionCount === 0) {
      this.log.info({ workspaceId, weekKey }, "No transactions this week — skipping digest");
      return;
    }

    const template = digestEmailTemplate({
      workspaceId,
      weekKey,
      transactionCount: digest.transactionCount,
      totalAmount: digest.totalAmount,
      currency: "USD"
    });

    await sendEmail(this.ses, { to: this.notifyEmail, ...template });
    this.log.info({ workspaceId, weekKey }, "Weekly digest email sent");
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAnomalyTitle(anomalyType: string, severity: string): string {
  const type = anomalyType.replace(/_/g, " ").toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const emoji = severity === "HIGH" ? "🔴" : "🟡";
  return `${emoji} ${type}`;
}

function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}