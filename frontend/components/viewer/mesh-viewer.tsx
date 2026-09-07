"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import "@kitware/vtk.js/Rendering/Profiles/Geometry";
import vtkDataArray from "@kitware/vtk.js/Common/Core/DataArray";
import vtkPoints from "@kitware/vtk.js/Common/Core/Points";
import vtkCellArray from "@kitware/vtk.js/Common/Core/CellArray";
import vtkPlane from "@kitware/vtk.js/Common/DataModel/Plane";
import vtkPolyData from "@kitware/vtk.js/Common/DataModel/PolyData";
import vtkActor from "@kitware/vtk.js/Rendering/Core/Actor";
import vtkAxesActor from "@kitware/vtk.js/Rendering/Core/AxesActor";
import vtkCellPicker from "@kitware/vtk.js/Rendering/Core/CellPicker";
import vtkColorTransferFunction from "@kitware/vtk.js/Rendering/Core/ColorTransferFunction";
import vtkMapper from "@kitware/vtk.js/Rendering/Core/Mapper";
import vtkPointPicker from "@kitware/vtk.js/Rendering/Core/PointPicker";
import vtkGenericRenderWindow from "@kitware/vtk.js/Rendering/Misc/GenericRenderWindow";
import vtkOrientationMarkerWidget from "@kitware/vtk.js/Interaction/Widgets/OrientationMarkerWidget";
import { Corners } from "@kitware/vtk.js/Interaction/Widgets/OrientationMarkerWidget/Constants";

import { finiteRange, formatNumber } from "@/lib/visualization";
import type { MeshBounds, MeshData, MeshSelection, MeshSettings, VisualizationMode } from "@/types/datasets";

type MeshContext = {
  view: ReturnType<typeof vtkGenericRenderWindow.newInstance>;
  surfaceMapper: ReturnType<typeof vtkMapper.newInstance>;
  surfaceActor: ReturnType<typeof vtkActor.newInstance>;
  edgeMapper: ReturnType<typeof vtkMapper.newInstance>;
  edgeActor: ReturnType<typeof vtkActor.newInstance>;
  nodeMapper: ReturnType<typeof vtkMapper.newInstance>;
  nodeActor: ReturnType<typeof vtkActor.newInstance>;
  highlightMapper: ReturnType<typeof vtkMapper.newInstance>;
  highlightActor: ReturnType<typeof vtkActor.newInstance>;
  sliceMapper: ReturnType<typeof vtkMapper.newInstance>;
  sliceActor: ReturnType<typeof vtkActor.newInstance>;
  vectorMapper: ReturnType<typeof vtkMapper.newInstance>;
  vectorActor: ReturnType<typeof vtkActor.newInstance>;
  selectionMapper: ReturnType<typeof vtkMapper.newInstance>;
  selectionActor: ReturnType<typeof vtkActor.newInstance>;
  cellPicker: ReturnType<typeof vtkCellPicker.newInstance>;
  pointPicker: ReturnType<typeof vtkPointPicker.newInstance>;
  orientationWidget: ReturnType<typeof vtkOrientationMarkerWidget.newInstance>;
  axesActor: ReturnType<typeof vtkAxesActor.newInstance>;
  unsubscribe: () => void;
};

const ELEMENT_EDGES: Record<string, Array<[number, number]>> = {
  line: [[0, 1]],
  triangle: [[0, 1], [1, 2], [2, 0]],
  quadrilateral: [[0, 1], [1, 2], [2, 3], [3, 0]],
  tetra: [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]],
  hexahedron: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]],
  wedge: [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3], [0, 3], [1, 4], [2, 5]],
  pyramid: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 4], [2, 4], [3, 4]],
};

const ELEMENT_FACES: Record<string, number[][]> = {
  tetra: [[0, 2, 1], [0, 1, 3], [1, 2, 3], [2, 0, 3]],
  hexahedron: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]],
  wedge: [[0, 2, 1], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]],
  pyramid: [[0, 3, 2, 1], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]],
};

const VOLUME_ELEMENT_TYPES = new Set(Object.keys(ELEMENT_FACES));

/** Build the visible boundary of the selected cells without changing mesh data. */
function buildCellHighlight(mesh: MeshData, cellIndexes: number[]) {
  const volumeFaces = new Map<string, { nodes: number[]; uses: number }>();
  const surfaceFaces: number[][] = [];
  const selectedLines: Array<[number, number]> = [];

  for (const cellIndex of cellIndexes) {
    if (cellIndex < 0 || cellIndex >= mesh.elementIds.length) continue;
    const nodes = mesh.connectivity.slice(mesh.elementOffsets[cellIndex], mesh.elementOffsets[cellIndex + 1]);
    const elementType = mesh.elementTypes[cellIndex];
    if (VOLUME_ELEMENT_TYPES.has(elementType)) {
      for (const localFace of ELEMENT_FACES[elementType]) {
        const face = localFace.map((localIndex) => nodes[localIndex]).filter((node) => node !== undefined);
        if (face.length < 3) continue;
        const key = [...face].sort((left, right) => left - right).join(":");
        const existing = volumeFaces.get(key);
        if (existing) existing.uses += 1;
        else volumeFaces.set(key, { nodes: face, uses: 1 });
      }
    } else if (elementType === "line" && nodes.length >= 2) {
      selectedLines.push([nodes[0], nodes[1]]);
    } else if (nodes.length >= 3) {
      surfaceFaces.push(nodes);
    }
  }

  const polygons = [
    ...surfaceFaces,
    ...[...volumeFaces.values()].filter((face) => face.uses === 1).map((face) => face.nodes),
  ];
  const triangles: number[] = [];
  for (const face of polygons) {
    for (let index = 1; index < face.length - 1; index += 1) {
      triangles.push(3, face[0], face[index], face[index + 1]);
    }
  }
  const lines = new Uint32Array(selectedLines.length * 3);
  selectedLines.forEach(([start, end], index) => {
    lines[index * 3] = 2;
    lines[index * 3 + 1] = start;
    lines[index * 3 + 2] = end;
  });
  const data = vtkPolyData.newInstance();
  data.setPoints(vtkPointsFor(mesh));
  data.setPolys(vtkCellArray.newInstance({ values: new Uint32Array(triangles) }));
  data.setLines(vtkCellArray.newInstance({ values: lines }));
  return data;
}

