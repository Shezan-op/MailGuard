"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Mail, ExternalLink, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { RiskGauge } from "@/components/ui/risk-gauge";

export default function EmailsDirectoryPage() {
  const [emails, setEmails] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "25");
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/emails?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setEmails(json.data.emails || []);
        setTotal(json.data.pagination.total);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchEmails();
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEmails();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
          Address Intelligence Directory
        </h1>
        <p className="text-xs text-foreground-muted mt-1">
          Historical evaluation logs, SMTP event transcripts, and deliverability records for all unique addresses.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="w-4 h-4 text-foreground-subtle absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Search verified email addresses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-elevated border border-border rounded-lg pl-10 pr-4 py-2 text-xs font-mono text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-primary"
          />
        </form>
        <button
          onClick={fetchEmails}
          className="p-2 rounded-lg bg-surface-elevated border border-border hover:border-border-strong text-foreground-subtle hover:text-foreground"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse font-mono">
          <thead>
            <tr className="border-b border-border bg-surface-elevated/40 text-[11px] uppercase tracking-wider text-foreground-subtle">
              <th className="p-3 pl-4">Normalized Email</th>
              <th className="p-3">Status</th>
              <th className="p-3">Risk</th>
              <th className="p-3">Provider</th>
              <th className="p-3">Domain</th>
              <th className="p-3">Verified Count</th>
              <th className="p-3">Last Verified</th>
              <th className="p-3 pr-4 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {emails.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-foreground-muted">
                  {loading ? "Loading addresses..." : "No email records found."}
                </td>
              </tr>
            ) : (
              emails.map((row) => (
                <tr key={row.id} className="hover:bg-surface-elevated/30 transition-colors">
                  <td className="p-3 pl-4 font-semibold text-foreground">
                    <Link href={`/emails/${encodeURIComponent(row.normalizedEmail)}`} className="hover:text-primary">
                      {row.normalizedEmail}
                    </Link>
                  </td>
                  <td className="p-3">
                    <StatusBadge status={row.finalStatus} size="sm" />
                  </td>
                  <td className="p-3">
                    <RiskGauge score={row.riskScore} size="sm" />
                  </td>
                  <td className="p-3 text-foreground-muted">{row.providerName || "Unknown"}</td>
                  <td className="p-3 text-foreground-subtle">{row.domain}</td>
                  <td className="p-3 text-foreground-muted">{row.verificationCount}</td>
                  <td className="p-3 text-foreground-subtle">
                    {new Date(row.lastVerifiedAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 pr-4 text-right">
                    <Link
                      href={`/emails/${encodeURIComponent(row.normalizedEmail)}`}
                      className="px-2 py-1 rounded bg-surface-elevated border border-border hover:border-primary text-foreground hover:text-primary text-xs"
                    >
                      Detail
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="p-4 border-t border-border flex items-center justify-between text-xs font-mono text-foreground-muted">
          <div>Total unique addresses: {total.toLocaleString()}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded bg-surface-elevated border border-border hover:border-border-strong disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={emails.length < 25}
              className="p-1.5 rounded bg-surface-elevated border border-border hover:border-border-strong disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
