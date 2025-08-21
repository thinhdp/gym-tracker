import React, { useMemo } from "react";
/** Datalist-backed input: pick from suggestions or type free text */
export default function ComboInput({ value, onChange, options=[], placeholder="", id }) {
  const listId = useMemo(() => id || `dl-${Math.random().toString(36).slice(2)}`, [id]);
  const uniq = useMemo(() => {
    const set=new Set(), out=[];
    for (const o of options){ const v=String(o||"").trim(); if(!v) continue; const k=v.toLowerCase(); if(!set.has(k)){ set.add(k); out.push(v);} if(out.length>=500) break; }
    return out;
  }, [options]);
  return (
    <>
      <input list={listId} className="border rounded-xl px-3 py-1.5 text-sm w-full"
             value={value} placeholder={placeholder} onChange={(e)=>onChange(e.target.value)} />
      <datalist id={listId}>{uniq.map((opt)=><option key={opt} value={opt} />)}</datalist>
    </>
  );
}
