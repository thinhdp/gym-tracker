import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/Button";

/** A short message fixed above the bottom nav. Calls onDone once its time is up. */
export default function Toast({
  message,
  actionLabel,
  onAction,
  onDone,
  durationMs = 3000,
}) {
  // Read when the timer fires, so a new onDone does not restart the timer.
  const latestOnDone = useRef(onDone);
  useEffect(() => {
    latestOnDone.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timer = setTimeout(() => latestOnDone.current?.(), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-neutral-900 px-3 py-2 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
      >
        <span className="min-w-0 break-words">{message}</span>
        {actionLabel && (
          <Button type="button" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
