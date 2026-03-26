import axios, { AxiosInstance } from "axios";
import { getToken } from "./auth";

function createClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: { "Content-Type": "application/json" },
  });

  client.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      const message = err.response?.data?.message || err.message || "Unknown error";
      return Promise.reject(new Error(message));
    }
  );

  return client;
}

const BASE = {
  auth:         process.env.NEXT_PUBLIC_AUTH_SERVICE_URL         || "http://localhost:3009",
  upload:       process.env.NEXT_PUBLIC_UPLOAD_SERVICE_URL       || "http://localhost:3001",
  extraction:   process.env.NEXT_PUBLIC_EXTRACTION_SERVICE_URL   || "http://localhost:3002",
  transactions: process.env.NEXT_PUBLIC_TRANSACTIONS_SERVICE_URL || "http://localhost:3003",
  analytics:    process.env.NEXT_PUBLIC_ANALYTICS_SERVICE_URL    || "http://localhost:3005",
  anomaly:      process.env.NEXT_PUBLIC_ANOMALY_SERVICE_URL      || "http://localhost:3006",
  notification: process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL || "http://localhost:3007",
  chat:         process.env.NEXT_PUBLIC_CHAT_SERVICE_URL         || "http://localhost:3008",
};

const WS = () => {
  if (typeof window === "undefined") return "ws-default";
  try {
    const raw = localStorage.getItem("sea_session");
    if (!raw) return "ws-default";
    return JSON.parse(raw).workspaceId ?? "ws-default";
  } catch {
    return "ws-default";
  }
};

const authClient       = createClient(BASE.auth);
const upload           = createClient(BASE.upload);
const transactions     = createClient(BASE.transactions);
const analytics        = createClient(BASE.analytics);
const anomaly          = createClient(BASE.anomaly);
const notification     = createClient(BASE.notification);
const chat             = createClient(BASE.chat);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  signup: (data: { email: string; password: string; name: string }) =>
    authClient.post("/auth/signup", data).then((r) => r.data),

  login: (data: { email: string; password: string }) =>
    authClient.post("/auth/login", data).then((r) => r.data),

  logout: (token: string) =>
    authClient.post("/auth/logout", {}, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.data),

  me: (token: string) =>
    authClient.get("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.data),
};

// ── Uploads ───────────────────────────────────────────────────────────────────

export const uploadsApi = {
  create: (data: { originalFileName: string; contentType: string; sizeBytes: number; source: string }) =>
    upload.post(`/workspaces/${WS()}/uploads`, data).then((r) => r.data),

  finalize: (id: string) =>
    upload.post(`/workspaces/${WS()}/uploads/${id}/finalize`, {}).then((r) => r.data),

  list: (params?: { status?: string }) =>
    upload.get(`/workspaces/${WS()}/uploads`, { params }).then((r) => r.data),

  get: (id: string) =>
    upload.get(`/workspaces/${WS()}/uploads/${id}`).then((r) => r.data),

  delete: (id: string) =>
    upload.delete(`/workspaces/${WS()}/uploads/${id}`).then((r) => r.data),
};

// ── Transactions ──────────────────────────────────────────────────────────────

export const transactionsApi = {
  list: (params?: { dateFrom?: string; dateTo?: string; nextPageToken?: string }) =>
    transactions.get(`/workspaces/${WS()}/transactions`, { params }).then((r) => r.data),

  get: (id: string) =>
    transactions.get(`/workspaces/${WS()}/transactions/${id}`).then((r) => r.data),

  correct: (id: string, data: { category?: string; merchant?: string; amount?: number }) =>
    transactions.patch(`/workspaces/${WS()}/transactions/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    transactions.delete(`/workspaces/${WS()}/transactions/${id}`).then((r) => r.data),

  deleteByUpload: (uploadFileId: string) =>
    transactions.delete(`/workspaces/${WS()}/transactions/by-upload/${uploadFileId}`).then((r) => r.data),
};

// ── Analytics ─────────────────────────────────────────────────────────────────

export const analyticsApi = {
  getSummary: (params?: { yearMonth?: string }) =>
    analytics.get(`/workspaces/${WS()}/analytics/summary`, { params }).then((r) => r.data),

  getDaily: (params?: { yearMonth?: string; dateFrom?: string; dateTo?: string }) =>
    analytics.get(`/workspaces/${WS()}/analytics/daily`, { params }).then((r) => r.data),

  getTrends: (params?: { months?: number }) =>
    analytics.get(`/workspaces/${WS()}/analytics/trends`, { params }).then((r) => r.data),
};

// ── Anomalies ─────────────────────────────────────────────────────────────────

export const anomalyApi = {
  list: (params?: { status?: "OPEN" | "DISMISSED" }) =>
    anomaly.get(`/workspaces/${WS()}/anomalies`, { params: { status: "OPEN", ...params } }).then((r) => r.data),
};

// ── Notifications ─────────────────────────────────────────────────────────────

export const notificationsApi = {
  list: (params?: { status?: string }) =>
    notification.get(`/workspaces/${WS()}/notifications`, { params }).then((r) => r.data),

  markRead: (id: string) =>
    notification.patch(`/workspaces/${WS()}/notifications/${id}/read`, {}).then((r) => r.data),

  markAllRead: () =>
    notification.post(`/workspaces/${WS()}/notifications/read-all`, {}).then((r) => r.data),
};

// ── Chat ──────────────────────────────────────────────────────────────────────

export const chatApi = {
  sendMessage: (message: string, conversationId?: string) =>
    chat.post(`/workspaces/${WS()}/chat/messages`, { message, conversationId }).then((r) => r.data),

  getConversations: () =>
    chat.get(`/workspaces/${WS()}/chat/conversations`).then((r) => r.data),

  getMessages: (conversationId: string) =>
    chat.get(`/workspaces/${WS()}/chat/conversations/${conversationId}/messages`).then((r) => r.data),
};