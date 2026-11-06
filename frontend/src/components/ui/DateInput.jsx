import React from "react";
import { Calendar } from "lucide-react";
import { fmtDate } from "../../lib/format";

/**
 * Standard DateInput component.
 * Displays date in 'DD Mon YYYY' format while preserving ISO 'YYYY-MM-DD' storage.
 * Height 40px desktop / 44px mobile.
 */
export default function DateInput({
  label,
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  className = "",
  ...rest
}) {
  const displayDate = value ? fmtDate(value) : "Select date";

  const inputEl = (
    <div className={`relative flex items-center ${className}`}>
      <input
        type="date"
        id={id}
        value={value || ""}
        onChange={(e) => {
          if (typeof onChange === "function") {
            const val = e?.target?.value !== undefined ? e.target.value : e;
            onChange(val);
          }
        }}
        disabled={disabled}
        required={required}
        className="w-full h-11 sm:h-10 pl-9 pr-3 bg-white border border-[#D9D1BF] rounded text-sm text-transparent focus:text-transparent selection:bg-transparent outline-none focus:border-bronze focus:ring-2 focus:ring-bronze cursor-pointer transition"
        {...rest}
      />
      <Calendar className="w-4 h-4 text-muted absolute left-3 pointer-events-none stroke-[1.75]" />
      <span className="absolute left-9 pointer-events-none text-sm font-sans text-ink select-none">
        {displayDate}
      </span>
    </div>
  );

  if (label) {
    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label} {required && <span className="text-muted text-xs select-none ml-0.5">*</span>}
        </label>
        {inputEl}
      </div>
    );
  }

  return inputEl;
}

