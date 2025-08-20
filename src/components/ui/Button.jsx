import React from "react";

export function Button({ children, variant = "secondary", size = "md", className = "", ...props }) {
  const base = "inline-flex items-center justify-center rounded-xl text-sm transition active:scale-[0.99] focus:outline-none";
  const sizes = { md: "px-3 py-1.5", sm: "px-2 py-1 text-xs", icon: "p-2" };
  const variants = {
    primary: "border border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
    secondary: "border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900",
    ghost: "border-transparent bg-transparent hover:bg-neutral-100 text-neutral-800",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
