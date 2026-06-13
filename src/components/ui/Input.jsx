import React from "react";
export function Input(props) {
  return (
    <input
      className="border rounded-xl px-3 py-1.5 text-sm w-full bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100 dark:placeholder-neutral-500"
      {...props}
    />
  );
}
export function Textarea(props) {
  return (
    <textarea
      className="border rounded-xl px-3 py-1.5 text-sm w-full bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100 dark:placeholder-neutral-500"
      {...props}
    />
  );
}
