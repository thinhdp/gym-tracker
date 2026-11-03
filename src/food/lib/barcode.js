// Barcode detection: the native BarcodeDetector API when the browser has it,
// else @zxing/browser, loaded on demand so it stays out of the main bundle.
// Camera streams are owned and stopped by the calling component.

export const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

export function pickStrategy(win = window) {
  return "BarcodeDetector" in win ? "native" : "zxing";
}

export function isValidBarcode(code) {
  return /^\d{8,14}$/.test(code);
}

async function createNativeDetector(win) {
  const detector = new win.BarcodeDetector({ formats: BARCODE_FORMATS });
  let stopped = false;
  return {
    async detectOnce(videoEl) {
      if (stopped) return null;
      const found = await detector.detect(videoEl);
      if (stopped) return null;
      return found.length > 0 ? found[0].rawValue : null;
    },
    stop() {
      stopped = true;
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
  return {
    async detectOnce(videoEl) {
      if (stopped) return null;
      const result = await reader.decodeOnceFromVideoElement(videoEl);
      if (stopped) return null;
      return result ? result.getText() : null;
    },
    stop() {
      stopped = true;
    },
  };
}

export async function createDetector(strategy, win = window) {
  return strategy === "native"
    ? createNativeDetector(win)
    : createZxingDetector();
}
