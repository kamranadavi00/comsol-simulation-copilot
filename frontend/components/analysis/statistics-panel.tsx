import { BarChart3 } from "lucide-react";

import { formatNumber } from "@/lib/visualization";
import type { StatisticsResult } from "@/types/datasets";
import { Panel } from "@/components/ui/panel";

export function StatisticsPanel({ statistics, isLoading }: { statistics: StatisticsResult | null; isLoading: boolean }) {
  const metrics = statistics
    ? [
        ["Minimum", statistics.min],
        ["Maximum", statistics.max],
        ["Mean", statistics.mean],
        ["Median", statistics.median],
        ["Std. deviation", statistics.standardDeviation],
      ] as const
    : [];

  return (
    <Panel action={<BarChart3 className="text-[#0b7bb5]" size={17} />} eyebrow="Full dataset" title="Field statistics">
      <div className="grid min-h-28 grid-cols-2 gap-px bg-[#d7e2ea] sm:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, index) => <div className="animate-pulse bg-[#f3f7fa] p-4" key={index} />)
          : metrics.map(([label, value]) => (
              <div className="bg-white p-4" key={label}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#567184]">{label}</p>
                <p className={`mt-2 truncate font-mono text-base font-semibold ${label === "Maximum" ? "text-[#c94b38]" : label === "Minimum" ? "text-[#0b69a3]" : "text-[#16324a]"}`} title={String(value)}>{formatNumber(value)}</p>
              </div>
            ))}
        {!isLoading && !statistics && <p className="col-span-full bg-white p-4 text-sm text-[#567184]">Upload a dataset to calculate statistics.</p>}
      </div>
    </Panel>
  );
}
