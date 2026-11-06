import React from "react";
import Button from "./ui/Button";

/**
 * Compact EmptyState: ONE muted line, no dashed box, no heading, no illustration, max 56px tall.
 */
export default function EmptyState({
  title = "No records found",
  description,
  actionText = null,
  onAction = null,
  className = "",
}) {
  const message = description || title || "No entries recorded yet.";

  return (
    <div className={`h-14 max-h-[56px] px-4 flex items-center justify-center text-xs text-muted ${className}`}>
      <span>{message}</span>
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="ml-2 text-xs text-bronze hover:underline font-medium bg-transparent border-none cursor-pointer p-0"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
