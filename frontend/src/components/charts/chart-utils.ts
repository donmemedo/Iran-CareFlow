"use client";

import { useEffect, useRef, useState } from "react";

/** Width-aware charts without a charting library. */
export function useChartWidth<T extends HTMLElement>(fallback = 720) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && Math.abs(next - width) > 1) setWidth(next);
    });
    observer.observe(node);
    setWidth(node.getBoundingClientRect().width || fallback);
    return () => observer.disconnect();
  }, [fallback, width]);

  return { ref, width };
}

export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min, max];
  const span = max - min;
  const rawStep = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * magnitude);
  const step = candidates.find((c) => c >= rawStep) ?? candidates[candidates.length - 1];
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + step * 0.5; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return ticks;
}

/** Catmull-Rom to cubic Bezier - smooth without overshooting into nonsense. */
export function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  }
  let path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return path;
}

export const chartTheme = {
  grid: "var(--grid)",
  axis: "var(--axis)",
  muted: "var(--text-muted)",
  surface: "var(--chart-surface)",
  ink: "var(--text-primary)",
  secondary: "var(--text-secondary)",
};
