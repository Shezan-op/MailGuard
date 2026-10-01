import React from "react";
import { ConfidenceLevel } from "@/server/verification/types";

interface ConfidenceBadgeProps {
  confidence: ConfidenceLevel | string;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const norm = (confidence || "").toUpperCase();

  switch (norm) {
    case "HIGH":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          HIGH
        </span>
      );
    case "MEDIUM":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          MEDIUM
        </span>
      );
    case "LOW":
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
          LOW
        </span>
      );
  }
}
