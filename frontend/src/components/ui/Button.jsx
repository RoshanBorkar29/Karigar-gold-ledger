import React from "react";

/**
 * Standard Button component.
 * Primary (bronze fill, white text).
 * Secondary (border, surface bg, ink text).
 * Text (flat text button).
 * Tap target minimum 44px. 6px radius.
 */
export default function Button({
  children,
  variant = "primary", // "primary" | "secondary" | "text" | "danger"
  size = "md", // "sm" | "md" | "lg"
  type = "button",
  onClick,
  disabled = false,
  loading = false,
  disabledReason = "",
  className = "",
  icon: Icon = null,
  ...rest
}) {
  const baseClasses = "inline-flex items-center justify-center font-medium rounded transition outline-none cursor-pointer select-none";

  const sizeClasses = {
    sm: "h-9 px-3 text-xs gap-1.5 min-w-[72px]",
    md: "h-11 px-4 text-sm gap-2 min-w-[96px]",
    lg: "h-12 px-6 text-base gap-2.5",
  }[size] || "h-11 px-4 text-sm gap-2";

  const variantClasses = {
    primary: "bg-bronze text-white hover:bg-bronze-hover active:bg-bronze-hover border border-transparent focus:ring-2 focus:ring-bronze shadow-none",
    secondary: "bg-surface text-ink border border-border hover:border-bronze hover:bg-background active:bg-background focus:ring-2 focus:ring-bronze shadow-none",
    text: "bg-transparent text-muted hover:text-ink hover:bg-background active:bg-background border border-transparent focus:ring-2 focus:ring-bronze shadow-none",
    danger: "bg-status-problem text-white hover:bg-status-problem/90 border border-transparent focus:ring-2 focus:ring-status-problem shadow-none",
  }[variant] || "";

  const disabledClasses = disabled
    ? "opacity-50 cursor-not-allowed pointer-events-none border-border bg-background text-muted"
    : "";

  return (
    <div className="inline-flex items-center gap-3">
      <button
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        className={`${baseClasses} ${sizeClasses} ${variantClasses} ${disabledClasses} ${className}`}
        {...rest}
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : Icon ? (
          <Icon className="w-4 h-4 shrink-0 stroke-[1.75]" />
        ) : null}
        <span>{children}</span>
      </button>
      {disabled && disabledReason && (
        <span className="text-xs text-muted whitespace-normal">
          {disabledReason}
        </span>
      )}
    </div>
  );
}
