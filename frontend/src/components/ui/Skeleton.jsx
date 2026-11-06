import React from "react";

/**
 * Standard Skeleton component for calm inline loading states.
 */
export function SkeletonBlock({ className = "" }) {
  return (
    <div
      className={`bg-border/60 rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonRows({ count = 4, className = "" }) {
  return (
    <div className={`divide-y divide-border ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-10 px-4 flex items-center gap-4">
          <SkeletonBlock className="h-3.5 w-1/4" />
          <SkeletonBlock className="h-3.5 w-1/3" />
          <SkeletonBlock className="h-3.5 w-1/6 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export default function Skeleton({ className = "" }) {
  return <SkeletonBlock className={className} />;
}
