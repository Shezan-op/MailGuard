"use client";

import React, { useState, useEffect } from "react";
import { Search, ShieldBan, Plus, Trash2, RefreshCw, AlertTriangle } from "lucide-react";

export default function SuppressionsPage() {
  const [suppressions, setSuppressions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTarget, setNewTarget] = useState("");
  const [targetType, setTargetType] = useState<"email" | "domain">("email");
  const [newType, setNewType] = useState("manual");
  const [newReason, setNewReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchSuppressions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/suppressions?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setSuppressions(json.data.suppressions || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppressions();
  }, [typeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSuppressions();
  };

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTarget.trim()) return;

    setSubmitting(true);
    try {
      await fetch("/api/suppressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetType === "email" ? newTarget.trim() : undefined,
          domain: targetType === "domain" ? newTarget.trim() : undefined,
          type: newType,
          reason: newReason.trim() || "Manual addition by administrator",
        }),
      });

      setShowAddModal(false);
      setNewTarget("");
      setNewReason("");
      fetchSuppressions();
    } catch {
      alert("Failed to add suppression");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this entry from the suppression list?")) return;
    try {
      await fetch(`/api/suppressions/${id}`, { method: "DELETE" });
      fetchSuppressions();
    } catch {}
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
            Suppression Management
          </h1>
          <p className="text-xs text-foreground-muted mt-1">
            Maintain hard bounce, spam complaint, unsubscribe, and manual exclusion lists.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Suppression</span>
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
        <form onSubmit={handleSearch} className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-foreground-subtle absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Search suppressions by email or domain..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-elevated border border-border rounded-lg pl-10 pr-4 py-2 text-xs font-mono text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-primary"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
          >
            <option value="">All Categories</option>
            <option value="hard_bounce">Hard Bounce</option>
            <option value="spam_complaint">Spam Complaint</option>
            <option value="manual">Manual Exclusion</option>
            <option value="known_bad">Known Bad</option>
            <option value="known_trap">Known Trap</option>
            <option value="unsubscribe">Unsubscribe</option>
          </select>

          <button
            onClick={fetchSuppressions}
            className="p-2 rounded-lg bg-surface-elevated border border-border hover:border-border-strong text-foreground-subtle hover:text-foreground"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse font-mono">
          <thead>
            <tr className="border-b border-border bg-surface-elevated/40 text-[11px] uppercase tracking-wider text-foreground-subtle">
              <th className="p-3 pl-4">Target Address / Domain</th>
              <th className="p-3">Type</th>
              <th className="p-3">Reason</th>
              <th className="p-3">Source</th>
              <th className="p-3">Added Date</th>
              <th className="p-3 pr-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {suppressions.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-foreground-muted">
                  {loading ? "Loading suppressions..." : "No suppressions recorded in this list."}
                </td>
              </tr>
            ) : (
              suppressions.map((s) => (
                <tr key={s.id} className="hover:bg-surface-elevated/30 transition-colors">
                  <td className="p-3 pl-4 font-semibold text-foreground">
                    {s.email || `@${s.domain}`}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-red-500/10 text-red-400 border border-red-500/25">
                      {s.type}
                    </span>
                  </td>
                  <td className="p-3 text-foreground-muted truncate max-w-xs">{s.reason || "—"}</td>
                  <td className="p-3 text-foreground-subtle">{s.source}</td>
                  <td className="p-3 text-foreground-subtle">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 pr-4 text-right">
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1 rounded hover:bg-surface-elevated text-foreground-subtle hover:text-red-400 transition-colors"
                      title="Remove Suppression"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Suppression Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-semibold text-foreground font-mono">
              Add Suppression Entry
            </h3>

            <form onSubmit={handleAddSuppression} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-foreground-subtle mb-1">Target Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      checked={targetType === "email"}
                      onChange={() => setTargetType("email")}
                    />
                    <span>Specific Email Address</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      checked={targetType === "domain"}
                      onChange={() => setTargetType("domain")}
                    />
                    <span>Entire Domain</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-foreground-subtle mb-1">
                  {targetType === "email" ? "Email Address" : "Domain"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={targetType === "email" ? "user@example.com" : "example.com"}
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  className="w-full bg-surface-elevated border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-foreground-subtle mb-1">Suppression Category</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full bg-surface-elevated border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="manual">Manual Exclusion</option>
                  <option value="hard_bounce">Hard Bounce</option>
                  <option value="spam_complaint">Spam Complaint</option>
                  <option value="known_bad">Known Bad</option>
                  <option value="known_trap">Known Trap</option>
                  <option value="unsubscribe">Unsubscribe</option>
                </select>
              </div>

              <div>
                <label className="block text-foreground-subtle mb-1">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. User requested removal, frequent spam traps"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full bg-surface-elevated border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded bg-surface-elevated text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-primary hover:bg-primary-hover text-white font-semibold"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
