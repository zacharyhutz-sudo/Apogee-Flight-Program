import { useEffect, useRef } from "react";
import Phaser from "phaser";
import {
  FACILITIES,
  SIZE,
  TIER2_KINDS,
  getCollectorCaps,
  getStorageCaps,
  level,
  placement,
  tileTerrain,
  type Program,
  type Kind,
} from "../../program/program";

export type Tile = { x: number; y: number };

export interface CollectBurst {
  x: number;
  y: number;
  text: string;
  color: string;
  seq: number;
}

const frames: Record<Kind, number> = {
  command: 8,
  pad: 12,
  refinery: 16,
  tanks: 20,
  office: 24,
  vab: 28,
  tracking: 32,
  lab: 36,
  foundry: 40,
};
const LAMP_FRAME = 44;
const LOCKED_PAD_FRAME = 45;

const project = (x: number, y: number) => ({
  x: (x - y) * 32,
  y: (x + y) * 16,
});

interface Props {
  program: Program;
  selected: Tile | null;
  placing: Kind | null;
  movingFrom?: Tile | null;
  onTile: (t: Tile) => void;
  collectBurst?: CollectBurst | null;
  zoom?: number;
  recenter?: number;
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
      zoomState = props.zoom ?? 0,
      home = props.recenter ?? 0;
    const points = new Map<number, { x: number; y: number }>();

    const badgeHits: Array<{ tile: Tile; x: number; y: number }> = [];

