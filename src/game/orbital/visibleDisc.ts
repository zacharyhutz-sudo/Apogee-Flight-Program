// Trace the part of a large disc inside the screen. Sampling vertical chords
// keeps both the number of vertices and their bounds independent of zoom.
export function visibleDisc(cx: number, cy: number, r: number, width: number, height: number) {
  const left = Math.max(-2, cx-r);
  const right = Math.min(width+2, cx+r);
  if (right <= left || cy+r < -2 || cy-r > height+2) return "";
  const top: string[] = [], bottom: string[] = [];
  const steps = Math.max(1, Math.ceil((right-left)/5));
  for (let i=0; i<=steps; i++) {
    const x = left+(right-left)*i/steps;
    const half = Math.sqrt(Math.max(0,r*r-(x-cx)**2));
    const upper = Math.max(-2,Math.min(height+2,cy-half));
    const lower = Math.max(-2,Math.min(height+2,cy+half));
    top.push(x.toFixed(2)+" "+upper.toFixed(2));
    bottom.push(x.toFixed(2)+" "+lower.toFixed(2));
  }
  return "M"+top.join("L")+"L"+bottom.reverse().join("L")+"Z";
}
