import React, { useState } from "react";
import { useConfirm } from "../../components/ConfirmDialog";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useFood } from "../context/FoodContext";
import { todayLocal } from "../lib/localDate";
import { kcalFromMacros } from "../lib/macros";
import { targetForDate, validateTarget } from "../lib/targets";

// Form fields hold strings; an empty or blank field is NaN so validation blocks it.
const toNumber = (s) => (s.trim() === "" ? NaN : Number(s));
const asField = (n) => String(n);

const FIELDS = [
  ["kcal", "Calories"],
  ["protein", "Protein (g)"],
  ["carb", "Carbs (g)"],
  ["fat", "Fat (g)"],
];

export default function TargetsEditor() {
  const { targets, upsertTarget, deleteTarget } = useFood();
  const confirm = useConfirm();

  const [form, setForm] = useState(() => {
    const current = targetForDate(targets, todayLocal());
    return {
      kcal: current ? asField(current.kcal) : "",
      protein: current ? asField(current.protein) : "",
      carb: current ? asField(current.carb) : "",
      fat: current ? asField(current.fat) : "",
      from: todayLocal(),
    };
  });

  const setField = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const row = {
    from: form.from,
    kcal: toNumber(form.kcal),
    protein: toNumber(form.protein),
    carb: toNumber(form.carb),
    fat: toNumber(form.fat),
  };
  const messages = validateTarget(row);
  const finite = (n) => (Number.isFinite(n) ? n : 0);
  const implied = kcalFromMacros({
    protein: finite(row.protein),
    carb: finite(row.carb),
    fat: finite(row.fat),
  });

  const save = () => {
    if (messages.length > 0) return;
    upsertTarget(row);
  };

  const edit = (t) =>
    setForm({
      kcal: asField(t.kcal),
      protein: asField(t.protein),
      carb: asField(t.carb),
      fat: asField(t.fat),
      from: t.from,
    });

  const remove = async (t) => {
    const ok = await confirm({
      title: "Delete this target?",
      message: `The target from ${t.from} will be removed.`,
      confirmText: "Delete",
      tone: "destructive",
    });
    if (ok) deleteTarget(t.from);
  };

  const history = [...targets].sort((a, b) =>
    a.from < b.from ? 1 : a.from > b.from ? -1 : 0,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="mb-1 block">{label}</span>
            <Input
              type="number"
              inputMode="decimal"
              value={form[key]}
              onChange={setField(key)}
            />
          </label>
        ))}
        <label className="col-span-2 block text-sm">
          <span className="mb-1 block">Applies from</span>
          <Input type="date" value={form.from} onChange={setField("from")} />
        </label>
      </div>
      <div className="text-sm text-neutral-600 dark:text-neutral-400">
        Macros imply {implied} kcal
      </div>
      {messages.length > 0 && (
        <ul className="text-sm text-red-600 dark:text-red-400">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      <Button variant="primary" onClick={save} disabled={messages.length > 0}>
        Save
      </Button>
      {history.length > 0 && (
        <ul className="divide-y rounded-2xl border dark:divide-neutral-800 dark:border-neutral-800">
          {history.map((t) => (
            <li
              key={t.from}
              className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium">{t.from}</div>
                <div className="text-neutral-600 dark:text-neutral-400">
                  {t.kcal} kcal / P {t.protein} / C {t.carb} / F {t.fat}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => edit(t)}>
                  Edit {t.from}
                </Button>
                <Button size="sm" onClick={() => remove(t)}>
                  Delete {t.from}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
