// src/lib/review/match.js
// Exercise-name matching helpers for the review engine. Identity is the
// (trimmed, lowercased) name — the same case-insensitive convention the rest of
// the app uses. Matching is EXACT equality against a list entry (not substring)
// so e.g. "Romanian Deadlift" never matches the "deadlift" special bucket.

export function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

export function matchesAny(name, list) {
  const n = normalizeName(name);
  if (!n) return false;
  return (list || []).some((m) => normalizeName(m) === n);
}
