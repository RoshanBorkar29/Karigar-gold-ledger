import React from "react";

/**
 * Standard Form Field component.
 * Labels above input (14px, ink). Gap 6px.
 * Inputs 40px high on desktop, 44px on touch devices.
 * Required marker: small muted asterisk, not red.
 * Errors below in problem color (12px, #A32D2D).
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
  unit = null,
  action = null,
  error,
  helperText,
  children,
  className = "",
  inputClassName = "",
  ...rest
}) {
  const inputBaseClasses = `w-full h-11 sm:h-10 px-3 ${unit ? "pr-9" : ""} bg-white border rounded text-sm text-ink placeholder:text-muted/40 outline-none transition
    ${error ? "border-status-problem focus:ring-2 focus:ring-status-problem" : "border-[#D9D1BF] focus:border-bronze focus:ring-2 focus:ring-bronze"}
    ${disabled ? "bg-background text-muted cursor-not-allowed border-dashed" : ""}
    ${inputClassName}`;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={id}
            className="block text-sm font-medium text-ink"
          >
            {label} {required && <span className="text-muted text-xs select-none ml-0.5" aria-hidden="true">*</span>}
          </label>
          {action && (
            <div className="shrink-0">
              {action}
            </div>
          )}
        </div>
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
          className={`w-full p-3 bg-white border rounded text-sm text-ink placeholder:text-muted/40 outline-none transition
            ${error ? "border-status-problem focus:ring-2 focus:ring-status-problem" : "border-[#D9D1BF] focus:border-bronze focus:ring-2 focus:ring-bronze"}
            ${disabled ? "bg-background text-muted cursor-not-allowed border-dashed" : ""}
            ${inputClassName}`}
          {...rest}
        />
      ) : unit ? (
        <div className="relative flex items-center">
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
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted pointer-events-none select-none">
            {unit}
          </span>
        </div>
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
        <p className="text-xs text-status-problem font-medium mt-1 m-0">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-muted mt-1 m-0 truncate">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
