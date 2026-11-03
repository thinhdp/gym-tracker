import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { useFood } from "../context/FoodContext";
import {
  addDays,
  formatDayHeader,
  isToday,
  todayLocal,
} from "../lib/localDate";
import { sumMacros } from "../lib/macros";
import { SLOTS } from "../lib/slots";
import { targetForDate } from "../lib/targets";
import EntryEditSheet from "./EntryEditSheet";
import MacroBars from "./MacroBars";
import MealSlot from "./MealSlot";
import SavedMealsPanel from "./SavedMealsPanel";

/** One day's log: date navigation, macro bars and the six meal slots. */
export default function TodayView({ date, onChangeDate, onAddTo }) {
  const { entries, targets, updateEntry, deleteEntry } = useFood();
  const [editing, setEditing] = useState(null);
  const [mealsSlot, setMealsSlot] = useState(null);

  const dayEntries = entries.filter((entry) => entry.date === date);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            aria-label="Previous day"
            onClick={() => onChangeDate(addDays(date, -1))}
          >
            ‹
          </Button>
          <h2 className="font-medium">{formatDayHeader(date)}</h2>
          <Button
            type="button"
            size="sm"
            aria-label="Next day"
            onClick={() => onChangeDate(addDays(date, 1))}
          >
            ›
          </Button>
        </div>
        {!isToday(date) && (
          <Button
            type="button"
            size="sm"
            onClick={() => onChangeDate(todayLocal())}
          >
            Today
          </Button>
        )}
      </div>

      <MacroBars
        totals={sumMacros(dayEntries)}
        target={targetForDate(targets, date)}
      />

      {SLOTS.map(({ id }) => (
        <MealSlot
          key={id}
          slot={id}
          entries={dayEntries
            .filter((entry) => entry.slot === id)
            .sort((a, b) => a.createdAt - b.createdAt)}
          onAdd={onAddTo}
          onEdit={setEditing}
          onMenu={setMealsSlot}
        />
      ))}

      {mealsSlot && (
        <SavedMealsPanel
          date={date}
          slot={mealsSlot}
          onLogged={() => setMealsSlot(null)}
          onClose={() => setMealsSlot(null)}
        />
      )}

      {editing && (
        <EntryEditSheet
          key={editing.id}
          entry={editing}
          onSave={(patch) => {
            updateEntry(editing.id, patch);
            setEditing(null);
          }}
          onDelete={() => {
            deleteEntry(editing.id);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
