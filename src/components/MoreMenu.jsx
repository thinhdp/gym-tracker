import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import Segmented from "./ui/Segmented";
import Notepad from "./Notepad";
import DataManagementMenu from "./DataManagementMenu";

/**
 * "More" destination — a settings hub for everything that doesn't warrant its
 * own tab: unit preference, the notepad (as a sub-screen), and data
 * export/import. Theme is shown as a placeholder for the future dark direction.
 */

function SectionLabel({ children }) {
  return (
    <div className="mb-1.5 px-1 text-[10px] uppercase tracking-wide text-neutral-400">
      {children}
    </div>
  );
}

export default function MoreMenu() {
  const { unit, setUnit } = useApp();
  const [view, setView] = useState("menu");

  if (view === "notepad") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setView("menu")}
          className="flex items-center gap-1 text-sm text-blue-600"
        >
          <span aria-hidden>←</span> More
        </button>
        <Notepad />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-neutral-900">More</h1>

      {/* Preferences */}
      <div>
        <SectionLabel>Preferences</SectionLabel>
        <div className="divide-y rounded-xl border bg-white">
          <div className="flex items-center justify-between px-3 py-3">
            <span className="text-sm text-neutral-900">Units</span>
            <Segmented
              options={[
                ["kg", "kg"],
                ["lb", "lb"],
              ]}
              value={unit}
              onChange={setUnit}
            />
          </div>
          <div className="flex items-center justify-between px-3 py-3">
            <span className="text-sm text-neutral-900">Theme</span>
            <span className="text-xs text-neutral-400">Light · dark soon</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        <SectionLabel>Content</SectionLabel>
        <div className="rounded-xl border bg-white">
          <button
            type="button"
            onClick={() => setView("notepad")}
            className="flex w-full items-center justify-between px-3 py-3 text-left transition hover:bg-neutral-50"
          >
            <span className="text-sm text-neutral-900">Notepad</span>
            <span aria-hidden className="text-neutral-400">
              ›
            </span>
          </button>
        </div>
      </div>

      {/* Data */}
      <div>
        <SectionLabel>Data</SectionLabel>
        <div className="flex items-center justify-between rounded-xl border bg-white px-3 py-3">
          <div>
            <div className="text-sm text-neutral-900">Backup</div>
            <div className="text-[11px] text-neutral-500">
              Export or import your data as JSON
            </div>
          </div>
          <DataManagementMenu />
        </div>
      </div>

      <p className="px-1 text-center text-[11px] text-neutral-400">
        Gym Tracker · data stored in your browser
      </p>
    </div>
  );
}