function buildSlice(mesh: MeshData, field: string, settings: MeshSettings) {
  const axis = settings.sliceAxis === "xy" ? "z" : settings.sliceAxis === "xz" ? "y" : settings.sliceAxis === "yz" ? "x" : null;
  const rawNormal = axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : axis === "z" ? [0, 0, 1] : [settings.customNormal.x, settings.customNormal.y, settings.customNormal.z];
  const normalLength = Math.hypot(...rawNormal) || 1;
  const normal = rawNormal.map((value) => value / normalLength);
  const projections = new Float64Array(mesh.nodeIds.length);
  let projectionMin = Number.POSITIVE_INFINITY;
  let projectionMax = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < mesh.nodeIds.length; index += 1) {
    const projection = mesh.coordinates.x[index] * normal[0] + mesh.coordinates.y[index] * normal[1] + mesh.coordinates.z[index] * normal[2];
    projections[index] = projection;
    projectionMin = Math.min(projectionMin, projection);
    projectionMax = Math.max(projectionMax, projection);
  }
  const plane = axis && settings.clip[axis] !== null ? settings.clip[axis] as number : settings.sliceAxis === "custom" ? projectionMin + (projectionMax - projectionMin) * settings.customPosition : (projectionMin + projectionMax) / 2;
  const source = mesh.nodeFields[field] ?? [];
  const points: number[] = [];
  const scalars: number[] = [];
  const polys: number[] = [];
  const owners: number[] = [];
  const epsilon = Math.max(1e-12, (projectionMax - projectionMin) * 1e-9);
  const reference = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const basisU = [
    normal[1] * reference[2] - normal[2] * reference[1],
    normal[2] * reference[0] - normal[0] * reference[2],
    normal[0] * reference[1] - normal[1] * reference[0],
  ];
  const basisLength = Math.hypot(...basisU) || 1;
  basisU.forEach((value, index) => { basisU[index] = value / basisLength; });
  const basisV = [
    normal[1] * basisU[2] - normal[2] * basisU[1],
    normal[2] * basisU[0] - normal[0] * basisU[2],
    normal[0] * basisU[1] - normal[1] * basisU[0],
  ];
  const elementLimit = settings.quality === "high" ? Number.POSITIVE_INFINITY : settings.quality === "balanced" ? 150_000 : mesh.statistics.visualizationTier === "progressive" ? 100_000 : mesh.statistics.visualizationTier === "decimated" ? 250_000 : Number.POSITIVE_INFINITY;
  const elementStride = Math.max(1, Math.ceil(mesh.elementIds.length / elementLimit));

  for (let elementIndex = 0; elementIndex < mesh.elementIds.length; elementIndex += elementStride) {
    const start = mesh.elementOffsets[elementIndex];
    const nodes = mesh.connectivity.slice(start, mesh.elementOffsets[elementIndex + 1]);
    const edges = ELEMENT_EDGES[mesh.elementTypes[elementIndex]] ?? [];
    const intersections = new Map<string, { x: number; y: number; z: number; value: number }>();
    for (const [localA, localB] of edges) {
      if (localA >= nodes.length || localB >= nodes.length) continue;
      const a = nodes[localA];
      const b = nodes[localB];
      const da = projections[a] - plane;
      const db = projections[b] - plane;
      if (Math.abs(da) > epsilon && Math.abs(db) > epsilon && Math.sign(da) === Math.sign(db)) continue;
      const denominator = da - db;
      const t = Math.abs(denominator) < epsilon ? 0 : Math.max(0, Math.min(1, da / denominator));
      const x = mesh.coordinates.x[a] + (mesh.coordinates.x[b] - mesh.coordinates.x[a]) * t;
      const y = mesh.coordinates.y[a] + (mesh.coordinates.y[b] - mesh.coordinates.y[a]) * t;
      const z = mesh.coordinates.z[a] + (mesh.coordinates.z[b] - mesh.coordinates.z[a]) * t;
      const valueA = source[a] ?? 0;
      const valueB = source[b] ?? valueA;
      const value = valueA + (valueB - valueA) * t;
      intersections.set(`${x.toPrecision(12)}:${y.toPrecision(12)}:${z.toPrecision(12)}`, { x, y, z, value });
    }
    if (intersections.size < 3) continue;
    const polygon = [...intersections.values()];
    const center = polygon.reduce((sum, point) => ({ x: sum.x + point.x / polygon.length, y: sum.y + point.y / polygon.length, z: sum.z + point.z / polygon.length }), { x: 0, y: 0, z: 0 });
    const angle = (point: { x: number; y: number; z: number }) => {
      const delta = [point.x - center.x, point.y - center.y, point.z - center.z];
      return Math.atan2(delta[0] * basisV[0] + delta[1] * basisV[1] + delta[2] * basisV[2], delta[0] * basisU[0] + delta[1] * basisU[1] + delta[2] * basisU[2]);
    };
    polygon.sort((a, b) => angle(a) - angle(b));
    const base = points.length / 3;
    polygon.forEach((point) => {
      points.push(point.x, point.y, point.z);
      scalars.push(point.value);
    });
    for (let index = 1; index < polygon.length - 1; index += 1) {
      polys.push(3, base, base + index, base + index + 1);
      owners.push(elementIndex);
    }
  }
  return { points: new Float32Array(points), scalars: new Float32Array(scalars), polys: new Uint32Array(polys), owners, plane, normal };
}

