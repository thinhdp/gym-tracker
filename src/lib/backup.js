import { todayStr, uuid } from "./storage";

export function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export function normalizeExercise(ex) {
  const name = String(ex?.name || "").trim(); const recommendRep = (ex?.recommendRep ?? "").toString();
  if (!name) return null;
  return {
    name, recommendRep,
    mainMuscle: String(ex?.mainMuscle || "").trim(),
    secondaryMuscles: String(ex?.secondaryMuscles || "").trim(),
    type: String(ex?.type || "").trim(),
    equipment: String(ex?.equipment || "").trim(),
    force: String(ex?.force || "").trim(),
    lastWorkout: null
  };
}

export function normalizeWorkout(w) {
  const date = String(w?.date || "").slice(0, 10);
  const name = (w?.name && String(w.name).trim()) || date || todayStr();
  const id = typeof w?.id === "string" && w.id ? w.id : uuid();
  const exercises = Array.isArray(w?.exercises) ? w.exercises : [];
  const normExercises = exercises
    .map((e) => {
      const exerciseName = String(e?.exerciseName || "").trim(); if (!exerciseName) return null;
      const setsRaw = Array.isArray(e?.sets) ? e.sets : [];
      const sets = setsRaw.slice(0, 5).map((s, idx) => ({
        set: idx + 1, weight: Number(s?.weight) || 0, reps: Number(s?.reps) || 0
      }));
      return { exerciseName, sets: sets.length ? sets : [{ set: 1, weight: 0, reps: 0 }] };
    })
    .filter(Boolean);
  if (!date || !normExercises) return null;
  return { id, date, name, exercises: normExercises };
}

export function normalizeData(obj) {
  const exercises = (Array.isArray(obj?.exercises) ? obj.exercises : []).map(normalizeExercise).filter(Boolean);
  const workouts = (Array.isArray(obj?.workouts) ? obj.workouts : []).map(normalizeWorkout).filter(Boolean);
  return { exercises, workouts };
}

export function mergeExercises(current, incoming) {
  const map = new Map(current.map((e) => [e.name.toLowerCase(), { ...e }]));
  for (const inc of incoming) {
    const key = inc.name.toLowerCase();
    if (!map.has(key)) map.set(key, { ...inc });
    else {
      const cur = map.get(key);
      for (const k of ["recommendRep","mainMuscle","secondaryMuscles","type","equipment","force"]) {
        if ((!cur[k] || String(cur[k]).trim() === "") && inc[k]) cur[k] = inc[k];
      }
      map.set(key, cur);
    }
  }
  return Array.from(map.values());
}

export function mergeWorkouts(current, incoming) {
  const ids = new Set(current.map((w) => w.id));
  const merged = [...current];
  for (const w of incoming) {
    if (!ids.has(w.id)) { ids.add(w.id); merged.push(w); }
    else { merged.push({ ...w, id: uuid() }); }
  }
  return merged.sort((a, b) => (a.date < b.date ? 1 : -1));
}
