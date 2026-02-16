# Event Catalog (v1 Frozen)
**Status:** Frozen for v1 (changes require ADR under `docs/decisions/`)  
**Last updated:** 2026-02-16

## 1) Overview
This system is event-driven. Services publish domain events after completing a state change.
Consumers react asynchronously for extraction, categorization, analytics, anomaly detection, and notifications.

### Event Bus
- v1 uses a single logical event bus (AWS EventBridge or SNS+SQS fanout).
- Events are **immutable**, **versioned**, and **idempotent** (consumers dedupe by `eventId`).

### Required Envelope Fields (All Events)
All events MUST include:
- `eventId` (UUID)
- `eventType` (e.g., `file.uploaded`)
- `eventVersion` (e.g., `v1`)
- `occurredAt` (UTC ISO datetime)
- `producer` (service name)
- `workspaceId`
- `actorUserId` (user who initiated; `system` for scheduled jobs)
- `correlationId` (propagated from request across services)
- `data` (event payload; schema per event)

## 2) Event List (v1)
| Event | Producer | Primary Consumers | Purpose |
|---|---|---|---|
| `file.uploaded.v1` | upload-service | extraction-service | Start extraction pipeline after upload finalization |
| `extraction.completed.v1` | extraction-service | transactions-service, categorization-service | Create/merge canonical transactions and categorize |
| `transaction.upserted.v1` | transactions-service | analytics-service, anomaly-service | Update aggregates, run anomaly rules |
| `categorization.completed.v1` | categorization-service | transactions-service, analytics-service | Persist category result and refresh insights |
| `anomaly.detected.v1` | anomaly-service | notification-service | Notify users and surface anomalies in UI |
| `insight.generated.v1` | analytics-service | notification-service | Notify users about monthly insights / budget alerts |

## 3) Versioning Rules
- Breaking changes require a new version (e.g., `v2`) and parallel support window.
- Additive changes (new optional fields) can stay in the same version.
- Consumers must ignore unknown fields.

## 4) Idempotency & Dedupe
- Consumers MUST dedupe by `eventId`.
- Producers should not republish with a new `eventId` for the same state change.
- Retry behavior is allowed; consumers must be safe to run multiple times.

## 5) Security & Privacy
- Events carry only the minimal needed data.
- No raw receipt images or sensitive OCR text blobs in events (store in S3; reference by IDs/keys).
- Access is always workspace-scoped.

## 6) Observability
- All services propagate `correlationId`.
- Logs include `eventId`, `eventType`, `workspaceId`, `actorUserId`, `correlationId`.