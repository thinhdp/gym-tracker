import React from "react";

export function Card({ children, className = "" }) {
  // Use a light gradient to better distinguish stacked cards
  return (
    <div
      className={`bg-gradient-to-b from-white to-neutral-100 shadow border rounded-2xl ${className}`}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className = "" }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
