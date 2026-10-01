"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Upload,
  ClipboardList,
  Play,
  Pause,
  XCircle,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Clock,
  ArrowRight,
  Download,
} from "lucide-react";

export default function JobsPage() {
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [jobName, setJobName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      const json = await res.json();
      if (json.success) {
        setJobs(json.data || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000); // 3s polling for real-time progress
    return () => clearInterval(interval);
  }, []);

  const handleStartUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      if (activeTab === "upload") {
        if (!file) return;
        const formData = new FormData();
        formData.append("file", file);
        if (jobName.trim()) formData.append("name", jobName.trim());

        const res = await fetch("/api/verify/bulk", {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        if (json.success) {
          setFile(null);
          setJobName("");
          fetchJobs();
        } else {
          alert(json.error?.message || "Upload failed");
        }
      } else {
        if (!pasteText.trim()) return;
        const res = await fetch("/api/verify/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pasteText,
            name: jobName.trim() || undefined,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setPasteText("");
          setJobName("");
          fetchJobs();
        } else {
          alert(json.error?.message || "Paste processing failed");
        }
      }
    } catch (err: any) {
      alert(err.message || "Failed to submit job");
    } finally {
      setUploading(false);
    }
  };

  const handleJobAction = async (jobId: string, action: "pause" | "resume" | "cancel") => {
    try {
      await fetch(`/api/jobs/${jobId}/${action}`, { method: "POST" });
      fetchJobs();
    } catch {}
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
          Bulk Verification Jobs
        </h1>
        <p className="text-xs text-foreground-muted mt-1">
          Upload large lists via CSV, XLSX, or plain text to verify thousands of addresses asynchronously.
        </p>
      </div>

      {/* Creation Card */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-4 border-b border-border pb-4 mb-6">
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex items-center gap-2 pb-2 text-xs font-semibold tracking-wider transition-colors border-b-2 ${
              activeTab === "upload"
                ? "border-primary text-primary"
                : "border-transparent text-foreground-subtle hover:text-foreground"
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>FILE UPLOAD (CSV / XLSX / TXT)</span>
          </button>
          <button
            onClick={() => setActiveTab("paste")}
            className={`flex items-center gap-2 pb-2 text-xs font-semibold tracking-wider transition-colors border-b-2 ${
              activeTab === "paste"
                ? "border-primary text-primary"
                : "border-transparent text-foreground-subtle hover:text-foreground"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>PASTE ADDRESSES</span>
          </button>
        </div>

        <form onSubmit={handleStartUpload} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-foreground-muted font-medium mb-1.5">
              Job Title / Campaign Label (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. September Leads, Newsletter Export"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-primary"
            />
          </div>

          {activeTab === "upload" ? (
            <div className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-8 text-center bg-surface-elevated/30">
              <input
                type="file"
                id="file-upload"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                  <Upload className="w-5 h-5" />
                </div>
                {file ? (
                  <div className="font-mono text-sm text-foreground font-semibold">
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-foreground">
                      Click to choose or drag and drop a file
                    </span>
                    <span className="text-xs text-foreground-subtle mt-1">
                      Supports CSV (comma/tab/semicolon), XLSX spreadsheets, and plain TXT lists
                    </span>
                  </>
                )}
              </label>
            </div>
          ) : (
            <div>
              <label className="block text-xs uppercase tracking-wider text-foreground-muted font-medium mb-1.5">
                Paste Email Addresses (One per line or comma-separated)
              </label>
              <textarea
                rows={5}
                placeholder="john@example.com&#10;sales@company.com&#10;sarah@gmail.com"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded p-3 text-xs font-mono text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-primary"
              />
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={uploading || (activeTab === "upload" && !file) || (activeTab === "paste" && !pasteText.trim())}
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Preparing & Enqueuing...</span>
                </>
              ) : (
                <>
                  <span>Create & Start Verification Job</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Jobs Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground font-mono">
              Job History & Real-Time Monitoring
            </h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              Live updates with domain rate pacing and concurrency tracking.
            </p>
          </div>
          <button
            onClick={fetchJobs}
            className="p-1.5 rounded hover:bg-surface-elevated text-foreground-subtle hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="p-12 text-center text-xs text-foreground-muted font-mono">
            No verification jobs created yet. Upload a list to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-border bg-surface-elevated/40 text-[11px] uppercase tracking-wider text-foreground-subtle">
                  <th className="p-3 pl-4">Job Name</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Progress</th>
                  <th className="p-3">Deliverable</th>
                  <th className="p-3">Undeliverable</th>
                  <th className="p-3">Risky</th>
                  <th className="p-3">Unknown</th>
                  <th className="p-3">Total</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-surface-elevated/30 transition-colors">
                    <td className="p-3 pl-4 font-semibold text-foreground">
                      <Link href={`/jobs/${j.id}`} className="hover:text-primary">
                        {j.name}
                      </Link>
                      <div className="text-[10px] text-foreground-subtle font-normal">
                        {j.sourceType.toUpperCase()} • {new Date(j.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                          j.status === "running"
                            ? "bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse"
                            : j.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : j.status === "paused"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            : "bg-slate-500/15 text-slate-400 border border-slate-500/30"
                        }`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="w-28">
                        <div className="flex justify-between text-[10px] text-foreground-subtle mb-1">
                          <span>{j.processedCount} / {j.totalCount}</span>
                          <span>{j.progressPercentage}%</span>
                        </div>
                        <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden border border-border">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${j.progressPercentage}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-emerald-400 font-semibold">{j.deliverableCount}</td>
                    <td className="p-3 text-red-400 font-semibold">{j.undeliverableCount}</td>
                    <td className="p-3 text-amber-400 font-semibold">{j.riskyCount}</td>
                    <td className="p-3 text-slate-400">{j.unknownCount}</td>
                    <td className="p-3 text-foreground font-semibold">{j.totalCount}</td>
                    <td className="p-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {j.status === "running" && (
                          <button
                            onClick={() => handleJobAction(j.id, "pause")}
                            title="Pause Job"
                            className="p-1 rounded hover:bg-surface-elevated text-foreground-subtle hover:text-amber-400"
                          >
                            <Pause className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {j.status === "paused" && (
                          <button
                            onClick={() => handleJobAction(j.id, "resume")}
                            title="Resume Job"
                            className="p-1 rounded hover:bg-surface-elevated text-foreground-subtle hover:text-emerald-400"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(j.status === "running" || j.status === "queued" || j.status === "paused") && (
                          <button
                            onClick={() => handleJobAction(j.id, "cancel")}
                            title="Cancel Job"
                            className="p-1 rounded hover:bg-surface-elevated text-foreground-subtle hover:text-red-400"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <Link
                          href={`/jobs/${j.id}`}
                          className="px-2 py-1 rounded bg-surface-elevated border border-border hover:border-primary text-foreground hover:text-primary transition-colors text-xs"
                        >
                          View Details
                        </Link>
                      </div>
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
