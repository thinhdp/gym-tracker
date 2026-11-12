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
import { recentKey, recentToFood } from "../lib/recent";
import { SLOTS, slotForTime, slotLabel } from "../lib/slots";
import { targetForDate } from "../lib/targets";
import CalendarSheet from "./CalendarSheet";
import EntryEditSheet from "./EntryEditSheet";
import MacroBars from "./MacroBars";
import MealSlot from "./MealSlot";
import PortionSheet from "./PortionSheet";
import RecentRow from "./RecentRow";
import SavedMealsPanel from "./SavedMealsPanel";
import SaveMealSheet from "./SaveMealSheet";

/** Small sheet with the two saved-meal actions for one slot. */
function SlotMenu({ slot, canSave, onSave, onLog, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${slotLabel(slot)} options`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
    >
      <div className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-4 sm:rounded-2xl dark:bg-neutral-900 dark:text-neutral-100">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold">{slotLabel(slot)}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        {canSave && (
          <Button type="button" className="w-full" onClick={onSave}>
            Save as meal
          </Button>
        )}
        <Button type="button" className="w-full" onClick={onLog}>
          Log saved meal
        </Button>
      </div>
    </div>
  );
}

/** One day's log: date navigation, macro bars and the six meal slots. */
export default function TodayView({
  date,
  onChangeDate,
  onAddTo,
  onOpenSettings,
}) {
  const {
    entries,
    recent,
    customFoods,
    targets,
    completedDays,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleDayComplete,
  } = useFood();
  const [editing, setEditing] = useState(null);
  const [menuSlot, setMenuSlot] = useState(null);
  const [mealsSlot, setMealsSlot] = useState(null);
  const [saveSlot, setSaveSlot] = useState(null);
  const [recentSheet, setRecentSheet] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dayEntries = entries.filter((entry) => entry.date === date);
  const target = targetForDate(targets, date);
  const isComplete = completedDays.includes(date);

  const portionsFor = (food) => {
    if (food.kind === "custom") {
      return customFoods.find((row) => row.id === food.id)?.portions ?? [];
    }
    const key = recentKey(food);
    return recent.find((row) => recentKey(row.food) === key)?.portions ?? [];
  };

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
          <h2 className="font-medium">
            <button
              type="button"
              aria-label={`Open calendar, ${formatDayHeader(date)}`}
              onClick={() => setCalendarOpen(true)}
            >
              {formatDayHeader(date)}
            </button>
          </h2>
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

      <MacroBars totals={sumMacros(dayEntries)} target={target} />

      {!target && (
        <button
          type="button"
          className="text-sm text-blue-600 underline dark:text-blue-400"
          onClick={onOpenSettings}
        >
          Set targets in Settings
        </button>
      )}

      {dayEntries.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Nothing logged yet
        </p>
      )}

      <RecentRow date={date} onOpen={setRecentSheet} />

      {SLOTS.map(({ id }) => (
        <MealSlot
          key={id}
          slot={id}
          entries={dayEntries
            .filter((entry) => entry.slot === id)
            .sort((a, b) => a.createdAt - b.createdAt)}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
          onAdd={onAddTo}
          onEdit={setEditing}
          onMenu={setMenuSlot}
        />
      ))}

      {date <= todayLocal() && (
        <button
          type="button"
          className={`w-full rounded-xl border px-3 py-1.5 text-sm ${
            isComplete
              ? "border-green-300 bg-green-100 text-green-900 dark:border-green-800 dark:bg-green-900/50 dark:text-green-100"
              : "border-neutral-300 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          }`}
          aria-pressed={isComplete}
          onClick={() => toggleDayComplete(date)}
        >
          {isComplete ? "Completed ✓" : "Mark day complete"}
        </button>
      )}

      {calendarOpen && (
        <CalendarSheet
          date={date}
          entries={entries}
          completedDays={completedDays}
          onPick={(ymd) => {
            onChangeDate(ymd);
            setCalendarOpen(false);
          }}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      {menuSlot && (
        <SlotMenu
          slot={menuSlot}
          canSave={dayEntries.some((entry) => entry.slot === menuSlot)}
          onSave={() => {
            setSaveSlot(menuSlot);
            setMenuSlot(null);
          }}
          onLog={() => {
            setMealsSlot(menuSlot);
            setMenuSlot(null);
          }}
          onClose={() => setMenuSlot(null)}
        />
      )}

      {saveSlot && (
        <SaveMealSheet
          date={date}
          slot={saveSlot}
          onClose={() => setSaveSlot(null)}
        />
      )}

      {mealsSlot && (
        <SavedMealsPanel
          date={date}
          slot={mealsSlot}
          onLogged={() => setMealsSlot(null)}
          onClose={() => setMealsSlot(null)}
        />
      )}

      {recentSheet && (
        <PortionSheet
          key={recentKey(recentSheet.food)}
          food={recentToFood(recentSheet)}
          date={date}
          defaultSlot={slotForTime()}
          defaultGrams={recentSheet.lastGrams}
          onAdd={(payload) => {
            addEntry({ ...payload, date });
            setRecentSheet(null);
          }}
          onClose={() => setRecentSheet(null)}
        />
      )}

      {editing && (
        <EntryEditSheet
          key={editing.id}
          entry={editing}
          portions={portionsFor(editing.food)}
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
