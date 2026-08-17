"use client";

import { Box, CircleDot, RotateCcw, Triangle } from "lucide-react";

import type { Representation } from "@/types/datasets";

const representations: Array<{ value: Representation; label: string; icon: typeof Box }> = [
  { value: "points", label: "Points", icon: CircleDot },
  { value: "surface", label: "Surface", icon: Triangle },
  { value: "wireframe", label: "Wire", icon: Box },
];

export function ViewerControls({
  representation,
  onRepresentationChange,
  onReset,
  showRepresentation,
}: {
  representation: Representation;
  onRepresentationChange: (value: Representation) => void;
  onReset: () => void;
  showRepresentation: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/90 p-1">
      {showRepresentation &&
        representations.map(({ value, label, icon: Icon }) => (
          <button
            aria-pressed={representation === value}
            className={`flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
              representation === value ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
            }`}
            key={value}
            onClick={() => onRepresentationChange(value)}
            type="button"
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      <button
        className="flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        onClick={onReset}
        type="button"
      >
        <RotateCcw size={14} /> Reset
      </button>
    </div>
  );
}
