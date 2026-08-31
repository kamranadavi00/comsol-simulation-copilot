"use client";

import { Box, Camera, Layers3, Maximize2, Scissors } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import type { DatasetMetadata, MeshSettings, VisualizationMode } from "@/types/datasets";

export const DEFAULT_MESH_SETTINGS: MeshSettings = {
  renderType: "field",
  showMesh: true,
  showSurfaceElements: true,
  showInternalElements: false,
  showEdges: true,
  showNodes: false,
  opacity: 0.86,
  edgeThickness: 1,
  nodeSize: 5,
  elementColoring: false,
  clip: { x: null, y: null, z: null },
  sliceAxis: "xy",
  customNormal: { x: 0.5, y: 0.5, z: 1 },
  customPosition: 0.5,
  selectionMode: "element",
  projection: "perspective",
  quality: "auto",
  isoValue: null,
  vectorScale: 1,
};

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center justify-between gap-3 text-xs text-[#294b63]">
      <span>{label}</span>
      <input checked={checked} className="h-4 w-4 accent-[#0b7bb5]" onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  );
}

function Range({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs text-[#294b63]">
      <span className="mb-1.5 flex justify-between"><span>{label}</span><span className="font-mono text-[#567184]">{value.toFixed(step < 0.1 ? 2 : 0)}</span></span>
      <input className="w-full accent-[#0b7bb5]" max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} type="range" value={value} />
    </label>
  );
}

