import React from "react";
import Button from "./ui/Button";

/**
 * EmptyState: A short sentence and the next action. No illustrations.
 */
export default function EmptyState({
  title = "No records found",
  description = "No entries have been recorded yet.",
  actionText = null,
  onAction = null,
  className = "",
}) {
  return (
    <div className={`py-12 px-6 text-center border border-border border-dashed rounded bg-surface/50 my-4 ${className}`}>
      <h3 className="text-sm font-semibold text-ink m-0">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-muted mt-1 max-w-sm mx-auto m-0">
          {description}
        </p>
      )}
      {actionText && onAction && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
}
