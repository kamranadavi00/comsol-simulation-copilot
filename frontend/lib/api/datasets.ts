import { backendRequest } from "./client";
import type {
  DatasetMetadata,
  ExtremeResult,
  FilterResult,
  NearestPointResult,
  PointData,
  ProfileResult,
  StatisticsResult,
} from "@/types/datasets";

export type ExecuteResult =
  | ExtremeResult
  | FilterResult
  | NearestPointResult
  | ProfileResult
  | StatisticsResult;

export async function uploadDataset(file: File): Promise<DatasetMetadata> {
  const form = new FormData();
  form.append("file", file);
  return backendRequest<DatasetMetadata>("/datasets/upload", { method: "POST", body: form });
}

export function loadDatasetPoints(datasetId: string, maxPoints = 50_000): Promise<PointData> {
  return backendRequest<PointData>(`/datasets/${datasetId}/points?max_points=${maxPoints}`);
}

export function executeDatasetAction<T extends ExecuteResult>(
  datasetId: string,
  action: string,
  params: object,
): Promise<T> {
  return backendRequest<T>(`/datasets/${datasetId}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, params }),
  });
}

export function checkBackend(): Promise<{ status: "ok" }> {
  return backendRequest<{ status: "ok" }>("/health");
}
