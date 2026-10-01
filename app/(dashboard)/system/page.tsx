"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Server,
  Database,
  Cpu,
  Globe2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Terminal,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function SystemPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Diagnostic state
  const [testDomain, setTestDomain] = useState("gmail.com");
  const [testingDiagnostic, setTestingDiagnostic] = useState(false);
  const [diagResult, setDiagResult] = useState<any>(null);

  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/system/health");
      const json = await res.json();
      if (json.success) {
        setHealth(json.data);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleRunDiagnostic = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingDiagnostic(true);
    setDiagResult(null);

    try {
      const res = await fetch("/api/system/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: testDomain }),
      });
      const json = await res.json();
      if (json.success) {
        setDiagResult(json.data);
      } else {
        setDiagResult({ error: json.error?.message || "Diagnostic failed" });
      }
    } catch (err: any) {
      setDiagResult({ error: err.message || "Network error" });
    } finally {
      setTestingDiagnostic(false);
    }
  };

  if (loading && !health) {
    return (
      <div className="p-12 text-center text-xs text-foreground-muted font-mono">
        Inspecting system telemetry...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
            System Infrastructure & Diagnostics
          </h1>
          <p className="text-xs text-foreground-muted mt-1">
            Engine operational status, queue depth, memory utilization, and outbound SMTP port 25 diagnostic testing.
          </p>
        </div>
        <button
          onClick={fetchHealth}
          className="p-2 rounded-lg bg-surface border border-border hover:border-border-strong text-foreground-subtle hover:text-foreground transition-colors self-start md:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Health Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Application Core */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-foreground-subtle uppercase tracking-wider text-[11px]">Application</span>
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Operational</span>
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-border/50 text-foreground-muted">
            <div className="flex justify-between">
              <span>Engine:</span>
              <span className="text-foreground font-semibold">MailGuard v1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>Node Runtime:</span>
              <span className="text-foreground">{health?.application?.nodeVersion || process.version}</span>
            </div>
            <div className="flex justify-between">
              <span>Uptime:</span>
              <span className="text-foreground">{Math.floor((health?.application?.uptimeSeconds || 0) / 60)} min</span>
            </div>
          </div>
        </div>

        {/* Database */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-foreground-subtle uppercase tracking-wider text-[11px]">Database (PostgreSQL)</span>
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Healthy</span>
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-border/50 text-foreground-muted">
            <div className="flex justify-between">
              <span>Total Emails:</span>
              <span className="text-foreground font-semibold">{health?.database?.totalEmails?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Tracked Domains:</span>
              <span className="text-foreground">{health?.database?.totalDomains?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Jobs:</span>
              <span className="text-foreground">{health?.database?.totalJobs?.toLocaleString() || 0}</span>
            </div>
          </div>
        </div>

        {/* DNS & Memory */}
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-foreground-subtle uppercase tracking-wider text-[11px]">DNS & Resources</span>
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Online</span>
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-border/50 text-foreground-muted">
            <div className="flex justify-between">
              <span>DNS Lookup Latency:</span>
              <span className="text-foreground font-semibold">{health?.dns?.latencyMs || 0} ms</span>
            </div>
            <div className="flex justify-between">
              <span>Memory (Heap Used):</span>
              <span className="text-foreground">{health?.memory?.heapUsedMb || 0} MB</span>
            </div>
            <div className="flex justify-between">
              <span>Queue Backlog:</span>
              <span className="text-foreground font-semibold">{health?.queue?.pendingJobs || 0} active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Outbound Port 25 Connectivity Diagnostic */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
              Outbound SMTP Port 25 Diagnostic
            </h2>
          </div>
          <p className="text-[11px] text-foreground-subtle mt-0.5">
            Tests whether this host can establish outbound TCP connections on port 25 to remote MX servers.
          </p>
        </div>

        <form onSubmit={handleRunDiagnostic} className="flex gap-3 max-w-md">
          <input
            type="text"
            required
            value={testDomain}
            onChange={(e) => setTestDomain(e.target.value)}
            placeholder="Domain to test (e.g. gmail.com)"
            className="flex-1 bg-surface-elevated border border-border rounded p-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={testingDiagnostic}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
          >
            {testingDiagnostic ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Probing Port 25...</span>
              </>
            ) : (
              <span>Run Diagnostic</span>
            )}
          </button>
        </form>

        {diagResult && (
          <div className="mt-4 p-4 rounded-lg bg-surface-elevated border border-border font-mono text-xs space-y-3">
            {diagResult.error ? (
              <div className="text-red-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{diagResult.error}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-foreground-subtle">Outbound Port 25 Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold ${
                      diagResult.port25Status === "AVAILABLE"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-red-500/15 text-red-400 border border-red-500/30"
                    }`}
                  >
                    {diagResult.port25Status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-foreground-muted">
                  <div>Target MX: <strong className="text-foreground">{diagResult.mxHost}</strong></div>
                  <div>MX IP: <strong className="text-foreground">{diagResult.mxIp}</strong></div>
                  <div>Latency: <strong className="text-foreground">{diagResult.latencyMs ? `${diagResult.latencyMs} ms` : "—"}</strong></div>
                </div>

                {diagResult.banner && (
                  <div className="p-2 bg-background rounded border border-border text-[11px] text-foreground-subtle break-all">
                    <span className="text-primary mr-2">&lt;&lt;</span>
                    {diagResult.banner}
                  </div>
                )}

                {diagResult.errorDetail && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] rounded flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{diagResult.errorDetail}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
