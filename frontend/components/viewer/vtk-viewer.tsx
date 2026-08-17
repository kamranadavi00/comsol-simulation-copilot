"use client";

import { useEffect, useRef, useState } from "react";

import "@kitware/vtk.js/Rendering/Profiles/Geometry";
import vtkDataArray from "@kitware/vtk.js/Common/Core/DataArray";
import vtkPoints from "@kitware/vtk.js/Common/Core/Points";
import vtkCellArray from "@kitware/vtk.js/Common/Core/CellArray";
import vtkPolyData from "@kitware/vtk.js/Common/DataModel/PolyData";
import vtkActor from "@kitware/vtk.js/Rendering/Core/Actor";
import vtkColorTransferFunction from "@kitware/vtk.js/Rendering/Core/ColorTransferFunction";
import vtkMapper from "@kitware/vtk.js/Rendering/Core/Mapper";
import vtkPointPicker from "@kitware/vtk.js/Rendering/Core/PointPicker";
import vtkGenericRenderWindow from "@kitware/vtk.js/Rendering/Misc/GenericRenderWindow";

import ScalarMap2D from "./scalar-map-2d";
import { finiteRange } from "@/lib/visualization";
import type { PointData, Representation, SelectedPoint } from "@/types/datasets";

type VtkContext = {
  view: ReturnType<typeof vtkGenericRenderWindow.newInstance>;
  mapper: ReturnType<typeof vtkMapper.newInstance>;
  actor: ReturnType<typeof vtkActor.newInstance>;
  highlightMapper: ReturnType<typeof vtkMapper.newInstance>;
  highlightActor: ReturnType<typeof vtkActor.newInstance>;
  selectionMapper: ReturnType<typeof vtkMapper.newInstance>;
  selectionActor: ReturnType<typeof vtkActor.newInstance>;
  unsubscribePick: () => void;
};

