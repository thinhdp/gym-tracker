import React from "react";
export function Badge({ children, className="" }) { return <span className={`px-2 py-0.5 text-xs border rounded-xl ${className}`}>{children}</span>; }
