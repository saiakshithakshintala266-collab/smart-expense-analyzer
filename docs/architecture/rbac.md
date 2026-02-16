# RBAC Policy (v1)
**File:** `docs/architecture/rbac.md`  
**Status:** Frozen for v1 (changes require an ADR under `docs/decisions/`)  
**Last updated:** 2026-02-16

## 1) Scope
This document defines the **authoritative** role-based access control (RBAC) for:
- **Personal workspaces** (single owner)
- **Team workspaces** (Admin/Member/Viewer)

RBAC rules apply consistently across:
- UI (buttons/routes hidden/disabled)
- API gateways/services (server-side enforcement; defense in depth)
- Async workers/jobs (must validate role + workspace scope)
- Events (must include workspace scope; consumers must enforce scope)

## 2) Roles
### Workspace Types
- **Personal Workspace:** single owner with full read/write.
- **Team Workspace:** shared with roles below.

### Team Roles
- **Admin**
  - Invite/remove members
  - Change roles
  - Manage workspace settings (retention, defaults)
  - View/edit all transactions
- **Member**
  - Upload receipts/CSVs
  - View/edit transactions
  - Manage **their own** notification preferences
- **Viewer**
  - Read-only access to transactions and analytics
  - No uploads, no edits

## 3) Global Enforcement Rules (Hard Requirements)
1. Every request is scoped by `workspaceId`.
2. Every domain object includes `workspaceId` (uploads, extracted docs, transactions, insights, anomalies, subscriptions, budgets, notifications).
3. Backend services **must** validate:
   - JWT signature/claims
   - `workspaceId` access (membership)
   - role permission for the action
4. UI must not present forbidden actions, but server remains authoritative.
5. All admin actions are audit-logged (invite/remove/change role/settings).

## 4) Permissions Matrix (v1)
Legend: ✅ allowed, ❌ forbidden

### 4.1 Workspace & Membership
| Action | Personal Owner | Team Admin | Team Member | Team Viewer |
|---|---:|---:|---:|---:|
| Create personal workspace | ✅ | N/A | N/A | N/A |
| Create team workspace | N/A | ✅ | ❌ | ❌ |
| Invite member | N/A | ✅ | ❌ | ❌ |
| Remove member | N/A | ✅ | ❌ | ❌ |
| Change roles | N/A | ✅ | ❌ | ❌ |
| View member list | N/A | ✅ | ✅ | ✅ |
| Leave workspace | N/A | ✅ | ✅ | ✅ |
| Delete workspace | ✅ | ✅ | ❌ | ❌ |
| Manage workspace settings (retention/defaults) | ✅ | ✅ | ❌ | ❌ |

### 4.2 Uploads & Ingestion
| Action | Personal Owner | Team Admin | Team Member | Team Viewer |
|---|---:|---:|---:|---:|
| Create upload (get presigned URL) | ✅ | ✅ | ✅ | ❌ |
| Upload file to storage | ✅ | ✅ | ✅ | ❌ |
| Finalize upload / start processing | ✅ | ✅ | ✅ | ❌ |
| View upload status/log | ✅ | ✅ | ✅ | ✅ |
| Delete raw upload artifact | ✅ | ✅ | ❌ | ❌ |

### 4.3 Extraction Results
| Action | Personal Owner | Team Admin | Team Member | Team Viewer |
|---|---:|---:|---:|---:|
| View extracted fields/confidence | ✅ | ✅ | ✅ | ✅ |
| Trigger re-extraction (retry) | ✅ | ✅ | ✅ | ❌ |
| Edit extracted fields (before transaction) | ✅ | ✅ | ✅ | ❌ |

