/**
 * Normalise one raw set into the stored Set shape.
 *
 * Shared by every path that rebuilds sets from untrusted or re-mapped data
 * (backup import, the workout planner) so the shape has a single definition.
 *
 * `targetReps` is optional: it is carried only when positive, never written as
 * 0, so sets that never had a rep target round-trip unchanged.
 *
 * @param {object|null|undefined} raw  a set-like object
 * @param {number} index               0-based position; becomes 1-based `set`
 * @returns {{set: number, weight: number, reps: number, targetReps?: number}}
 */
export function normalizeSet(raw, index) {
  const set = {
    set: index + 1,
    weight: Number(raw?.weight) || 0,
    reps: Number(raw?.reps) || 0,
  };
  const targetReps = Number(raw?.targetReps) || 0;
  if (targetReps > 0) set.targetReps = targetReps;
  return set;
}
