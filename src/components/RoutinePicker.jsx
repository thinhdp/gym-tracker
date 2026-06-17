import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";

/**
 * A button that opens a dropdown of saved routines.
 * onPick(routine) is called when the user selects one.
 */
export default function RoutinePicker({ onPick, label = "Load routine" }) {
  const { routines } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (routines.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
      >
        <span>📋 {label}</span>
        <span className="ml-2 text-xs opacity-70">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 rounded-xl border bg-white shadow-md dark:border-neutral-700 dark:bg-neutral-900">
          {routines.map((r) => (
            <button
              key={r.id}
              type="button"
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-neutral-50 first:rounded-t-xl last:rounded-b-xl dark:hover:bg-neutral-800"
              onClick={() => {
                onPick(r);
                setOpen(false);
              }}
            >
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {r.name}
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {r.exercises.length} exercise
                {r.exercises.length !== 1 ? "s" : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
