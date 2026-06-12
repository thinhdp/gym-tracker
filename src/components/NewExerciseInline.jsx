import React, { useMemo, useState } from "react";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import ComboInput from "./ui/ComboInput";

/**
 * Inline form to create a new exercise. Collects various attributes
 * such as recommended reps, muscle groups, type, etc.
 *
 * Props:
 * - existing (array)   Current exercises, used for the unique-name check.
 * - options (object)   Combo suggestions from extractExerciseOptions().
 * - onCreate (fn)      Called with the new exercise object on save.
 */
export default function NewExerciseInline({ existing, options, onCreate }) {
  const [name, setName] = useState("");
  const [rep, setRep] = useState("");
  const [mainMuscle, setMainMuscle] = useState("");
  const [secondaryMuscles, setSecondaryMuscles] = useState("");
  const [type, setType] = useState("");
  const [equipment, setEquipment] = useState("");
  const [force, setForce] = useState("");

  const {
    mainOptions,
    secondaryOptions,
    typeOptions,
    equipmentOptions,
    forceOptions,
  } = options;

  const isUnique = useMemo(
    () =>
      name.trim() &&
      !existing.some(
        (e) =>
          e.name.trim().toLowerCase() === name.trim().toLowerCase()
      ),
    [existing, name]
  );
  const resetFields = () => {
    setName("");
    setRep("");
    setMainMuscle("");
    setSecondaryMuscles("");
    setType("");
    setEquipment("");
    setForce("");
  };
  const handleSave = () => {
    if (!isUnique) return;
    onCreate({
      name: name.trim(),
      recommendRep: rep.trim(),
      mainMuscle: mainMuscle.trim(),
      secondaryMuscles: secondaryMuscles.trim(),
      type: type.trim(),
      equipment: equipment.trim(),
      force: force.trim(),
      lastWorkout: null,
    });
    resetFields();
  };

  return (
    <div className="mt-3 space-y-2 p-3 rounded-xl border bg-neutral-50">
      <div className="grid sm:grid-cols-2 gap-2">
        <Input
          placeholder="Exercise name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Recommend rep (e.g., 3x8-12)"
          value={rep}
          onChange={(e) => setRep(e.target.value)}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <ComboInput
          placeholder="Main Muscle"
          value={mainMuscle}
          onChange={setMainMuscle}
          options={mainOptions}
        />
        <ComboInput
          placeholder="Secondary Muscles (comma-separated allowed)"
          value={secondaryMuscles}
          onChange={setSecondaryMuscles}
          options={secondaryOptions}
        />
        <ComboInput
          placeholder="Type"
          value={type}
          onChange={setType}
          options={typeOptions}
        />
        <ComboInput
          placeholder="Equipment"
          value={equipment}
          onChange={setEquipment}
          options={equipmentOptions}
        />
        <ComboInput
          placeholder="Force (text)"
          value={force}
          onChange={setForce}
          options={forceOptions}
        />
      </div>
      {!isUnique && name && (
        <p className="text-sm text-red-600">
          An exercise with this name already exists.
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={resetFields}>
          Reset
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!isUnique}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
