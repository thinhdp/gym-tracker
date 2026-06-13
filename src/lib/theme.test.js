import { resolveDark, applyTheme, THEME_OPTIONS } from "./theme";

/** Stub window.matchMedia to report a fixed system preference. */
function stubSystem(prefersDark) {
  window.matchMedia = (query) => ({
    matches: prefersDark && query.includes("dark"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("resolveDark", () => {
  it("honors explicit light/dark regardless of system", () => {
    stubSystem(true);
    expect(resolveDark("light")).toBe(false);
    stubSystem(false);
    expect(resolveDark("dark")).toBe(true);
  });

  it("follows the system preference for 'system'", () => {
    stubSystem(true);
    expect(resolveDark("system")).toBe(true);
    stubSystem(false);
    expect(resolveDark("system")).toBe(false);
  });
});

describe("applyTheme", () => {
  it("toggles the dark class on <html>", () => {
    stubSystem(false);
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

describe("THEME_OPTIONS", () => {
  it("exposes the three preferences", () => {
    expect(THEME_OPTIONS).toEqual(["system", "light", "dark"]);
  });
});
