"use client";

import { useEffect, useState } from "react";
import { List, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { transactionsApi } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Transaction } from "@/types";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(pageToken?: string) {
    setLoading(true);
    try {
      const res = await transactionsApi.list({ nextPageToken: pageToken });
      const items = res.items ?? [];
      setTransactions(pageToken ? (prev) => [...prev, ...items] : items);
      setNextPageToken(res.nextPageToken ?? null);
    } finally {
      setLoading(false);
    }
  }

  const filtered = transactions.filter((tx) =>
    tx.merchant?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Transactions"
        description={`${transactions.length} transactions`}
        icon={List}
      />

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search merchant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-border bg-secondary/50">
          <div className="col-span-5 text-xs font-medium text-muted-foreground">Merchant</div>
          <div className="col-span-3 text-xs font-medium text-muted-foreground">Date</div>
          <div className="col-span-2 text-xs font-medium text-muted-foreground">Source</div>
          <div className="col-span-2 text-xs font-medium text-muted-foreground text-right">Amount</div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={List}
            title="No transactions found"
            description="Upload a bank statement or receipt to see your transactions here."
          />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((tx) => (
              <div key={tx.id} className="grid grid-cols-12 gap-4 px-5 py-3.5 hover:bg-secondary/30 transition-colors">
                <div className="col-span-5 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-xs font-medium text-muted-foreground flex-shrink-0">
                    {tx.merchant?.slice(0, 2).toUpperCase() ?? "??"}
                  </div>
                  <span className="text-sm font-medium text-foreground truncate">{tx.merchant}</span>
                </div>
                <div className="col-span-3 flex items-center text-sm text-muted-foreground">
                  {formatDate(tx.date)}
                </div>
                <div className="col-span-2 flex items-center text-xs text-muted-foreground capitalize">
                  {tx.source}
                </div>
                <div className="col-span-2 flex items-center justify-end text-sm font-medium text-foreground">
                  {formatCurrency(tx.amount, tx.currency)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Load more */}
      {nextPageToken && (
        <div className="mt-4 text-center">
          <button
            onClick={() => load(nextPageToken)}
            className="btn-ghost text-sm"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
