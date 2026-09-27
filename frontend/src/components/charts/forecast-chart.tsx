"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { chartTheme, niceTicks, smoothPath, useChartWidth } from "./chart-utils";
import { formatDate, formatNumber } from "@/lib/format";
import type { Locale } from "@/i18n/config";

export type ForecastSeries = {
  history: { day: string; value: number }[];
  forecast: { day: string; value: number; lower: number; upper: number }[];
  capacity?: number;
};

type Props = ForecastSeries & {
  locale: Locale;
  labels: { history: string; forecast: string; capacity: string; showTable: string; hideTable: string };
  height?: number;
  valueSuffix?: string;
  colorVar?: string;
};

/**
 * One measure, one axis: observed occupancy and its projection share a hue
 * because they are the same entity - the dash and the band carry "forecast".
 */
export function ForecastChart({
  history,
  forecast,
  capacity,
  locale,
  labels,
  height = 300,
  valueSuffix = "",
  colorVar = "var(--color-series-1)",
}: Props) {
  const { ref, width } = useChartWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const pad = { top: 18, right: 16, bottom: 30, left: 44 };
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = Math.max(height - pad.top - pad.bottom, 10);

  const model = useMemo(() => {
    const combined = [
      ...history.map((p) => ({ day: p.day, value: p.value, kind: "history" as const, lower: p.value, upper: p.value })),
      ...forecast.map((p) => ({ day: p.day, value: p.value, kind: "forecast" as const, lower: p.lower, upper: p.upper })),
    ];
    const values = combined.flatMap((p) => [p.value, p.lower, p.upper]);
    if (capacity) values.push(capacity);
    const rawMax = Math.max(...values, 1);
    const rawMin = Math.min(...values, 0);
    const span = rawMax - rawMin || 1;
    const min = Math.max(0, rawMin - span * 0.12);
    const max = rawMax + span * 0.1;
    const x = (i: number) => pad.left + (combined.length <= 1 ? innerW / 2 : (i / (combined.length - 1)) * innerW);
    const y = (v: number) => pad.top + innerH - ((v - min) / (max - min)) * innerH;
    return { combined, min, max, x, y, splitIndex: history.length - 1 };
  }, [history, forecast, capacity, innerW, innerH, pad.left, pad.top]);

  const { combined, min, max, x, y, splitIndex } = model;
  const ticks = niceTicks(min, max, 4);

  const historyPoints = combined.slice(0, history.length).map((p, i) => ({ x: x(i), y: y(p.value) }));
  const forecastPoints = combined
    .slice(Math.max(splitIndex, 0))
    .map((p, i) => ({ x: x(i + Math.max(splitIndex, 0)), y: y(p.value) }));

  const historyPath = smoothPath(historyPoints);
  const forecastPath = smoothPath(forecastPoints);
  const areaPath = historyPoints.length
    ? `${historyPath} L${historyPoints[historyPoints.length - 1].x.toFixed(2)},${(pad.top + innerH).toFixed(2)} L${historyPoints[0].x.toFixed(2)},${(pad.top + innerH).toFixed(2)} Z`
    : "";

  const bandPath = useMemo(() => {
    const start = Math.max(splitIndex, 0);
    const slice = combined.slice(start);
    if (slice.length < 2) return "";
    const upper = slice.map((point, i) => `${x(i + start).toFixed(2)},${y(point.upper).toFixed(2)}`);
    const lower = slice
      .map((point, i) => `${x(i + start).toFixed(2)},${y(point.lower).toFixed(2)}`)
      .reverse();
    return `M${upper.join(" L")} L${lower.join(" L")} Z`;
  }, [combined, splitIndex, x, y]);

  const active = hover !== null ? combined[hover] : null;
  const gradientId = `grad-${colorVar.replace(/[^a-z0-9]/gi, "")}`;

  function pointerIndex(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const relative = event.clientX - rect.left - pad.left;
    const ratio = Math.min(Math.max(relative / innerW, 0), 1);
    return Math.round(ratio * (combined.length - 1));
  }

  return (
    <div className="w-full" dir="ltr">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1" dir="auto">
        <Legend swatch={<span className="h-0.5 w-5 rounded-full" style={{ background: colorVar }} />} label={labels.history} />
        <Legend
          swatch={
            <span
              className="h-0.5 w-5 rounded-full"
              style={{ background: `repeating-linear-gradient(90deg, ${colorVar} 0 5px, transparent 5px 9px)` }}
            />
          }
          label={labels.forecast}
        />
        {capacity ? (
          <Legend
            swatch={
              <span
                className="h-0.5 w-5 rounded-full"
                style={{ background: `repeating-linear-gradient(90deg, ${chartTheme.axis} 0 3px, transparent 3px 7px)` }}
              />
            }
            label={labels.capacity}
          />
        ) : null}
      </div>

      <div ref={ref} className="relative w-full">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          className="touch-pan-y overflow-visible"
          onPointerMove={(e) => setHover(pointerIndex(e))}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorVar} stopOpacity="0.26" />
              <stop offset="100%" stopColor={colorVar} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={chartTheme.grid}
                strokeWidth={1}
              />
              <text
                x={pad.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill={chartTheme.muted}
                className="tabular"
              >
                {formatNumber(tick, locale, { maximumFractionDigits: 0 })}
              </text>
            </g>
          ))}

          {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
          {bandPath ? <path d={bandPath} fill={colorVar} opacity={0.16} /> : null}

          {capacity ? (
            <>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(capacity)}
                y2={y(capacity)}
                stroke={chartTheme.axis}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              <text
                x={width - pad.right}
                y={y(capacity) - 6}
                textAnchor="end"
                fontSize={10}
                fontWeight={700}
                fill={chartTheme.muted}
                className="tabular"
              >
                {labels.capacity} {formatNumber(capacity, locale)}
              </text>
            </>
          ) : null}

          <path d={historyPath} fill="none" stroke={colorVar} strokeWidth={2} strokeLinecap="round" />
          <path
            d={forecastPath}
            fill="none"
            stroke={colorVar}
            strokeWidth={2}
            strokeDasharray="6 5"
            strokeLinecap="round"
          />

          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={pad.top + innerH}
            y2={pad.top + innerH}
            stroke={chartTheme.axis}
            strokeWidth={1}
          />

          {combined.length > 1
            ? [0, Math.floor(combined.length / 3), Math.floor((combined.length * 2) / 3), combined.length - 1].map((i) => (
                <text
                  key={i}
                  x={x(i)}
                  y={height - 8}
                  textAnchor={i === 0 ? "start" : i === combined.length - 1 ? "end" : "middle"}
                  fontSize={10}
                  fill={chartTheme.muted}
                >
                  {formatDate(combined[i].day, locale)}
                </text>
              ))
            : null}

          {active && hover !== null ? (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={pad.top}
                y2={pad.top + innerH}
                stroke={chartTheme.axis}
                strokeWidth={1}
              />
              <circle cx={x(hover)} cy={y(active.value)} r={5.5} fill={colorVar} stroke={chartTheme.surface} strokeWidth={2} />
            </g>
          ) : null}
        </svg>

        {active && hover !== null ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[130px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-lift)]"
            style={{
              left: Math.min(Math.max(x(hover) - 65, 0), Math.max(width - 140, 0)),
              top: Math.max(y(active.value) - 74, 0),
            }}
            dir="auto"
          >
            <p className="text-[10px] font-semibold text-[var(--text-muted)]">{formatDate(active.day, locale, { day: "numeric", month: "long" })}</p>
            <p className="tabular mt-0.5 text-sm font-extrabold">
              {formatNumber(Math.round(active.value), locale)}
              {valueSuffix}
            </p>
            {active.kind === "forecast" ? (
              <p className="tabular mt-0.5 text-[10px] text-[var(--text-muted)]">
                {formatNumber(Math.round(active.lower), locale)} – {formatNumber(Math.round(active.upper), locale)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-2 px-1" dir="auto">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-[11px] font-semibold text-[var(--text-muted)] underline-offset-4 transition hover:text-[var(--text-primary)] hover:underline"
        >
          {showTable ? labels.hideTable : labels.showTable}
        </button>
      </div>

      {showTable ? (
        <div className="mt-3 max-h-64 overflow-auto rounded-2xl border border-[var(--border)]" dir="auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[var(--surface-2)]">
              <tr>
                <th className="px-3 py-2 text-start font-semibold">{formatDate(combined[0]?.day ?? new Date(), locale, { year: "numeric", month: "long", day: undefined })}</th>
                <th className="px-3 py-2 text-start font-semibold">{labels.history} / {labels.forecast}</th>
              </tr>
            </thead>
            <tbody>
              {combined.map((point) => (
                <tr key={`${point.kind}-${point.day}`} className="border-t border-[var(--border)]">
                  <td className="px-3 py-1.5">{formatDate(point.day, locale, { day: "numeric", month: "short" })}</td>
                  <td className={clsx("tabular px-3 py-1.5", point.kind === "forecast" && "text-[var(--text-muted)]")}>
                    {formatNumber(Math.round(point.value), locale)}
                    {point.kind === "forecast"
                      ? ` (${formatNumber(Math.round(point.lower), locale)}–${formatNumber(Math.round(point.upper), locale)})`
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-[var(--text-secondary)]">
      {swatch}
      {label}
    </span>
  );
}
