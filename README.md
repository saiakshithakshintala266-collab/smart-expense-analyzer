# Smart Expense Analyzer (Individuals/Teams) — v1

Upload receipts and bank exports, auto-categorize spending, detect anomalies, and generate monthly insights.
Includes team workspaces with RBAC (Admin/Member/Viewer) and a “Ask your spending” chat.

## MVP Features
- Upload receipts (image/PDF) + bank exports (CSV)
- Extraction + normalization into canonical transactions
- Categorization (rules first, AI fallback)
- Monthly analytics + insights
- Anomaly detection (duplicate/unusual merchant/unusual amount)
- Notifications (email for MVP)
- Chat Q&A over your spending
- Security: auth + encryption + retention policy

## Tech Stack (v1)
- **Frontend:** Next.js + TypeScript
- **Backend:** Microservices (TypeScript services)
- **Storage:** S3 (uploads)
- **Data:** DynamoDB (transactions, metadata)
- **Events:** Event-driven pipeline (EventBridge/SNS+SQS)
- **OCR:** Textract
- **LLM:** Bedrock (fallback categorization + chat)
- **IaC:** CDK (TypeScript)
- **CI/CD:** GitHub Actions

## RBAC (v1 frozen)
- **Admin:** invite/remove, change roles, manage workspace settings, view/edit all transactions
- **Member:** upload receipts/CSVs, view/edit transactions, manage own notification preferences
- **Viewer:** read-only; no uploads; no edits

Authoritative policy: `docs/architecture/rbac.md`

## Local Development (placeholder)
> Commands will be added during development phase after scaffolding.
- `pnpm install`
- `pnpm -r lint`
- `pnpm -r test`
- `pnpm -r build`

## SDLC Phases
1. **Design** (current)
2. Development/Coding
3. Testing (unit + integration + e2e via CI)
4. Deployment (clean IaC + environments)

## v1 repo structure (authoritative)

smart-expense-analyzer/
├─ README.md
├─ LICENSE
├─ .gitignore
├─ .editorconfig
├─ .nvmrc
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
├─ .github/
│  ├─ workflows/
│  │  ├─ ci.yml
│  │  ├─ cd-dev.yml
│  │  ├─ cd-stage.yml
│  │  └─ cd-prod.yml
│  ├─ pull_request_template.md
│  └─ CODEOWNERS
├─ docs/
│  ├─ PRD-MVP.md
│  ├─ architecture/
│  │  ├─ context-diagram.md
│  │  ├─ container-diagram.md
│  │  ├─ sequence-upload-to-insights.md
│  │  ├─ sequence-csv-import.md
│  │  ├─ threat-model.md
│  │  └─ rbac.md
│  ├─ api/
│  │  ├─ upload.openapi.yaml
│  │  ├─ extraction.openapi.yaml
│  │  ├─ transactions.openapi.yaml
│  │  ├─ categorization.openapi.yaml
│  │  ├─ analytics.openapi.yaml
│  │  ├─ anomaly.openapi.yaml
│  │  ├─ notification.openapi.yaml
│  │  └─ chat.openapi.yaml
│  ├─ events/
│  │  ├─ event-catalog.md
│  │  └─ schemas/
│  │     ├─ file.uploaded.v1.json
│  │     ├─ extraction.completed.v1.json
│  │     ├─ transaction.upserted.v1.json
│  │     ├─ categorization.completed.v1.json
│  │     ├─ anomaly.detected.v1.json
│  │     └─ insight.generated.v1.json
│  ├─ decisions/
│  │  ├─ ADR-0001-monorepo.md
│  │  ├─ ADR-0002-event-bus.md
│  │  ├─ ADR-0003-data-store.md
│  │  └─ ADR-0004-ocr-llm.md
│  ├─ runbooks/
│  │  ├─ oncall.md
│  │  ├─ incident-response.md
│  │  └─ rollback.md
│  └─ compliance/
│     ├─ data-retention.md
│     └─ privacy-notes.md
├─ infra/
│  ├─ README.md
│  ├─ cdk/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ bin/
│  │  │  └─ app.ts
│  │  └─ lib/
│  │     ├─ stacks/
│  │     │  ├─ network-stack.ts
│  │     │  ├─ data-stack.ts
│  │     │  ├─ auth-stack.ts
│  │     │  ├─ eventing-stack.ts
│  │     │  ├─ services-stack.ts
│  │     │  ├─ observability-stack.ts
│  │     │  └─ frontend-stack.ts
│  │     └─ constructs/
│  │        ├─ ecs-fargate-service.ts
│  │        ├─ dynamodb-table.ts
│  │        └─ alarms.ts
│  └─ env/
│     ├─ dev.json
│     ├─ stage.json
│     └─ prod.json
├─ tools/
│  ├─ scripts/
│  │  ├─ setup-local.sh
│  │  ├─ seed-data.ts
│  │  └─ generate-openapi.ts
│  ├─ docker/
│  │  ├─ docker-compose.yml
│  │  └─ localstack/
│  └─ commitlint/
│     └─ commitlint.config.js
├─ shared/
│  ├─ README.md
│  ├─ contracts/
│  │  ├─ schemas/
│  │  │  ├─ transaction.schema.json
│  │  │  ├─ upload-file.schema.json
│  │  │  ├─ anomaly.schema.json
│  │  │  └─ insight.schema.json
│  │  ├─ events/
│  │  │  └─ index.ts
│  │  └─ openapi/
│  │     └─ common.yaml
│  ├─ libs/
│  │  ├─ logger/
│  │  ├─ auth/
│  │  ├─ validation/
│  │  ├─ idempotency/
│  │  └─ observability/
│  └─ config/
│     ├─ eslint/
│     ├─ prettier/
│     └─ tsconfig/
├─ apps/
│  └─ web/
│     ├─ README.md
│     ├─ package.json
│     ├─ next.config.js
│     ├─ tsconfig.json
│     ├─ public/
│     └─ src/
│        ├─ app/
│        ├─ components/
│        ├─ features/
│        │  ├─ uploads/
│        │  ├─ transactions/
│        │  ├─ analytics/
│        │  ├─ anomalies/
│        │  ├─ notifications/
│        │  └─ chat/
│        ├─ lib/
│        └─ styles/
├─ services/
│  ├─ upload-service/
│  │  ├─ README.md
│  │  ├─ package.json
│  │  ├─ Dockerfile
│  │  ├─ openapi.yaml
│  │  └─ src/
│  │     ├─ main.ts
│  │     ├─ routes/
│  │     ├─ handlers/
│  │     ├─ domain/
│  │     ├─ db/
│  │     └─ integrations/
│  ├─ extraction-service/
│  │  ├─ README.md
│  │  ├─ package.json
│  │  ├─ Dockerfile
│  │  ├─ openapi.yaml
│  │  └─ src/
│  │     ├─ main.ts
│  │     ├─ workers/
│  │     ├─ domain/
│  │     └─ integrations/
│  ├─ transactions-service/
│  ├─ categorization-service/
│  ├─ analytics-service/
│  ├─ anomaly-service/
│  ├─ notification-service/
│  └─ chat-service/
├─ tests/
│  ├─ integration/
│  ├─ e2e/
│  └─ contract/
└─ security/
   ├─ threat-model.md
   ├─ policies/
   └─ scripts/
