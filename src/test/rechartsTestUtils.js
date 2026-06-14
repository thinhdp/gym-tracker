import { cloneElement } from "react";

/**
 * Recharts' ResponsiveContainer measures its parent with ResizeObserver; under
 * jsdom that measurement lands a render too late and the chart's lines never
 * mount. Tests mock the container to a fixed size so the child chart renders
 * synchronously.
 *
 * Usage (must be at the top of a test file — vi.mock is hoisted):
 *
 *   vi.mock("recharts", async (importOriginal) => {
 *     const { withFixedResponsiveContainer } = await import(
 *       "../test/rechartsTestUtils"
 *     );
 *     return withFixedResponsiveContainer(await importOriginal());
 *   });
 */
export function withFixedResponsiveContainer(
  actual,
  width = 800,
  height = 300,
) {
  return {
    ...actual,
    ResponsiveContainer: ({ children, height: h = height }) =>
      cloneElement(children, { width, height: h }),
  };
}
