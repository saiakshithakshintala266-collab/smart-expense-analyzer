# Smart Expense Analyzer — MVP PRD (Individuals + Teams)
**Version:** 0.2  
**Owner:** (You)  
**Last updated:** 2026-02-16

## 1) Problem
Individuals and small teams want a secure, automated way to ingest receipts/bank exports, categorize spend, detect suspicious/duplicate charges, and get monthly insights—without manual spreadsheet work.

## 2) Goals (MVP)
1. Upload receipts (image/PDF) and bank exports (CSV) to create normalized transactions.
2. Auto-categorize transactions with rules-first + AI fallback.
3. Provide monthly category summaries + basic trend insights.
4. Detect basic anomalies (duplicate charge, unusual amount, new merchant).
5. Notify users based on preferences (email for MVP).
6. “Ask your spending” chat for a limited set of supported questions.
7. Secure auth, encryption, and data retention controls.

## 3) Non-Goals (MVP)
- Multi-currency conversion and tax/VAT reporting
- Full accounting exports (QuickBooks/Xero)
- Advanced ML anomaly models (beyond rules/statistics)
- Native mobile apps (web-first)
- Real-time bank sync via Plaid (upload-only for MVP)

## 4) Personas
- **Individual user (Personal workspace owner):** tracks personal spending, wants insights and alerts.
- **Team admin:** manages a team workspace, invites/removes members, assigns roles, configures workspace settings, and can view/edit all transactions.
- **Team member:** uploads receipts/CSVs, views/edits transactions, manages their own notification preferences.
- **Viewer:** read-only access to transactions and analytics.

## 4.5) Workspace & RBAC (Permanent Policy)
This product supports **Personal** and **Team** workspaces. Authorization is enforced via **RBAC** and applies consistently across all services, APIs, events, UI, testing, and deployment.

### Workspace Types
- **Personal Workspace:** single owner; owner has full read/write access.
- **Team Workspace:** shared workspace with roles: **Admin**, **Member**, **Viewer**.

### Team Roles (Authoritative)
- **Admin**
  - Invite/remove members
  - Change member roles
  - Manage workspace settings (e.g., retention, workspace-level defaults)
  - View/edit all transactions
- **Member**
  - Upload receipts/CSVs
  - View/edit transactions
  - Manage their own notification preferences
- **Viewer**
  - Read-only access to transactions and analytics
  - No uploads, no edits

### Enforcement Requirements (Permanent)
- Every request is scoped by `workspaceId` and authorized by role.
- Every transaction/upload/anomaly/insight belongs to exactly one `workspaceId`.
- UI must hide forbidden actions and backend must reject them (defense in depth).
- Audit logs record admin actions: invites/removals/role changes/settings updates.

## 5) Core User Stories (MVP)

### Authentication & Workspace
1. As a user, I can sign up/sign in securely.
2. As a user, I can create a personal workspace.
3. As an admin, I can create a team workspace and invite members.
4. As an admin, I can remove members from a team workspace.
5. As an admin, I can assign and change roles (Admin/Member/Viewer).
6. As an admin, I can manage workspace settings (e.g., retention, defaults).
7. As a viewer, I can access read-only views of transactions and analytics.

### Upload & Ingestion
8. As a user, I can upload a receipt image or PDF.
9. As a user, I can upload a CSV bank export (template documented).
10. As a user, I can see upload status (Queued → Processing → Completed/Failed).
11. As a user, I can view extracted fields (merchant/date/amount) and confidence.

### Transactions
12. As a user, I can view a list of transactions and filter by month/category/merchant.
13. As a user, I can edit a transaction’s merchant name, date, amount, and category.
14. As a team member, I can view/edit transactions within my workspace.
15. As a viewer, I cannot upload or edit transactions.
16. As a user, I can split a transaction into multiple categories (stretch; optional in MVP).

### Categorization
17. As a user, I want auto-categorization based on rules (merchant keywords).
18. As a user, if rules fail, I want AI fallback categorization with an explanation.
19. As a user, my manual corrections should be remembered for future (merchant→category rule).

### Analytics & Insights
20. As a user, I can view monthly totals by category and overall.
21. As a user, I can see trend insights comparing current month vs previous month.

### Anomalies & Subscriptions
22. As a user, I can see flagged anomalies and mark them as reviewed.
23. As a user, I want duplicate charge detection.
24. As a user, I want recurring subscription detection (same merchant, periodic cadence).

### Alerts & Notifications
25. As a user, I can configure notification preferences (email on/off, thresholds).
26. As a user, I receive an email when anomaly is detected or budget threshold exceeded.
27. As a team member, I can manage my own notification preferences.
28. As an admin, I can configure workspace-level defaults for retention and (optional) alert defaults.

### Chat (“Ask your spending”)
29. As a user, I can ask questions like:
- “What did I spend on groceries last month?”
- “Top 5 merchants this month”
- “How much did I spend dining out in January?”
- “Show anomalies this month”
- “What subscriptions do I have?”

## 6) MVP Insights (Top 5)
1. Month-over-month change per category (e.g., “Dining increased 22% vs last month”).
2. Top categories for the month.
3. Top merchants for the month.
4. Budget threshold warnings (simple category budgets).
5. Subscription summary (detected recurring charges).

## 7) MVP Anomaly Rules (Top 3)
1. **Duplicate charge:** same workspace + same merchant + same amount within N days (default 3 days).
2. **Unusual merchant:** merchant not seen in last 90 days AND amount > threshold (workspace-scoped).
3. **Unusual amount:** amount is > (mean + k*std) for that category over last 90 days (workspace-scoped; fallback: percentile threshold).

## 8) Data Retention & Privacy (MVP)
- Raw uploads stored encrypted; default retention: **180 days**, configurable by **Admin** (team workspace) or owner (personal).
- Derived transaction records retained until user/admin deletes workspace.
- “Delete my data” endpoint: deletes uploads + transactions + derived artifacts.
- Logs must not contain PII fields (mask where needed).

## 9) Non-Functional Requirements (MVP)
- Security: JWT auth, workspace-scoped **RBAC** enforced across all APIs and background jobs; encryption at rest/in transit.
- Reliability: ingestion pipeline supports retries + idempotency.
- Performance: dashboard loads < 2s for 1 year of data (target); async processing for OCR.
- Observability: structured logs + correlation IDs; basic dashboards/alarms.
- Cost: OCR/LLM usage capped per workspace (soft limit warnings).
- Policy stability: RBAC is foundational and must remain consistent across future releases unless an ADR explicitly supersedes it.

## 10) Acceptance Criteria (MVP)
- Upload receipt/PDF creates a transaction within 2–5 minutes (average) with confidence fields.
- Upload CSV imports all valid rows; invalid rows reported with reasons.
- At least 70% of transactions categorized via rules; remaining via AI fallback or “Uncategorized”.
- Monthly dashboard shows totals + top categories/merchants + trend insight.
- Duplicate detection flags obvious duplicates with review workflow.
- Email notifications delivered for anomalies and budget threshold crossings.
- Chat answers supported questions accurately based on stored transactions.
- Viewers cannot upload/edit; admins can manage members/roles/settings; members can upload and edit within workspace.

## 11) Milestones
- M1: Auth + workspace + upload service + S3 storage
- M2: Extraction pipeline + normalized transactions + transaction UI
- M3: Categorization (rules + AI fallback) + correction feedback loop
- M4: Analytics dashboard + monthly insights
- M5: Anomaly detection + subscriptions + notifications
- M6: Chat interface + guardrails + audit logs