### 4.4 Transactions
| Action | Personal Owner | Team Admin | Team Member | Team Viewer |
|---|---:|---:|---:|---:|
| List/view transactions | ✅ | ✅ | ✅ | ✅ |
| Create transaction (manual) | ✅ | ✅ | ✅ | ❌ |
| Edit transaction (merchant/date/amount/category/notes) | ✅ | ✅ | ✅ | ❌ |
| Split transaction (optional MVP stretch) | ✅ | ✅ | ✅ | ❌ |
| Delete transaction | ✅ | ✅ | ✅ (optional: allow) | ❌ |
| Export transactions (CSV) | ✅ | ✅ | ✅ | ✅ |

> v1 note: Member delete is allowed by default for simplicity. If you want stricter control, change to Admin-only and document via ADR.

### 4.5 Categorization
| Action | Personal Owner | Team Admin | Team Member | Team Viewer |
|---|---:|---:|---:|---:|
| View category on transactions | ✅ | ✅ | ✅ | ✅ |
| Update category on a transaction | ✅ | ✅ | ✅ | ❌ |
| Create/update personal rules (merchant→category) | ✅ | ✅ | ✅ | ❌ |
| Manage global workspace rules | ✅ | ✅ | ❌ | ❌ |

> v1 definition: “global workspace rules” affect all members; only Admin can manage these.

### 4.6 Analytics & Insights
| Action | Personal Owner | Team Admin | Team Member | Team Viewer |
|---|---:|---:|---:|---:|
| View monthly summaries | ✅ | ✅ | ✅ | ✅ |
| View insights (MoM changes/top merchants) | ✅ | ✅ | ✅ | ✅ |
| Create/edit budgets | ✅ | ✅ | ✅ | ❌ |
| View budgets | ✅ | ✅ | ✅ | ✅ |

### 4.7 Anomalies & Subscriptions
| Action | Personal Owner | Team Admin | Team Member | Team Viewer |
|---|---:|---:|---:|---:|
| View anomalies | ✅ | ✅ | ✅ | ✅ |
| Mark anomaly reviewed/ignored | ✅ | ✅ | ✅ | ❌ |
| View detected subscriptions | ✅ | ✅ | ✅ | ✅ |
| Manage subscription labels (optional) | ✅ | ✅ | ✅ | ❌ |

### 4.8 Notifications & Preferences
| Action | Personal Owner | Team Admin | Team Member | Team Viewer |
|---|---:|---:|---:|---:|
| View my notification preferences | ✅ | ✅ | ✅ | ✅ |
| Update my notification preferences | ✅ | ✅ | ✅ | ✅ |
| View workspace default notification settings | ✅ | ✅ | ✅ | ✅ |
| Update workspace default notification settings | ✅ | ✅ | ❌ | ❌ |

> v1 requirement: Members can manage **only their own** notification preferences.

### 4.9 Chat (“Ask your spending”)
| Action | Personal Owner | Team Admin | Team Member | Team Viewer |
|---|---:|---:|---:|---:|
| Ask spending questions (workspace scoped) | ✅ | ✅ | ✅ | ✅ |
| Chat access respects read permissions (no hidden data) | ✅ | ✅ | ✅ | ✅ |

## 5) API/AuthZ Implementation Requirements (v1)
- JWT includes: `sub` (userId), plus workspace membership claims or resolvable membership.
- Every API path includes `workspaceId` (path or header), and service verifies membership.
- All list/query operations must filter by `workspaceId` server-side.
- All writes must set/validate `workspaceId` server-side; never trust client input.

## 6) Audit Logging (v1)
Must audit-log these events (at minimum):
- Invite member
- Remove member
- Change role
- Update workspace settings (retention/defaults)
- Delete workspace
- Bulk imports (CSV upload finalize)

Audit log fields (minimum):
- `workspaceId`, `actorUserId`, `action`, `targetUserId` (if any), `timestamp`, `requestId`

## 7) Change Control
RBAC changes are **breaking** and must be documented via ADR:
- Create a new file under `docs/decisions/ADR-xxxx-rbac-change.md`
- Update this file and PRD accordingly
