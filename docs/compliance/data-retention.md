
# Data Retention Policy (v1 Frozen)
**Status:** Frozen for v1 (changes require ADR under `docs/decisions/`)  
**Last updated:** 2026-02-16

## 1) Goals
- Minimize stored sensitive data while meeting product goals.
- Provide clear retention defaults and deletion behavior.
- Ensure retention is enforceable (automated).

## 2) Data classes
### A) Raw uploads (highest sensitivity)
- Receipt images (JPG/PNG/HEIC), PDFs
- Bank export CSVs

### B) Derived artifacts (medium sensitivity)
- Extraction outputs (structured fields, confidence)
- Optional OCR raw text artifact (stored in S3, access restricted)

### C) Application records (medium sensitivity)
- Transactions (canonical)
- Categories/rules
- Insights/anomalies
- Notification preferences
- Workspace membership/roles

### D) Logs/metrics (low–medium sensitivity)
- Request logs (redacted)
- Audit logs (admin actions)
- Delivery logs (email sent/bounced)

## 3) Default retention (v1)
### Raw uploads (S3)
- Default retention: **180 days**
- Configurable by:
  - Personal workspace owner
  - Team workspace Admin
- After retention expires: raw objects deleted by automated cleanup job.

### Derived artifacts (S3 / DynamoDB)
- Extraction structured output: retained with transaction unless deleted
- OCR raw text artifact (if stored): same retention as raw uploads unless explicitly configured otherwise

### Transactions / insights / anomalies (DynamoDB)
- Retained until workspace is deleted or user requests deletion.
- Users can delete individual transactions (soft delete in v1; hard delete optional later).

### Logs
- Application logs (CloudWatch): **30–90 days** (choose and apply consistently in infra)
- Audit logs: **180–365 days** (choose and apply consistently in infra)

## 4) Deletion workflows (v1)
### Delete workspace (Admin/Owner)
- Deletes:
  - Workspace membership
  - Transactions
  - UploadFile records and related artifacts
  - Anomalies/Insights
  - Notification preferences tied to that workspace
- Implementation: asynchronous job with progress; idempotent.

### Delete my data (Personal owner)
- Equivalent to deleting personal workspace.
- For team workspaces, user removal removes access but does not delete workspace data unless explicitly required.

## 5) Enforcement mechanism
- Every UploadFile has `retentionUntil`.
- Scheduled cleanup job runs daily:
  - Finds expired UploadFiles
  - Deletes S3 objects
  - Updates UploadFile status / tombstones record
- Deletion is idempotent; failures retried with backoff.

## 6) Exceptions & legal holds (v1)
- None for MVP. If introduced later, must be documented via ADR.

