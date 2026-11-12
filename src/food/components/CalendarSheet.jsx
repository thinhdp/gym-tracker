import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { dayTotals, monthGrid } from "../lib/calendar";
import { targetForDate } from "../lib/targets";
import { localDateFromYmd, todayLocal } from "../lib/localDate";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Month calendar sheet: kcal per day, completed days in green. */
export default function CalendarSheet({
  date,
  entries,
  completedDays,
  targets = [],
  onPick,
  onClose,
}) {
  const shown = localDateFromYmd(date);
  const [view, setView] = useState({
    year: shown.getFullYear(),
    month: shown.getMonth(),
  });
  const totals = dayTotals(entries);
  const completed = new Set(completedDays);
  const today = todayLocal();
  const weeks = monthGrid(view.year, view.month);

  const step = (n) => {
    const d = new Date(view.year, view.month + n, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  const title = new Date(view.year, view.month, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Calendar"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
    >
      <div className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-4 sm:rounded-2xl dark:bg-neutral-900 dark:text-neutral-100">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Previous month"
            onClick={() => step(-1)}
          >
            ‹
          </Button>
          <h2 className="font-semibold">{title}</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Next month"
            onClick={() => step(1)}
          >
            ›
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
          {WEEKDAYS.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weeks.flat().map((day, i) => {
            if (!day) return <div key={i} />;
            const isDone = completed.has(day);
            const kcal = totals.has(day) ? totals.get(day) : isDone ? 0 : null;
            const dayTarget =
              kcal !== null ? targetForDate(targets, day) : null;
            const isOver = dayTarget !== null && kcal > dayTarget.kcal;
            const label = [
              day,
              kcal !== null ? `${kcal} kcal` : null,
              isOver ? "over target" : null,
              isDone ? "completed" : null,
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <button
                key={i}
                type="button"
                aria-label={label}
                aria-current={day === date ? "date" : undefined}
                onClick={() => onPick(day)}
                className={`flex h-12 flex-col items-center justify-center rounded-lg text-sm ${
                  isDone
                    ? "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100"
                    : ""
                } ${day === date ? "outline outline-2 outline-neutral-900 dark:outline-neutral-100" : ""} ${
                  day === today ? "font-bold" : ""
                }`}
              >
                <span>{Number(day.slice(8))}</span>
                {kcal !== null && (
                  <span
                    className={`text-[10px] ${
                      isOver
                        ? isDone
                          ? "text-red-700 dark:text-red-300"
                          : "text-red-600 dark:text-red-400"
                        : ""
                    }`}
                  >
                    {kcal}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
