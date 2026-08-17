import { Crosshair, StepBack, StepForward } from "lucide-react";

import { formatNumber } from "@/lib/visualization";
import type { SelectedPoint } from "@/types/datasets";
import { Panel } from "@/components/ui/panel";

export function ProbePanel({
  point,
  onStep,
}: {
  point: SelectedPoint | null;
  onStep: (direction: -1 | 1) => void;
}) {
  return (
    <Panel
      action={
        <div className="flex items-center gap-1">
          <button aria-label="Previous sampled point" className="grid h-9 w-9 place-items-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => onStep(-1)} type="button"><StepBack size={15} /></button>
          <button aria-label="Next sampled point" className="grid h-9 w-9 place-items-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => onStep(1)} type="button"><StepForward size={15} /></button>
        </div>
      }
      eyebrow="Selection"
      title="Point probe"
    >
      {point ? (
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Coordinates · row {point.rowIndex}</p>
            <dl className="space-y-1.5 text-sm">
              {Object.entries(point.location).map(([axis, value]) => (
                <div className="flex justify-between gap-4" key={axis}><dt className="uppercase text-slate-500">{axis}</dt><dd className="font-mono text-slate-200">{formatNumber(value)}</dd></div>
              ))}
            </dl>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Scalar values</p>
            <dl className="max-h-28 space-y-1.5 overflow-auto text-sm">
              {Object.entries(point.values).map(([field, value]) => (
                <div className="flex justify-between gap-4" key={field}><dt className="truncate text-slate-500">{field}</dt><dd className="font-mono text-slate-200">{formatNumber(value)}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      ) : (
        <div className="flex min-h-32 items-center gap-3 p-4 text-sm text-slate-500"><Crosshair size={18} /> Select a point in the viewer to inspect exact values.</div>
      )}
    </Panel>
  );
}
