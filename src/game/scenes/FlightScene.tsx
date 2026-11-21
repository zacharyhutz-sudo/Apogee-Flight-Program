import { useEffect, useRef, type MutableRefObject } from "react";
import Phaser from "phaser";
import { R, radius, burning, type Flight } from "../../sim/flight";

export function FlightScene({ vessel }: { vessel: MutableRefObject<Flight> }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const parent = host.current!;
    class Range extends Phaser.Scene {
      sky!: Phaser.GameObjects.Image;
      space!: Phaser.GameObjects.Image;
      ground!: Phaser.GameObjects.Image;
      tower!: Phaser.GameObjects.Image;
      ship!: Phaser.GameObjects.Image;
      detail!: Phaser.GameObjects.Graphics;
      flame!: Phaser.GameObjects.Graphics;
      debris!: Phaser.GameObjects.Image;
      lastStage = 0;
      separated = -100;
      sepX = 0;
      sepY = 0;
      preload() {
        for (const key of [
          "dusk",
          "space",
          "range",
          "tower",
          "vehicle",
          "upper",
        ])
          this.load.image(
            key,
            import.meta.env.BASE_URL + "art/" + key + ".png",
          );
      }
      create() {
        this.sky = this.add.image(0, 0, "dusk").setOrigin(0.5, 0);
        this.space = this.add.image(0, 0, "space").setOrigin(0.5, 0);
        this.ground = this.add.image(0, 0, "range").setOrigin(0.5, 0);
        this.detail = this.add.graphics();
        this.tower = this.add.image(0, 0, "tower").setOrigin(1, 1);
        this.debris = this.add.image(0, 0, "vehicle").setCrop(0, 39, 28, 37);
        this.flame = this.add.graphics();
        this.ship = this.add.image(0, 0, "vehicle");
        this.lastStage = vessel.current.stage;
      }
      update() {
        const s = vessel.current,
          w = this.scale.width,
          h = this.scale.height,
          alt = Math.max(0, radius(s) - R);
        const groundY = Math.min(340, alt * 0.1),
          fade = Phaser.Math.Clamp((alt - 4800) / 64000, 0, 1);
        for (const img of [this.sky, this.space, this.ground])
          img.setPosition(w / 2, 0).setDisplaySize(Math.max(600, w), h);
        this.space.setAlpha(fade);
        this.ground.y = groundY;
        const cx = Math.round(w * 0.5),
          padY = Math.round(h * 0.91),
          towerX = cx + 5;
        this.tower.setPosition(towerX, padY + groundY);
        this.detail.clear();
        if (groundY < 150) {
          const g = this.detail,
            y = padY + groundY;
          g.fillStyle(0x293744)
            .fillRect(cx - 61, y - 1, 123, 6)
            .fillStyle(0x9f9a89)
            .fillRect(cx - 64, y - 3, 128, 2);
          for (let i = -56; i <= 55; i += 14)
            g.fillStyle(0xc98e5b).fillRect(cx + i, y - 2, 5, 1);
        }
        if (fade > 0) {
          const g = this.detail,
            rr = Math.max(w * 1.5, 680),
            top = h - Math.round(35 * fade);
          const centerY = top + rr;
          g.fillStyle(0x427795, fade * 0.65).fillCircle(
            w * 0.38,
            centerY,
            rr + 4,
          );
          g.fillStyle(0x93bbb8, fade).fillCircle(w * 0.38, centerY, rr + 1);
          g.fillStyle(0x22425a, fade).fillCircle(w * 0.38, centerY, rr);
          g.fillStyle(0x1d344b, fade).fillCircle(w * 0.38, centerY + 6, rr);
        }
        const upper = s.stage === 1,
          shipH = upper ? 42 : 76,
          bodyY = padY - 3 - shipH / 2;
        const cy = Math.round(bodyY - Math.min(57, alt * 0.18)),
          angle = (s.pitch * Math.PI) / 180;
        this.ship
          .setTexture(upper ? "upper" : "vehicle")
          .setPosition(cx, cy)
          .setRotation(angle);
        this.ship.setVisible(s.status !== "lost");
        if (s.stage !== this.lastStage && upper) {
          this.separated = s.t;
          this.sepX = cx;
          this.sepY = cy + 13;
        }
        this.lastStage = s.stage;
        const age = s.t - this.separated;
        this.debris.setVisible(upper && age >= 0 && age < 4);
        if (this.debris.visible)
          this.debris
            .setPosition(this.sepX - age * 8, this.sepY + age * age * 8)
            .setRotation(age * 0.35);
        const fx = cx - Math.sin(angle) * (shipH / 2 - 2),
          fy = cy + Math.cos(angle) * (shipH / 2 - 2);
        const g = this.flame;
        g.clear();
        if (burning(s)) {
          const wave = Math.sin(s.t * 44) * 3;
          for (const [width, length, color] of [
            [6, 22 + wave, 0xd86c45],
            [4, 15 + wave, 0xffb258],
            [2, 9, 0xffefd0],
          ]) {
            const len = length * (0.35 + 0.65 * s.throttle),
              dx = Math.cos(angle) * width,
              dy = Math.sin(angle) * width;
            g.fillStyle(color).fillTriangle(
              fx - dx,
              fy - dy,
              fx + dx,
              fy + dy,
              fx - Math.sin(angle) * len,
              fy + Math.cos(angle) * len,
            );
          }
          if (alt < 270)
            for (let i = 0; i < 20; i++) {
              const k = (s.t * 1.4 + i * 0.37) % 1,
                dir = i % 2 ? 1 : -1;
              g.fillStyle(i % 3 ? 0x9e9790 : 0x696d73, (1 - k) * 0.85).fillRect(
                cx + dir * k * 53,
                padY + groundY - 5 - k * 7,
                4 + k * 6,
                3 + k * 4,
              );
            }
        }
        if (s.status === "lost")
          g.fillStyle(0x6f625c).fillRect(cx - 10, padY - 7, 20, 4);
      }
    }
    function dims() {
      return {
        width: Math.max(
          180,
          Math.round(
            (parent.clientWidth / Math.max(1, parent.clientHeight)) * 260,
          ),
        ),
        height: 260,
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
          height: 260,
          scene: Range,
          backgroundColor: "#142133",
          pixelArt: true,
          roundPixels: true,
          banner: false,
          audio: { noAudio: true },
          fps: { target: 30, forceSetTimeOut: true },
          scale: { mode: Phaser.Scale.NONE },
          input: { keyboard: false, mouse: false, touch: false },
        });
      else game.scale.resize(dims().width, 260);
    }
    const obs = new ResizeObserver(resize);
    obs.observe(parent);
    resize();
    return () => {
      obs.disconnect();
      game?.destroy(true);
    };
  }, [vessel]);
  return (
    <div
      role="img"
      aria-label="Live pixel-art side view of the launch vehicle"
      className="flight-scene"
      ref={host}
    />
  );
}
