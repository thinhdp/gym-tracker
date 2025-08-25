import React, { useState, useRef } from "react";
import { Button } from "./ui/Button";
import { Save } from "./ui/Icons";
import { todayStr } from "../lib/storage";
import { downloadJSON, normalizeData, mergeExercises, mergeWorkouts } from "../lib/backup";

/**
 * Consolidated data management menu that combines export and import
 * functionality under a single button. Clicking the button will
 * reveal a dropdown with options to export the current data
 * or import data in either merge or replace mode. This helps
 * keep the application's header from wrapping onto multiple lines
 * on smaller screens.
 */
export default function DataManagementMenu({ exercises, workouts, setExercises, setWorkouts }) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef(null);
  const modeRef = useRef("merge");

  // Export current exercises and workouts to a JSON file
  const onExport = () => {
    const payload = {
      schema: "mgym.v1",
      exportedAt: new Date().toISOString(),
      exercises,
      workouts,
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
        const { exercises: inEx, workouts: inWo } = normalizeData(raw);
        if (modeRef.current === "replace") {
          setExercises(inEx);
          setWorkouts(inWo);
        } else {
          setExercises((prev) => mergeExercises(prev, inEx));
          setWorkouts((prev) => mergeWorkouts(prev, inWo));
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
