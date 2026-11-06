import React from "react";

/**
 * Standard Table components.
 * Header row 12px uppercase-free muted text.
 * Row height 48px, thin row dividers.
 * Numeric columns right-aligned. Hover tint.
 * Sticky header when scrolling.
 * Totals row separated with a stronger border.
 */
export function TableContainer({ children, className = "" }) {
  return (
    <div className={`w-full overflow-x-auto border border-border rounded bg-surface ${className}`}>
      <table className="w-full text-left border-collapse min-w-[560px]">
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, className = "" }) {
  return (
    <thead className={`bg-background/80 sticky top-0 border-b border-border text-xs text-muted font-medium z-10 ${className}`}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = "" }) {
  return (
    <tbody className={`divide-y divide-border ${className}`}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, isTotal = false, className = "", onClick, ...rest }) {
  return (
    <tr
      onClick={onClick}
      className={`h-12 transition-colors ${
        isTotal
          ? "border-t-2 border-border font-semibold bg-background/50"
          : onClick
          ? "hover:bg-background/60 cursor-pointer"
          : "hover:bg-background/40"
      } ${className}`}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, align = "left", className = "", ...rest }) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <td className={`px-4 py-2.5 text-sm text-ink ${alignClass} ${className}`} {...rest}>
      {children}
    </td>
  );
}

export function TableHeaderCell({ children, align = "left", className = "", ...rest }) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th className={`px-4 py-3 font-medium ${alignClass} ${className}`} {...rest}>
      {children}
    </th>
  );
}
