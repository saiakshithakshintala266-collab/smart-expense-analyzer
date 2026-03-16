"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { notificationsApi } from "@/lib/api";
import { formatRelativeTime, cn } from "@/lib/utils";
import type { Notification } from "@/types";
import toast from "react-hot-toast";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await notificationsApi.list();
      const items = res.notifications ?? res.items ?? (Array.isArray(res) ? res : []);
      setNotifications(items);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
      );
    } catch {
      toast.error("Failed to mark as read");
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, status: "read" as const })));
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        icon={Bell}
        actions={
          unreadCount > 0 ? (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="btn-ghost text-xs flex items-center gap-1.5"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {markingAll ? "Marking..." : "Mark all read"}
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="You'll receive notifications when transactions are processed, anomalies are detected, and more."
          />
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => n.status === "unread" && markRead(n.id)}
                className={cn(
                  "flex items-start gap-4 px-5 py-4 transition-colors",
                  n.status === "unread"
                    ? "bg-primary/5 hover:bg-primary/8 cursor-pointer"
                    : "hover:bg-secondary/30"
                )}
              >
                {/* Unread dot */}
                <div className="mt-1.5 flex-shrink-0">
                  {n.status === "unread" ? (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-border" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm",
                    n.status === "unread" ? "font-medium text-foreground" : "text-muted-foreground"
                  )}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1" suppressHydrationWarning>
                    {formatRelativeTime(n.createdAt)}
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full border",
                    n.status === "unread"
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-secondary text-muted-foreground border-border"
                  )}>
                    {n.type?.toLowerCase().replace(/_/g, " ") ?? "notification"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}