# Smart Expense Analyzer

Upload receipts and bank exports, extract transactions automatically, detect anomalies, and explore monthly spending insights — with an AI chat interface over your own financial data.

## Features

- **Upload receipts & bank CSVs** — drag-and-drop with live progress; view upload history and delete uploads with full cascade (removes all extracted transactions and dismisses linked anomalies)
- **Automatic extraction** — AWS Textract + Bedrock enrichment parses receipts and bank statements into normalized transactions
- **Transaction management** — search by merchant, correct merchant/amount inline, delete individual transactions
- **Monthly analytics & insights** — per-month breakdown of total spend, transaction count, average per transaction, top merchant, and month-over-month delta
- **Anomaly detection** — flags duplicate charges, unusually large amounts, rapid-repeat charges, large round numbers, and first-time merchants; anomalies auto-dismiss when the source transaction is deleted
- **Notifications** — in-app notification feed for anomaly alerts and processing events
- **AI Chat** — ask natural language questions about your spending (powered by AWS Bedrock)
- **Auth** — JWT-based login/signup with session management; single-user workspace model

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS + Recharts |
| Backend | NestJS microservices (TypeScript) |
| File storage | S3 |
| Database | DynamoDB (single-table design per service) |
| Event bus | SNS + SQS (fan-out pattern) |
| OCR | AWS Textract |
| AI/LLM | AWS Bedrock (Claude) |
| Local infra | LocalStack (S3, DynamoDB, SNS, SQS) |
| CI | GitHub Actions |

## Services

| Service | Port | Responsibility |
|---|---|---|
| `auth-service` | 3009 | Signup, login, logout, session validation |
| `upload-service` | 3001 | Presigned S3 URLs, upload lifecycle, history |
| `extraction-service` | 3002 | Textract OCR + Bedrock enrichment, transaction normalization |
| `transactions-service` | 3003 | CRUD for transactions, cascade delete by upload |
| `analytics-service` | 3005 | Monthly summaries, daily spend, trends, top merchants |
| `anomaly-service` | 3006 | Anomaly detection pipeline, dismiss on delete |
| `notification-service` | 3007 | In-app notifications feed |
| `chat-service` | 3008 | Conversational Q&A over spending data via Bedrock |

## Event Flow

```
Upload finalized
  └─► SNS sea-events
        ├─► extraction-service  → extracts transactions → publishes transaction.upserted.v1
        │                             └─► SNS sea-events
        │                                   ├─► analytics-service   (updates monthly summaries)
        │                                   ├─► anomaly-service     (runs detectors)
        │                                   └─► notification-service (creates alerts)
        └─► (other subscribers)

Transaction deleted
  └─► transaction.upserted.v1 (operation=DELETED)
        ├─► analytics-service   (reverses spend totals)
        └─► anomaly-service     (dismisses open anomalies for that transaction)
```

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop
- AWS credentials configured (for Textract + Bedrock — real AWS required for OCR/AI)

### 1. Start LocalStack

```bash
docker compose -f tools/docker/docker-compose.yml up -d
```

This starts LocalStack and auto-creates all DynamoDB tables, the S3 bucket (`sea-uploads-dev`), the SNS topic (`sea-events`), and all SQS queues.

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

Each service has a `.env.local` file. Key variables:

```env
# Shared across all services
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_ENDPOINT_URL=http://localhost:4566

# auth-service
JWT_SECRET=dev-secret

# upload-service
S3_BUCKET=sea-uploads-dev
DDB_UPLOAD_TABLE=UploadFiles

# extraction-service
DDB_EXTRACTED_DOCS_TABLE=ExtractedDocs
SNS_EVENTS_TOPIC_ARN=arn:aws:sns:us-east-1:000000000000:sea-events

# transactions-service
DDB_TRANSACTIONS_TABLE=Transactions

# analytics-service
DDB_ANALYTICS_TABLE=AnalyticsSummaries

# anomaly-service
DDB_ANOMALY_TABLE=AnomalyDetections

# notification-service
DDB_NOTIFICATIONS_TABLE=Notifications

# chat-service
DDB_CHAT_TABLE=ChatConversations
```

Frontend environment (`apps/web/.env.local`):

