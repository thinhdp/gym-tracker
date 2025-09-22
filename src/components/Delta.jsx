// src/components/Delta.jsx
// Displays numeric delta with ± sign and color.

import React from "react";

export default function Delta({ curr, prev, decimals = 0 }) {
  if (prev == null || curr == null) {
    return (
      <span className="text-xs text-neutral-500 ml-1 block sm:inline">—</span>
    );
  }
  const factor = Math.pow(10, decimals);
  const diffRaw = curr - prev;
  const diff = Math.round(diffRaw * factor) / factor;
  if (diff === 0) {
    return (
      <span className="text-xs text-neutral-500 ml-1 block sm:inline">
        ±0
      </span>
    );
  }
  const sign = diff > 0 ? "+" : "";
  const color = diff > 0 ? "text-green-600" : "text-red-600";
  return (
    <span className={`text-xs ml-1 ${color} block sm:inline`}>
      {sign}
      {diff}
    </span>
  );
}
