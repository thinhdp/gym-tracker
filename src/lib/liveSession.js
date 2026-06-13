// src/lib/liveSession.js
// Pure helpers for the live-logging session. The "done" state is a flat map
// keyed by `${exerciseIndex}:${setIndex}` so it survives JSON round-trips and
// is cheap to persist alongside the session pointer.

/** Stable key for a set's done-state within a session. */
export const setKey = (exIdx, setIdx) => `${exIdx}:${setIdx}`;

/** Is a given set marked done in this session's done-map? */
export function isSetDone(done, exIdx, setIdx) {
  return Boolean(done?.[setKey(exIdx, setIdx)]);
}

/** Toggle a set's done flag, returning a new done-map (false entries removed). */
export function toggleDone(done, exIdx, setIdx) {
  const key = setKey(exIdx, setIdx);
  const next = { ...(done || {}) };
  if (next[key]) delete next[key];
  else next[key] = true;
  return next;
}

/** Count of done sets across a whole session. */
export function doneCount(done) {
  return Object.values(done || {}).filter(Boolean).length;
}

/** Total number of sets in a workout. */
export function totalSets(workout) {
  let n = 0;
  for (const ex of workout?.exercises || []) n += (ex.sets || []).length;
  return n;
}

/**
 * Format a duration in seconds as `M:SS` (or `H:MM:SS` past an hour). Negative
 * inputs clamp to zero.
 */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const two = (n) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${two(mins)}:${two(secs)}`
    : `${mins}:${two(secs)}`;
}
