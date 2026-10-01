"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, RefreshCw, Check } from "lucide-react";
import Papa from "papaparse";

export default function BounceImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);

  // Mapping state
  const [emailCol, setEmailCol] = useState("");
  const [eventCol, setEventCol] = useState("");
  const [campaignCol, setCampaignCol] = useState("");
  const [codeCol, setCodeCol] = useState("");
  const [responseCol, setResponseCol] = useState("");

  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    if (!selectedFile) return;

    setFile(selectedFile);
    setSummary(null);
    setError(null);

    // Read headers and preview
    Papa.parse(selectedFile, {
      header: true,
      preview: 5,
      complete: (results) => {
        const fields = results.meta.fields || [];
        setHeaders(fields);
        setPreviewRows(results.data || []);

        // Auto-detect mappings
        for (const f of fields) {
          const lower = f.toLowerCase();
          if (lower.includes("email") && !emailCol) setEmailCol(f);
          else if ((lower.includes("event") || lower.includes("status") || lower.includes("bounce")) && !eventCol) setEventCol(f);
          else if (lower.includes("campaign") && !campaignCol) setCampaignCol(f);
          else if (lower.includes("code") && !codeCol) setCodeCol(f);
          else if ((lower.includes("response") || lower.includes("reason") || lower.includes("diagnostic")) && !responseCol) setResponseCol(f);
        }
      },
    });
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !emailCol) return;

    setImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "mapping",
        JSON.stringify({
          emailColumn: emailCol,
          eventTypeColumn: eventCol || undefined,
          campaignColumn: campaignCol || undefined,
          smtpCodeColumn: codeCol || undefined,
          smtpResponseColumn: responseCol || undefined,
        })
      );

      const res = await fetch("/api/history/import", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        setSummary(json.data);
      } else {
        setError(json.error?.message || "Import failed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to process file");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href="/history"
          className="inline-flex items-center gap-1.5 text-xs text-foreground-subtle hover:text-foreground mb-4 font-mono transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Campaign History</span>
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
          Import Historical Campaign Bounces
        </h1>
        <p className="text-xs text-foreground-muted mt-1">
          Correlate actual bounce outcomes with historical email records to enhance risk models with first-party intelligence.
        </p>
      </div>

      {/* Summary Box upon success */}
      {summary && (
        <div className="bg-surface border border-emerald-500/30 rounded-xl p-6 space-y-4 font-mono shadow-lg">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Successfully Imported {summary.totalProcessed.toLocaleString()} Delivery Events</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2">
            <div className="p-3 bg-surface-elevated rounded border border-border">
              <div className="text-foreground-subtle text-[11px]">Delivered</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">{summary.delivered}</div>
            </div>
            <div className="p-3 bg-surface-elevated rounded border border-border">
              <div className="text-foreground-subtle text-[11px]">Hard Bounces</div>
              <div className="text-lg font-bold text-red-400 mt-1">{summary.hardBounce}</div>
            </div>
            <div className="p-3 bg-surface-elevated rounded border border-border">
              <div className="text-foreground-subtle text-[11px]">Soft Bounces</div>
              <div className="text-lg font-bold text-amber-400 mt-1">{summary.softBounce}</div>
            </div>
            <div className="p-3 bg-surface-elevated rounded border border-border">
              <div className="text-foreground-subtle text-[11px]">Blocked / Other</div>
              <div className="text-lg font-bold text-slate-400 mt-1">{summary.blocked + summary.unknown}</div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Link
              href="/history"
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded text-xs font-semibold"
            >
              View Updated History &rarr;
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-3 text-xs text-red-400 font-mono">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload & Mapping Card */}
      {!summary && (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-6">
          <div className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-8 text-center bg-surface-elevated/30">
            <input
              type="file"
              id="bounce-file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="bounce-file" className="cursor-pointer flex flex-col items-center">
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
                    Upload Campaign Bounce CSV
                  </span>
                  <span className="text-xs text-foreground-subtle mt-1">
                    Exported from SendGrid, Mailgun, Amazon SES, Postmark, or custom ESP
                  </span>
                </>
              )}
            </label>
          </div>

          {headers.length > 0 && (
            <form onSubmit={handleImport} className="space-y-6 pt-4 border-t border-border">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted font-mono">
                Map CSV Columns
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <label className="block text-foreground-subtle mb-1">
                    Email Column <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={emailCol}
                    onChange={(e) => setEmailCol(e.target.value)}
                    className="w-full bg-surface-elevated border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">Select email column...</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-foreground-subtle mb-1">Event / Outcome Column</label>
                  <select
                    value={eventCol}
                    onChange={(e) => setEventCol(e.target.value)}
                    className="w-full bg-surface-elevated border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">(Default: Assume Hard Bounce)</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-foreground-subtle mb-1">Campaign Name Column</label>
                  <select
                    value={campaignCol}
                    onChange={(e) => setCampaignCol(e.target.value)}
                    className="w-full bg-surface-elevated border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">None (Optional)</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-foreground-subtle mb-1">SMTP Code Column</label>
                  <select
                    value={codeCol}
                    onChange={(e) => setCodeCol(e.target.value)}
                    className="w-full bg-surface-elevated border border-border rounded p-2 text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">None (Optional)</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={importing || !emailCol}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing and Correlating...</span>
                    </>
                  ) : (
                    <>
                      <span>Import Outcomes</span>
                      <Check className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