const TETRA_DECOMPOSITIONS: Record<string, number[][]> = {
  tetra: [[0, 1, 2, 3]],
  hexahedron: [[0, 1, 3, 4], [1, 2, 3, 6], [1, 3, 4, 6], [1, 4, 5, 6], [3, 4, 6, 7]],
  wedge: [[0, 1, 2, 3], [1, 2, 3, 4], [2, 3, 4, 5]],
  pyramid: [[0, 1, 2, 4], [0, 2, 3, 4]],
};

function buildIsosurface(mesh: MeshData, field: string, isoValue: number, quality: MeshSettings["quality"]) {
  const source = mesh.nodeFields[field] ?? [];
  const points: number[] = [];
  const scalars: number[] = [];
  const polys: number[] = [];
  const owners: number[] = [];
  const tetraEdges: Array<[number, number]> = [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]];
  const elementLimit = quality === "high" ? Number.POSITIVE_INFINITY : quality === "balanced" ? 150_000 : mesh.statistics.visualizationTier === "progressive" ? 100_000 : mesh.statistics.visualizationTier === "decimated" ? 250_000 : Number.POSITIVE_INFINITY;
  const elementStride = Math.max(1, Math.ceil(mesh.elementIds.length / elementLimit));
  for (let elementIndex = 0; elementIndex < mesh.elementIds.length; elementIndex += elementStride) {
    const elementNodes = mesh.connectivity.slice(mesh.elementOffsets[elementIndex], mesh.elementOffsets[elementIndex + 1]);
    const tetrahedra = TETRA_DECOMPOSITIONS[mesh.elementTypes[elementIndex]] ?? [];
    for (const localTetra of tetrahedra) {
      const nodes = localTetra.map((local) => elementNodes[local]);
      if (nodes.some((node) => node === undefined)) continue;
      const intersections = new Map<string, { x: number; y: number; z: number }>();
      for (const [localA, localB] of tetraEdges) {
        const a = nodes[localA];
        const b = nodes[localB];
        const valueA = source[a];
        const valueB = source[b];
        if (valueA === null || valueA === undefined || valueB === null || valueB === undefined) continue;
        const da = valueA - isoValue;
        const db = valueB - isoValue;
        if ((da < 0 && db < 0) || (da > 0 && db > 0) || da === db) continue;
        const t = Math.max(0, Math.min(1, da / (da - db)));
        const x = mesh.coordinates.x[a] + (mesh.coordinates.x[b] - mesh.coordinates.x[a]) * t;
        const y = mesh.coordinates.y[a] + (mesh.coordinates.y[b] - mesh.coordinates.y[a]) * t;
        const z = mesh.coordinates.z[a] + (mesh.coordinates.z[b] - mesh.coordinates.z[a]) * t;
        intersections.set(`${x.toPrecision(12)}:${y.toPrecision(12)}:${z.toPrecision(12)}`, { x, y, z });
      }
      if (intersections.size < 3) continue;
      const polygon = [...intersections.values()];
      const center = polygon.reduce((sum, point) => ({ x: sum.x + point.x / polygon.length, y: sum.y + point.y / polygon.length, z: sum.z + point.z / polygon.length }), { x: 0, y: 0, z: 0 });
      if (polygon.length > 3) {
        const first = polygon[0];
        const second = polygon[1];
        const ux = first.x - center.x;
        const uy = first.y - center.y;
        const uz = first.z - center.z;
        const vx = second.x - center.x;
        const vy = second.y - center.y;
        const vz = second.z - center.z;
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        const bx = ny * uz - nz * uy;
        const by = nz * ux - nx * uz;
        const bz = nx * uy - ny * ux;
        polygon.sort((a, b) => {
          const angle = (point: { x: number; y: number; z: number }) => Math.atan2((point.x - center.x) * bx + (point.y - center.y) * by + (point.z - center.z) * bz, (point.x - center.x) * ux + (point.y - center.y) * uy + (point.z - center.z) * uz);
          return angle(a) - angle(b);
        });
      }
      const base = points.length / 3;
      polygon.forEach((point) => { points.push(point.x, point.y, point.z); scalars.push(isoValue); });
      for (let index = 1; index < polygon.length - 1; index += 1) {
        polys.push(3, base, base + index, base + index + 1);
        owners.push(elementIndex);
      }
    }
  }
  return { points: new Float32Array(points), scalars: new Float32Array(scalars), polys: new Uint32Array(polys), owners };
}

function vectorComponents(mesh: MeshData, activeField: string): [string, string, string] | null {
  const groups = new Map<string, Partial<Record<"x" | "y" | "z", string>>>();
  const normalizedFields = new Map<string, string>();
  for (const field of Object.keys(mesh.nodeFields)) {
    const normalized = field.toLowerCase().replace(/\[[^\]]*\]|\([^)]*\)/g, "").replace(/[^a-z0-9]/g, "");
    normalizedFields.set(normalized, field);
    const match = normalized.match(/^(.*)(x|y|z)$/);
    if (!match?.[1]) continue;
    const group = groups.get(match[1]) ?? {};
    group[match[2] as "x" | "y" | "z"] = field;
    groups.set(match[1], group);
  }
  if (normalizedFields.has("u") && normalizedFields.has("v") && normalizedFields.has("w")) {
    return [normalizedFields.get("u")!, normalizedFields.get("v")!, normalizedFields.get("w")!];
  }
  const activeNormalized = activeField.toLowerCase().replace(/\[[^\]]*\]|\([^)]*\)/g, "").replace(/[^a-z0-9]/g, "").replace(/[xyz]$/, "");
  const ordered = [...groups.entries()].sort(([base]) => base === activeNormalized ? -1 : 1);
  for (const [, group] of ordered) if (group.x && group.y && group.z) return [group.x, group.y, group.z];
  return null;
}

