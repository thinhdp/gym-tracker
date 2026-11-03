import { Button } from "../../components/ui/Button";
import { sumMacros } from "../lib/macros";
import { slotLabel } from "../lib/slots";
import EntryRow from "./EntryRow";

/** One meal slot of the day: its total, its rows, add and options buttons. */
export default function MealSlot({ slot, entries, onAdd, onEdit, onMenu }) {
  const label = slotLabel(slot);
  return (
    <section
      aria-label={label}
      className="space-y-1 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{label}</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {`${sumMacros(entries).kcal} kcal`}
          </span>
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
      {entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} onClick={() => onEdit(entry)} />
      ))}
    </section>
  );
}
