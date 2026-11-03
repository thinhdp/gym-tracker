import React, { useMemo } from "react";
import { loadLS } from "../lib/storage";
import { K_FOOD_ENTRIES, K_FOOD_TARGETS } from "../food/lib/keys";
import { normalizeFoodData } from "../food/lib/normalize";
import { targetForDate } from "../food/lib/targets";
import { sumMacros, pct, barTone } from "../food/lib/macros";
import { todayLocal } from "../food/lib/localDate";
import { TONE_CLASSES } from "../food/components/MacroBars";

const CARD =
  "block rounded-2xl border bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900";
const LABEL =
  "text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400";

/** Home card: today's food against target. Read-only; links to /food. */
export default function FoodSummaryCard() {
  const { target, totals } = useMemo(() => {
    const today = todayLocal();
    const { entries, targets } = normalizeFoodData({
      entries: loadLS(K_FOOD_ENTRIES, []),
      targets: loadLS(K_FOOD_TARGETS, []),
    });
    return {
      target: targetForDate(targets, today),
      totals: sumMacros(entries.filter((e) => e.date === today)),
    };
  }, []);

  if (!target) {
    return (
      <a
        href="/food"
        className={`${CARD} text-sm font-medium text-blue-600 dark:text-blue-400`}
      >
        Set up food tracking →
      </a>
    );
  }

  const ratio = pct(totals.kcal, target.kcal);
  return (
    <a href="/food" className={CARD}>
      <div className="flex items-center justify-between">
        <div className={LABEL}>Food today</div>
        <span aria-hidden className="text-neutral-400">
          ›
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          data-testid="food-summary-bar"
          className={`h-full rounded-full ${TONE_CLASSES[barTone(ratio)]}`}
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </div>
      <div className="mt-2 text-sm text-neutral-900 dark:text-neutral-100">
        {`${totals.kcal} / ${target.kcal} kcal`}
      </div>
      <div className="text-xs text-neutral-500 dark:text-neutral-400">
        {`Protein ${totals.protein} / ${target.protein} g`}
      </div>
    </a>
  );
}
