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
  const [viewDate, setViewDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(() => new Date().toISOString().slice(0, 10));
  const confirm = useConfirm();

  /* ...everything else the same until the Delete button ... */

  const deleteWorkout = (id) => setWorkouts((prev) => prev.filter((w) => w.id !== id));

  /* ... inside the selected workouts list ... */
  // Replace the delete button with:
  // <Button variant="ghost" onClick={() => { confirm({ title: "Delete this workout?", message: "This can't be undone.", confirmText: "Delete", tone: "destructive" }).then(ok => { if (ok) deleteWorkout(w.id); }); }}><Trash2 /></Button>
}
