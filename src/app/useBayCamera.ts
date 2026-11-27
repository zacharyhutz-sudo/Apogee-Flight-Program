import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

export interface PartBounds {
  uid: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

type View = { x: number; y: number; scale: number };

export function useBayCamera(
  svg: RefObject<SVGSVGElement | null>,
  parts: PartBounds[],
  blueprintId: string,
) {
  const [size, setSize] = useState({ w: 360, h: 480 });
  const [manual, setManual] = useState<View | null>(null);
  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    function measure() {
      const { width, height } = el!.getBoundingClientRect();
      if (width && height) setSize({ w: width, h: height });
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [svg]);
  useLayoutEffect(() => setManual(null), [blueprintId]);

  const left = parts.length ? Math.min(...parts.map((p) => p.x)) : 140;
  const right = parts.length ? Math.max(...parts.map((p) => p.x + p.w)) : 180;
  const top = parts.length ? Math.min(...parts.map((p) => p.y)) : 40;
  const bottom = parts.length ? Math.max(...parts.map((p) => p.y + p.h)) : 100;
  const fit = {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    scale: Math.min(
      (size.w * 0.76) / (right - left),
      (size.h * 0.76) / (bottom - top),
    ),
  };
  const view = manual ?? fit;
  const w = size.w / view.scale,
    h = size.h / view.scale;
  const bounds = { x: view.x - w / 2, y: view.y - h / 2, w, h };

  function transform(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    factor: number,
  ) {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2,
      cy = rect.top + rect.height / 2;
    setManual((previous) => {
      const v = previous ?? fit;
      const scale = Math.max(
        fit.scale * 0.35,
        Math.min(fit.scale * 6, v.scale * factor),
      );
      return {
        x: v.x + (fromX - cx) / v.scale - (toX - cx) / scale,
        y: v.y + (fromY - cy) / v.scale - (toY - cy) / scale,
        scale,
      };
    });
  }

  const wheelTransform = useRef(transform);
  wheelTransform.current = transform;
  useEffect(() => {
    const el = svg.current;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelTransform.current(
        e.clientX,
        e.clientY,
        e.clientX,
        e.clientY,
        Math.exp(-Math.sign(e.deltaY) * 0.15),
      );
    };
    el?.addEventListener("wheel", wheel, { passive: false });
    return () => el?.removeEventListener("wheel", wheel);
  }, [svg]);

  function focus(uid: string, atX?: number) {
    const matches = parts.filter((p) => p.uid === uid);
    const target =
      atX === undefined
        ? matches[0]
        : matches.sort(
            (a, b) =>
              Math.abs(a.x + a.w / 2 - atX) - Math.abs(b.x + b.w / 2 - atX),
          )[0];
    if (target)
      setManual({
        x: target.x + target.w / 2,
        y: target.y + target.h / 2,
        scale: view.scale,
      });
  }
  function zoom(factor: number) {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect) return;
    const x = rect.left + rect.width / 2,
      y = rect.top + rect.height / 2;
    transform(x, y, x, y, factor);
  }
  return {
    bounds,
    scale: view.scale,
    transform,
    zoom,
    focus,
    fit: () => setManual(null),
    hold: () => setManual((previous) => previous ?? view),
  };
}
