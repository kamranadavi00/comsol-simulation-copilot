import type { PointData, SelectedPoint, Threshold } from "@/types/datasets";

const VIRIDIS: Array<[number, number, number]> = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];

export function finiteRange(values: Array<number | null>): [number, number] {
  const usable = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!usable.length) return [0, 1];
  const min = Math.min(...usable);
  const max = Math.max(...usable);
  return min === max ? [min, min + 1] : [min, max];
}

export function scalarColor(value: number, min: number, max: number, alpha = 1): string {
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const scaled = normalized * (VIRIDIS.length - 1);
  const index = Math.min(VIRIDIS.length - 2, Math.floor(scaled));
  const fraction = scaled - index;
  const start = VIRIDIS[index];
  const end = VIRIDIS[index + 1];
  const rgb = start.map((channel, channelIndex) =>
    Math.round(channel + (end[channelIndex] - channel) * fraction),
  );
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export function passesThreshold(value: number | null, threshold: Threshold | null): boolean {
  if (value === null || !Number.isFinite(value)) return false;
  if (!threshold) return true;
  if (threshold.operator === ">") return value > threshold.value;
  if (threshold.operator === ">=") return value >= threshold.value;
  if (threshold.operator === "<") return value < threshold.value;
  if (threshold.operator === "<=") return value <= threshold.value;
  return value === threshold.value;
}

export function filteredPointData(data: PointData, field: string, threshold: Threshold | null): PointData {
  if (!threshold) return data;
  const values = data.fields[field] ?? [];
  const positions = values
    .map((value, index) => (passesThreshold(value, threshold) ? index : -1))
    .filter((index) => index >= 0);
  const pick = <T,>(items: T[]) => positions.map((position) => items[position]);
  return {
    ...data,
    returnedPoints: positions.length,
    rowIndexes: pick(data.rowIndexes),
    coordinates: {
      x: pick(data.coordinates.x),
      y: pick(data.coordinates.y),
      z: data.coordinates.z ? pick(data.coordinates.z) : undefined,
    },
    fields: Object.fromEntries(Object.entries(data.fields).map(([name, items]) => [name, pick(items)])),
  };
}

export function pointAt(data: PointData, position: number): SelectedPoint | null {
  const rowIndex = data.rowIndexes[position];
  if (rowIndex === undefined) return null;
  const values = Object.fromEntries(
    Object.entries(data.fields)
      .map(([field, entries]) => [field, entries[position]] as [string, number | null])
      .filter((entry): entry is [string, number] => entry[1] !== null && Number.isFinite(entry[1])),
  );
  return {
    rowIndex,
    location: {
      x: data.coordinates.x[position],
      y: data.coordinates.y[position],
      ...(data.coordinates.z ? { z: data.coordinates.z[position] } : {}),
    },
    values,
  };
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  if ((absolute > 0 && absolute < 0.001) || absolute >= 1_000_000) return value.toExponential(3);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
}
