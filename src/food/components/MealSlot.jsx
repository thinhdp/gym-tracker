import { Button } from "../../components/ui/Button";
import { sumMacros } from "../lib/macros";
import { slotLabel } from "../lib/slots";
import EntryRow from "./EntryRow";

/** One meal slot of the day: its total, its rows, add and options buttons. */
export default function MealSlot({
  slot,
  entries,
  expanded,
  onToggle,
  onAdd,
  onEdit,
  onMenu,
}) {
  const label = slotLabel(slot);
  const total = sumMacros(entries);
  return (
    <section
      aria-label={label}
      className="space-y-1 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{label}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${label} totals`}
            onClick={() => onToggle()}
            className="rounded-lg px-1.5 py-1 text-sm text-neutral-500 dark:text-neutral-400"
          >
            {`${total.kcal} kcal`}
          </button>
          <Button
            type="button"
            size="sm"
            aria-label={`Add to ${label}`}
            onClick={() => onAdd(slot)}
          >
            +
          </Button>
          <Button
            type="button"
            size="sm"
            aria-label={`${label} options`}
            disabled={!onMenu}
            onClick={() => onMenu(slot)}
          >
            …
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="flex justify-end gap-3 px-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span>{`P ${total.protein} g`}</span>
          <span>{`C ${total.carb} g`}</span>
          <span>{`F ${total.fat} g`}</span>
        </div>
      )}
      {entries.map((entry) => (
        <EntryRow
          key={entry.id}
          entry={entry}
          expanded={expanded}
          onClick={() => onEdit(entry)}
        />
      ))}
    </section>
  );
}
