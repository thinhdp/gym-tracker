// Generic array helpers.

/**
 * Return a copy of `arr` with the element at `from` moved to `to`.
 * Returns `arr` unchanged when `to` is out of bounds.
 */
export function moveItem(arr, from, to) {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}
