import React from "react";

/**
 * Standard Table components.
 * Row height: 44px (h-11), thin row dividers.
 * Full content width with horizontal overflow scrolling when needed.
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
    <thead className={`bg-table-header sticky top-0 border-b border-border text-xs text-muted font-medium z-10 ${className}`}>
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
      className={`h-10 transition-colors ${
        isTotal
          ? "border-t-2 border-border font-semibold bg-table-hover/50"
          : onClick
          ? "hover:bg-table-hover cursor-pointer"
          : "hover:bg-table-hover"
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
    <td className={`px-4 py-1.5 text-sm text-ink ${alignClass} ${className}`} {...rest}>
      {children}
    </td>
  );
}

export function TableHeaderCell({ children, align = "left", className = "", ...rest }) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th className={`px-4 py-2 font-medium ${alignClass} ${className}`} {...rest}>
      {children}
    </th>
  );
}
