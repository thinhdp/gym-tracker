import React, { useState, useEffect, useRef } from "react";
// We no longer import the Textarea component from the UI library. A native
// <textarea> is used instead so that we can directly control its height.
import { loadLS, saveLS } from "../lib/storage";
import { useApp } from "../context/AppContext";
import { buildWeeks } from "../lib/metrics";
import { prevWeekKeyFrom } from "../lib/dateUtils";
import { Button } from "./ui/Button";

// Storage key for the notepad contents
const K_NOTE = "mgym.note.v1";

// Helper to format a Date as YYYY-MM-DD
function formatYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Extract weight logs within a date range (inclusive)
function sliceWeightLogs(weightLogs, from, to) {
  const result = {};
  const start = new Date(from);
  const end = new Date(to);
  // Ensure time component doesn't affect comparison
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  while (start <= end) {
    const key = formatYmd(start);
    if (Object.prototype.hasOwnProperty.call(weightLogs, key)) {
      result[key] = weightLogs[key];
    }
    start.setDate(start.getDate() + 1);
  }
  return result;
}

/**
 * Standalone weekly notes component that stores its content in localStorage.
 * This version auto-expands as you type until it reaches a
 * maximum of roughly 80% of the viewport height. Once the
 * content grows beyond that, the textarea becomes scrollable.
 *
 * Added functionality: a button to export current vs previous week
 * weight and workout logs as JSON. When clicked, the export will
 * generate an object containing both weeks' data and trigger a
 * file download.
 */
export default function WeeklyNotes({ periodKey }) {
  const storageKey = `weekly-note:${periodKey}`;
  const [saved, setSaved] = useState(() => loadLS(storageKey, ""));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved || "");
  const textareaRef = useRef(null);

  // Access workouts from the global context
  const { workouts } = useApp();

  useEffect(() => {
    setSaved(loadLS(storageKey, ""));
  }, [storageKey]);

  const onSave = () => {
    saveLS(storageKey, draft || "");
    setSaved(draft || "");
    setEditing(false);
  };
  const onCancel = () => {
    setDraft(saved || "");
    setEditing(false);
  };

  // Handler to export current and previous week's logs
  const onExportLogs = async () => {
    try {
      // Build weekly buckets from workouts
      const weeks = buildWeeks(workouts || []);
      // Find the current week by periodKey
      const current = weeks.find((w) => w.key === periodKey);
      if (!current) {
        alert("Unable to locate current week's workouts.");
        return;
      }
      // Determine previous week via helper and lookup in weeks array
      const prevKey = prevWeekKeyFrom(current.from);
      const previous = weeks.find((w) => w.key === prevKey) || null;
      // Load weight logs from localStorage
      const weightLogs = loadLS("weightLogs", {});
      // Extract weight logs for both periods
      const thisWeekWeights = sliceWeightLogs(
        weightLogs,
        current.from,
        current.to
      );
      const lastWeekWeights = previous
        ? sliceWeightLogs(weightLogs, previous.from, previous.to)
        : {};
      // Compose export payload
      const exportData = {
        currentWeek: {
          weekKey: current.key,
          from: formatYmd(current.from),
          to: formatYmd(current.to),
          weightLogs: thisWeekWeights,
          workouts: current.items,
        },
        previousWeek: previous
          ? {
              weekKey: previous.key,
              from: formatYmd(previous.from),
              to: formatYmd(previous.to),
              weightLogs: lastWeekWeights,
              workouts: previous.items,
            }
          : null,
      };
      // Copy JSON to clipboard instead of downloading a file
      const jsonString = JSON.stringify(exportData, null, 2);
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonString);
        alert("Logs copied to clipboard. You can paste them elsewhere.");
      } else {
        // Fallback: place the JSON string in a temporary textarea for user to copy
        const temp = document.createElement("textarea");
        temp.value = jsonString;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
        alert("Logs copied to clipboard. You can paste them elsewhere.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to copy logs.");
    }
  };

  // Autosize the textarea height
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    // Ensure a baseline height
    ta.style.minHeight = "8rem";
    // Reset height to compute scrollHeight accurately
    ta.style.height = "auto";
    const maxHeight = window.innerHeight * 0.8;
    // Limit height to content or maxHeight
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  }, [draft]);

  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">This Week’s Notes</h4>
        <div className="flex gap-2">
          {!editing && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onExportLogs}>
            Logs Export
          </Button>
        </div>
      </div>

      {!editing ? (
        <div className="text-sm whitespace-pre-wrap text-neutral-800">
          {saved ? saved : <span className="text-neutral-500">No notes yet.</span>}
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            id={`weekly-note-ta-${periodKey}`}
            className="w-full min-h-[96px] resize-none rounded-lg border border-neutral-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="How did you feel this week? Sleep, stress, pumps, soreness…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={onSave}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
