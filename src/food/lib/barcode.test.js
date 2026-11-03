import {
  BARCODE_FORMATS,
  createDetector,
  isValidBarcode,
  pickStrategy,
} from "./barcode";

const fakeWindow = (result) => {
  const calls = [];
  class BarcodeDetector {
    constructor(opts) {
      calls.push(opts);
    }
    detect() {
      return typeof result === "function" ? result() : Promise.resolve(result);
    }
  }
  return { win: { BarcodeDetector }, calls };
};

describe("pickStrategy", () => {
  it("pickStrategy returns native when BarcodeDetector exists, else zxing", () => {
    expect(pickStrategy({ BarcodeDetector: class {} })).toBe("native");
    expect(pickStrategy({})).toBe("zxing");
    expect(pickStrategy(window)).toBe("zxing");
  });
});

describe("isValidBarcode", () => {
  it("isValidBarcode accepts 8–14 digits only", () => {
    expect(isValidBarcode("12345678")).toBe(true);
    expect(isValidBarcode("12345678901234")).toBe(true);
    expect(isValidBarcode("5000112637922")).toBe(true);
    expect(isValidBarcode("1234567")).toBe(false);
    expect(isValidBarcode("123456789012345")).toBe(false);
    expect(isValidBarcode("12345678a")).toBe(false);
    expect(isValidBarcode(" 12345678")).toBe(false);
    expect(isValidBarcode("")).toBe(false);
  });
});

describe("createDetector native", () => {
  it("returns the first rawValue on a hit and passes BARCODE_FORMATS", async () => {
    const { win, calls } = fakeWindow([
      { rawValue: "5000112637922" },
      { rawValue: "12345678" },
    ]);
    const detector = await createDetector("native", win);
    expect(calls).toEqual([{ formats: BARCODE_FORMATS }]);
    await expect(detector.detectOnce({})).resolves.toBe("5000112637922");
  });

  it("returns null when detect finds nothing", async () => {
    const { win } = fakeWindow([]);
    const detector = await createDetector("native", win);
    await expect(detector.detectOnce({})).resolves.toBeNull();
  });

  it("returns null for a result that resolves after stop()", async () => {
    let resolveDetect;
    const { win } = fakeWindow(
      () =>
        new Promise((resolve) => {
          resolveDetect = resolve;
        }),
    );
    const detector = await createDetector("native", win);
    const pending = detector.detectOnce({});
    expect(() => detector.stop()).not.toThrow();
    resolveDetect([{ rawValue: "5000112637922" }]);
    await expect(pending).resolves.toBeNull();
  });
});
