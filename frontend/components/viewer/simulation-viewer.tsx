"use client";

import dynamic from "next/dynamic";

import ScalarMap2D from "./scalar-map-2d";
import type { DatasetMetadata, PointData, Representation, SelectedPoint } from "@/types/datasets";

const VtkViewer = dynamic(() => import("./vtk-viewer"), {
  ssr: false,
  loading: () => <div className="grid min-h-[420px] place-items-center bg-[#f7fafc] text-sm text-[#567184]">Loading 3D renderer…</div>,
});

export function SimulationViewer({
  metadata,
  data,
  field,
  representation,
  selectedPoint,
  highlightedRowIndexes,
  resetNonce,
  onSelect,
}: {
  metadata: DatasetMetadata;
  data: PointData;
  field: string;
  representation: Representation;
  selectedPoint: SelectedPoint | null;
  highlightedRowIndexes: number[];
  resetNonce: number;
  onSelect: (position: number) => void;
}) {
  return metadata.dimension === "3D" ? (
    <VtkViewer data={data} field={field} highlightedRowIndexes={highlightedRowIndexes} onSelect={onSelect} representation={representation} resetNonce={resetNonce} selectedPoint={selectedPoint} />
  ) : (
    <ScalarMap2D data={data} field={field} highlightedRowIndexes={highlightedRowIndexes} onSelect={onSelect} selectedPoint={selectedPoint} />
  );
}
