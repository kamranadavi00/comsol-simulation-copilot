"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Box, CheckCircle2, CircleAlert, Database, FileSpreadsheet, Loader2, Orbit, Ruler, Wifi, WifiOff } from "lucide-react";

import { ProbePanel } from "@/components/analysis/probe-panel";
import { StatisticsPanel } from "@/components/analysis/statistics-panel";
import { ProfileChart } from "@/components/charts/profile-chart";
import { AssistantPanel } from "@/components/chat/assistant-panel";
import { Panel } from "@/components/ui/panel";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { FieldSelector } from "@/components/viewer/field-selector";
import { SimulationViewer } from "@/components/viewer/simulation-viewer";
import { ThresholdControls } from "@/components/viewer/threshold-controls";
import { ViewerControls } from "@/components/viewer/viewer-controls";
import type { AIAction } from "@/lib/ai/schema";
import { requestAssistantActions } from "@/lib/api/chat";
import {
  checkBackend,
  executeDatasetAction,
  loadDatasetPoints,
  uploadDataset,
} from "@/lib/api/datasets";
import { filteredPointData, formatNumber, pointAt } from "@/lib/visualization";
import type {
  DatasetMetadata,
  ExtremeResult,
  FilterResult,
  NearestPointResult,
  PointData,
  ProfileResult,
  Representation,
  SelectedPoint,
  StatisticsResult,
  Threshold,
} from "@/types/datasets";

type Connection = "checking" | "connected" | "disconnected";

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error. Please try again.";
}