export default function VtkViewer({
  data,
  field,
  representation,
  selectedPoint,
  highlightedRowIndexes,
  resetNonce,
  onSelect,
}: {
  data: PointData;
  field: string;
  representation: Representation;
  selectedPoint: SelectedPoint | null;
  highlightedRowIndexes: number[];
  resetNonce: number;
  onSelect: (position: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<VtkContext | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const selectRef = useRef(onSelect);
  const [renderError, setRenderError] = useState<string | null>(null);
  selectRef.current = onSelect;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || contextRef.current) return;
    try {
      const view = vtkGenericRenderWindow.newInstance({ background: [0.973, 0.984, 0.992] });
      view.setContainer(container);
      const mapper = vtkMapper.newInstance();
      // Resize can trigger a render before the data effect below runs. Give the
      // mapper a valid input immediately so VTK never renders an unbound mapper.
      mapper.setInputData(vtkPolyData.newInstance());
      const actor = vtkActor.newInstance();
      actor.setMapper(mapper);
      actor.getProperty().setPointSize(5);
      view.getRenderer().addActor(actor);

      const highlightMapper = vtkMapper.newInstance();
      highlightMapper.setInputData(vtkPolyData.newInstance());
      const highlightActor = vtkActor.newInstance();
      highlightActor.setMapper(highlightMapper);
      highlightActor.getProperty().setRepresentationToPoints();
      highlightActor.getProperty().setPointSize(10);
      highlightActor.getProperty().setColor(0.851, 0.467, 0.024);
      highlightActor.setVisibility(false);
      view.getRenderer().addActor(highlightActor);

      const selectionMapper = vtkMapper.newInstance();
      selectionMapper.setInputData(vtkPolyData.newInstance());
      const selectionActor = vtkActor.newInstance();
      selectionActor.setMapper(selectionMapper);
      selectionActor.getProperty().setRepresentationToPoints();
      selectionActor.getProperty().setPointSize(15);
      selectionActor.getProperty().setColor(0.82, 0.18, 0.12);
      selectionActor.setVisibility(false);
      view.getRenderer().addActor(selectionActor);

      const picker = vtkPointPicker.newInstance();
      picker.setPickFromList(true);
      picker.initializePickList();
      picker.addPickList(actor);
      const subscription = view.getInteractor().onLeftButtonPress(({ position }) => {
        picker.pick([position.x, position.y, 0], view.getRenderer());
        const pointId = picker.getPointId();
        if (pointId >= 0) selectRef.current(pointId);
      });

      const resize = () => {
        if (!container.isConnected || container.clientWidth === 0 || container.clientHeight === 0) return;
        view.resize();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      const resizeFrame = window.requestAnimationFrame(resize);
      contextRef.current = {
        view,
        mapper,
        actor,
        highlightMapper,
        highlightActor,
        selectionMapper,
        selectionActor,
        unsubscribePick: () => {
          subscription.unsubscribe();
          observer.disconnect();
          window.cancelAnimationFrame(resizeFrame);
        },
      };
    } catch {
      setRenderError("WebGL is unavailable. Use a 2D dataset or a WebGL-capable browser.");
    }

    return () => {
      const context = contextRef.current;
      if (!context) return;
      context.unsubscribePick();
      if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
      context.view.delete();
      contextRef.current = null;
    };
  }, []);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    const count = data.returnedPoints;
    const coordinates = new Float32Array(count * 3);
    const cells = new Uint32Array(count * 2);
    const values = new Float32Array(count);
    const sourceValues = data.fields[field] ?? [];
    const [min, max] = finiteRange(sourceValues);
    for (let index = 0; index < count; index += 1) {
      coordinates[index * 3] = data.coordinates.x[index];
      coordinates[index * 3 + 1] = data.coordinates.y[index];
      coordinates[index * 3 + 2] = data.coordinates.z?.[index] ?? 0;
      cells[index * 2] = 1;
      cells[index * 2 + 1] = index;
      values[index] = sourceValues[index] ?? min;
    }
    const points = vtkPoints.newInstance();
    points.setData(coordinates, 3);
    const polyData = vtkPolyData.newInstance();
    polyData.setPoints(points);
    polyData.setVerts(vtkCellArray.newInstance({ values: cells }));
    polyData.getPointData().setScalars(vtkDataArray.newInstance({ name: field, values, numberOfComponents: 1 }));

    const lookup = vtkColorTransferFunction.newInstance();
    lookup.addRGBPoint(min, 0.071, 0.29, 0.58);
    lookup.addRGBPoint(min + (max - min) * 0.32, 0.137, 0.522, 0.718);
    lookup.addRGBPoint(min + (max - min) * 0.58, 0.325, 0.745, 0.776);
    lookup.addRGBPoint(min + (max - min) * 0.8, 0.957, 0.682, 0.243);
    lookup.addRGBPoint(max, 0.827, 0.251, 0.212);
    context.mapper.setInputData(polyData);
    context.mapper.setLookupTable(lookup);
    context.mapper.setScalarRange(min, max);
    context.mapper.setScalarVisibility(true);
    context.view.getRenderer().resetCamera();
    context.view.getRenderer().resetCameraClippingRange();
    context.view.getRenderWindow().render();
  }, [data, field]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    const highlighted = new Set(highlightedRowIndexes);
    const positions = data.rowIndexes
      .map((rowIndex, position) => (highlighted.has(rowIndex) ? position : -1))
      .filter((position) => position >= 0);
    const coordinates = new Float32Array(positions.length * 3);
    const cells = new Uint32Array(positions.length * 2);
    positions.forEach((position, index) => {
      coordinates[index * 3] = data.coordinates.x[position];
      coordinates[index * 3 + 1] = data.coordinates.y[position];
      coordinates[index * 3 + 2] = data.coordinates.z?.[position] ?? 0;
      cells[index * 2] = 1;
      cells[index * 2 + 1] = index;
    });
    const points = vtkPoints.newInstance();
    points.setData(coordinates, 3);
    const polyData = vtkPolyData.newInstance();
    polyData.setPoints(points);
    polyData.setVerts(vtkCellArray.newInstance({ values: cells }));
    context.highlightMapper.setInputData(polyData);
    context.highlightActor.setVisibility(positions.length > 0);
    context.actor.getProperty().setOpacity(positions.length > 0 ? 0.3 : 1);
    context.view.getRenderWindow().render();
  }, [data, highlightedRowIndexes]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    const property = context.actor.getProperty();
    if (representation === "points") property.setRepresentationToPoints();
    if (representation === "surface") property.setRepresentationToSurface();
    if (representation === "wireframe") property.setRepresentationToWireframe();
    context.view.getRenderWindow().render();
  }, [representation]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    if (!selectedPoint) {
      context.selectionActor.setVisibility(false);
      context.view.getRenderWindow().render();
      return;
    }

    const { x, y, z = 0 } = selectedPoint.location;
    const points = vtkPoints.newInstance();
    points.setData(new Float32Array([x, y, z]), 3);
    const polyData = vtkPolyData.newInstance();
    polyData.setPoints(points);
    polyData.setVerts(vtkCellArray.newInstance({ values: new Uint32Array([1, 0]) }));
    context.selectionMapper.setInputData(polyData);
    context.selectionActor.setVisibility(true);

    const camera = context.view.getRenderer().getActiveCamera();
    const startFocal = [...camera.getFocalPoint()];
    const startPosition = [...camera.getPosition()];
    const target = [x, y, z];
    const endPosition = target.map(
      (coordinate, index) => coordinate + (startPosition[index] - startFocal[index]) * 0.65,
    );
    const startTime = performance.now();
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260;
    const animate = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - startTime) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const focal = target.map(
        (coordinate, index) => startFocal[index] + (coordinate - startFocal[index]) * eased,
      );
      const position = endPosition.map(
        (coordinate, index) => startPosition[index] + (coordinate - startPosition[index]) * eased,
      );
      camera.setFocalPoint(focal[0], focal[1], focal[2]);
      camera.setPosition(position[0], position[1], position[2]);
      context.view.getRenderer().resetCameraClippingRange();
      context.view.getRenderWindow().render();
      focusFrameRef.current = progress < 1 ? window.requestAnimationFrame(animate) : null;
    };
    focusFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
      focusFrameRef.current = null;
    };
  }, [selectedPoint]);

  useEffect(() => {
    const context = contextRef.current;
    if (!context) return;
    context.view.getRenderer().resetCamera();
    context.view.getRenderWindow().render();
  }, [resetNonce]);

  if (renderError) {
    return (
      <div className="relative min-h-[420px]">
        <ScalarMap2D data={data} field={field} highlightedRowIndexes={highlightedRowIndexes} onSelect={onSelect} selectedPoint={selectedPoint} />
        <p className="absolute bottom-3 left-3 right-3 rounded-md border border-[#edcfa6] bg-[#fff8ed]/95 px-3 py-2 text-xs text-[#9b5b19] shadow-sm">
          {renderError} Showing an interactive X–Y scalar projection instead.
        </p>
      </div>
    );
  }
  return (
    <div className="relative h-full min-h-[420px]">
      <div
        aria-label={`Interactive 3D point-cloud visualization of ${field}${highlightedRowIndexes.length ? ` with verified matching points highlighted` : ""}. Drag to rotate, scroll to zoom, and click a point to inspect it.`}
        className="absolute inset-0 touch-none"
        ref={containerRef}
        role="img"
        tabIndex={0}
      />
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-[#c6d5df] bg-white/90 px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-[#526f82] shadow-sm">
        Drag rotate · shift drag pan · wheel zoom
      </div>
    </div>
  );
}
