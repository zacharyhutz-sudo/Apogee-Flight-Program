import { useEffect, useRef, type MutableRefObject } from "react";
import Phaser from "phaser";
import {
  AIR,
  R,
  burning,
  clamp,
  headingVector,
  radius,
  type Flight,
} from "../../sim/flight";

export function FlightScene({ vessel }: { vessel: MutableRefObject<Flight> }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = host.current!;
    // Smooth zoom factor: 1.0 = close-up rocket view (~1.45 px/m), down to 0.00045 = whole planet view
    let zoom = 1;
    const pointers = new Map<number, { x: number; y: number }>();
    let lastSpan = 0;

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

    // Deterministic procedural starfield
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
            .setVisible(false);
          this.debrisSprites.push(d);
        }
        this.flame = this.add.graphics();
        this.ship = this.add.image(0, 0, "vehicle");
        this.marker = this.add.graphics();
      }

      update() {
        const s = vessel.current;
        const w = this.scale.width;
        const h = this.scale.height;
        const r = radius(s) || R;
        const alt = Math.max(0, r - R);

        // World-fixed north-up inertial camera centered on the rocket.
        // Screen X = +y (East), Screen Y = -x (North is up, South Pole puts Earth ABOVE rocket!)
        const cx = Math.round(w * 0.5);
        const cy = Math.round(h * 0.5);
        const basePpm = Math.min(w, h) / 245;
        const ppm = basePpm * zoom;

        const worldToScreen = (wx: number, wy: number) => ({
          x: cx + (wy - s.y) * ppm,
          y: cy - (wx - s.x) * ppm,
        });

        // 1. Sky / Space background gradient based on altitude (30 km SFS atmosphere)
        const atmoFrac = clamp(1 - alt / AIR, 0, 1);
        const bg = this.bg;
        bg.clear();
        const skyR = Math.round(13 + 38 * atmoFrac * atmoFrac);
        const skyG = Math.round(23 + 66 * atmoFrac);
        const skyB = Math.round(34 + 92 * atmoFrac);
        const skyColor = (skyR << 16) | (skyG << 8) | skyB;
        bg.fillStyle(skyColor, 1).fillRect(0, 0, w, h);

        // Stars fade in smoothly as atmosphere thins
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

        // 2. Physical curved Earth + 30 km atmosphere halo (accurate at ALL zooms!)
        const g = this.world;
        g.clear();

        const planetScreenR = R * ppm;
        const atmoScreenR = (R + AIR) * ppm;
        const earthCenter = worldToScreen(0, 0);

        if (planetScreenR < 2600) {
          // Medium-to-far zoom: draw full circular planet + atmosphere glow directly
          g.fillStyle(0x4b87a6, 0.24).fillCircle(
            earthCenter.x,
            earthCenter.y,
            atmoScreenR,
          );
          g.lineStyle(1.2, 0x87c8d6, 0.45).strokeCircle(
            earthCenter.x,
            earthCenter.y,
            atmoScreenR,
          );
          g.fillStyle(0x1f435a, 1).fillCircle(
            earthCenter.x,
            earthCenter.y,
            planetScreenR,
          );
          // Surface biosphere rim + ocean/continent accents
          g.lineStyle(Math.max(1.5, Math.min(5, planetScreenR * 0.018)), 0x5c8b76, 1).strokeCircle(
            earthCenter.x,
            earthCenter.y,
            planetScreenR,
          );
          // North-pole launch complex beacon on the physical surface
          const padPt = worldToScreen(R, 0);
          g.fillStyle(0xf3a953, 0.9).fillCircle(padPt.x, padPt.y, Math.max(2, Math.min(4, 1800 * ppm)));
        } else {
          // Close-up zoom: sample the true curved horizon arc around the rocket's radial angle
          // (avoids Canvas floating-point jitter when radius is 100,000+ px)
          const centerAngle = Math.atan2(s.y, s.x);
          const halfSpan = clamp((Math.max(w, h) * 1.1) / planetScreenR, 0.0005, Math.PI * 0.45);
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
              pts.push(worldToScreen(outerR * Math.cos(a), outerR * Math.sin(a)));
            }
            for (let i = steps; i >= 0; i--) {
              const a = centerAngle - halfSpan + (2 * halfSpan * i) / steps;
              pts.push(worldToScreen(innerR * Math.cos(a), innerR * Math.sin(a)));
            }
            g.fillStyle(color, alpha).fillPoints(pts, true);
          };

          // Thin upper atmosphere glow band
          if (alt < AIR * 1.8) {
            drawArcBand(R + AIR, R, 0x4b87a6, 0.22 * (0.4 + 0.6 * atmoFrac));
          }
          // Deep planet body below surface
          const depth = Math.min(R * 0.6, (Math.max(w, h) * 1.4) / ppm);
          drawArcBand(R, Math.max(0, R - depth), 0x1d3544, 1);
          // Green coastal terrain crust band (~45 m thick at close range)
          const crust = Math.max(12, 8 / ppm);
          drawArcBand(R, Math.max(0, R - crust), 0x4f7865, 1);

          // Crisp horizon rim line
          const rimPts: Array<{ x: number; y: number }> = [];
          for (let i = 0; i <= steps; i++) {
            const a = centerAngle - halfSpan + (2 * halfSpan * i) / steps;
            rimPts.push(worldToScreen(R * Math.cos(a), R * Math.sin(a)));
          }
          g.lineStyle(1.5, 0x89b39d, 0.95).strokePoints(rimPts, false);
        }

        // 3. Physical Launchpad slab & gantry tower anchored at North Pole (x = R, y = 0)
        const padScreen = worldToScreen(R, 0);
        const padVisible =
          ppm > 0.08 &&
          padScreen.x > -200 &&
          padScreen.x < w + 200 &&
          padScreen.y > -200 &&
          padScreen.y < h + 200;

        if (padVisible) {
          const padW = 72 * ppm;
          const padH = 5 * ppm;
          g.fillStyle(0x2a3845, 1).fillRect(
            padScreen.x - padW / 2,
            padScreen.y - 1,
            padW,
            Math.max(3, padH),
          );
          g.fillStyle(0xb5b09f, 1).fillRect(
            padScreen.x - padW / 2 - 2,
            padScreen.y - 2,
            padW + 4,
            Math.max(2, 2 * ppm),
          );
          this.tower
            .setVisible(true)
            .setPosition(padScreen.x - 4 * ppm, padScreen.y)
            .setScale(clamp(ppm / 1.45, 0.08, 2.5));
        } else {
          this.tower.setVisible(false);
        }

        // 4. Real simulated detached stages (falling under gravity + drag + tumble)
        const debrisList = s.debris ?? [];
        const shipScale = clamp(ppm / 1.45, 0.16, 2.2);
        for (let i = 0; i < this.debrisSprites.length; i++) {
          const spr = this.debrisSprites[i];
          const d = debrisList[i];
          if (!d || ppm < 0.05) {
            spr.setVisible(false);
            continue;
          }
          const pt = worldToScreen(d.x, d.y);
          spr
            .setVisible(true)
            .setPosition(pt.x, pt.y)
            .setRotation(d.angle)
            .setScale(shipScale);
        }

        // 5. Rocket sprite in exact world-space north-up orientation
        const upper = s.stage === 1;
        const { angle } = headingVector(s);
        const spriteVisible = s.status !== "lost" && ppm >= 0.06;
        const shipH = (upper ? 42 : 76) * shipScale;

        this.ship
          .setTexture(upper ? "upper" : "vehicle")
          .setPosition(cx, cy)
          .setRotation(angle)
          .setScale(shipScale)
          .setVisible(spriteVisible);

        // Exhaust plume along exact world-space tail vector
        const flame = this.flame;
        flame.clear();
        if (burning(s) && spriteVisible) {
          const fx = cx - Math.sin(angle) * (shipH / 2 - 2 * shipScale);
          const fy = cy + Math.cos(angle) * (shipH / 2 - 2 * shipScale);
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
        }

        // 6. Far-zoom spacecraft reticle so you never lose sight of your ship when viewing whole Earth
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