export function ExplorerWorkspace() {
  const [connection, setConnection] = useState<Connection>("checking");
  const [metadata, setMetadata] = useState<DatasetMetadata | null>(null);
  const [points, setPoints] = useState<PointData | null>(null);
  const [activeField, setActiveField] = useState("");
  const [representation, setRepresentation] = useState<Representation>("points");
  const [threshold, setThreshold] = useState<Threshold | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [statistics, setStatistics] = useState<StatisticsResult | null>(null);
  const [profile, setProfile] = useState<ProfileResult | null>(null);
  const [filterMatchCount, setFilterMatchCount] = useState<number | null>(null);
  const [resetNonce, setResetNonce] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    checkBackend().then(() => setConnection("connected")).catch(() => setConnection("disconnected"));
  }, []);

  const visiblePoints = useMemo(
    () => (points && activeField ? filteredPointData(points, activeField, threshold) : null),
    [points, activeField, threshold],
  );

  async function loadStatistics(datasetId: string, field: string) {
    setIsAnalyzing(true);
    try {
      const result = await executeDatasetAction<StatisticsResult>(datasetId, "statistics", { field });
      setStatistics(result);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleUpload(file: File) {
    setIsUploading(true);
    setError(null);
    setNotice(null);
    try {
      const nextMetadata = await uploadDataset(file);
      const nextPoints = await loadDatasetPoints(nextMetadata.datasetId);
      const field = nextMetadata.fields[0];
      setMetadata(nextMetadata);
      setPoints(nextPoints);
      setActiveField(field);
      setThreshold(null);
      setSelectedPoint(null);
      setProfile(null);
      setFilterMatchCount(null);
      setConnection("connected");
      await loadStatistics(nextMetadata.datasetId, field);
      setNotice(`${nextMetadata.filename} loaded with ${nextMetadata.rowCount.toLocaleString()} valid rows.`);
    } catch (caught) {
      setError(messageFrom(caught));
      setConnection("disconnected");
    } finally {
      setIsUploading(false);
    }
  }

  async function changeField(field: string) {
    if (!metadata || field === activeField) return;
    setActiveField(field);
    setThreshold(null);
    setFilterMatchCount(null);
    setSelectedPoint(null);
    setProfile(null);
    setError(null);
    try {
      await loadStatistics(metadata.datasetId, field);
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  function selectPosition(position: number) {
    if (!visiblePoints) return;
    setSelectedPoint(pointAt(visiblePoints, position));
  }

  function stepSelection(direction: -1 | 1) {
    if (!visiblePoints?.returnedPoints) return;
    const current = selectedPoint
      ? visiblePoints.rowIndexes.indexOf(selectedPoint.rowIndex)
      : direction > 0 ? -1 : 0;
    const next = (current + direction + visiblePoints.returnedPoints) % visiblePoints.returnedPoints;
    setSelectedPoint(pointAt(visiblePoints, next));
  }

  async function applyThreshold(nextThreshold: Threshold) {
    if (!metadata) return;
    setThreshold(nextThreshold);
    setError(null);
    try {
      const result = await executeDatasetAction<FilterResult>(metadata.datasetId, "filter", nextThreshold);
      setFilterMatchCount(result.matchedCount);
      setNotice(`${result.matchedCount.toLocaleString()} complete-dataset rows match the threshold.`);
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  async function createProfile(axis: "x" | "y" | "z", field = activeField) {
    if (!metadata) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await executeDatasetAction<ProfileResult>(metadata.datasetId, "profile", { field, axis });
      setProfile(result);
      setNotice(`Created a ${result.points.length}-point centerline profile.`);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function focusLocation(location: { x: number; y: number; z?: number }) {
    if (!metadata) return;
    const result = await executeDatasetAction<NearestPointResult>(metadata.datasetId, "nearest_point", location);
    setSelectedPoint({ rowIndex: result.rowIndex, location: result.location, values: result.values });
  }

  async function executeAssistantAction(action: AIAction) {
    if (!metadata) return;
    if (action.type === "change_field") return changeField(action.field);
    if (action.type === "set_threshold") return applyThreshold(action);
    if (action.type === "reset_view") {
      setThreshold(null); setFilterMatchCount(null); setSelectedPoint(null); setResetNonce((value) => value + 1); return;
    }
    if (action.type === "focus_point") return focusLocation(action);
    if (action.type === "create_profile") return createProfile(action.axis, action.field);
    if (action.type === "statistics") {
      await loadStatistics(metadata.datasetId, action.field); return;
    }
    const result = await executeDatasetAction<ExtremeResult>(metadata.datasetId, action.type, { field: action.field });
    await focusLocation(result.location);
    setNotice(`${action.field} ${action.type === "find_max" ? "maximum" : "minimum"}: ${formatNumber(result.value)} at row ${result.rowIndex}.`);
  }

  async function handleAssistantCommand(message: string): Promise<string> {
    if (!metadata) throw new Error("Upload a dataset before using the assistant.");
    const response = await requestAssistantActions(message, metadata, activeField);
    for (const action of response.actions) await executeAssistantAction(action);
    return response.message;
  }

  return (
    <main className="min-h-screen bg-[#071016]">
      <header className="border-b border-slate-800 bg-[#09131a]/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-teal-400/20 bg-teal-400/10 text-teal-300"><Orbit size={21} /></span>
            <div><h1 className="text-sm font-bold tracking-wide text-slate-100 sm:text-base">COMSOL AI Results Explorer</h1><p className="hidden text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:block">Deterministic scientific workspace</p></div>
          </div>
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${connection === "connected" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : connection === "disconnected" ? "border-rose-500/20 bg-rose-500/10 text-rose-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>
            {connection === "checking" ? <Loader2 className="animate-spin" size={13} /> : connection === "connected" ? <Wifi size={13} /> : <WifiOff size={13} />}
            {connection === "checking" ? "Checking backend" : connection === "connected" ? "Backend connected" : "Backend offline"}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] space-y-4 p-4 md:p-6">
        {(error || notice) && (
          <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${error ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"}`} role={error ? "alert" : "status"}>
            {error ? <CircleAlert className="mt-0.5 shrink-0" size={16} /> : <CheckCircle2 className="mt-0.5 shrink-0" size={16} />}{error ?? notice}
          </div>
        )}

        {!metadata || !points ? (
          <div className="grid min-h-[calc(100vh-150px)] place-items-center py-8">
            <div className="w-full max-w-3xl">
              <div className="mb-8 text-center"><p className="text-xs font-bold uppercase tracking-[0.24em] text-teal-400">Scientific post-processing</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">Turn simulation tables into an interactive engineering workspace.</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">Upload a COMSOL CSV. Coordinates, scalar fields, dimensions, and bounds are detected without field-specific assumptions.</p></div>
              <UploadDropzone isLoading={isUploading} onUpload={handleUpload} />
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[[Database, "Full-data calculations", "Statistics and extrema never use downsampled values."], [Box, "2D + 3D inspection", "Canvas maps and a vtk.js spatial point-cloud viewer."], [Activity, "AI action control", "Natural language triggers validated, deterministic actions."]].map(([Icon, title, copy]) => {
                  const ItemIcon = Icon as typeof Database;
                  return <div className="rounded-lg border border-slate-800 bg-[#0b151d] p-4" key={String(title)}><ItemIcon className="text-teal-400" size={17} /><p className="mt-3 text-sm font-semibold text-slate-200">{String(title)}</p><p className="mt-1 text-xs leading-5 text-slate-500">{String(copy)}</p></div>;
                })}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#0b151d] p-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex w-full min-w-0 items-center gap-3 sm:flex-1"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-900 text-teal-300"><FileSpreadsheet size={18} /></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-100">{metadata.filename}</p><p className="text-xs text-slate-500">{metadata.rowCount.toLocaleString()} rows · {metadata.dimension} · {metadata.fields.length} scalar fields</p></div></div>
                <FieldSelector activeField={activeField} fields={metadata.fields} onChange={(field) => void changeField(field)} />
              </div>
              <UploadDropzone compact isLoading={isUploading} onUpload={handleUpload} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <Panel
                action={<ViewerControls onRepresentationChange={setRepresentation} onReset={() => setResetNonce((value) => value + 1)} representation={representation} showRepresentation={metadata.dimension === "3D"} />}
                className="min-w-0 overflow-hidden"
                eyebrow={`${metadata.dimension} visualization`}
                title={`${activeField} scalar field`}
              >
                <div className="relative min-h-[420px]">
                  <SimulationViewer data={visiblePoints!} field={activeField} metadata={metadata} onSelect={selectPosition} representation={representation} resetNonce={resetNonce} selectedPoint={selectedPoint} />
                  <div className="absolute left-3 top-3 flex gap-2"><span className="rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{visiblePoints!.returnedPoints.toLocaleString()} / {points.totalPoints.toLocaleString()} points</span>{points.downsampled && <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">visual sample</span>}</div>
                </div>
                <div className="flex flex-col gap-3 border-t border-slate-800 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <ThresholdControls field={activeField} onApply={(value) => void applyThreshold(value)} onClear={() => { setThreshold(null); setFilterMatchCount(null); }} threshold={threshold} />
                  {filterMatchCount !== null && <p className="shrink-0 text-xs text-slate-500">{filterMatchCount.toLocaleString()} full-data matches</p>}
                </div>
              </Panel>
              <AssistantPanel disabled={!metadata || isUploading} onCommand={handleAssistantCommand} />
            </div>

            <StatisticsPanel isLoading={isAnalyzing} statistics={statistics} />
            <div className="grid gap-4 lg:grid-cols-2">
              <ProbePanel onStep={stepSelection} point={selectedPoint} />
              <div className="space-y-2">
                <div className="flex items-center justify-end gap-2">
                  <span className="mr-auto flex items-center gap-1.5 text-xs text-slate-500"><Ruler size={14} /> Profile axis</span>
                  {(["x", "y", ...(metadata.dimension === "3D" ? ["z"] : [])] as Array<"x" | "y" | "z">).map((axis) => <button className="min-h-9 rounded-md border border-slate-700 px-3 text-xs font-bold uppercase text-slate-300 hover:border-teal-500 hover:text-teal-300" key={axis} onClick={() => void createProfile(axis)} type="button">{axis}</button>)}
                </div>
                <ProfileChart profile={profile} />
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
