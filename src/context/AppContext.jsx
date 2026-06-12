import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";
import seedExercises from "../data/exercises_seed.json";
import {
  loadLS,
  saveLS,
  K_EX,
  K_WO,
  K_UNIT,
  K_TAB,
} from "../lib/storage";

/**
 * AppContext stores the top‑level app state: current tab,
 * measurement unit, list of exercises and list of workouts.
 * It also persists them to localStorage and recomputes the
 * last‑workout information whenever workouts change.
 */
const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Load initial values from localStorage (with sensible defaults)
  const [tab, setTab] = useState(() => loadLS(K_TAB, "workouts"));
  const [unit, setUnit] = useState(() => loadLS(K_UNIT, "kg"));
  const [exercises, setExercises] = useState(() =>
    loadLS(K_EX, seedExercises)
  );
  const [workouts, setWorkouts] = useState(() => loadLS(K_WO, []));

  // Persist tab and unit when they change
  useEffect(() => saveLS(K_TAB, tab), [tab]);
  useEffect(() => saveLS(K_UNIT, unit), [unit]);

  // Persist exercises and workouts when they change
  useEffect(() => saveLS(K_EX, exercises), [exercises]);
  useEffect(() => saveLS(K_WO, workouts), [workouts]);

  // Update each exercise’s lastWorkout property whenever workouts change
  useEffect(() => {
    const latestByName = {};
    for (const w of workouts) {
      for (const ex of w.exercises || []) {
        if (
          !latestByName[ex.exerciseName] ||
          latestByName[ex.exerciseName].date < w.date
        ) {
          latestByName[ex.exerciseName] = {
            date: w.date,
            sets: ex.sets,
          };
        }
      }
    }
    setExercises((prev) =>
      prev.map((e) => ({
        ...e,
        lastWorkout: latestByName[e.name]
          ? {
              date: latestByName[e.name].date,
              sets: latestByName[e.name].sets,
            }
          : null,
      }))
    );
  }, [workouts, setExercises]);

  return (
    <AppContext.Provider
      value={{
        tab,
        setTab,
        unit,
        setUnit,
        exercises,
        setExercises,
        workouts,
        setWorkouts,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

/**
 * Hook to access the AppContext. Components consuming this hook
 * gain read/write access to the shared state.
 */
export function useApp() {
  return useContext(AppContext);
}
