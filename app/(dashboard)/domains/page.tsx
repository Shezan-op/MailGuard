"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Globe2, RefreshCw, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";

export default function DomainsPage() {
  const [domains, setDomains] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "25");
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/domains?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setDomains(json.data.domains || []);
        setTotal(json.data.pagination.total);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchDomains();
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDomains();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
          Domain Deliverability Intelligence
        </h1>
        <p className="text-xs text-foreground-muted mt-1">
          Cached MX records, provider fingerprints, catch-all profiles, and historical bounce intelligence per domain.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="w-4 h-4 text-foreground-subtle absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Search domain intelligence (e.g. google.com, acme.co)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-elevated border border-border rounded-lg pl-10 pr-4 py-2 text-xs font-mono text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-primary"
          />
        </form>
        <button
          onClick={fetchDomains}
          className="p-2 rounded-lg bg-surface-elevated border border-border hover:border-border-strong text-foreground-subtle hover:text-foreground"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse font-mono">
          <thead>
            <tr className="border-b border-border bg-surface-elevated/40 text-[11px] uppercase tracking-wider text-foreground-subtle">
              <th className="p-3 pl-4">Domain</th>
              <th className="p-3">Provider</th>
              <th className="p-3">Catch-All</th>
              <th className="p-3">Primary MX</th>
              <th className="p-3">Verified Count</th>
              <th className="p-3">Historical Deliverability</th>
              <th className="p-3">Historical Bounce</th>
              <th className="p-3 pr-4 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {domains.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-foreground-muted">
                  {loading ? "Loading domain intelligence..." : "No domains recorded yet."}
                </td>
              </tr>
            ) : (
              domains.map((row) => (
                <tr key={row.id} className="hover:bg-surface-elevated/30 transition-colors">
                  <td className="p-3 pl-4 font-semibold text-foreground">
                    <Link href={`/domains/${encodeURIComponent(row.domain)}`} className="hover:text-primary flex items-center gap-1.5">
                      <Globe2 className="w-3.5 h-3.5 text-primary" />
                      <span>{row.domain}</span>
                    </Link>
                  </td>
                  <td className="p-3 text-foreground-muted">{row.provider}</td>
                  <td className="p-3">
                    {row.isCatchAll ? (
                      <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[11px] font-semibold">
                        CATCH-ALL
                      </span>
                    ) : (
                      <span className="text-foreground-subtle">NO</span>
                    )}
                  </td>
                  <td className="p-3 text-foreground-subtle truncate max-w-[160px]">
                    {row.primaryMx || "None"}
                  </td>
                  <td className="p-3 font-semibold text-foreground">{row.verificationCount}</td>
                  <td className="p-3 text-emerald-400 font-semibold">
                    {(row.historicalDeliverabilityRate / 100).toFixed(1)}%
                  </td>
                  <td className="p-3 text-red-400 font-semibold">
                    {(row.historicalBounceRate / 100).toFixed(1)}%
                  </td>
                  <td className="p-3 pr-4 text-right">
                    <Link
                      href={`/domains/${encodeURIComponent(row.domain)}`}
                      className="px-2 py-1 rounded bg-surface-elevated border border-border hover:border-primary text-foreground hover:text-primary text-xs"
                    >
                      Health & Auth
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="p-4 border-t border-border flex items-center justify-between text-xs font-mono text-foreground-muted">
          <div>Total tracked domains: {total.toLocaleString()}</div>
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
              disabled={domains.length < 25}
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
