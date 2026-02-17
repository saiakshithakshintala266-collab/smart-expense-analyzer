
---

```md
# Container Diagram (v1)

```mermaid
flowchart TB
  %% Client
  subgraph Client
    web[Next.js Web App]
  end

  %% Edge
  subgraph Edge
    auth[Cognito]
    api[API Gateway / ALB]
  end

  web --> auth
  web --> api

  %% Core Services
  subgraph Services
    upl[upload-service]
    ext[extraction-service]
    txn[transactions-service]
    cat[categorization-service]
    ana[analytics-service]
    anom[anomaly-service]
    notif[notification-service]
    chat[chat-service]
  end

  api --> upl
  api --> txn
  api --> ana
  api --> anom
  api --> notif
  api --> chat

  %% Storage
  subgraph Storage
    s3[(S3)]
    ddb1[(DynamoDB: Uploads)]
    ddb2[(DynamoDB: Transactions)]
    ddb3[(DynamoDB: Categories/Rules)]
    ddb4[(DynamoDB: Aggregates/Insights)]
    ddb5[(DynamoDB: Anomalies)]
    ddb6[(DynamoDB: Preferences)]
  end

  upl --> s3
  upl --> ddb1

  txn --> ddb2
  cat --> ddb3
  ana --> ddb4
  anom --> ddb5
  notif --> ddb6

  %% External AI/Email
  subgraph External
    textract[Textract]
    bedrock[Bedrock]
    ses[SES]
  end

  ext --> textract
  cat --> bedrock
  chat --> bedrock
  notif --> ses

  %% Eventing
  subgraph Eventing
    bus[(Event Bus)]
  end

  upl --> bus
  ext --> bus
  txn --> bus
  cat --> bus
  ana --> bus
  anom --> bus

  bus --> ext
  bus --> txn
  bus --> cat
  bus --> ana
  bus --> anom
  bus --> notif

  %% Notes
  note1[/"All APIs & data are workspace-scoped (workspaceId)\nRBAC enforced per rbac.md"/]
  api --- note1

## Service Catalog (v1)

### Shared rules (apply to all services)
- All APIs are **workspace-scoped** (`workspaceId` required).
- AuthZ enforced per `docs/architecture/rbac.md`.
- Events follow `docs/events/event-catalog.md`.
- Idempotency: all write endpoints accept optional `Idempotency-Key`.
- Correlation: all requests/events propagate `correlationId`.
- Data ownership: each service owns its tables/collections; cross-service reads happen via APIs/events (not direct DB access).

---

## 1) upload-service
**Purpose:** Secure upload initiation, metadata tracking, and lifecycle status for uploaded files.

**Owns data**
- UploadFile records (metadata, status, retentionUntil)

**Stores**
- S3 objects (raw uploads) referenced by bucket/key
- DynamoDB table (UploadFile)

**APIs (MVP)**
- `POST /workspaces/{workspaceId}/uploads` → returns presigned URL + uploadFileId
- `POST /workspaces/{workspaceId}/uploads/{uploadFileId}/finalize` → marks uploaded, emits event
- `GET /workspaces/{workspaceId}/uploads/{uploadFileId}` → status
- `GET /workspaces/{workspaceId}/uploads` → list uploads
- `DELETE /workspaces/{workspaceId}/uploads/{uploadFileId}` → Admin/Owner only (delete raw artifact)

**Events**
- Produces: `file.uploaded.v1`
- Consumes: none

**Failure modes**
- Client upload fails → status stays `QUEUED/UPLOADED` until finalized or TTL cleanup
- Finalize called twice → must be idempotent

---

## 2) extraction-service
**Purpose:** Extract structured data from receipt images/PDFs (Textract) and parse CSV bank exports; produce normalized extracted result.

**Owns data**
- ExtractionJob / ExtractionResult (optional store, or minimal logs + S3 artifact refs)

**Stores**
- S3 artifacts (optional): raw extracted JSON, raw text references
- DynamoDB (optional): extraction job status

**APIs (MVP)**
- Optional (internal): `POST /internal/extractions/{uploadFileId}/retry`
- `GET /workspaces/{workspaceId}/extractions/{uploadFileId}` (optional)

**Events**
- Consumes: `file.uploaded.v1`
- Produces: `extraction.completed.v1`

**Failure modes**
- OCR partial/low confidence → emit `PARTIAL` with confidence + errorMessage
- Textract throttling → retry with backoff
- CSV parsing errors → emit `FAILED` with row-level error artifact in S3

---

## 3) transactions-service
**Purpose:** Canonical transaction store; edits; merges; supports UI query; emits transaction changes.

**Owns data**
- Transaction records (canonical)
- Audit log for transaction mutations (optional MVP; minimum logs in CloudWatch)

**Stores**
- DynamoDB table (Transactions) partitioned by workspaceId

