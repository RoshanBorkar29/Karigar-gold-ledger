import React from "react";
import { Inbox } from "lucide-react";

export default function EmptyState({
  title = "No records found",
  description = "No transactions or entries have been recorded yet.",
  icon: Icon = Inbox,
  actionText = null,
  onAction = null,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-lg border border-dashed border-slate-700 bg-slate-900/40 my-4">
      <div className="p-3 rounded-full bg-slate-800/80 text-yellow-400 mb-3 shadow-inner">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      <p className="mt-1 text-sm text-slate-400 max-w-sm">{description}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-4 btn-gold text-xs px-4 py-2"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
