"use client";

import React, { useState, useEffect } from "react";
import { Settings, Save, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (json.success) {
        setSettings(json.data.settings || {});
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key: string, val: string) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg("Configuration saved successfully.");
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-foreground-muted font-mono">
        Loading system configuration...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
          Engine Configuration & Identity
        </h1>
        <p className="text-xs text-foreground-muted mt-1">
          Tune timeouts, concurrency limits, protocol identity, and deliverability classification thresholds.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-400 font-mono">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: SMTP Identity */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="border-b border-border pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
              SMTP Protocol Identity
            </h2>
            <p className="text-[11px] text-foreground-subtle mt-0.5">
              Identity parameters presented during recipient SMTP handshake (no actual email content is sent).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <label className="block text-foreground-subtle mb-1">HELO / EHLO Domain</label>
              <input
                type="text"
                value={settings.HELO_DOMAIN || ""}
                onChange={(e) => handleChange("HELO_DOMAIN", e.target.value)}
                placeholder="mailguard.local or your-domain.com"
                className="w-full bg-surface-elevated border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] text-foreground-subtle mt-1 block">
                FQDN identifier transmitted in the initial EHLO command.
              </span>
            </div>

            <div>
              <label className="block text-foreground-subtle mb-1">Verification Sender (MAIL FROM)</label>
              <input
                type="email"
                value={settings.VERIFICATION_FROM_ADDRESS || ""}
                onChange={(e) => handleChange("VERIFICATION_FROM_ADDRESS", e.target.value)}
                placeholder="verify@your-domain.com"
                className="w-full bg-surface-elevated border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] text-foreground-subtle mt-1 block">
                Reverse-path address checked by recipient mail filters.
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Concurrency & Timeouts */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="border-b border-border pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
              Concurrency & Network Safety
            </h2>
            <p className="text-[11px] text-foreground-subtle mt-0.5">
              Rate pacing to prevent recipient mail servers from throttling or temporary greylisting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <label className="block text-foreground-subtle mb-1">Max Global Concurrency</label>
              <input
                type="number"
                value={settings.MAX_GLOBAL_CONCURRENCY || "10"}
                onChange={(e) => handleChange("MAX_GLOBAL_CONCURRENCY", e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] text-foreground-subtle mt-1 block">Parallel active connections.</span>
            </div>

            <div>
              <label className="block text-foreground-subtle mb-1">Max Domain Concurrency</label>
              <input
                type="number"
                value={settings.MAX_DOMAIN_CONCURRENCY || "2"}
                onChange={(e) => handleChange("MAX_DOMAIN_CONCURRENCY", e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] text-foreground-subtle mt-1 block">Simultaneous connections per MX.</span>
            </div>

            <div>
              <label className="block text-foreground-subtle mb-1">SMTP Timeout (ms)</label>
              <input
                type="number"
                value={settings.SMTP_TIMEOUT_MS || "10000"}
                onChange={(e) => handleChange("SMTP_TIMEOUT_MS", e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] text-foreground-subtle mt-1 block">Socket timeout in milliseconds.</span>
            </div>

            <div>
              <label className="block text-foreground-subtle mb-1">DNS Timeout (ms)</label>
              <input
                type="number"
                value={settings.DNS_TIMEOUT_MS || "5000"}
                onChange={(e) => handleChange("DNS_TIMEOUT_MS", e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] text-foreground-subtle mt-1 block">DNS lookup timeout.</span>
            </div>

            <div>
              <label className="block text-foreground-subtle mb-1">Max Retries (Greylisting)</label>
              <input
                type="number"
                value={settings.MAX_RETRIES || "3"}
                onChange={(e) => handleChange("MAX_RETRIES", e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] text-foreground-subtle mt-1 block">Retry count on 4xx codes.</span>
            </div>

            <div>
              <label className="block text-foreground-subtle mb-1">Cache TTL (Hours)</label>
              <input
                type="number"
                value={settings.CACHE_TTL_HOURS || "24"}
                onChange={(e) => handleChange("CACHE_TTL_HOURS", e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] text-foreground-subtle mt-1 block">Result retention window.</span>
            </div>
          </div>
        </div>

        {/* Section 3: Verification Modules & Safeguards */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="border-b border-border pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
              Verification Engine Checks
            </h2>
            <p className="text-[11px] text-foreground-subtle mt-0.5">
              Enable or disable specific heuristic and protocol evaluation modules.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <label className="flex items-center gap-3 p-3 rounded bg-surface-elevated border border-border cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.CONSERVATIVE_MODE === "true"}
                onChange={(e) => handleChange("CONSERVATIVE_MODE", e.target.checked ? "true" : "false")}
                className="rounded border-border bg-surface text-primary"
              />
              <div>
                <div className="font-semibold text-foreground">Conservative Evaluation Mode</div>
                <div className="text-[10px] text-foreground-subtle">Prioritizes cautious sender reputation safeguards.</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded bg-surface-elevated border border-border cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.CATCH_ALL_ENABLED !== "false"}
                onChange={(e) => handleChange("CATCH_ALL_ENABLED", e.target.checked ? "true" : "false")}
                className="rounded border-border bg-surface text-primary"
              />
              <div>
                <div className="font-semibold text-foreground">Synthetic Catch-All Probing</div>
                <div className="text-[10px] text-foreground-subtle">Probes random address to detect catch-all domains.</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded bg-surface-elevated border border-border cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.TYPO_DETECTION_ENABLED !== "false"}
                onChange={(e) => handleChange("TYPO_DETECTION_ENABLED", e.target.checked ? "true" : "false")}
                className="rounded border-border bg-surface text-primary"
              />
              <div>
                <div className="font-semibold text-foreground">Typo Detection & Suggestions</div>
                <div className="text-[10px] text-foreground-subtle">Suggests corrections for popular provider typos.</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded bg-surface-elevated border border-border cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.DISPOSABLE_CHECK_ENABLED !== "false"}
                onChange={(e) => handleChange("DISPOSABLE_CHECK_ENABLED", e.target.checked ? "true" : "false")}
                className="rounded border-border bg-surface text-primary"
              />
              <div>
                <div className="font-semibold text-foreground">Disposable Email Checking</div>
                <div className="text-[10px] text-foreground-subtle">Detects throwaway and temporary mail services.</div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving Changes..." : "Save Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
