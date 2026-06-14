import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// jsdom doesn't implement ResizeObserver, which Recharts' ResponsiveContainer
// references. Chart tests mock ResponsiveContainer to a fixed size, but provide
// a no-op here so any other consumer doesn't throw a ReferenceError.
if (typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom's localStorage persists across tests within a file — wipe it so
// AppContext / storage tests can't leak mgym.* keys into each other.
afterEach(() => {
  localStorage.clear();
});
