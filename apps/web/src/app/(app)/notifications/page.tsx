"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { notificationsApi } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await notificationsApi.list();
      setNotifications(Array.isArray(data) ? data : data.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
      );
    } catch {
      // ignore
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, status: "read" as const })));
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <PageHeader
          title="Notifications"
          description={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          icon={Bell}
        />
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications"
            description="You're all caught up. Notifications will appear here when there's activity."
          />
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-4 px-5 py-4 transition-colors",
                  n.status === "unread" ? "bg-secondary/30" : ""
                )}
              >
                <div className={cn(
                  "mt-1 h-2 w-2 rounded-full flex-shrink-0",
                  n.status === "unread" ? "bg-primary" : "bg-transparent"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(n.createdAt)}</p>
                </div>
                {n.status === "unread" && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
