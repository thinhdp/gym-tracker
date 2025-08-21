import React, { useRef } from "react";
import { Button } from "./ui/Button";
import { Save } from "./ui/Icons";
import { todayStr } from "../lib/storage";
import { downloadJSON, normalizeData, mergeExercises, mergeWorkouts } from "../lib/backup";

export default function ImportExportControls({ exercises, workouts, setExercises, setWorkouts }) {
  const fileRef = useRef(null); const modeRef = useRef("merge");
  const onExport = () => {
    const payload = { schema:"mgym.v1", exportedAt:new Date().toISOString(), exercises, workouts };
    downloadJSON(`gym-tracker-backup-${todayStr()}.json`, payload);
  };
  const onImportClick = (mode) => { modeRef.current=mode; fileRef.current?.click(); };
  const onFileChange = (e) => {
    const file = e.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result); const { exercises: inEx, workouts: inWo } = normalizeData(raw);
        if (modeRef.current==="replace") { setExercises(inEx); setWorkouts(inWo); }
        else { setExercises(prev=> mergeExercises(prev, inEx)); setWorkouts(prev=> mergeWorkouts(prev, inWo)); }
        alert("Import complete.");
      } catch (err) { console.error(err); alert("Import failed: invalid JSON or structure."); }
      finally { e.target.value=""; }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={onExport}><Save /> Export</Button>
      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onFileChange} />
      <Button variant="secondary" onClick={()=>onImportClick("merge")}>Import (merge)</Button>
      <Button variant="secondary" onClick={()=>onImportClick("replace")}>Import (replace)</Button>
    </div>
  );
}
