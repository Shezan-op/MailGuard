"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckCircle,
  ListOrdered,
  TableProperties,
  Mail,
  Globe2,
  History,
  ShieldBan,
  Settings,
  Activity,
  LogOut,
  ShieldCheck,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {}
  };

  const navSections = [
    {
      label: "OVERVIEW",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/verify", label: "Verify", icon: CheckCircle },
        { href: "/jobs", label: "Jobs", icon: ListOrdered },
        { href: "/results", label: "Results", icon: TableProperties },
      ],
    },
    {
      label: "INTELLIGENCE",
      items: [
        { href: "/emails", label: "Emails", icon: Mail },
        { href: "/domains", label: "Domains", icon: Globe2 },
        { href: "/history", label: "History", icon: History },
        { href: "/suppressions", label: "Suppressions", icon: ShieldBan },
      ],
    },
    {
      label: "SYSTEM",
      items: [
        { href: "/settings", label: "Settings", icon: Settings },
        { href: "/system", label: "System", icon: Activity },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col justify-between shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div>
        <div className="h-16 flex items-center px-6 border-b border-border gap-3">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold tracking-wider text-sm text-foreground flex items-center gap-1.5 font-mono">
              MAILGUARD
            </div>
            <div className="text-[10px] text-foreground-subtle tracking-tight uppercase">
              Private Intelligence
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="p-4 space-y-6">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="px-3 mb-2 text-[10px] font-semibold tracking-wider text-foreground-subtle uppercase">
                {section.label}
              </div>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-all ${
                          isActive
                            ? "bg-primary/15 text-primary-light border border-primary/25 font-semibold"
                            : "text-foreground-muted hover:text-foreground hover:bg-surface-elevated border border-transparent"
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer / User Profile & Status */}
      <div className="p-4 border-t border-border bg-surface-elevated/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="text-[11px] text-foreground-muted font-mono">Engine Online</div>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-1.5 rounded hover:bg-surface-elevated text-foreground-subtle hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 text-[10px] text-foreground-subtle">
          MailGuard Engine v1.0.0
        </div>
      </div>
    </aside>
  );
}
