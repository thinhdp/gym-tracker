// Barcode detection: the native BarcodeDetector API when the browser has it,
// else @zxing/browser, loaded on demand so it stays out of the main bundle.
// Camera streams are owned and stopped by the calling component.

export const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

// Delay between native detect() attempts while no code is in view.
export const NATIVE_POLL_MS = 200;

export function pickStrategy(win = window) {
  return "BarcodeDetector" in win ? "native" : "zxing";
}

export function isValidBarcode(code) {
  return /^\d{8,14}$/.test(code);
}

function createNativeDetector(win) {
  const detector = new win.BarcodeDetector({ formats: BARCODE_FORMATS });
  let stopped = false;
  let pending = null;
  let settle = null;
  let timer = null;

  const finish = (value) => {
    clearTimeout(timer);
    timer = null;
    const done = settle;
    settle = null;
    pending = null;
    if (done) done(value);
  };

  return {
    detectOnce(videoEl) {
      if (stopped) return Promise.resolve(null);
      if (pending) return pending;
      pending = new Promise((resolve) => {
        settle = resolve;
      });
      const attempt = async () => {
        timer = null;
        let found = [];
        try {
          found = await detector.detect(videoEl);
        } catch {
          found = [];
        }
        if (stopped) return;
        if (found && found.length > 0) {
          finish(found[0].rawValue);
          return;
        }
        timer = setTimeout(attempt, NATIVE_POLL_MS);
      };
      attempt();
      return pending;
    },
    stop() {
      stopped = true;
      finish(null);
    },
  };
}

async function createZxingDetector() {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] =
    await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
  const reader = new BrowserMultiFormatReader(hints);
  let stopped = false;
  let pending = null;
  let settle = null;
  let controls = null;

  const finish = (value) => {
    if (controls) controls.stop();
    controls = null;
    const done = settle;
    settle = null;
    pending = null;
    if (done) done(value);
  };

  return {
    detectOnce(videoEl) {
      if (stopped) return Promise.resolve(null);
      if (pending) return pending;
      let fail;
      pending = new Promise((resolve, reject) => {
        settle = resolve;
        fail = reject;
      });
      const mine = pending;
      reader
        .decodeFromVideoElement(videoEl, (result, _error, scanControls) => {
          if (!result || pending !== mine) return;
          controls = scanControls;
          finish(result.getText());
        })
        .then((scanControls) => {
          if (pending === mine) controls = scanControls;
          else scanControls.stop();
        })
        .catch((err) => {
          if (pending !== mine) return;
          settle = null;
          pending = null;
          fail(err);
        });
      return pending;
    },
    stop() {
      stopped = true;
      finish(null);
    },
  };
}

/**
 * Create a barcode detector for the given strategy ("native" or "zxing").
 *
 * The returned detector has one contract in both strategies:
 * - `detectOnce(videoEl)` keeps scanning the playing video element and
 *   resolves with the first decoded barcode string. It never resolves null
 *   on a miss; it waits until a code is found. Calling it again while a scan
 *   is pending returns the same pending promise.
 * - `stop()` ends any scan in progress and resolves the pending
 *   `detectOnce` with null. Every later `detectOnce` resolves null at once.
 *   It does not stop camera tracks; the component that owns the stream does.
 * - zxing only: `detectOnce` rejects if the scanner cannot start on the
 *   element. Native detect() errors are retried, not thrown.
 *
 * @param {"native"|"zxing"} strategy
 * @param {Window} [win] window to read BarcodeDetector from (tests pass a fake)
 * @returns {Promise<{ detectOnce(videoEl: HTMLVideoElement): Promise<string|null>, stop(): void }>}
 */
export async function createDetector(strategy, win = window) {
  return strategy === "native"
    ? createNativeDetector(win)
    : createZxingDetector();
}
