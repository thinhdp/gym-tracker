import React, { useEffect, useMemo, useRef, useState } from "react";

/* ================= Simple, dependency-free UI bits ================= */
function Button({ children, variant = "secondary", size = "md", className = "", ...props }) {
  const base = "inline-flex items-center justify-center rounded-xl text-sm transition active:scale-[0.99] focus:outline-none";
  const sizes = {
    md: "px-3 py-1.5",
    sm: "px-2 py-1 text-xs",
    icon: "p-2",
  };
  const variants = {
    primary: "border border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
    secondary: "border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900",
    ghost: "border-transparent bg-transparent hover:bg-neutral-100 text-neutral-800",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
function Card({ children, className = "" }) {
  return <div className={`bg-white shadow border rounded-2xl ${className}`}>{children}</div>;
}
function CardContent({ children, className = "" }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
function Input(props) {
  return <input className="border rounded-xl px-3 py-1.5 text-sm w-full" {...props} />;
}
function Textarea(props) {
  return <textarea className="border rounded-xl px-3 py-1.5 text-sm w-full" {...props} />;
}
function Badge({ children, className = "" }) {
  return <span className={`px-2 py-0.5 text-xs border rounded-xl ${className}`}>{children}</span>;
}
// Icons (text fallbacks)
const CalendarIcon = () => <span aria-hidden>📅</span>;
const Check = () => <span aria-hidden>✔</span>;
const ChevronDown = ({ open }) => <span aria-hidden>{open ? "▴" : "▾"}</span>;
const ListPlus = () => <span aria-hidden>＋</span>;
const Pencil = () => <span aria-hidden>✎</span>;
const Plus = () => <span aria-hidden>＋</span>;
const Save = () => <span aria-hidden>💾</span>;
const Trash2 = () => <span aria-hidden>🗑</span>;
const X = () => <span aria-hidden>×</span>;

/* ================= Utilities & storage ================= */
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => d;
const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const K_EX = "mgym.exercises.v1";
const K_WO = "mgym.workouts.v1";
function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveLS(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// Weight unit helpers (store internally in kg, convert for UI)
const KG_PER_LB = 0.45359237;
const toDisplayWeight = (kg, unit) =>
  unit === "lb" ? Math.round((Number(kg || 0) / KG_PER_LB) * 100) / 100 : Number(kg || 0);
const fromDisplayWeight = (val, unit) =>
  unit === "lb" ? Number(val || 0) * KG_PER_LB : Number(val || 0);

// Date helpers
const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/* ======= Backup helpers (Export / Import) ======= */
function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function normalizeExercise(ex) {
  const name = String(ex?.name || "").trim();
  const recommendRep = (ex?.recommendRep ?? "").toString();
  if (!name) return null;
  return { name, recommendRep, lastWorkout: null };
}
function normalizeWorkout(w) {
  const date = String(w?.date || "").slice(0, 10);
  const name = (w?.name && String(w.name).trim()) || date || todayStr();
  const id = typeof w?.id === "string" && w.id ? w.id : uuid();
  const exercises = Array.isArray(w?.exercises) ? w.exercises : [];
  const normExercises = exercises
    .map((e) => {
      const exerciseName = String(e?.exerciseName || "").trim();
      if (!exerciseName) return null;
      const setsRaw = Array.isArray(e?.sets) ? e.sets : [];
      const sets = setsRaw.slice(0, 5).map((s, idx) => ({
        set: idx + 1,
        weight: Number(s?.weight) || 0,
        reps: Number(s?.reps) || 0,
      }));
      return { exerciseName, sets: sets.length ? sets : [{ set: 1, weight: 0, reps: 0 }] };
    })
    .filter(Boolean);
  if (!date || !normExercises) return null;
  return { id, date, name, exercises: normExercises };
}
function normalizeData(obj) {
  const exercises = (Array.isArray(obj?.exercises) ? obj.exercises : []).map(normalizeExercise).filter(Boolean);
  const workouts = (Array.isArray(obj?.workouts) ? obj.workouts : []).map(normalizeWorkout).filter(Boolean);
  return { exercises, workouts };
}
function mergeExercises(current, incoming) {
  const map = new Map(current.map((e) => [e.name.toLowerCase(), { ...e }]));
  for (const inc of incoming) {
    const key = inc.name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { ...inc });
    } else {
      const cur = map.get(key);
      if ((!cur.recommendRep || cur.recommendRep.trim() === "") && inc.recommendRep) {
        cur.recommendRep = inc.recommendRep;
      }
      map.set(key, cur);
    }
  }
  return Array.from(map.values());
}
function mergeWorkouts(current, incoming) {
  const ids = new Set(current.map((w) => w.id));
  const merged = [...current];
  for (const w of incoming) {
    if (!ids.has(w.id)) {
      ids.add(w.id);
      merged.push(w);
    } else {
      merged.push({ ...w, id: uuid() });
    }
  }
  return merged.sort((a, b) => (a.date < b.date ? 1 : -1));
}
function ImportExportControls({ exercises, workouts, setExercises, setWorkouts }) {
  const fileRef = useRef(null);
  const modeRef = useRef("merge"); // merge | replace

  const onExport = () => {
    const payload = { schema: "mgym.v1", exportedAt: new Date().toISOString(), exercises, workouts };
    const d = todayStr();
    downloadJSON(`gym-tracker-backup-${d}.json`, payload);
  };
  const onImportClick = (mode) => {
    modeRef.current = mode;
    fileRef.current?.click();
  };
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
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={onExport}>
        <Save /> Export
      </Button>
      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onFileChange} />
      <Button variant="secondary" onClick={() => onImportClick("merge")}>
        Import (merge)
      </Button>
      <Button variant="secondary" onClick={() => onImportClick("replace")}>
        Import (replace)
      </Button>
    </div>
  );
}

