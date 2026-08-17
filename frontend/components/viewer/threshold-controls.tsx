"use client";

import { useEffect, useState } from "react";
import { Filter, X } from "lucide-react";

import type { Threshold, ThresholdOperator } from "@/types/datasets";

const operators: ThresholdOperator[] = [">", ">=", "<", "<=", "=="];

export function ThresholdControls({
  field,
  threshold,
  onApply,
  onClear,
}: {
  field: string;
  threshold: Threshold | null;
  onApply: (threshold: Threshold) => void;
  onClear: () => void;
}) {
  const [operator, setOperator] = useState<ThresholdOperator>(">");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (threshold?.field === field) {
      setOperator(threshold.operator);
      setValue(String(threshold.value));
    } else {
      setValue("");
    }
  }, [field, threshold]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-h-10 items-center rounded-lg border border-slate-700 bg-slate-900">
        <span className="pl-3 text-slate-500"><Filter size={14} /></span>
        <select
          aria-label="Threshold operator"
          className="h-10 bg-transparent px-2 text-sm text-slate-200 outline-none"
          onChange={(event) => setOperator(event.target.value as ThresholdOperator)}
          value={operator}
        >
          {operators.map((item) => <option className="bg-slate-900" key={item}>{item}</option>)}
        </select>
        <input
          aria-label="Threshold value"
          className="h-10 w-24 border-l border-slate-700 bg-transparent px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600"
          inputMode="decimal"
          onChange={(event) => setValue(event.target.value)}
          placeholder="value"
          type="number"
          value={value}
        />
      </div>
      <button
        className="min-h-10 rounded-lg bg-teal-400 px-3 text-xs font-bold text-slate-950 hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!value || !Number.isFinite(Number(value))}
        onClick={() => onApply({ field, operator, value: Number(value) })}
        type="button"
      >
        Apply threshold
      </button>
      {threshold && (
        <button
          className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-400 hover:text-white"
          onClick={onClear}
          type="button"
        >
          <X size={14} /> Clear
        </button>
      )}
    </div>
  );
}
