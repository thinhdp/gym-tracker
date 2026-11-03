import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { createDetector, isValidBarcode, pickStrategy } from "../lib/barcode";

/** Stop the detector and every camera track of one scan session, once. */
function teardown(session) {
  if (session.stopped) return;
  session.stopped = true;
  session.detector?.stop();
  session.stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Bottom sheet that reads a barcode from the rear camera. Without a camera,
 * or when the camera or the detector fails, it shows a manual code field.
 */
export default function BarcodeScanner({ onDetected, onCancel }) {
  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const [fallback, setFallback] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    // One session per mount; every check after an await reads it again.
    const session = { stopped: false, stream: null, detector: null };
    sessionRef.current = session;

    const showFallback = () => {
      if (session.stopped) return;
      teardown(session);
      setFallback(true);
    };

    const run = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        showFallback();
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (session.stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        session.stream = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        Promise.resolve(video.play()).catch(() => {});

        const detector = await createDetector(pickStrategy());
        if (session.stopped) {
          detector.stop();
          return;
        }
        session.detector = detector;

        for (;;) {
          const found = await detector.detectOnce(video);
          if (session.stopped || found === null) return;
          if (isValidBarcode(found)) {
            onDetectedRef.current(found);
            return;
          }
        }
      } catch {
        showFallback();
      }
    };

    run();
    return () => teardown(session);
  }, []);

  const cancel = () => {
    if (sessionRef.current) teardown(sessionRef.current);
    onCancel();
  };

  const submitCode = () => {
    const trimmed = code.trim();
    if (!isValidBarcode(trimmed)) {
      setCodeError("Enter 8 to 14 digits");
      return;
    }
    setCodeError(null);
    onDetected(trimmed);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan barcode"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
    >
      <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl dark:bg-neutral-900 dark:text-neutral-100">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold">Scan barcode</h2>
          <Button type="button" variant="ghost" size="sm" onClick={cancel}>
            Cancel
          </Button>
        </div>

        {fallback ? (
          <div className="space-y-2">
            <p className="text-sm">Camera unavailable</p>
            <label className="block text-sm">
              <span className="mb-1 block">Barcode</span>
              <Input
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            {codeError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {codeError}
              </p>
            )}
            <Button type="button" onClick={submitCode}>
              Use
            </Button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full rounded-xl bg-black"
          />
        )}
      </div>
    </div>
  );
}
