export const SLOTS = [
  { id: "breakfast", label: "Breakfast" },
  { id: "snack1", label: "Morning snack" },
  { id: "lunch", label: "Lunch" },
  { id: "snack2", label: "Afternoon snack" },
  { id: "dinner", label: "Dinner" },
  { id: "snack3", label: "Evening snack" },
];

export const SLOT_IDS = SLOTS.map((slot) => slot.id);

export const slotLabel = (id) => SLOTS.find((slot) => slot.id === id)?.label;

/** The slot a meal logged at this local time belongs to. */
export const slotForTime = (date = new Date()) => {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes < 10 * 60) return "breakfast";
  if (minutes < 11 * 60 + 30) return "snack1";
  if (minutes < 14 * 60) return "lunch";
  if (minutes < 17 * 60) return "snack2";
  if (minutes < 20 * 60 + 30) return "dinner";
  return "snack3";
};
