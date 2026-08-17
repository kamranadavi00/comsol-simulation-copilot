import { Activity } from "lucide-react";

import { formatNumber } from "@/lib/visualization";
import type { ProfileResult } from "@/types/datasets";
import { Panel } from "@/components/ui/panel";

export function ProfileChart({ profile }: { profile: ProfileResult | null }) {
  const width = 700;
  const height = 190;
  const padding = { left: 54, right: 18, top: 20, bottom: 34 };
  const positions = profile?.points.map((point) => point.position) ?? [];
  const values = profile?.points.map((point) => point.value) ?? [];
  const minX = positions.length ? Math.min(...positions) : 0;
  const maxX = positions.length ? Math.max(...positions) : 1;
  const minY = values.length ? Math.min(...values) : 0;
  const maxY = values.length ? Math.max(...values) : 1;
  const path = profile?.points
    .map((point, index) => {
      const x = padding.left + ((point.position - minX) / (maxX - minX || 1)) * (width - padding.left - padding.right);
      const y = padding.top + (1 - (point.value - minY) / (maxY - minY || 1)) * (height - padding.top - padding.bottom);
      return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ") ?? "";

  return (
    <Panel action={<Activity className="text-[#0b7bb5]" size={17} />} eyebrow="Centerline sample" title={profile ? `${profile.field} along ${profile.axis.toUpperCase()}` : "Line profile"}>
      {profile?.points.length ? (
        <div className="p-3">
          <svg aria-label={`Line profile of ${profile.field} along ${profile.axis}, from ${minY} to ${maxY}.`} className="h-48 w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
            {[0, 0.5, 1].map((tick) => {
              const y = padding.top + tick * (height - padding.top - padding.bottom);
              return <line key={tick} stroke="#d7e2ea" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />;
            })}
            <path d={path} fill="none" stroke="#0b7bb5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            <text fill="#567184" fontSize="11" x={padding.left} y={height - 8}>{formatNumber(minX)}</text>
            <text fill="#567184" fontSize="11" textAnchor="end" x={width - padding.right} y={height - 8}>{formatNumber(maxX)}</text>
            <text fill="#567184" fontSize="11" x={6} y={padding.top + 4}>{formatNumber(maxY)}</text>
            <text fill="#567184" fontSize="11" x={6} y={height - padding.bottom}>{formatNumber(minY)}</text>
          </svg>
        </div>
      ) : (
        <div className="grid min-h-48 place-items-center p-6 text-center text-sm text-[#567184]">Create a profile from the controls or ask the assistant.</div>
      )}
    </Panel>
  );
}
