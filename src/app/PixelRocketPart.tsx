import type { ReactNode } from "react";
import { PARTS, type PartId } from "../program/workshop";

/**
 * Pixel-art palette matched directly to scripts/art.py (vehicle.png / upper.png)
 * and FlightScene.tsx so VAB parts share the exact launch-view aesthetic.
 */
const PAL = {
  outline: "#19222d",
  selected: "#ffd166",
  hullNose: "#dce2d7",
  hullUpper: "#d4d4c7",
  hullCore: "#cfd1c9",
  highlight: "#fff0d2",
  highlightBright: "#fff5da",
  shadow: "#858e98",
  shadowDark: "#6a7480",
  stripeOrange: "#de825c",
  stripeBooster: "#d98255",
  stripeAmber: "#f3a953",
  finCopper: "#c57752",
  steel: "#424c5a",
  steelLight: "#596575",
  steelDark: "#2b333f",
  windowBg: "#223847",
  windowFrame: "#32485a",
  windowGlint: "#71d8d3",
  bellLight: "#99988c",
  bellMid: "#849099",
  bellDark: "#58616b",
  bellRim: "#b39779",
  stringer: "#a4a8ab",
  teal: "#71d8d3",
  tealDark: "#3c767c",
} as const;

export const VAB_PX = 2;

export function getPartPixelSize(partId: PartId, scalePx = 5.4) {
  const def = PARTS[partId];
  const cols = Math.max(
    6,
    Math.round((def.widthM * scalePx * 2.2) / (VAB_PX * 2)) * 2,
  );
  const baseRows = Math.max(5, Math.round((def.heightM * scalePx) / VAB_PX));
  const rows = partId === "pod_mk1" ? Math.max(12, Math.round(baseRows * 1.25)) : baseRows;
  return { cols, rows, w: cols * VAB_PX, h: rows * VAB_PX };
}

export function getRadialPixelSize(partId: PartId, scalePx = 5.4) {
  const def = PARTS[partId];
  if (partId === "legs_mk1") {
    const cols = 6;
    const rows = 13;
    return { cols, rows, w: cols * VAB_PX, h: rows * VAB_PX };
  }
  if (partId === "bracket_side") {
    const cols = 5;
    const rows = 8;
    return { cols, rows, w: cols * VAB_PX, h: rows * VAB_PX };
  }
  const cols = Math.max(
    6,
    Math.round((def.widthM * scalePx * 2.0) / (VAB_PX * 2)) * 2,
  );
  const rows = Math.max(12, Math.round((def.heightM * scalePx) / VAB_PX));
  return { cols, rows, w: cols * VAB_PX, h: rows * VAB_PX };
}

interface PixelPartProps {
  partId: PartId;
  x: number;
  y: number;
  cols: number;
  rows: number;
  px?: number;
  selected?: boolean;
  /** For 2x radial parts: -1 = left side of core, 1 = right side of core */
  radialSide?: -1 | 1;
}

