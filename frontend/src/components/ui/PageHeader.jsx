import React from "react";

/**
 * Standard PageHeader component.
 * Page title: 24px semibold, ink.
 * Description: 14px muted.
 * Primary action aligned right.
 */
export default function PageHeader({ title, description, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 mb-8 border-b border-border">
      <div>
        <h1 className="text-xl font-semibold text-ink tracking-tight m-0">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted mt-1 m-0">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex items-center gap-3 shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
