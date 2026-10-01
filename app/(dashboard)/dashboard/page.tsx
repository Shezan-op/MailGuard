"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  MailCheck,
  ShieldAlert,
  Users,
  Clock,
  ShieldBan,
  ArrowRight,
  Upload,
  Search,
  Activity,
} from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { RiskGauge } from "@/components/ui/risk-gauge";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [recentEmails, setRecentEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [healthRes, emailsRes] = await Promise.all([
          fetch("/api/system/health"),
          fetch("/api/emails?limit=10"),
        ]);

        const healthData = await healthRes.json();
        const emailsData = await emailsRes.json();

        if (healthData.success) {
          setStats(healthData.data);
        }
        if (emailsData.success) {
          setRecentEmails(emailsData.data.emails || []);
        }
      } catch (e) {
        console.error("Failed to load dashboard:", e);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const total = stats?.database?.totalEmails || 0;
  const deliverableCount = recentEmails.filter((e) => e.finalStatus === "DELIVERABLE").length;
  const healthScore = total > 0 ? Math.round((deliverableCount / Math.max(recentEmails.length, 1)) * 100) : 100;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner & Quick CTAs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
            Deliverability Intelligence Overview
          </h1>
          <p className="text-xs text-foreground-muted mt-1">
            Deterministic local verification without third-party validation APIs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/verify"
            className="flex items-center gap-2 px-3 py-2 bg-surface border border-border hover:border-border-strong rounded text-xs font-medium text-foreground transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-primary" />
            <span>Verify Single Email</span>
          </Link>
          <Link
            href="/jobs"
            className="flex items-center gap-2 px-3 py-2 bg-primary hover:bg-primary-hover rounded text-xs font-medium text-white transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Email List</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Total Emails"
          value={total}
          color="blue"
          subtitle="In Local Workspace"
        />
        <MetricCard
          title="Deliverable"
          value={deliverableCount}
          color="emerald"
          icon={CheckCircle2}
        />
        <MetricCard
          title="Undeliverable"
          value={recentEmails.filter((e) => e.finalStatus === "UNDELIVERABLE").length}
          color="red"
          icon={XCircle}
        />
        <MetricCard
          title="Risky"
          value={recentEmails.filter((e) => e.finalStatus === "RISKY").length}
          color="amber"
          icon={AlertTriangle}
        />
        <MetricCard
          title="Catch-All"
          value={recentEmails.filter((e) => e.finalStatus === "CATCH_ALL").length}
          color="amber"
          icon={MailCheck}
        />
        <MetricCard
          title="Unknown"
          value={recentEmails.filter((e) => e.finalStatus === "UNKNOWN").length}
          color="slate"
          icon={HelpCircle}
        />
      </div>

      {/* Secondary Metrics & Deliverability Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Score Card */}
        <div className="bg-surface border border-border rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-foreground-muted font-medium">
                Deliverability Health
              </span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-bold font-mono tracking-tight text-foreground">
                {healthScore}%
              </span>
              <span className="text-xs text-foreground-muted">deliverable rate</span>
            </div>
            <p className="text-xs text-foreground-subtle mt-2">
              Based on the percentage of verified addresses currently confirmed deliverable.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs">
            <span className="text-foreground-muted">Suppressed Entries:</span>
            <span className="font-mono font-semibold text-foreground">
              {stats?.database?.totalSuppressions || 0}
            </span>
          </div>
        </div>

        {/* Breakdown by Classification */}
        <div className="bg-surface border border-border rounded-lg p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-foreground-muted font-medium">
              Flagged Categories
            </span>
            <div className="space-y-3 mt-4 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-foreground-muted">
                  <ShieldAlert className="w-3.5 h-3.5 text-pink-400" /> Disposable Providers
                </span>
                <span className="font-semibold text-foreground">
                  {recentEmails.filter((e) => e.disposableStatus).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-foreground-muted">
                  <Users className="w-3.5 h-3.5 text-purple-400" /> Role-Based Mailboxes
                </span>
                <span className="font-semibold text-foreground">
                  {recentEmails.filter((e) => e.roleBasedStatus).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-foreground-muted">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" /> Temporary Greylist
                </span>
                <span className="font-semibold text-foreground">
                  {recentEmails.filter((e) => e.finalStatus === "TEMPORARY").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-foreground-muted">
                  <ShieldBan className="w-3.5 h-3.5 text-red-400" /> Active Suppressions
                </span>
                <span className="font-semibold text-foreground">
                  {stats?.database?.totalSuppressions || 0}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/60">
            <Link
              href="/results"
              className="text-xs text-primary hover:text-primary-light flex items-center justify-between"
            >
              <span>Explore full dataset in Results Table</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Infrastructure & Engine Status */}
        <div className="bg-surface border border-border rounded-lg p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-foreground-muted font-medium">
              System Health
            </span>
            <div className="space-y-3 mt-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-foreground-muted">DNS Resolution:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[11px]">
                  {stats?.dns?.status?.toUpperCase() || "OPERATIONAL"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-muted">Database Storage:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[11px]">
                  HEALTHY
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-muted">Tracked Domains:</span>
                <span className="font-mono text-foreground font-semibold">
                  {stats?.database?.totalDomains || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground-muted">Campaign Events:</span>
                <span className="font-mono text-foreground font-semibold">
                  {stats?.database?.totalDeliveryEvents || 0}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/60">
            <Link
              href="/system"
              className="text-xs text-primary hover:text-primary-light flex items-center justify-between"
            >
              <span>Inspect Port 25 & Network Diagnostics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground font-mono">
              Recent Verification Activity
            </h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              Latest individual addresses evaluated through the verification engine.
            </p>
          </div>
          <Link
            href="/results"
            className="text-xs text-primary hover:text-primary-light flex items-center gap-1 font-medium"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentEmails.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-elevated border border-border flex items-center justify-center mx-auto mb-3 text-foreground-subtle">
              <MailCheck className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Workspace is ready</h3>
            <p className="text-xs text-foreground-muted max-w-sm mx-auto mt-1">
              Verify an individual email address or upload a CSV to inspect deliverability.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <Link
                href="/verify"
                className="px-3 py-1.5 bg-primary text-white rounded text-xs font-medium"
              >
                Verify an Email
              </Link>
              <Link
                href="/jobs"
                className="px-3 py-1.5 bg-surface-elevated border border-border text-foreground rounded text-xs font-medium"
              >
                Upload Email List
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-elevated/40 text-[11px] uppercase tracking-wider text-foreground-subtle font-mono">
                  <th className="p-3 pl-4">Email Address</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Risk Score</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">SMTP Code</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {recentEmails.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-elevated/30 transition-colors">
                    <td className="p-3 pl-4 font-mono font-medium text-foreground">
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
                    <td className="p-3 text-foreground-muted">{row.providerName || "Unknown"}</td>
                    <td className="p-3 font-mono text-foreground-subtle">
                      {row.smtpCode ? <span className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border">{row.smtpCode}</span> : "—"}
                    </td>
                    <td className="p-3 pr-4 text-right">
                      <Link
                        href={`/emails/${encodeURIComponent(row.normalizedEmail)}`}
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
