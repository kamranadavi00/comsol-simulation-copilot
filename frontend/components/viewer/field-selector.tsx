"use client";

import { Layers3 } from "lucide-react";

export function FieldSelector({
  fields,
  activeField,
  onChange,
}: {
  fields: string[];
  activeField: string;
  onChange: (field: string) => void;
}) {
  return (
    <label className="flex w-full items-center gap-2 rounded-lg border border-[#b9cbd7] bg-white px-3 py-2 shadow-sm sm:w-auto sm:min-w-48">
      <Layers3 className="text-[#0b7bb5]" size={16} />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#567184]">Field</span>
      <select
        aria-label="Active scalar field"
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#16324a] outline-none"
        onChange={(event) => onChange(event.target.value)}
        value={activeField}
      >
        {fields.map((field) => (
          <option className="bg-white" key={field} value={field}>
            {field}
          </option>
        ))}
      </select>
    </label>
  );
}
