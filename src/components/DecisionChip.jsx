// src/components/DecisionChip.jsx
// Coloured pill for a PP21 engine decision (ADD green, HOLD grey, REDUCE /
// RESET amber, SWAP red, START / DELOAD blue). Shared by PushPullReview and
// Home's NextSessionCard. Props: decision (engine decision string).

import React from "react";

const DECISION_BG = {
  ADD: "bg-green-600",
  HOLD: "bg-neutral-500",
  REDUCE: "bg-amber-600",
  RESET: "bg-amber-600",
  SWAP: "bg-red-600",
  START: "bg-blue-600",
  DELOAD_DONE: "bg-blue-600",
};

export default function DecisionChip({ decision }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${DECISION_BG[decision] || "bg-neutral-500"}`}
    >
      {decision === "DELOAD_DONE" ? "DELOAD" : decision}
    </span>
  );
}
