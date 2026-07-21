import React, { useState } from "react";
import { Input } from "./ui/Input";

/**
 * Clears the default 0 on mobile when focusing a number input.
 * With `blankZero`, a zero value renders empty even unfocused, so the
 * `placeholder` is visible as a hint.
 */
export default function NumberInputAutoClear({
  valueNumber,
  onNumberChange,
  step = "1",
  min = "0",
  placeholder = "0",
  className = "",
  blankZero = false,
}) {
  const [clear, setClear] = useState(false);
  const isZero =
    valueNumber === 0 ||
    valueNumber === "0" ||
    valueNumber === "" ||
    valueNumber == null;
  // `clear` blanks a zero only while focused; `blankZero` blanks it always, so
  // a placeholder (e.g. a recommended rep count) can show through.
  const display = (clear || blankZero) && isZero ? "" : valueNumber;
  return (
    <Input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      placeholder={placeholder}
      className={className}
      value={display}
      onFocus={(e) => {
        if (Number(e.target.value || 0) === 0) setClear(true);
        else {
          try {
            e.target.select?.();
          } catch {}
        }
      }}
      onBlur={() => setClear(false)}
      onChange={(e) => {
        const raw = e.target.value;
        const num = raw === "" ? 0 : Number(raw);
        if (Number.isFinite(num)) onNumberChange(num);
      }}
    />
  );
}
