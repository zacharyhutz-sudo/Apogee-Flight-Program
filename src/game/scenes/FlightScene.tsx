import { useEffect, useRef, type MutableRefObject } from "react";
import Phaser from "phaser";
import {
  AIR,
  CHUTE_FULL_ALT,
  R,
  bodyParams,
  burning,
  clamp,
  hasActivePart,
  headingVector,
  radius,
  type Flight,
  type FlightVisualPart,
} from "../../sim/flight";
import { PARTS, type PartId } from "../../program/workshop";

interface RenderedPart {
  uid?: string;
  partId: PartId;
  def: (typeof PARTS)[PartId];
  stage: number;
  symmetry: 1 | 2;
  mount: "center" | "side";
  parentUid?: string;
}

interface PlumeAnchor {
  lx: number;
  ly: number;
  scale: number;
}

function resolveParts(list: FlightVisualPart[] | undefined, minStage: number) {
  if (!list || !list.length) return null;
  const active: RenderedPart[] = list
    .filter((p) => p.stage >= minStage && Object.hasOwn(PARTS, p.partId))
    .map((p) => {
      const partId = p.partId as PartId;
      const def = PARTS[partId];
      const mount: "center" | "side" =
        p.mount ??
        (partId === "bracket_side" || (def.symmetric && p.symmetry === 2)
          ? "side"
          : "center");
      return {
        uid: p.uid,
        partId,
        def,
        stage: p.stage,
        symmetry: p.symmetry,
        mount,
        parentUid: p.parentUid,
      };
    });
  return active.length ? active : null;
}