/* ================= App ================= */
export default function MobileGymApp() {
  const [tab, setTab] = useState("workouts"); // "workouts" | "calendar" | "exercises"
  const [exercises, setExercises] = useState(() => loadLS(K_EX, []));
  const [workouts, setWorkouts] = useState(() => loadLS(K_WO, []));
  const [unit, setUnit] = useState("kg"); // kg | lb

  useEffect(() => saveLS(K_EX, exercises), [exercises]);
  useEffect(() => saveLS(K_WO, workouts), [workouts]);

  // Derive last workout per exercise from logged workouts
  useEffect(() => {
    const latestByName = {};
    for (const w of workouts) {
      for (const ex of w.exercises || []) {
        if (!latestByName[ex.exerciseName] || latestByName[ex.exerciseName].date < w.date) {
          latestByName[ex.exerciseName] = { date: w.date, sets: ex.sets };
        }
      }
    }
    setExercises((prev) =>
      prev.map((e) => ({
        ...e,
        lastWorkout: latestByName[e.name] ? { date: latestByName[e.name].date, sets: latestByName[e.name].sets } : null,
      })),
    );
  }, [workouts]);

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-md p-4 pb-24">
        <header className="sticky top-0 z-10 bg-neutral-50">
          <div className="flex items-center justify-between py-3">
            <h1 className="text-2xl font-bold tracking-tight">Gym Tracker</h1>
            <div className="flex items-center gap-2">
              <Badge>Local • Offline</Badge>
              <Button variant="secondary" onClick={() => setUnit((u) => (u === "kg" ? "lb" : "kg"))}>
                Unit: {unit.toUpperCase()}
              </Button>
            </div>
          </div>
          <div className="flex gap-2 mb-2">
            <Button variant={tab === "workouts" ? "primary" : "secondary"} onClick={() => setTab("workouts")}>
              Workouts
            </Button>
            <Button variant={tab === "calendar" ? "primary" : "secondary"} onClick={() => setTab("calendar")}>
              Calendar
            </Button>
            <Button variant={tab === "exercises" ? "primary" : "secondary"} onClick={() => setTab("exercises")}>
              Exercises
            </Button>
          </div>

          {/* Import / Export controls */}
          <div className="flex justify-end mb-2">
            <ImportExportControls
              exercises={exercises}
              workouts={workouts}
              setExercises={setExercises}
              setWorkouts={setWorkouts}
            />
          </div>
        </header>

        <main className="mt-2">
          {tab === "workouts" && (
            <>
              <WorkoutPlanner
                exercises={exercises}
                setExercises={setExercises}
                workouts={workouts}
                setWorkouts={setWorkouts}
                unit={unit}
                onCreated={() => setTab("workouts")}
              />
              <WorkoutHistory
                workouts={workouts}
                setWorkouts={setWorkouts}
                exercises={exercises}
                setExercises={setExercises}
                unit={unit}
              />
            </>
          )}

          {tab === "calendar" && (
            <CalendarView
              workouts={workouts}
              setWorkouts={setWorkouts}
              exercises={exercises}
              setExercises={setExercises}
              unit={unit}
            />
          )}

          {tab === "exercises" && (
            <ExerciseManager exercises={exercises} setExercises={setExercises} workouts={workouts} unit={unit} />
          )}
        </main>
      </div>

      <footer className="fixed inset-x-0 bottom-0 border-t bg-white/80">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2 p-3 text-xs text-neutral-500">
          <span>Data stored in your browser</span>
          <span>v1.4</span>
        </div>
      </footer>
    </div>
  );
}

