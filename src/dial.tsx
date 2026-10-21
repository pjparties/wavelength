import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { clamp, NEEDLE_MAX, NEEDLE_MIN, ZONE_CORE, ZONE_INNER, ZONE_OUTER } from "./game.ts";

const VB_W = 400;
const VB_H = 234;
const CX = 200;
const CY = 200;
const R = 178;

/** Arc degrees -> svg point. 0 = left end, 90 = top, 180 = right end. */
function point(arc: number) {
  const rad = (arc * Math.PI) / 180;
  return { x: CX - R * Math.cos(rad), y: CY - R * Math.sin(rad) };
}

function wedgePath(from: number, to: number): string {
  const a = point(from);
  const b = point(to);
  return `M ${CX} ${CY} L ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`;
}

const HALF_CIRCLE = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY} Z`;

export type DialProps = {
  /** Needle position in arc degrees. null renders no needle at all. */
  needle: number | null;
  /** Secret target in arc degrees. null renders no target zones. */
  target: number | null;
  /** Paint the face plain instead of the grey miss zone (psychic view). */
  plainFace?: boolean;
  interactive?: boolean;
  onChange?: (angle: number) => void;
};

export default function Dial({
  needle,
  target,
  plainFace = false,
  interactive = false,
  onChange,
}: DialProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const angleAt = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 90;
    const x = ((clientX - rect.left) * VB_W) / rect.width;
    const y = ((clientY - rect.top) * VB_H) / rect.height;
    const dx = x - CX;
    const dyUp = CY - y;
    return clamp((Math.atan2(dx, dyUp) * 180) / Math.PI + 90, NEEDLE_MIN, NEEDLE_MAX);
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive || !onChange) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // synthetic or already-released pointers cannot be captured; dragging still works
    }
    dragging.current = true;
    onChange(angleAt(event.clientX, event.clientY));
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive || !dragging.current || !onChange) return;
    onChange(angleAt(event.clientX, event.clientY));
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    dragging.current = false;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // pointer was never captured
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (!interactive || !onChange || needle === null) return;
    const step = event.shiftKey ? 5 : 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(clamp(needle - step, NEEDLE_MIN, NEEDLE_MAX));
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(clamp(needle + step, NEEDLE_MIN, NEEDLE_MAX));
    }
  };

  const bands = target === null
    ? []
    : ([
        [target - ZONE_OUTER, target - ZONE_INNER, "var(--zone-1)"],
        [target - ZONE_INNER, target - ZONE_CORE, "var(--zone-3)"],
        [target - ZONE_CORE, target + ZONE_CORE, "var(--zone-5)"],
        [target + ZONE_CORE, target + ZONE_INNER, "var(--zone-3)"],
        [target + ZONE_INNER, target + ZONE_OUTER, "var(--zone-1)"],
      ] as [number, number, string][]);

  const missFace = target !== null && !plainFace;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full touch-none select-none"
      role="img"
      aria-label="Spectrum dial"
      data-testid="dial"
      tabIndex={interactive ? 0 : -1}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      style={{ cursor: interactive ? "grab" : "default" }}
    >
      <path
        d={HALF_CIRCLE}
        fill={missFace ? "var(--zone-0)" : "var(--surface)"}
        data-face={missFace ? "miss" : "plain"}
      />

      {target !== null && (
        <g data-target="true">
          {bands.map(([from, to, fill]) => {
            const lo = Math.max(0, from);
            const hi = Math.min(180, to);
            if (hi <= lo) return null;
            return <path key={`${from}-${to}`} d={wedgePath(lo, hi)} fill={fill} />;
          })}
        </g>
      )}

      <path d={HALF_CIRCLE} fill="none" stroke="var(--line)" strokeWidth={4} />
      <line x1={CX - R - 8} y1={CY} x2={CX + R + 8} y2={CY} stroke="var(--line)" strokeWidth={4} strokeLinecap="round" />

      {Array.from({ length: 11 }, (_, i) => {
        const arc = i * 18;
        const rad = (arc * Math.PI) / 180;
        const outer = point(arc);
        const ix = CX - (R - 12) * Math.cos(rad);
        const iy = CY - (R - 12) * Math.sin(rad);
        return (
          <line
            key={arc}
            x1={ix}
            y1={iy}
            x2={outer.x}
            y2={outer.y}
            stroke="var(--line)"
            strokeWidth={i % 5 === 0 ? 3 : 1.5}
            opacity={i % 5 === 0 ? 0.9 : 0.4}
          />
        );
      })}

      {needle !== null && (
        <g data-needle="true" transform={`rotate(${needle - 90} ${CX} ${CY})`}>
          <line
            x1={CX}
            y1={CY + 18}
            x2={CX}
            y2={CY - R + 10}
            stroke="var(--ink)"
            strokeWidth={5}
            strokeLinecap="round"
          />
        </g>
      )}
      {needle !== null && <circle cx={CX} cy={CY} r={7} fill="var(--ink)" />}

      <text x={CX - R + 14} y={CY + 26} fill="var(--ink)" fontSize={20} fontWeight={800} textAnchor="middle">
        0
      </text>
      <text x={CX + R - 16} y={CY + 26} fill="var(--ink)" fontSize={20} fontWeight={800} textAnchor="middle">
        10
      </text>
    </svg>
  );
}
