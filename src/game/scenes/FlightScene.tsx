import { useEffect, useRef, type MutableRefObject } from "react";
import Phaser from "phaser";
import {
  AIR,
  CHUTE_FULL_ALT,
  R,
  bodyParams,
  burning,
  clamp,
  headingVector,
  radius,
  type Flight,
  type FlightVisualPart,
} from "../../sim/flight";
import { PARTS, type PartId } from "../../program/workshop";

interface RenderedPart {
  def: (typeof PARTS)[PartId];
  symmetry: 1 | 2;
}

function resolveParts(list: FlightVisualPart[] | undefined, minStage: number) {
  if (!list || !list.length) return null;
  const active = list
    .filter((p) => p.stage >= minStage && Object.hasOwn(PARTS, p.partId))
    .map((p) => ({
      def: PARTS[p.partId as PartId],
      symmetry: p.symmetry,
    }));
  return active.length ? active : null;
}

/** Draws a custom VAB rocket or detached booster stack anchored so its bottom sits at local y = 0. */
function drawCustomStack(
  g: Phaser.GameObjects.Graphics,
  parts: RenderedPart[],
  cx: number,
  cy: number,
  angle: number,
  pxPerMeter: number,
) {
  const center = parts.filter((p) => !(p.def.symmetric && p.symmetry === 2));
  const radial = parts.filter((p) => p.def.symmetric && p.symmetry === 2);
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

  // Stack bottom-to-top from local y = 0 upward (negative local y is nose direction)
  let totalH = 0;
  for (const p of center) totalH += Math.max(4, p.def.heightM * pxPerMeter);

  let yTop = -totalH;
  let coreHalfW = 5 * pxPerMeter * 0.25;

  for (const { def } of center) {
    const h = Math.max(4, def.heightM * pxPerMeter);
    const w = Math.max(6, def.widthM * pxPerMeter * 1.15);
    const hw = w / 2;
    coreHalfW = Math.max(coreHalfW, hw);
    const yBot = yTop + h;

    if (def.category === "pod") {
      fillPoly(
        [
          [0, yTop],
          [hw, yBot],
          [-hw, yBot],
        ],
        0xe8e2d5,
        0x7f959c,
      );
      // Retro capsule window band
      fillPoly(
        [
          [-hw * 0.35, yTop + h * 0.52],
          [hw * 0.35, yTop + h * 0.52],
          [hw * 0.45, yTop + h * 0.72],
          [-hw * 0.45, yTop + h * 0.72],
        ],
        0x223847,
      );
    } else if (def.category === "engine") {
      fillPoly(
        [
          [-hw * 0.45, yTop],
          [hw * 0.45, yTop],
          [hw * 0.85, yBot],
          [-hw * 0.85, yBot],
        ],
        0x495b69,
        0x8ea3ac,
      );
    } else if (def.category === "stage") {
      fillPoly(
        [
          [-hw, yTop],
          [hw, yTop],
          [hw, yBot],
          [-hw, yBot],
        ],
        0xd98d4c,
        0x6e4724,
      );
    } else if (def.category === "utility") {
      fillPoly(
        [
          [-hw, yTop],
          [hw, yTop],
          [hw, yBot],
          [-hw, yBot],
        ],
        0x7ea8ab,
        0x3e5c63,
      );
    } else {
      // Cryo tank with retro-aerospace amber roll stripe
      fillPoly(
        [
          [-hw, yTop],
          [hw, yTop],
          [hw, yBot],
          [-hw, yBot],
        ],
        0xd5dcd7,
        0x7e9499,
      );
      fillPoly(
        [
          [-hw, yTop + h * 0.44],
          [hw, yTop + h * 0.44],
          [hw, yTop + h * 0.58],
          [-hw, yTop + h * 0.58],
        ],
        0xf3a953,
      );
    }
    yTop = yBot;
  }

  // Draw 2x mirror radial boosters / legs symmetrically on left & right sides
  for (const { def } of radial) {
    const h = Math.max(6, def.heightM * pxPerMeter);
    const w = Math.max(4, def.widthM * pxPerMeter * 1.15);
    const yBot = 0;
    const yTopR = -h;
    for (const side of [-1, 1] as const) {
      const xIn = side * (coreHalfW + 1);
      const xOut = side * (coreHalfW + 1 + w);
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
    }
  }

  return totalH;
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
      // Double-tap resets zoom smoothly back to close-up rocket view
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
      tower!: Phaser.GameObjects.Image;
      debrisSprites: Phaser.GameObjects.Image[] = [];
      customGfx!: Phaser.GameObjects.Graphics;
      flame!: Phaser.GameObjects.Graphics;
      ship!: Phaser.GameObjects.Image;
      marker!: Phaser.GameObjects.Graphics;

      preload() {
        for (const key of ["tower", "vehicle", "upper"])
          this.load.image(
            key,
            import.meta.env.BASE_URL + "art/" + key + ".png",
          );
      }

      create() {
        this.bg = this.add.graphics();
        this.world = this.add.graphics();
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
        // Anchor ship sprite at its bottom center (engine bells) so alt = 0 sits flush on the pad!
        this.ship = this.add.image(0, 0, "vehicle").setOrigin(0.5, 1);
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

        // World-fixed north-up inertial camera centered on the rocket.
        // Anchor slightly below center on the pad so the full rocket + tower frame cleanly above controls.
        const cx = Math.round(w * 0.5);
        const cy = Math.round(h * (s.status === "pad" ? 0.62 : 0.52));
        const basePpm = Math.min(w, h) / 215;
        const ppm = basePpm * zoom;

        const worldToScreen = (wx: number, wy: number) => ({
          x: cx + (wy - s.y) * ppm,
          y: cy - (wx - s.x) * ppm,
        });

        // 1. Sky / Space background based on 30 km SFS atmosphere
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

        // 2. Physical curved Earth + 30 km atmosphere halo
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

        // 3. Launchpad slab & gantry tower flush with surface at North Pole (R, 0)
        // Because rocket origin is bottom-center (0.5, 1) at (s.x, s.y), at alt=0 its bells rest right on padScreen.y!
        const padScreen = worldToScreen(bp.R, 0);
        const padVisible = !isMoon &&
          ppm > 0.08 &&
          padScreen.x > -200 &&
          padScreen.x < w + 200 &&
          padScreen.y > -200 &&
          padScreen.y < h + 200;

        const shipScale = clamp(ppm / 1.35, 0.16, 2.2);
        if (padVisible) {
          const padW = 84 * shipScale;
          const padH = 6 * shipScale;
          g.fillStyle(0x283643, 1).fillRect(
            padScreen.x - padW / 2,
            padScreen.y,
            padW,
            Math.max(3, padH),
          );
          g.fillStyle(0xb8b2a1, 1).fillRect(
            padScreen.x - padW / 2 - 2,
            padScreen.y - 1,
            padW + 4,
            Math.max(2, 2 * shipScale),
          );
          for (let i = -3; i <= 3; i++) {
            g.fillStyle(0xd99357, 1).fillRect(
              padScreen.x + i * 11 * shipScale - 2,
              padScreen.y,
              4 * shipScale,
              1.5,
            );
          }
          // Tower stands cleanly on the left side of the pad with umbilical arms aligned to the hull
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
        if (customParts && spriteVisible) {
          this.ship.setVisible(false);
          activeRocketHeight = drawCustomStack(customGfx, customParts, cx, cy, angle, ppm * 2.1);
        } else {
          this.ship
            .setTexture(upper ? "upper" : "vehicle")
            .setPosition(cx, cy)
            .setRotation(angle)
            .setScale(shipScale)
            .setVisible(spriteVisible);
        }

        // 5b. Deployable Landing Legs & Parachute Canopy visuals
        if (spriteVisible) {
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          const localPt = (lx: number, ly: number) => ({
            x: cx + lx * cosA - ly * sinA,
            y: cy + lx * sinA + ly * cosA,
          });
          if (s.legsDeployed) {
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
          if (s.chuteDeployed && alt < AIR) {
            // Parachute vector is strictly opposite gravity (+radial outward) with rocket tip locked to shroud
            const antiGravAngle = Math.atan2(s.y, s.x);
            const cG = Math.cos(antiGravAngle);
            const sG = Math.sin(antiGravAngle);
            const nose = localPt(0, -activeRocketHeight);
            const chutePt = (lx: number, ly: number) => ({
              x: nose.x + lx * cG - ly * sG,
              y: nose.y + lx * sG + ly * cG,
            });
            const fullOpen = alt <= CHUTE_FULL_ALT;
            const bloom = fullOpen ? 1.0 : 0.48;
            const sway = Math.sin(s.t * 4.2) * (fullOpen ? 3 : 1.5) * shipScale;
            const canopyDist = (fullOpen ? 50 : 38) * shipScale;
            const span = 28 * bloom * shipScale;
            const domeH = 16 * bloom * shipScale;
            const leftRim = chutePt(-span + sway, -canopyDist);
            const rightRim = chutePt(span + sway, -canopyDist);
            const midL = chutePt(-span * 0.5 + sway, -canopyDist - domeH * 0.75);
            const apex = chutePt(sway, -canopyDist - domeH);
            const midR = chutePt(span * 0.5 + sway, -canopyDist - domeH * 0.75);
            customGfx
              .lineStyle(1.1, 0xd8d2c5, 0.85)
              .lineBetween(nose.x, nose.y, leftRim.x, leftRim.y)
              .lineBetween(nose.x, nose.y, rightRim.x, rightRim.y)
              .lineBetween(nose.x, nose.y, midL.x, midL.y)
              .lineBetween(nose.x, nose.y, midR.x, midR.y);
            customGfx
              .fillStyle(0xf28c28, 0.96)
              .fillPoints([leftRim, midL, apex, midR, rightRim], true)
              .fillStyle(0xf6f1e3, 0.96)
              .fillPoints([midL, apex, midR, chutePt(sway, -canopyDist)], true)
              .lineStyle(1.4, 0x090e14, 0.9)
              .strokePoints([leftRim, midL, apex, midR, rightRim], true);
          }
        }

        // 6. Exhaust plume anchored right at the engine bells (cx, cy) + pad liftoff smoke
        const flame = this.flame;
        flame.clear();
        if (burning(s) && spriteVisible) {
          const fx = cx;
          const fy = cy;
          const wave = Math.sin(s.t * 44) * 3 * shipScale;
          for (const [width, length, color] of [
            [6 * shipScale, 24 * shipScale + wave, 0xd86c45],
            [4 * shipScale, 16 * shipScale + wave, 0xf3a953],
            [2 * shipScale, 10 * shipScale, 0xffefd0],
          ]) {
            const len = length * (0.35 + 0.65 * s.throttle);
            const dx = Math.cos(angle) * width;
            const dy = Math.sin(angle) * width;
            flame.fillStyle(color).fillTriangle(
              fx - dx,
              fy - dy,
              fx + dx,
              fy + dy,
              fx - Math.sin(angle) * len,
              fy + Math.cos(angle) * len,
            );
          }
          // Pad exhaust billowing smoke near liftoff
          if (alt < 120 && padVisible) {
            for (let i = 0; i < 16; i++) {
              const k = (s.t * 1.6 + i * 0.37) % 1;
              const dir = i % 2 ? 1 : -1;
              flame
                .fillStyle(i % 3 ? 0xc8c2b6 : 0x7f8b92, (1 - k) * 0.75)
                .fillCircle(
                  padScreen.x + dir * k * 56 * shipScale,
                  padScreen.y - (2 + k * 9) * shipScale,
                  (3 + k * 6) * shipScale,
                );
            }
          }
        }

        // 7. Far-zoom spacecraft reticle so you never lose sight of your ship when viewing whole Earth
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