export function PixelRocketPart({
  partId,
  x,
  y,
  cols,
  rows,
  px = VAB_PX,
  selected = false,
  radialSide,
}: PixelPartProps) {
  const rects: ReactNode[] = [];
  let k = 0;

  const r = (c: number, row: number, cw: number, ch: number, fill: string) => {
    if (cw <= 0 || ch <= 0) return;
    rects.push(
      <rect
        key={k++}
        x={x + c * px}
        y={y + row * px}
        width={cw * px}
        height={ch * px}
        fill={fill}
      />,
    );
  };

  const edge = selected ? PAL.selected : PAL.outline;
  const shadowCols = Math.max(2, Math.round(cols * 0.26));

  /** Helper: shaded vertical cylinder block with 1px pixel outline */
  const drawCylinder = (
    topRow: number,
    heightRows: number,
    bodyFill: string,
    inset = 0,
  ) => {
    const c0 = inset;
    const cw = cols - inset * 2;
    const sh = Math.max(2, Math.round(cw * 0.25));
    // Outline
    r(c0, topRow, cw, heightRows, edge);
    // Main body
    r(c0 + 1, topRow + 1, cw - 2, heightRows - 2, bodyFill);
    // Left warm specular highlight
    if (cw >= 6) {
      r(c0 + 1, topRow + 1, 1, heightRows - 2, PAL.highlight);
    }
    // Right cool slate shadow
    if (cw >= 6) {
      r(c0 + cw - 1 - sh, topRow + 1, sh, heightRows - 2, PAL.shadow);
    }
  };

  /** Helper: single stepped pixel engine bell */
  const drawBell = (
    centerCol: number,
    topRow: number,
    bellRows: number,
    topHalfW: number,
    botHalfW: number,
  ) => {
    for (let i = 0; i < bellRows; i++) {
      const t = bellRows <= 1 ? 1 : i / (bellRows - 1);
      const hw = Math.max(1, Math.round(topHalfW + (botHalfW - topHalfW) * t));
      const c0 = centerCol - hw;
      const bw = hw * 2;
      const isRim = i === bellRows - 1;
      // Outer dark pixel border
      r(c0 - 1, topRow + i, bw + 2, 1, edge);
      // Bell fill
      r(c0, topRow + i, bw, 1, isRim ? PAL.bellRim : PAL.bellMid);
      // Left glint
      if (!isRim && bw >= 4) {
        r(c0, topRow + i, 1, 1, PAL.bellLight);
      }
      // Right shadow
      if (bw >= 4) {
        const sh = Math.max(1, Math.floor(bw * 0.3));
        r(c0 + bw - sh, topRow + i, sh, 1, isRim ? PAL.finCopper : PAL.bellDark);
      }
    }
  };

  switch (partId) {
    case "pod_mk1": {
      const collarRows = 1;
      const coneRows = rows - collarRows;
      const mid = cols / 2;
      for (let i = 0; i < coneRows; i++) {
        const t = (i + 1) / coneRows;
        const hw = Math.max(1, Math.round((cols / 2 - 1) * Math.pow(t, 0.82)));
        const c0 = Math.round(mid - hw);
        const rw = hw * 2;
        r(c0 - 1, i, rw + 2, 1, edge);
        r(c0, i, rw, 1, i === 0 ? PAL.highlight : PAL.hullNose);
        if (rw >= 4) r(c0, i, 1, 1, PAL.highlight);
        if (rw >= 4) {
          const sh = Math.max(1, Math.round(rw * 0.28));
          r(c0 + rw - sh, i, sh, 1, PAL.shadow);
        }
      }
      if (coneRows >= 5 && cols >= 10) {
        const winW = Math.min(4, Math.max(2, Math.floor(cols * 0.28)));
        const winH = Math.max(2, Math.floor(coneRows * 0.28));
        const winC = Math.round(mid - winW / 2);
        const winR = Math.max(2, coneRows - winH - 1);
        r(winC, winR, winW, winH, PAL.windowFrame);
        r(winC, winR, Math.max(1, winW - 1), Math.max(1, winH - 1), PAL.windowBg);
        r(winC, winR, 1, 1, PAL.windowGlint);
      }
      r(0, coneRows, cols, collarRows, edge);
      r(1, coneRows, cols - 2, Math.max(1, collarRows - 1), PAL.steel);
      r(cols - 1 - shadowCols, coneRows, shadowCols, Math.max(1, collarRows - 1), PAL.steelDark);
      r(1, coneRows, 1, Math.max(1, collarRows - 1), PAL.steelLight);
      break;
    }

    case "pod_probe": {
      const mid = Math.floor(cols / 2);
      r(mid - 2, 0, 1, 2, PAL.highlight);
      r(mid + 1, 0, 1, 2, PAL.shadow);
      const bodyTop = 2;
      const bodyH = Math.max(4, rows - 2);
      r(1, bodyTop, cols - 2, 1, edge);
      r(2, bodyTop, cols - 4, 1, PAL.steelLight);
      r(0, bodyTop + 1, cols, bodyH - 1, edge);
      r(1, bodyTop + 1, cols - 2, bodyH - 2, PAL.hullUpper);
      r(1, bodyTop + 1, 1, bodyH - 2, PAL.highlight);
      r(cols - 1 - shadowCols, bodyTop + 1, shadowCols, bodyH - 2, PAL.shadow);
      const bandR = bodyTop + Math.max(1, Math.floor((bodyH - 2) / 2));
      r(1, bandR, cols - 2, Math.min(2, bodyH - 2), PAL.stripeAmber);
      r(cols - 1 - shadowCols, bandR, shadowCols, Math.min(2, bodyH - 2), PAL.finCopper);
      r(mid - 1, bandR, 2, 1, PAL.windowBg);
      r(mid - 1, bandR, 1, 1, PAL.teal);
      break;
    }

    case "tank_s": {
      drawCylinder(0, rows, PAL.hullUpper);
      const bandR = Math.max(2, Math.round(rows * 0.42));
      const bandH = Math.max(2, Math.round(rows * 0.14));
      r(1, bandR, cols - 2, bandH, PAL.stripeOrange);
      r(1, bandR, 1, bandH, PAL.stripeAmber);
      r(cols - 1 - shadowCols, bandR, shadowCols, bandH, PAL.finCopper);
      if (rows >= 10) {
        r(2, bandR + bandH + 1, 1, Math.max(2, rows - bandR - bandH - 3), PAL.highlightBright);
      }
      break;
    }

    case "tank_m": {
      drawCylinder(0, rows, PAL.hullCore);
      const bandR = Math.max(2, Math.round(rows * 0.16));
      const bandH = Math.max(2, Math.round(rows * 0.12));
      r(1, bandR, cols - 2, bandH, PAL.stripeBooster);
      r(1, bandR, 1, bandH, PAL.stripeAmber);
      r(cols - 1 - shadowCols, bandR, shadowCols, bandH, PAL.finCopper);
      const flTop = Math.round(rows * 0.56);
      const flH = Math.max(2, rows - flTop - 2);
      const innerStart = 3;
      const innerEnd = cols - 2 - shadowCols;
      for (let c = innerStart; c < innerEnd; c += 3) {
        r(c, flTop, 1, flH, PAL.stringer);
      }
      r(1, Math.round(rows * 0.52), cols - 2, 1, PAL.stringer);
      r(cols - 1 - shadowCols, Math.round(rows * 0.52), shadowCols, 1, PAL.shadowDark);
      break;
    }

    case "tank_l": {
      drawCylinder(0, rows, PAL.hullCore);
      const band1 = Math.max(3, Math.round(rows * 0.14));
      const band2 = Math.max(band1 + 4, Math.round(rows * 0.72));
      const bh = Math.max(2, Math.round(rows * 0.08));
      for (const br of [band1, band2]) {
        r(1, br, cols - 2, bh, PAL.stripeBooster);
        r(1, br, 1, bh, PAL.stripeAmber);
        r(cols - 1 - shadowCols, br, shadowCols, bh, PAL.finCopper);
      }
      for (let c = 2; c < cols - 2 - shadowCols; c += 3) {
        r(c, band1, 1, bh, PAL.steelDark);
      }
      const midR = Math.round(rows * 0.48);
      r(1, midR, cols - 2, 2, PAL.steel);
      r(cols - 1 - shadowCols, midR, shadowCols, 2, PAL.steelDark);
      r(3, 2, 1, rows - 4, PAL.steelLight);
      r(2, 2, 1, rows - 4, PAL.highlightBright);
      break;
    }

    case "eng_kestrel": {
      const collarH = Math.max(3, Math.round(rows * 0.36));
      const bellH = rows - collarH;
      r(0, 0, cols, collarH, edge);
      r(1, 1, cols - 2, Math.max(1, collarH - 1), PAL.steel);
      r(1, 1, 1, Math.max(1, collarH - 1), PAL.steelLight);
      r(cols - 1 - shadowCols, 1, shadowCols, Math.max(1, collarH - 1), PAL.steelDark);
      const leftCenter = Math.round(cols * 0.3);
      const rightCenter = Math.round(cols * 0.7);
      const topHW = Math.max(1, Math.floor(cols * 0.12));
      const botHW = Math.max(2, Math.floor(cols * 0.2));
      for (let i = 0; i < collarH + 2; i++) {
        const fw = Math.min(3, Math.max(1, Math.floor((i + 2) / 2)));
        r(-fw, i - 1, fw, 1, PAL.finCopper);
        r(-fw, i - 1, 1, 1, PAL.stripeBooster);
        r(cols, i - 1, fw, 1, PAL.finCopper);
      }
      drawBell(leftCenter, collarH, bellH, topHW, botHW);
      drawBell(rightCenter, collarH, bellH, topHW, botHW);
      break;
    }

    case "eng_dart": {
      const collarH = Math.max(2, Math.round(rows * 0.3));
      const bellH = rows - collarH;
      r(1, 0, cols - 2, collarH, edge);
      r(2, 1, cols - 4, Math.max(1, collarH - 1), PAL.steel);
      r(cols - 2 - Math.max(1, shadowCols - 1), 1, Math.max(1, shadowCols - 1), Math.max(1, collarH - 1), PAL.steelDark);
      drawBell(
        Math.round(cols / 2),
        collarH,
        bellH,
        Math.max(1, Math.floor(cols * 0.16)),
        Math.max(2, Math.floor(cols * 0.34)),
      );
      break;
    }

    case "eng_valkyrie": {
      // Heavy vacuum lander engine: wide radiation-cooled bell + dark gimbal housing
      const collarH = Math.max(3, Math.round(rows * 0.32));
      const bellH = rows - collarH;
      r(1, 0, cols - 2, collarH, edge);
      r(2, 1, cols - 4, Math.max(1, collarH - 1), PAL.steel);
      r(2, 1, 1, Math.max(1, collarH - 1), PAL.steelLight);
      r(cols - 2 - Math.max(1, shadowCols - 1), 1, Math.max(1, shadowCols - 1), Math.max(1, collarH - 1), PAL.steelDark);
      // Amber turbopump accent band on collar
      r(2, Math.max(1, collarH - 1), cols - 4, 1, PAL.stripeAmber);
      drawBell(
        Math.round(cols / 2),
        collarH,
        bellH,
        Math.max(2, Math.floor(cols * 0.2)),
        Math.max(3, Math.floor(cols * 0.42)),
      );
      break;
    }

    case "eng_titan": {
      const collarH = Math.max(4, Math.round(rows * 0.42));
      const bellH = rows - collarH;
      r(0, 0, cols, collarH, edge);
      r(1, 1, cols - 2, collarH - 2, PAL.steel);
      r(1, 1, 1, collarH - 2, PAL.steelLight);
      r(cols - 1 - shadowCols, 1, shadowCols, collarH - 2, PAL.steelDark);
      r(1, collarH - 2, cols - 2, 1, PAL.finCopper);
      const c1 = Math.round(cols * 0.22);
      const c2 = Math.round(cols * 0.5);
      const c3 = Math.round(cols * 0.78);
      drawBell(c1, collarH, bellH, 1, 2);
      drawBell(c3, collarH, bellH, 1, 2);
      drawBell(c2, collarH, bellH, 2, 3);
      break;
    }

    case "decoupler": {
      r(0, 0, cols, rows, edge);
      r(1, 1, cols - 2, rows - 2, PAL.steel);
      r(1, 1, 1, rows - 2, PAL.steelLight);
      r(cols - 1 - shadowCols, 1, shadowCols, rows - 2, PAL.steelDark);
      const midR = Math.floor(rows / 2);
      for (let c = 2; c < cols - 2; c += 3) {
        r(c, midR, 2, 1, c < cols - 1 - shadowCols ? PAL.stripeAmber : PAL.finCopper);
      }
      break;
    }

    case "bracket_side": {
      // Rigid steel radial mount truss with amber/teal crossfeed manifold pipe
      const midR = Math.floor(rows / 2);
      // Top & bottom heavy clamp struts
      r(0, 0, cols, 2, edge);
      r(0, 1, cols, 1, PAL.steelLight);
      r(0, rows - 2, cols, 2, edge);
      r(0, rows - 2, cols, 1, PAL.steel);
      // Vertical structural web on core-facing & outer-facing edges
      const innerC = radialSide === -1 ? cols - 1 : 0;
      const outerC = radialSide === -1 ? 0 : cols - 1;
      r(innerC, 0, 1, rows, PAL.steelLight);
      r(outerC, 0, 1, rows, PAL.steelDark);
      // Center crossfeed fuel line pipe (teal/amber)
      r(0, midR - 1, cols, 3, edge);
      r(0, midR, cols, 1, PAL.teal);
      r(Math.floor(cols / 2), midR, 1, 1, PAL.stripeAmber);
      break;
    }

    case "srb_side": {
      const noseH = Math.max(4, Math.round(cols * 0.65));
      const nozH = Math.max(3, Math.round(rows * 0.14));
      const bodyH = Math.max(4, rows - noseH - nozH);
      const mid = cols / 2;
      for (let i = 0; i < noseH; i++) {
        const t = (i + 1) / noseH;
        const hw = Math.max(1, Math.round((cols / 2 - 1) * t));
        const c0 = Math.round(mid - hw);
        const rw = hw * 2;
        r(c0 - 1, i, rw + 2, 1, edge);
        r(c0, i, rw, 1, i === 0 ? PAL.highlight : PAL.hullNose);
        if (rw >= 4) {
          r(c0, i, 1, 1, PAL.highlight);
          r(c0 + rw - 1, i, 1, 1, PAL.shadow);
        }
      }
      drawCylinder(noseH, bodyH, PAL.hullCore);
      const stripeR = noseH + Math.max(2, Math.round(bodyH * 0.22));
      r(1, stripeR, cols - 2, 2, PAL.stripeBooster);
      r(cols - 1 - shadowCols, stripeR, shadowCols, 2, PAL.finCopper);
      drawBell(
        Math.round(mid),
        noseH + bodyH,
        nozH,
        Math.max(1, Math.floor(cols * 0.22)),
        Math.max(2, Math.floor(cols * 0.36)),
      );
      if (radialSide !== undefined) {
        const strutC = radialSide === -1 ? cols : -2;
        const topStrut = noseH + Math.round(bodyH * 0.22);
        const botStrut = noseH + Math.round(bodyH * 0.78);
        r(strutC, topStrut, 2, 2, PAL.steel);
        r(strutC, topStrut, 2, 1, PAL.steelLight);
        r(strutC, botStrut, 2, 2, PAL.steel);
        r(strutC, botStrut, 2, 1, PAL.steelLight);
      }
      break;
    }

    case "chute_mk1": {
      r(1, 0, cols - 2, 1, edge);
      r(0, 1, cols, rows - 1, edge);
      r(2, 1, cols - 4, 1, PAL.stripeOrange);
      r(1, 2, cols - 2, Math.max(1, rows - 3), PAL.hullUpper);
      r(1, 2, 1, Math.max(1, rows - 3), PAL.highlight);
      r(cols - 1 - shadowCols, 2, shadowCols, Math.max(1, rows - 3), PAL.shadow);
      r(Math.floor(cols / 2) - 1, 1, 1, rows - 2, PAL.steelDark);
      r(Math.floor(cols / 2) + 1, 1, 1, rows - 2, PAL.steelDark);
      break;
    }

    case "legs_mk1": {
      if (radialSide !== undefined) {
        r(0, 0, cols, rows, edge);
        r(1, 1, cols - 2, rows - 2, PAL.steel);
        r(1, 1, 1, rows - 2, PAL.hullCore);
        r(cols - 2, 1, 1, rows - 2, PAL.steelDark);
        const strutC = Math.floor(cols / 2);
        r(strutC, 2, 1, rows - 4, PAL.highlight);
        r(1, rows - 3, cols - 2, 2, PAL.stripeBooster);
        r(cols - 2, rows - 3, 1, 2, PAL.finCopper);
        const brkC = radialSide === -1 ? cols : -2;
        r(brkC, 2, 2, 2, PAL.steelLight);
        r(brkC, rows - 4, 2, 2, PAL.steelLight);
      } else {
        drawCylinder(0, rows, PAL.steelLight);
        r(2, 1, 2, rows - 2, PAL.stripeBooster);
        r(cols - 4, 1, 2, rows - 2, PAL.stripeBooster);
      }
      break;
    }

    case "colony_kit": {
      drawCylinder(0, rows, PAL.hullNose);
      r(2, 0, cols - 4, 2, PAL.steel);
      r(3, 0, cols - 6, 1, PAL.stripeAmber);
      const bandR = Math.max(3, Math.round(rows * 0.35));
      const bandH = Math.max(3, Math.round(rows * 0.28));
      r(1, bandR, cols - 2, bandH, PAL.tealDark);
      r(2, bandR + 1, cols - 4 - shadowCols, Math.max(1, bandH - 2), PAL.teal);
      r(1, rows - 3, cols - 2, 2, PAL.steel);
      r(cols - 1 - shadowCols, rows - 3, shadowCols, 2, PAL.steelDark);
      break;
    }
  }

  return (
    <g shapeRendering="crispEdges" data-part={partId}>
      {rects}
    </g>
  );
}

/** Compact pixel-art preview icon for the VAB part catalog cards. */
export function PartPixelThumb({ partId }: { partId: PartId }) {
  const isRadialOnly =
    partId === "srb_side" || partId === "legs_mk1" || partId === "bracket_side";
  const { cols, rows, w, h } = isRadialOnly
    ? getRadialPixelSize(partId, 3.2)
    : getPartPixelSize(partId, 3.2);
  const pad = 4;
  const vbW = Math.max(w + pad * 2, h + pad * 2);
  const vbH = vbW;
  const ox = Math.round((vbW - w) / 2);
  const oy = Math.round((vbH - h) / 2);

  return (
    <svg
      className="part-thumb-svg"
      viewBox={`0 0 ${vbW} ${vbH}`}
      aria-hidden="true"
    >
      <PixelRocketPart
        partId={partId}
        x={ox}
        y={oy}
        cols={cols}
        rows={rows}
        px={VAB_PX}
        radialSide={partId === "legs_mk1" || partId === "bracket_side" ? 1 : undefined}
      />
    </svg>
  );
}
