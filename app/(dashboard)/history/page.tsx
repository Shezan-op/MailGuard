"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Search, History, Upload, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

export default function HistoryPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "25");
      if (search.trim()) params.set("search", search.trim());
      if (eventType) params.set("eventType", eventType);

      const res = await fetch(`/api/history?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setEvents(json.data.events || []);
        setTotal(json.data.pagination.total);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, [page, eventType]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEvents();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
            Campaign Delivery & Bounce History
          </h1>
          <p className="text-xs text-foreground-muted mt-1">
            First-party outcomes imported from past email campaigns to continuously improve local deliverability intelligence.
          </p>
        </div>

        <Link
          href="/history/import"
          className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import Campaign Bounce CSV</span>
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
        <form onSubmit={handleSearch} className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-foreground-subtle absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Search campaign event records by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-elevated border border-border rounded-lg pl-10 pr-4 py-2 text-xs font-mono text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-primary"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value);
              setPage(1);
            }}
            className="bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
          >
            <option value="">All Event Types</option>
            <option value="delivered">Delivered</option>
            <option value="hard_bounce">Hard Bounce</option>
            <option value="soft_bounce">Soft Bounce</option>
            <option value="blocked">Blocked / Policy</option>
            <option value="complaint">Spam Complaint</option>
            <option value="unsubscribe">Unsubscribe</option>
          </select>

          <button
            onClick={fetchEvents}
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
              <th className="p-3 pl-4">Date</th>
              <th className="p-3">Email Address</th>
              <th className="p-3">Event Type</th>
              <th className="p-3">Campaign</th>
              <th className="p-3">SMTP Code</th>
              <th className="p-3 pr-4">SMTP Response</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-foreground-muted">
                  {loading ? "Loading events..." : "No campaign delivery events recorded yet."}
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id} className="hover:bg-surface-elevated/30 transition-colors">
                  <td className="p-3 pl-4 text-foreground-subtle">
                    {new Date(ev.eventDate).toLocaleDateString()}
                  </td>
                  <td className="p-3 font-semibold text-foreground">
                    <Link href={`/emails/${encodeURIComponent(ev.email)}`} className="hover:text-primary">
                      {ev.email}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        ev.eventType === "delivered"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                          : ev.eventType === "hard_bounce"
                          ? "bg-red-500/15 text-red-400 border border-red-500/25"
                          : "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                      }`}
                    >
                      {ev.eventType}
                    </span>
                  </td>
                  <td className="p-3 text-foreground-muted">{ev.campaignName || "—"}</td>
                  <td className="p-3 text-foreground-subtle">{ev.smtpCode || "—"}</td>
                  <td className="p-3 pr-4 text-foreground-subtle truncate max-w-xs">
                    {ev.smtpResponse || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="p-4 border-t border-border flex items-center justify-between text-xs font-mono text-foreground-muted">
          <div>Total events: {total.toLocaleString()}</div>
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
              disabled={events.length < 25}
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
