// File: services/notification-service/src/__tests__/notification.service.test.ts
import { makeAnomalyDetectedEvent, makeTransactionUpsertedEvent } from "@shared/testing";

// ── Mocks BEFORE import ───────────────────────────────────────────────────────

const mockRepo = {
  save:            jest.fn().mockResolvedValue(undefined),
  isThrottled:     jest.fn().mockResolvedValue(false),
  setThrottle:     jest.fn().mockResolvedValue(undefined),
  list:            jest.fn().mockResolvedValue([]),
  unreadCount:     jest.fn().mockResolvedValue(0),
  markRead:        jest.fn().mockResolvedValue(undefined),
  markAllRead:     jest.fn().mockResolvedValue(undefined),
  incrementDigest: jest.fn().mockResolvedValue(undefined),
  getDigest:       jest.fn().mockResolvedValue(null)
};

jest.mock("../db/ddb.client",        () => ({ createDdbClient: () => ({ send: jest.fn() }) }));
jest.mock("../db/notification.repo", () => ({ NotificationRepo: jest.fn().mockImplementation(() => mockRepo) }));
jest.mock("../integrations/ses.sender", () => ({
  createSesClient: () => ({}),
  sendEmail: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("../integrations/email.templates", () => ({
  anomalyEmailTemplate: jest.fn().mockReturnValue({ subject: "Anomaly Alert", html: "<p>alert</p>" }),
  digestEmailTemplate:  jest.fn().mockReturnValue({ subject: "Weekly Digest", html: "<p>digest</p>" })
}));

import { NotificationService } from "../domain/notification.service";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.DDB_NOTIFICATIONS_TABLE = "Notifications";
  process.env.NOTIFY_EMAIL            = "alerts@example.com";
  process.env.AWS_REGION              = "us-east-1";
  jest.clearAllMocks();
  mockRepo.save.mockResolvedValue(undefined);
  mockRepo.isThrottled.mockResolvedValue(false);
  mockRepo.setThrottle.mockResolvedValue(undefined);
  mockRepo.incrementDigest.mockResolvedValue(undefined);
  mockRepo.getDigest.mockResolvedValue(null);
});

// ── handleAnomalyDetected ─────────────────────────────────────────────────────

describe("NotificationService.handleAnomalyDetected", () => {
  it("skips LOW severity — no in-app notification and no email", async () => {
    const { sendEmail } = require("../integrations/ses.sender");
    const service = new NotificationService();

    await service.handleAnomalyDetected(makeAnomalyDetectedEvent({ severity: "LOW" }));

    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("saves in-app UNREAD ANOMALY notification for HIGH severity", async () => {
    const service = new NotificationService();
    await service.handleAnomalyDetected(makeAnomalyDetectedEvent({ severity: "HIGH" }));

    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    const saved = mockRepo.save.mock.calls[0][0];
    expect(saved.type).toBe("ANOMALY");
    expect(saved.severity).toBe("HIGH");
    expect(saved.status).toBe("UNREAD");
  });

  it("sends email for MEDIUM severity when not throttled", async () => {
    const { sendEmail } = require("../integrations/ses.sender");
    const service = new NotificationService();

    await service.handleAnomalyDetected(makeAnomalyDetectedEvent({ severity: "MEDIUM" }));

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(mockRepo.setThrottle).toHaveBeenCalledTimes(1);
  });

  it("saves in-app notification but skips email when throttled", async () => {
    const { sendEmail } = require("../integrations/ses.sender");
    mockRepo.isThrottled.mockResolvedValueOnce(true);
    const service = new NotificationService();

    await service.handleAnomalyDetected(makeAnomalyDetectedEvent({ severity: "HIGH" }));

    expect(mockRepo.save).toHaveBeenCalledTimes(1); // in-app still saved
    expect(sendEmail).not.toHaveBeenCalled();
    expect(mockRepo.setThrottle).not.toHaveBeenCalled();
  });

  it("saves in-app notification but skips email when NOTIFY_EMAIL is not set", async () => {
    delete process.env.NOTIFY_EMAIL;
    const { sendEmail } = require("../integrations/ses.sender");
    const service = new NotificationService();

    await service.handleAnomalyDetected(makeAnomalyDetectedEvent({ severity: "HIGH" }));

    expect(mockRepo.save).toHaveBeenCalledTimes(1); // in-app still saved
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

// ── handleTransactionUpserted (digest) ───────────────────────────────────────

describe("NotificationService.handleTransactionUpserted", () => {
  it("increments digest counter for CREATED transactions", async () => {
    const service = new NotificationService();
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "CREATED", date: "2026-03-09" })
    );

    expect(mockRepo.incrementDigest).toHaveBeenCalledTimes(1);
  });

  it("does not increment digest for UPDATED transactions", async () => {
    const service = new NotificationService();
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "UPDATED" })
    );

    expect(mockRepo.incrementDigest).not.toHaveBeenCalled();
  });

  it("does not increment digest for DELETED transactions", async () => {
    const service = new NotificationService();
    await service.handleTransactionUpserted(
      makeTransactionUpsertedEvent({ operation: "DELETED" })
    );

    expect(mockRepo.incrementDigest).not.toHaveBeenCalled();
  });
});