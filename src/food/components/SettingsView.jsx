import React from "react";
import TargetsEditor from "./TargetsEditor";

export default function SettingsView() {
  return (
    <div className="space-y-6">
      <section aria-labelledby="settings-targets" className="space-y-3">
        <h2 id="settings-targets" className="text-lg font-semibold">
          Targets
        </h2>
        <TargetsEditor />
      </section>
      <a href="/" className="text-sm text-blue-600 dark:text-blue-400">
        Back to Gym
      </a>
    </div>
  );
}
