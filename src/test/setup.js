import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// jsdom's localStorage persists across tests within a file — wipe it so
// AppContext / storage tests can't leak mgym.* keys into each other.
afterEach(() => {
  localStorage.clear();
});
