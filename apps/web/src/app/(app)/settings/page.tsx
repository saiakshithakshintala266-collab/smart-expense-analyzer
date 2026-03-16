"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { getSession, clearSession } from "@/lib/auth";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const router = useRouter();
  const session = getSession();
  const [notifications, setNotifications] = useState({
    anomalyAlerts: true,
    monthlyDigest: true,
    budgetWarnings: false,
  });

  function handleLogout() {
    clearSession();
    router.push("/login");
    toast.success("Signed out successfully");
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      <PageHeader
        title="Settings"
        description="Workspace and account preferences"
        icon={Settings}
      />

      {/* Account */}
      <div className="rounded-xl border border-border bg-card p-5 mb-4">
        <h2 className="text-sm font-medium text-foreground mb-4">Account</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Name</label>
            <input
              type="text"
              defaultValue={session?.name ?? ""}
              readOnly
              className="input bg-secondary/50 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Email</label>
            <input
              type="email"
              defaultValue={session?.email ?? ""}
              readOnly
              className="input bg-secondary/50 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Role</label>
            <input
              type="text"
              defaultValue={session?.role ?? ""}
              readOnly
              className="input bg-secondary/50 cursor-not-allowed capitalize"
            />
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div className="rounded-xl border border-border bg-card p-5 mb-4">
        <h2 className="text-sm font-medium text-foreground mb-4">Workspace</h2>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Default currency</label>
          <input
            type="text"
            defaultValue="USD"
            readOnly
            className="input bg-secondary/50 cursor-not-allowed w-24"
          />
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-border bg-card p-5 mb-4">
        <h2 className="text-sm font-medium text-foreground mb-4">Notifications</h2>
        <div className="flex flex-col gap-4">
          {[
            { key: "anomalyAlerts", label: "Anomaly alerts", desc: "Get notified when unusual transactions are detected" },
            { key: "monthlyDigest", label: "Monthly digest", desc: "Receive a monthly summary of your spending" },
            { key: "budgetWarnings", label: "Budget warnings", desc: "Alert when approaching spending limits" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <button
                onClick={() => setNotifications((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                  notifications[key as keyof typeof notifications] ? "bg-primary" : "bg-secondary border border-border"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                  notifications[key as keyof typeof notifications] ? "translate-x-4" : "translate-x-0.5"
                }`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5">
        <h2 className="text-sm font-medium text-rose-400 mb-4">Sign out</h2>
        <p className="text-xs text-muted-foreground mb-4">
          You will be signed out of your account and redirected to the login page.
        </p>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}