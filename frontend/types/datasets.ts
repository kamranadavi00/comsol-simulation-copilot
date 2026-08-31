export type Dimension = "2D" | "3D";
export type Representation = "surface" | "points" | "wireframe";
export type VisualizationMode = "field" | "surface" | "slice" | "isosurface" | "streamlines" | "vector" | "mesh";
export type MeshRenderType = "wireframe" | "surface" | "volume" | "field";
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
  mesh?: MeshMetadata | null;
}

export interface MeshMetadata {
  available: true;
  source: "original";
  nodeCount: number;
  elementCount: number;
  elementTypeCounts: Record<string, number>;
  domainCount?: number | null;
  boundaryCount?: number | null;
  meshDimension: "1D" | "2D" | "3D";
  nodeFields: string[];
  elementFields: string[];
  visualizationTier: "full" | "surface" | "decimated" | "progressive";
}

export interface MeshData {
  datasetId: string;
  source: "original";
  nodeIds: string[];
  coordinates: { x: number[]; y: number[]; z: number[] };
  nodeFields: Record<string, Array<number | null>>;
  elementIds: string[];
  elementTypes: string[];
  elementOffsets: number[];
  connectivity: number[];
  domainIds: Array<string | null>;
  boundaryIds: Array<string | null>;
  elementFields: Record<string, Array<number | null>>;
  surfaceTriangles: number[];
  surfaceOwners: number[];
  surfaceEdges: number[];
  allEdges: number[];
  statistics: MeshMetadata;
}

export interface MeshSettings {
  renderType: MeshRenderType;
  showMesh: boolean;
  showSurfaceElements: boolean;
  showInternalElements: boolean;
  showEdges: boolean;
  showNodes: boolean;
  opacity: number;
  edgeThickness: number;
  nodeSize: number;
  elementColoring: boolean;
  clip: { x: number | null; y: number | null; z: number | null };
  sliceAxis: "xy" | "xz" | "yz" | "custom";
  customNormal: { x: number; y: number; z: number };
  customPosition: number;
  selectionMode: "element" | "node";
  projection: "perspective" | "orthographic";
  quality: "auto" | "high" | "balanced";
  isoValue: number | null;
  vectorScale: number;
}

export type MeshSelection =
  | {
      kind: "node";
      nodeIndex: number;
      nodeId: string;
      location: { x: number; y: number; z: number };
      values: Record<string, number>;
    }
  | {
      kind: "element";
      elementIndex: number;
      elementId: string;
      elementType: string;
      nodeIds: string[];
      domainId: string | null;
      boundaryId: string | null;
      centroid: { x: number; y: number; z: number };
      values: Record<string, number>;
    };

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
