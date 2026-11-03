import React, { useEffect, useState } from "react";
import { loadLS, saveLS } from "../lib/storage";
import { K_FOOD_TAB } from "./lib/keys";
import { todayLocal } from "./lib/localDate";
import FoodBottomNav from "./components/FoodBottomNav";
import SearchView from "./components/SearchView";
import SettingsView from "./components/SettingsView";
import TodayView from "./components/TodayView";
import TrendsView from "./components/TrendsView";
import { FoodProvider, useFood } from "./context/FoodContext";

// Heading per tab. A tab's view renders below it; tabs without one show only this.
const HEADINGS = {
  today: "Today",
  search: "Search",
  trends: "Trends",
  settings: "Settings",
};

/** One line on every tab when this page load removed damaged rows. Nothing is stored. */
function DroppedRowsNote() {
  const { droppedRows } = useFood();
  if (droppedRows <= 0) return null;
  const rows =
    droppedRows === 1
      ? "1 damaged food row"
      : `${droppedRows} damaged food rows`;
  return (
    <p
      role="status"
      className="mb-4 text-xs text-amber-700 dark:text-amber-400"
    >
      {`Removed ${rows} from this device. A backup can restore them.`}
    </p>
  );
}

export default function FoodApp() {
  const [tab, setTab] = useState(() => {
    const stored = loadLS(K_FOOD_TAB, "today");
    return Object.keys(HEADINGS).includes(stored) ? stored : "today";
  });

  // The viewed day. Search logs to this day, including a past one.
  const [date, setDate] = useState(() => todayLocal());

  // Set by + on a slot, so Search opens on the tapped slot.
  const [presetSlot, setPresetSlot] = useState(null);

  useEffect(() => saveLS(K_FOOD_TAB, tab), [tab]);

  // No cleanup: the Gym link is a full page load.
  useEffect(() => {
    document.title = "Food Tracker";
  }, []);

  const addTo = (slot) => {
    setPresetSlot(slot);
    setTab("search");
  };

  const finishLog = () => {
    setPresetSlot(null);
    setTab("today");
  };

  const pickTab = (next) => {
    setPresetSlot(null);
    setTab(next);
  };

  return (
    <FoodProvider>
      <div className="mx-auto min-h-full max-w-3xl px-4 pb-24 pt-5">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{HEADINGS[tab]}</h1>
          <a href="/" className="text-sm text-blue-600 dark:text-blue-400">
            Gym
          </a>
        </header>
        <DroppedRowsNote />
        {tab === "today" && (
          <TodayView date={date} onChangeDate={setDate} onAddTo={addTo} />
        )}
        {tab === "search" && (
          <SearchView
            date={date}
            presetSlot={presetSlot}
            onLogged={finishLog}
          />
        )}
        {tab === "trends" && <TrendsView />}
        {tab === "settings" && <SettingsView />}
        <FoodBottomNav active={tab} onSelect={pickTab} />
      </div>
    </FoodProvider>
  );
}
