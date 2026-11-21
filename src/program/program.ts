import {
  AIR,
  initial,
  mass,
  stable,
  radius,
  clamp,
  type Flight,
} from "../sim/flight.ts";

export const FACILITIES = {
  command: { name: "Command Center", cost: 0, role: "Range operations" },
  pad: { name: "Launchpad", cost: 0, role: "Vehicle capacity" },
  fuel: { name: "Fuel Storage", cost: 55, role: "Launch preparation" },
  lab: { name: "Research Lab", cost: 65, role: "Mission research" },
} as const;
export type Kind = keyof typeof FACILITIES;
export const CONTRACTS = {
  hop: {
    name: "Suborbital hop",
    goal: "Cross 100 km altitude.",
    fee: 0,
    credits: 100,
    research: 4,
    cargo: 0,
    height: 43,
  },
  orbit: {
    name: "First orbit",
    goal: "Establish low Earth orbit.",
    fee: 45,
    credits: 180,
    research: 7,
    cargo: 0,
    height: 43,
  },
  polar: {
    name: "Polar orbit",
    goal: "Carry a 4 t survey satellite above 75° N in low polar orbit.",
    fee: 70,
    credits: 275,
    research: 12,
    cargo: 4000,
    height: 49,
  },
} as const;
export type Job = keyof typeof CONTRACTS;
export type Sortie = Job | "practice";
export interface Building {
  kind: Kind;
  x: number;
  y: number;
  level: number;
}
export interface Program {
  credits: number;
  research: number;
  elapsed: number;
  buildings: Building[];
  completed: Record<Job, number>;
  award: { credits: number; research: number } | null;
  sortie: Sortie;
  paid: boolean;
  rewarded: boolean;
  inclination: 0 | 90;
}
export const startProgram = (): Program => ({
  credits: 80,
  research: 0,
  elapsed: 0,
  buildings: [
    { kind: "command", x: 2, y: 3, level: 1 },
    { kind: "pad", x: 5, y: 3, level: 1 },
  ],
  completed: { hop: 0, orbit: 0, polar: 0 },
  award: null,
  sortie: "practice",
  paid: false,
  rewarded: false,
  inclination: 0,
});
export const SIZE = 8;
export function terrain(x: number, y: number) {
  if (
    x < 0 ||
    y < 0 ||
    x >= SIZE ||
    y >= SIZE ||
    x + y < 2 ||
    x + y > 12 ||
    x - y > 5
  )
    return "water";
  if (y === 4) return "road";
  if (
    (x === 0 && y === 3) ||
    (x === 3 && y === 0) ||
    (x === 1 && y === 5) ||
    (x === 3 && y === 7) ||
    (x === 6 && y === 5)
  )
    return "grove";
  if ((x === 1 && y === 2) || (x === 6 && y === 1) || (x === 2 && y === 6))
    return "rock";
  return "land";
}
export function placement(p: Program, kind: Kind, x: number, y: number) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || terrain(x, y) !== "land")
    return "Choose open ground.";
  for (const b of p.buildings) {
    if (b.kind === kind) continue;
    const d = Math.abs(b.x - x) + Math.abs(b.y - y);
    if (!d) return "Tile occupied.";
    if (d === 1 && (kind === "pad" || b.kind === "pad"))
      return "Keep one tile clear around the pad.";
  }
  return "";
}
export const level = (p: Program, k: Kind) =>
  p.buildings.find((b) => b.kind === k)?.level ?? 0;
export const padCaps = (n: number) => ({
  tonnes: 312 + (n - 1) * 35,
  height: 45 + (n - 1) * 10,
});
export const upgradeCost = (k: Kind, n: number) => ({
  credits: (k === "pad" ? 105 : k === "command" ? 85 : 60) * n,
  research: (k === "pad" ? 3 : 2) * n,
});
export function place(p: Program, k: Kind, x: number, y: number) {
  const problem = placement(p, k, x, y);
  if (problem) return problem;
  const b = p.buildings.find((b) => b.kind === k);
  if (b) {
    b.x = x;
    b.y = y;
    return "";
  }
  const fee = FACILITIES[k].cost;
  if (p.credits < fee) return "Insufficient credits.";
  p.credits -= fee;
  p.buildings.push({ kind: k, x, y, level: 1 });
  return "";
}
export function upgrade(p: Program, k: Kind) {
  const b = p.buildings.find((b) => b.kind === k);
  if (!b || b.level >= 3) return "Maximum level reached.";
  const cost = upgradeCost(k, b.level);
  if (p.credits < cost.credits || p.research < cost.research)
    return "More credits or research required.";
  p.credits -= cost.credits;
  p.research -= cost.research;
  b.level++;
  return "";
}
export function quote(p: Program, job: Job) {
  const c = CONTRACTS[job];
  return {
    fee: Math.max(0, c.fee - 10 * level(p, "fuel")),
    credits: c.credits + 15 * (level(p, "command") - 1),
    research: c.research + level(p, "lab"),
  };
}
export const launchMass = (job: Sortie) =>
  (mass(initial()) + (job === "practice" ? 0 : CONTRACTS[job].cargo)) / 1000;