/** Draws a custom VAB rocket (including 2D side-bracket stacks) anchored so its bottom sits at local y = 0. */
function drawCustomStack(
  g: Phaser.GameObjects.Graphics,
  parts: RenderedPart[],
  cx: number,
  cy: number,
  angle: number,
  pxPerMeter: number,
): { height: number; plumeAnchors: PlumeAnchor[] } {
  const byUid = new Map<string, RenderedPart>();
  for (const p of parts) {
    if (p.uid) byUid.set(p.uid, p);
  }

  const center = parts.filter((p) => p.mount === "center");
  const brackets = parts.filter((p) => p.partId === "bracket_side");
  const bracketChildren = new Map<string, RenderedPart[]>();
  for (const br of brackets) {
    if (br.uid) bracketChildren.set(br.uid, []);
  }
  const standaloneRadial: RenderedPart[] = [];
  for (const p of parts) {
    if (p.mount !== "side" || p.partId === "bracket_side") continue;
    if (p.parentUid && bracketChildren.has(p.parentUid)) {
      bracketChildren.get(p.parentUid)!.push(p);
    } else {
      standaloneRadial.push(p);
    }
  }

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const toScreen = (lx: number, ly: number) => ({
    x: cx + lx * cos - ly * sin,
    y: cy + lx * sin + ly * cos,
  });

  const fillPoly = (
    pts: Array<[number, number]>,
    color: number,
    stroke?: number,
  ) => {
    const world = pts.map(([lx, ly]) => toScreen(lx, ly));
    g.fillStyle(color, 1).fillPoints(world, true);
    if (stroke !== undefined) {
      g.lineStyle(1, stroke, 0.9).strokePoints(world, true);
    }
  };

  const drawBodyPart = (
    def: (typeof PARTS)[PartId],
    xCenter: number,
    yTop: number,
    hw: number,
    h: number,
  ) => {
    const yBot = yTop + h;
    if (def.category === "pod") {
      fillPoly(
        [
          [xCenter, yTop],
          [xCenter + hw, yBot],
          [xCenter - hw, yBot],
        ],
        0xe8e2d5,
        0x7f959c,
      );
      fillPoly(
        [
          [xCenter - hw * 0.35, yTop + h * 0.52],
          [xCenter + hw * 0.35, yTop + h * 0.52],
          [xCenter + hw * 0.45, yTop + h * 0.72],
          [xCenter - hw * 0.45, yTop + h * 0.72],
        ],
        0x223847,
      );
      fillPoly(
        [
          [xCenter, yTop],
          [xCenter + hw, yBot],
          [xCenter + hw * 0.55, yBot],
        ],
        0x9ba5a7,
      );
    } else if (def.category === "engine") {
      fillPoly(
        [
          [xCenter - hw * 0.45, yTop],
          [xCenter + hw * 0.45, yTop],
          [xCenter + hw * 0.85, yBot],
          [xCenter - hw * 0.85, yBot],
        ],
        0x495b69,
        0x8ea3ac,
      );
      fillPoly(
        [
          [xCenter - hw * 0.78, yBot - h * 0.19],
          [xCenter + hw * 0.78, yBot - h * 0.19],
          [xCenter + hw * 0.86, yBot],
          [xCenter - hw * 0.86, yBot],
        ],
        0xb39779,
      );
    } else if (def.category === "stage") {
      fillPoly(
        [
          [xCenter - hw, yTop],
          [xCenter + hw, yTop],
          [xCenter + hw, yBot],
          [xCenter - hw, yBot],
        ],
        0xd98d4c,
        0x6e4724,
      );
    } else if (def.category === "utility") {
      fillPoly(
        [
          [xCenter - hw, yTop],
          [xCenter + hw, yTop],
          [xCenter + hw, yBot],
          [xCenter - hw, yBot],
        ],
        0x7ea8ab,
        0x3e5c63,
      );
    } else {
      fillPoly(
        [
          [xCenter - hw, yTop],
          [xCenter + hw, yTop],
          [xCenter + hw, yBot],
          [xCenter - hw, yBot],
        ],
        0xd5dcd7,
        0x7e9499,
      );
      fillPoly(
        [
          [xCenter - hw, yTop + h * 0.44],
          [xCenter + hw, yTop + h * 0.44],
          [xCenter + hw, yTop + h * 0.58],
          [xCenter - hw, yTop + h * 0.58],
        ],
        0xf3a953,
      );
      fillPoly(
        [
          [xCenter - hw * 0.84, yTop + 1],
          [xCenter - hw * 0.61, yTop + 1],
          [xCenter - hw * 0.61, yBot - 1],
          [xCenter - hw * 0.84, yBot - 1],
        ],
        0xf5ebd2,
      );
      fillPoly(
        [
          [xCenter + hw * 0.5, yTop + 1],
          [xCenter + hw, yTop + 1],
          [xCenter + hw, yBot - 1],
          [xCenter + hw * 0.5, yBot - 1],
        ],
        0x98a4a3,
      );
    }
  };

  // Stack bottom-to-top from local y = 0 upward (negative local y is nose direction)
  let totalH = 0;
  for (const p of center) totalH += Math.max(4, p.def.heightM * pxPerMeter);

  let yTop = -totalH;
  let coreHalfW = 5 * pxPerMeter * 0.25;
  const centerBoxByUid = new Map<string, { yTop: number; yBot: number; hw: number }>();
  const stageBottomY = new Map<number, number>();
  const lowestTankByStage = new Map<number, { yTop: number; yBot: number; hw: number }>();
  const plumeAnchors: PlumeAnchor[] = [];
  let hasCenterEngine = false;

  for (const p of center) {
    const h = Math.max(4, p.def.heightM * pxPerMeter);
    const w = Math.max(6, p.def.widthM * pxPerMeter * 1.15);
    const hw = w / 2;
    coreHalfW = Math.max(coreHalfW, hw);
    const yBot = yTop + h;

    drawBodyPart(p.def, 0, yTop, hw, h);

    const box = { yTop, yBot, hw };
    if (p.uid) centerBoxByUid.set(p.uid, box);
    stageBottomY.set(p.stage, yBot);
    if (p.def.category === "tank") {
      lowestTankByStage.set(p.stage, box);
    }
    if (p.def.category === "engine") {
      hasCenterEngine = true;
      plumeAnchors.push({ lx: 0, ly: yBot, scale: 1 });
    }
    yTop = yBot;
  }

  // Draw side brackets & their mirrored side-column stacks
  for (const br of brackets) {
    const hostBox =
      (br.parentUid ? centerBoxByUid.get(br.parentUid) : undefined) ??
      lowestTankByStage.get(br.stage) ?? {
        yTop: -Math.min(totalH, 10 * pxPerMeter),
        yBot: 0,
        hw: coreHalfW,
      };
    const children = (br.uid ? bracketChildren.get(br.uid) : undefined) ?? [];
    const bracketW = Math.max(3, 1.0 * pxPerMeter * 1.05);
    const bracketH = Math.max(4, 1.8 * pxPerMeter);
    const brMidY = (hostBox.yTop + hostBox.yBot) / 2;
    const sides: Array<-1 | 1> = br.symmetry === 2 ? [-1, 1] : [1];

    let colTotalH = 0;
    let colMaxHw = 3;
    for (const ch of children) {
      colTotalH += Math.max(4, ch.def.heightM * pxPerMeter);
      colMaxHw = Math.max(colMaxHw, Math.max(5, ch.def.widthM * pxPerMeter * 1.1) / 2);
    }
    // Anchor side stack bottom near host tank bottom (or rocket bottom 0)
    const colBottomY = Math.min(0, hostBox.yBot + (children.some((c) => c.def.category === "engine") ? 2.5 * pxPerMeter : 0));
    const colStartY = colBottomY - colTotalH;

    for (const side of sides) {
      const xIn = side * hostBox.hw;
      const xOut = side * (hostBox.hw + bracketW);
      const xMin = Math.min(xIn, xOut);
      const xMax = Math.max(xIn, xOut);
      fillPoly(
        [
          [xMin, brMidY - bracketH / 2],
          [xMax, brMidY - bracketH / 2],
          [xMax, brMidY + bracketH / 2],
          [xMin, brMidY + bracketH / 2],
        ],
        0x424c5a,
        0x19222d,
      );
      // Crossfeed pipe highlight
      fillPoly(
        [
          [xMin, brMidY - 1],
          [xMax, brMidY - 1],
          [xMax, brMidY + 1],
          [xMin, brMidY + 1],
        ],
        0x71d8d3,
      );

      if (children.length > 0) {
        const sideCenterX = side * (hostBox.hw + bracketW + colMaxHw);
        let cyCur = colStartY;
        for (const ch of children) {
          const chH = Math.max(4, ch.def.heightM * pxPerMeter);
          const chHw = Math.max(5, ch.def.widthM * pxPerMeter * 1.1) / 2;
          drawBodyPart(ch.def, sideCenterX, cyCur, chHw, chH);
          if (ch.def.category === "engine") {
            plumeAnchors.push({ lx: sideCenterX, ly: cyCur + chH, scale: 0.72 });
          }
          cyCur += chH;
        }
      }
    }
  }

  // Draw standalone 2x mirror radial boosters / legs anchored to their own stage/host
  for (const p of standaloneRadial) {
    const { def } = p;
    const h = Math.max(6, def.heightM * pxPerMeter);
    const w = Math.max(4, def.widthM * pxPerMeter * 1.15);
    const hostBox =
      (p.parentUid ? centerBoxByUid.get(p.parentUid) : undefined) ??
      lowestTankByStage.get(p.stage);
    const yBot = hostBox ? hostBox.yBot : (stageBottomY.get(p.stage) ?? 0);
    const hostHw = hostBox ? hostBox.hw : coreHalfW;
    const yTopR = yBot - h;
    const sides: Array<-1 | 1> = p.symmetry === 2 ? [-1, 1] : [1];
    for (const side of sides) {
      const xIn = side * (hostHw + 1);
      const xOut = side * (hostHw + 1 + w);
      const xMin = Math.min(xIn, xOut);
      const xMax = Math.max(xIn, xOut);
      fillPoly(
        [
          [(xMin + xMax) / 2, yTopR - w * 0.55],
          [xMax, yTopR],
          [xMax, yBot],
          [xMin, yBot],
          [xMin, yTopR],
        ],
        def.category === "utility" ? 0x8ea3ac : 0xcbd4cf,
        0x6f858d,
      );
      if (p.partId === "srb_side") {
        plumeAnchors.push({ lx: (xMin + xMax) / 2, ly: yBot, scale: 0.62 });
      }
    }
  }

  if (!hasCenterEngine && plumeAnchors.length === 0) {
    plumeAnchors.push({ lx: 0, ly: 0, scale: 1 });
  }

  return { height: totalH, plumeAnchors };
}

