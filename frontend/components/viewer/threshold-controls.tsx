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
      <div className="flex min-h-10 items-center rounded-lg border border-[#b9cbd7] bg-white shadow-sm">
        <span className="pl-3 text-[#567184]"><Filter size={14} /></span>
        <select
          aria-label="Threshold operator"
          className="h-10 bg-transparent px-2 text-sm text-[#294b63] outline-none"
          onChange={(event) => setOperator(event.target.value as ThresholdOperator)}
          value={operator}
        >
          {operators.map((item) => <option className="bg-white" key={item}>{item}</option>)}
        </select>
        <input
          aria-label="Threshold value"
          className="h-10 w-24 border-l border-[#d7e2ea] bg-transparent px-3 text-sm text-[#16324a] outline-none placeholder:text-[#8ca0ad]"
          inputMode="decimal"
          onChange={(event) => setValue(event.target.value)}
          placeholder="value"
          type="number"
          value={value}
        />
      </div>
      <button
        className="min-h-10 rounded-lg bg-[#bd5220] px-3 text-xs font-bold text-white shadow-sm hover:bg-[#a94419] focus-visible:ring-2 focus-visible:ring-[#bd5220]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!value || !Number.isFinite(Number(value))}
        onClick={() => onApply({ field, operator, value: Number(value) })}
        type="button"
      >
        Apply threshold
      </button>
      {threshold && (
        <button
          className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[#567184] hover:bg-[#f1f5f8] hover:text-[#a9472d]"
          onClick={onClear}
          type="button"
        >
          <X size={14} /> Clear
        </button>
      )}
    </div>
  );
}
