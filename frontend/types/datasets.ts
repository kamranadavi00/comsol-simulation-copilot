export type Dimension = "2D" | "3D";
export type Representation = "surface" | "points" | "wireframe";
export type ThresholdOperator = ">" | ">=" | "<" | "<=" | "==";

export interface CoordinateColumns {
  x: string;
  y: string;
  z?: string | null;
}

export interface DatasetMetadata {
  datasetId: string;
  filename: string;
  rowCount: number;
  dimension: Dimension;
  coordinateColumns: CoordinateColumns;
  fields: string[];
  bounds: Record<string, [number, number]>;
}

export interface PointData {
  datasetId: string;
  totalPoints: number;
  returnedPoints: number;
  downsampled: boolean;
  rowIndexes: number[];
  coordinates: {
    x: number[];
    y: number[];
    z?: number[] | null;
  };
  fields: Record<string, Array<number | null>>;
}

export interface Threshold {
  field: string;
  operator: ThresholdOperator;
  value: number;
}

export interface SelectedPoint {
  rowIndex: number;
  location: { x: number; y: number; z?: number };
  values: Record<string, number>;
}

export interface StatisticsResult {
  action: "statistics";
  field: string;
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  standardDeviation: number;
  range: number;
  minLocation: { x: number; y: number; z?: number };
  maxLocation: { x: number; y: number; z?: number };
}

export interface ExtremeResult {
  action: "find_max" | "find_min";
  field: string;
  value: number;
  rowIndex: number;
  location: { x: number; y: number; z?: number };
}

export interface FilterResult {
  action: "filter";
  field: string;
  operator: ThresholdOperator;
  value: number;
  matchedCount: number;
  returnedCount: number;
  truncated: boolean;
  rowIndexes: number[];
}

export interface ProfileResult {
  action: "profile";
  field: string;
  axis: "x" | "y" | "z";
  points: Array<{ position: number; value: number }>;
}

export interface NearestPointResult extends SelectedPoint {
  action: "nearest_point";
}

export interface VisualizationState {
  activeField: string;
  threshold: Threshold | null;
  selectedPoint: SelectedPoint | null;
  representation: Representation;
}
