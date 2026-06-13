import React, { useState } from "react";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Input";
import { Plus, Pencil } from "./ui/Icons";
import { RPE_OPTIONS, MAX_FEEDBACK_LEN, hasRpeFeedback } from "../lib/rpe";

/**
 * Optional RPE (rate of perceived exertion) + free-text feedback for a single
 * exercise within a workout. RPE is a number 6–10 in 0.5 steps (blank = unset);
 * feedback is free text. Both are optional.
 *
 * Two modes:
 * - mode="edit" (default): collapsed "+ RPE / note" trigger that expands to an
 *   RPE dropdown and a notes textarea. When collapsed with data present, shows a
 *   clickable summary chip so logged values stay visible without expanding.
 * - mode="read": static RPE badge + feedback text for history / modal views.
 *
 * Props:
 * - rpe (number|null)   Current RPE, or null when unset.
 * - feedback (string)   Current feedback text ("" when unset).
 * - onChange (fn)       Edit mode only. Receives a patch: { rpe } or { feedback }.
 * - mode ("edit"|"read")  Defaults to "edit".
 *
 * Local state: `open` — whether the editor is expanded (edit mode only).
 */
export default function RpeFeedback({
  rpe = null,
  feedback = "",
  onChange = () => {},
  mode = "edit",
}) {
  const [open, setOpen] = useState(false);
  const filled = hasRpeFeedback(rpe, feedback);

  const rpeBadge =
    rpe != null ? (
      <span className="shrink-0 rounded-xl border border-cyan-300 bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-800">
        RPE {rpe}
      </span>
    ) : null;

  if (mode === "read") {
    if (!filled) return null;
    return (
      <div className="flex items-start gap-2">
        {rpeBadge}
        {feedback.trim() !== "" && (
          <span className="whitespace-pre-wrap text-sm text-neutral-600">
            {feedback}
          </span>
        )}
      </div>
    );
  }

  // Edit mode, collapsed.
  if (!open) {
    if (!filled) {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900"
        >
          <Plus /> RPE / note
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex max-w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left hover:bg-neutral-50"
      >
        {rpeBadge}
        {feedback.trim() !== "" && (
          <span className="truncate text-sm text-neutral-600">{feedback}</span>
        )}
        <span className="ml-auto shrink-0 text-neutral-400">
          <Pencil />
        </span>
      </button>
    );
  }

  // Edit mode, expanded.
  return (
    <div className="space-y-2 border-t border-dashed pt-2">
      <div className="flex items-center gap-2">
        <label className="w-9 text-xs text-neutral-600" htmlFor="rpe-select">
          RPE
        </label>
        <select
          id="rpe-select"
          className="rounded-xl border px-2 py-1.5 text-sm"
          value={rpe == null ? "" : String(rpe)}
          onChange={(e) =>
            onChange({
              rpe: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        >
          <option value="">—</option>
          {RPE_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-400">optional</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setOpen(false)}
        >
          Done
        </Button>
      </div>
      <Textarea
        rows={2}
        maxLength={MAX_FEEDBACK_LEN}
        placeholder="Feedback / notes (optional)"
        value={feedback}
        onChange={(e) => onChange({ feedback: e.target.value })}
      />
    </div>
  );
}
