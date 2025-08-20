import React from "react";

export function Input(props) {
  return <input className="border rounded-xl px-3 py-1.5 text-sm w-full" {...props} />;
}
export function Textarea(props) {
  return <textarea className="border rounded-xl px-3 py-1.5 text-sm w-full" {...props} />;
}
