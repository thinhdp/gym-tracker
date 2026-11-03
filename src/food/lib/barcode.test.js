import {
  BARCODE_FORMATS,
  NATIVE_POLL_MS,
  createDetector,
  isValidBarcode,
  pickStrategy,
} from "./barcode";

const zx = vi.hoisted(() => ({
  instances: [],
  controlsPromise: null,
}));

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: class {
    constructor(hints) {
      this.hints = hints;
      this.callback = null;
      zx.instances.push(this);
    }
    decodeFromVideoElement(video, callback) {
      this.video = video;
      this.callback = callback;
      return zx.controlsPromise;
    }
  },
}));

vi.mock("@zxing/library", () => ({
  BarcodeFormat: { EAN_13: 7, EAN_8: 6, UPC_A: 14, UPC_E: 15 },
  DecodeHintType: { POSSIBLE_FORMATS: 2 },
}));

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
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the first rawValue on a hit and passes BARCODE_FORMATS", async () => {
    const { win, calls } = fakeWindow([
      { rawValue: "5000112637922" },
      { rawValue: "12345678" },
    ]);
    const detector = await createDetector("native", win);
    expect(calls).toEqual([{ formats: BARCODE_FORMATS }]);
    await expect(detector.detectOnce({})).resolves.toBe("5000112637922");
  });

  it("does not resolve on a miss; it keeps waiting", async () => {
    vi.useFakeTimers();
    const { win } = fakeWindow([]);
    const detector = await createDetector("native", win);
    let settled = false;
    detector.detectOnce({}).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(NATIVE_POLL_MS * 5);
    expect(settled).toBe(false);
    detector.stop();
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

describe("createDetector native polling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const sequence = (results) => {
    let i = 0;
    const calls = { count: 0 };
    const { win } = fakeWindow(() => {
      calls.count += 1;
      const next = results[Math.min(i, results.length - 1)];
      i += 1;
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next);
    });
    return { win, calls };
  };

  it("polls past two misses and resolves with the code", async () => {
    vi.useFakeTimers();
    const { win, calls } = sequence([[], [], [{ rawValue: "5000112637922" }]]);
    const detector = await createDetector("native", win);
    const pending = detector.detectOnce({});
    await vi.advanceTimersByTimeAsync(NATIVE_POLL_MS * 2);
    await expect(pending).resolves.toBe("5000112637922");
    expect(calls.count).toBe(3);
  });

  it("retries after detect() rejects instead of throwing", async () => {
    vi.useFakeTimers();
    const { win } = sequence([
      new Error("not ready"),
      [{ rawValue: "12345678" }],
    ]);
    const detector = await createDetector("native", win);
    const pending = detector.detectOnce({});
    await vi.advanceTimersByTimeAsync(NATIVE_POLL_MS);
    await expect(pending).resolves.toBe("12345678");
  });

  it("resolves null when stop() is called during polling", async () => {
    vi.useFakeTimers();
    const { win, calls } = sequence([[]]);
    const detector = await createDetector("native", win);
    const pending = detector.detectOnce({});
    await vi.advanceTimersByTimeAsync(NATIVE_POLL_MS * 2);
    detector.stop();
    await expect(pending).resolves.toBeNull();
    const before = calls.count;
    await vi.advanceTimersByTimeAsync(NATIVE_POLL_MS * 5);
    expect(calls.count).toBe(before);
    await expect(detector.detectOnce({})).resolves.toBeNull();
  });

  it("returns the same pending promise to a second detectOnce", async () => {
    vi.useFakeTimers();
    const { win } = sequence([[]]);
    const detector = await createDetector("native", win);
    const first = detector.detectOnce({});
    expect(detector.detectOnce({})).toBe(first);
    detector.stop();
    await expect(first).resolves.toBeNull();
  });
});

describe("createDetector zxing", () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const fakeControls = () => ({ stop: vi.fn() });
  const fakeResult = (text) => ({ getText: () => text });

  beforeEach(() => {
    zx.instances.length = 0;
  });

  it("builds the reader with hints for the EAN/UPC formats only", async () => {
    zx.controlsPromise = Promise.resolve(fakeControls());
    await createDetector("zxing");
    expect(zx.instances).toHaveLength(1);
    const { hints } = zx.instances[0];
    expect(hints).toBeInstanceOf(Map);
    expect([...hints.keys()]).toEqual([2]);
    expect(hints.get(2)).toEqual([7, 6, 14, 15]);
  });

  it("resolves with getText() on a result and stops the controls", async () => {
    const controls = fakeControls();
    zx.controlsPromise = Promise.resolve(controls);
    const detector = await createDetector("zxing");
    const video = {};
    const pending = detector.detectOnce(video);
    await flush();
    const reader = zx.instances[0];
    expect(reader.video).toBe(video);
    reader.callback(undefined, new Error("miss"), controls);
    reader.callback(fakeResult("5000112637922"), undefined, controls);
    await expect(pending).resolves.toBe("5000112637922");
    expect(controls.stop).toHaveBeenCalled();
  });

  it("stop() before a result resolves null and stops the controls", async () => {
    const controls = fakeControls();
    zx.controlsPromise = Promise.resolve(controls);
    const detector = await createDetector("zxing");
    const pending = detector.detectOnce({});
    await flush();
    detector.stop();
    await expect(pending).resolves.toBeNull();
    expect(controls.stop).toHaveBeenCalled();
    await expect(detector.detectOnce({})).resolves.toBeNull();
  });

  it("stops controls that arrive after stop()", async () => {
    const controls = fakeControls();
    let deliver;
    zx.controlsPromise = new Promise((resolve) => {
      deliver = resolve;
    });
    const detector = await createDetector("zxing");
    const pending = detector.detectOnce({});
    detector.stop();
    await expect(pending).resolves.toBeNull();
    expect(controls.stop).not.toHaveBeenCalled();
    deliver(controls);
    await flush();
    expect(controls.stop).toHaveBeenCalled();
  });
});
