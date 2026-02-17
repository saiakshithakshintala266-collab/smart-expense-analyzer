
---

```md
# Sequence: Bank CSV Upload → Parse → Normalize → Categorize → Analytics/Anomalies (v1)

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
  participant SES as SES

  U->>W: Upload bank export CSV
  W->>A: POST /workspaces/{workspaceId}/uploads
  A->>UP: createUpload(source=bank_csv)
  UP-->>W: 201 presignedUrl

  W->>S3: PUT CSV via presignedUrl
  W->>A: POST /workspaces/{workspaceId}/uploads/{uploadFileId}/finalize
  A->>UP: finalizeUpload()
  UP->>BUS: Publish file.uploaded.v1

  BUS->>EX: Consume file.uploaded.v1
  EX->>EX: Parse CSV rows → normalize fields
  alt invalid rows present
    EX->>S3: Store error report artifact (row-level reasons)
    EX->>BUS: extraction.completed.v1 (PARTIAL) + ref to error artifact
  else all valid
    EX->>BUS: extraction.completed.v1 (SUCCESS)
  end

  BUS->>TX: Consume extraction.completed.v1
  TX->>TX: Upsert N transactions (dedupe by externalId/checksum)
  loop for each created/updated transaction
    TX->>BUS: Publish transaction.upserted.v1
  end

  BUS->>CA: Consume transaction.upserted.v1 (batch)
  CA->>CA: Categorize (rules first; fallback if enabled)
  loop for each categorized transaction
    CA->>BUS: Publish categorization.completed.v1
  end

  BUS->>TX: Consume categorization.completed.v1
  TX->>TX: Persist category and emit UPDATED transaction.upserted.v1

  BUS->>AN: Consume transaction.upserted.v1
  AN->>AN: Update monthly aggregates/insights
  opt monthly insight generated
    AN->>BUS: insight.generated.v1
  end

  BUS->>AM: Consume transaction.upserted.v1
  AM->>AM: Detect anomalies (duplicate/unusual)
  opt anomaly found
    AM->>BUS: anomaly.detected.v1
  end

  BUS->>NO: Consume anomaly.detected.v1 / insight.generated.v1
  NO->>SES: Send email (MVP)
