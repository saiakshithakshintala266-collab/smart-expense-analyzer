export type Role = "admin" | "member" | "viewer";

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
  category: string;
  source: string;
  notes?: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  yearMonth: string;
  totalAmount: number;
  transactionCount: number;
  currency: string;
  byCategory: { category: string; amount: number; count: number }[];
  bySource: { source: string; amount: number; count: number }[];
  topMerchants: { merchant: string; amount: number; count: number }[];
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
  role: string;
  expiresAt: string;
}