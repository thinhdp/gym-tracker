// src/lib/theme.js
// Theme preference resolution. The app stores one of three preferences —
// "system" | "light" | "dark" — and applies a concrete light/dark mode by
// toggling the `dark` class on <html> (Tailwind darkMode: "class").

/** Valid theme preferences, in toggle order. */
export const THEME_OPTIONS = ["system", "light", "dark"];

/** Does the OS currently prefer dark? Safe when matchMedia is unavailable. */
export function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** Resolve a preference to a concrete boolean "is dark". */
export function resolveDark(pref) {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return systemPrefersDark(); // "system" (and any unknown value)
}

/** Apply a preference by toggling the `dark` class on the document root. */
export function applyTheme(pref) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveDark(pref));
}
