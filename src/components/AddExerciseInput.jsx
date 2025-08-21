import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { ChevronDown, ListPlus } from "./ui/Icons";

export default function AddExerciseInput({ allExercises, onAdd }) {
  const [val, setVal] = useState(""); const [open, setOpen] = useState(false); const ref = useRef(null);
  const options = useMemo(() => {
    const q = val.trim().toLowerCase();
    const filtered = allExercises.filter((e) => {
      if (!q) return true;
      const hay = [e.name, e.mainMuscle, e.secondaryMuscles, e.type, e.equipment, e.force].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
    const seen = new Set(), list = [];
    for (const e of filtered) { const key=(e.name||"").toLowerCase(); if(!seen.has(key)&&e.name){ seen.add(key); list.push(e);} if(list.length>=12) break; }
    const exact = allExercises.some((e)=> (e.name||"").toLowerCase()===q);
    if (q && !exact) list.unshift({ name: val, _isNew: true });
    return list;
  }, [val, allExercises]);

  useEffect(() => { const onClick = (e)=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener("click", onClick); return ()=>window.removeEventListener("click", onClick); }, []);

  const choose = (opt) => { const name = opt.name || ""; if(!name.trim()) return; onAdd(name); setVal(""); setOpen(false); };

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2">
        <Input placeholder="Search by name, type, muscle, equipment…" value={val}
               onChange={(e)=>{ setVal(e.target.value); setOpen(true); }} onFocus={()=>setOpen(true)} />
        <Button variant="primary" onClick={()=>choose({ name: val, _isNew: true })}><ListPlus /> Add</Button>
      </div>
      {open && options.length>0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-white shadow">
          {options.map((o,i)=>(
            <button key={(o.name||"")+i} onClick={()=>choose(o)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50">
              <span className="flex flex-col">
                <span className="font-medium">{o._isNew ? `${o.name} (new)` : o.name}</span>
                {!o._isNew && <span className="text-xs text-neutral-600">{(o.type||"—")} • {(o.equipment||"—")} • {(o.mainMuscle||"—")}</span>}
              </span>
              <ChevronDown />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