export function launchIssue(p: Program, job: Sortie) {
  if (job === "practice") return "";
  const cap = padCaps(level(p, "pad"));
  if (launchMass(job) > cap.tonnes || CONTRACTS[job].height > cap.height)
    return "Upgrade the launchpad to level 2.";
  return p.credits < quote(p, job).fee
    ? "Insufficient credits. The suborbital hop is sponsored."
    : "";
}
export function prepare(p: Program, job: Sortie) {
  p.sortie = job;
  p.award = null;
  p.paid = false;
  p.rewarded = false;
  p.inclination = job === "polar" ? 90 : 0;
  const flight = initial();
  flight.cargo = job === "practice" ? 0 : CONTRACTS[job].cargo;
  return flight;
}
export function payLaunch(p: Program) {
  if (p.sortie === "practice") return "";
  if (p.paid) return "Flight already dispatched.";
  const issue = launchIssue(p, p.sortie);
  if (issue) return issue;
  const q = quote(p, p.sortie);
  p.credits -= q.fee;
  p.award = { credits: q.credits, research: q.research };
  p.paid = true;
  return "";
}
// At equatorial lift-off the local northbound plane intersects the equator at +x.
export function latitude(p: Program, f: Flight) {
  return p.inclination === 90
    ? (Math.asin(clamp(f.y / radius(f), -1, 1)) * 180) / Math.PI
    : 0;
}
export function settle(p: Program, f: Flight) {
  const job = p.sortie;
  if (job === "practice" || !p.paid || p.rewarded) return "";
  if (job === "hop" ? f.maxAlt < AIR : !f.orbitEarned) return "";
  if (
    job === "polar" &&
    (p.inclination !== 90 ||
      f.cargo !== CONTRACTS.polar.cargo ||
      !stable(f) ||
      latitude(p, f) < 75)
  )
    return "";
  const q = p.award;
  if (!q) return "";
  p.rewarded = true;
  p.credits += q.credits;
  p.research += q.research;
  p.completed[job]++;
  return (
    CONTRACTS[job].name +
    " complete · +" +
    q.credits +
    " credits · +" +
    q.research +
    " research"
  );
}
export function validProgram(value: unknown, f: Flight): value is Program {
  if (!value || typeof value !== "object") return false;
  const p = value as Program;
  const natural = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
  if (
    !natural(p.credits) ||
    !natural(p.research) ||
    !Number.isFinite(p.elapsed) ||
    p.elapsed < 0 ||
    !Array.isArray(p.buildings) ||
    p.buildings.length < 2 ||
    p.buildings.length > 4 ||
    !p.completed ||
    !Object.keys(CONTRACTS).every((k) => natural(p.completed[k as Job])) ||
    !(p.sortie === "practice" || Object.hasOwn(CONTRACTS, p.sortie)) ||
    typeof p.paid !== "boolean" ||
    typeof p.rewarded !== "boolean"
  )
    return false;
  if (
    !p.buildings.every(
      (b) =>
        b &&
        Object.hasOwn(FACILITIES, b.kind) &&
        natural(b.level) &&
        b.level >= 1 &&
        b.level <= 3,
    ) ||
    new Set(p.buildings.map((b) => b.kind)).size !== p.buildings.length ||
    !level(p, "pad") ||
    !level(p, "command") ||
    p.buildings.some((b) => placement(p, b.kind, b.x, b.y))
  )
    return false;
  if (
    f.cargo !== (p.sortie === "polar" ? CONTRACTS.polar.cargo : 0) ||
    p.inclination !== (p.sortie === "polar" ? 90 : 0)
  )
    return false;
  if (p.paid) {
    if (
      p.sortie === "practice" ||
      !p.award ||
      !natural(p.award.credits) ||
      !natural(p.award.research)
    )
      return false;
    const c = CONTRACTS[p.sortie];
    if (
      p.award.credits < c.credits ||
      p.award.credits > c.credits + 30 ||
      p.award.research < c.research ||
      p.award.research > c.research + 3
    )
      return false;
  } else if (p.award !== null) return false;
  if (p.sortie === "practice") return !p.paid && !p.rewarded;
  if (p.paid !== (f.status !== "pad")) return false;
  return (
    !p.rewarded ||
    (p.paid &&
      p.completed[p.sortie] > 0 &&
      (p.sortie === "hop" ? f.maxAlt >= AIR : f.orbitEarned))
  );
}
