import React from "react";

/**
 * Pill segmented control for switching between a small set of views
 * (e.g. List/Calendar, Bodyweight/Strength). Controlled via value/onChange.
 */
export default function Segmented({
  options,
  value,
  onChange,
  className = "",
}) {
  return (
    <div
      className={`inline-flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800 ${className}`}
    >
      {options.map(([val, label]) => {
        const active = val === value;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            aria-pressed={active}
            className={[
              "rounded-lg px-3 py-1.5 text-sm transition",
              active
                ? "bg-white font-medium text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
