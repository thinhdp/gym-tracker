import React, { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import Segmented from "./ui/Segmented";
import { Input } from "./ui/Input";
import Notepad from "./Notepad";
import CycleReview from "./CycleReview";
import DataManagementMenu from "./DataManagementMenu";
import LiftSourcesEditor from "./LiftSourcesEditor";
import { loadLS, saveLS, K_PROFILE } from "../lib/storage";

/**
 * "More" destination — a settings hub for everything that doesn't warrant its
 * own tab: unit + theme preferences, the notepad (as a sub-screen), and data
 * export/import.
 */

function SectionLabel({ children }) {
  return (
    <div className="mb-1.5 px-1 text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
      {children}
    </div>
  );
}

export default function MoreMenu() {
  const { theme, setTheme, workouts, exercises } = useApp();
  const [view, setView] = useState("menu");

  // Every exercise name the user could map a standard lift to: those they've
  // logged plus the rest of their exercise database, deduped case-insensitively.
  const exerciseNames = useMemo(() => {
    const seen = new Set();
    const out = [];
    const add = (name) => {
      const n = (name || "").trim();
      if (!n) return;
      const k = n.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      out.push(n);
    };
    for (const w of workouts || [])
      for (const ex of w.exercises || []) add(ex.exerciseName);
    for (const ex of exercises || []) add(ex.name);
    return out;
  }, [workouts, exercises]);

  // Lifter profile (sex + birth year) for the Progress -> Symmetry view's
  // strength-standards lookups. Self-persisted like the Notepad/Weight logs.
  const [profile, setProfile] = useState(() => loadLS(K_PROFILE, {}));
  const updateProfile = (patch) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      saveLS(K_PROFILE, next);
      return next;
    });
  };

  if (view === "notepad") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setView("menu")}
          className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400"
        >
          <span aria-hidden>←</span> More
        </button>
        <Notepad />
      </div>
    );
  }

  if (view === "cycleReview") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setView("menu")}
          className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400"
        >
          <span aria-hidden>←</span> More
        </button>
        <CycleReview />
      </div>
    );
  }

  if (view === "liftSources") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setView("menu")}
          className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400"
        >
          <span aria-hidden>←</span> More
        </button>
        <h1 className="px-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Lift sources
        </h1>
        <LiftSourcesEditor
          value={profile.liftConfig}
          onChange={(liftConfig) => updateProfile({ liftConfig })}
          exerciseNames={exerciseNames}
        />
      </div>
    );
  }

  const card =
    "rounded-xl border bg-white dark:border-neutral-800 dark:bg-neutral-900";
  const rowText = "text-sm text-neutral-900 dark:text-neutral-100";

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        More
      </h1>

      {/* Preferences */}
      <div>
        <SectionLabel>Preferences</SectionLabel>
        <div className={`${card} divide-y dark:divide-neutral-800`}>
          {/*
            Units (kg/lb) toggle temporarily hidden: bodyweight logs aren't
            unit-converted yet (ARCHITECTURE.md open question #1), so switching
            to lb mislabels bodyweight. Restore this row once that's fixed.
              <div className="flex items-center justify-between px-3 py-3">
                <span className={rowText}>Units</span>
                <Segmented options={[["kg","kg"],["lb","lb"]]} value={unit} onChange={setUnit} />
              </div>
          */}
          <div className="flex items-center justify-between px-3 py-3">
            <span className={rowText}>Theme</span>
            <Segmented
              options={[
                ["system", "Auto"],
                ["light", "Light"],
                ["dark", "Dark"],
              ]}
              value={theme}
              onChange={setTheme}
            />
          </div>
        </div>
      </div>

      {/* Profile — feeds the Progress → Symmetry strength standards */}
      <div>
        <SectionLabel>Profile</SectionLabel>
        <div className={`${card} divide-y dark:divide-neutral-800`}>
          <div className="flex items-center justify-between px-3 py-3">
            <span className={rowText}>Sex</span>
            <Segmented
              options={[
                ["male", "Male"],
                ["female", "Female"],
              ]}
              value={profile.sex || ""}
              onChange={(sex) => updateProfile({ sex })}
            />
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-3">
            <div>
              <div className={rowText}>Birth year</div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Optional — sharpens your age cohort
              </div>
            </div>
            <div className="w-24">
              <Input
                type="number"
                inputMode="numeric"
                placeholder="1996"
                min="1900"
                max="2020"
                value={profile.birthYear ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  updateProfile({
                    birthYear: v === "" ? undefined : Number(v),
                  });
                }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setView("liftSources")}
            className="flex w-full items-center justify-between px-3 py-3 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <div>
              <div className={rowText}>Lift sources</div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Map lifts to exercises · add bar weight
              </div>
            </div>
            <span
              aria-hidden
              className="text-neutral-400 dark:text-neutral-500"
            >
              ›
            </span>
          </button>
        </div>
        <p className="mt-1 px-1 text-[11px] text-neutral-400 dark:text-neutral-500">
          Used only to compare your lifts against strength standards. Stays on
          this device.
        </p>
      </div>

      {/* Content */}
      <div>
        <SectionLabel>Content</SectionLabel>
        <div className={`${card} divide-y dark:divide-neutral-800`}>
          <button
            type="button"
            onClick={() => setView("notepad")}
            className="flex w-full items-center justify-between px-3 py-3 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <span className={rowText}>Notepad</span>
            <span aria-hidden className="text-neutral-400 dark:text-neutral-500">›</span>
          </button>
          <button
            type="button"
            onClick={() => setView("cycleReview")}
            className="flex w-full items-center justify-between px-3 py-3 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <div>
              <div className={rowText}>Cycle Review</div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Max 7/5/3 review + next-cycle plan
              </div>
            </div>
            <span aria-hidden className="text-neutral-400 dark:text-neutral-500">›</span>
          </button>
        </div>
      </div>

      {/* Data */}
      <div>
        <SectionLabel>Data</SectionLabel>
        <div className={`${card} flex items-center justify-between px-3 py-3`}>
          <div>
            <div className={rowText}>Backup</div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Export or import your data as JSON
            </div>
          </div>
          <DataManagementMenu />
        </div>
      </div>

      <p className="px-1 text-center text-[11px] text-neutral-400 dark:text-neutral-500">
        Gym Tracker · data stored in your browser
      </p>
    </div>
  );
}
