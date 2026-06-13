import React from "react";

export function Card({ children, className = "" }) {
  // Use a light gradient to better distinguish stacked cards
  return (
    <div
      className={`bg-gradient-to-b from-white to-neutral-100 dark:from-neutral-900 dark:to-neutral-900 dark:border-neutral-800 shadow border rounded-2xl ${className}`}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className = "" }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
