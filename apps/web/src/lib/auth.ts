const KEY = "sea_session";

export interface SessionData {
  sessionToken: string;
  userId: string;
  email: string;
  name: string;
  workspaceId: string;
  expiresAt: string;
}

export function saveSession(data: SessionData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as SessionData;
    if (new Date(session.expiresAt) < new Date()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}

export function getToken(): string | null {
  return getSession()?.sessionToken ?? null;
}

export function getWorkspaceId(): string {
  return getSession()?.workspaceId ?? "ws-default";
}