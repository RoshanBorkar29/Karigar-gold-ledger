import React from "react";
import { fmtG, fmtPurity, fmtPaise } from "../lib/format";

/**
 * Component rendering gold values (weight, purity, monetary) in tabular monospace format.
 */
export default function GoldNumber({
  value,
  type = "weight", // "weight" | "purity" | "wastage" | "money"
  unit = true,
  className = "",
  size = "md", // "sm" | "md" | "lg"
  highlight = null, // "positive" | "negative" | "warning" | null
}) {
  let formatted = "";
  let unitText = "";

  if (type === "weight") {
    formatted = fmtG(value);
    unitText = "g";
  } else if (type === "purity" || type === "wastage") {
    formatted = fmtPurity(value);
    unitText = "%";
  } else if (type === "money") {
    formatted = fmtPaise(value);
    unitText = "";
  }

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base font-bold",
    xl: "text-xl font-bold",
  }[size] || "text-sm";

  const colorClasses = {
    positive: "text-emerald-400",
    negative: "text-rose-400",
    warning: "text-amber-400",
    gold: "text-yellow-400",
  }[highlight] || "text-slate-100";

  return (
    <span
      className={`font-mono tabular-nums inline-flex items-baseline gap-1 ${sizeClasses} ${colorClasses} ${className}`}
    >
      <span>{formatted}</span>
      {unit && unitText && (
        <span className="text-xs font-normal text-slate-400 select-none">
          {unitText}
        </span>
      )}
    </span>
  );
}
