import React, { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * Searchable select: click the caret (or focus) to drop down the full list,
 * type to filter it, then pick with the mouse or keyboard. Unlike the native
 * <datalist> in ComboInput, the popup is rendered by us, so "show everything"
 * and "filter as I type" both work consistently across browsers.
 *
 * Controlled via value/onChange (the committed string). Free text is allowed —
 * typing a value that isn't in `options` is fine, it just won't match a row.
 */
export default function Combobox({
  value,
  onChange,
  options = [],
  placeholder = "",
  id,
}) {
  const autoId = useId();
  const listId = id || `cb-${autoId}`;
  const [open, setOpen] = useState(false);
  // When true the popup ignores the current value and shows every option (set
  // on focus / caret click). The first keystroke flips it off so typing filters.
  const [showAll, setShowAll] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const uniq = useMemo(() => {
    const set = new Set();
    const out = [];
    for (const o of options) {
      const v = String(o || "").trim();
      if (!v) continue;
      const k = v.toLowerCase();
      if (!set.has(k)) {
        set.add(k);
        out.push(v);
      }
      if (out.length >= 500) break;
    }
    return out;
  }, [options]);

  const q = String(value || "")
    .trim()
    .toLowerCase();
  const filtered = useMemo(
    () =>
      showAll || !q ? uniq : uniq.filter((o) => o.toLowerCase().includes(q)),
    [uniq, q, showAll],
  );

  // Close when focus/click leaves the component.
  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, [open]);

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    if (!open || active < 0 || !listRef.current) return;
    const el = listRef.current.children[active];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const openList = (all) => {
    setShowAll(all);
    setActive(-1);
    setOpen(true);
  };

  const select = (opt) => {
    onChange(opt);
    setOpen(false);
    setShowAll(false);
    setActive(-1);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return openList(showAll);
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList(showAll);
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && active < filtered.length) {
        e.preventDefault();
        select(filtered[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className="w-full rounded-xl border bg-white px-3 py-1.5 pr-9 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-500"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setShowAll(false);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => openList(true)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? "Hide options" : "Show all options"}
        className="absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openList(true);
            inputRef.current?.focus();
          }
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && filtered.length > 0 && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-white py-1 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          {filtered.map((opt, i) => {
            const isActive = i === active;
            const isSelected = opt === value;
            return (
              <li
                key={opt}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(opt);
                }}
                className={[
                  "cursor-pointer px-3 py-1.5",
                  isActive
                    ? "bg-neutral-100 dark:bg-neutral-800"
                    : "text-neutral-700 dark:text-neutral-200",
                  isSelected ? "font-medium" : "",
                ].join(" ")}
              >
                {opt}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
