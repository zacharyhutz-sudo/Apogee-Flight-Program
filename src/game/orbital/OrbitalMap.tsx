import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  AIR,
  R,
  clamp,
  orbit,
  radius,
  speed,
  type Flight,
} from "../../sim/flight";
const D = 110;
export function OrbitalMap({ s }: { s: Flight }) {
  const [zoom, Z] = useState(1),
    [pan, P] = useState([0, 0]),
    [track, T] = useState(false),
    [selected, select] = useState("Earth");
  const svg = useRef<SVGSVGElement>(null),
    fingers = useRef(new Map<number, number[]>());
  const lastSpan = useRef(0),
    moved = useRef(false);
  useEffect(() => {
    const el = svg.current!;
    function wheel(e: WheelEvent) {
      e.preventDefault();
      Z((z) => clamp(z * Math.exp(-e.deltaY * 0.002), 0.25, 64));
    }
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const o = orbit(s),
    scale = (D * zoom) / R;
  const ox = 260 + pan[0] - (track ? s.y * scale : 0),
    oy = 149 + pan[1] + (track ? s.x * scale : 0);
  const point = (x: number, y: number) => [ox + y * scale, oy - x * scale];
  const pts: string[] = [];
  let previousVisible = false;
  if (Math.abs(o.h) > 1 && o.p > 0) {
    // Parameterize only the portion above the surface. Uniform full-orbit sampling
    // misses almost-radial suborbital arcs shortly after liftoff.
    const cut = o.e > 1e-12 ? (o.p / R - 1) / o.e : 2;
    const start = cut >= 1 ? 0 : Math.acos(clamp(cut, -1, 1));
    const end = 2 * Math.PI - start;
    for (let i = 0; i <= 480; i++) {
      const f = start + ((end - start) * i) / 480,
        den = 1 + o.e * Math.cos(f),
        r = o.p / den;
      if (den <= 0 || r > 250 * R) {
        previousVisible = false;
        continue;
      }
      const [x, y] = point(r * Math.cos(f + o.arg), r * Math.sin(f + o.arg));
      pts.push(
        (previousVisible ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2),
      );
      previousVisible = true;
    }
  } else if (s.status === "flying" && Number.isFinite(o.ap)) {
    const k = (R + o.ap) / radius(s);
    pts.push(
      "M" + point(s.x, s.y).join(" ") + "L" + point(s.x * k, s.y * k).join(" "),
    );
  }
  const [cx, cy] = point(s.x, s.y);
  const handle = (e: PointerEvent<SVGSVGElement>) => {
    if (!fingers.current.has(e.pointerId)) return;
    const old = fingers.current.get(e.pointerId)!;
    const units = 1 / (svg.current?.getScreenCTM()?.a || 1);
    const dx = (e.clientX - old[0]) * units,
      dy = (e.clientY - old[1]) * units;
    if (Math.abs(dx) + Math.abs(dy) > 1) moved.current = true;
    fingers.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (fingers.current.size === 2) {
      const [a, b] = [...fingers.current.values()],
        span = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const previous = lastSpan.current;
      if (previous > 0) Z((z) => clamp((z * span) / previous, 0.25, 64));
      lastSpan.current = span;
    } else P((p) => [p[0] + dx, p[1] + dy]);
  };
  function release(e: PointerEvent<SVGSVGElement>) {
    fingers.current.delete(e.pointerId);
    lastSpan.current = 0;
  }
  const marker = (name: string, x: number, y: number) => {
    const [px, py] = point(x, y);
    if (!Number.isFinite(px + py)) return null;
    return (
      <g transform={`translate(${px} ${py})`}>
        <circle r="2.6" fill="#93d9cd" />
        <text
          x={name === "Ap" ? 8 : -8}
          y={name === "Ap" ? -7 : 13}
          textAnchor={name === "Ap" ? "start" : "end"}
        >
          {name}
        </text>
      </g>
    );
  };
  return (
    <div className="orbital">
      <svg
        ref={svg}
        viewBox="0 0 520 286"
        aria-label="Live Earth orbital map"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moved.current = false;
          fingers.current.set(e.pointerId, [e.clientX, e.clientY]);
        }}
        onPointerMove={handle}
        onPointerUp={(e) => {
          if (!moved.current) {
            const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
              svg.current!.getScreenCTM()!.inverse(),
            );
            select(
              Math.hypot(p.x - cx, p.y - cy) < 20 ? "Pioneer 01" : "Earth",
            );
          }
          release(e);
        }}
        onPointerCancel={release}
      >
        <defs>
          <radialGradient id="world" cx=".35" cy=".25" r=".9">
            <stop stopColor="#335e6a" />
            <stop offset=".6" stopColor="#203e50" />
            <stop offset="1" stopColor="#102133" />
          </radialGradient>
          <pattern
            id="grid"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M22 0H0V22"
              fill="none"
              stroke="#293a47"
              strokeWidth=".45"
            />
          </pattern>
          <clipPath id="earth">
            <circle cx={ox} cy={oy} r={D * zoom} />
          </clipPath>
        </defs>
        <rect
          x="-3000"
          y="-2000"
          width="6000"
          height="4000"
          fill="url(#grid)"
        />
        <circle
          cx={ox}
          cy={oy}
          r={(R + AIR) * scale}
          fill="#406777"
          stroke="#486877"
          strokeWidth=".6"
        />
        <circle
          cx={ox}
          cy={oy}
          r={D * zoom}
          fill="url(#world)"
          stroke="#6a9499"
          strokeWidth=".8"
        />
        <g
          clipPath="url(#earth)"
          opacity=".28"
          fill="none"
          stroke="#77a9ae"
          strokeWidth=".6"
        >
          {[0.35, 0.68].map((k) => (
            <ellipse key={k} cx={ox} cy={oy} rx={D * zoom * k} ry={D * zoom} />
          ))}
          {[-0.72, -0.38, 0, 0.38, 0.72].map((k) => (
            <path
              key={k}
              d={`M${ox - D * zoom} ${oy + k * D * zoom}q${D * zoom} ${20 * zoom} ${2 * D * zoom} 0`}
            />
          ))}
        </g>
        {zoom < 3 && !track && (
          <text x={ox} y={oy + 4} textAnchor="middle" className="earth-label">
            EARTH
          </text>
        )}
        <path
          d={pts.join(" ")}
          fill="none"
          stroke="#8fdacf"
          strokeWidth="1.6"
        />
        {s.status === "flying" &&
          Number.isFinite(o.ap) &&
          marker(
            "Ap",
            -(R + o.ap) * Math.cos(o.arg),
            -(R + o.ap) * Math.sin(o.arg),
          )}
        {o.pe >= 0 &&
          marker(
            "Pe",
            (R + o.pe) * Math.cos(o.arg),
            (R + o.pe) * Math.sin(o.arg),
          )}
        <g transform={`translate(${cx} ${cy})`}>
          <circle r="7" fill="#1e2732" stroke="#f3b67f" />
          <path
            d="M0 -5 L3.4 3 L0 2 L-3.4 3Z"
            fill="#ffc287"
            transform={`rotate(${speed(s) > 0.5 ? (Math.atan2(s.vy, s.vx) * 180) / Math.PI : 0})`}
          />
        </g>
      </svg>
      <div className="map-legend">
        <i /> Ballistic path <b>◆</b> Pioneer 01
      </div>
      <div className="map-tools">
        <button
          aria-label="Zoom in"
          onClick={() => Z((z) => clamp(z * 1.6, 0.25, 64))}
        >
          +
        </button>
        <button
          aria-label="Zoom out"
          onClick={() => Z((z) => clamp(z / 1.6, 0.25, 64))}
        >
          −
        </button>
        <button
          onClick={() => {
            T(!track);
            P([0, 0]);
            Z(track ? 1 : 12);
            select(track ? "Earth" : "Pioneer 01");
          }}
        >
          {track ? "Fit Earth" : "Track craft"}
        </button>
      </div>
      <span className="map-selection">
        {selected} · {zoom.toFixed(1)}×
      </span>
    </div>
  );
}
