"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Pause,
  XCircle,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertTriangle,
  MailCheck,
  ShieldAlert,
  Clock,
  HelpCircle,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { RiskGauge } from "@/components/ui/risk-gauge";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [job, setJob] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchJobData = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/jobs/${id}`);
      const json = await res.json();
      if (json.success) {
        setJob(json.data.job);
        setRuns(json.data.recentRuns || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchJobData();
    const interval = setInterval(fetchJobData, 2500); // 2.5s poll for active progress
    return () => clearInterval(interval);
  }, [id]);

  const handleAction = async (action: "pause" | "resume" | "cancel") => {
    await fetch(`/api/jobs/${id}/${action}`, { method: "POST" });
    fetchJobData();
  };

  const handleRetry = async (filter: "temporary" | "failed" | "all") => {
    await fetch(`/api/jobs/${id}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filter }),
    });
    fetchJobData();
  };

  const handleExport = async (cleanOnly = false) => {
    setExporting(true);
    try {
      const res = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: id,
          cleanListOnly: cleanOnly,
        }),
      });
      const json = await res.json();
      if (json.success && json.data.downloadUrl) {
        window.location.href = json.data.downloadUrl;
      }
    } catch {
      alert("Failed to export results");
    } finally {
      setExporting(false);
    }
  };

  if (loading && !job) {
    return (
      <div className="p-12 text-center text-xs text-foreground-muted font-mono">
        Loading job parameters...
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-12 text-center space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Job Not Found</h2>
        <Link href="/jobs" className="text-xs text-primary hover:underline">
          Return to Jobs List
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Back Link & Header */}
      <div>
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-xs text-foreground-subtle hover:text-foreground mb-4 font-mono transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Jobs</span>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
                {job.name}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase ${
                  job.status === "running"
                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse"
                    : job.status === "completed"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-500/15 text-slate-400 border border-slate-500/30"
                }`}
              >
                {job.status}
              </span>
            </div>
            <p className="text-xs text-foreground-muted mt-1 font-mono">
              Source: {job.sourceType.toUpperCase()} {job.sourceFilename && `(${job.sourceFilename})`} • Created {new Date(job.createdAt).toLocaleString()}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {job.status === "running" && (
              <button
                onClick={() => handleAction("pause")}
                className="px-3 py-1.5 rounded bg-surface border border-border hover:border-amber-500/50 text-xs font-medium text-amber-400 flex items-center gap-1.5"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </button>
            )}
            {job.status === "paused" && (
              <button
                onClick={() => handleAction("resume")}
                className="px-3 py-1.5 rounded bg-surface border border-border hover:border-emerald-500/50 text-xs font-medium text-emerald-400 flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Resume</span>
              </button>
            )}
            {(job.status === "running" || job.status === "paused") && (
              <button
                onClick={() => handleAction("cancel")}
                className="px-3 py-1.5 rounded bg-surface border border-border hover:border-red-500/50 text-xs font-medium text-red-400 flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}

            <button
              onClick={() => handleRetry("temporary")}
              className="px-3 py-1.5 rounded bg-surface border border-border hover:border-border-strong text-xs font-medium text-foreground flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Temporary</span>
            </button>

            <button
              onClick={() => handleExport(true)}
              disabled={exporting}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Clean List</span>
            </button>

            <button
              onClick={() => handleExport(false)}
              disabled={exporting}
              className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded text-xs font-medium flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export All</span>
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar & Summary Stats */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-foreground-muted font-medium">
            Overall Processing Progress
          </span>
          <span className="text-sm font-bold font-mono text-foreground">
            {job.processedCount.toLocaleString()} / {job.totalCount.toLocaleString()} ({job.progressPercentage}%)
          </span>
        </div>
        <div className="h-3 bg-surface-elevated rounded-full overflow-hidden border border-border/80">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${job.progressPercentage}%` }}
          />
        </div>

        {/* Counter Breakdown Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mt-6 text-xs font-mono">
          <div className="p-3 rounded bg-surface-elevated border border-border">
            <div className="text-[10px] text-foreground-subtle uppercase">Deliverable</div>
            <div className="text-base font-bold text-emerald-400 mt-1">{job.deliverableCount}</div>
          </div>
          <div className="p-3 rounded bg-surface-elevated border border-border">
            <div className="text-[10px] text-foreground-subtle uppercase">Undeliverable</div>
            <div className="text-base font-bold text-red-400 mt-1">{job.undeliverableCount}</div>
          </div>
          <div className="p-3 rounded bg-surface-elevated border border-border">
            <div className="text-[10px] text-foreground-subtle uppercase">Risky</div>
            <div className="text-base font-bold text-amber-400 mt-1">{job.riskyCount}</div>
          </div>
          <div className="p-3 rounded bg-surface-elevated border border-border">
            <div className="text-[10px] text-foreground-subtle uppercase">Catch-All</div>
            <div className="text-base font-bold text-yellow-400 mt-1">{job.catchAllCount}</div>
          </div>
          <div className="p-3 rounded bg-surface-elevated border border-border">
            <div className="text-[10px] text-foreground-subtle uppercase">Disposable</div>
            <div className="text-base font-bold text-pink-400 mt-1">{job.disposableCount}</div>
          </div>
          <div className="p-3 rounded bg-surface-elevated border border-border">
            <div className="text-[10px] text-foreground-subtle uppercase">Role-Based</div>
            <div className="text-base font-bold text-purple-400 mt-1">{job.roleBasedCount}</div>
          </div>
          <div className="p-3 rounded bg-surface-elevated border border-border">
            <div className="text-[10px] text-foreground-subtle uppercase">Temporary</div>
            <div className="text-base font-bold text-cyan-400 mt-1">{job.temporaryCount}</div>
          </div>
          <div className="p-3 rounded bg-surface-elevated border border-border">
            <div className="text-[10px] text-foreground-subtle uppercase">Unknown</div>
            <div className="text-base font-bold text-slate-400 mt-1">{job.unknownCount}</div>
          </div>
        </div>
      </div>

      {/* Verified Records in this Job */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground font-mono">
            Latest Evaluated Addresses
          </h2>
          <span className="text-xs text-foreground-subtle font-mono">
            Displaying last {runs.length} items
          </span>
        </div>

        {runs.length === 0 ? (
          <div className="p-10 text-center text-xs text-foreground-muted font-mono">
            No processed verification runs yet for this job.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-border bg-surface-elevated/40 text-[11px] uppercase tracking-wider text-foreground-subtle">
                  <th className="p-3 pl-4">Email</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Risk</th>
                  <th className="p-3">Confidence</th>
                  <th className="p-3">SMTP Code</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3 pr-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-elevated/30 transition-colors">
                    <td className="p-3 pl-4 font-semibold text-foreground">
                      <Link href={`/emails/${encodeURIComponent(r.email)}`} className="hover:text-primary">
                        {r.email}
                      </Link>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={r.finalStatus} size="sm" />
                    </td>
                    <td className="p-3">
                      <RiskGauge score={r.riskScore} size="sm" />
                    </td>
                    <td className="p-3">
                      <ConfidenceBadge confidence={r.confidence} />
                    </td>
                    <td className="p-3 text-foreground-subtle">
                      {r.smtpCode ? <span className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border">{r.smtpCode}</span> : "—"}
                    </td>
                    <td className="p-3 text-foreground-muted truncate max-w-xs">{r.reason || "—"}</td>
                    <td className="p-3 pr-4 text-right">
                      <Link
                        href={`/emails/${encodeURIComponent(r.email)}`}
                        className="text-primary hover:text-primary-light font-medium"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
