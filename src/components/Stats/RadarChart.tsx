import { useMemo } from "react";

export interface RadarChartDatum {
  subjectId: string;
  subjectName: string;
  totalHours: number;
  color?: string | null;
}

interface RadarChartProps {
  data: RadarChartDatum[];
  outerScaleHours?: number;
  size?: number;
}

// ── Math helpers ─────────────────────────────────────────────────────────────

function toRad(index: number, n: number) {
  return (Math.PI * 2 * index) / n - Math.PI / 2;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function polygonPoints(
  cx: number,
  cy: number,
  r: number,
  n: number,
  scale = 1,
): string {
  return Array.from({ length: n }, (_, i) => {
    const pt = polar(cx, cy, r * scale, toRad(i, n));
    return `${pt.x},${pt.y}`;
  }).join(" ");
}

// ── Label placement ──────────────────────────────────────────────────────────

/**
 * Given an angle (radians), return the appropriate SVG text-anchor and a small
 * dx/dy nudge so labels don't sit right on the polygon edge.
 */
function labelAnchor(angle: number): {
  anchor: "middle" | "start" | "end";
  dx: number;
  dy: number;
} {
  // Normalize to [0, 2π)
  const norm = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  // Top quadrant  (315°–45°) → centered
  if (norm < Math.PI / 4 || norm > (7 * Math.PI) / 4) {
    return { anchor: "middle", dx: 0, dy: -4 };
  }
  // Bottom quadrant (135°–225°)
  if (norm > (3 * Math.PI) / 4 && norm < (5 * Math.PI) / 4) {
    return { anchor: "middle", dx: 0, dy: 12 };
  }
  // Right half
  if (norm <= (3 * Math.PI) / 4) {
    return { anchor: "start", dx: 4, dy: 4 };
  }
  // Left half
  return { anchor: "end", dx: -4, dy: 4 };
}

// ── Component ────────────────────────────────────────────────────────────────

const GRID_LEVELS = [0.2, 0.4, 0.6, 0.8, 1.0];

export function SvgRadarChart({ data, outerScaleHours, size = 260 }: RadarChartProps) {
  const n = data.length;

  const {
    cx, cy, radius, labelRadius, maxHours, points, gridPolygons, axisLines, labels,
  } = useMemo(() => {
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.34;
    const labelRadius = size * 0.44;

    const maxHours = Math.max(1, outerScaleHours ?? Math.max(1, ...data.map((d) => d.totalHours)));

    // Data polygon points
    const points = data.map((d, i) => {
      const angle = toRad(i, n);
      const r = (d.totalHours / maxHours) * radius;
      return polar(cx, cy, r, angle);
    });

    // Grid rings
    const gridPolygons = GRID_LEVELS.map((level) =>
      polygonPoints(cx, cy, radius, n, level),
    );

    // Axis lines  (center → outer edge)
    const axisLines = data.map((_, i) => {
      const angle = toRad(i, n);
      return polar(cx, cy, radius, angle);
    });

    // Label data
    const labels = data.map((d, i) => {
      const angle = toRad(i, n);
      const pos = polar(cx, cy, labelRadius, angle);
      const { anchor, dx, dy } = labelAnchor(angle);
      return { d, pos, anchor, dx, dy };
    });

    return { cx, cy, radius, labelRadius, maxHours, points, gridPolygons, axisLines, labels };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, outerScaleHours, size, n]);

  const dataPolygonStr = points.map((p) => `${p.x},${p.y}`).join(" ");
  const allZero = data.every((d) => d.totalHours === 0);
  // Dominant accent color for polygon
  const accentStroke = "var(--sky)";
  const accentFill = "var(--sky-soft)";

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label="Radar chart showing study hours by subject"
      >
        {/* ── Grid rings ── */}
        {gridPolygons.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="var(--border)"
            strokeWidth={i === gridPolygons.length - 1 ? 1.5 : 1}
            opacity={0.7}
          />
        ))}

        {/* ── Axis lines ── */}
        {axisLines.map((end, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={end.x}
            y2={end.y}
            stroke="var(--border)"
            strokeWidth={1}
            opacity={0.6}
          />
        ))}

        {/* ── Data polygon ── */}
        {!allZero && (
          <polygon
            points={dataPolygonStr}
            fill={accentFill}
            stroke={accentStroke}
            strokeWidth={2}
            strokeLinejoin="round"
            fillOpacity={0.55}
          />
        )}

        {/* ── Data dots ── */}
        {!allZero &&
          points.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={3}
              fill={accentStroke}
              stroke="var(--paper)"
              strokeWidth={1.5}
            />
          ))}

        {/* ── Labels ── */}
        {labels.map(({ d, pos, anchor, dx, dy }, i) => {
          const hoursLabel =
            d.totalHours >= 1
              ? d.totalHours.toFixed(1) + "h"
              : d.totalHours > 0
              ? Math.round(d.totalHours * 60) + "m"
              : "0h";

          return (
            <g key={i}>
              <text
                x={pos.x + dx}
                y={pos.y + dy}
                textAnchor={anchor}
                fontSize={8.5}
                fontWeight={400}
                fontFamily="var(--font-display)"
                fill="var(--ink)"
                letterSpacing="0.04em"
                style={{ textTransform: "uppercase" }}
              >
                {d.subjectName}
              </text>
              <text
                x={pos.x + dx}
                y={pos.y + dy + 10}
                textAnchor={anchor}
                fontSize={7.5}
                fontWeight={700}
                fontFamily="inherit"
                fill="var(--muted)"
              >
                {hoursLabel}
              </text>
            </g>
          );
        })}

        {/* ── Scale label (top-right corner) ── */}
        <text
          x={size - 4}
          y={10}
          textAnchor="end"
          fontSize={6.5}
          fill="var(--muted)"
          fontWeight={700}
          fontFamily="inherit"
          letterSpacing="0.03em"
        >
          OUTER = {maxHours >= 1 ? maxHours.toFixed(1) + "h" : Math.round(maxHours * 60) + "m"}
        </text>
      </svg>

      {/* ── All-zero helper ── */}
      {allZero && (
        <p className="mt-1 text-center text-[9px] font-bold uppercase tracking-widest text-[var(--muted)] opacity-60">
          Start studying to fill your chart
        </p>
      )}
    </div>
  );
}
