import React from "react";

/**
 * Fixed bottom tab bar for the food mode. Same markup pattern as the gym's
 * ui/BottomNav. Icons are inline stroke SVG (currentColor).
 */

const ICONS = {
  today: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5",
  trends: "M4 5v14h16M7 15l3-4 3 2 4-6",
  settings: "M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4h4V5zM6 15v4h4v-4z",
};

const TABS = [
  ["today", "Today"],
  ["search", "Search"],
  ["trends", "Trends"],
  ["settings", "Settings"],
];

function NavIcon({ name }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function FoodBottomNav({ active, onSelect }) {
  return (
    <nav
      aria-label="Food"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95"
    >
      <div className="mx-auto flex max-w-3xl">
        {TABS.map(([key, label]) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-current={isActive ? "page" : undefined}
              className={[
                "flex flex-1 flex-col items-center gap-0.5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[11px] transition",
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200",
              ].join(" ")}
            >
              <NavIcon name={key} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
