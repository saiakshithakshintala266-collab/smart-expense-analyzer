
# Privacy Notes (v1 Frozen)
**Status:** Frozen for v1 (changes require ADR under `docs/decisions/`)  
**Last updated:** 2026-02-16

## 1) Principles (v1)
- **Data minimization:** store only what we need to deliver value.
- **Purpose limitation:** use data only for expense analysis features.
- **Security by default:** encrypt at rest/in transit, least privilege.
- **Transparency:** retention and deletion behavior are defined and enforced.

## 2) What data we collect/store (v1)
### Account & workspace
- Email (Cognito)
- Workspace membership and role (Admin/Member/Viewer)

### Uploads
- Raw receipt images/PDFs and bank CSVs in S3 (encrypted)
- Upload metadata (filename, size, content type, status)

### Transactions & analytics
- Merchant name, date, amount, category, notes/tags (user-provided)
- Insights/anomalies derived from transactions

### Notifications
- User preferences (email on/off, thresholds)
- Email delivery status (sent/bounced) (optional MVP)

### Chat
- User questions and responses may be logged in redacted form (optional MVP).
- Chat must remain workspace-scoped and respect RBAC read permissions.

## 3) What we avoid (v1)
- No public sharing of workspaces.
- No raw OCR text included in events or logs.
- No secrets in logs.
- No training of external models on user data (unless explicitly added later via ADR).

## 4) Data sharing (v1)
- OCR: AWS Textract processes uploaded documents.
- LLM: AWS Bedrock may be used for categorization fallback and chat.
- Email: AWS SES for sending alerts (MVP).
All access is controlled, encrypted, and workspace-scoped.

## 5) Logging & redaction rules (v1)
- Never log:
  - JWTs, authorization headers
  - full receipt images/PDF contents
  - raw OCR text blobs
- Logs should include:
  - `workspaceId`, `actorUserId`, `correlationId`, `requestId`, status code
- If storing chat logs: redact amounts and merchant names if feasible; never store tokens.

## 6) User controls (v1)
- Notification preferences (per user per workspace)
- Delete workspace (Admin/Owner)
- Delete my data (personal workspace owner)

## 7) Security summary (v1)
- TLS in transit
- SSE-KMS for S3 uploads/artifacts
- DynamoDB encryption at rest
- RBAC enforced server-side per `docs/architecture/rbac.md`
- Events follow `docs/events/event-catalog.md` and avoid sensitive payloads

