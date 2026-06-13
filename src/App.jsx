import React from "react";
import "./index.css";
import { AppProvider, useApp } from "./context/AppContext";
import BottomNav from "./components/ui/BottomNav";
import Home from "./components/Home";
import WorkoutsTab from "./components/WorkoutsTab";
import Progress from "./components/Progress";
import ExerciseManager from "./components/ExerciseManager";
import MoreMenu from "./components/MoreMenu";

// The five primary destinations rendered by the bottom nav.
const VIEWS = {
  home: Home,
  workouts: WorkoutsTab,
  progress: Progress,
  exercises: ExerciseManager,
  more: MoreMenu,
};

// Map legacy persisted tab values (the old six-tab IA) onto the new destinations
// so returning users don't land on a blank screen.
const LEGACY = {
  calendar: "workouts",
  weight: "progress",
  summary: "progress",
  notepad: "more",
};

function AppContent() {
  const { tab, setTab } = useApp();
  const active = VIEWS[tab] ? tab : LEGACY[tab] || "home";
  const View = VIEWS[active];

  return (
    <div className="mx-auto min-h-full max-w-3xl px-4 pb-24 pt-5">
      <View />
      <BottomNav active={active} onSelect={setTab} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
