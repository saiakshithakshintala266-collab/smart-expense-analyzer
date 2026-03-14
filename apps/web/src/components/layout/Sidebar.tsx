"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Upload, List, TrendingUp,
  AlertTriangle, Bell, MessageSquare, Settings, LogOut,
} from "lucide-react";
import { clearSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { href: "/uploads",       label: "Uploads",        icon: Upload },
  { href: "/transactions",  label: "Transactions",   icon: List },
  { href: "/insights",      label: "Insights",       icon: TrendingUp },
  { href: "/anomalies",     label: "Anomalies",      icon: AlertTriangle },
  { href: "/notifications", label: "Notifications",  icon: Bell },
  { href: "/chat",          label: "AI Chat",        icon: MessageSquare },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  return (
    <aside className="flex h-screen w-52 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="8" width="3" height="6" rx="1" fill="white"/>
            <rect x="6.5" y="5" width="3" height="9" rx="1" fill="white"/>
            <rect x="11" y="2" width="3" height="12" rx="1" fill="white"/>
          </svg>
        </div>
        <span className="font-display font-semibold text-sm text-foreground">Smart Expense</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-2 flex-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="flex flex-col gap-0.5 px-2 pb-4">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname === "/settings"
              ? "bg-secondary text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors w-full text-left"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}