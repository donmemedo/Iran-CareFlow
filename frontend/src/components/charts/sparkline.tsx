"use client";

import { useId } from "react";
import { smoothPath } from "./chart-utils";

export function Sparkline({
  values,
  color = "var(--color-series-1)",
  width = 120,
  height = 34,
  filled = true,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  filled?: boolean;
}) {
  const gradientId = useId();
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => ({
    x: (index / (values.length - 1)) * width,
    y: height - 3 - ((value - min) / span) * (height - 7),
  }));
  const line = smoothPath(points);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
      {filled ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${gradientId})`} />
        </>
      ) : null}
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={3} fill={color} />
    </svg>
  );
}
