import React, { useMemo, useState } from "react";
import { Card, CardContent } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import AddExerciseInput from "./AddExerciseInput";
import { uuid } from "../lib/storage";
import { ymd } from "../lib/date";
import { toDisplayWeight } from "../lib/units";
import { Plus, Trash2 } from "./ui/Icons";
import { useConfirm } from "./ConfirmDialog";

export default function CalendarView({ workouts, setWorkouts, exercises, setExercises, unit }) {
  const [viewDate, setViewDate] = useState(()=> new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(()=> new Date().toISOString().slice(0, 10));
  const confirm = useConfirm();

  const year=viewDate.getFullYear(); const month=viewDate.getMonth();
  const first=new Date(year,month,1); const lastDay=new Date(year,month+1,0).getDate(); const startWeekday=first.getDay();
  const prevMonth = ()=> setViewDate(new Date(year, month-1, 1));
  const nextMonth = ()=> setViewDate(new Date(year, month+1, 1));

  const byDate = useMemo(()=> {
    const map={}; for (const w of workouts){ if(!map[w.date]) map[w.date]=[]; map[w.date].push(w); } return map;
  }, [workouts]);

  const days=[]; for(let i=0;i<startWeekday;i++) days.push(null); for(let d=1; d<=lastDay; d++) days.push(ymd(year,month,d));
  const selectedWorkouts = byDate[selected] || [];

  const createWorkoutForSelected = () => {
    const w={ id:uuid(), date:selected, name:selected, exercises:[] };
    setWorkouts((prev)=> [w, ...prev].sort((a,b)=> (a.date<b.date?1:-1)));
  };

  const addExerciseToWorkout = (workout, exerciseName) => {
    const exists = exercises.find((e)=> e.name.toLowerCase()===exerciseName.toLowerCase());
    if (!exists) {
      const created={ name:exerciseName, recommendRep:"", lastWorkout:null, mainMuscle:"", secondaryMuscles:"", type:"", equipment:"", force:"" };
      setExercises((prev)=>[...prev, created]);
    }
    const last = exists?.lastWorkout?.sets?.length ? exists.lastWorkout.sets.at(-1) : null;
    const newExercise = { exerciseName, sets: [{ set:1, weight:last?.weight||0, reps:last?.reps||0 }] };
    setWorkouts((prev)=> prev.map((w)=> w.id===workout.id ? { ...w, exercises:[...w.exercises, newExercise] } : w));
  };

  const deleteWorkout = (id)=> setWorkouts((prev)=> prev.filter((w)=> w.id!==id));

  return (
    <div className="space-y-4">
      <Card><CardContent>
        <div className="flex items-center justify-between mb-3">
          <Button variant="secondary" onClick={prevMonth}>‹ Prev</Button>
          <div className="font-semibold">{viewDate.toLocaleString(undefined, { month:"long", year:"numeric" })}</div>
          <Button variant="secondary" onClick={nextMonth}>Next ›</Button>
        </div>

        <div className="grid grid-cols-7 text-xs text-neutral-600 mb-1">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d)=><div key={d} className="py-1 text-center">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((ds,idx)=> {
            const isSelected = ds===selected; const count = ds ? (byDate[ds]?.length||0) : 0;
            return (
              <button key={idx} className={`aspect-square rounded-xl border text-sm flex flex-col items-center justify-center ${isSelected?"bg-blue-600 text-white":"bg-white"}`}
                      onClick={()=> ds && setSelected(ds)} disabled={!ds}>
                <span className="text-base">{ds ? Number(ds.slice(-2)) : ""}</span>
                {count>0 && <span className={`mt-1 text-[10px] ${isSelected?"text-white":"text-neutral-600"}`}>{count} workout{count>1?"s":""}</span>}
              </button>
            );
          })}
        </div>
      </CardContent></Card>

      <Card><CardContent>
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Plans for {selected}</div>
          <Button variant="primary" onClick={createWorkoutForSelected}><Plus /> New workout</Button>
        </div>

        {selectedWorkouts.length===0 && <p className="text-sm text-neutral-500">No workouts on this day.</p>}

        <div className="space-y-3">
          {selectedWorkouts.map((w)=>(
            <div key={w.id} className="rounded-xl border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium">{w.name}</div>
                <div className="flex items-center gap-2">
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

              <div className="rounded-xl border p-3 mb-2">
                <div className="mb-2 font-medium text-sm">Add exercise</div>
                <AddExerciseInput allExercises={exercises} onAdd={(name)=> addExerciseToWorkout(w, name)} />
              </div>

              {w.exercises.length===0 ? <p className="text-sm text-neutral-500">No exercises yet.</p> : (
                <div className="grid gap-2">
                  {w.exercises.map((we,i)=>(
                    <div key={i} className="rounded-lg border px-3 py-2 text-sm">
                      <div className="font-medium">
                        {we.exerciseName}
                        {(()=>{ const rec = exercises.find((e)=> e.name===we.exerciseName)?.recommendRep || "";
                          return rec? <span className="ml-2 text-xs text-neutral-500">({rec})</span> : null; })()}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {we.sets.map((s)=><Badge key={s.set}>Set {s.set}: {toDisplayWeight(s.weight, unit)} {unit} x {s.reps}</Badge>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent></Card>
    </div>
  );
}
