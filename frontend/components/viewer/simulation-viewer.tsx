"use client";

import dynamic from "next/dynamic";

import ScalarMap2D from "./scalar-map-2d";
import type { DatasetMetadata, MeshBounds, MeshData, MeshSelection, MeshSettings, PointData, Representation, SelectedPoint, VisualizationMode } from "@/types/datasets";

const VtkViewer = dynamic(() => import("./vtk-viewer"), {
  ssr: false,
  loading: () => <div className="grid min-h-[420px] place-items-center bg-[#f7fafc] text-sm text-[#567184]">Loading 3D renderer…</div>,
});

const MeshViewer = dynamic(() => import("./mesh-viewer"), {
  ssr: false,
  loading: () => <div className="grid min-h-[520px] place-items-center bg-[#f7fafc] text-sm text-[#567184]">Preparing FEM mesh renderer…</div>,
});

export function SimulationViewer({
  metadata,
  data,
  field,
  representation,
  selectedPoint,
  highlightedRowIndexes,
  highlightedCellIndexes,
  highlightBounds,
  mesh,
  meshSettings,
  visualizationMode,
  meshSelection,
  resetNonce,
  onSelect,
  onMeshSelect,
}: {
  metadata: DatasetMetadata;
  data: PointData;
  field: string;
  representation: Representation;
  selectedPoint: SelectedPoint | null;
  highlightedRowIndexes: number[];
  highlightedCellIndexes: number[];
  highlightBounds: MeshBounds | null;
  mesh: MeshData | null;
  meshSettings: MeshSettings;
  visualizationMode: VisualizationMode;
  meshSelection: MeshSelection | null;
  resetNonce: number;
  onSelect: (position: number) => void;
  onMeshSelect: (selection: MeshSelection | null) => void;
}) {
  if (mesh) {
    return <MeshViewer field={field} highlightBounds={highlightBounds} highlightedCellIndexes={highlightedCellIndexes} mesh={mesh} mode={visualizationMode} onSelect={onMeshSelect} resetNonce={resetNonce} selection={meshSelection} settings={meshSettings} />;
  }
  return metadata.dimension === "3D" ? (
    <VtkViewer data={data} field={field} highlightedRowIndexes={highlightedRowIndexes} onSelect={onSelect} representation={representation} resetNonce={resetNonce} selectedPoint={selectedPoint} />
  ) : (
    <ScalarMap2D data={data} field={field} highlightedRowIndexes={highlightedRowIndexes} onSelect={onSelect} selectedPoint={selectedPoint} />
  );
}
