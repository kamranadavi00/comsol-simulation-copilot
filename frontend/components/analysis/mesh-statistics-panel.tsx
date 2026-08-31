import { Grid3X3 } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import type { MeshMetadata } from "@/types/datasets";

export function MeshStatisticsPanel({ mesh }: { mesh: MeshMetadata }) {
  const rows: Array<[string, string]> = [
    ["Nodes", mesh.nodeCount.toLocaleString()],
    ["Elements", mesh.elementCount.toLocaleString()],
    ...Object.entries(mesh.elementTypeCounts).map(([type, count]) => [type, count.toLocaleString()] as [string, string]),
    ...(mesh.domainCount === null || mesh.domainCount === undefined ? [] : [["Domains", mesh.domainCount.toLocaleString()] as [string, string]]),
    ...(mesh.boundaryCount === null || mesh.boundaryCount === undefined ? [] : [["Boundaries", mesh.boundaryCount.toLocaleString()] as [string, string]]),
    ["Dimension", mesh.meshDimension],
  ];
  return (
    <Panel action={<Grid3X3 className="text-[#0b7bb5]" size={17} />} eyebrow="Original COMSOL mesh" title="Mesh Statistics">
      <dl className="grid gap-px bg-[#d7e2ea] sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {rows.map(([label, value]) => <div className="bg-white p-4" key={label}><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#567184]">{label}</dt><dd className="mt-2 font-mono text-sm font-semibold text-[#16324a]">{value}</dd></div>)}
      </dl>
    </Panel>
  );
}