function buildVectors(mesh: MeshData, field: string, scale: number) {
  const components = vectorComponents(mesh, field);
  if (!components) return null;
  const vectors = components.map((component) => mesh.nodeFields[component]);
  const magnitudes = new Float32Array(mesh.nodeIds.length);
  let maxMagnitude = 0;
  for (let index = 0; index < mesh.nodeIds.length; index += 1) {
    const magnitude = Math.hypot(vectors[0][index] ?? 0, vectors[1][index] ?? 0, vectors[2][index] ?? 0);
    magnitudes[index] = magnitude;
    maxMagnitude = Math.max(maxMagnitude, magnitude);
  }
  const bounds = (["x", "y", "z"] as const).map((axis) => finiteRange(mesh.coordinates[axis]));
  const diagonal = Math.hypot(...bounds.map(([low, high]) => high - low)) || 1;
  const stride = Math.max(1, Math.ceil(mesh.nodeIds.length / 50_000));
  const count = Math.ceil(mesh.nodeIds.length / stride);
  const points = new Float32Array(count * 6);
  const lines = new Uint32Array(count * 3);
  const scalars = new Float32Array(count * 2);
  let output = 0;
  for (let node = 0; node < mesh.nodeIds.length; node += stride) {
    const x = mesh.coordinates.x[node];
    const y = mesh.coordinates.y[node];
    const z = mesh.coordinates.z[node];
    const factor = (diagonal * 0.06 * scale) / (maxMagnitude || 1);
    points[output * 6] = x;
    points[output * 6 + 1] = y;
    points[output * 6 + 2] = z;
    points[output * 6 + 3] = x + (vectors[0][node] ?? 0) * factor;
    points[output * 6 + 4] = y + (vectors[1][node] ?? 0) * factor;
    points[output * 6 + 5] = z + (vectors[2][node] ?? 0) * factor;
    lines[output * 3] = 2;
    lines[output * 3 + 1] = output * 2;
    lines[output * 3 + 2] = output * 2 + 1;
    scalars[output * 2] = magnitudes[node];
    scalars[output * 2 + 1] = magnitudes[node];
    output += 1;
  }
  return { points, lines, scalars, range: [0, maxMagnitude || 1] as [number, number], components };
}

function pointArray(mesh: MeshData): Float32Array {
  const values = new Float32Array(mesh.nodeIds.length * 3);
  for (let index = 0; index < mesh.nodeIds.length; index += 1) {
    values[index * 3] = mesh.coordinates.x[index];
    values[index * 3 + 1] = mesh.coordinates.y[index];
    values[index * 3 + 2] = mesh.coordinates.z[index];
  }
  return values;
}

function vtkPointsFor(mesh: MeshData) {
  const points = vtkPoints.newInstance();
  points.setData(pointArray(mesh), 3);
  return points;
}

function scalarLookup(min: number, max: number) {
  const lookup = vtkColorTransferFunction.newInstance();
  lookup.addRGBPoint(min, 0.071, 0.29, 0.58);
  lookup.addRGBPoint(min + (max - min) * 0.32, 0.137, 0.522, 0.718);
  lookup.addRGBPoint(min + (max - min) * 0.58, 0.325, 0.745, 0.776);
  lookup.addRGBPoint(min + (max - min) * 0.8, 0.957, 0.682, 0.243);
  lookup.addRGBPoint(max, 0.827, 0.251, 0.212);
  return lookup;
}

function exactRange(values: number[]): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  values.forEach((value) => { min = Math.min(min, value); max = Math.max(max, value); });
  return Number.isFinite(min) ? [min, max] : [0, 0];
}

function makeSelection(mesh: MeshData, kind: "element" | "node", index: number): MeshSelection | null {
  if (kind === "node") {
    if (index < 0 || index >= mesh.nodeIds.length) return null;
    const values = Object.fromEntries(
      Object.entries(mesh.nodeFields)
        .map(([field, entries]) => [field, entries[index]] as const)
        .filter((entry): entry is [string, number] => entry[1] !== null && Number.isFinite(entry[1])),
    );
    return {
      kind: "node",
      nodeIndex: index,
      nodeId: mesh.nodeIds[index],
      location: { x: mesh.coordinates.x[index], y: mesh.coordinates.y[index], z: mesh.coordinates.z[index] },
      values,
    };
  }
  if (index < 0 || index >= mesh.elementIds.length) return null;
  const start = mesh.elementOffsets[index];
  const end = mesh.elementOffsets[index + 1];
  const nodeIndexes = mesh.connectivity.slice(start, end);
  const centroid = nodeIndexes.reduce(
    (total, nodeIndex) => ({
      x: total.x + mesh.coordinates.x[nodeIndex] / nodeIndexes.length,
      y: total.y + mesh.coordinates.y[nodeIndex] / nodeIndexes.length,
      z: total.z + mesh.coordinates.z[nodeIndex] / nodeIndexes.length,
    }),
    { x: 0, y: 0, z: 0 },
  );
  const values: Record<string, number> = {};
  for (const [field, entries] of Object.entries(mesh.elementFields)) {
    const value = entries[index];
    if (value !== null && Number.isFinite(value)) values[field] = value;
  }
  for (const [field, entries] of Object.entries(mesh.nodeFields)) {
    if (field in values) continue;
    const usable = nodeIndexes.map((nodeIndex) => entries[nodeIndex]).filter((value): value is number => value !== null && Number.isFinite(value));
    if (usable.length) values[field] = usable.reduce((sum, value) => sum + value, 0) / usable.length;
  }
  return {
    kind: "element",
    elementIndex: index,
    elementId: mesh.elementIds[index],
    elementType: mesh.elementTypes[index],
    nodeIds: nodeIndexes.map((nodeIndex) => mesh.nodeIds[nodeIndex]),
    domainId: mesh.domainIds[index],
    boundaryId: mesh.boundaryIds[index],
    centroid,
    values,
  };
}

