"use client";

import { useEffect, useRef } from "react";

import { finiteRange, scalarColor } from "@/lib/visualization";
import type { PointData, SelectedPoint } from "@/types/datasets";

export default function ScalarMap2D({
  data,
  field,
  selectedPoint,
  onSelect,
}: {
  data: PointData;
  field: string;
  selectedPoint: SelectedPoint | null;
  onSelect: (position: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<{ left: number; top: number; width: number; height: number; minX: number; maxX: number; minY: number; maxY: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    function render() {
      if (!canvas || !parent) return;
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#f8fbfd";
      context.fillRect(0, 0, width, height);

      const left = 48;
      const top = 22;
      const plotWidth = Math.max(1, width - 68);
      const plotHeight = Math.max(1, height - 58);
      const minX = Math.min(...data.coordinates.x);
      const maxX = Math.max(...data.coordinates.x);
      const minY = Math.min(...data.coordinates.y);
      const maxY = Math.max(...data.coordinates.y);
      transformRef.current = { left, top, width: plotWidth, height: plotHeight, minX, maxX, minY, maxY };
      const values = data.fields[field] ?? [];
      const [min, max] = finiteRange(values);
      const count = Math.max(1, data.returnedPoints);
      const radius = Math.max(2, Math.min(7, Math.sqrt((plotWidth * plotHeight) / count) * 0.42));

      context.strokeStyle = "#d9e5ec";
      context.lineWidth = 1;
      for (let tick = 0; tick <= 4; tick += 1) {
        const x = left + (plotWidth * tick) / 4;
        const y = top + (plotHeight * tick) / 4;
        context.beginPath(); context.moveTo(x, top); context.lineTo(x, top + plotHeight); context.stroke();
        context.beginPath(); context.moveTo(left, y); context.lineTo(left + plotWidth, y); context.stroke();
      }

      for (let index = 0; index < count; index += 1) {
        const value = values[index];
        if (value === null || !Number.isFinite(value)) continue;
        const x = left + ((data.coordinates.x[index] - minX) / (maxX - minX || 1)) * plotWidth;
        const y = top + plotHeight - ((data.coordinates.y[index] - minY) / (maxY - minY || 1)) * plotHeight;
        context.fillStyle = scalarColor(value, min, max, 0.9);
        context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
        if (selectedPoint?.rowIndex === data.rowIndexes[index]) {
          context.strokeStyle = "#df6c2f";
          context.lineWidth = 3;
          context.beginPath(); context.arc(x, y, radius + 5, 0, Math.PI * 2); context.stroke();
        }
      }

      context.fillStyle = "#567184";
      context.font = "11px ui-monospace, monospace";
      context.fillText(String(minX.toPrecision(4)), left, height - 14);
      context.textAlign = "right";
      context.fillText(String(maxX.toPrecision(4)), left + plotWidth, height - 14);
      context.save();
      context.translate(14, top + plotHeight / 2);
      context.rotate(-Math.PI / 2);
      context.textAlign = "center";
      context.fillText("Y coordinate", 0, 0);
      context.restore();
      context.textAlign = "center";
      context.fillText("X coordinate", left + plotWidth / 2, height - 2);
    }

    render();
    const observer = new ResizeObserver(render);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [data, field, selectedPoint]);

  function handlePointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const transform = transformRef.current;
    const canvas = canvasRef.current;
    if (!transform || !canvas || !data.returnedPoints) return;
    const bounds = canvas.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    let nearest = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < data.returnedPoints; index += 1) {
      const x = transform.left + ((data.coordinates.x[index] - transform.minX) / (transform.maxX - transform.minX || 1)) * transform.width;
      const y = transform.top + transform.height - ((data.coordinates.y[index] - transform.minY) / (transform.maxY - transform.minY || 1)) * transform.height;
      const distance = (x - pointerX) ** 2 + (y - pointerY) ** 2;
      if (distance < nearestDistance) { nearestDistance = distance; nearest = index; }
    }
    if (nearest >= 0 && nearestDistance <= 24 ** 2) onSelect(nearest);
  }

  const [min, max] = finiteRange(data.fields[field] ?? []);
  return (
    <div className="relative h-full min-h-[360px] overflow-hidden bg-[#f8fbfd]">
      <canvas
        aria-label={`Interactive 2D scalar map of ${field}, showing ${data.returnedPoints} points from ${min} to ${max}. Click a point to inspect it.`}
        className="block touch-manipulation"
        onPointerDown={handlePointer}
        ref={canvasRef}
        role="img"
      />
      <div className="pointer-events-none absolute right-4 top-4 rounded-md border border-[#c6d5df] bg-white/90 px-3 py-2 text-[10px] text-[#567184] shadow-sm backdrop-blur">
        <div className="mb-1 font-semibold uppercase tracking-wider text-[#294b63]">{field}</div>
        <div className="h-1.5 w-28 rounded-full bg-[linear-gradient(90deg,#124a94_0%,#2385b7_32%,#53bec6_58%,#f4ae3e_80%,#d34036_100%)]" />
        <div className="mt-1 flex justify-between font-mono"><span>{min.toPrecision(3)}</span><span>{max.toPrecision(3)}</span></div>
      </div>
    </div>
  );
}
