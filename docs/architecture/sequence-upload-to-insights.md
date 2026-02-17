
---

```md
# Sequence: Receipt Upload → Extraction → Categorization → Insights/Anomalies → Notification (v1)

```mermaid
sequenceDiagram
  autonumber
  actor U as User (Admin/Member)
  participant W as Web App
  participant A as API Gateway/ALB
  participant UP as upload-service
  participant S3 as S3 (raw uploads)
  participant BUS as Event Bus
  participant EX as extraction-service
  participant TX as transactions-service
  participant CA as categorization-service
  participant AN as analytics-service
  participant AM as anomaly-service
  participant NO as notification-service
  participant T as Textract
  participant B as Bedrock
  participant SES as SES

  U->>W: Select receipt + upload
  W->>A: POST /workspaces/{workspaceId}/uploads (metadata)\n(Idempotency-Key, X-Correlation-Id)
  A->>UP: createUpload(workspaceId, actorUserId)
  UP-->>W: 201 {uploadFileId, presignedUrl}

  W->>S3: PUT/POST file via presignedUrl
  W->>A: POST /workspaces/{workspaceId}/uploads/{uploadFileId}/finalize
  A->>UP: finalizeUpload()
  UP->>BUS: Publish file.uploaded.v1
  UP-->>W: 202 Accepted

  BUS->>EX: Consume file.uploaded.v1
  EX->>T: OCR/Analyze (receipt/PDF) OR parse CSV
  T-->>EX: Extraction result
  EX->>BUS: Publish extraction.completed.v1 (minimal fields + refs)

  BUS->>TX: Consume extraction.completed.v1
  TX->>TX: Create/merge canonical Transaction
  TX->>BUS: Publish transaction.upserted.v1 (includes transaction snapshot)

  BUS->>CA: Consume extraction.completed.v1 OR transaction.upserted.v1
  CA->>CA: Apply rules
  alt Rules insufficient
    CA->>B: LLM categorize fallback
    B-->>CA: Category suggestion
  end
  CA->>BUS: Publish categorization.completed.v1

  BUS->>TX: Consume categorization.completed.v1
  TX->>TX: Persist category onto transaction
  TX->>BUS: Publish transaction.upserted.v1 (UPDATED)

  BUS->>AN: Consume transaction.upserted.v1
  AN->>AN: Update aggregates + generate insights (monthly)
  AN->>BUS: Publish insight.generated.v1 (when applicable)

  BUS->>AM: Consume transaction.upserted.v1
  AM->>AM: Duplicate/unusual checks
  opt anomaly found
    AM->>BUS: Publish anomaly.detected.v1
  end

  BUS->>NO: Consume insight.generated.v1 / anomaly.detected.v1
  NO->>NO: Check user prefs + RBAC visibility
  NO->>SES: Send email (MVP)
  SES-->>NO: Delivery status
