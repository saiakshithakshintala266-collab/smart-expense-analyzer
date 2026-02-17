# System Context Diagram (v1)

```mermaid
flowchart LR
  user[User (Admin/Member/Viewer)] --> web[Web App (Next.js)]
  web --> auth[Cognito Auth (JWT)]
  web --> api[API Gateway / ALB]

  api --> upl[upload-service]
  api --> txn[transactions-service]
  api --> ana[analytics-service]
  api --> anom[anomaly-service]
  api --> notif[notification-service]
  api --> chat[chat-service]

  upl --> s3[(S3: Raw Uploads)]
  upl --> ddbUploads[(DynamoDB: UploadFile)]

  ext[extraction-service] --> textract[Textract OCR]
  ext --> s3Artifacts[(S3: Extraction Artifacts)]
  ext --> ddbExt[(DynamoDB: Extraction Status - optional)]

  txn --> ddbTxn[(DynamoDB: Transactions)]
  cat[categorization-service] --> ddbCat[(DynamoDB: Categories/Rules)]

  ana --> ddbAgg[(DynamoDB: Aggregates/Insights)]
  anom --> ddbAnom[(DynamoDB: Anomalies)]
  notif --> ddbPrefs[(DynamoDB: Notification Prefs)]
  notif --> ses[SES Email]

  chat --> bedrock[Bedrock LLM]
  cat --> bedrock

  subgraph Eventing[Event Bus (EventBridge or SNS+SQS)]
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
