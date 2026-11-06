import React from "react";

/**
 * Standard Form Field component.
 * Labels above input (14px, ink).
 * Helper text below (12px, muted).
 * Errors below in problem color (12px, #A32D2D).
 * Inputs 44px high, border, visible 2px focus ring in bronze.
 */
export default function Field({
  label,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  readOnly = false,
  error,
  helperText,
  children,
  className = "",
  inputClassName = "",
  ...rest
}) {
  const inputBaseClasses = `w-full h-11 px-3 bg-surface border rounded text-sm text-ink outline-none transition
    ${error ? "border-status-problem focus:ring-2 focus:ring-status-problem/20" : "border-border focus:border-bronze focus:ring-2 focus:ring-bronze/20"}
    ${disabled ? "bg-background text-muted cursor-not-allowed border-dashed" : ""}
    ${inputClassName}`;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-ink"
        >
          {label} {required && <span className="text-status-problem" aria-hidden="true">*</span>}
        </label>
      )}

      {children ? (
        children
      ) : type === "textarea" ? (
        <textarea
          id={id}
          value={value ?? ""}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          rows={3}
          className={`w-full p-3 bg-surface border rounded text-sm text-ink outline-none transition
            ${error ? "border-status-problem focus:ring-2 focus:ring-status-problem/20" : "border-border focus:border-bronze focus:ring-2 focus:ring-bronze/20"}
            ${disabled ? "bg-background text-muted cursor-not-allowed border-dashed" : ""}
            ${inputClassName}`}
          {...rest}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value ?? ""}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          className={inputBaseClasses}
          {...rest}
        />
      )}

      {error ? (
        <p className="text-xs text-status-problem font-medium mt-1">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-muted mt-1">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
