// src/lib/liveSession.js
// Pure helpers for the live-logging session. A set is considered "logged" once
// it has reps entered (> 0) — there is no separate done flag, so completion
// lives on the set itself and moves with its exercise when reordered.

/** A set counts as logged once it has reps entered (> 0). */
export function isLogged(set) {
  return Number(set?.reps) > 0;
}

/** Total number of sets in a workout. */
export function totalSets(workout) {
  let n = 0;
  for (const ex of workout?.exercises || []) n += (ex.sets || []).length;
  return n;
}

/** Count of logged sets across a whole workout. */
export function completedSets(workout) {
  let n = 0;
  for (const ex of workout?.exercises || [])
    for (const s of ex.sets || []) if (isLogged(s)) n += 1;
  return n;
}

/**
 * New index of an exercise originally at `index` after moving the exercise at
 * `from` to `to` (matching arrayUtils.moveItem semantics). Used to keep the
 * on-screen exercise pointer (`currentIdx`) on the same exercise after a reorder.
 */
export function remapIndexAfterMove(index, from, to) {
  if (index === from) return to;
  if (from < to) return index > from && index <= to ? index - 1 : index;
  if (from > to) return index >= to && index < from ? index + 1 : index;
  return index;
}

/**
 * Whole seconds left on a timer that ends at the wall-clock instant `endsAt`
 * (ms epoch), given the current time `now` (ms epoch). Deriving the countdown
 * from a target timestamp — rather than decrementing a per-tick counter — keeps
 * it accurate when a mobile browser freezes timers on a backgrounded tab: the
 * value self-corrects the moment the clock next advances. Returns 0 once the
 * timer has elapsed; `null` endsAt (idle) returns null.
 */
export function restRemaining(endsAt, now) {
  if (endsAt == null) return null;
  return Math.max(0, Math.floor((endsAt - now) / 1000));
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