export function MeshSettingsPanel({
  metadata,
  mode,
  settings,
  onModeChange,
  onSettingsChange,
  onFit,
  fieldRange,
  hasVectorField,
}: {
  metadata: DatasetMetadata;
  mode: VisualizationMode;
  settings: MeshSettings;
  onModeChange: (mode: VisualizationMode) => void;
  onSettingsChange: (settings: MeshSettings) => void;
  onFit: () => void;
  fieldRange: [number, number];
  hasVectorField: boolean;
}) {
  const set = <K extends keyof MeshSettings>(key: K, value: MeshSettings[K]) => onSettingsChange({ ...settings, [key]: value });
  const axes = (["x", "y", "z"] as const).filter((axis) => metadata.bounds[axis]);
  const displayModes: Array<{ value: VisualizationMode; label: string; supported: boolean }> = [
    { value: "field", label: "Field", supported: true },
    { value: "surface", label: "Surface", supported: true },
    { value: "slice", label: "Mesh Slice", supported: true },
    { value: "isosurface", label: "Isosurface", supported: true },
    { value: "streamlines", label: "Streamlines", supported: false },
    { value: "vector", label: "Vector Field", supported: hasVectorField },
    { value: "mesh", label: "Mesh", supported: true },
  ];
  return (
    <Panel action={<Layers3 className="text-[#0b7bb5]" size={17} />} className="overflow-hidden" eyebrow="Original topology" title="Mesh Settings">
      <div className="space-y-5 p-4">
        <label className="block text-xs font-semibold text-[#294b63]">
          <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-[#567184]">Display</span>
          <select className="h-10 w-full rounded-lg border border-[#b9cbd7] bg-white px-3 outline-none focus:border-[#0b8fb4]" onChange={(event) => onModeChange(event.target.value as VisualizationMode)} value={mode}>
            {displayModes.map((item) => <option disabled={!item.supported} key={item.value} value={item.value}>{item.label}{item.supported ? "" : " · unavailable"}</option>)}
          </select>
        </label>

        <label className="block text-xs font-semibold text-[#294b63]">
          <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-[#567184]">Mesh type</span>
          <select className="h-10 w-full rounded-lg border border-[#b9cbd7] bg-white px-3 outline-none" onChange={(event) => {
            const renderType = event.target.value as MeshSettings["renderType"];
            onSettingsChange({ ...settings, renderType, showInternalElements: renderType === "volume" ? true : settings.showInternalElements });
          }} value={settings.renderType}>
            <option value="wireframe">Wireframe Mesh</option>
            <option value="surface">Surface Mesh</option>
            <option value="volume">Volume Mesh</option>
            <option value="field">Mesh + Field</option>
          </select>
        </label>

        <div className="space-y-1 border-y border-[#e1e9ee] py-3">
          <Toggle checked={settings.showMesh} label="Show mesh" onChange={(value) => set("showMesh", value)} />
          <Toggle checked={settings.showSurfaceElements} label="Show surface elements" onChange={(value) => set("showSurfaceElements", value)} />
          <Toggle checked={settings.showInternalElements} label="Show internal elements" onChange={(value) => set("showInternalElements", value)} />
          <Toggle checked={settings.showEdges} label="Show mesh edges" onChange={(value) => set("showEdges", value)} />
          <Toggle checked={settings.showNodes} label="Show nodes" onChange={(value) => set("showNodes", value)} />
          <Toggle checked={settings.elementColoring} label="Element coloring" onChange={(value) => set("elementColoring", value)} />
        </div>

        <div className="space-y-4">
          <Range label="Mesh opacity" max={1} min={0} onChange={(value) => set("opacity", value)} step={0.01} value={settings.opacity} />
          <Range label="Edge thickness" max={6} min={1} onChange={(value) => set("edgeThickness", value)} step={1} value={settings.edgeThickness} />
          <Range label="Node size" max={14} min={2} onChange={(value) => set("nodeSize", value)} step={1} value={settings.nodeSize} />
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#567184]"><Scissors size={12} /> Clipping</p>
          <div className="space-y-3">
            {axes.map((axis) => {
              const bounds = metadata.bounds[axis];
              const current = settings.clip[axis];
              const span = bounds[1] - bounds[0] || 1;
              return (
                <div key={axis}>
                  <label className="mb-1 flex items-center justify-between text-xs text-[#294b63]"><span className="font-bold uppercase">Clip {axis}</span><input checked={current !== null} className="accent-[#0b7bb5]" onChange={(event) => set("clip", { ...settings.clip, [axis]: event.target.checked ? (bounds[0] + bounds[1]) / 2 : null })} type="checkbox" /></label>
                  <input className="w-full accent-[#bd5220] disabled:opacity-30" disabled={current === null} max={bounds[1]} min={bounds[0]} onChange={(event) => set("clip", { ...settings.clip, [axis]: Number(event.target.value) })} step={span / 200} type="range" value={current ?? (bounds[0] + bounds[1]) / 2} />
                </div>
              );
            })}
          </div>
        </div>

        {mode === "slice" && <div className="space-y-3"><label className="block text-xs font-semibold text-[#294b63]"><span className="mb-1.5 block text-[10px] uppercase tracking-wider text-[#567184]">Slice plane</span><select className="h-10 w-full rounded-lg border border-[#b9cbd7] bg-white px-3" onChange={(event) => set("sliceAxis", event.target.value as MeshSettings["sliceAxis"])} value={settings.sliceAxis}><option value="xy">XY</option><option value="xz">XZ</option><option value="yz">YZ</option><option value="custom">Custom plane</option></select></label>{settings.sliceAxis === "custom" && <div className="space-y-3 rounded-lg border border-[#d7e2ea] bg-[#f8fbfd] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#567184]">Plane normal</p>{(["x", "y", "z"] as const).map((axis) => <Range key={axis} label={`Normal ${axis.toUpperCase()}`} max={1} min={-1} onChange={(value) => set("customNormal", { ...settings.customNormal, [axis]: value })} step={0.1} value={settings.customNormal[axis]} />)}<Range label="Plane position" max={1} min={0} onChange={(value) => set("customPosition", value)} step={0.01} value={settings.customPosition} /></div>}</div>}
        {mode === "isosurface" && <Range label="Isosurface value" max={fieldRange[1]} min={fieldRange[0]} onChange={(value) => set("isoValue", value)} step={(fieldRange[1] - fieldRange[0] || 1) / 200} value={settings.isoValue ?? (fieldRange[0] + fieldRange[1]) / 2} />}
        {mode === "vector" && <Range label="Vector scale" max={4} min={0.1} onChange={(value) => set("vectorScale", value)} step={0.1} value={settings.vectorScale} />}

        <div className="grid grid-cols-2 gap-2">
          <button className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold ${settings.selectionMode === "element" ? "border-[#73abc3] bg-[#eaf6fa] text-[#0b5f9e]" : "border-[#c6d5df] text-[#567184]"}`} onClick={() => set("selectionMode", "element")} type="button"><Box size={14} /> Elements</button>
          <button className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold ${settings.selectionMode === "node" ? "border-[#73abc3] bg-[#eaf6fa] text-[#0b5f9e]" : "border-[#c6d5df] text-[#567184]"}`} onClick={() => { set("selectionMode", "node"); if (!settings.showNodes) onSettingsChange({ ...settings, selectionMode: "node", showNodes: true }); }} type="button">Nodes</button>
        </div>
        <label className="block text-xs font-semibold text-[#294b63]"><span className="mb-1.5 block text-[10px] uppercase tracking-wider text-[#567184]">Camera</span><select className="h-10 w-full rounded-lg border border-[#b9cbd7] bg-white px-3" onChange={(event) => set("projection", event.target.value as MeshSettings["projection"])} value={settings.projection}><option value="perspective">Perspective</option><option value="orthographic">Orthographic</option></select></label>
        <label className="block text-xs font-semibold text-[#294b63]"><span className="mb-1.5 block text-[10px] uppercase tracking-wider text-[#567184]">Mesh quality</span><select className="h-10 w-full rounded-lg border border-[#b9cbd7] bg-white px-3" onChange={(event) => set("quality", event.target.value as MeshSettings["quality"])} value={settings.quality}><option value="auto">Auto · recommended</option><option value="high">High · full surface</option><option value="balanced">Balanced · interactive</option></select></label>
        <button className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0b5f9e] text-xs font-bold text-white hover:bg-[#084d82]" onClick={onFit} type="button"><Maximize2 size={14} /> Fit geometry</button>
        <p className="flex items-start gap-1.5 text-[10px] leading-4 text-[#7b919f]"><Camera className="mt-0.5 shrink-0" size={11} /> Clipping is GPU-based and never changes the original mesh data.</p>
      </div>
    </Panel>
  );
}
