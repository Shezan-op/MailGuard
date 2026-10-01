import React from "react";

interface RiskGaugeProps {
  score: number; // 0 - 100
  size?: "sm" | "md" | "lg";
}

export function RiskGauge({ score, size = "md" }: RiskGaugeProps) {
  const safeScore = Math.max(0, Math.min(100, score || 0));

  let colorClass = "text-emerald-400 border-emerald-500/20 bg-emerald-500/10";
  let barColor = "bg-emerald-500";

  if (safeScore >= 80) {
    colorClass = "text-red-400 border-red-500/20 bg-red-500/10";
    barColor = "bg-red-500";
  } else if (safeScore >= 50) {
    colorClass = "text-amber-400 border-amber-500/20 bg-amber-500/10";
    barColor = "bg-amber-500";
  } else if (safeScore >= 25) {
    colorClass = "text-yellow-400 border-yellow-500/20 bg-yellow-500/10";
    barColor = "bg-yellow-500";
  }

  if (size === "sm") {
    return (
      <div className="flex items-center gap-1.5 font-mono text-xs">
        <span className={`px-1.5 py-0.5 rounded border ${colorClass} font-semibold`}>
          {safeScore}
        </span>
        <div className="w-12 h-1.5 bg-surface-elevated rounded-full overflow-hidden border border-border/50">
          <div className={`h-full ${barColor}`} style={{ width: `${safeScore}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 font-mono">
      <div className={`px-2 py-1 rounded border font-semibold text-sm ${colorClass}`}>
        {safeScore}/100
      </div>
      <div className="w-20 h-2 bg-surface-elevated rounded-full overflow-hidden border border-border/50">
        <div className={`h-full ${barColor}`} style={{ width: `${safeScore}%` }} />
      </div>
    </div>
  );
}
