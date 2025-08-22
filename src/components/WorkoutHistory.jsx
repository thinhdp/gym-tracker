import React, { useState } from "react";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { Plus, Trash2, ChevronDown } from "./ui/Icons";
import AddExerciseInput from "./AddExerciseInput";
import NumberInputAutoClear from "./NumberInputAutoClear";
import { fromDisplayWeight, toDisplayWeight } from "../lib/units";
import { useConfirm } from "./ConfirmDialog";

export default function WorkoutHistory({ workouts, setWorkouts, exercises, setExercises, unit }) {
  const [expandedId, setExpandedId] = useState(null);
  const confirm = useConfirm();

  const updateWorkout = (id, patch) => {
    setWorkouts((prev)=> prev.map((w)=> w.id===id ? { ...w, ...patch } : w).sort((a,b)=> (a.date<b.date?1:-1)));
  };
  const deleteWorkout = (id) => setWorkouts((prev)=> prev.filter((w)=> w.id!==id));

  const addExerciseToWorkout = (workout, exerciseName) => {
    const exists = exercises.find((e)=> e.name.toLowerCase()===exerciseName.toLowerCase());
    if (!exists) {
      const created = { name:exerciseName, recommendRep:"", lastWorkout:null, mainMuscle:"", secondaryMuscles:"", type:"", equipment:"", force:"" };
      setExercises((prev)=>[...prev, created]);
    }
    const last = exists?.lastWorkout?.sets?.length ? exists.lastWorkout.sets.at(-1) : null;
    const newExercise = { exerciseName, sets: [{ set:1, weight:last?.weight||0, reps:last?.reps||0 }] };
    updateWorkout(workout.id, { exercises: [...workout.exercises, newExercise] });
  };

      // Helpers to move an item in an array.
      const moveItem = (arr, from, to) => {
        if (to < 0 || to >= arr.length) return arr;
        const next = arr.slice();
        const [it] = next.splice(from, 1);
        next.splice(to, 0, it);
        return next;
      };
      // Move an exercise up or down within its workout
      const moveExerciseUp = (workoutId, idx) => {
        setWorkouts((prev) =>
          prev
            .map((w) =>
              w.id === workoutId
                ? { ...w, exercises: moveItem(w.exercises, idx, idx - 1) }
                : w
            )
            .sort((a, b) => (a.date < b.date ? 1 : -1))
        );
      };
      const moveExerciseDown = (workoutId, idx) => {
        setWorkouts((prev) =>
          prev
            .map((w) =>
              w.id === workoutId
                ? { ...w, exercises: moveItem(w.exercises, idx, idx + 1) }
                : w
            )
            .sort((a, b) => (a.date < b.date ? 1 : -1))
        );
      };
  
  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">History</h3>
      {workouts.length===0 && <p className="text-sm text-neutral-500">No workouts logged yet.</p>}
      {workouts.map((w)=>(
        <div key={w.id} className="rounded-2xl border">
          <div className="flex items-center justify-between px-4 py-3">
            <div><div className="text-base font-medium">{w.name}</div><div className="text-xs text-neutral-600">{w.date}</div></div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={()=> setExpandedId((prev)=> prev===w.id? null : w.id)}>Details <ChevronDown open={expandedId===w.id} /></Button>
              <Button
                variant="ghost"
                onClick={() => {
                  confirm({ title: "Delete this workout?", message: "This can't be undone.", confirmText: "Delete", tone: "destructive" })
                    .then((ok) => { if (ok) deleteWorkout(w.id); });
                }}
              >
                <Trash2 />
              </Button>
            </div>
          </div>

          {expandedId===w.id && (
            <div className="space-y-3 p-4 border-t">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><label className="text-xs text-neutral-600">Date</label>
                  <Input type="date" value={w.date} onChange={(e)=> updateWorkout(w.id, { date:e.target.value })} /></div>
                <div className="space-y-1"><label className="text-xs text-neutral-600">Workout name</label>
                  <Input value={w.name} onChange={(e)=> updateWorkout(w.id, { name: e.target.value || w.date })} /></div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="mb-2 font-medium text-sm">Add exercise to this workout</div>
                <AddExerciseInput allExercises={exercises} onAdd={(name)=> addExerciseToWorkout(w, name)} />
              </div>

              <div className="space-y-2">
                {w.exercises.map((we, idx)=>(
                  <div key={idx} className="rounded-xl border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="font-medium">
                        {we.exerciseName}
                        {(()=>{ const rec = exercises.find((e)=> e.name===we.exerciseName)?.recommendRep || ""; return rec? <span className="ml-2 text-xs text-neutral-500">({rec})</span> : null; })()}
                      </div>
                           <div className="flex items-center gap-2">
                             {/* Reorder controls */}
                             <Button variant="ghost" size="sm" onClick={() => moveExerciseUp(w.id, idx)} disabled={idx === 0}>▲</Button>
                             <Button variant="ghost" size="sm" onClick={() => moveExerciseDown(w.id, idx)} disabled={idx === w.exercises.length - 1}>▼</Button>
                             {/* Rename and delete */}
                             <Button variant="secondary" onClick={()=>{
                               const newName=(prompt("Rename exercise to:", we.exerciseName)||"").trim();
                               if(!newName) return;
                               updateWorkout(w.id, { exercises: w.exercises.map((e2,i2)=> i2===idx ? { ...e2, exerciseName:newName } : e2) });
                             }}>Rename</Button>
                             <Button
                               variant="ghost"
                               onClick={() => {
                                 confirm({ title: `Remove "${we.exerciseName}"?`, message: "This removes the exercise from this workout.", confirmText: "Remove", tone: "destructive" })
                                   .then((ok) => { if (ok) updateWorkout(w.id, { exercises: w.exercises.filter((_,i2)=> i2!==idx) }); });
                               }}
                             >
                               <Trash2 />
                             </Button>
                           </div>
                         </div>

                    <div className="grid gap-2">
                      <div className="flex items-center gap-3 px-3 py-1 text-xs text-neutral-500">
                        <span className="w-16" /><div className="flex-1 grid grid-cols-2 gap-3"><div>Weight ({unit})</div><div>Reps</div></div><span className="w-10" />
                      </div>

                      {we.sets.map((s, sidx)=>(
                        <div key={sidx} className="flex items-center gap-3 rounded-xl border px-3 py-2">
                          <span className="w-16 text-sm text-neutral-600">Set {sidx+1}</span>
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2">
                                   <NumberInputAutoClear step="0.5" min="0"
                                     /* Compact width: replicate Input styling but limit to ~5 characters */
                                     className="border rounded-xl px-3 py-1.5 text-sm w-20"
                                valueNumber={toDisplayWeight(s.weight, unit)}
                                onNumberChange={(v)=> updateWorkout(w.id, {
                                  exercises: w.exercises.map((e2,i2)=> i2===idx ? { ...e2, sets: e2.sets.map((ss,j)=> j===sidx ? { ...ss, weight: fromDisplayWeight(v, unit) } : ss) } : e2)
                                })}/>
                              <span className="text-xs text-neutral-500">{unit}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                   <NumberInputAutoClear step="1" min="0"
                                     /* Compact width: replicate Input styling but limit to ~5 characters */
                                     className="border rounded-xl px-3 py-1.5 text-sm w-20"
                                     valueNumber={s.reps}
                                     onNumberChange={(v)=> updateWorkout(w.id, {
                                       exercises: w.exercises.map((e2,i2)=> i2===idx ? { ...e2, sets: e2.sets.map((ss,j)=> j===sidx ? { ...ss, reps: v } : ss) } : e2)
                                     })}/>
                              <span className="text-xs text-neutral-500">reps</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            disabled={we.sets.length<=1}
                            onClick={() => {
                              if (we.sets.length <= 1) return;
                              confirm({ title: "Delete this set?", message: "This can't be undone.", confirmText: "Delete", tone: "destructive" })
                                .then((ok) => {
                                  if (!ok) return;
                                  updateWorkout(w.id, {
                                    exercises: w.exercises.map((e2,i2)=> i2===idx
                                      ? { ...e2, sets: e2.sets.filter((_,j)=> j!==sidx).map((ss,j)=> ({ ...ss, set:j+1 })) }
                                      : e2)
                                  });
                                });
                            }}
                          ><Trash2 /></Button>
                        </div>
                      ))}

                      {we.sets.length<5 && (
                        <Button variant="secondary" className="w-fit"
                          onClick={()=> updateWorkout(w.id, { exercises: w.exercises.map((e2,i2)=> i2===idx ? { ...e2, sets:[...e2.sets, { set:e2.sets.length+1, weight:0, reps:0 }] } : e2) })}>
                          <Plus /> Add set
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
