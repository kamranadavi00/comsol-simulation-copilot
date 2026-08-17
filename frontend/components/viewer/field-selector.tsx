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
    <label className="flex w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 sm:w-auto sm:min-w-48">
      <Layers3 className="text-teal-400" size={16} />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Field</span>
      <select
        aria-label="Active scalar field"
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none"
        onChange={(event) => onChange(event.target.value)}
        value={activeField}
      >
        {fields.map((field) => (
          <option className="bg-slate-900" key={field} value={field}>
            {field}
          </option>
        ))}
      </select>
    </label>
  );
}
