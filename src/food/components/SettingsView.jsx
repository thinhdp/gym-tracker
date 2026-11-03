import React, { useState } from "react";
import { useConfirm } from "../../components/ConfirmDialog";
import { Button } from "../../components/ui/Button";
import { useFood } from "../context/FoodContext";
import CustomFoodForm from "./CustomFoodForm";
import TargetsEditor from "./TargetsEditor";

function CustomFoodsList() {
  const { customFoods, deleteCustomFood } = useFood();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null);

  const remove = async (food) => {
    const ok = await confirm({
      title: "Delete this custom food?",
      message: `${food.name} will be removed. Entries already logged keep their values.`,
      confirmText: "Delete",
      tone: "destructive",
    });
    if (ok) deleteCustomFood(food.id);
  };

  if (customFoods.length === 0) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        No custom foods yet. Create one from Search.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y rounded-2xl border dark:divide-neutral-800 dark:border-neutral-800">
        {customFoods.map((food) => (
          <li
            key={food.id}
            className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
          >
            <div className="min-w-0">
              <div className="break-words font-medium">{food.name}</div>
              <div className="text-neutral-600 dark:text-neutral-400">
                {`${food.per100.kcal} kcal / 100 g`}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                aria-label={`Edit ${food.name}`}
                onClick={() => setEditing(food)}
              >
                Edit
              </Button>
              <Button
                size="sm"
                aria-label={`Delete ${food.name}`}
                onClick={() => remove(food)}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <CustomFoodForm
          key={editing.id}
          initial={editing}
          onSaved={() => setEditing(null)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

export default function SettingsView() {
  return (
    <div className="space-y-6">
      <section aria-labelledby="settings-targets" className="space-y-3">
        <h2 id="settings-targets" className="text-lg font-semibold">
          Targets
        </h2>
        <TargetsEditor />
      </section>
      <section aria-labelledby="settings-custom-foods" className="space-y-3">
        <h2 id="settings-custom-foods" className="text-lg font-semibold">
          Custom foods
        </h2>
        <CustomFoodsList />
      </section>
      <a href="/" className="text-sm text-blue-600 dark:text-blue-400">
        Back to Gym
      </a>
    </div>
  );
}