export default function MeshViewer({
  mesh,
  field,
  mode,
  settings,
  highlightedCellIndexes,
  highlightBounds,
  resetNonce,
  selection,
  onSelect,
}: {
  mesh: MeshData;
  field: string;
  mode: VisualizationMode;
  settings: MeshSettings;
  highlightedCellIndexes: number[];
  highlightBounds: MeshBounds | null;
  resetNonce: number;
  selection: MeshSelection | null;
  onSelect: (selection: MeshSelection | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<MeshContext | null>(null);
  const renderedSurfaceOwnersRef = useRef(mesh.surfaceOwners);
  const renderedSliceOwnersRef = useRef<number[]>([]);
  const stateRef = useRef({ mesh, settings, onSelect });
  const [renderError, setRenderError] = useState<string | null>(null);
  const [stage, setStage] = useState("Preparing GPU buffers");
  stateRef.current = { mesh, settings, onSelect };
  const values = mesh.nodeFields[field] ?? [];
  const [min, max] = useMemo(() => finiteRange(values), [values]);
  const [legend, setLegend] = useState({ label: field, min, max });
  const spatialBounds = useMemo(() => ({
    x: exactRange(mesh.coordinates.x),
    y: exactRange(mesh.coordinates.y),
    z: exactRange(mesh.coordinates.z),
  }), [mesh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || contextRef.current) return;
    try {
      const view = vtkGenericRenderWindow.newInstance({ background: [0.965, 0.98, 0.988] });
      view.setContainer(container);
      const createActor = () => {
        const mapper = vtkMapper.newInstance();
        mapper.setInputData(vtkPolyData.newInstance());
        const actor = vtkActor.newInstance();
        actor.setMapper(mapper);
        view.getRenderer().addActor(actor);
        return { mapper, actor };
      };
      const surface = createActor();
      const edges = createActor();
      const nodes = createActor();
      const highlights = createActor();
      const slice = createActor();
      const vectors = createActor();
      const selected = createActor();
      edges.actor.getProperty().setColor(0.09, 0.17, 0.23);
      nodes.actor.getProperty().setColor(0.05, 0.36, 0.55);
      nodes.actor.getProperty().setRepresentationToPoints();
      highlights.actor.getProperty().setRepresentationToSurface();
      highlights.actor.getProperty().setColor(0.9, 0.43, 0.04);
      highlights.actor.getProperty().setOpacity(0.92);
      highlights.actor.getProperty().setEdgeVisibility(true);
      highlights.actor.getProperty().setEdgeColor(0.55, 0.18, 0.02);
      highlights.actor.getProperty().setLineWidth(2);
      highlights.actor.setVisibility(false);
      selected.actor.getProperty().setColor(0.86, 0.19, 0.1);
      selected.actor.getProperty().setOpacity(0.95);
      slice.actor.getProperty().setEdgeColor(0.08, 0.15, 0.2);
      vectors.actor.getProperty().setLineWidth(2);

      const cellPicker = vtkCellPicker.newInstance();
      cellPicker.setPickFromList(true);
      cellPicker.initializePickList();
      cellPicker.addPickList(surface.actor);
      cellPicker.addPickList(slice.actor);
      const pointPicker = vtkPointPicker.newInstance();
      pointPicker.setPickFromList(true);
      pointPicker.initializePickList();
      pointPicker.addPickList(nodes.actor);
      const axesActor = vtkAxesActor.newInstance();
      const orientationWidget = vtkOrientationMarkerWidget.newInstance({
        actor: axesActor,
        interactor: view.getRenderWindow().getInteractor(),
      });
      orientationWidget.setViewportCorner(Corners.BOTTOM_RIGHT);
      orientationWidget.setViewportSize(0.13);
      orientationWidget.setMinPixelSize(70);
      orientationWidget.setMaxPixelSize(130);
      orientationWidget.setEnabled(true);
      const subscription = view.getInteractor().onLeftButtonPress(({ position }) => {
        const current = stateRef.current;
        if (current.settings.selectionMode === "node" && current.settings.showNodes) {
          pointPicker.pick([position.x, position.y, 0], view.getRenderer());
          current.onSelect(makeSelection(current.mesh, "node", pointPicker.getPointId()));
        } else {
          cellPicker.pick([position.x, position.y, 0], view.getRenderer());
          const cellId = cellPicker.getCellId();
          const pickedSlice = cellPicker.getActors()[0] === slice.actor;
          const owner = cellId >= 0 ? (pickedSlice ? renderedSliceOwnersRef.current[cellId] : renderedSurfaceOwnersRef.current[cellId]) : -1;
          current.onSelect(makeSelection(current.mesh, "element", owner));
        }
      });
      const resize = () => {
        if (container.clientWidth && container.clientHeight) view.resize();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      const frame = window.requestAnimationFrame(resize);
      contextRef.current = {
        view,
        surfaceMapper: surface.mapper,
        surfaceActor: surface.actor,
        edgeMapper: edges.mapper,
        edgeActor: edges.actor,
        nodeMapper: nodes.mapper,
        nodeActor: nodes.actor,
        highlightMapper: highlights.mapper,
        highlightActor: highlights.actor,
        sliceMapper: slice.mapper,
        sliceActor: slice.actor,
        vectorMapper: vectors.mapper,
        vectorActor: vectors.actor,
        selectionMapper: selected.mapper,
        selectionActor: selected.actor,
        cellPicker,
        pointPicker,
        orientationWidget,
        axesActor,
        unsubscribe: () => {
          subscription.unsubscribe();
          observer.disconnect();
          window.cancelAnimationFrame(frame);
        },
      };
    } catch {
      setRenderError("WebGL is unavailable, so the original FEM mesh cannot be rendered.");
    }
    return () => {
      const context = contextRef.current;
      if (!context) return;
      context.unsubscribe();
      context.orientationWidget.delete();
      context.axesActor.delete();
      context.view.delete();
      contextRef.current = null;
    };
  }, []);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    setStage("Building surface topology");
    const surface = vtkPolyData.newInstance();
    surface.setPoints(vtkPointsFor(mesh));
    const triangleCount = mesh.surfaceTriangles.length / 3;
    const surfaceLimit = settings.quality === "high"
      ? Number.POSITIVE_INFINITY
      : settings.quality === "balanced"
        ? 150_000
        : mesh.statistics.visualizationTier === "decimated"
          ? 300_000
          : mesh.statistics.visualizationTier === "progressive" ? 150_000 : Number.POSITIVE_INFINITY;
    const triangleStride = Math.max(1, Math.ceil(triangleCount / surfaceLimit));
    const renderedTriangleIndexes: number[] = [];
    for (let triangle = 0; triangle < triangleCount; triangle += triangleStride) renderedTriangleIndexes.push(triangle);
    renderedSurfaceOwnersRef.current = renderedTriangleIndexes.map((triangle) => mesh.surfaceOwners[triangle]);
    const polys = new Uint32Array(renderedTriangleIndexes.length * 4);
    renderedTriangleIndexes.forEach((triangle, outputTriangle) => {
      polys[outputTriangle * 4] = 3;
      polys[outputTriangle * 4 + 1] = mesh.surfaceTriangles[triangle * 3];
      polys[outputTriangle * 4 + 2] = mesh.surfaceTriangles[triangle * 3 + 1];
      polys[outputTriangle * 4 + 3] = mesh.surfaceTriangles[triangle * 3 + 2];
    });
    surface.setPolys(vtkCellArray.newInstance({ values: polys }));
    const sourceValues = mesh.nodeFields[field] ?? Array(mesh.nodeIds.length).fill(0);
    const surfaceRange = settings.elementColoring && mesh.elementFields[field] ? finiteRange(mesh.elementFields[field]) : [min, max];
    const pointScalars = new Float32Array(sourceValues.map((value) => value ?? min));
    surface.getPointData().setScalars(vtkDataArray.newInstance({ name: field, values: pointScalars, numberOfComponents: 1 }));
    if (settings.elementColoring) {
      const exact = mesh.elementFields[field];
      const cellValues = new Float32Array(renderedSurfaceOwnersRef.current.map((owner) => {
        if (exact?.[owner] !== null && exact?.[owner] !== undefined) return exact[owner] as number;
        const nodeIndexes = mesh.connectivity.slice(mesh.elementOffsets[owner], mesh.elementOffsets[owner + 1]);
        const usable = nodeIndexes.map((nodeIndex) => sourceValues[nodeIndex]).filter((value): value is number => value !== null && Number.isFinite(value));
        return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : min;
      }));
      surface.getCellData().setScalars(vtkDataArray.newInstance({ name: `${field} by element`, values: cellValues, numberOfComponents: 1 }));
      context.surfaceMapper.setScalarModeToUseCellData();
    } else {
      context.surfaceMapper.setScalarModeToUsePointData();
    }
    context.surfaceMapper.setInputData(surface);
    context.surfaceMapper.setLookupTable(scalarLookup(surfaceRange[0], surfaceRange[1]));
    context.surfaceMapper.setScalarRange(surfaceRange[0], surfaceRange[1]);
    context.surfaceMapper.setScalarVisibility(settings.renderType === "field" || mode === "field" || mode === "slice");

    const sourceEdges = settings.showInternalElements ? mesh.allEdges : mesh.surfaceEdges;
    const edgeCount = sourceEdges.length / 2;
    const edgeLimit = settings.quality === "high" ? Number.POSITIVE_INFINITY : settings.quality === "balanced" ? 200_000 : mesh.statistics.visualizationTier === "progressive" ? 200_000 : 400_000;
    const edgeStride = Math.max(1, Math.ceil(edgeCount / edgeLimit));
    const edgeIndexes: number[] = [];
    for (let edge = 0; edge < edgeCount; edge += edgeStride) edgeIndexes.push(sourceEdges[edge * 2], sourceEdges[edge * 2 + 1]);
    const edgeData = vtkPolyData.newInstance();
    edgeData.setPoints(vtkPointsFor(mesh));
    const lines = new Uint32Array((edgeIndexes.length / 2) * 3);
    for (let edge = 0; edge < edgeIndexes.length / 2; edge += 1) {
      lines[edge * 3] = 2;
      lines[edge * 3 + 1] = edgeIndexes[edge * 2];
      lines[edge * 3 + 2] = edgeIndexes[edge * 2 + 1];
    }
    edgeData.setLines(vtkCellArray.newInstance({ values: lines }));
    context.edgeMapper.setInputData(edgeData);

    const nodeData = vtkPolyData.newInstance();
    nodeData.setPoints(vtkPointsFor(mesh));
    const nodeStride = settings.quality === "high" ? 1 : mesh.nodeIds.length > 300_000 ? Math.ceil(mesh.nodeIds.length / 300_000) : 1;
    const renderedNodeCount = settings.showNodes ? Math.ceil(mesh.nodeIds.length / nodeStride) : 0;
    const verts = new Uint32Array(renderedNodeCount * 2);
    let nodeOutput = 0;
    for (let index = 0; index < mesh.nodeIds.length; index += nodeStride) {
      verts[nodeOutput * 2] = 1;
      verts[nodeOutput * 2 + 1] = index;
      nodeOutput += 1;
    }
    nodeData.setVerts(vtkCellArray.newInstance({ values: verts }));
    context.nodeMapper.setInputData(nodeData);
    context.view.getRenderer().resetCamera();
    context.view.getRenderer().resetCameraClippingRange();
    context.view.getRenderWindow().render();
    setLegend({ label: settings.elementColoring ? `${field} by element` : field, min: surfaceRange[0], max: surfaceRange[1] });
    setStage("");
  }, [field, mesh, min, max, mode, settings.elementColoring, settings.quality, settings.showInternalElements, settings.showNodes, settings.renderType]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    const indexes = highlightedCellIndexes.filter((index) => index >= 0 && index < mesh.elementIds.length);
    const data = buildCellHighlight(mesh, indexes);
    context.highlightMapper.setInputData(data);
    context.highlightMapper.setScalarVisibility(false);
    context.highlightActor.setVisibility(indexes.length > 0);
    context.surfaceActor.getProperty().setOpacity(indexes.length ? Math.min(settings.opacity, 0.38) : settings.opacity);
    context.view.getRenderWindow().render();
  }, [highlightedCellIndexes, mesh, settings.opacity]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context || !highlightBounds || !highlightedCellIndexes.length) return;
    const bounds: [number, number, number, number, number, number] = [
      highlightBounds.x[0], highlightBounds.x[1],
      highlightBounds.y[0], highlightBounds.y[1],
      highlightBounds.z[0], highlightBounds.z[1],
    ];
    context.view.getRenderer().resetCamera(bounds);
    context.view.getRenderer().resetCameraClippingRange(bounds);
    context.view.getRenderWindow().render();
  }, [highlightBounds, highlightedCellIndexes.length]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    if (mode !== "slice" && mode !== "isosurface") {
      context.sliceActor.setVisibility(false);
      context.view.getRenderWindow().render();
      return;
    }
    setStage(mode === "slice" ? "Intersecting finite elements" : "Extracting isosurface");
    const special = mode === "slice"
      ? buildSlice(mesh, field, settings)
      : buildIsosurface(mesh, field, settings.isoValue ?? (min + max) / 2, settings.quality);
    renderedSliceOwnersRef.current = special.owners;
    const polyData = vtkPolyData.newInstance();
    const points = vtkPoints.newInstance();
    points.setData(special.points, 3);
    polyData.setPoints(points);
    polyData.setPolys(vtkCellArray.newInstance({ values: special.polys }));
    polyData.getPointData().setScalars(vtkDataArray.newInstance({ name: `${field} ${mode}`, values: special.scalars, numberOfComponents: 1 }));
    context.sliceMapper.setInputData(polyData);
    context.sliceMapper.setLookupTable(scalarLookup(min, max));
    context.sliceMapper.setScalarRange(min, max);
    context.sliceMapper.setScalarModeToUsePointData();
    context.sliceMapper.setScalarVisibility(true);
    context.sliceActor.getProperty().setOpacity(settings.opacity);
    context.sliceActor.getProperty().setEdgeVisibility(settings.showEdges);
    context.sliceActor.getProperty().setLineWidth(settings.edgeThickness);
    context.sliceActor.setVisibility(special.polys.length > 0);
    context.view.getRenderWindow().render();
    setLegend({ label: field, min, max });
    setStage("");
  }, [field, mesh, min, max, mode, settings]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    if (mode !== "vector") {
      context.vectorActor.setVisibility(false);
      context.view.getRenderWindow().render();
      return;
    }
    setStage("Preparing vector buffers");
    const vectors = buildVectors(mesh, field, settings.vectorScale);
    if (!vectors) {
      context.vectorActor.setVisibility(false);
      setStage("");
      return;
    }
    const polyData = vtkPolyData.newInstance();
    const points = vtkPoints.newInstance();
    points.setData(vectors.points, 3);
    polyData.setPoints(points);
    polyData.setLines(vtkCellArray.newInstance({ values: vectors.lines }));
    polyData.getPointData().setScalars(vtkDataArray.newInstance({ name: "Vector magnitude", values: vectors.scalars, numberOfComponents: 1 }));
    context.vectorMapper.setInputData(polyData);
    context.vectorMapper.setLookupTable(scalarLookup(...vectors.range));
    context.vectorMapper.setScalarRange(...vectors.range);
    context.vectorMapper.setScalarModeToUsePointData();
    context.vectorMapper.setScalarVisibility(true);
    context.vectorActor.setVisibility(true);
    context.view.getRenderWindow().render();
    setLegend({ label: "Vector magnitude", min: vectors.range[0], max: vectors.range[1] });
    setStage("");
  }, [field, mesh, mode, settings.vectorScale]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    const showSurface = mode !== "slice" && mode !== "isosurface" && settings.showMesh && settings.showSurfaceElements && settings.renderType !== "wireframe";
    context.surfaceActor.setVisibility(showSurface);
    context.surfaceActor.getProperty().setOpacity(highlightedCellIndexes.length ? Math.min(settings.opacity, 0.38) : settings.opacity);
    context.surfaceActor.getProperty().setColor(0.57, 0.72, 0.8);
    context.edgeActor.setVisibility(mode !== "slice" && mode !== "isosurface" && settings.showMesh && settings.showEdges);
    context.edgeActor.getProperty().setLineWidth(settings.edgeThickness);
    context.nodeActor.setVisibility(mode !== "slice" && mode !== "isosurface" && settings.showMesh && settings.showNodes);
    context.nodeActor.getProperty().setPointSize(settings.nodeSize);
    context.view.getRenderer().getActiveCamera().setParallelProjection(settings.projection === "orthographic");
    const planes = (["x", "y", "z"] as const).flatMap((axis, index) => {
      const value = settings.clip[axis];
      if (value === null) return [];
      const origin: [number, number, number] = [0, 0, 0];
      const normal: [number, number, number] = [0, 0, 0];
      origin[index] = value;
      normal[index] = 1;
      return [vtkPlane.newInstance({ origin, normal })];
    });
    [context.surfaceMapper, context.edgeMapper, context.nodeMapper, context.highlightMapper, context.selectionMapper].forEach((mapper) => mapper.setClippingPlanes(planes));
    context.sliceMapper.setClippingPlanes(mode === "slice" ? [] : planes);
    context.vectorMapper.setClippingPlanes(planes);
    context.view.getRenderer().resetCameraClippingRange();
    context.view.getRenderWindow().render();
  }, [highlightedCellIndexes.length, mode, settings]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    if (!selection) {
      context.selectionActor.setVisibility(false);
      context.view.getRenderWindow().render();
      return;
    }
    const selectedData = vtkPolyData.newInstance();
    selectedData.setPoints(vtkPointsFor(mesh));
    if (selection.kind === "node") {
      selectedData.setVerts(vtkCellArray.newInstance({ values: new Uint32Array([1, selection.nodeIndex]) }));
      context.selectionActor.getProperty().setRepresentationToPoints();
      context.selectionActor.getProperty().setPointSize(settings.nodeSize + 7);
    } else {
      if (mode === "slice" || mode === "isosurface") {
        const sliced = mode === "slice" ? buildSlice(mesh, field, settings) : buildIsosurface(mesh, field, settings.isoValue ?? (min + max) / 2, settings.quality);
        const points = vtkPoints.newInstance();
        points.setData(sliced.points, 3);
        selectedData.setPoints(points);
        const triangles: number[] = [];
        sliced.owners.forEach((owner, triangle) => {
          if (owner === selection.elementIndex) triangles.push(...Array.from(sliced.polys.slice(triangle * 4, triangle * 4 + 4)));
        });
        selectedData.setPolys(vtkCellArray.newInstance({ values: new Uint32Array(triangles) }));
      } else {
        const triangles: number[] = [];
        mesh.surfaceOwners.forEach((owner, triangle) => {
          if (owner === selection.elementIndex) triangles.push(3, ...mesh.surfaceTriangles.slice(triangle * 3, triangle * 3 + 3));
        });
        selectedData.setPolys(vtkCellArray.newInstance({ values: new Uint32Array(triangles) }));
      }
      context.selectionActor.getProperty().setRepresentationToSurface();
    }
    context.selectionMapper.setInputData(selectedData);
    context.selectionMapper.setScalarVisibility(false);
    context.selectionActor.setVisibility(true);
    context.view.getRenderWindow().render();
  }, [field, max, mesh, min, mode, selection, settings]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    context.view.getRenderer().resetCamera();
    context.view.getRenderer().resetCameraClippingRange();
    context.view.getRenderWindow().render();
  }, [resetNonce]);

  if (renderError) return <div className="grid min-h-[520px] place-items-center p-6 text-sm text-[#9b3528]">{renderError}</div>;
  return (
    <div className="relative h-full min-h-[520px] overflow-hidden bg-[#f6fafc]">
      <div aria-label={`Original COMSOL FEM mesh with ${mesh.statistics.nodeCount} nodes and ${mesh.statistics.elementCount} elements${highlightedCellIndexes.length ? ` and ${highlightedCellIndexes.length} threshold-selected elements highlighted` : ""}.`} className="absolute inset-0 touch-none" ref={containerRef} role="img" tabIndex={0} />
      {stage && <div className="absolute inset-0 z-10 grid place-items-center bg-white/70 text-sm font-medium text-[#0f7f8c] backdrop-blur-sm">{stage}…</div>}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-[#b5ddd9] bg-[#edf8f6]/95 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#176c67] shadow-sm">Original COMSOL mesh</div>
      {highlightedCellIndexes.length > 0 && <div className="pointer-events-none absolute bottom-12 left-3 rounded-md border border-[#e8b591] bg-[#fff3ea]/95 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#a9472d] shadow-sm">{highlightedCellIndexes.length.toLocaleString()} selected mesh elements</div>}
      <div className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 rounded-md border border-[#c6d5df] bg-white/92 px-2 py-1 font-mono text-[9px] text-[#526f82] shadow-sm lg:block">X {formatNumber(spatialBounds.x[0])}…{formatNumber(spatialBounds.x[1])} · Y {formatNumber(spatialBounds.y[0])}…{formatNumber(spatialBounds.y[1])} · Z {formatNumber(spatialBounds.z[0])}…{formatNumber(spatialBounds.z[1])}</div>
      {(settings.renderType === "field" || mode === "field" || mode === "slice" || mode === "isosurface" || mode === "vector") && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-[#c6d5df] bg-white/92 px-3 py-2 text-[10px] text-[#567184] shadow-sm">
          <div className="mb-1 max-w-40 truncate font-semibold text-[#294b63]">{legend.label}</div>
          <div className="h-2 w-32 rounded bg-[linear-gradient(90deg,#124a94,#2385b7_32%,#53bec6_58%,#f4ae3e_80%,#d34036)]" />
          <div className="mt-1 flex justify-between font-mono"><span>{formatNumber(legend.min)}</span><span>{formatNumber(legend.max)}</span></div>
        </div>
      )}
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-[#c6d5df] bg-white/92 px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-[#526f82] shadow-sm">Drag rotate · shift drag pan · wheel zoom</div>
    </div>
  );
}
