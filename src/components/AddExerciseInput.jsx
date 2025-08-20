import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { ChevronDown, ListPlus } from "./ui/Icons";

export default function AddExerciseInput({ allExercises, onAdd }) {
  const [val, setVal] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const options = useMemo(() => {
    const q = val.trim().toLowerCase();
    const list = allExercises
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((e) => e.name);
    const exact = allExercises.some((e) => e.name.toLowerCase() === q);
    if (q && !exact && !list.includes(val)) list.unshift(`${val} (new)`);
    return list;
  }, [val, allExercises]);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const choose = (opt) => {
    const isNew = opt.endsWith(" (new)");
    const name = isNew ? opt.replace(" (new)", "") : opt;
    onAdd(name);
    setVal("");
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add exercise by name (auto-suggest)"
          value={val}
          onChange={(e) => { setVal(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        <Button variant="primary" onClick={() => choose(val || "")}><ListPlus /> Add</Button>
      </div>
      {open && options.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow">
          {options.map((o) => (
            <button
              key={o}
              onClick={() => choose(o)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50"
            >
              <span>{o}</span>
              <ChevronDown />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
