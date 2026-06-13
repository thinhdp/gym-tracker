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
 * New index of an exercise originally at `index` after moving the exercise at
 * `from` to `to` (matching arrayUtils.moveItem semantics).
 */
export function remapIndexAfterMove(index, from, to) {
  if (index === from) return to;
  if (from < to) return index > from && index <= to ? index - 1 : index;
  if (from > to) return index >= to && index < from ? index + 1 : index;
  return index;
}

/**
 * Rebuild a done-map (keyed `"exerciseIdx:setIdx"`) so its exercise indices
 * follow a moveItem(from, to) reorder of the exercise list.
 */
export function remapDoneAfterMove(done, from, to) {
  const out = {};
  for (const [k, v] of Object.entries(done || {})) {
    const [ei, si] = k.split(":").map(Number);
    out[setKey(remapIndexAfterMove(ei, from, to), si)] = v;
  }
  return out;
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
