import { entryMacros } from "../lib/macros";

/** One logged food inside a meal slot. */
export default function EntryRow({ entry, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
    >
      <span className="min-w-0">
        <span className="block break-words">{entry.name}</span>
        <span className="block text-xs text-neutral-500 dark:text-neutral-400">
          {entry.portionLabel ?? `${entry.grams} g`}
        </span>
      </span>
      <span className="shrink-0">{`${entryMacros(entry).kcal} kcal`}</span>
    </button>
  );
}
