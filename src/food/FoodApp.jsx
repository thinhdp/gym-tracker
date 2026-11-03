import React, { useEffect, useState } from "react";
import { loadLS, saveLS } from "../lib/storage";
import { K_FOOD_TAB } from "./lib/keys";
import FoodBottomNav from "./components/FoodBottomNav";
import { FoodProvider } from "./context/FoodContext";

// Placeholder heading per tab. Later tasks swap these for views.
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
        <FoodBottomNav active={tab} onSelect={setTab} />
      </div>
    </FoodProvider>
  );
}
