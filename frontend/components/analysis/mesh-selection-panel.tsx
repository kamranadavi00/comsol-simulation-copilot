import { Box, CircleDot } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { formatNumber } from "@/lib/visualization";
import type { MeshSelection } from "@/types/datasets";

export function MeshSelectionPanel({ selection }: { selection: MeshSelection | null }) {
  return (
    <Panel action={selection?.kind === "node" ? <CircleDot className="text-[#0b7bb5]" size={17} /> : <Box className="text-[#0b7bb5]" size={17} />} eyebrow="Topology inspection" title={selection?.kind === "node" ? "Selected Node" : "Selected Element"}>
      {!selection ? <div className="grid min-h-40 place-items-center p-6 text-center text-sm text-[#567184]">Choose element or node selection, then click the original mesh.</div> : selection.kind === "node" ? (
        <div className="grid gap-5 p-4 sm:grid-cols-2">
          <dl className="space-y-2 text-sm"><div className="flex justify-between"><dt className="text-[#567184]">Node ID</dt><dd className="font-mono font-semibold">{selection.nodeId}</dd></div>{Object.entries(selection.location).map(([axis, value]) => <div className="flex justify-between" key={axis}><dt className="uppercase text-[#567184]">{axis}</dt><dd className="font-mono">{formatNumber(value)}</dd></div>)}</dl>
          <dl className="max-h-40 space-y-2 overflow-auto text-sm">{Object.entries(selection.values).map(([field, value]) => <div className="flex justify-between gap-4" key={field}><dt className="truncate text-[#567184]">{field}</dt><dd className="font-mono">{formatNumber(value)}</dd></div>)}</dl>
        </div>
      ) : (
        <div className="grid gap-5 p-4 sm:grid-cols-3">
          <dl className="space-y-2 text-sm"><div className="flex justify-between"><dt className="text-[#567184]">Element ID</dt><dd className="font-mono font-semibold">{selection.elementId}</dd></div><div className="flex justify-between"><dt className="text-[#567184]">Type</dt><dd className="capitalize">{selection.elementType}</dd></div>{selection.domainId && <div className="flex justify-between"><dt className="text-[#567184]">Domain</dt><dd className="font-mono">{selection.domainId}</dd></div>}{selection.boundaryId && <div className="flex justify-between"><dt className="text-[#567184]">Boundary</dt><dd className="font-mono">{selection.boundaryId}</dd></div>}</dl>
          <div><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#567184]">Node IDs</p><p className="font-mono text-sm leading-6">{selection.nodeIds.join(" · ")}</p><p className="mb-2 mt-3 text-[10px] font-bold uppercase tracking-wider text-[#567184]">Centroid</p><p className="font-mono text-xs">{Object.entries(selection.centroid).map(([axis, value]) => `${axis}=${formatNumber(value)}`).join(" · ")}</p></div>
          <dl className="max-h-40 space-y-2 overflow-auto text-sm">{Object.entries(selection.values).map(([field, value]) => <div className="flex justify-between gap-4" key={field}><dt className="truncate text-[#567184]">{field}</dt><dd className="font-mono">{formatNumber(value)}</dd></div>)}</dl>
        </div>
      )}
    </Panel>
  );
}
