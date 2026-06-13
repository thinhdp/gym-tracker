import React, { createContext, useContext, useState, useEffect } from "react";
import seedExercises from "../data/exercises_seed.json";
import {
  loadLS,
  saveLS,
  uuid,
  K_EX,
  K_WO,
  K_UNIT,
  K_TAB,
  K_THEME,
  K_SESSION,
} from "../lib/storage";
import { applyTheme } from "../lib/theme";
import { ymdFromDate } from "../lib/date";

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
  const [theme, setTheme] = useState(() => loadLS(K_THEME, "system"));
  const [exercises, setExercises] = useState(() => loadLS(K_EX, seedExercises));
  const [workouts, setWorkouts] = useState(() => loadLS(K_WO, []));
  // In-progress live-logging session (or null). Persisted so a refresh mid-set
  // resumes where you left off.
  const [session, setSession] = useState(() => loadLS(K_SESSION, null));

  // Persist tab and unit when they change
  useEffect(() => saveLS(K_TAB, tab), [tab]);
  useEffect(() => saveLS(K_UNIT, unit), [unit]);

  // Persist the theme preference and apply it to <html>.
  useEffect(() => {
    saveLS(K_THEME, theme);
    applyTheme(theme);
  }, [theme]);

  // While following the system, re-apply when the OS light/dark setting flips.
  useEffect(() => {
    if (theme !== "system" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, [theme]);

  // Persist exercises and workouts when they change
  useEffect(() => saveLS(K_EX, exercises), [exercises]);
  useEffect(() => saveLS(K_WO, workouts), [workouts]);
  useEffect(() => saveLS(K_SESSION, session), [session]);

  // Start a live-logging session for an existing workout.
  const startSession = (workoutId) =>
    setSession({ workoutId, startedAt: Date.now(), currentIdx: 0, done: {} });
  // Create a fresh, empty workout dated today and start logging it.
  const startEmptyWorkout = () => {
    const w = {
      id: uuid(),
      date: ymdFromDate(new Date()),
      name: "",
      exercises: [],
    };
    setWorkouts((prev) => [w, ...prev]);
    startSession(w.id);
  };
  const endSession = () => setSession(null);

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
    // Derived-state sync by design (see ARCHITECTURE.md): lastWorkout lives on
    // each exercise and must be recomputed from workouts after they change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExercises((prev) =>
      prev.map((e) => ({
        ...e,
        lastWorkout: latestByName[e.name]
          ? {
              date: latestByName[e.name].date,
              sets: latestByName[e.name].sets,
            }
          : null,
      })),
    );
  }, [workouts, setExercises]);

  return (
    <AppContext.Provider
      value={{
        tab,
        setTab,
        unit,
        setUnit,
        theme,
        setTheme,
        exercises,
        setExercises,
        workouts,
        setWorkouts,
        session,
        setSession,
        startSession,
        startEmptyWorkout,
        endSession,
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
