// src/components/WeeklyNotes.jsx
// Editable weekly notes persisted with loadLS/saveLS.

import React, { useState, useEffect } from "react";
import { loadLS, saveLS } from "../lib/storage";
import { Button } from "./ui/Button";

export default function WeeklyNotes({ periodKey }) {
  const storageKey = `weekly-note:${periodKey}`;
  const [saved, setSaved] = useState(() => loadLS(storageKey, ""));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved || "");

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
  const onAi = () => {
    alert("AI summary coming soon: will compare this week against last week.");
  };

  // Autosize the textarea height
  useEffect(() => {
    const ta = document.getElementById(`weekly-note-ta-${periodKey}`);
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }, [draft, periodKey]);

  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">This Week’s Notes</h4>
        <div className="flex gap-2">
          {!editing && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onAi}>
            AI
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