```env
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:3009
NEXT_PUBLIC_UPLOAD_SERVICE_URL=http://localhost:3001
NEXT_PUBLIC_EXTRACTION_SERVICE_URL=http://localhost:3002
NEXT_PUBLIC_TRANSACTIONS_SERVICE_URL=http://localhost:3003
NEXT_PUBLIC_ANALYTICS_SERVICE_URL=http://localhost:3005
NEXT_PUBLIC_ANOMALY_SERVICE_URL=http://localhost:3006
NEXT_PUBLIC_NOTIFICATION_SERVICE_URL=http://localhost:3007
NEXT_PUBLIC_CHAT_SERVICE_URL=http://localhost:3008
```

### 4. Run

```bash
# All backend services (8 services with colored output)
pnpm dev:services

# Frontend only
pnpm dev:web

# Everything at once
pnpm dev:all
```

### Other commands

```bash
pnpm -r lint        # Lint all packages
pnpm -r test        # Run all unit tests
pnpm -r build       # Build all packages
```

## Project Structure

```
smart-expense-analyzer/
├── apps/
│   └── web/                         # Next.js frontend
│       └── src/
│           ├── app/
│           │   ├── (app)/
│           │   │   ├── dashboard/   # Spend overview, top merchant, recent transactions
│           │   │   ├── uploads/     # File upload + history + cascade delete
│           │   │   ├── transactions/# Transaction list with merchant search
│           │   │   ├── insights/    # Monthly breakdown table + trend chart
│           │   │   ├── anomalies/   # Open anomalies with severity
│           │   │   ├── notifications/
│           │   │   ├── chat/        # AI spending assistant
│           │   │   └── settings/
│           │   └── login/
│           ├── components/
│           ├── lib/                 # api.ts, auth.ts, utils.ts
│           └── types/
├── services/
│   ├── auth-service/
│   ├── upload-service/
│   ├── extraction-service/
│   ├── transactions-service/
│   ├── analytics-service/
│   ├── anomaly-service/
│   ├── notification-service/
│   └── chat-service/
├── shared/
│   ├── libs/
│   │   ├── logger/
│   │   ├── observability/
│   │   └── idempotency/
│   ├── contracts/
│   └── config/
├── tests/
│   ├── integration/
│   └── contract/
├── tools/
│   └── docker/
│       └── docker-compose.yml       # LocalStack setup
└── docs/
    ├── api/                         # OpenAPI specs per service
    ├── architecture/
    ├── events/
    └── compliance/
```

## DynamoDB Key Design (per service)

| Service | Table | PK | SK |
|---|---|---|---|
| upload-service | `UploadFiles` | `WS#<workspaceId>` | `UPLOAD#<uploadId>` |
| transactions-service | `Transactions` | `WS#<workspaceId>` | `TXN#<transactionId>` |
| analytics-service | `AnalyticsSummaries` | `WS#<workspaceId>` | `SUMMARY#<YYYY-MM>`, `DAILY#<date>`, `MERCHANT#<name>` |
| anomaly-service | `AnomalyDetections` | `WS#<workspaceId>` | `ANOMALY#<createdAt>#<anomalyId>`, `TXN_IDX#<merchant>#<ts>#<id>`, `MERCHANT_SEEN#<merchant>` |
| notification-service | `Notifications` | `WS#<workspaceId>` | `NOTIF#<createdAt>#<notifId>` |
| chat-service | `ChatConversations` | `WS#<workspaceId>` | `CONV#<convId>`, `MSG#<convId>#<ts>` |
| auth-service | `Users`, `Sessions`, `Workspaces` | `USER#<userId>` / `SESSION#<token>` / `WS#<workspaceId>` | — |

## Anomaly Detectors

| Type | Severity | Logic |
|---|---|---|
| `DUPLICATE_CHARGE` | HIGH | Same merchant + amount within 5 minutes |
| `UNUSUALLY_LARGE_AMOUNT` | HIGH | Amount > 3× monthly workspace average |
| `RAPID_REPEAT_CHARGE` | MEDIUM | Same merchant charged 3+ times within 1 hour |
| `LARGE_ROUND_NUMBER` | LOW | Amount ≥ 500 and divisible by 100 |
| `FIRST_TIME_MERCHANT` | LOW | Merchant never seen before in this workspace |
