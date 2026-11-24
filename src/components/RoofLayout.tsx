"use client";

import type { Layout } from "@/lib/types";

/** Top-down roof plan: north at top, panel rows tilted toward the south. */
export default function RoofLayout({ layout, panels }: { layout: Layout; panels: number }) {
  const W = 520;
  const scale = Math.min(W / layout.roofL, 300 / layout.roofW);
  const w = layout.roofL * scale;
  const h = layout.roofW * scale;
  const ox = (W - w) / 2;
  const oy = 20;
  const rects: { x: number; y: number }[] = [];
  // Fill rows from the south (bottom) so the front row is never shaded
  for (let r = 0; r < layout.rows && rects.length < panels; r++) {
    for (let c = 0; c < layout.cols && rects.length < panels; c++) {
      const x = layout.setback + c * (layout.panelW + 0.02);
      const y = layout.roofW - layout.setback - layout.panelL - r * layout.rowPitch;
      rects.push({ x, y });
    }
  }
  const ft = (m: number) => `${Math.round(m * 3.28084)} ft`;
  return (
    <svg viewBox={`0 0 ${W} ${h + 56}`} className="w-full" role="img" aria-label={`Roof layout with ${panels} panels`}>
      <rect x={ox} y={oy} width={w} height={h} fill="#f5f5f4" stroke="#a8a29e" strokeWidth={1.5} rx={3} />
      <rect
        x={ox + layout.setback * scale}
        y={oy + layout.setback * scale}
        width={(layout.roofL - 2 * layout.setback) * scale}
        height={(layout.roofW - 2 * layout.setback) * scale}
        fill="none"
        stroke="#d6d3d1"
        strokeDasharray="4 4"
      />
      {rects.map((p, i) => (
        <g key={i}>
          <rect
            x={ox + p.x * scale}
            y={oy + p.y * scale}
            width={layout.panelW * scale}
            height={layout.panelL * scale}
            fill="#1e3a5f"
            stroke="#93c5fd"
            strokeWidth={0.6}
          />
          <line
            x1={ox + p.x * scale}
            x2={ox + (p.x + layout.panelW) * scale}
            y1={oy + (p.y + layout.panelL / 2) * scale}
            y2={oy + (p.y + layout.panelL / 2) * scale}
            stroke="#3b82f6"
            strokeWidth={0.5}
          />
        </g>
      ))}
      <text x={ox + w / 2} y={oy - 6} textAnchor="middle" fontSize={11} fill="#78716c">
        N ↑ · {ft(layout.roofL)}
      </text>
      <text x={ox + w + 6} y={oy + h / 2} fontSize={11} fill="#78716c">
        {ft(layout.roofW)}
      </text>
      <text x={ox + w / 2} y={oy + h + 20} textAnchor="middle" fontSize={11} fill="#78716c">
        S · {panels} panels in {Math.ceil(panels / Math.max(1, layout.cols))} row(s), {layout.rowPitch.toFixed(1)} m row spacing (no winter shading)
      </text>
      <text x={ox + w / 2} y={oy + h + 36} textAnchor="middle" fontSize={11} fill="#a8a29e">
        Roof fits up to {layout.maxPanels} panels · dashed line = {layout.setback} m safety setback
      </text>
    </svg>
  );
}
