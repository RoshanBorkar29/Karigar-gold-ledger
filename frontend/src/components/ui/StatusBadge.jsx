import React from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Clock } from "lucide-react";

/**
 * Standard StatusBadge component.
 * Restrained palette:
 * - ok: #2F6B3F with light tint #EAF3EC
 * - review: #9A5B00 with light tint #FDF5E6
 * - problem: #A32D2D with light tint #FBEAEA
 */
export default function StatusBadge({ status, label, className = "" }) {
  let tone = "neutral";
  let Icon = null;
  let text = label || status;

  const s = String(status || "").toLowerCase();

  if (s.includes("ok") || s.includes("within") || s.includes("approved") || s.includes("active") || s.includes("closed")) {
    tone = "ok";
    Icon = CheckCircle2;
  } else if (s.includes("review") || s.includes("open") || s.includes("pending") || s.includes("warning")) {
    tone = "review";
    Icon = Clock;
  } else if (s.includes("problem") || s.includes("beyond") || s.includes("loss") || s.includes("excess") || s.includes("void")) {
    tone = "problem";
    Icon = AlertTriangle;
  }

  const toneClasses = {
    ok: "bg-status-ok-tint text-status-ok border-status-ok/20",
    review: "bg-status-review-tint text-status-review border-status-review/20",
    problem: "bg-status-problem-tint text-status-problem border-status-problem/20",
    neutral: "bg-background text-muted border-border",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border ${toneClasses} ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0 stroke-[2]" />}
      <span>{text}</span>
    </span>
  );
}
