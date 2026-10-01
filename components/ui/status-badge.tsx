import React from "react";
import { VerificationStatus } from "@/server/verification/types";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Clock, ShieldAlert, MailCheck, Users } from "lucide-react";

interface StatusBadgeProps {
  status: VerificationStatus | string;
  size?: "sm" | "md" | "lg";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const norm = (status || "").toUpperCase();

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  };

  switch (norm) {
    case "DELIVERABLE":
      return (
        <span className={`inline-flex items-center font-medium rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 ${sizeClasses[size]}`}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          DELIVERABLE
        </span>
      );
    case "UNDELIVERABLE":
      return (
        <span className={`inline-flex items-center font-medium rounded border border-red-500/20 bg-red-500/10 text-red-400 ${sizeClasses[size]}`}>
          <XCircle className="w-3.5 h-3.5" />
          UNDELIVERABLE
        </span>
      );
    case "RISKY":
      return (
        <span className={`inline-flex items-center font-medium rounded border border-amber-500/20 bg-amber-500/10 text-amber-400 ${sizeClasses[size]}`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          RISKY
        </span>
      );
    case "CATCH_ALL":
    case "CATCH-ALL":
      return (
        <span className={`inline-flex items-center font-medium rounded border border-yellow-500/20 bg-yellow-500/10 text-yellow-400 ${sizeClasses[size]}`}>
          <MailCheck className="w-3.5 h-3.5" />
          CATCH-ALL
        </span>
      );
    case "DISPOSABLE":
      return (
        <span className={`inline-flex items-center font-medium rounded border border-pink-500/20 bg-pink-500/10 text-pink-400 ${sizeClasses[size]}`}>
          <ShieldAlert className="w-3.5 h-3.5" />
          DISPOSABLE
        </span>
      );
    case "ROLE_BASED":
    case "ROLE-BASED":
      return (
        <span className={`inline-flex items-center font-medium rounded border border-purple-500/20 bg-purple-500/10 text-purple-400 ${sizeClasses[size]}`}>
          <Users className="w-3.5 h-3.5" />
          ROLE-BASED
        </span>
      );
    case "TEMPORARY":
      return (
        <span className={`inline-flex items-center font-medium rounded border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 ${sizeClasses[size]}`}>
          <Clock className="w-3.5 h-3.5" />
          TEMPORARY
        </span>
      );
    case "PENDING":
      return (
        <span className={`inline-flex items-center font-medium rounded border border-blue-500/20 bg-blue-500/10 text-blue-400 animate-pulse ${sizeClasses[size]}`}>
          <Clock className="w-3.5 h-3.5" />
          PENDING
        </span>
      );
    case "UNKNOWN":
    default:
      return (
        <span className={`inline-flex items-center font-medium rounded border border-slate-500/20 bg-slate-500/10 text-slate-400 ${sizeClasses[size]}`}>
          <HelpCircle className="w-3.5 h-3.5" />
          UNKNOWN
        </span>
      );
  }
}
