import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Smart Expense Analyzer",
  description: "AI-powered expense insights for individuals and teams.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}