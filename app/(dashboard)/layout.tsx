import React from "react";
import { Sidebar } from "@/components/layout/sidebar";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="h-16 border-b border-border bg-surface/50 backdrop-blur px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="text-xs text-foreground-subtle uppercase tracking-wider font-mono">
              Operational Workspace
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-foreground-subtle">Mode:</span>
            <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border text-foreground-muted">
              Conservative
            </span>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
