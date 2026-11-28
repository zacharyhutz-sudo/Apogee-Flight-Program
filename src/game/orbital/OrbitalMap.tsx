import { boundary, mapScale, type Camera } from "../flightCamera";
import { useLayoutEffect, useRef, type RefObject, useState, type PointerEvent } from "react";
import {
  R, MOON_ORBIT_R,
  MOON_R,
  MOON_SOI,
  bodyParams,
  clamp,
  headingVector,
  moonPosition,
  orbit,
  radius,
  type Flight,
} from "../../sim/flight";
import { Plus, Minus, LocateFixed, Globe, Lock, Radar, Moon } from "lucide-react";

type MapFocus = "body" | "ship" | "moon";

export function OrbitalMap({
  s,
  trackingLevel = 1,
  onOpenFlight, entry, camera,
}: {
  s: Flight;
  trackingLevel?: number;
  onOpenFlight: () => void;
  entry: number | null;
  camera: RefObject<Camera | null>;
}) {
  const [zoom, Z] = useState(() => entry ? mapScale(window.innerWidth,window.innerHeight,bodyParams(s.body).R,entry) : 1);
  const [pan, P] = useState<[number, number]>([0, 0]);
  const [focus, setFocus] = useState<MapFocus>(entry ? "ship" : "body");
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  const D = Math.min(size.w * 0.32, size.h * 0.29);
  const svg = useRef<SVGSVGElement>(null);
  const fingers = useRef(new Map<number, [number, number]>());
  const moved = useRef(false);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const focusRef = useRef(focus);
  const openFlightRef = useRef(onOpenFlight);
  zoomRef.current = zoom;
  panRef.current = pan;
  focusRef.current = focus;
  openFlightRef.current = onOpenFlight;

  const bp = bodyParams(s.body);
  const isMoon = s.body === "moon";
  const moonPos = moonPosition(s.t);

  // Auto-frame cleanly whenever SOI changes between Earth and Moon
  const lastBody = useRef(isMoon);
  useLayoutEffect(() => {
    if (lastBody.current === isMoon) return;
    lastBody.current = isMoon;
    setFocus("body");
    P([0, 0]);
    Z(isMoon ? 0.85 : 1);
  }, [isMoon]);

  function zoomAround(factor: number, anchorX: number, anchorY: number) {
    const curZ = zoomRef.current;
    const rawNext = curZ * factor;
    const limit = mapScale(size.w,size.h,bp.R,boundary * 1.3);
    const following = focusRef.current === "ship" && Math.hypot(...panRef.current) < 24;
    if (rawNext >= limit && factor > 1 && following) {
      openFlightRef.current();
      return;
    }
    const nextZ = clamp(rawNext, 0.015, limit * 1.25);
    const ratio = nextZ / curZ;
    if (ratio === 1) return;
    const [px, py] = panRef.current;
    const cx0 = size.w / 2;
    const cy0 = size.h * 0.49;
    // Keep the point under (anchorX, anchorY) stationary during zoom
    const nextPx = anchorX - cx0 - (anchorX - cx0 - px) * ratio;
    const nextPy = anchorY - cy0 - (anchorY - cy0 - py) * ratio;
    zoomRef.current = nextZ;
    Z(nextZ);
    if (!following) { panRef.current = [nextPx,nextPy]; P(panRef.current); }
  }

  useLayoutEffect(() => {
    camera.current = { zoom: (factor,x = size.w/2,y = size.h*0.49) => zoomAround(factor,x,y),
      reset() { setFocus("body"); P([0,0]); Z(1); } };
    return () => { camera.current = null; };
  });
  useLayoutEffect(() => {
    const el = svg.current!;
    const measure = () => {
      if (el.clientWidth && el.clientHeight) setSize({ w:el.clientWidth, h:el.clientHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const o = orbit(s);
  const scale = (D * zoom) / bp.R;

  const focusX =
    focus === "ship" ? s.y : focus === "moon" && !isMoon ? moonPos.y : 0;
  const focusY =
    focus === "ship" ? s.x : focus === "moon" && !isMoon ? moonPos.x : 0;

  const ox = size.w / 2 + pan[0] - focusX * scale;
  const blend = focus === "ship" ? clamp(Math.log(zoom / mapScale(size.w,size.h,bp.R,boundary/12)) / Math.log(12),0,1) : 0;
  const angle = -Math.atan2(s.y,s.x) * blend * 180 / Math.PI;
  const anchorY = size.h * (0.49 + (s.status === "pad" ? 0.13 : 0.05)*blend);
  const oy = anchorY + pan[1] + focusY * scale;
  const point = (x: number, y: number) => [ox + y * scale, oy - x * scale];
  const pts: string[] = [];
  let previousVisible = false;

  if (Math.abs(o.h) > 1 && o.p > 0) {
    const cut = o.e > 1e-12 ? (o.p / bp.R - 1) / o.e : 2;
    const start = cut >= 1 ? 0 : Math.acos(clamp(cut, -1, 1));
    const end = 2 * Math.PI - start;
    for (let i = 0; i <= 480; i++) {
      const f = start + ((end - start) * i) / 480;
      const den = 1 + o.e * Math.cos(f);
      const r = o.p / den;
      if (den <= 0 || r > 250 * bp.R) {
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
    const k = (bp.R + o.ap) / radius(s);
    pts.push(
      "M" + point(s.x, s.y).join(" ") + "L" + point(s.x * k, s.y * k).join(" "),
    );
  }

  const [cx, cy] = point(s.x, s.y);
  const handle = (e: PointerEvent<SVGSVGElement>) => {
    if (!fingers.current.has(e.pointerId)) return;
    const old = fingers.current.get(e.pointerId)!;
    const units = 1 / (svg.current?.getScreenCTM()?.a || 1);
    const dx = (e.clientX - old[0]) * units;
    const dy = (e.clientY - old[1]) * units;
    if (Math.abs(dx) + Math.abs(dy) > 1) moved.current = true;
    fingers.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (fingers.current.size === 1) P(cur => [cur[0]+dx,cur[1]+dy]);
  };

  function release(e: PointerEvent<SVGSVGElement>) {
    fingers.current.delete(e.pointerId);
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

  const hasManeuverSlot = trackingLevel >= 2;
  const focusLabel =
    focus === "ship"
      ? s.vehicleName || "Craft"
      : focus === "moon" || isMoon
        ? "Moon"
        : "Earth";

  return (
    <div className="orbital">
      <svg
        ref={svg}
        viewBox={`0 0 ${size.w} ${size.h}`}
        aria-label="Live orbital map"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moved.current = false;
          fingers.current.set(e.pointerId, [e.clientX, e.clientY]);
        }}
        onPointerMove={handle}
        onPointerUp={(e) => {
          if (!moved.current) {
            const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(
              svg.current!.getScreenCTM()!.inverse(),
            );
            if (Math.hypot(pt.x - cx, pt.y - cy) < 22) {
              setFocus("ship");
              P([0, 0]);
            }
          }
          release(e);
        }}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <defs>
          <radialGradient id="world" cx=".35" cy=".25" r=".9">
            <stop stopColor={isMoon ? "#8d96a0" : "#335e6a"} />
            <stop offset=".6" stopColor={isMoon ? "#646d77" : "#203e50"} />
            <stop offset="1" stopColor={isMoon ? "#3b424a" : "#102133"} />
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
        <g transform={`rotate(${angle} ${size.w/2+pan[0]} ${anchorY+pan[1]})`}>
        {!isMoon && (
          <circle
            cx={ox}
            cy={oy}
            r={(bp.R + bp.AIR) * scale}
            fill="#406777"
            stroke="#486877"
            strokeWidth=".6"
          />
        )}
        <circle
          cx={ox}
          cy={oy}
          r={D * zoom}
          fill="url(#world)"
          stroke={isMoon ? "#c5ccd4" : "#6a9499"}
          strokeWidth=".8"
        />
        <g
          clipPath="url(#earth)"
          opacity=".28"
          fill="none"
          stroke={isMoon ? "#d7dee6" : "#77a9ae"}
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
        {zoom < 3 && focus === "body" && (
          <text x={ox} y={oy + 4} textAnchor="middle" className="earth-label">
            {isMoon ? "MOON" : "EARTH"}
          </text>
        )}
        {isMoon && (() => {
          const [ex,ey] = point(-moonPos.x,-moonPos.y);
          return <g><circle cx={ex} cy={ey} r={Math.max(4,R*scale)} fill="#335e6a" />
            <text x={ex+R*scale+5} y={ey}>EARTH</text></g>;
        })()}
        {!isMoon && (() => {
          const [mx, my] = point(moonPos.x, moonPos.y);
          return (
            <g>
              <circle
                cx={ox}
                cy={oy}
                r={MOON_ORBIT_R * scale}
                fill="none"
                stroke="#8ea3b044"
                strokeDasharray="4 4"
              />
              <circle
                cx={mx}
                cy={my}
                r={MOON_SOI * scale}
                fill="#a79cf514"
                stroke="#a79cf588"
                strokeDasharray="3 3"
              />
              <circle
                cx={mx}
                cy={my}
                r={Math.max(3.5, MOON_R * scale)}
                fill="#bfc6ce"
                stroke="#f6f1e3"
                strokeWidth="0.9"
              />
              <text x={mx + Math.max(6, MOON_R * scale + 4)} y={my + 3}>
                MOON
              </text>
            </g>
          );
        })()}
        <path
          opacity={1 - blend * 0.8}
          d={pts.join(" ")}
          fill="none"
          stroke="#8fdacf"
          strokeWidth="1.6"
        />
        {s.status === "flying" &&
          Number.isFinite(o.ap) &&
          marker(
            "Ap",
            -(bp.R + o.ap) * Math.cos(o.arg),
            -(bp.R + o.ap) * Math.sin(o.arg),
          )}
        {o.pe >= 0 &&
          marker(
            "Pe",
            (bp.R + o.pe) * Math.cos(o.arg),
            (bp.R + o.pe) * Math.sin(o.arg),
          )}
        {(s.debris ?? []).map((d, idx) => {
          const [dx, dy] = point(d.x, d.y);
          return (
            <circle
              key={idx}
              cx={dx}
              cy={dy}
              r="2.4"
              fill="#9eb9c2"
              opacity="0.75"
            />
          );
        })}
        <g transform={`translate(${cx} ${cy})`}>
          <circle r="7" fill="#1e2732" stroke="#f3b67f" />
          <path
            d="M0 -5 L3.4 3 L0 2 L-3.4 3Z"
            fill="#ffc287"
            transform={`rotate(${((headingVector(s).angle * 180) / Math.PI).toFixed(2)})`}
          />
        </g>
        </g>
      </svg>

      <div
        className={"tracking-slot" + (hasManeuverSlot ? " unlocked" : "")}
        aria-label="Tracking Station status"
      >
        {hasManeuverSlot ? <Radar size={12} /> : <Lock size={12} />}
        <span>
          {hasManeuverSlot ? "SOI Tracking Active" : "Tracking Lv 2"}
        </span>
      </div>

      <div className="map-tools">
        <button
          className="map-zoom-btn"
          aria-label="Zoom in"
          onClick={() => zoomAround(1.6, size.w / 2, size.h * 0.49)}
        >
          <Plus />
        </button>
        <button
          className="map-zoom-btn"
          aria-label="Zoom out"
          onClick={() => zoomAround(1 / 1.6, size.w / 2, size.h * 0.49)}
        >
          <Minus />
        </button>
        <button
          className={focus === "ship" ? "selected" : ""}
          title="Focus craft"
          aria-label="Focus craft"
          onClick={() => {
            setFocus("ship");
            P([0, 0]);
            Z(isMoon ? 4 : 8);
          }}
        >
          <LocateFixed />
        </button>
        <button
          className={focus === "body" ? "selected" : ""}
          title={isMoon ? "Fit Moon" : "Fit Earth"}
          aria-label={isMoon ? "Fit Moon" : "Fit Earth"}
          onClick={() => {
            setFocus("body");
            P([0, 0]);
            Z(isMoon ? 0.85 : 1);
          }}
        >
          <Globe />
        </button>
        {!isMoon && (
          <button
            className={focus === "moon" ? "selected" : ""}
            title="Focus Moon"
            aria-label="Focus Moon"
            onClick={() => {
              setFocus("moon");
              P([0, 0]);
              Z(0.42);
            }}
          >
            <Moon />
          </button>
        )}
      </div>
      <span className="map-selection">
        {focusLabel} · {zoom.toFixed(1)}×
      </span>
    </div>
  );
}
