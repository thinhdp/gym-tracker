import React, { useEffect, useState } from "react";
import { loadLS, saveLS } from "../lib/storage";
import { K_FOOD_TAB } from "./lib/keys";
import { todayLocal } from "./lib/localDate";
import FoodBottomNav from "./components/FoodBottomNav";
import SearchView from "./components/SearchView";
import SettingsView from "./components/SettingsView";
import { FoodProvider } from "./context/FoodContext";

// Heading per tab. A tab's view renders below it; tabs without one show only this.
const HEADINGS = {
  today: "Today",
  search: "Search",
  trends: "Trends",
  settings: "Settings",
};

export default function FoodApp() {
  const [tab, setTab] = useState(() => {
    const stored = loadLS(K_FOOD_TAB, "today");
    return Object.keys(HEADINGS).includes(stored) ? stored : "today";
  });

  // Today sets this in a later task, so Search opens on the tapped slot.
  const [presetSlot] = useState(null);

  useEffect(() => saveLS(K_FOOD_TAB, tab), [tab]);

  // No cleanup: the Gym link is a full page load.
  useEffect(() => {
    document.title = "Food Tracker";
  }, []);

  return (
    <FoodProvider>
      <div className="mx-auto min-h-full max-w-3xl px-4 pb-24 pt-5">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{HEADINGS[tab]}</h1>
          <a href="/" className="text-sm text-blue-600 dark:text-blue-400">
            Gym
          </a>
        </header>
        {tab === "search" && (
          <SearchView
            date={todayLocal()}
            presetSlot={presetSlot}
            onLogged={() => setTab("today")}
          />
        )}
        {tab === "settings" && <SettingsView />}
        <FoodBottomNav active={tab} onSelect={setTab} />
      </div>
    </FoodProvider>
  );
}
