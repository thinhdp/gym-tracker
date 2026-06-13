import React from "react";

/**
 * Fixed bottom tab bar — the app's primary navigation. Five thumb-reachable
 * destinations, always visible, replacing the old horizontally-scrolling top
 * tabs. Icons are inline stroke SVG (currentColor) so no icon library is added.
 */

const ICONS = {
  home: "M3 11.5 12 3l9 8.5M5 10v10h14V10",
  workouts: "M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10",
  progress: "M4 5v14h16M7 15l3-4 3 2 4-6",
  exercises: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  more: "M6 12h.01M12 12h.01M18 12h.01",
};

const TABS = [
  ["home", "Home"],
  ["workouts", "Workouts"],
  ["progress", "Progress"],
  ["exercises", "Exercises"],
  ["more", "More"],
];

function NavIcon({ name }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "more" ? 2.5 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function BottomNav({ active, onSelect }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 backdrop-blur"
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
                  ? "text-blue-600"
                  : "text-neutral-500 hover:text-neutral-800",
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
