"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  MailCheck,
  CheckCircle2,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { RiskGauge } from "@/components/ui/risk-gauge";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";

export default function ResultsPage() {
  const [emails, setEmails] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [isCatchAll, setIsCatchAll] = useState("");
  const [isDisposable, setIsDisposable] = useState("");
  const [isRoleBased, setIsRoleBased] = useState("");
  const [sortBy, setSortBy] = useState("lastVerifiedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [exporting, setExporting] = useState(false);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (providerFilter) params.set("provider", providerFilter);
      if (isCatchAll) params.set("isCatchAll", isCatchAll);
      if (isDisposable) params.set("isDisposable", isDisposable);
      if (isRoleBased) params.set("isRoleBased", isRoleBased);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const res = await fetch(`/api/emails?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setEmails(json.data.emails || []);
        setPagination(json.data.pagination);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchResults();
  }, [pagination.page, statusFilter, providerFilter, isCatchAll, isDisposable, isRoleBased, sortBy, sortOrder]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchResults();
  };

  const handleExport = async (cleanOnly: boolean) => {
    setExporting(true);
    try {
      const res = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cleanListOnly: cleanOnly,
          statuses: statusFilter ? [statusFilter] : undefined,
          excludeDisposable: isDisposable === "false",
          includeCatchAll: isCatchAll === "true",
        }),
      });
      const json = await res.json();
      if (json.success && json.data.downloadUrl) {
        window.location.href = json.data.downloadUrl;
      }
    } catch {
      alert("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
            Verification Results Intelligence
          </h1>
          <p className="text-xs text-foreground-muted mt-1">
            Browse, filter, and export clean deliverable address lists.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleExport(true)}
            disabled={exporting}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Export Clean List</span>
          </button>
          <button
            onClick={() => handleExport(false)}
            disabled={exporting}
            className="px-3.5 py-2 bg-surface-elevated border border-border hover:border-border-strong text-foreground rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Filtered CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <form onSubmit={handleSearch} className="flex-1 w-full relative">
            <Search className="w-4 h-4 text-foreground-subtle absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by email address or domain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded-lg pl-9 pr-4 py-2 text-xs font-mono text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-primary"
            />
          </form>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">All Statuses</option>
              <option value="DELIVERABLE">Deliverable</option>
              <option value="UNDELIVERABLE">Undeliverable</option>
              <option value="RISKY">Risky</option>
              <option value="CATCH_ALL">Catch-All</option>
              <option value="DISPOSABLE">Disposable</option>
              <option value="ROLE_BASED">Role-Based</option>
              <option value="TEMPORARY">Temporary</option>
              <option value="UNKNOWN">Unknown</option>
            </select>

            {/* Provider Dropdown */}
            <select
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">All Mail Providers</option>
              <option value="Google Workspace">Google Workspace</option>
              <option value="Microsoft 365">Microsoft 365</option>
              <option value="Yahoo Mail">Yahoo Mail</option>
              <option value="Zoho Mail">Zoho Mail</option>
              <option value="Proton Mail">Proton Mail</option>
              <option value="Proofpoint">Proofpoint</option>
              <option value="Mimecast">Mimecast</option>
              <option value="Amazon SES">Amazon SES</option>
            </select>

            {/* Sort Select */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split("-");
                setSortBy(sb);
                setSortOrder(so);
              }}
              className="bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
            >
              <option value="lastVerifiedAt-desc">Recently Verified</option>
              <option value="riskScore-desc">Highest Risk</option>
              <option value="riskScore-asc">Lowest Risk</option>
              <option value="email-asc">Email (A-Z)</option>
            </select>

            <button
              onClick={fetchResults}
              title="Refresh"
              className="p-2 rounded-lg bg-surface-elevated border border-border hover:border-border-strong text-foreground-subtle hover:text-foreground"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Checkbox Quick Flags */}
        <div className="flex flex-wrap items-center gap-5 pt-2 border-t border-border/50 text-xs font-mono text-foreground-muted">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isCatchAll === "true"}
              onChange={(e) => setIsCatchAll(e.target.checked ? "true" : "")}
              className="rounded border-border bg-surface-elevated text-primary focus:ring-0"
            />
            <span>Catch-All Only</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isDisposable === "true"}
              onChange={(e) => setIsDisposable(e.target.checked ? "true" : "")}
              className="rounded border-border bg-surface-elevated text-primary focus:ring-0"
            />
            <span>Disposable Only</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isRoleBased === "true"}
              onChange={(e) => setIsRoleBased(e.target.checked ? "true" : "")}
              className="rounded border-border bg-surface-elevated text-primary focus:ring-0"
            />
            <span>Role-Based Only</span>
          </label>

          <span className="ml-auto text-foreground-subtle">
            Total records found: <strong className="text-foreground">{pagination.total.toLocaleString()}</strong>
          </span>
        </div>
      </div>

      {/* Results Data Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-border bg-surface-elevated/40 text-[11px] uppercase tracking-wider text-foreground-subtle">
                <th className="p-3 pl-4">Email</th>
                <th className="p-3">Status</th>
                <th className="p-3">Risk</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">SMTP Response</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Catch-All</th>
                <th className="p-3">Disposable</th>
                <th className="p-3">Role</th>
                <th className="p-3 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {emails.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-foreground-muted">
                    {loading ? "Loading records..." : "No verification results found matching your criteria."}
                  </td>
                </tr>
              ) : (
                emails.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-elevated/30 transition-colors">
                    <td className="p-3 pl-4 font-semibold text-foreground">
                      <Link href={`/emails/${encodeURIComponent(row.normalizedEmail)}`} className="hover:text-primary">
                        {row.originalEmail}
                      </Link>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={row.finalStatus} size="sm" />
                    </td>
                    <td className="p-3">
                      <RiskGauge score={row.riskScore} size="sm" />
                    </td>
                    <td className="p-3">
                      <ConfidenceBadge confidence={row.confidence} />
                    </td>
                    <td className="p-3 text-foreground-subtle truncate max-w-xs">
                      {row.smtpCode ? `[${row.smtpCode}] ${row.smtpResponse || ""}` : "—"}
                    </td>
                    <td className="p-3 text-foreground-muted truncate max-w-[120px]">
                      {row.providerName || "Unknown"}
                    </td>
                    <td className="p-3 text-foreground-subtle">
                      {row.catchAllStatus ? <span className="text-yellow-400 font-semibold">YES</span> : "NO"}
                    </td>
                    <td className="p-3 text-foreground-subtle">
                      {row.disposableStatus ? <span className="text-pink-400 font-semibold">YES</span> : "NO"}
                    </td>
                    <td className="p-3 text-foreground-subtle">
                      {row.roleBasedStatus ? <span className="text-purple-400 font-semibold">YES</span> : "NO"}
                    </td>
                    <td className="p-3 pr-4 text-right">
                      <Link
                        href={`/emails/${encodeURIComponent(row.normalizedEmail)}`}
                        className="px-2 py-1 rounded bg-surface-elevated border border-border hover:border-primary text-foreground hover:text-primary transition-colors text-xs font-sans"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-border flex items-center justify-between text-xs font-mono text-foreground-muted">
          <div>
            Page {pagination.page} of {Math.max(pagination.totalPages, 1)} ({pagination.total.toLocaleString()} total items)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded bg-surface-elevated border border-border hover:border-border-strong disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
              disabled={pagination.page >= pagination.totalPages}
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
