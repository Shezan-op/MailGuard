"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Server,
  ShieldBan,
  Globe2,
  Clock,
  History,
  Terminal,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { RiskGauge } from "@/components/ui/risk-gauge";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";

export default function EmailDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reverifying, setReverifying] = useState(false);
  const [suppressionModal, setSuppressionModal] = useState(false);
  const [suppressionReason, setSuppressionReason] = useState("Manual suppression from email view");

  const fetchDetail = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/emails/${encodeURIComponent(id)}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleReverify = async () => {
    setReverifying(true);
    try {
      const res = await fetch(`/api/emails/${encodeURIComponent(id)}/reverify`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        fetchDetail();
      }
    } catch {}
    setReverifying(false);
  };

  const handleAddSuppression = async () => {
    try {
      await fetch("/api/suppressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data?.email?.normalizedEmail,
          type: "manual",
          reason: suppressionReason,
        }),
      });
      setSuppressionModal(false);
      fetchDetail();
    } catch {}
  };

  if (loading && !data) {
    return (
      <div className="p-12 text-center text-xs text-foreground-muted font-mono">
        Loading address profile...
      </div>
    );
  }

  if (!data || !data.email) {
    return (
      <div className="p-12 text-center space-y-3 font-mono">
        <h2 className="text-sm font-semibold text-foreground">Address Not Found</h2>
        <Link href="/emails" className="text-xs text-primary hover:underline">
          Return to Email Directory
        </Link>
      </div>
    );
  }

  const { email, runs, smtpEvents, campaignEvents, domain, suppression } = data;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Back Header */}
      <div>
        <Link
          href="/emails"
          className="inline-flex items-center gap-1.5 text-xs text-foreground-subtle hover:text-foreground mb-4 font-mono transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Email Directory</span>
        </Link>

        {/* Profile Card Header */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold font-mono text-foreground">
                  {email.originalEmail}
                </h1>
                <StatusBadge status={email.finalStatus} size="md" />
                <ConfidenceBadge confidence={email.confidence} />
              </div>
              <p className="text-xs text-foreground-muted mt-2 max-w-xl">
                {email.classificationReason || "Evaluated through MailGuard verification engine."}
              </p>
            </div>

            <div className="flex flex-col md:items-end">
              <span className="text-[10px] uppercase font-mono text-foreground-subtle tracking-wider mb-1">
                Deterministic Risk
              </span>
              <RiskGauge score={email.riskScore} size="lg" />
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-4 text-xs font-mono text-foreground-subtle">
              <span>Verified {email.verificationCount} time(s)</span>
              <span>•</span>
              <span>Last Checked: {new Date(email.lastVerifiedAt).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReverify}
                disabled={reverifying}
                className="px-3 py-1.5 rounded bg-surface-elevated border border-border hover:border-primary text-xs font-medium text-foreground hover:text-primary flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reverifying ? "animate-spin" : ""}`} />
                <span>Verify Again</span>
              </button>
              {!suppression && (
                <button
                  onClick={() => setSuppressionModal(true)}
                  className="px-3 py-1.5 rounded bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-xs font-medium text-red-400 flex items-center gap-1.5 transition-colors"
                >
                  <ShieldBan className="w-3.5 h-3.5" />
                  <span>Suppress Address</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Suppression Warning Banner if Suppressed */}
      {suppression && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between text-xs text-red-400 font-mono">
          <div className="flex items-center gap-2">
            <ShieldBan className="w-4 h-4 shrink-0" />
            <span>
              SUPPRESSED: This address is on the suppression list ({suppression.type}): {suppression.reason}
            </span>
          </div>
        </div>
      )}

      {/* Technical Evidence Checklist */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted font-mono mb-4">
          Technical Verification Checks
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3 bg-surface-elevated rounded border border-border">
            <div className="text-foreground-subtle text-[11px]">Syntax Valid</div>
            <div className="font-semibold text-foreground mt-1 flex items-center gap-1.5">
              {email.syntaxStatus === "PASS" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-400" />
              )}
              <span>{email.syntaxStatus}</span>
            </div>
          </div>

          <div className="p-3 bg-surface-elevated rounded border border-border">
            <div className="text-foreground-subtle text-[11px]">Domain Exists</div>
            <div className="font-semibold text-foreground mt-1 flex items-center gap-1.5">
              {email.domainExists ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-400" />
              )}
              <span>{email.domainExists ? "YES" : "NO"}</span>
            </div>
          </div>

          <div className="p-3 bg-surface-elevated rounded border border-border">
            <div className="text-foreground-subtle text-[11px]">MX Record</div>
            <div className="font-semibold text-foreground mt-1 flex items-center gap-1.5">
              {email.mxHost ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-400" />
              )}
              <span className="truncate">{email.mxHost || "None"}</span>
            </div>
          </div>

          <div className="p-3 bg-surface-elevated rounded border border-border">
            <div className="text-foreground-subtle text-[11px]">SMTP Mailbox</div>
            <div className="font-semibold text-foreground mt-1 flex items-center gap-1.5">
              {email.smtpStatus === "ACCEPTED" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-400" />
              )}
              <span>{email.smtpStatus || "NOT_CHECKED"}</span>
            </div>
          </div>

          <div className="p-3 bg-surface-elevated rounded border border-border">
            <div className="text-foreground-subtle text-[11px]">Catch-All Domain</div>
            <div className="font-semibold text-foreground mt-1">
              {email.catchAllStatus ? (
                <span className="text-yellow-400 font-bold">YES</span>
              ) : (
                <span className="text-emerald-400">NO</span>
              )}
            </div>
          </div>

          <div className="p-3 bg-surface-elevated rounded border border-border">
            <div className="text-foreground-subtle text-[11px]">Disposable Provider</div>
            <div className="font-semibold text-foreground mt-1">
              {email.disposableStatus ? (
                <span className="text-pink-400 font-bold">YES</span>
              ) : (
                <span className="text-emerald-400">NO</span>
              )}
            </div>
          </div>

          <div className="p-3 bg-surface-elevated rounded border border-border">
            <div className="text-foreground-subtle text-[11px]">Role-Based Address</div>
            <div className="font-semibold text-foreground mt-1">
              {email.roleBasedStatus ? (
                <span className="text-purple-400 font-bold">YES</span>
              ) : (
                <span className="text-emerald-400">NO</span>
              )}
            </div>
          </div>

          <div className="p-3 bg-surface-elevated rounded border border-border">
            <div className="text-foreground-subtle text-[11px]">Free Provider</div>
            <div className="font-semibold text-foreground mt-1">
              {email.freeProviderStatus ? "YES" : "NO"}
            </div>
          </div>
        </div>

        {/* Server Response Code Banner */}
        {email.smtpResponse && (
          <div className="mt-4 p-3 bg-surface-elevated rounded border border-border font-mono text-xs">
            <div className="text-[10px] text-foreground-subtle uppercase mb-1">
              Latest SMTP Response [{email.smtpCode || "—"}]
            </div>
            <div className="text-foreground-muted break-all">{email.smtpResponse}</div>
          </div>
        )}
      </div>

      {/* Domain Intelligence Card */}
      {domain && (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted font-mono flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-primary" />
              <span>Domain Intelligence ({domain.domain})</span>
            </h2>
            <Link
              href={`/domains/${encodeURIComponent(domain.domain)}`}
              className="text-xs text-primary hover:text-primary-light font-mono font-medium"
            >
              View Full Domain Profile &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 bg-surface-elevated rounded border border-border">
              <div className="text-foreground-subtle text-[11px]">Provider</div>
              <div className="font-semibold text-foreground mt-1">{domain.provider}</div>
            </div>
            <div className="p-3 bg-surface-elevated rounded border border-border">
              <div className="text-foreground-subtle text-[11px]">Primary MX</div>
              <div className="font-semibold text-foreground mt-1 truncate">{domain.primaryMx || "None"}</div>
            </div>
            <div className="p-3 bg-surface-elevated rounded border border-border">
              <div className="text-foreground-subtle text-[11px]">Historical Deliverability</div>
              <div className="font-semibold text-emerald-400 mt-1">
                {(domain.historicalDeliverabilityRate / 100).toFixed(1)}%
              </div>
            </div>
            <div className="p-3 bg-surface-elevated rounded border border-border">
              <div className="text-foreground-subtle text-[11px]">Historical Bounce Rate</div>
              <div className="font-semibold text-red-400 mt-1">
                {(domain.historicalBounceRate / 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historical Verification Runs */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted font-mono flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <span>Verification Runs History</span>
          </h2>
          <span className="text-xs text-foreground-subtle font-mono">{runs.length} recorded run(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-border bg-surface-elevated/40 text-[11px] uppercase tracking-wider text-foreground-subtle">
                <th className="p-3 pl-4">Timestamp</th>
                <th className="p-3">Status</th>
                <th className="p-3">Risk</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">SMTP Code</th>
                <th className="p-3">Latency</th>
                <th className="p-3 pr-4">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {runs.map((r: any) => (
                <tr key={r.id}>
                  <td className="p-3 pl-4 text-foreground-subtle">
                    {new Date(r.createdAt).toLocaleString()}
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
                  <td className="p-3 text-foreground-subtle">{r.smtpCode || "—"}</td>
                  <td className="p-3 text-foreground-subtle">
                    {r.smtpLatencyMs ? `${r.smtpLatencyMs}ms` : "—"}
                  </td>
                  <td className="p-3 pr-4 text-foreground-muted truncate max-w-xs">
                    {r.reason || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Campaign Events History (if any) */}
      {campaignEvents && campaignEvents.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted font-mono">
              Campaign Delivery & Bounce Events
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-border bg-surface-elevated/40 text-[11px] uppercase tracking-wider text-foreground-subtle">
                  <th className="p-3 pl-4">Event Date</th>
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Campaign</th>
                  <th className="p-3">SMTP Code</th>
                  <th className="p-3 pr-4">Server Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {campaignEvents.map((c: any) => (
                  <tr key={c.id}>
                    <td className="p-3 pl-4 text-foreground-subtle">
                      {new Date(c.eventDate).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          c.eventType === "delivered"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : c.eventType === "hard_bounce"
                            ? "bg-red-500/15 text-red-400 font-bold"
                            : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {c.eventType}
                      </span>
                    </td>
                    <td className="p-3 text-foreground-muted">{c.campaignName || "—"}</td>
                    <td className="p-3 text-foreground-subtle">{c.smtpCode || "—"}</td>
                    <td className="p-3 pr-4 text-foreground-muted truncate max-w-xs">
                      {c.smtpResponse || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suppression Modal */}
      {suppressionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-semibold text-foreground font-mono">
              Suppress Email Address
            </h3>
            <p className="text-xs text-foreground-muted">
              Adding this address to the suppression list prevents future campaigns from targeting it.
            </p>
            <div>
              <label className="block text-xs text-foreground-subtle mb-1">Reason for suppression:</label>
              <input
                type="text"
                value={suppressionReason}
                onChange={(e) => setSuppressionReason(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded p-2 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSuppressionModal(false)}
                className="px-3 py-1.5 rounded bg-surface-elevated text-xs text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSuppression}
                className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
              >
                Confirm Suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