    let width = el.clientWidth, height = el.clientHeight;
    function size() {
      return Math.min(width / 455, height / 340, 2.35) * scale;
    }
    function origin() {
      return {
        x: width / 2 + panX,
        y: height * 0.49 + panY - 112 * size(),
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
        // Upper pixels of tall structures and collect bubbles belong to their footprint.
        if (!state.current.placing) {
          const o = origin(),
            z = size();
          const localX = (x - o.x) / z;
          const localY = (y - o.y) / z;
          const hit = badgeHits.find((badge) =>
            Math.abs(localX - badge.x) <= 12 && Math.abs(localY - badge.y) <= 13
          );
          const b = hit?.tile ?? [...state.current.program.buildings]
            .sort((a, b) => b.x + b.y - a.x - a.y)
            .find((b) => {
              const pt = project(b.x, b.y);
              const tall =
                b.kind === "pad"
                  ? 44
                  : b.kind === "vab" || b.kind === "foundry" || b.kind === "refinery"
                    ? 40
                    : 26;
              return (
                Math.abs((x - o.x) / z - pt.x) < 19 &&
                (y - o.y) / z > pt.y - tall &&
                (y - o.y) / z < pt.y + 8
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
      ground!: Phaser.Textures.CanvasTexture;
      badges: Phaser.GameObjects.Image[] = [];
      terrainSig = "";
      marker!: Phaser.GameObjects.Graphics;
      overlay!: Phaser.GameObjects.Graphics;
      ghost!: Phaser.GameObjects.Image;
      buildings!: Phaser.GameObjects.Container;
      fx!: Phaser.GameObjects.Container;
      crewGfx!: Phaser.GameObjects.Graphics;
      crew: Array<{
        x: number;
        y: number;
        tx: number;
        ty: number;
        speed: number;
        pause: number;
        suit: number;
        helmet: boolean;
        phase: number;
      }> = [];
      lastBurstSeq = 0;
      signature = "";
      ready = false;

      preload() {
        for (const resource of ["credits", "propellant"])
          this.load.image(resource, import.meta.env.BASE_URL + "art/" + resource + ".png");
        this.load.spritesheet(
          "terrain",
          import.meta.env.BASE_URL + "art/site.png",
          { frameWidth: 80, frameHeight: 104 },
        );
      }

      rebuildTerrain(prog: Program) {
        // Bake the static island once in board coordinates. Only reclamation changes it.
        const ground = this.ground;
        const ctx = ground.context;
        const left = 592, top = 224;
        ctx.clearRect(0, 0, ground.width, ground.height);
        const stamp = (frame: number, x: number, y: number) =>
          ground.drawFrame("terrain", frame, left + x - 40, top + y - 80, false);
        for (let sum = -8; sum < 24; sum++)
          for (let x = -5; x <= 12; x++) {
            const y = sum - x;
            if (y < -5 || y > 12) continue;
            const pt = project(x, y),
              t = tileTerrain(prog, x, y);
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
            if (t === "water") {
              // Sparse, reproducible glints break up the repeating diamond grid offshore.
              const seed = ((x + 17) * 73856093 ^ (y + 17) * 19349663) >>> 0;
              if (seed % 4 !== 0) {
                ctx.fillStyle = seed % 3 ? "#34829a" : "#428da1";
                const wx = left + pt.x - 12 + seed % 24;
                const wy = top + pt.y - 5 + (seed >>> 5) % 10;
                ctx.fillRect(wx, wy, 3 + (seed >>> 9) % 8, 1);
                if (seed % 5 === 0) ctx.fillRect(wx + 4, wy - 1, 4, 1);
              }
            } else {
              stamp(frame, pt.x, pt.y);
            }
          }
        ctx.strokeStyle = "#b3dccc";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < SIZE; x++)
          for (let y = 0; y < SIZE; y++) {
            if (tileTerrain(prog, x, y) === "water") continue;
            const pt = project(x, y);
            for (const [dx, dy, ax, ay, bx, by] of [
              [1, 0, 32, 0, 0, 16],
              [0, 1, 0, 16, -32, 0],
              [-1, 0, -32, 0, 0, -16],
              [0, -1, 0, -16, 32, 0],
            ]) {
              if (tileTerrain(prog, x + dx, y + dy) !== "water") continue;
              const drop = dx + dy > 0 ? 7 : 0;
              ctx.moveTo(left + pt.x + ax, top + pt.y + ay + drop);
              ctx.lineTo(left + pt.x + bx, top + pt.y + by + drop);
            }
            if (y === 4 && x % 2 === 1) stamp(LAMP_FRAME, pt.x - 13, pt.y + 4);
          }
        ctx.stroke();
        ground.refresh();
      }

      create() {
        this.board = this.add.container(0, 0);
        this.ground = this.textures.createCanvas("ground", 1184, 660)!;
        this.board.add(this.add.image(-592, -224, "ground").setOrigin(0));
        this.rebuildTerrain(state.current.program);
        this.terrainSig = (state.current.program.reclaimedTiles ?? []).join("|");
        this.marker = this.add.graphics();
        this.board.add(this.marker);
        this.buildings = this.add.container(0, 0);
        this.board.add(this.buildings);
        this.overlay = this.add.graphics();
        this.board.add(this.overlay);
        this.fx = this.add.container(0, 0);
        this.board.add(this.fx);
        this.crewGfx = this.add.graphics();
        this.board.add(this.crewGfx);
        const starts: Array<[number, number, number, boolean]> = [
          [1.2, 4.0, 0xf6f1e3, true],
          [3.1, 4.0, 0x4fd1a5, false],
          [4.8, 3.8, 0xf6f1e3, true],
          [2.4, 3.6, 0xf28c28, false],
          [3.8, 4.2, 0x6ea6c9, false],
          [5.6, 4.0, 0xf6f1e3, true],
        ];
        this.crew = starts.map(([x, y, suit, helmet], i) => ({
          x,
          y,
          tx: x,
          ty: y,
          speed: 0.42 + (i % 3) * 0.1,
          pause: 0.4 + i * 0.5,
          suit,
          helmet,
          phase: i * 1.3,
        }));
        this.ghost = this.add
          .image(0, 0, "terrain", 8)
          .setOrigin(0.5, 80 / 104)
          .setAlpha(0.65);
        this.board.add(this.ghost);
        this.ready = true;
      }

      update(time: number, delta: number) {
        if (!this.ready) return;
        const p = state.current;
        const nextZoom = p.zoom ?? 0;
        const nextHome = p.recenter ?? 0;
        if (zoomState !== nextZoom) {
          zoomBy(1.25 ** (nextZoom - zoomState));
          zoomState = nextZoom;
        }
        if (home !== nextHome) {
          scale = 1;
          panX = 0;
          panY = 0;
          home = nextHome;
        }
        const o = origin();
        this.board
          .setPosition(Math.round(o.x), Math.round(o.y))
          .setScale(size());

        const tSig = (p.program.reclaimedTiles ?? []).join("|");
        if (tSig !== this.terrainSig) {
          this.terrainSig = tSig;
          this.rebuildTerrain(p.program);
        }
        const mcLv = level(p.program, "command");
        const key =
          mcLv +
          ":" +
          p.program.buildings
            .map((b) => [b.kind, b.level, b.x, b.y].join())
            .join("|");
        if (key !== this.signature) {
          this.signature = key;
          this.buildings.removeAll(true);

          const items: Array<{
            x: number;
            y: number;
            frame: number;
            alpha: number;
            tint?: number;
          }> = [];

          for (const k of TIER2_KINDS) {
            if (level(p.program, k) === 0) {
              const pos = FACILITIES[k].defaultPos;
              const occupied = p.program.buildings.some(
                (b) => b.x === pos.x && b.y === pos.y,
              );
              if (!occupied) {
                items.push({
                  x: pos.x,
                  y: pos.y,
                  frame: LOCKED_PAD_FRAME,
                  alpha: mcLv >= 2 ? 0.92 : 0.65,
                  tint: mcLv >= 2 ? 0xb4f0d8 : 0x9db0b8,
                });
              }
            }
          }

          for (const b of p.program.buildings) {
            items.push({
              x: b.x,
              y: b.y,
              frame: frames[b.kind] + Math.min(3, Math.max(0, b.level - 1)),
              alpha: 1,
            });
          }

          items.sort((a, b) => a.x + a.y - (b.x + b.y));
          for (const it of items) {
            const pt = project(it.x, it.y);
            const img = this.add
              .image(pt.x, pt.y, "terrain", it.frame)
              .setOrigin(0.5, 80 / 104)
              .setAlpha(it.alpha);
            if (it.tint) img.setTint(it.tint);
            this.buildings.add(img);
          }
        }

        // Spawn rising floating text when player taps to collect
        if (p.collectBurst && p.collectBurst.seq !== this.lastBurstSeq) {
          this.lastBurstSeq = p.collectBurst.seq;
          const pt = project(p.collectBurst.x, p.collectBurst.y);
          const txt = this.add
            .text(pt.x, pt.y - 34, p.collectBurst.text, {
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: "9px",
              fontStyle: "bold",
              color: p.collectBurst.color,
              stroke: "#0d1722",
              strokeThickness: 2.5,
            })
            .setOrigin(0.5);
          this.fx.add(txt);
          this.tweens.add({
            targets: txt,
            y: pt.y - 58,
            alpha: 0,
            duration: 950,
            ease: "Cubic.easeOut",
            onComplete: () => txt.destroy(),
          });
        }

        // Animated pixel base crew strolling along roads and between facilities
        this.crewGfx.clear();
        const dtCrew = Math.min(delta, 80) / 1000;
        for (const c of this.crew) {
          if (c.pause > 0) {
            c.pause -= dtCrew;
            if (c.pause <= 0) {
              const blds = p.program.buildings;
              if (blds.length && Math.random() < 0.55) {
                const targetB = blds[Math.floor(Math.random() * blds.length)];
                c.tx = Phaser.Math.Clamp(targetB.x + (Math.random() - 0.5) * 0.7, 0.8, 6.4);
                c.ty = Phaser.Math.Clamp(targetB.y + 0.45 + (Math.random() - 0.5) * 0.35, 1.2, 5.6);
              } else {
                c.tx = 1.0 + Math.random() * 5.2;
                c.ty = 3.85 + (Math.random() - 0.5) * 0.3;
              }
            }
          } else {
            const dx = c.tx - c.x;
            const dy = c.ty - c.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 0.06) {
              c.pause = 1.4 + Math.random() * 2.8;
            } else {
              const stepDist = Math.min(dist, c.speed * dtCrew);
              c.x += (dx / dist) * stepDist;
              c.y += (dy / dist) * stepDist;
              c.phase += dtCrew * 11;
            }
          }
          const pt = project(c.x, c.y);
          const bobPx = c.pause > 0 ? 0 : Math.abs(Math.sin(c.phase)) * 1.4;
          const sx = Math.round(pt.x);
          const sy = Math.round(pt.y - bobPx);
          this.crewGfx.fillStyle(0x090e14, 0.45).fillEllipse(sx, Math.round(pt.y) + 1, 5, 2.5);
          this.crewGfx.fillStyle(0x1b2633, 1).fillRect(sx - 1, sy - 2, 1, 2).fillRect(sx + 1, sy - 2, 1, 2);
          this.crewGfx.fillStyle(c.suit, 1).fillRect(sx - 1, sy - 5, 3, 3);
          this.crewGfx.fillStyle(c.helmet ? 0xf6f1e3 : 0xe5b895, 1).fillRect(sx - 1, sy - 7, 3, 2);
          if (c.helmet) {
            this.crewGfx.fillStyle(0xf28c28, 1).fillRect(sx, sy - 7, 2, 1);
          }
        }

        // Overlays: Cryo Tank fill gauge + Clash-of-Clans bobbing collect bubbles
        this.overlay.clear();
        const storageCaps = getStorageCaps(p.program);
        const hopperCaps = getCollectorCaps(p.program);
        const bob = Math.round(Math.sin(time * 0.003) * 1.25);
        badgeHits.length = 0;

        const tanksBuilding = p.program.buildings.find(
          (b) => b.kind === "tanks",
        );
        if (tanksBuilding) {
          const ratio = Phaser.Math.Clamp(
            p.program.propellant / Math.max(1, storageCaps.propellant),
            0,
            1,
          );
          const pt = project(tanksBuilding.x, tanksBuilding.y);
          const barW = 24;
          const bx = pt.x - barW / 2;
          const by = pt.y - 29 - tanksBuilding.level * 2;
          this.overlay.fillStyle(0x10202b, 0.85);
          this.overlay.fillRoundedRect(bx - 1, by - 1, barW + 2, 5, 2);
          this.overlay.fillStyle(ratio >= 0.99 ? 0xf3a953 : 0x72d6c6, 0.95);
          this.overlay.fillRect(
            bx,
            by,
            Math.max(1, Math.round(barW * ratio)),
            3,
          );
        }

        const drawCollectBubble = (
          b: { x: number; y: number; level: number },
          amount: number,
          hopperCap: number,
          storageFull: boolean,
          resource: "credits" | "propellant",
        ) => {
          if (amount < 1) return;
          const pt = project(b.x, b.y);
          const cx = pt.x;
          const cy = pt.y - 42 - b.level * 2 + bob;
          const fillColor = resource === "credits" ? 0xf2b558 : 0x57d7c4;
          const fullHopper = amount >= hopperCap * 0.98;
          const ringColor = storageFull
            ? 0xf07c6b
            : fullHopper
              ? 0xffefd0
              : fillColor;
          this.overlay.fillStyle(0x172932, 1)
            .fillTriangle(cx - 4, cy + 9, cx + 4, cy + 9, cx, cy + 14)
            .fillRoundedRect(cx - 11, cy - 10, 22, 21, 4)
            .lineStyle(fullHopper ? 2 : 1, ringColor, 1)
            .strokeRoundedRect(cx - 11, cy - 10, 22, 21, 4);
          const index = badgeHits.length;
          if (!this.badges[index]) {
            this.badges[index] = this.add.image(0, 0, resource);
            this.board.add(this.badges[index]);
          }
          this.badges[index].setTexture(resource).setPosition(cx, cy)
            .setVisible(true).setAlpha(storageFull ? 0.65 : 1);
          badgeHits.push({ tile: b, x: cx, y: cy });
        };

        for (const foundryB of p.program.buildings.filter((b) => b.kind === "foundry")) {
          drawCollectBubble(
            foundryB,
            Math.floor(p.program.collectors.credits),
            hopperCaps.credits,
            p.program.credits >= storageCaps.credits,
            "credits",
          );
        }
        for (const refineryB of p.program.buildings.filter((b) => b.kind === "refinery")) {
          drawCollectBubble(
            refineryB,
            Math.floor(p.program.collectors.propellant),
            hopperCaps.propellant,
            p.program.propellant >= storageCaps.propellant,
            "propellant",
          );
        }
        for (let i = badgeHits.length; i < this.badges.length; i++) this.badges[i].setVisible(false);

        this.marker.clear();
        this.ghost.setVisible(false);
        if (p.placing) {
          for (let tx = 0; tx < SIZE; tx++)
            for (let ty = 0; ty < SIZE; ty++) {
              if (placement(p.program, p.placing, tx, ty, p.movingFrom)) continue;
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
            ? placement(p.program, p.placing, p.selected.x, p.selected.y, p.movingFrom)
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
      backgroundColor: "#227093",
      pixelArt: true,
      roundPixels: true,
      width: el.clientWidth,
      height: el.clientHeight,
      scene: Site,
      banner: false,
      audio: { noAudio: true },
      input: { keyboard: false, mouse: false, touch: false },
      fps: { target: 60 },
    });

    const obs = new ResizeObserver(() =>
      {
        width = el.clientWidth;
        height = el.clientHeight;
        game.scale.resize(width, height);
      }
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
