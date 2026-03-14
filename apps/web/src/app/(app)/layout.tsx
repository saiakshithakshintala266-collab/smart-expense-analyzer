"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { getSession } from "@/lib/auth";
import { Toaster } from "react-hot-toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!getSession()) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "hsl(224 15% 11%)",
            color: "hsl(213 31% 91%)",
            border: "1px solid hsl(224 15% 18%)",
            fontSize: "13px",
          },
        }}
      />
    </div>
  );
}