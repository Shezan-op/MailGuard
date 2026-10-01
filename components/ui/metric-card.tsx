import React from "react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  color?: "blue" | "emerald" | "red" | "amber" | "purple" | "slate";
  trend?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "blue",
  trend,
}: MetricCardProps) {
  const colorMap = {
    blue: "text-primary border-primary/20 bg-primary/10",
    emerald: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
    red: "text-red-400 border-red-500/20 bg-red-500/10",
    amber: "text-amber-400 border-amber-500/20 bg-amber-500/10",
    purple: "text-purple-400 border-purple-500/20 bg-purple-500/10",
    slate: "text-slate-400 border-slate-500/20 bg-slate-500/10",
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex flex-col justify-between hover:border-border-strong transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-foreground-muted font-medium">
          {title}
        </span>
        {Icon && (
          <div className={`p-1.5 rounded border ${colorMap[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 mt-1 text-xs text-foreground-subtle">
            {trend && <span className="font-medium text-emerald-400">{trend}</span>}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