export function FlightScene({ vessel }: { vessel: MutableRefObject<Flight> }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = host.current!;
    let zoom = 1;
    const pointers = new Map<number, { x: number; y: number }>();
    let lastSpan = 0;
    let lastTapAt = 0;

    function zoomBy(factor: number) {
      zoom = clamp(zoom * factor, 0.00045, 2.2);
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.0018));
    }

    function onPointerDown(e: PointerEvent) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      lastSpan = 0;
      if (pointers.size === 1) {
        const now = performance.now();
        if (now - lastTapAt < 280) {
          zoom = 1;
          lastTapAt = 0;
        } else {
          lastTapAt = now;
        }
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const span = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastSpan > 0 && span > 0) zoomBy(span / lastSpan);
        lastSpan = span;
      }
    }

    function onPointerUp(e: PointerEvent) {
      pointers.delete(e.pointerId);
      lastSpan = 0;
    }

    const stars = Array.from({ length: 90 }, (_, i) => ({
      u: ((i * 73 + 19) % 1000) / 1000,
      v: ((i * 197 + 41) % 1000) / 1000,
      a: 0.28 + ((i * 31) % 70) / 100,
      r: i % 5 === 0 ? 1.4 : 0.9,
    }));

    class Range extends Phaser.Scene {
      bg!: Phaser.GameObjects.Graphics;
      world!: Phaser.GameObjects.Graphics;
      skyline!: Phaser.GameObjects.Image;
      hills!: Phaser.GameObjects.Image;
      padSurface!: Phaser.GameObjects.Graphics;
      canopy!: Phaser.GameObjects.Image;
      canopyWidth = 0;
      lastFlightTime = 0;
      tower!: Phaser.GameObjects.Image;
      debrisSprites: Phaser.GameObjects.Image[] = [];
      customGfx!: Phaser.GameObjects.Graphics;
      flame!: Phaser.GameObjects.Graphics;
      ship!: Phaser.GameObjects.Image;
      marker!: Phaser.GameObjects.Graphics;

      preload() {
        for (const key of ["tower", "vehicle", "upper", "canopy", "dusk", "range"])
          this.load.image(
            key,
            import.meta.env.BASE_URL + "art/" + key + ".png",
          );
      }

      create() {
        this.bg = this.add.graphics();
        this.skyline = this.add.image(0, 0, "dusk").setOrigin(0.5, 1);
        this.world = this.add.graphics();
        this.hills = this.add.image(0, 0, "range").setOrigin(0.5, 237 / 260);
        this.padSurface = this.add.graphics();
        this.tower = this.add.image(0, 0, "tower").setOrigin(1, 1);
        for (let i = 0; i < 4; i++) {
          const d = this.add
            .image(0, 0, "vehicle")
            .setCrop(0, 39, 28, 37)
            .setOrigin(0.5, 1)
            .setVisible(false);
          this.debrisSprites.push(d);
        }
        this.flame = this.add.graphics();
        this.customGfx = this.add.graphics();
        this.ship = this.add.image(0, 0, "vehicle").setOrigin(0.5, 1);
        this.canopy = this.add.image(0, 0, "canopy").setOrigin(32 / 65, 25 / 30);
        this.marker = this.add.graphics();
      }

      update() {
        const s = vessel.current;
        const w = this.scale.width;
        const h = this.scale.height;
        const bp = bodyParams(s.body);
        const isMoon = s.body === "moon";
        const r = radius(s) || bp.R;
        const alt = Math.max(0, r - bp.R);

        const cx = Math.round(w * 0.5);
        const cy = Math.round(h * (s.status === "pad" ? 0.62 : 0.52));
        const basePpm = Math.min(w, h) / 215;
        const ppm = basePpm * zoom;

        const worldToScreen = (wx: number, wy: number) => ({
          x: cx + (wy - s.y) * ppm,
          y: cy - (wx - s.x) * ppm,
        });

        const atmoFrac = bp.AIR > 0 ? clamp(1 - alt / bp.AIR, 0, 1) : 0;
        const bg = this.bg;
        bg.clear();
        const skyR = Math.round(13 + 38 * atmoFrac * atmoFrac);
        const skyG = Math.round(23 + 66 * atmoFrac);
        const skyB = Math.round(34 + 92 * atmoFrac);
        const skyColor = (skyR << 16) | (skyG << 8) | skyB;
        bg.fillStyle(skyColor, 1).fillRect(0, 0, w, h);

        const starAlpha = clamp(1 - atmoFrac * 1.15, 0, 1);
        if (starAlpha > 0.02) {
          for (const st of stars) {
            bg.fillStyle(0xeaf2f6, st.a * starAlpha).fillCircle(
              st.u * w,
              st.v * h,
              st.r,
            );
          }
        }

        const g = this.world;
        g.clear();

        const planetScreenR = bp.R * ppm;
        const atmoScreenR = (bp.R + bp.AIR) * ppm;
        const earthCenter = worldToScreen(0, 0);

        if (planetScreenR < 2600) {
          if (!isMoon) {
            g.fillStyle(0x4b87a6, 0.24).fillCircle(earthCenter.x, earthCenter.y, atmoScreenR);
            g.lineStyle(1.2, 0x87c8d6, 0.45).strokeCircle(earthCenter.x, earthCenter.y, atmoScreenR);
          }
          g.fillStyle(isMoon ? 0x67707a : 0x1f435a, 1).fillCircle(
            earthCenter.x,
            earthCenter.y,
            planetScreenR,
          );
          g.lineStyle(
            Math.max(1.5, Math.min(5, planetScreenR * 0.018)),
            isMoon ? 0xb4bcc4 : 0x5c8b76,
            1,
          ).strokeCircle(earthCenter.x, earthCenter.y, planetScreenR);
          const padPt = worldToScreen(R, 0);
          g.fillStyle(0xf3a953, 0.9).fillCircle(
            padPt.x,
            padPt.y,
            Math.max(2, Math.min(4, 1800 * ppm)),
          );
        } else {
          const centerAngle = Math.atan2(s.y, s.x);
          const halfSpan = clamp(
            (Math.max(w, h) * 1.1) / planetScreenR,
            0.0005,
            Math.PI * 0.45,
          );
          const steps = 48;

          const drawArcBand = (
            outerR: number,
            innerR: number,
            color: number,
            alpha: number,
          ) => {
            const pts: Array<{ x: number; y: number }> = [];
            for (let i = 0; i <= steps; i++) {
              const a = centerAngle - halfSpan + (2 * halfSpan * i) / steps;
              pts.push(
                worldToScreen(outerR * Math.cos(a), outerR * Math.sin(a)),
              );
            }
            for (let i = steps; i >= 0; i--) {
              const a = centerAngle - halfSpan + (2 * halfSpan * i) / steps;
              pts.push(
                worldToScreen(innerR * Math.cos(a), innerR * Math.sin(a)),
              );
            }
            g.fillStyle(color, alpha).fillPoints(pts, true);
          };

          if (!isMoon && alt < bp.AIR * 1.8) {
            drawArcBand(bp.R + bp.AIR, bp.R, 0x4b87a6, 0.22 * (0.4 + 0.6 * atmoFrac));
          }
          const depth = Math.min(bp.R * 0.6, (Math.max(w, h) * 1.4) / ppm);
          drawArcBand(bp.R, Math.max(0, bp.R - depth), isMoon ? 0x4d545c : 0x1d3544, 1);
          const crust = Math.max(12, 8 / ppm);
          drawArcBand(bp.R, Math.max(0, bp.R - crust), isMoon ? 0x9aa3ad : 0x4f7865, 1);

          const rimPts: Array<{ x: number; y: number }> = [];
          for (let i = 0; i <= steps; i++) {
            const a = centerAngle - halfSpan + (2 * halfSpan * i) / steps;
            rimPts.push(worldToScreen(bp.R * Math.cos(a), bp.R * Math.sin(a)));
          }
          g.lineStyle(1.5, isMoon ? 0xd2d8de : 0x89b39d, 0.95).strokePoints(rimPts, false);
        }

        const padScreen = worldToScreen(bp.R, 0);
        const padVisible = !isMoon &&
          ppm > 0.08 &&
          padScreen.x > -200 &&
          padScreen.x < w + 200 &&
          padScreen.y > -200 &&
          padScreen.y < h + 200;

        const sceneryAlpha = isMoon ? 0 : clamp(1 - alt / 1800, 0, 1)
          * clamp((ppm - 0.09) / 0.3, 0, 1)
          * clamp(2 - Math.abs(padScreen.x - cx) / w, 0, 1);
        const horizon = cy + Math.min(h, alt * ppm * 0.16);
        const artScale = Math.max((w + 100) / 600, h / 255);
        const sceneryX = cx + clamp((padScreen.x - cx) * 0.08, -45, 45);
        this.skyline.setPosition(sceneryX, horizon).setScale(artScale)
          .setVisible(sceneryAlpha > 0).setAlpha(sceneryAlpha);
        this.hills.setPosition(sceneryX, padScreen.y).setScale(artScale)
          .setVisible(sceneryAlpha > 0).setAlpha(sceneryAlpha);

        const shipScale = clamp(ppm / 1.35, 0.16, 2.2);
        const padSurface = this.padSurface.clear();
        const foregroundY = Math.floor(padScreen.y + 23 * artScale);
        if (sceneryAlpha > 0 && foregroundY < h) {
          padSurface.fillStyle(0x202c3a, sceneryAlpha)
            .fillRect(0, foregroundY, w, h - foregroundY);
        }
        if (padVisible) {
          const padW = 84 * shipScale;
          const padH = 6 * shipScale;
          padSurface.fillStyle(0x283643, 1).fillRect(
            padScreen.x - padW / 2,
            padScreen.y,
            padW,
            Math.max(3, padH),
          );
          padSurface.fillStyle(0xb8b2a1, 1).fillRect(
            padScreen.x - padW / 2 - 2,
            padScreen.y - 1,
            padW + 4,
            Math.max(2, 2 * shipScale),
          );
          for (let i = -3; i <= 3; i++) {
            padSurface.fillStyle(0xd99357, 1).fillRect(
              padScreen.x + i * 11 * shipScale - 2,
              padScreen.y,
              4 * shipScale,
              1.5,
            );
          }
          this.tower
            .setVisible(true)
            .setPosition(padScreen.x + 5 * shipScale, padScreen.y)
            .setScale(shipScale);
        } else {
          this.tower.setVisible(false);
        }

        // 4. Custom VAB rocket & real simulated detached stages
        const customGfx = this.customGfx;
        customGfx.clear();

        const debrisList = s.debris ?? [];
        for (let i = 0; i < this.debrisSprites.length; i++) {
          const spr = this.debrisSprites[i];
          const d = debrisList[i];
          if (!d || ppm < 0.05) {
            spr.setVisible(false);
            continue;
          }
          const pt = worldToScreen(d.x, d.y);
          const customDebris = resolveParts(d.parts, 0);
          if (customDebris) {
            spr.setVisible(false);
            drawCustomStack(customGfx, customDebris, pt.x, pt.y, d.angle, ppm * 2.1);
          } else {
            spr
              .setVisible(true)
              .setPosition(pt.x, pt.y)
              .setRotation(d.angle)
              .setScale(shipScale);
          }
        }

        // 5. Active Rocket (Custom VAB procedural render OR Pioneer pixel sprite), bottom-anchored at (cx, cy)
        const upper = s.stage === 1;
        const { angle } = headingVector(s);
        const spriteVisible = s.status !== "lost" && ppm >= 0.06;
        const customParts = resolveParts(s.blueprintParts, s.stage);

        let activeRocketHeight = (upper ? 42 : 76) * shipScale;
        let plumeAnchors: PlumeAnchor[] = [{ lx: 0, ly: 0, scale: 1 }];
        if (customParts && spriteVisible) {
          this.ship.setVisible(false);
          const drawn = drawCustomStack(customGfx, customParts, cx, cy, angle, ppm * 2.1);
          activeRocketHeight = drawn.height;
          plumeAnchors = drawn.plumeAnchors;
        } else {
          this.ship
            .setTexture(upper ? "upper" : "vehicle")
            .setPosition(cx, cy)
            .setRotation(angle)
            .setScale(shipScale)
            .setVisible(spriteVisible);
        }

        // 5b. Deployable Landing Legs & Parachute Canopy visuals
        const elapsed = clamp(s.t - this.lastFlightTime, 0, 0.1);
        this.lastFlightTime = s.t;
        const chuteOpen = Boolean(s.chuteDeployed) && hasActivePart(s, "chute_mk1") && !isMoon && alt < AIR;
        const targetWidth = alt <= CHUTE_FULL_ALT ? 1 : 0.48;
        this.canopyWidth = chuteOpen
          ? Math.min(targetWidth, Math.max(0.15, this.canopyWidth + elapsed * 2.8))
          : 0;
        this.canopy.setVisible(false);
        if (spriteVisible) {
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          const localPt = (lx: number, ly: number) => ({
            x: cx + lx * cosA - ly * sinA,
            y: cy + lx * sinA + ly * cosA,
          });
          if (s.legsDeployed && hasActivePart(s, "legs_mk1")) {
            for (const side of [-1, 1] as const) {
              const hip = localPt(side * 6 * shipScale, -8 * shipScale);
              const foot = localPt(side * 16 * shipScale, 2 * shipScale);
              const brace = localPt(side * 5 * shipScale, -2 * shipScale);
              const padL = localPt(side * 13 * shipScale, 2 * shipScale);
              const padR = localPt(side * 19 * shipScale, 2 * shipScale);
              customGfx
                .lineStyle(Math.max(1.5, 2.2 * shipScale), 0xe6e0d2, 1)
                .lineBetween(hip.x, hip.y, foot.x, foot.y)
                .lineStyle(Math.max(1, 1.4 * shipScale), 0x8ea3ac, 1)
                .lineBetween(brace.x, brace.y, foot.x, foot.y)
                .lineStyle(Math.max(2, 2.6 * shipScale), 0xf28c28, 1)
                .lineBetween(padL.x, padL.y, padR.x, padR.y);
            }
          }
          if (chuteOpen) {
            const antiGravAngle = Math.atan2(s.y, s.x);
            const cG = Math.cos(antiGravAngle);
            const sG = Math.sin(antiGravAngle);
            const nose = localPt(0, -activeRocketHeight);
            const chutePt = (lx: number, ly: number) => ({
              x: nose.x + lx * cG - ly * sG,
              y: nose.y + lx * sG + ly * cG,
            });
            const width = this.canopyWidth;
            const sway = Math.sin(s.t * 2.2) * 1.4 * shipScale * width;
            const height = (29 + 22 * width) * shipScale;
            const center = chutePt(sway, -height);
            const bridle = chutePt(0, -5 * shipScale);
            customGfx.lineStyle(Math.max(0.65, shipScale * 0.8), 0xe1d8bf, 0.92)
              .lineBetween(nose.x, nose.y, bridle.x, bridle.y);
            for (const anchor of [-30, -15, 0, 15, 30]) {
              const hem = chutePt(sway + anchor * width * shipScale, -height);
              customGfx.lineBetween(bridle.x, bridle.y, hem.x, hem.y);
            }
            this.canopy.setVisible(true).setRotation(antiGravAngle)
              .setPosition(center.x, center.y)
              .setScale(width * shipScale, (0.65 + 0.35 * width) * shipScale);
          }
        }

        // 6. Exhaust plumes anchored at every active engine bell (core + side stacks)
        const flame = this.flame;
        flame.clear();
        if (burning(s) && spriteVisible) {
          const phase = Math.floor(s.t * 14);
          const pulse = Math.sin(phase * 2.3);
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          for (const anchor of plumeAnchors) {
            const fx = cx + anchor.lx * cosA - anchor.ly * sinA;
            const fy = cy + anchor.lx * sinA + anchor.ly * cosA;
            const sc = shipScale * anchor.scale;
            const length = (22 + pulse * 2) * sc * (0.35 + 0.65 * s.throttle);
            const plumePoint = (across: number, along: number) => ({
              x: fx + cosA * across * sc - sinA * along * length,
              y: fy + sinA * across * sc + cosA * along * length,
            });
            flame.fillStyle(0xba5d41, 0.92).fillPoints([
              plumePoint(-4.6, 0), plumePoint(-4.1, 0.36), plumePoint(-2.7, 0.76),
              plumePoint(-1.8, 0.56), plumePoint(pulse, 1.1), plumePoint(1.8, 0.70),
              plumePoint(2.9, 0.86), plumePoint(4.5, 0.33), plumePoint(4.6, 0),
            ], true);
            flame.fillStyle(0xffb264).fillPoints([
              plumePoint(-3.8, 0), plumePoint(-2.5, 0.36), plumePoint(0, 0.82),
              plumePoint(2.7, 0.38), plumePoint(3.8, 0),
            ], true);
            flame.fillStyle(0xffefbf).fillPoints([
              plumePoint(-2.6, 0), plumePoint(0, 0.45), plumePoint(2.6, 0),
            ], true);
          }
          if (alt < 120 && padVisible) {
            for (let i = 0; i < 16; i++) {
              const k = (s.t * 0.85 + i * 0.37) % 1;
              const dir = i % 2 ? 1 : -1;
              flame
                .fillStyle(i % 3 ? 0xc8c2b6 : 0x7f8b92, (1 - k) * 0.75)
                .fillEllipse(
                  padScreen.x + dir * k * 64 * shipScale,
                  padScreen.y - (2 + k * 9) * shipScale,
                  (5 + k * 16) * shipScale,
                  (4 + k * 8) * shipScale,
                );
            }
          }
        }

        // 7. Far-zoom spacecraft reticle
        const m = this.marker;
        m.clear();
        if (s.status !== "lost" && ppm < 0.08) {
          m.fillStyle(0x13222e, 0.9).fillCircle(cx, cy, 6);
          m.lineStyle(1.5, 0xf3a953, 1).strokeCircle(cx, cy, 6);
          m.fillStyle(0xf3a953, 1).fillCircle(
            cx + Math.sin(angle) * 4,
            cy - Math.cos(angle) * 4,
            1.8,
          );
        }
        if (s.status === "lost") {
          m.fillStyle(0xf07c6b, 0.9).fillCircle(cx, cy, 5);
        }
      }
    }

    function dims() {
      const height = parent.clientWidth < parent.clientHeight ? 390 : 290;
      return {
        width: Math.max(
          1,
          Math.round(
            (parent.clientWidth / Math.max(1, parent.clientHeight)) * height,
          ),
        ),
        height,
      };
    }

    let game: Phaser.Game | undefined;
    function resize() {
      if (!parent.clientWidth || !parent.clientHeight) {
        game?.loop.sleep();
        return;
      }
      if (game && !game.loop.running) game.loop.wake();
      if (!game)
        game = new Phaser.Game({
          type: Phaser.CANVAS,
          parent,
          width: dims().width,
          height: dims().height,
          scene: Range,
          backgroundColor: "#0d1722",
          pixelArt: true,
          roundPixels: true,
          banner: false,
          audio: { noAudio: true },
          fps: { target: 30, forceSetTimeOut: true },
          scale: { mode: Phaser.Scale.NONE },
          input: { keyboard: false, mouse: false, touch: false },
        });
      else game.scale.resize(dims().width, dims().height);
    }

    const obs = new ResizeObserver(resize);
    obs.observe(parent);
    resize();

    parent.addEventListener("wheel", onWheel, { passive: false });
    parent.addEventListener("pointerdown", onPointerDown);
    parent.addEventListener("pointermove", onPointerMove);
    parent.addEventListener("pointerup", onPointerUp);
    parent.addEventListener("pointercancel", onPointerUp);

    return () => {
      obs.disconnect();
      parent.removeEventListener("wheel", onWheel);
      parent.removeEventListener("pointerdown", onPointerDown);
      parent.removeEventListener("pointermove", onPointerMove);
      parent.removeEventListener("pointerup", onPointerUp);
      parent.removeEventListener("pointercancel", onPointerUp);
      game?.destroy(true);
    };
  }, [vessel]);

  return (
    <div
      ref={host}
      className="flight-scene"
      role="img"
      aria-label="Live world-fixed flight view of Earth and launch vehicle"
    />
  );
}
