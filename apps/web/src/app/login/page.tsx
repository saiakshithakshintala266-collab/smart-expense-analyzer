"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { saveSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    if (!email || !password) { setError("Please enter email and password."); return; }
    if (mode === "signup" && !name) { setError("Please enter your name."); return; }

    setLoading(true);
    try {
      const data = mode === "login"
        ? await authApi.login({ email, password })
        : await authApi.signup({ email, password, name });

      saveSession(data);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="8" width="3" height="6" rx="1" fill="white"/>
              <rect x="6.5" y="5" width="3" height="9" rx="1" fill="white"/>
              <rect x="11" y="2" width="3" height="12" rx="1" fill="white"/>
            </svg>
          </div>
          <span className="font-display font-semibold text-lg text-foreground">Smart Expense</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h1 className="text-lg font-semibold text-foreground mb-1">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "login" ? "Sign in to your workspace" : "Start tracking your expenses"}
          </p>

          {mode === "signup" && (
            <div className="mb-4">
              <label className="block text-xs text-muted-foreground mb-1.5">Full name</label>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs text-muted-foreground mb-1.5">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs text-muted-foreground mb-1.5">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="input"
            />
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary w-full justify-center py-2.5 disabled:opacity-50"
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <p className="text-center text-xs text-muted-foreground mt-4">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
              className="text-primary hover:underline"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}