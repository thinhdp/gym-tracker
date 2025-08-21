import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const ConfirmContext = createContext(null);

/** Wrap your app with <ConfirmProvider> (see main.jsx). */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    title: "",
    message: "",
    confirmText: "Delete",
    cancelText: "Cancel",
    tone: "destructive", // 'destructive' | 'default'
    resolve: null,
  });

  const ask = useCallback((opts) => {
    return new Promise((resolve) => {
      setState((prev) => ({ ...prev, open: true, resolve, ...opts }));
    });
  }, []);

  const onCancel = useCallback(() => {
    state.resolve && state.resolve(false);
    setState((prev) => ({ ...prev, open: false, resolve: null }));
  }, [state.resolve]);

  const onConfirm = useCallback(() => {
    state.resolve && state.resolve(true);
    setState((prev) => ({ ...prev, open: false, resolve: null }));
  }, [state.resolve]);

  // ESC to cancel
  useEffect(() => {
    const onKey = (e) => { if (!state.open) return; if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.open, onCancel]);

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {state.open && (
        <div className="fixed inset-0 z-[9999]">
          <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-white shadow-xl">
              {/* Header */}
              <div className="flex items-center gap-3 bg-blue-50 px-5 py-4">
                <div className="h-7 w-7 rounded-full bg-blue-600" />
                <div className="text-blue-900 font-semibold">
                  {state.title || "Are you sure?"}
                </div>
              </div>
              {/* Body */}
              <div className="px-5 py-4 text-sm text-neutral-700 whitespace-pre-line">
                {state.message || "This action cannot be undone."}
              </div>
              {/* Footer */}
              <div className="flex justify-end gap-2 px-5 py-4">
                <button
                  onClick={onCancel}
                  className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
                >
                  {state.cancelText || "Cancel"}
                </button>
                <button
                  onClick={onConfirm}
                  className={
                    "inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-sm text-white " +
                    (state.tone === "destructive"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700")
                  }
                >
                  {state.confirmText || "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

/** Call inside components: const confirm = useConfirm(); const ok = await confirm({ ... }); */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}
