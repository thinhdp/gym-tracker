import { barTone, pct } from "../lib/macros";

const ROWS = [
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carb", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
];

const TONE_CLASSES = {
  ok: "bg-blue-600",
  warn: "bg-amber-500",
  over: "bg-red-600",
};

/** The day's totals: bars against the target, or plain numbers without one. */
export default function MacroBars({ totals, target }) {
  return (
    <div role="group" aria-label="Day totals" className="space-y-2">
      {ROWS.map(({ key, label, unit }) => {
        if (!target) {
          return (
            <div key={key} className="flex justify-between text-sm">
              <span>{label}</span>
              <span>{`${totals[key]} ${unit}`}</span>
            </div>
          );
        }
        // pct is null when this macro's target is 0: no fill, default tone.
        const ratio = pct(totals[key], target[key]);
        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{label}</span>
              <span>{`${totals[key]} / ${target[key]} ${unit}`}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                data-testid={`macro-bar-${key}`}
                className={`h-full rounded-full ${TONE_CLASSES[barTone(ratio)]}`}
                style={{ width: `${Math.min(100, ratio * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
