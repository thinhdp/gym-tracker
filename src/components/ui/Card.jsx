import React from "react";

export function Card({ children, className = "" }) {
  return <div className={`bg-white shadow border rounded-2xl ${className}`}>{children}</div>;
}
export function CardContent({ children, className = "" }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