**APIs (MVP)**
- `GET /workspaces/{workspaceId}/transactions` (filters: month/category/merchant)
- `GET /workspaces/{workspaceId}/transactions/{transactionId}`
- `POST /workspaces/{workspaceId}/transactions` (manual create)
- `PATCH /workspaces/{workspaceId}/transactions/{transactionId}` (edit)
- `DELETE /workspaces/{workspaceId}/transactions/{transactionId}` (allowed per RBAC)

**Events**
- Consumes: `extraction.completed.v1` (create/merge txns)
- Consumes: `categorization.completed.v1` (persist category onto txn)
- Produces: `transaction.upserted.v1`

**Failure modes**
- Duplicate imports (same CSV uploaded twice) → dedupe via externalId/checksum + idempotency
- Concurrent edits → last-write-wins for MVP; later add optimistic locking

---

## 4) categorization-service
**Purpose:** Determine category for a transaction using rules first, ML/LLM fallback, and feedback loop from user corrections.

**Owns data**
- Category definitions (workspace-level)
- Merchant→category rules (workspace-level)
- Model config/thresholds (MVP simple)

**Stores**
- DynamoDB table(s) for rules + categories

**APIs (MVP)**
- `POST /workspaces/{workspaceId}/categorize` (internal/batch)
- `GET /workspaces/{workspaceId}/categories`
- `POST /workspaces/{workspaceId}/rules` (Admin for global rules; Member may create personal rules if you choose—v1 says Admin for global)
- `DELETE /workspaces/{workspaceId}/rules/{ruleId}` (Admin)

**Events**
- Consumes: `extraction.completed.v1` (or `transaction.upserted.v1` for new txns)
- Produces: `categorization.completed.v1`

**Failure modes**
- LLM unavailable → fallback to `unknown` category with low confidence
- Rule conflicts → deterministic priority (exact merchant > contains > regex; highest priority wins)

---

## 5) analytics-service
**Purpose:** Monthly aggregates and insight generation.

**Owns data**
- Monthly aggregates per workspace/category
- Insight records (generated statements + metrics)

**Stores**
- DynamoDB table(s) for aggregates + insights (or OpenSearch optional later)

**APIs (MVP)**
- `GET /workspaces/{workspaceId}/analytics/monthly?month=&year=`
- `GET /workspaces/{workspaceId}/insights?month=&year=`

**Events**
- Consumes: `transaction.upserted.v1`
- Produces: `insight.generated.v1` (monthly insight generation)

**Failure modes**
- Backfill required after bug fix → rerun aggregation job for a period
- Large workspaces → process in pages; store checkpoint

---

## 6) anomaly-service
**Purpose:** Detect anomalies using rules/statistics; scheduled and event-driven checks.

**Owns data**
- Anomaly records

**Stores**
- DynamoDB table for anomalies

**APIs (MVP)**
- `GET /workspaces/{workspaceId}/anomalies`
- `PATCH /workspaces/{workspaceId}/anomalies/{anomalyId}` (mark reviewed/ignored)

**Events**
- Consumes: `transaction.upserted.v1` (near-real-time checks)
- Produces: `anomaly.detected.v1`

**Scheduled jobs (MVP)**
- Daily job per workspace to re-check recent transactions for duplicates/unusual

**Failure modes**
- False positives → user marks ignored; keep feedback for future tuning

---

## 7) notification-service
**Purpose:** Store preferences and deliver alerts (email for MVP).

**Owns data**
- User notification preferences (per workspace/user)
- Delivery logs (optional MVP)

**Stores**
- DynamoDB for preferences
- SES for email delivery (recommended)

**APIs (MVP)**
- `GET /workspaces/{workspaceId}/me/notification-preferences`
- `PUT /workspaces/{workspaceId}/me/notification-preferences`
- (Optional admin default) `GET/PUT /workspaces/{workspaceId}/notification-defaults`

**Events**
- Consumes: `anomaly.detected.v1`
- Consumes: `insight.generated.v1`
- Produces: none (or `notification.sent.v1` later; not in v1)

**Failure modes**
- SES bounce/throttle → retry + mark delivery failed; do not block pipeline

---

## 8) chat-service
**Purpose:** Answer questions over spending within workspace scope; enforce RBAC read permissions.

**Owns data**
- Chat sessions (optional), query logs (redacted)

**Stores**
- DynamoDB (optional) for sessions
- Uses transactions/analytics via API calls or read model

**APIs (MVP)**
- `POST /workspaces/{workspaceId}/chat` (question → answer + sources)
- `GET /workspaces/{workspaceId}/chat/history` (optional)

**Events**
- Consumes: none in MVP (can call APIs live)
- Produces: none in MVP

**Failure modes**
- Prompt injection attempts → strict system prompt + deny data exfiltration outside workspace
- Model errors → graceful fallback response

---

## 9) auth & user (AWS Cognito + minimal user profile)
**Purpose:** Authentication, token issuance, and identity.

**Owns data**
- Cognito user pool
- Minimal user profile (optional custom table)

**Notes**
- RBAC membership mapping stored in a workspace membership table (service-owned: could be transactions-service or a lightweight “workspace-service”).
- For v1 we can store membership in a dedicated table and expose via a minimal internal endpoint in transactions-service OR upload-service.
