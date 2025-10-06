import React, { useState, useRef } from "react";
import { Button } from "./ui/Button";
import { Save } from "./ui/Icons";
import {
  todayStr,
  loadLS,
  saveLS,
  K_UNIT,
  K_TAB,
} from "../lib/storage";
import {
  downloadJSON,
  normalizeData,
  mergeExercises,
  mergeWorkouts,
} from "../lib/backup";

/**
 * Consolidated data management menu that combines export and import
 * functionality under a single button. Clicking the button will
 * reveal a dropdown with options to export the current data
 * or import data in either merge or replace mode.
 */
export default function DataManagementMenu({
  exercises,
  workouts,
  setExercises,
  setWorkouts,
}) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef(null);
  const modeRef = useRef("merge");

  // Export current exercises, workouts and other persisted data to a JSON file
  const onExport = () => {
    // gather additional persisted data
    const weightLogs = loadLS("weightLogs", {});
    const note = loadLS("mgym.note.v1", "");
    const unitPref = loadLS(K_UNIT, null);
    const tabPref = loadLS(K_TAB, null);

    // collect all weekly notes (keys start with "weekly-note:")
    const weeklyNotes = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("weekly-note:")) {
        weeklyNotes[key] = loadLS(key, "");
      }
    }

    const payload = {
      schema: "mgym.v1",
      exportedAt: new Date().toISOString(),
      exercises,
      workouts,
      unit: unitPref,
      tab: tabPref,
      note,
      weightLogs,
      weeklyNotes,
    };
    downloadJSON(`gym-tracker-backup-${todayStr()}.json`, payload);
    setOpen(false);
  };

  // When an import option is chosen, store the mode and trigger file input
  const onImportClick = (mode) => {
    modeRef.current = mode;
    if (fileRef.current) fileRef.current.click();
    setOpen(false);
  };

  // Handle file selection and import the contents
  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result);
        // sanitize exercises and workouts using normalizeData
        const { exercises: inEx, workouts: inWo } = normalizeData(raw);
        if (modeRef.current === "replace") {
          setExercises(inEx);
          setWorkouts(inWo);
        } else {
          setExercises((prev) => mergeExercises(prev, inEx));
          setWorkouts((prev) => mergeWorkouts(prev, inWo));
        }
        // restore additional fields if present
        if (raw.unit != null) saveLS(K_UNIT, raw.unit);
        if (raw.tab != null) saveLS(K_TAB, raw.tab);
        if ("note" in raw) saveLS("mgym.note.v1", raw.note || "");
        if (raw.weightLogs && typeof raw.weightLogs === "object") {
          localStorage.setItem(
            "weightLogs",
            JSON.stringify(raw.weightLogs)
          );
        }
        if (raw.weeklyNotes && typeof raw.weeklyNotes === "object") {
          Object.entries(raw.weeklyNotes).forEach(([k, v]) => {
            localStorage.setItem(k, JSON.stringify(v));
          });
        }
        alert("Import complete.");
      } catch (err) {
        console.error(err);
        alert("Import failed: invalid JSON or structure.");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen((prev) => !prev)}>
        <Save className="mr-1" /> Data
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={onFileChange}
      />
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow z-10">
          <Button
            variant="ghost"
            className="w-full justify-start px-4 py-2"
            onClick={onExport}
          >
            Export
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start px-4 py-2"
            onClick={() => onImportClick("merge")}
          >
            Import (merge)
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start px-4 py-2"
            onClick={() => onImportClick("replace")}
          >
            Import (replace)
          </Button>
        </div>
      )}
    </div>
  );
}
