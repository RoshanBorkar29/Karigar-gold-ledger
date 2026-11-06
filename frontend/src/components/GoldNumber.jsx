import React from "react";
import { fmtG, fmtPurity, fmtPaise } from "../lib/format";

/**
 * Universal GoldNumber component.
 * Uses IBM Plex Mono, font-variant-numeric: tabular-nums.
 * Always 3 decimals for grams, 2 for percent, with a muted 'g' or '%' unit.
 * Key balances: 24px semibold; supporting figures: 14px.
 * Negative or over-allowance values use the problem color PLUS a text label.
 */
export default function GoldNumber({
  value,
  type = "weight", // "weight" | "purity" | "wastage" | "money" | "count"
  unit = true,
  size = "sm", // "xs" (12px) | "sm" (14px) | "base" (16px) | "xl" (24px)
  isKeyBalance = false,
  isNegative = false,
  negativeLabel = "Deficit",
  isExcess = false,
  excessLabel = "Over allowance",
  align = "left", // "left" | "right" | "center"
  className = "",
}) {
  let formatted = "";
  let unitText = "";

  const numVal = Number(value ?? 0);
  const actualNegative = isNegative || numVal < 0;

  if (type === "weight") {
    formatted = fmtG(value);
    unitText = "g";
  } else if (type === "purity" || type === "wastage") {
    formatted = fmtPurity(value);
    unitText = "%";
  } else if (type === "money") {
    formatted = fmtPaise(value);
    unitText = "";
  } else {
    formatted = String(value ?? "0");
    unitText = "";
  }

  // Size mapping strictly honoring the 4 design system sizes
  let sizeClass = "text-sm";
  if (isKeyBalance || size === "xl") {
    sizeClass = "text-xl font-semibold tracking-tight";
  } else if (size === "base") {
    sizeClass = "text-base font-medium";
  } else if (size === "xs") {
    sizeClass = "text-xs font-normal";
  } else {
    sizeClass = "text-sm font-normal";
  }

  // Problem state styling
  const hasProblem = actualNegative || isExcess;
  const textColor = hasProblem ? "text-status-problem" : "text-ink";
  const alignClass = align === "right" ? "justify-end text-right" : align === "center" ? "justify-center text-center" : "justify-start text-left";

  return (
    <span className={`inline-flex flex-col ${align === "right" ? "items-end" : align === "center" ? "items-center" : "items-start"} ${className}`}>
      <span className={`font-mono tabular-nums inline-flex items-baseline ${alignClass} ${sizeClass} ${textColor}`}>
        <span>{formatted}</span>
        {unit && unitText && (
          <span className="text-muted text-xs font-sans font-normal ml-1 select-none">
            {unitText}
          </span>
        )}
      </span>
      {actualNegative && (
        <span className="text-xs font-sans font-medium text-status-problem mt-0.5">
          {negativeLabel}
        </span>
      )}
      {!actualNegative && isExcess && (
        <span className="text-xs font-sans font-medium text-status-problem mt-0.5">
          {excessLabel}
        </span>
      )}
    </span>
  );
}
