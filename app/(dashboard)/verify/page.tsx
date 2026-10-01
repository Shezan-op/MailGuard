"use client";

import React, { useState } from "react";
import {
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MailCheck,
  ShieldAlert,
  Server,
  Terminal,
  ShieldBan,
  RefreshCw,
  Clock,
  ArrowRight,
  Users,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { RiskGauge } from "@/components/ui/risk-gauge";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { VerificationResult } from "@/server/verification/types";

export default function VerifyPage() {
  const [emailInput, setEmailInput] = useState("");
  const [forceReverify, setForceReverify] = useState(false);
  const [conservativeMode, setConservativeMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRawEvents, setShowRawEvents] = useState(false);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!emailInput.trim()) return;

    setLoading(true);
    setError(null);
    setShowRawEvents(false);

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput.trim(),
          forceReverify,
          conservativeMode,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Verification failed");
      } else {
        setResult(json.data);
      }
    } catch (err: any) {
      setError(err.message || "Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
          Single Address Verification
        </h1>
        <p className="text-xs text-foreground-muted mt-1">
          Deep protocol inspection: syntax parsing, MX resolution, direct SMTP mailbox probing, and deterministic risk scoring.
        </p>
      </div>

      {/* Input Box */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-foreground-muted font-medium mb-2">
              Target Email Address
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-foreground-subtle absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="name@company.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-4 py-2.5 pl-10 text-sm font-mono text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !emailInput.trim()}
                className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 shrink-0"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Email</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2 text-xs text-foreground-muted">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={conservativeMode}
                onChange={(e) => setConservativeMode(e.target.checked)}
                className="rounded border-border bg-surface-elevated text-primary focus:ring-0"
              />
              <span>Conservative Mode (Stricter retry & rate policy)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={forceReverify}
                onChange={(e) => setForceReverify(e.target.checked)}
                className="rounded border-border bg-surface-elevated text-primary focus:ring-0"
              />
              <span>Force Re-verify (Bypass Domain Cache)</span>
            </label>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/25 flex items-start gap-3 text-xs text-red-400 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Detailed Technical Inspection Card */}
      {result && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-lg animate-in fade-in duration-200">
          {/* Verdict Banner Header */}
          <div className="p-6 border-b border-border bg-surface-elevated/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold font-mono text-foreground">
                  {result.email}
                </span>
                <StatusBadge status={result.finalStatus} size="md" />
                <ConfidenceBadge confidence={result.confidence} />
              </div>
              <p className="text-xs text-foreground-muted mt-2 max-w-xl">
                {result.classificationReason}
              </p>
            </div>

            <div className="flex flex-col items-end shrink-0">
              <span className="text-[10px] uppercase font-mono text-foreground-subtle tracking-wider mb-1">
                Deterministic Risk
              </span>
              <RiskGauge score={result.riskScore} size="lg" />
            </div>
          </div>

          {/* Typo Detected Suggestion Banner */}
          {result.typo.detected && result.typo.suggestedEmail && (
            <div className="p-4 bg-amber-500/10 border-b border-amber-500/25 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Possible domain typo detected. Did you mean <strong>{result.typo.suggestedEmail}</strong>?
                </span>
              </div>
              <button
                onClick={() => {
                  setEmailInput(result.typo.suggestedEmail!);
                  setResult(null);
                }}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-medium text-xs"
              >
                Use Suggestion
              </button>
            </div>
          )}

          {/* Technical Checks Grid */}
          <div className="p-6 border-b border-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted font-mono mb-4">
              Technical Evidence Checks
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3 bg-surface-elevated rounded border border-border">
                <div className="text-foreground-subtle text-[11px]">Syntax RFC Check</div>
                <div className="mt-1 flex items-center gap-1.5 font-semibold text-foreground">
                  {result.syntax.status === "PASS" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span>{result.syntax.status}</span>
                </div>
              </div>

              <div className="p-3 bg-surface-elevated rounded border border-border">
                <div className="text-foreground-subtle text-[11px]">Domain Resolution</div>
                <div className="mt-1 flex items-center gap-1.5 font-semibold text-foreground">
                  {result.dns.domainExists ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span>{result.dns.domainExists ? "PASS" : "NXDOMAIN"}</span>
                </div>
              </div>

              <div className="p-3 bg-surface-elevated rounded border border-border">
                <div className="text-foreground-subtle text-[11px]">MX Records</div>
                <div className="mt-1 flex items-center gap-1.5 font-semibold text-foreground">
                  {result.dns.mxRecords.length > 0 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span>{result.dns.mxRecords.length > 0 ? "PRESENT" : "NO_MX"}</span>
                </div>
              </div>

              <div className="p-3 bg-surface-elevated rounded border border-border">
                <div className="text-foreground-subtle text-[11px]">SMTP Mailbox Probe</div>
                <div className="mt-1 flex items-center gap-1.5 font-semibold text-foreground">
                  {result.smtp.status === "ACCEPTED" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : result.smtp.status === "REJECTED" ? (
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{result.smtp.status}</span>
                </div>
              </div>

              <div className="p-3 bg-surface-elevated rounded border border-border">
                <div className="text-foreground-subtle text-[11px]">Catch-All Detection</div>
                <div className="mt-1 flex items-center gap-1.5 font-semibold text-foreground">
                  {result.isCatchAll ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{result.isCatchAll ? "DETECTED" : "NO"}</span>
                </div>
              </div>

              <div className="p-3 bg-surface-elevated rounded border border-border">
                <div className="text-foreground-subtle text-[11px]">Disposable Provider</div>
                <div className="mt-1 flex items-center gap-1.5 font-semibold text-foreground">
                  {result.isDisposable ? (
                    <XCircle className="w-3.5 h-3.5 text-pink-400" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{result.isDisposable ? "YES" : "NO"}</span>
                </div>
              </div>

              <div className="p-3 bg-surface-elevated rounded border border-border">
                <div className="text-foreground-subtle text-[11px]">Role-Based Address</div>
                <div className="mt-1 flex items-center gap-1.5 font-semibold text-foreground">
                  {result.isRoleBased ? (
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{result.isRoleBased ? "YES" : "NO"}</span>
                </div>
              </div>

              <div className="p-3 bg-surface-elevated rounded border border-border">
                <div className="text-foreground-subtle text-[11px]">Mail Provider</div>
                <div className="mt-1 font-semibold text-foreground truncate">
                  {result.providerName}
                </div>
              </div>
            </div>
          </div>

          {/* SMTP Protocol Diagnostic Details */}
          <div className="p-6 bg-surface-elevated/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted font-mono flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                <span>SMTP Network Details</span>
              </h3>
              {result.smtp.events && result.smtp.events.length > 0 && (
                <button
                  onClick={() => setShowRawEvents(!showRawEvents)}
                  className="text-xs text-primary hover:text-primary-light flex items-center gap-1 font-mono"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>{showRawEvents ? "Hide Transcript" : "Show Protocol Transcript"}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3 bg-surface rounded border border-border">
                <div className="text-foreground-subtle text-[11px]">Primary MX Host</div>
                <div className="font-semibold text-foreground mt-1 truncate">
                  {result.dns.primaryMx || "None"}
                </div>
              </div>
              <div className="p-3 bg-surface rounded border border-border">
                <div className="text-foreground-subtle text-[11px]">Negotiated Security</div>
                <div className="font-semibold text-foreground mt-1">
                  {result.smtp.supportsStarttls ? "TLS (STARTTLS Supported)" : "Plaintext / Opportunistic"}
                </div>
              </div>
              <div className="p-3 bg-surface rounded border border-border">
                <div className="text-foreground-subtle text-[11px]">Roundtrip Latency</div>
                <div className="font-semibold text-foreground mt-1">
                  {result.smtp.latencyMs ? `${result.smtp.latencyMs} ms` : "—"}
                </div>
              </div>
            </div>

            {/* SMTP Response Banner */}
            {result.smtp.response && (
              <div className="mt-4 p-3 bg-surface rounded border border-border font-mono text-xs">
                <div className="text-[11px] text-foreground-subtle uppercase mb-1">
                  Server Response [{result.smtp.code || "—"}]
                </div>
                <div className="text-foreground-muted break-all">
                  {result.smtp.response}
                </div>
              </div>
            )}

            {/* Raw Protocol Transcript Log */}
            {showRawEvents && result.smtp.events && (
              <div className="mt-4 p-3 bg-black/70 border border-border rounded font-mono text-[11px] space-y-1 max-h-60 overflow-y-auto">
                <div className="text-foreground-subtle text-[10px] uppercase pb-1 border-b border-border/50 mb-2">
                  Raw SMTP Interaction Log
                </div>
                {result.smtp.events.map((ev, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-foreground-subtle shrink-0">[{ev.stage}]</span>
                    {ev.command && <span className="text-blue-400">&gt;&gt; {ev.command}</span>}
                    {ev.code && <span className="text-emerald-400">&lt;&lt; {ev.code}</span>}
                    {ev.response && <span className="text-foreground-muted">{ev.response}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
