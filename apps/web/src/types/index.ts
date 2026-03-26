export interface UploadFile {
  id: string;
  workspaceId: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  source: string;
  status: "pending" | "uploaded" | "processing" | "completed" | "failed";
  storageKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  workspaceId: string;
  uploadFileId?: string;
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  source: string;
  notes?: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  yearMonth: string;
  totalAmount: number;
  transactionCount: number;
  currency: string;
  bySource: { source: string; totalAmount: number; transactionCount: number; currency: string }[];
  topMerchants: { merchant: string; totalAmount: number; transactionCount: number; currency: string }[];
}

export interface DailyAnalytics {
  date: string;
  totalAmount: number;
  transactionCount: number;
}

export interface Anomaly {
  id: string;
  workspaceId: string;
  transactionId: string;
  type: string;
  severity: "low" | "medium" | "high";
  description: string;
  acknowledged: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  workspaceId: string;
  type: string;
  title: string;
  body: string;
  status: "unread" | "read";
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  workspaceId: string;
  title?: string;
  createdAt: string;
}

export interface SessionData {
  sessionToken: string;
  userId: string;
  email: string;
  name: string;
  workspaceId: string;
  expiresAt: string;
}