import { useEffect, useRef, type RefObject } from "react";

export type Camera = { zoom(factor: number, x?: number, y?: number): void; step?(dir: -1 | 1): void; setZoom?(value: number): void; reset(): void };
export const boundary = 0.24;
export function mapScale(w: number, h: number, radius: number, rocketZoom: number) {
  return Math.min(w,h) / 215 * rocketZoom * radius / Math.min(w * 0.32,h * 0.29);
}

// Track touches on the persistent viewport so a pinch survives a renderer change.
export function useZoomInput(host: RefObject<HTMLElement | null>, enabled: boolean,
  zoom: Camera["zoom"], stopSteer: () => void) {
  const callbacks = useRef({zoom, stopSteer});
  callbacks.current = {zoom, stopSteer};
  useEffect(() => {
    const el = host.current;
    if (!enabled || !el) return;
    const excluded = (target: EventTarget | null) => target instanceof Element &&
      Boolean(target.closest("button:not(.steer-zone),input,select,label,dialog"));
    type Point = [number, number];
    const points = new Map<number,Point>();
    let span = 0;
    let pinching = false;
    function distance() {
      const [a,b] = [...points.values()];
      return Math.hypot(a[0]-b[0],a[1]-b[1]);
    }
    function down(e: PointerEvent) {
      if (e.pointerType !== "touch" || excluded(e.target)) return;
      points.set(e.pointerId,[e.clientX,e.clientY]);
      if (points.size < 2) return;
      callbacks.current.stopSteer();
      pinching = true;
      span = distance();
      for (const id of points.keys()) el!.setPointerCapture(id);
      e.stopPropagation();
      e.preventDefault();
    }
    function move(e: PointerEvent) {
      if (!points.has(e.pointerId)) return;
      points.set(e.pointerId,[e.clientX,e.clientY]);
      if (!pinching) return;
      e.stopPropagation();
      if (points.size !== 2) return;
      const length = distance();
      const [a,b] = [...points.values()];
      const rect = el!.getBoundingClientRect();
      if (span && length) callbacks.current.zoom(length/span,(a[0]+b[0])/2-rect.left,(a[1]+b[1])/2-rect.top);
      span = length;
    }
    function up(e: PointerEvent) {
      if (!points.delete(e.pointerId) || !pinching) return;
      e.stopPropagation();
      span = points.size === 2 ? distance() : 0;
      if (!points.size) pinching = false;
    }
    function wheel(e: WheelEvent) {
      if (excluded(e.target)) return;
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1;
      callbacks.current.zoom(Math.exp(-Math.max(-320,Math.min(320,e.deltaY*unit))*0.0025),
        e.clientX-rect.left,e.clientY-rect.top);
    }
    el.addEventListener("pointerdown",down,true);
    window.addEventListener("pointermove",move,true);
    window.addEventListener("pointerup",up,true);
    window.addEventListener("pointercancel",up,true);
    el.addEventListener("wheel",wheel,{capture:true,passive:false});
    return () => {
      el.removeEventListener("pointerdown",down,true);
      window.removeEventListener("pointermove",move,true);
      window.removeEventListener("pointerup",up,true);
      window.removeEventListener("pointercancel",up,true);
      el.removeEventListener("wheel",wheel,true);
    };
  },[host,enabled]);
}
