# Threat Model 
**Status:** Frozen for v1 (security changes require ADR under `docs/decisions/`)  
**Last updated:** 2026-02-16

## 1) Scope
This threat model covers the Smart Expense Analyzer (web app + microservices + event pipeline) for:
- Personal and Team workspaces
- Receipt upload (image/PDF), bank export upload (CSV)
- Extraction (OCR/parsing), transaction storage, categorization, analytics, anomalies
- Notifications (email for MVP)
- Chat Q&A over spending

Out of scope for v1:
- Direct bank integrations (Plaid)
- Native mobile apps

## 2) Assets (what we must protect)
- **User identity**: Cognito users, JWTs
- **Workspace data**: transactions, uploads, extracted results, insights, anomalies
- **Raw files**: receipts, PDFs, bank CSVs (S3)
- **Derived artifacts**: extraction outputs (S3/Dynamo), aggregates/insights
- **Secrets/keys**: KMS keys, API secrets, tokens
- **Logs**: must not leak sensitive data

## 3) Trust boundaries
1. Browser/Client ↔ API Gateway/ALB (public internet)
2. Services ↔ AWS resources (S3/Dynamo/EventBus)
3. Event bus ↔ consumers (async boundary)
4. External AI/OCR services (Textract/Bedrock) boundary

## 4) Authentication & Authorization (v1)
- AuthN: **AWS Cognito** issues JWTs.
- AuthZ: Workspace-scoped RBAC per `docs/architecture/rbac.md`.
- Every request must include/resolve `workspaceId`. Server validates membership + role.
- Viewers are read-only (server enforced).

## 5) Top threats & mitigations (v1)

### T1: Broken access control / IDOR (workspace data leakage)
**Risk:** A user accesses another workspace’s uploads/transactions by guessing IDs.  
**Mitigations:**
- All data models include `workspaceId` and all queries are filtered server-side.
- API paths require `{workspaceId}` and enforce membership on every call.
- Never fetch by `id` alone; always by `(workspaceId, id)`.
- Integration tests must assert 403 for cross-workspace access attempts.

### T2: Over-privileged roles / RBAC bypass
**Risk:** Viewer can upload/edit due to missing checks in a service/job.  
**Mitigations:**
- Central authz middleware in each service; deny-by-default.
- UI hides actions; backend is authoritative.
- Scheduled jobs use `actorUserId = "system"` and still enforce workspace scope.
- Audit log for admin actions (invite/remove/role change/settings).

### T3: Presigned URL abuse (upload poison / overwrite / exfil)
**Risk:** Attacker uses presigned URL to upload unexpected file type or overwrite key.  
**Mitigations:**
- Presigned URLs are short-lived (e.g., 5–15 min).
- S3 key is generated server-side; no client-chosen keys.
- Enforce max size and content-type constraints.
- Finalize step validates checksum/size (if provided) and transitions state idempotently.
- S3 bucket policy blocks public access; requires TLS.

### T4: Sensitive data in events/logs
**Risk:** OCR text/PII leaks into logs or events.  
**Mitigations:**
- Events contain IDs and minimal snapshots; no raw receipt images; no full OCR text.
- Extraction raw text stored in S3 with restricted access; events reference via S3 ref only.
- Structured logs with redaction (mask merchants if needed, never log tokens/PII blobs).
- Enable log retention limits.

### T5: Event poisoning / replay
**Risk:** Malicious actor publishes fake events or replays old events.  
**Mitigations:**
- Event bus permissions: only producer roles can publish.
- Consumers validate envelope fields and schema.
- Consumer dedupe by `eventId` and idempotent processing.

### T6: CSV injection (spreadsheet formula injection)
**Risk:** Exported CSV contains cells like `=HYPERLINK(...)` leading to client-side execution when opened.  
**Mitigations:**
- On export, escape cells that start with `=`, `+`, `-`, `@` by prefixing `'`.
- Store raw uploaded CSV privately; never render raw CSV content in HTML without escaping.

### T7: Prompt injection / data exfil via Chat
**Risk:** User inputs try to override system prompt and request data outside workspace.  
**Mitigations:**
- Chat service enforces workspace scope strictly.
- Responses must be generated only from authorized workspace data.
- Do not allow tool/system prompt exposure; never reveal secrets or cross-tenant data.
- Rate limit chat endpoint and log prompt injections (redacted).

### T8: Dependency/CI secrets leakage
**Risk:** Secrets committed or printed in CI logs.  
**Mitigations:**
- No secrets in repo; use Secrets Manager and CI secrets.
- CI logs must not print env vars; add secret scanning in CI (Phase 3).

### T9: Data deletion failures (retention policy not enforced)
**Risk:** User requests delete but files remain.  
**Mitigations:**
- RetentionUntil stored on UploadFile and enforced via scheduled cleanup job.
- Delete workspace triggers deletion workflow for S3 objects + Dynamo records.
- Deletion operations are idempotent and auditable.

## 6) Security requirements checklist (v1)
- TLS everywhere
- S3 Block Public Access + SSE-KMS
- DynamoDB encryption at rest (default) + KMS where needed
- Least-privilege IAM per service
- Rate limiting for public endpoints (upload create/finalize, chat)
- CloudWatch alarms for auth errors spikes and anomaly job failures

## 7) Residual risks (accepted for v1)
- Simple last-write-wins updates (no full optimistic locking)
- Basic anomaly rules may generate false positives (mitigated by review/ignore)