/* ================= Feature 1: Exercise Database ================= */
function ExerciseManager({ exercises, setExercises, workouts, unit }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => exercises.filter((e) => e.name.toLowerCase().includes(query.toLowerCase())),
    [exercises, query],
  );

  const onCreate = (ex) => setExercises((prev) => [...prev, ex]);
  const onDelete = (name) => setExercises((prev) => prev.filter((e) => e.name !== name));
  const onUpdate = (name, patch) =>
    setExercises((prev) => prev.map((e) => (e.name === name ? { ...e, ...patch, name: e.name } : e)));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input placeholder="Search exercises..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <NewExerciseInline existing={exercises} onCreate={onCreate} />
          <div className="grid gap-3 mt-3">
            {filtered.length === 0 && <p className="text-sm text-neutral-500">No exercises yet. Add one to get started.</p>}
            {filtered.map((e) => (
              <ExerciseRow key={e.name} ex={e} onDelete={onDelete} onUpdate={onUpdate} workouts={workouts} unit={unit} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
function NewExerciseInline({ existing, onCreate }) {
  const [name, setName] = useState("");
  const [rep, setRep] = useState("");
  const isUnique = useMemo(
    () => name.trim() && !existing.some((e) => e.name.trim().toLowerCase() === name.trim().toLowerCase()),
    [existing, name],
  );
  const canSave = !!isUnique;
  const handleSave = () => {
    if (!canSave) return;
    onCreate({ name: name.trim(), recommendRep: rep.trim(), lastWorkout: null });
    setName("");
    setRep("");
  };
  return (
    <div className="mt-3 grid gap-2 rounded-xl border p-3">
      <div className="grid sm:grid-cols-2 gap-2">
        <Input placeholder="Name * (unique)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Recommend rep (e.g., 3x8-12)" value={rep} onChange={(e) => setRep(e.target.value)} />
      </div>
      {!isUnique && name && <p className="text-xs text-red-600">An exercise with this name already exists.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => { setName(""); setRep(""); }}>
          Reset
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!canSave}>
          <Save /> Save
        </Button>
      </div>
    </div>
  );
}
function ExerciseRow({ ex, onDelete, onUpdate, workouts, unit }) {
  const [editing, setEditing] = useState(false);
  const [rep, setRep] = useState(ex.recommendRep || "");
  const usedCount = useMemo(
    () => workouts.filter((w) => (w.exercises || []).some((e) => e.exerciseName === ex.name)).length,
    [workouts, ex.name],
  );

  return (
    <div className="rounded-2xl border p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{ex.name}</h3>
            {ex.recommendRep ? <span className="text-xs text-neutral-500">({ex.recommendRep})</span> : null}
            {usedCount > 0 && <Badge>{usedCount} workouts</Badge>}
          </div>
          {!editing ? (
            <p className="text-sm text-neutral-600">
              {ex.recommendRep || <span className="italic text-neutral-400">No recommendation</span>}
            </p>
          ) : (
            <Textarea value={rep} onChange={(e) => setRep(e.target.value)} />
          )}
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil />
            </Button>
          ) : (
            <>
              <Button variant="primary" onClick={() => { onUpdate(ex.name, { recommendRep: rep }); setEditing(false); }}>
                <Check />
              </Button>
              <Button variant="ghost" onClick={() => { setRep(ex.recommendRep || ""); setEditing(false); }}>
                <X />
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={() => onDelete(ex.name)}>
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="mt-2">
        <p className="text-xs font-medium text-neutral-500">Last workout</p>
        {ex.lastWorkout ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <Badge>
              <CalendarIcon /> {fmtDate(ex.lastWorkout.date)}
            </Badge>
            <div className="flex flex-wrap gap-1">
              {ex.lastWorkout.sets.map((s) => (
                <Badge key={s.set}>
                  Set {s.set}: {toDisplayWeight(s.weight, unit)} {unit} x {s.reps}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-400">—</p>
        )}
      </div>
    </div>
  );
}

/* ================= Feature 2: Workout Tracking (Plan / History) ================= */
function WorkoutPlanner({ exercises, setExercises, workouts, setWorkouts, unit, onCreated }) {
  const [date, setDate] = useState(todayStr());
  const [name, setName] = useState("");
  const [items, setItems] = useState([]);

  const addExerciseByName = (rawName) => {
    const n = (rawName || "").trim();
    if (!n) return;
    const exists = exercises.find((e) => e.name.toLowerCase() === n.toLowerCase());

    if (!exists) {
      const created = { name: n, recommendRep: "", lastWorkout: null };
      setExercises((prev) => [...prev, created]);
    }

    if (!items.some((i) => i.exerciseName.toLowerCase() === n.toLowerCase())) {
      let initSets = [{ set: 1, weight: 0, reps: 0 }];
      if (exists?.lastWorkout?.sets?.length) {
        const lastSet = exists.lastWorkout.sets[exists.lastWorkout.sets.length - 1];
        initSets = [{ set: 1, weight: lastSet.weight || 0, reps: lastSet.reps || 0 }];
      }
      setItems((prev) => [...prev, { exerciseName: n, sets: initSets }]);
    }
  };

  const saveWorkout = () => {
    if (items.length === 0) return;
    const w = {
      id: uuid(),
      date,
      name: (name && name.trim()) || date,
      exercises: items.map((i) => ({
        exerciseName: i.exerciseName.trim(),
        sets: i.sets.slice(0, 5).map((s, idx) => ({ set: idx + 1, weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 })),
      })),
    };
    setWorkouts((prev) => [w, ...prev].sort((a, b) => (a.date < b.date ? 1 : -1)));
    setDate(todayStr());
    setName("");
    setItems([]);
    onCreated && onCreated();
  };

  return (
    <Card className="mb-4">
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Plan / Log Workout</h2>
          <Badge>Up to 5 sets / exercise</Badge>
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-neutral-600">Workout date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-neutral-600">Workout name (optional)</label>
              <Input placeholder="If blank, uses date" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          <AddExerciseInput allExercises={exercises} onAdd={addExerciseByName} />

          <div className="space-y-2">
            {items.length === 0 && <p className="text-sm text-neutral-500">No exercises added yet.</p>}
            {items.map((it) => {
              const rec = exercises.find((e) => e.name === it.exerciseName)?.recommendRep || "";
              return (
                <WorkoutExerciseEditor
                  key={it.exerciseName}
                  item={it}
                  unit={unit}
                  recommendRep={rec}
                  onChange={(patch) =>
                    setItems((prev) => prev.map((x) => (x.exerciseName === it.exerciseName ? { ...x, ...patch } : x)))
                  }
                  onRemove={() => setItems((prev) => prev.filter((x) => x.exerciseName !== it.exerciseName))}
                />
              );
            })}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setItems([]); setName(""); setDate(todayStr()); }}>
              Reset
            </Button>
            <Button variant="primary" onClick={saveWorkout} disabled={items.length === 0}>
              <Save /> Save Workout
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
function AddExerciseInput({ allExercises, onAdd }) {
  const [val, setVal] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const options = useMemo(() => {
    const q = val.trim().toLowerCase();
    const list = allExercises
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((e) => e.name);
    const exact = allExercises.some((e) => e.name.toLowerCase() === q);
    if (q && !exact && !list.includes(val)) list.unshift(`${val} (new)`);
    return list;
  }, [val, allExercises]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const choose = (opt) => {
    const isNew = opt.endsWith(" (new)");
    const name = isNew ? opt.replace(" (new)", "") : opt;
    onAdd(name);
    setVal("");
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add exercise by name (auto-suggest)"
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <Button variant="primary" onClick={() => choose(val || "")}>
          <ListPlus /> Add
        </Button>
      </div>
      {open && options.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow">
          {options.map((o) => (
            <button
              key={o}
              onClick={() => choose(o)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50"
            >
              <span>{o}</span>
              <ChevronDown />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* === Mobile-friendly number inputs: auto-clear '0' on focus === */
function NumberInputAutoClear({ valueNumber, onNumberChange, step = "1", min = "0", placeholder = "0", className = "" }) {
  const [clear, setClear] = useState(false);
  const display = clear && (valueNumber === 0 || valueNumber === "0" || valueNumber === "" || valueNumber == null) ? "" : valueNumber;

  return (
    <Input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      placeholder={placeholder}
      className={className}
      value={display}
      onFocus={(e) => {
        if (Number(e.target.value || 0) === 0) {
          setClear(true);
        } else {
          try { e.target.select?.(); } catch {}
        }
      }}
      onBlur={() => setClear(false)}
      onChange={(e) => {
        const raw = e.target.value;
        const num = raw === "" ? 0 : Number(raw);
        if (Number.isFinite(num)) onNumberChange(num);
      }}
    />
  );
}

function WorkoutExerciseEditor({ item, onChange, onRemove, unit, recommendRep }) {
  const [sets, setSets] = useState(item.sets);
  useEffect(() => onChange({ sets }), [sets, onChange]);

  const addSet = () =>
    setSets((prev) => (prev.length >= 5 ? prev : [...prev, { set: prev.length + 1, weight: 0, reps: 0 }]));
  const delSet = (i) =>
    setSets((prev) => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, set: idx + 1 })));

  return (
    <div className="rounded-2xl border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium">
          {item.exerciseName}
          {recommendRep ? <span className="ml-2 text-xs text-neutral-500">({recommendRep})</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={addSet} disabled={sets.length >= 5}>
            <Plus /> Set
          </Button>
          <Button variant="ghost" onClick={onRemove}>
            <Trash2 />
          </Button>
        </div>
      </div>

      {/* Column headers with dynamic unit */}
      <div className="flex items-center gap-3 px-3 py-1 text-xs text-neutral-500">
        <span className="w-16" />
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div>Weight ({unit})</div>
          <div>Reps</div>
        </div>
        <span className="w-10" />
      </div>

      <div className="grid gap-2">
        {sets.map((s, idx) => (
          <div key={idx} className="flex items-center gap-3 rounded-xl border px-3 py-2">
            <span className="w-16 text-sm text-neutral-600">Set {idx + 1}</span>
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <NumberInputAutoClear
                  step="0.5"
                  min="0"
                  className="w-24"
                  valueNumber={toDisplayWeight(s.weight, unit)}
                  onNumberChange={(v) =>
                    setSets((prev) => prev.map((p, i) => (i === idx ? { ...p, weight: fromDisplayWeight(v, unit) } : p)))
                  }
                />
                <span className="text-xs text-neutral-500">{unit}</span>
              </div>
              <div className="flex items-center gap-2">
                <NumberInputAutoClear
                  step="1"
                  min="0"
                  className="w-24"
                  valueNumber={s.reps}
                  onNumberChange={(v) => setSets((prev) => prev.map((p, i) => (i === idx ? { ...p, reps: v } : p)))}
                />
                <span className="text-xs text-neutral-500">reps</span>
              </div>
            </div>
            <Button variant="ghost" onClick={() => delSet(idx)} disabled={sets.length <= 1}>
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkoutHistory({ workouts, setWorkouts, exercises, setExercises, unit }) {
  const [expandedId, setExpandedId] = useState(null);

  const updateWorkout = (id, patch) => {
    setWorkouts((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)).sort((a, b) => (a.date < b.date ? 1 : -1)));
  };
  const deleteWorkout = (id) => setWorkouts((prev) => prev.filter((w) => w.id !== id));

  const addExerciseToWorkout = (workout, exerciseName) => {
    const exists = exercises.find((e) => e.name.toLowerCase() === exerciseName.toLowerCase());
    if (!exists) {
      const created = { name: exerciseName, recommendRep: "", lastWorkout: null };
      setExercises((prev) => [...prev, created]);
    }
    const last = exists?.lastWorkout?.sets?.length ? exists.lastWorkout.sets[exists.lastWorkout.sets.length - 1] : null;
    const newExercise = {
      exerciseName,
      sets: [{ set: 1, weight: last?.weight || 0, reps: last?.reps || 0 }],
    };
    updateWorkout(workout.id, { exercises: [...workout.exercises, newExercise] });
  };

  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">History</h3>
      {workouts.length === 0 && <p className="text-sm text-neutral-500">No workouts logged yet.</p>}
      {workouts.map((w) => (
        <div key={w.id} className="rounded-2xl border">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-base font-medium">{w.name}</div>
              <div className="text-xs text-neutral-600">{fmtDate(w.date)}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setExpandedId((prev) => (prev === w.id ? null : w.id))}>
                Details <ChevronDown open={expandedId === w.id} />
              </Button>
              <Button variant="ghost" onClick={() => deleteWorkout(w.id)}>
                <Trash2 />
              </Button>
            </div>
          </div>

          {expandedId === w.id && (
            <div className="space-y-3 p-4 border-t">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-600">Date</label>
                  <Input type="date" value={w.date} onChange={(e) => updateWorkout(w.id, { date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-600">Workout name</label>
                  <Input value={w.name} onChange={(e) => updateWorkout(w.id, { name: e.target.value || w.date })} />
                </div>
              </div>

              {/* Add exercise into this workout */}
              <div className="rounded-xl border p-3">
                <div className="mb-2 font-medium text-sm">Add exercise to this workout</div>
                <AddExerciseInput allExercises={exercises} onAdd={(name) => addExerciseToWorkout(w, name)} />
              </div>

              <div className="space-y-2">
                {w.exercises.map((we, idx) => (
                  <div key={idx} className="rounded-xl border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="font-medium">
                        {we.exerciseName}
                        {(() => {
                          const rec = exercises.find((e) => e.name === we.exerciseName)?.recommendRep || "";
                          return rec ? <span className="ml-2 text-xs text-neutral-500">({rec})</span> : null;
                        })()}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            const newName = (prompt("Rename exercise to:", we.exerciseName) || "").trim();
                            if (!newName) return;
                            updateWorkout(w.id, {
                              exercises: w.exercises.map((e2, i2) => (i2 === idx ? { ...e2, exerciseName: newName } : e2)),
                            });
                          }}
                        >
                          Rename
                        </Button>
                        <Button variant="ghost" onClick={() => updateWorkout(w.id, { exercises: w.exercises.filter((_, i2) => i2 !== idx) })}>
                          <Trash2 />
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      {/* Column headers with dynamic unit */}
                      <div className="flex items-center gap-3 px-3 py-1 text-xs text-neutral-500">
                        <span className="w-16" />
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div>Weight ({unit})</div>
                          <div>Reps</div>
                        </div>
                        <span className="w-10" />
                      </div>

                      {we.sets.map((s, sidx) => (
                        <div key={sidx} className="flex items-center gap-3 rounded-xl border px-3 py-2">
                          <span className="w-16 text-sm text-neutral-600">Set {sidx + 1}</span>
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2">
                              <NumberInputAutoClear
                                step="0.5"
                                min="0"
                                className="w-24"
                                valueNumber={toDisplayWeight(s.weight, unit)}
                                onNumberChange={(v) =>
                                  updateWorkout(w.id, {
                                    exercises: w.exercises.map((e2, i2) =>
                                      i2 === idx
                                        ? {
                                            ...e2,
                                            sets: e2.sets.map((ss, j) =>
                                              j === sidx ? { ...ss, weight: fromDisplayWeight(v, unit) } : ss,
                                            ),
                                          }
                                        : e2,
                                    ),
                                  })
                                }
                              />
                              <span className="text-xs text-neutral-500">{unit}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <NumberInputAutoClear
                                step="1"
                                min="0"
                                className="w-24"
                                valueNumber={s.reps}
                                onNumberChange={(v) =>
                                  updateWorkout(w.id, {
                                    exercises: w.exercises.map((e2, i2) =>
                                      i2 === idx
                                        ? {
                                            ...e2,
                                            sets: e2.sets.map((ss, j) => (j === sidx ? { ...ss, reps: v } : ss)),
                                          }
                                        : e2,
                                    ),
                                  })
                                }
                              />
                              <span className="text-xs text-neutral-500">reps</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            disabled={we.sets.length <= 1}
                            onClick={() =>
                              updateWorkout(w.id, {
                                exercises: w.exercises.map((e2, i2) =>
                                  i2 === idx
                                    ? {
                                        ...e2,
                                        sets: e2.sets.filter((_, j) => j !== sidx).map((ss, j) => ({ ...ss, set: j + 1 })),
                                      }
                                    : e2,
                                ),
                              })
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ))}
                      {we.sets.length < 5 && (
                        <Button
                          variant="secondary"
                          className="w-fit"
                          onClick={() =>
                            updateWorkout(w.id, {
                              exercises: w.exercises.map((e2, i2) =>
                                i2 === idx
                                  ? { ...e2, sets: [...e2.sets, { set: e2.sets.length + 1, weight: 0, reps: 0 }] }
                                  : e2,
                              ),
                            })
                          }
                        >
                          <Plus /> Add set
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button variant="primary" onClick={() => updateWorkout(w.id, { ...w })}>
                  <Save /> Update
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ================= Feature 3: Calendar View ================= */
function CalendarView({ workouts, setWorkouts, exercises, setExercises, unit }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(todayStr());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startWeekday = first.getDay();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const byDate = useMemo(() => {
    const map = {};
    for (const w of workouts) {
      if (!map[w.date]) map[w.date] = [];
      map[w.date].push(w);
    }
    return map;
  }, [workouts]);

  const days = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= lastDay; d++) days.push(ymd(year, month, d));

  const selectedWorkouts = byDate[selected] || [];

  const createWorkoutForSelected = () => {
    const w = { id: uuid(), date: selected, name: selected, exercises: [] };
    setWorkouts((prev) => [w, ...prev].sort((a, b) => (a.date < b.date ? 1 : -1)));
  };

  const addExerciseToWorkout = (workout, exerciseName) => {
    const exists = exercises.find((e) => e.name.toLowerCase() === exerciseName.toLowerCase());
    if (!exists) {
      const created = { name: exerciseName, recommendRep: "", lastWorkout: null };
      setExercises((prev) => [...prev, created]);
    }
    const last = exists?.lastWorkout?.sets?.length ? exists.lastWorkout.sets[exists.lastWorkout.sets.length - 1] : null;
    const newExercise = { exerciseName, sets: [{ set: 1, weight: last?.weight || 0, reps: last?.reps || 0 }] };
    setWorkouts((prev) => prev.map((w) => (w.id === workout.id ? { ...w, exercises: [...w.exercises, newExercise] } : w)));
  };

  const deleteWorkout = (id) => setWorkouts((prev) => prev.filter((w) => w.id !== id));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <Button variant="secondary" onClick={prevMonth}>
              ‹ Prev
            </Button>
            <div className="font-semibold">{viewDate.toLocaleString(undefined, { month: "long", year: "numeric" })}</div>
            <Button variant="secondary" onClick={nextMonth}>
              Next ›
            </Button>
          </div>

          <div className="grid grid-cols-7 text-xs text-neutral-600 mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1 text-center">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((ds, idx) => {
              const isSelected = ds === selected;
              const count = ds ? byDate[ds]?.length || 0 : 0;
              return (
                <button
                  key={idx}
                  className={`aspect-square rounded-xl border text-sm flex flex-col items-center justify-center ${
                    isSelected ? "bg-blue-600 text-white" : "bg-white"
                  }`}
                  onClick={() => ds && setSelected(ds)}
                  disabled={!ds}
                >
                  <span className="text-base">{ds ? Number(ds.slice(-2)) : ""}</span>
                  {count > 0 && (
                    <span className={`mt-1 text-[10px] ${isSelected ? "text-white" : "text-neutral-600"}`}>
                      {count} workout{count > 1 ? "s" : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Plans for {selected}</div>
            <Button variant="primary" onClick={createWorkoutForSelected}>
              <Plus /> New workout
            </Button>
          </div>

          {selectedWorkouts.length === 0 && <p className="text-sm text-neutral-500">No workouts on this day.</p>}

          <div className="space-y-3">
            {selectedWorkouts.map((w) => (
              <div key={w.id} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-medium">{w.name}</div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => deleteWorkout(w.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>

                {/* Add exercise into this workout */}
                <div className="rounded-xl border p-3 mb-2">
                  <div className="mb-2 font-medium text-sm">Add exercise</div>
                  <AddExerciseInput allExercises={exercises} onAdd={(name) => addExerciseToWorkout(w, name)} />
                </div>

                {w.exercises.length === 0 ? (
                  <p className="text-sm text-neutral-500">No exercises yet.</p>
                ) : (
                  <div className="grid gap-2">
                    {w.exercises.map((we, i) => (
                      <div key={i} className="rounded-lg border px-3 py-2 text-sm">
                        <div className="font-medium">
                          {we.exerciseName}
                          {(() => {
                            const rec = exercises.find((e) => e.name === we.exerciseName)?.recommendRep || "";
                            return rec ? <span className="ml-2 text-xs text-neutral-500">({rec})</span> : null;
                          })()}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {we.sets.map((s) => (
                            <Badge key={s.set}>
                              Set {s.set}: {toDisplayWeight(s.weight, unit)} {unit} x {s.reps}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
