"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Globe2,
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Search,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { RiskGauge } from "@/components/ui/risk-gauge";

export default function DomainDetailPage() {
  const params = useParams();
  const domainParam = params?.domain as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dkimSelector, setDkimSelector] = useState("default");
  const [testingDkim, setTestingDkim] = useState(false);

  const fetchDomain = async (selector?: string) => {
    if (!domainParam) return;
    try {
      const url = `/api/domains/${encodeURIComponent(domainParam)}${selector ? `?dkimSelector=${encodeURIComponent(selector)}` : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchDomain();
  }, [domainParam]);

  const handleTestDkim = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingDkim(true);
    await fetchDomain(dkimSelector);
    setTestingDkim(false);
  };

  if (loading && !data) {
    return (
      <div className="p-12 text-center text-xs text-foreground-muted font-mono">
        Loading domain deliverability profile...
      </div>
    );
  }

  if (!data || !data.domain) {
    return (
      <div className="p-12 text-center space-y-3 font-mono">
        <h2 className="text-sm font-semibold text-foreground">Domain Not Found</h2>
        <Link href="/domains" className="text-xs text-primary hover:underline">
          Return to Domains List
        </Link>
      </div>
    );
  }

  const { domain, sampleEmails, authDiagnostics } = data;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Back link & Header */}
      <div>
        <Link
          href="/domains"
          className="inline-flex items-center gap-1.5 text-xs text-foreground-subtle hover:text-foreground mb-4 font-mono transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Domains Directory</span>
        </Link>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Globe2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-mono text-foreground">
                  {domain.domain}
                </h1>
                <p className="text-xs text-foreground-muted mt-0.5 font-mono">
                  Mail Provider: <strong className="text-foreground">{domain.provider || "Unknown"}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded text-xs font-semibold uppercase font-mono ${
                  domain.isCatchAll
                    ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                    : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                }`}
              >
                {domain.isCatchAll ? "Catch-All Active" : "No Catch-All"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-xs font-mono">
            <div className="p-3 bg-surface-elevated rounded border border-border">
              <div className="text-foreground-subtle text-[11px]">DNS Resolution</div>
              <div className="font-semibold text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Resolves</span>
              </div>
            </div>

            <div className="p-3 bg-surface-elevated rounded border border-border">
              <div className="text-foreground-subtle text-[11px]">MX Present</div>
              <div className="font-semibold text-foreground mt-1 truncate">
                {domain.primaryMx || "None"}
              </div>
            </div>

            <div className="p-3 bg-surface-elevated rounded border border-border">
              <div className="text-foreground-subtle text-[11px]">STARTTLS Support</div>
              <div className="font-semibold text-foreground mt-1">
                {domain.supportsStarttls ? (
                  <span className="text-emerald-400">Supported</span>
                ) : (
                  <span className="text-foreground-muted">Not Advertised</span>
                )}
              </div>
            </div>

            <div className="p-3 bg-surface-elevated rounded border border-border">
              <div className="text-foreground-subtle text-[11px]">Known Free Provider</div>
              <div className="font-semibold text-foreground mt-1">
                {domain.isFreeProvider ? "YES" : "NO"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Deliverability & Bounce Intelligence */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted font-mono">
              First-Party Historical Intelligence
            </h2>
            <p className="text-[11px] text-foreground-subtle mt-0.5">
              Based on your internal verification history and imported campaign bounce data.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-4 bg-surface-elevated rounded border border-border">
            <div className="text-foreground-subtle text-[11px]">Addresses Evaluated</div>
            <div className="text-2xl font-bold text-foreground mt-1">
              {domain.verificationCount || 0}
            </div>
            <div className="text-[10px] text-foreground-subtle mt-1">
              {domain.deliverableCount || 0} confirmed deliverable
            </div>
          </div>

          <div className="p-4 bg-surface-elevated rounded border border-border">
            <div className="text-foreground-subtle text-[11px]">Historical Deliverability Rate</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {((domain.historicalDeliverabilityRate || 10000) / 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-foreground-subtle mt-1">
              Delivered campaign events / verified
            </div>
          </div>

          <div className="p-4 bg-surface-elevated rounded border border-border">
            <div className="text-foreground-subtle text-[11px]">Historical Hard Bounce Rate</div>
            <div className="text-2xl font-bold text-red-400 mt-1">
              {((domain.historicalBounceRate || 0) / 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-foreground-subtle mt-1">
              Observed bounce outcome frequency
            </div>
          </div>
        </div>
      </div>

      {/* Optional Domain Email Auth Diagnostics */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted font-mono flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Email Authentication Diagnostics (SPF, DMARC, DKIM)</span>
          </h2>
          <p className="text-[11px] text-foreground-subtle mt-0.5">
            Diagnostic verification of sender domain authentication policies.
          </p>
        </div>

        <div className="space-y-4 text-xs font-mono">
          {/* SPF */}
          <div className="p-3 bg-surface-elevated rounded border border-border flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                {authDiagnostics?.spf?.present ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                )}
                <span>SPF Record: {authDiagnostics?.spf?.present ? "PASS" : "FAIL / NOT FOUND"}</span>
              </div>
              {authDiagnostics?.spf?.record && (
                <div className="text-[11px] text-foreground-muted mt-1 break-all">
                  {authDiagnostics.spf.record}
                </div>
              )}
            </div>
          </div>

          {/* DMARC */}
          <div className="p-3 bg-surface-elevated rounded border border-border flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                {authDiagnostics?.dmarc?.present ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                )}
                <span>DMARC Record: {authDiagnostics?.dmarc?.present ? "PASS" : "FAIL / NOT FOUND"}</span>
              </div>
              {authDiagnostics?.dmarc?.record && (
                <div className="text-[11px] text-foreground-muted mt-1 break-all">
                  {authDiagnostics.dmarc.record}
                </div>
              )}
            </div>
          </div>

          {/* DKIM Selector Tester */}
          <div className="p-3 bg-surface-elevated rounded border border-border">
            <div className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
              {authDiagnostics?.dkim?.checked ? (
                authDiagnostics.dkim.present ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-amber-400" />
                )
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-foreground-subtle" />
              )}
              <span>
                DKIM Selector Check:{" "}
                {authDiagnostics?.dkim?.checked
                  ? authDiagnostics.dkim.present
                    ? "PASS (Key Found)"
                    : "NOT FOUND"
                  : "ENTER SELECTOR TO TEST"}
              </span>
            </div>

            <form onSubmit={handleTestDkim} className="flex gap-2 max-w-md mt-2">
              <input
                type="text"
                value={dkimSelector}
                onChange={(e) => setDkimSelector(e.target.value)}
                placeholder="Selector (e.g. google, k1, default)"
                className="flex-1 bg-surface border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={testingDkim}
                className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded text-xs font-semibold flex items-center gap-1.5"
              >
                {testingDkim ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Test DKIM"}
              </button>
            </form>

            {authDiagnostics?.dkim?.record && (
              <div className="text-[11px] text-foreground-muted mt-2 break-all bg-surface p-2 rounded border border-border">
                {authDiagnostics.dkim.record}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sample Addresses on this Domain */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted font-mono">
            Addresses Verified on {domain.domain}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-border bg-surface-elevated/40 text-[11px] uppercase tracking-wider text-foreground-subtle">
                <th className="p-3 pl-4">Email</th>
                <th className="p-3">Status</th>
                <th className="p-3">Risk</th>
                <th className="p-3">Last Checked</th>
                <th className="p-3 pr-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sampleEmails.map((e: any) => (
                <tr key={e.id}>
                  <td className="p-3 pl-4 font-semibold text-foreground">
                    <Link href={`/emails/${encodeURIComponent(e.email)}`} className="hover:text-primary">
                      {e.email}
                    </Link>
                  </td>
                  <td className="p-3">
                    <StatusBadge status={e.status} size="sm" />
                  </td>
                  <td className="p-3">
                    <RiskGauge score={e.riskScore} size="sm" />
                  </td>
                  <td className="p-3 text-foreground-subtle">
                    {new Date(e.lastVerifiedAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 pr-4 text-right">
                    <Link
                      href={`/emails/${encodeURIComponent(e.email)}`}
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
      </div>
    </div>
  );
}
