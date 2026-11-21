import { useEffect, useRef } from "react";
import Phaser from "phaser";
import {
  SIZE,
  placement,
  terrain,
  type Program,
  type Kind,
} from "../../program/program";
export type Tile = { x: number; y: number };
const frames: Record<Kind, number> = { command: 8, pad: 11, fuel: 14, lab: 17 };
const project = (x: number, y: number) => ({
  x: (x - y) * 32,
  y: (x + y) * 16,
});
interface Props {
  program: Program;
  selected: Tile | null;
  placing: Kind | null;
  onTile: (t: Tile) => void;
  zoom: number;
  recenter: number;
}
export function EarthScene(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    state = useRef(props);
  state.current = props;
  useEffect(() => {
    const el = host.current!;
    let scale = 1,
      panX = 0,
      panY = 0,
      moved = false,
      startX = 0,
      startY = 0,
      span = 0,
      zoomState = props.zoom,
      home = props.recenter;
    const points = new Map<number, { x: number; y: number }>();
    function size() {
      return (
        Math.min(el.clientWidth / 455, el.clientHeight / 340, 2.35) * scale
      );
    }
    function origin() {
      return {
        x: el.clientWidth / 2 + panX,
        y: el.clientHeight * 0.49 + panY - 112 * size(),
      };
    }
    function tileAt(x: number, y: number) {
      const o = origin(),
        a = (x - o.x) / size() / 32,
        b = (y - o.y) / size() / 16;
      return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
    }
    function shift(dx: number, dy: number) {
      panX = Phaser.Math.Clamp(panX + dx, -200 * size(), 200 * size());
      panY = Phaser.Math.Clamp(panY + dy, -135 * size(), 135 * size());
    }
    function zoomBy(f: number) {
      scale = Phaser.Math.Clamp(scale * f, 0.65, 2.5);
      shift(0, 0);
    }
    function down(e: PointerEvent) {
      el.setPointerCapture(e.pointerId);
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 1) {
        moved = false;
        startX = e.clientX;
        startY = e.clientY;
      } else {
        moved = true;
        span = 0;
      }
    }
    function move(e: PointerEvent) {
      const old = points.get(e.pointerId);
      if (!old) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2) {
        const [a, b] = [...points.values()],
          dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (span > 0) zoomBy(dist / span);
        span = dist;
        return;
      }
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 5) moved = true;
      if (moved) shift(e.clientX - old.x, e.clientY - old.y);
    }
    function end(e: PointerEvent) {
      if (!points.has(e.pointerId)) return;
      if (e.type === "pointerup" && !moved && points.size === 1) {
        const rect = el.getBoundingClientRect(),
          x = e.clientX - rect.left,
          y = e.clientY - rect.top;
        const t = tileAt(x, y);
        // Upper pixels of tall structures belong to their footprint as well.
        if (!state.current.placing) {
          const o = origin(),
            z = size();
          const b = [...state.current.program.buildings]
            .sort((a, b) => b.x + b.y - a.x - a.y)
            .find((b) => {
              const pt = project(b.x, b.y);
              return (
                Math.abs((x - o.x) / z - pt.x) < 17 &&
                (y - o.y) / z > pt.y - (b.kind === "pad" ? 40 : 23) &&
                (y - o.y) / z < pt.y + 7
              );
            });
          if (b) {
            t.x = b.x;
            t.y = b.y;
          }
        }
        if (t.x >= 0 && t.y >= 0 && t.x < SIZE && t.y < SIZE)
          state.current.onTile(t);
      }
      points.delete(e.pointerId);
      span = 0;
    }
    function wheel(e: WheelEvent) {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.0015));
    }
    class Site extends Phaser.Scene {
      board!: Phaser.GameObjects.Container;
      marker!: Phaser.GameObjects.Graphics;
      ghost!: Phaser.GameObjects.Image;
      buildings!: Phaser.GameObjects.Container;
      signature = "";
      ready = false;
      preload() {
        this.load.spritesheet(
          "terrain",
          import.meta.env.BASE_URL + "art/site.png",
          { frameWidth: 80, frameHeight: 104 },
        );
      }
      create() {
        this.board = this.add.container(0, 0);
        for (let sum = -8; sum < 24; sum++)
          for (let x = -5; x <= 12; x++) {
            const y = sum - x;
            if (y < -5 || y > 12) continue;
            const pt = project(x, y),
              t = terrain(x, y);
            const frame =
              t === "water"
                ? 7
                : t === "grove"
                  ? 6
                  : t === "rock"
                    ? 5
                    : t === "road"
                      ? 4
                      : Math.abs(x * 13 + y * 7) % 4;
            this.board.add(
              this.add
                .image(pt.x, pt.y, "terrain", frame)
                .setOrigin(0.5, 80 / 104),
            );
          }
        const surf = this.add.graphics();
        this.board.add(surf);
        for (let x = 0; x < SIZE; x++)
          for (let y = 0; y < SIZE; y++) {
            if (terrain(x, y) === "water") continue;
            const pt = project(x, y);
            for (const [dx, dy, ax, ay, bx, by] of [
              [1, 0, 32, 0, 0, 16],
              [0, 1, 0, 16, -32, 0],
              [-1, 0, -32, 0, 0, -16],
              [0, -1, 0, -16, 32, 0],
            ]) {
              if (terrain(x + dx, y + dy) !== "water") continue;
              const drop = dx + dy > 0 ? 7 : 0;
              surf
                .lineStyle(1, 0x98bcac, 0.75)
                .lineBetween(
                  pt.x + ax,
                  pt.y + ay + drop,
                  pt.x + bx,
                  pt.y + by + drop,
                );
            }
            if (y === 4 && x % 2 === 1)
              this.board.add(
                this.add
                  .image(pt.x - 13, pt.y + 4, "terrain", 20)
                  .setOrigin(0.5, 80 / 104),
              );
          }
        this.marker = this.add.graphics();
        this.board.add(this.marker);
        this.buildings = this.add.container(0, 0);
        this.board.add(this.buildings);
        this.ghost = this.add
          .image(0, 0, "terrain", 8)
          .setOrigin(0.5, 80 / 104)
          .setAlpha(0.65);
        this.board.add(this.ghost);
        this.ready = true;
      }
      update() {
        if (!this.ready) return;
        const p = state.current;
        if (zoomState !== p.zoom) {
          zoomBy(1.25 ** (p.zoom - zoomState));
          zoomState = p.zoom;
        }
        if (home !== p.recenter) {
          scale = 1;
          panX = 0;
          panY = 0;
          home = p.recenter;
        }
        const o = origin();
        this.board
          .setPosition(Math.round(o.x), Math.round(o.y))
          .setScale(size());
        const key = p.program.buildings
          .map((b) => [b.kind, b.level, b.x, b.y].join())
          .join("|");
        if (key !== this.signature) {
          this.signature = key;
          this.buildings.removeAll(true);
          for (const b of [...p.program.buildings].sort(
            (a, b) => a.x + a.y - b.x - b.y,
          )) {
            const pt = project(b.x, b.y);
            this.buildings.add(
              this.add
                .image(pt.x, pt.y, "terrain", frames[b.kind] + b.level - 1)
                .setOrigin(0.5, 80 / 104),
            );
          }
        }
        this.marker.clear();
        this.ghost.setVisible(false);
        if (p.placing) {
          for (let tx = 0; tx < SIZE; tx++)
            for (let ty = 0; ty < SIZE; ty++) {
              if (placement(p.program, p.placing, tx, ty)) continue;
              const q = project(tx, ty);
              this.marker
                .lineStyle(1, 0xc6e3bb, 0.55)
                .beginPath()
                .moveTo(q.x, q.y - 15)
                .lineTo(q.x + 30, q.y)
                .lineTo(q.x, q.y + 15)
                .lineTo(q.x - 30, q.y)
                .closePath()
                .strokePath();
            }
        }
        if (p.selected) {
          const { x, y } = project(p.selected.x, p.selected.y);
          const bad = p.placing
            ? placement(p.program, p.placing, p.selected.x, p.selected.y)
            : "";
          const c = bad ? 0xf28e77 : p.placing ? 0xa8f2c5 : 0xffcb84;
          this.marker
            .lineStyle(2, c)
            .fillStyle(c, 0.24)
            .beginPath()
            .moveTo(x, y - 16)
            .lineTo(x + 32, y)
            .lineTo(x, y + 16)
            .lineTo(x - 32, y)
            .closePath()
            .fillPath()
            .strokePath();
          if (p.placing)
            this.ghost
              .setVisible(true)
              .setPosition(x, y)
              .setFrame(frames[p.placing])
              .setTint(bad ? 0xf19888 : 0xb8f1c4);
        }
      }
    }
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: el,
      backgroundColor: "#304e5d",
      pixelArt: true,
      roundPixels: true,
      width: el.clientWidth,
      height: el.clientHeight,
      scene: Site,
      banner: false,
      audio: { noAudio: true },
      input: { keyboard: false, mouse: false, touch: false },
      fps: { target: 30, forceSetTimeOut: true },
    });
    const obs = new ResizeObserver(() =>
      game.scale.resize(el.clientWidth, el.clientHeight),
    );
    obs.observe(el);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      obs.disconnect();
      game.destroy(true);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
      el.removeEventListener("wheel", wheel);
    };
  }, []);
  return (
    <div
      ref={host}
      className="earth-canvas"
      role="img"
      aria-label="Isometric Earth launch site"
    />
  );
}
