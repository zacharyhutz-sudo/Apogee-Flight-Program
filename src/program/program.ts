import {
  AIR,
  initial,
  orbit,
  stable,
  radius,
  clamp,
  type Flight,
} from "../sim/flight.ts";
import {
  initialLunarColony,
  tickLunarColony,
  unlockLunarColony,
  type LunarColony,
} from "./lunar.ts";
import {
  PARTS,
  analyzeBlueprint,
  buildVehicleInstance,
  starterBlueprints,
  type FacilityLimits,
  type RocketBlueprint,
} from "./workshop.ts";

export const MAX_LEVEL = 4;

export interface Cost {
  propellant?: number;
  credits: number;
  research: number;
}

export interface FacilityDef {
  name: string;
  shortName: string;
  tier: 1 | 2;
  role: string;
  defaultPos: { x: number; y: number };
  costs: readonly [Cost, Cost, Cost, Cost];
}

export const FACILITIES = {
  command: {
    name: "Mission Control",
    shortName: "Control",
    tier: 1,
    role: "Program tier, crews & facility cap",
    defaultPos: { x: 2, y: 3 },
    costs: [
      { credits: 0, research: 0 },
      { credits: 4500, research: 60 },
      { credits: 18000, research: 260 },
      { credits: 60000, research: 850 },
    ],
  },
  pad: {
    name: "Launchpad",
    shortName: "Pad",
    tier: 1,
    role: "Max rocket wet mass",
    defaultPos: { x: 5, y: 3 },
    costs: [
      { credits: 0, research: 0 },
      { credits: 3200, research: 0 },
      { credits: 14000, research: 0 },
      { credits: 48000, research: 0 },
    ],
  },
  foundry: {
    name: "Solar Foundry",
    shortName: "Foundry",
    tier: 1,
    role: "Tap-to-collect Credits generator",
    defaultPos: { x: 1, y: 3 },
    costs: [
      { credits: 0, research: 0 },
      { credits: 1400, propellant: 150, research: 0 },
      { credits: 6000, propellant: 450, research: 0 },
      { credits: 22000, propellant: 1200, research: 0 },
    ],
  },
  refinery: {
    name: "Propellant Refinery",
    shortName: "Refinery",
    tier: 1,
    role: "Tap-to-collect Propellant generator",
    defaultPos: { x: 3, y: 2 },
    costs: [
      { credits: 0, research: 0 },
      { credits: 1600, research: 0 },
      { credits: 6800, research: 0 },
      { credits: 24000, research: 0 },
    ],
  },
  tanks: {
    name: "Cryo Tank Farm",
    shortName: "Cryo Tanks",
    tier: 1,
    role: "Max propellant storage",
    defaultPos: { x: 4, y: 1 },
    costs: [
      { credits: 0, research: 0 },
      { credits: 1500, research: 0 },
      { credits: 6500, research: 0 },
      { credits: 24000, research: 0 },
    ],
  },
  bank: {
    name: "Credit Bank",
    shortName: "Bank",
    tier: 1,
    role: "Max Credit storage",
    defaultPos: { x: 3, y: 3 },
    costs: [
      { credits: 0, research: 0 },
      { credits: 1400, research: 0 },
      { credits: 6000, research: 0 },
      { credits: 22000, research: 0 },
    ],
  },
  office: {
    name: "Contract Office",
    shortName: "Contracts",
    tier: 1,
    role: "Active slots & contract refresh",
    defaultPos: { x: 2, y: 5 },
    costs: [
      { credits: 0, research: 0 },
      { credits: 2200, research: 0 },
      { credits: 9000, research: 0 },
      { credits: 30000, research: 0 },
    ],
  },
  vab: {
    name: "Vehicle Assembly Building",
    shortName: "VAB",
    tier: 2,
    role: "Parts, stages & hardware discount",
    defaultPos: { x: 3, y: 5 },
    costs: [
      { credits: 2400, research: 0 },
      { credits: 6000, research: 0 },
      { credits: 18000, research: 0 },
      { credits: 52000, research: 0 },
    ],
  },
  tracking: {
    name: "Tracking Station",
    shortName: "Tracking",
    tier: 2,
    role: "Orbital map navigation tools",
    defaultPos: { x: 5, y: 5 },
    costs: [
      { credits: 2800, research: 0 },
      { credits: 8000, research: 100 },
      { credits: 26000, research: 360 },
      { credits: 75000, research: 1100 },
    ],
  },
  lab: {
    name: "Research Lab",
    shortName: "Lab",
    tier: 2,
    role: "Telemetry bonus & tech unlocks",
    defaultPos: { x: 2, y: 1 },
    costs: [
      { credits: 2600, research: 0 },
      { credits: 7200, research: 80 },
      { credits: 24000, research: 300 },
      { credits: 68000, research: 900 },
    ],
  },
} as const satisfies Record<string, FacilityDef>;

export type Kind = keyof typeof FACILITIES;
export const FACILITY_KINDS = Object.keys(FACILITIES) as Kind[];
export const STARTER_KINDS: Kind[] = [
  "command",
  "pad",
  "foundry",
  "refinery",
  "tanks",
  "bank",
  "office",
];
export const TIER2_KINDS: Kind[] = ["vab", "tracking", "lab"];

export interface VehicleSpec {
  name: string;
  wetMassTonnes: number;
  heightMeters: number;
  hardwareCost: number;
  propellantCost: number;
  cargo: number;
  sponsored?: boolean;
}

export interface ContractDef {
  name: string;
  tier: 0 | 1 | 2;
  tierLabel: "Recovery" | "Tier 1" | "Tier 2";
  goal: string;
  hardwareCost: number;
  propellantCost: number;
  credits: number;
  research: number;
  firstTimeCredits: number;
  wetMassTonnes: number;
  heightMeters: number;
  cargo: number;
  sponsored?: boolean;
}

export const SOUNDING_TARGET = 15_000;

export const CONTRACTS = {
  sounding: {
    name: "Atmospheric Sounding",
    tier: 0,
    tierLabel: "Recovery",
    goal: "Reach 15 km altitude.",
    hardwareCost: 0,
    propellantCost: 150,
    credits: 450,
    research: 5,
    firstTimeCredits: 0,
    wetMassTonnes: 18,
    heightMeters: 22,
    cargo: 0,
    sponsored: true,
  },
  hop: {
    name: "Kármán Line Hop",
    tier: 1,
    tierLabel: "Tier 1",
    goal: "Reach Ap ≥ 30 km and stage cleanly.",
    hardwareCost: 300,
    propellantCost: 400,
    credits: 950,
    research: 15,
    firstTimeCredits: 0,
    wetMassTonnes: 26,
    heightMeters: 30,
    cargo: 0,
  },
  orbit: {
    name: "First Stable Orbit",
    tier: 1,
    tierLabel: "Tier 1",
    goal: "Achieve Pe ≥ 30 km and Ap ≥ 38 km.",
    hardwareCost: 500,
    propellantCost: 750,
    credits: 1800,
    research: 35,
    firstTimeCredits: 1000,
    wetMassTonnes: 34,
    heightMeters: 38,
    cargo: 0,
  },
  relay: {
    name: "High Elliptical Relay",
    tier: 2,
    tierLabel: "Tier 2",
    goal: "Reach Ap ≥ 250 km with Pe ≥ 35 km.",
    hardwareCost: 900,
    propellantCost: 1400,
    credits: 3200,
    research: 65,
    firstTimeCredits: 0,
    wetMassTonnes: 68,
    heightMeters: 48,
    cargo: 2000,
  },
  recovery: {
    name: "Suborbital Recovery",
    tier: 1,
    tierLabel: "Tier 1",
    goal: "Reach Ap ≥ 20 km and land safely back on Earth.",
    hardwareCost: 350,
    propellantCost: 450,
    credits: 1250,
    research: 25,
    firstTimeCredits: 0,
    wetMassTonnes: 26,
    heightMeters: 30,
    cargo: 0,
  },
  leo: {
    name: "Precision Circular LEO",
    tier: 2,
    tierLabel: "Tier 2",
    goal: "Maintain 60 km ± 6 km circular orbit for 1 full pass.",
    hardwareCost: 850,
    propellantCost: 1250,
    credits: 3600,
    research: 80,
    firstTimeCredits: 0,
    wetMassTonnes: 62,
    heightMeters: 46,
    cargo: 1500,
  },
  return: {
    name: "Orbital Capsule Return",
    tier: 2,
    tierLabel: "Tier 2",
    goal: "Reach stable orbit, deorbit, and land safely on Earth.",
    hardwareCost: 750,
    propellantCost: 1100,
    credits: 4200,
    research: 95,
    firstTimeCredits: 0,
    wetMassTonnes: 42,
    heightMeters: 40,
    cargo: 0,
  },
  lunar_flyby: {
    name: "Lunar Flyby",
    tier: 2,
    tierLabel: "Tier 2",
    goal: "Execute a Moon transfer and enter the Moon's SOI.",
    hardwareCost: 950,
    propellantCost: 1500,
    credits: 5200,
    research: 140,
    firstTimeCredits: 0,
    wetMassTonnes: 65,
    heightMeters: 48,
    cargo: 0,
  },
  lunar_colony: {
    name: "Establish Lunar Outpost",
    tier: 2,
    tierLabel: "Tier 2",
    goal: "Land safely on the Moon to unpack your separate Lunar Colony.",
    hardwareCost: 1200,
    propellantCost: 1800,
    credits: 7500,
    research: 220,
    firstTimeCredits: 0,
    wetMassTonnes: 78,
    heightMeters: 52,
    cargo: 4000,
  },
} as const satisfies Record<string, ContractDef>;

export type Job = keyof typeof CONTRACTS;
export const CONTRACT_JOBS = Object.keys(CONTRACTS) as Job[];
export type Sortie = Job | "practice";

export interface Building {
  kind: Kind;
  x: number;
  y: number;
  level: number;
  /** Wall-clock epoch ms when an in-progress upgrade completes. */
  upgradingUntilMs?: number;
  /** Total duration in seconds for the active upgrade (for progress bars). */
  upgradingDurationSec?: number;
}

export interface Milestones {
  firstSounding: boolean;
  firstKarman: boolean;
  firstOrbit: boolean;
}

export interface CollectorHoppers {
  credits: number;
  propellant: number;
}

export interface SoundingReport {
  vehicleName: string;
  peakAltitude: number;
  hardwareSpent: number;
  propellantSpent: number;
  creditsAwarded: number;
  researchAwarded: number;
}

export type StoreResource = "credits" | "propellant";
export const NOVA_EXCHANGE_UNITS = 1000;
export const NOVA_BOOST_MINUTES = 10;

export interface EconomyState {
  /** Store purchases can take the wallet above the ordinary production limits. */
  purchasedBalanceLimit?: Partial<Record<StoreResource, number>>;
  credits: number;
  propellant: number;
  research: number;
  /** Local tap-to-collect hoppers on Solar Foundry (credits) & Propellant Refinery (propellant). */
  collectors: CollectorHoppers;
  /** Real wall-clock timestamp (ms) for offline collector accumulation (capped by hopper size). */
  lastRealTimestampMs: number;
  simTimeSec: number;
  elapsed: number;
  buildings: Building[];
  buildingLevels: Record<Kind, number>;
  activeContracts: Job[];
  completed: Record<Job, number>;
  milestones: Milestones;
  award: { credits: number; research: number; milestoneBonus: number } | null;
  sortie: Sortie;
  paid: boolean;
  rewarded: boolean;
  inclination: 0 | 90;
  leoPassStartSec: number | null;
  warpAlert: string;
  blueprints: RocketBlueprint[];
  activeBlueprintId: string;
  soundingVehicle?: VehicleSpec;
  contractVehicle?: VehicleSpec;
  soundingReport?: SoundingReport;
  reclaimedTiles: string[];
  clearedTiles?: string[];
  /** Wall-clock epoch ms when each contract becomes available again. */
  contractCooldowns?: Partial<Record<Job, number>>;
  lunar: LunarColony;
}

export type Program = EconomyState;

const PAD_MASS_BY_LEVEL = [0, 35, 90, 220, 500] as const;
const PAD_HEIGHT_BY_LEVEL = [0, 42, 56, 74, 96] as const;

// Clash-of-Clans-style collector output per hour & local hopper cap (~4.5 hr capacity)
const FOUNDRY_RATE_BY_LEVEL = [0, 90, 220, 520, 1200] as const;
const FOUNDRY_HOPPER_BY_LEVEL = [0, 400, 1000, 2400, 5600] as const;
const REFINERY_RATE_BY_LEVEL = [0, 80, 190, 440, 1000] as const;
const REFINERY_HOPPER_BY_LEVEL = [0, 350, 850, 2000, 4600] as const;

const TANK_CAP_BY_LEVEL = [0, 750, 2200, 6000, 15000] as const;
const BANK_CAP_BY_LEVEL = [0, 2000, 7500, 24000, 75000] as const;
const ACTIVE_CONTRACTS_BY_LEVEL = [0, 1, 2, 3, 4] as const;
const OFFICE_COOLDOWN_REDUCTION = [0, 0, 0.15, 0.3, 0.45] as const;
const CONTRACT_COOLDOWN_SEC_BY_TIER = [300, 1200, 2700] as const;
export const REPEAT_CREDITS_FACTOR = 0.35;
export const REPEAT_RESEARCH_FACTOR = 0.4;
const VAB_PARTS_BY_LEVEL = [8, 12, 24, 40, 64] as const;
const VAB_STAGES_BY_LEVEL = [2, 2, 3, 4, 5] as const;
const VAB_DISCOUNT_BY_LEVEL = [0, 0, 0.05, 0.1, 0.15] as const;

export const SIZE = 8;

export function syncBuildingLevels(buildings: Building[]): Record<Kind, number> {
  const map: Record<Kind, number> = {
    command: 0,
    pad: 0,
    foundry: 0,
    refinery: 0,
    tanks: 0,
    bank: 0,
    office: 0,
    vab: 0,
    tracking: 0,
    lab: 0,
  };
  for (const b of buildings) map[b.kind] = Math.max(map[b.kind], b.level);
  return map;
}

export const startProgram = (): Program => {
  const buildings: Building[] = STARTER_KINDS.map((kind) => ({
    kind,
    x: FACILITIES[kind].defaultPos.x,
    y: FACILITIES[kind].defaultPos.y,
    level: 1,
  }));
  const blueprints = starterBlueprints();
  return {
    credits: 300,
    propellant: 350,
    research: 0,
    collectors: { credits: 0, propellant: 0 },
    lastRealTimestampMs: 0,
    simTimeSec: 0,
    elapsed: 0,
    buildings,
    buildingLevels: syncBuildingLevels(buildings),
    activeContracts: [],
    completed: { sounding: 0, hop: 0, orbit: 0, recovery: 0, relay: 0, leo: 0, return: 0, lunar_flyby: 0, lunar_colony: 0 },
    milestones: { firstSounding: false, firstKarman: false, firstOrbit: false },
    award: null,
    sortie: "practice",
    paid: false,
    rewarded: false,
    inclination: 0,
    leoPassStartSec: null,
    warpAlert: "",
    blueprints,
    activeBlueprintId: blueprints[0].id,
    reclaimedTiles: [],
    clearedTiles: [],
    contractCooldowns: {},
    lunar: initialLunarColony(),
  };
};

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

export function tileKey(x: number, y: number) {
  return `${x},${y}`;
}

export function tileTerrain(p: Program, x: number, y: number) {
  if (
    x >= 0 &&
    y >= 0 &&
    x < SIZE &&
    y < SIZE &&
    Array.isArray(p.reclaimedTiles) &&
    p.reclaimedTiles.includes(tileKey(x, y))
  )
    return "land";
  const base = terrain(x, y);
  if ((base === "grove" || base === "rock") && p.clearedTiles?.includes(tileKey(x, y)))
    return "land";
  return base;
}

export function clearingQuote(p: Program, x: number, y: number) {
  const ground = tileTerrain(p, x, y);
  if (ground === "grove") return { name: "Tree grove", action: "Clear trees", propellant: 50 };
  if (ground === "rock") return { name: "Rock outcrop", action: "Clear rocks", propellant: 100 };
  return null;
}

export function clearObstacle(p: Program, x: number, y: number): string {
  const quote = clearingQuote(p, x, y);
  if (!quote) return "Select a tree grove or rock outcrop.";
  const cost = { credits: 0, research: 0, propellant: quote.propellant };
  const issue = costShortfall(p, cost);
  if (issue) return issue;
  spend(p, cost);
  p.clearedTiles = [...(p.clearedTiles ?? []), tileKey(x, y)];
  return "";
}

/** Escalating ocean expansion cost: 100 -> 150 -> 250 -> 400 -> 600 -> 850... */
export function reclaimCost(p: Program): number {
  const n = p.reclaimedTiles?.length ?? 0;
  return 100 + 25 * n * (n + 1);
}

export function canReclaimTile(p: Program, x: number, y: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return false;
  if (tileTerrain(p, x, y) !== "water") return false;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  return dirs.some(([dx, dy]) => tileTerrain(p, x + dx, y + dy) !== "water");
}

export function reclaimTile(p: Program, x: number, y: number): string {
  if (!canReclaimTile(p, x, y)) return "Choose coastal water beside existing land.";
  const cost = reclaimCost(p);
  if (p.credits < cost) return `Need ${(cost - p.credits).toLocaleString("en-US")} C more.`;
  p.credits = Math.max(0, p.credits - cost);
  p.reclaimedTiles = [...(p.reclaimedTiles ?? []), tileKey(x, y)];
  return "";
}

export function maxBuildingCount(_p: Program, k: Kind): number {
  return k === "foundry" || k === "refinery" || k === "bank" ? 2 : 1;
}

export function countBuilt(p: Program, k: Kind): number {
  return p.buildings.filter((b) => b.kind === k).length;
}

export function extraBuildCost(k: Kind): Cost {
  if (k === "foundry") return { credits: 600, propellant: 100, research: 0 };
  if (k === "refinery") return { credits: 750, research: 0 };
  if (k === "bank") return { credits: 650, research: 0 };
  return FACILITIES[k].costs[0];
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remS = s % 60;
  if (m < 60) return remS > 0 && m < 10 ? `${m}m ${remS}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

export function maxBuilderSlots(p: Program): number {
  return level(p, "command") >= 3 ? 2 : 1;
}

export function activeUpgrades(p: Program, nowMs = Date.now()): Building[] {
  return p.buildings.filter(
    (b) => typeof b.upgradingUntilMs === "number" && b.upgradingUntilMs > nowMs,
  );
}

export function upgradeDurationSec(k: Kind, fromLevel: number): number {
  if (fromLevel <= 0) return 120;
  if (fromLevel === 1) return k === "command" ? 900 : 600;
  if (fromLevel === 2) return k === "command" ? 5400 : 2700;
  return k === "command" ? 21600 : 10800;
}

export function completeFinishedUpgrades(p: Program, nowMs = Date.now()): number {
  let completed = 0;
  for (const b of p.buildings) {
    if (typeof b.upgradingUntilMs === "number" && b.upgradingUntilMs <= nowMs) {
      b.level = Math.min(MAX_LEVEL, b.level + 1);
      delete b.upgradingUntilMs;
      delete b.upgradingDurationSec;
      completed++;
    }
  }
  if (completed > 0) {
    p.buildingLevels = syncBuildingLevels(p.buildings);
  }
  return completed;
}

export function contractCooldownSec(p: Program, job: Job): number {
  const tier = CONTRACTS[job].tier;
  const base = CONTRACT_COOLDOWN_SEC_BY_TIER[tier] ?? 1200;
  const officeLv = clamp(level(p, "office"), 1, MAX_LEVEL);
  const reduction = OFFICE_COOLDOWN_REDUCTION[officeLv];
  return Math.round(base * (1 - reduction));
}

export function contractCooldownRemainingMs(
  p: Program,
  job: Job,
  nowMs = Date.now(),
): number {
  const until = p.contractCooldowns?.[job] ?? 0;
  return Math.max(0, until - nowMs);
}

export function placement(
  p: Program,
  kind: Kind,
  x: number,
  y: number,
  fromTile?: { x: number; y: number } | null,
) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || tileTerrain(p, x, y) !== "land")
    return "Choose open ground.";
  for (const b of p.buildings) {
    if (fromTile && b.x === fromTile.x && b.y === fromTile.y) continue;
    if (!fromTile && maxBuildingCount(p, kind) === 1 && b.kind === kind) continue;
    const d = Math.abs(b.x - x) + Math.abs(b.y - y);
    if (!d) return "Tile occupied.";
    if (d === 1 && (kind === "pad" || b.kind === "pad"))
      return "Keep one tile clear around the pad.";
  }
  return "";
}

export const level = (p: Program, k: Kind): number =>
  p.buildings.reduce((m, b) => (b.kind === k ? Math.max(m, b.level) : m), 0);

export const padCaps = (n: number) => {
  const lv = clamp(Math.floor(n), 0, MAX_LEVEL);
  return {
    tonnes: PAD_MASS_BY_LEVEL[lv],
    height: PAD_HEIGHT_BY_LEVEL[lv],
  };
};

export const vabCaps = (n: number) => {
  const lv = clamp(Math.floor(n), 0, MAX_LEVEL);
  return {
    parts: VAB_PARTS_BY_LEVEL[lv],
    stages: VAB_STAGES_BY_LEVEL[lv],
    discount: VAB_DISCOUNT_BY_LEVEL[lv],
  };
};

export function getFacilityLimits(p: Program): FacilityLimits {
  const pad = padCaps(level(p, "pad"));
  const vab = vabCaps(level(p, "vab"));
  const caps = getStorageCaps(p);
  return {
    maxMassTonnes: pad.tonnes,
    maxHeightMeters: pad.height,
    maxParts: vab.parts,
    maxStages: vab.stages,
    hardwareDiscount: vab.discount,
    maxPropellantCap: caps.propellant,
    labLevel: level(p, "lab"),
  };
}

export const trackingInfo = (n: number) => {
  const lv = clamp(Math.floor(n), 0, MAX_LEVEL);
  if (lv <= 1)
    return {
      summary: "Live orbit, Ap/Pe, basic warp",
      maneuverNodes: false,
      interplanetary: false,
      galaxyScanner: false,
    };
  if (lv === 2)
    return {
      summary: "Maneuver nodes & Moon encounters (v0.5)",
      maneuverNodes: true,
      interplanetary: false,
      galaxyScanner: false,
    };
  if (lv === 3)
    return {
      summary: "Heliocentric Mars transfer windows (v0.7)",
      maneuverNodes: true,
      interplanetary: true,
      galaxyScanner: false,
    };
  return {
    summary: "Deep-space galaxy hex scanner (v0.9)",
    maneuverNodes: true,
    interplanetary: true,
    galaxyScanner: true,
  };
};

export function upgradeCost(k: Kind, currentLevel: number): Cost {
  const target = clamp(Math.floor(currentLevel) + 1, 1, MAX_LEVEL);
  return FACILITIES[k].costs[target - 1];
}

export function facilityBenefit(k: Kind, n: number): string {
  const lv = clamp(Math.floor(n), 1, MAX_LEVEL);
  switch (k) {
    case "command":
      if (lv === 1) return "Starter 6 facilities · Tier 1 contracts";
      if (lv === 2) return "Unlocks VAB, Tracking, Lab · Tier 2 contracts";
      if (lv === 3) return "Facility cap Lv 3 · Lunar tier ready";
      return "Facility cap Lv 4 · Interplanetary tier ready";
    case "pad":
      return `${padCaps(lv).tonnes} t max wet mass · ${padCaps(lv).height} m`;
    case "foundry":
      return `${FOUNDRY_RATE_BY_LEVEL[lv].toLocaleString("en-US")} C/hr · ${FOUNDRY_HOPPER_BY_LEVEL[lv].toLocaleString("en-US")} hopper`;
    case "refinery":
      return `${REFINERY_RATE_BY_LEVEL[lv].toLocaleString("en-US")} Prop/hr · ${REFINERY_HOPPER_BY_LEVEL[lv].toLocaleString("en-US")} hopper`;
    case "tanks":
      return `${TANK_CAP_BY_LEVEL[lv].toLocaleString("en-US")} Prop cap`;
    case "bank":
      return `${BANK_CAP_BY_LEVEL[lv].toLocaleString("en-US")} C cap`;
    case "office": {
      const red = Math.round(OFFICE_COOLDOWN_REDUCTION[lv] * 100);
      return `${ACTIVE_CONTRACTS_BY_LEVEL[lv]} active${red ? ` · −${red}% cooldown` : ""}`;
    }
    case "vab": {
      const c = vabCaps(lv);
      const disc = Math.round(c.discount * 100);
      return `${c.parts} parts · ${c.stages} stages${disc ? ` · −${disc}% cost` : ""}`;
    }
    case "tracking":
      return trackingInfo(lv).summary;
    case "lab":
      return `+${lv * 10}% Research Data · Tech Tier ${lv}`;
  }
}

export function upgradeStatDelta(k: Kind, currentLevel: number): string {
  const cur = clamp(Math.floor(currentLevel), 0, MAX_LEVEL);
  const nxt = clamp(cur + 1, 1, MAX_LEVEL);
  if (cur >= MAX_LEVEL) return "Max level";
  if (cur === 0) return facilityBenefit(k, 1);
  switch (k) {
    case "command":
      if (nxt === 2) return "Unlocks VAB, Tracking, Lab & Tier 2 contracts";
      return `Raises all facility level caps to Lv ${nxt}`;
    case "pad":
      return `+${padCaps(nxt).tonnes - padCaps(cur).tonnes} t wet mass · +${padCaps(nxt).height - padCaps(cur).height} m`;
    case "foundry":
      return `+${(FOUNDRY_RATE_BY_LEVEL[nxt] - FOUNDRY_RATE_BY_LEVEL[cur]).toLocaleString("en-US")} C/hr · +${(FOUNDRY_HOPPER_BY_LEVEL[nxt] - FOUNDRY_HOPPER_BY_LEVEL[cur]).toLocaleString("en-US")} hopper`;
    case "refinery":
      return `+${(REFINERY_RATE_BY_LEVEL[nxt] - REFINERY_RATE_BY_LEVEL[cur]).toLocaleString("en-US")} Prop/hr · +${(REFINERY_HOPPER_BY_LEVEL[nxt] - REFINERY_HOPPER_BY_LEVEL[cur]).toLocaleString("en-US")} hopper`;
    case "tanks":
      return `+${(TANK_CAP_BY_LEVEL[nxt] - TANK_CAP_BY_LEVEL[cur]).toLocaleString("en-US")} Prop cap`;
    case "bank":
      return `+${(BANK_CAP_BY_LEVEL[nxt] - BANK_CAP_BY_LEVEL[cur]).toLocaleString("en-US")} C cap`;
    case "office": {
      const red = Math.round(OFFICE_COOLDOWN_REDUCTION[nxt] * 100);
      return `+1 active contract · −${red}% cooldown`;
    }
    case "vab": {
      const c1 = vabCaps(cur), c2 = vabCaps(nxt);
      return `+${c2.parts - c1.parts} parts · +1 stage · −${Math.round(c2.discount * 100)}% cost`;
    }
    case "tracking":
      return trackingInfo(nxt).summary;
    case "lab":
      return `+10% Research Data · Tech Tier ${nxt}`;
  }
}

function safeFinite(v: number, fallback = 0): number {
  return Number.isFinite(v) ? v : fallback;
}

export function getStorageCaps(state: Program) {
  const officeLv = clamp(level(state, "office"), 1, MAX_LEVEL);
  let credits = 0;
  let propellant = 0;
  for (const b of state.buildings) {
    const lv = clamp(b.level, 1, MAX_LEVEL);
    if (b.kind === "bank") credits += BANK_CAP_BY_LEVEL[lv];
    else if (b.kind === "tanks") propellant += TANK_CAP_BY_LEVEL[lv];
  }
  return {
    credits: credits || BANK_CAP_BY_LEVEL[1],
    propellant: propellant || TANK_CAP_BY_LEVEL[1],
    activeContracts: ACTIVE_CONTRACTS_BY_LEVEL[officeLv],
  };
}

// A bought balance survives economy ticks and save loading. Production still uses getStorageCaps.
export function getWalletLimits(p: Program) {
  const storage = getStorageCaps(p);
  const bought = p.purchasedBalanceLimit;
  return {
    credits: Math.max(storage.credits, safeFinite(bought?.credits ?? 0, 0)),
    propellant: Math.max(storage.propellant, safeFinite(bought?.propellant ?? 0, 0)),
  };
}

export function exchangeNovaShard(p: Program, resource: StoreResource) {
  const balance = p[resource] + NOVA_EXCHANGE_UNITS;
  if (balance > Number.MAX_SAFE_INTEGER) return "Balance limit reached.";
  p[resource] = balance;
  if (balance > getStorageCaps(p)[resource]) {
    p.purchasedBalanceLimit = { ...p.purchasedBalanceLimit, [resource]: balance };
  }
  return `Added ${NOVA_EXCHANGE_UNITS.toLocaleString("en-US")} ${resource}.`;
}

export function boostFacility(p: Program, tile: { x: number; y: number }, nowMs = Date.now()) {
  completeFinishedUpgrades(p, nowMs);
  const building = p.buildings.find(b => b.x === tile.x && b.y === tile.y);
  if (!building?.upgradingUntilMs) return "No upgrade in progress.";
  building.upgradingUntilMs = Math.max(nowMs, building.upgradingUntilMs - NOVA_BOOST_MINUTES * 60000);
  const completed = completeFinishedUpgrades(p, nowMs);
  return completed ? "Upgrade complete." : `Upgrade shortened by ${NOVA_BOOST_MINUTES} minutes.`;
}

export function getCollectorCaps(state: Program) {
  let credits = 0;
  let propellant = 0;
  for (const b of state.buildings) {
    const lv = clamp(b.level, 1, MAX_LEVEL);
    if (b.kind === "foundry") credits += FOUNDRY_HOPPER_BY_LEVEL[lv];
    if (b.kind === "refinery") propellant += REFINERY_HOPPER_BY_LEVEL[lv];
  }
  return { credits, propellant };
}

export function getCreditRatePerHour(state: Program): number {
  return state.buildings.reduce(
    (sum, b) =>
      b.kind === "foundry"
        ? sum + FOUNDRY_RATE_BY_LEVEL[clamp(b.level, 1, MAX_LEVEL)]
        : sum,
    0,
  );
}

export function getPropellantRatePerHour(state: Program): number {
  return state.buildings.reduce(
    (sum, b) =>
      b.kind === "refinery"
        ? sum + REFINERY_RATE_BY_LEVEL[clamp(b.level, 1, MAX_LEVEL)]
        : sum,
    0,
  );
}

/**
 * Pure helper: advances unified simulation clock and fills local tap-to-collect hoppers
 * (Solar Foundry for Credits, Propellant Refinery for Propellant) strictly up to their hopper caps.
 * Never auto-deposits into main storage until the player taps the building.
 */
export function advanceEconomyClock(state: Program, dtSimSec: number): Program {
  const dt = Number.isFinite(dtSimSec) && dtSimSec > 0 ? dtSimSec : 0;
  const storageCaps = getWalletLimits(state);
  const hopperCaps = getCollectorCaps(state);
  const creditRatePerSec = getCreditRatePerHour(state) / 3600;
  const propRatePerSec = getPropellantRatePerHour(state) / 3600;
  const nextTime = safeFinite(state.simTimeSec, 0) + dt;

  const curHopperC = clamp(
    safeFinite(state.collectors?.credits, 0),
    0,
    hopperCaps.credits,
  );
  const curHopperP = clamp(
    safeFinite(state.collectors?.propellant, 0),
    0,
    hopperCaps.propellant,
  );

  return {
    ...state,
    credits: clamp(Math.floor(safeFinite(state.credits, 0)), 0, storageCaps.credits),
    propellant: clamp(safeFinite(state.propellant, 0), 0, storageCaps.propellant),
    research: Math.max(0, Math.floor(safeFinite(state.research, 0))),
    collectors: {
      credits: clamp(curHopperC + creditRatePerSec * dt, 0, hopperCaps.credits),
      propellant: clamp(curHopperP + propRatePerSec * dt, 0, hopperCaps.propellant),
    },
    simTimeSec: nextTime,
    elapsed: nextTime,
  };
}

/** Pure helper: applies real-world wall-clock offline accumulation strictly capped by collector hoppers. */
export function applyOfflineProgress(state: Program, nowMs: number) {
  const validNow = Number.isFinite(nowMs) && nowMs > 0 ? Math.floor(nowMs) : 0;
  const prevMs = safeFinite(state.lastRealTimestampMs, 0);
  if (!validNow || prevMs <= 0 || validNow <= prevMs) {
    return {
      state: { ...state, lastRealTimestampMs: validNow || prevMs },
      creditsAdded: 0,
      propellantAdded: 0,
    };
  }
  const elapsedSec = Math.min(30 * 86400, (validNow - prevMs) / 1000);
  const hopperCaps = getCollectorCaps(state);
  const curC = clamp(safeFinite(state.collectors?.credits, 0), 0, hopperCaps.credits);
  const curP = clamp(safeFinite(state.collectors?.propellant, 0), 0, hopperCaps.propellant);
  const nextC = clamp(curC + (getCreditRatePerHour(state) / 3600) * elapsedSec, 0, hopperCaps.credits);
  const nextP = clamp(curP + (getPropellantRatePerHour(state) / 3600) * elapsedSec, 0, hopperCaps.propellant);
  const nextLunar = structuredClone(state.lunar);
  if (nextLunar && nextLunar.unlocked) {
    tickLunarColony(nextLunar, elapsedSec);
  }
  const nextState: Program = {
    ...state,
    buildings: structuredClone(state.buildings),
    collectors: { credits: nextC, propellant: nextP },
    lunar: nextLunar,
    lastRealTimestampMs: validNow,
  };
  completeFinishedUpgrades(nextState, validNow);
  return {
    state: nextState,
    creditsAdded: Math.floor(nextC - curC),
    propellantAdded: Math.floor(nextP - curP),
  };
}

/** Pure helper: transfers accumulated hopper resources into main storage on player tap. */
export function collectResource(
  state: Program,
  resource: "credits" | "propellant",
) {
  const storageCaps = getStorageCaps(state);
  const available = Math.floor(
    Math.max(0, safeFinite(state.collectors?.[resource], 0)),
  );
  if (available < 1) {
    return { state, collected: 0, reason: "Nothing ready to collect yet." };
  }
  if (resource === "credits") {
    const room = Math.max(0, storageCaps.credits - state.credits);
    if (room <= 0) {
      return {
        state,
        collected: 0,
        reason: "Credit storage full — upgrade Credit Bank to store more credits.",
      };
    }
    const take = Math.min(available, room);
    return {
      state: {
        ...state,
        credits: clamp(state.credits + take, 0, storageCaps.credits),
        collectors: {
          ...state.collectors,
          credits: Math.max(0, state.collectors.credits - take),
        },
      },
      collected: take,
      reason: "",
    };
  }
  const room = Math.max(0, Math.floor(storageCaps.propellant - state.propellant));
  if (room <= 0) {
    return {
      state,
      collected: 0,
      reason: "Cryo Tanks full — upgrade tanks or launch a mission.",
    };
  }
  const take = Math.min(available, room);
  return {
    state: {
      ...state,
      propellant: clamp(state.propellant + take, 0, storageCaps.propellant),
      collectors: {
        ...state.collectors,
        propellant: Math.max(0, state.collectors.propellant - take),
      },
    },
    collected: take,
    reason: "",
  };
}

export function collectFromBuilding(p: Program, kind: Kind) {
  const resource: "credits" | "propellant" | null =
    kind === "foundry" ? "credits" : kind === "refinery" ? "propellant" : null;
  if (!resource) return { collected: 0, resource: null, reason: "" };
  const res = collectResource(p, resource);
  if (res.collected > 0) {
    p.credits = res.state.credits;
    p.propellant = res.state.propellant;
    p.collectors = res.state.collectors;
  }
  return { collected: res.collected, resource, reason: res.reason };
}

export function tickEconomy(p: Program, dtSimSec: number) {
  const next = advanceEconomyClock(p, dtSimSec);
  p.credits = next.credits;
  p.propellant = next.propellant;
  p.research = next.research;
  p.collectors = next.collectors;
  p.simTimeSec = next.simTimeSec;
  p.elapsed = next.elapsed;
  p.warpAlert = tickLunarColony(p.lunar, dtSimSec);
}

export function costShortfall(state: Program, cost: Cost): string {
  const missing: string[] = [];
  for (const [key, unit] of [["credits", "C"], ["propellant", "Prop"], ["research", "RD"]] as const) {
    const deficit = Math.ceil((cost[key] ?? 0) - state[key]);
    if (deficit > 0) missing.push(deficit.toLocaleString("en-US") + " " + unit);
  }
  return missing.length ? "Need " + missing.join(" + ") + " more." : "";
}

function spend(state: Program, cost: Cost) {
  state.credits -= cost.credits;
  state.research -= cost.research;
  state.propellant -= cost.propellant ?? 0;
}

export function canAffordUpgrade(
  state: Program,
  buildingId: Kind,
  currentLevelOverride?: number,
  nowMs = Date.now(),
) {
  const current =
    currentLevelOverride !== undefined
      ? currentLevelOverride
      : level(state, buildingId);
  const targetLevel = current + 1;
  const mcLevel = level(state, "command");
  const def = FACILITIES[buildingId];
  const requiredCommandLevel =
    buildingId === "command"
      ? current
      : buildingId === "bank"
        ? Math.max(1, targetLevel - 1)
        : current === 0 && def.tier === 2
          ? 2
          : Math.max(def.tier, targetLevel);
  const durationSec = current >= MAX_LEVEL ? 0 : upgradeDurationSec(buildingId, current);

  if (current >= MAX_LEVEL) {
    return {
      ok: false,
      reason: "Maximum level reached.",
      cost: { credits: 0, research: 0 },
      targetLevel: MAX_LEVEL,
      requiredCommandLevel: MAX_LEVEL,
      durationSec: 0,
    };
  }
  const cost = upgradeCost(buildingId, current);
  if (buildingId !== "command" && mcLevel < requiredCommandLevel) {
    return {
      ok: false,
      reason: `Requires Mission Control Lv ${requiredCommandLevel}.`,
      cost,
      targetLevel,
      requiredCommandLevel,
      durationSec,
    };
  }
  if (activeUpgrades(state, nowMs).length >= maxBuilderSlots(state)) {
    return {
      ok: false,
      reason: `All Engineering Crews busy (${activeUpgrades(state, nowMs).length}/${maxBuilderSlots(state)}).`,
      cost,
      targetLevel,
      requiredCommandLevel,
      durationSec,
    };
  }
  const reason = costShortfall(state, cost);
  if (reason) return { ok: false, reason, cost, targetLevel, requiredCommandLevel, durationSec };
  return {
    ok: true,
    reason: "",
    cost,
    targetLevel,
    requiredCommandLevel,
    durationSec,
  };
}

export function contractVehicle(p: Program, job: Job): VehicleSpec {
  const c = CONTRACTS[job];
  const discount = vabCaps(level(p, "vab")).discount;
  const hardwareCost = Math.max(
    0,
    Math.round(c.hardwareCost * (1 - discount)),
  );
  return {
    name: c.name,
    wetMassTonnes: c.wetMassTonnes,
    heightMeters: c.heightMeters,
    hardwareCost,
    propellantCost: c.propellantCost,
    cargo: c.cargo,
    sponsored: Boolean("sponsored" in c && c.sponsored),
  };
}

export function canLaunchVehicle(state: Program, vehicleSpec: VehicleSpec) {
  const padCap = padCaps(level(state, "pad"));
  const caps = getStorageCaps(state);
  const hardwareCost = Math.max(
    0,
    Math.round(safeFinite(vehicleSpec.hardwareCost, 0)),
  );
  const propellantCost = Math.max(
    0,
    Math.round(safeFinite(vehicleSpec.propellantCost, 0)),
  );

  if (vehicleSpec.wetMassTonnes > padCap.tonnes) {
    return {
      ok: false,
      reason: `Exceeds Launchpad ${padCap.tonnes} t limit (needs ${vehicleSpec.wetMassTonnes} t).`,
      hardwareCost,
      propellantCost,
      emergencyFuelUsed: 0,
    };
  }
  if (vehicleSpec.heightMeters > padCap.height) {
    return {
      ok: false,
      reason: `Exceeds Launchpad ${padCap.height} m clearance.`,
      hardwareCost,
      propellantCost,
      emergencyFuelUsed: 0,
    };
  }
  if (propellantCost > caps.propellant) {
    return {
      ok: false,
      reason: `Exceeds Cryo Tank cap (${caps.propellant.toLocaleString("en-US")} Prop). Upgrade Cryo Tanks.`,
      hardwareCost,
      propellantCost,
      emergencyFuelUsed: 0,
    };
  }
  if (!vehicleSpec.sponsored && state.credits < hardwareCost) {
    return {
      ok: false,
      reason: `Need ${hardwareCost.toLocaleString("en-US")} C. Collect from Solar Foundry or fly Sounding.`,
      hardwareCost,
      propellantCost,
      emergencyFuelUsed: 0,
    };
  }
  if (state.propellant < propellantCost) {
    if (vehicleSpec.sponsored) {
      return {
        ok: true,
        reason: "",
        hardwareCost: 0,
        propellantCost,
        emergencyFuelUsed: Math.max(0, propellantCost - state.propellant),
      };
    }
    return {
      ok: false,
      reason: `Need ${Math.ceil(propellantCost - state.propellant)} more Propellant. Tap Refinery to collect.`,
      hardwareCost,
      propellantCost,
      emergencyFuelUsed: 0,
    };
  }
  return {
    ok: true,
    reason: "",
    hardwareCost,
    propellantCost,
    emergencyFuelUsed: 0,
  };
}

function stagedVehicle(p: Program, job: Job): VehicleSpec {
  if (job === "sounding" && p.soundingVehicle) return p.soundingVehicle;
  if (job !== "sounding" && p.contractVehicle) return p.contractVehicle;
  return contractVehicle(p, job);
}

export function quote(p: Program, job: Job, spec = stagedVehicle(p, job)) {
  const c = CONTRACTS[job];
  const labLv = level(p, "lab");
  const isRepeat = (p.completed[job] ?? 0) > 0;
  const baseCredits = isRepeat
    ? Math.max(50, Math.round(c.credits * REPEAT_CREDITS_FACTOR))
    : c.credits;
  const baseResearch = isRepeat
    ? Math.max(2, Math.round(c.research * REPEAT_RESEARCH_FACTOR))
    : c.research;
  const research = Math.round(baseResearch * (1 + 0.1 * labLv));
  const firstTimeBonus =
    job === "orbit" && !p.milestones.firstOrbit ? c.firstTimeCredits : 0;
  return {
    hardwareCost: spec.hardwareCost,
    propellantCost: spec.propellantCost,
    credits: baseCredits,
    firstTimeBonus,
    research,
    isRepeat,
  };
}

export function launchIssue(
  p: Program,
  job: Sortie,
  vehicle?: VehicleSpec,
  nowMs = Date.now(),
): string {
  if (job === "practice") return "";
  const c = CONTRACTS[job];
  const mcLv = level(p, "command");
  if (c.tier > mcLv) {
    return `Requires Mission Control Lv ${c.tier}.`;
  }
  const remMs = contractCooldownRemainingMs(p, job, nowMs);
  if (remMs > 0) {
    return `Contract refreshing · ${formatDuration(remMs / 1000)} remaining.`;
  }
  const check = canLaunchVehicle(p, vehicle ?? stagedVehicle(p, job));
  return check.ok ? "" : check.reason;
}

export function applyContractReward(state: Program, contractId: Job) {
  const caps = getStorageCaps(state);
  const q = quote(state, contractId);
  const milestoneBonus = q.firstTimeBonus;
  const totalCredits = q.credits + milestoneBonus;
  const nextCredits = Math.max(state.credits, Math.min(state.credits + totalCredits, caps.credits));
  const nextResearch = Math.max(0, state.research + q.research);
  const nextCompleted = {
    ...state.completed,
    [contractId]: (state.completed[contractId] ?? 0) + 1,
  };
  const nextMilestones: Milestones = {
    ...state.milestones,
    firstSounding: state.milestones.firstSounding || contractId === "sounding",
    firstKarman: state.milestones.firstKarman || contractId === "hop",
    firstOrbit: state.milestones.firstOrbit || contractId === "orbit",
  };
  const nextState: Program = {
    ...state,
    credits: nextCredits,
    research: nextResearch,
    completed: nextCompleted,
    milestones: nextMilestones,
    rewarded: true,
    activeContracts: state.activeContracts.filter((j) => j !== contractId),
  };
  return {
    state: nextState,
    creditsAwarded: nextCredits - state.credits,
    researchAwarded: q.research,
    milestoneBonus,
  };
}

export function place(
  p: Program,
  k: Kind,
  x: number,
  y: number,
  fromTile?: { x: number; y: number } | null,
): string {
  const problem = placement(p, k, x, y, fromTile);
  if (problem) return problem;
  if (fromTile) {
    const moving = p.buildings.find(
      (b) => b.kind === k && b.x === fromTile.x && b.y === fromTile.y,
    );
    if (moving) {
      moving.x = x;
      moving.y = y;
      return "";
    }
  }
  const builtCount = countBuilt(p, k);
  const maxCount = maxBuildingCount(p, k);
  if (builtCount >= maxCount) {
    const existing = p.buildings.find((b) => b.kind === k);
    if (existing) {
      existing.x = x;
      existing.y = y;
      return "";
    }
  }
  if (builtCount > 0 && builtCount < maxCount) {
    // Building a 2nd Solar Foundry or 2nd Propellant Refinery (allowed at MC Lv 1!)
    const cost = extraBuildCost(k);
    const shortage = costShortfall(p, cost);
    if (shortage) return shortage;
    spend(p, cost);
    p.buildings.push({ kind: k, x, y, level: 1 });
    p.buildingLevels = syncBuildingLevels(p.buildings);
    return "";
  }
  const check = canAffordUpgrade(p, k, 0);
  if (!check.ok) return check.reason;
  spend(p, check.cost);
  p.buildings.push({ kind: k, x, y, level: 1 });
  p.buildingLevels = syncBuildingLevels(p.buildings);
  return "";
}

export function upgrade(
  p: Program,
  k: Kind,
  atTile?: { x: number; y: number } | null,
  nowMs = Date.now(),
): string {
  completeFinishedUpgrades(p, nowMs);
  const b = atTile
    ? p.buildings.find((x) => x.kind === k && x.x === atTile.x && x.y === atTile.y)
    : p.buildings.find((x) => x.kind === k);
  if (!b) {
    const def = FACILITIES[k].defaultPos;
    if (!placement(p, k, def.x, def.y)) return place(p, k, def.x, def.y);
    for (let y = 1; y < SIZE; y++)
      for (let x = 1; x < SIZE; x++)
        if (!placement(p, k, x, y)) return place(p, k, x, y);
    return "No open plot available.";
  }
  if (typeof b.upgradingUntilMs === "number" && b.upgradingUntilMs > nowMs) {
    return `Upgrade in progress (${formatDuration((b.upgradingUntilMs - nowMs) / 1000)} left).`;
  }
  const check = canAffordUpgrade(p, k, b.level, nowMs);
  if (!check.ok) return check.reason;
  spend(p, check.cost);
  const dur = check.durationSec;
  b.upgradingUntilMs = nowMs + dur * 1000;
  b.upgradingDurationSec = dur;
  return "";
}

export function prepare(p: Program, job: Sortie, flight = initial()): Flight {
  p.sortie = job;
  delete p.soundingVehicle;
  delete p.contractVehicle;
  p.award = null;
  p.paid = false;
  p.rewarded = false;
  p.inclination = 0;
  p.leoPassStartSec = null;
  if (job !== "practice") {
    const caps = getStorageCaps(p);
    if (!p.activeContracts.includes(job)) {
      p.activeContracts = [...p.activeContracts, job].slice(
        -caps.activeContracts,
      );
    }
  }
  flight.cargo = job === "practice" ? 0 : CONTRACTS[job].cargo;
  return flight;
}

export function inspectContractBlueprint(p: Program, job: Job, blueprintId: string) {
  const blueprint = p.blueprints.find((b) => b.id === blueprintId);
  if (!blueprint) return { vehicle: null, error: "Blueprint not found." };
  const analysis = analyzeBlueprint(blueprint, getFacilityLimits(p));
  const vehicle: VehicleSpec = {
    name: blueprint.name,
    wetMassTonnes: analysis.wetTonnes,
    heightMeters: analysis.heightMeters,
    hardwareCost: analysis.hardwareCost,
    propellantCost: analysis.propellantCost,
    cargo: CONTRACTS[job].cargo,
  };
  let error = "";
  if (!analysis.canLaunchWithLimits) {
    error = analysis.warnings.find((w) => w.severity === "error")?.message
      ?? "Vehicle failed pre-launch checks.";
  } else if (analysis.stageCount > 2) {
    error = "Flight supports up to two flight stages.";
  } else if (!analysis.stages[0]?.fuelTonnes) {
    error = "Stage 1 needs propellant to lift off.";
  } else {
    error = launchIssue(p, job, vehicle);
  }
  return { blueprint, analysis, vehicle, error };
}

export function prepareContractBlueprint(p: Program, job: Job, blueprintId: string) {
  const { blueprint, analysis, vehicle, error } = inspectContractBlueprint(p, job, blueprintId);
  if (error || !vehicle || !blueprint || !analysis) return { error, flight: null };

  const instance = buildVehicleInstance(blueprint, analysis);
  p.activeBlueprintId = blueprint.id;
  const flight = initial(instance.stages, instance.payloadDryKg, instance.name, blueprint.parts);
  prepare(p, job, flight);
  if (job === "sounding") p.soundingVehicle = vehicle;
  else p.contractVehicle = vehicle;
  return { error: "", flight };
}

export function inspectSoundingBlueprint(p: Program, blueprintId: string) {
  return inspectContractBlueprint(p, "sounding", blueprintId);
}

export function prepareSoundingBlueprint(p: Program, blueprintId: string) {
  return prepareContractBlueprint(p, "sounding", blueprintId);
}

export function prepareBlueprintFlight(
  p: Program,
  blueprintId: string,
  mode: "practice" | "real",
): { flight: Flight | null; error: string; hardwareCost: number; propellantCost: number } {
  const bp = p.blueprints.find((b) => b.id === blueprintId);
  if (!bp) {
    return { flight: null, error: "Blueprint not found.", hardwareCost: 0, propellantCost: 0 };
  }
  const limits = getFacilityLimits(p);
  const analysis = analyzeBlueprint(bp, limits);
  if (!analysis.canSimulate) {
    return {
      flight: null,
      error: analysis.warnings[0]?.message ?? "Vehicle failed pre-launch checks.",
      hardwareCost: analysis.hardwareCost,
      propellantCost: analysis.propellantCost,
    };
  }
  if (mode === "real") {
    if (!analysis.canLaunchWithLimits) {
      return {
        flight: null,
        error: analysis.warnings[0]?.message ?? "Vehicle exceeds facility limits.",
        hardwareCost: analysis.hardwareCost,
        propellantCost: analysis.propellantCost,
      };
    }
    const check = canLaunchVehicle(p, {
      name: bp.name,
      wetMassTonnes: analysis.wetTonnes,
      heightMeters: analysis.heightMeters,
      hardwareCost: analysis.hardwareCost,
      propellantCost: analysis.propellantCost,
      cargo: 0,
    });
    if (!check.ok) {
      return {
        flight: null,
        error: check.reason,
        hardwareCost: check.hardwareCost,
        propellantCost: check.propellantCost,
      };
    }
    p.credits = Math.max(0, p.credits - check.hardwareCost);
    p.propellant = Math.max(0, p.propellant - check.propellantCost);
  }
  const instance = buildVehicleInstance(bp, analysis);
  p.activeBlueprintId = bp.id;
  const flight = initial(instance.stages, instance.payloadDryKg, instance.name, bp.parts);
  prepare(p, "practice", flight);
  return {
    flight,
    error: "",
    hardwareCost: mode === "real" ? instance.hardwareCost : 0,
    propellantCost: mode === "real" ? instance.propellantCost : 0,
  };
}

export function payLaunch(p: Program): string {
  if (p.sortie === "practice") return "";
  if (p.paid) return "Flight already dispatched.";
  const issue = launchIssue(p, p.sortie);
  if (issue) return issue;
  const q = quote(p, p.sortie);
  const propellantSpent = Math.min(p.propellant, q.propellantCost);
  p.credits -= q.hardwareCost;
  p.propellant -= propellantSpent;
  if (p.sortie === "sounding") {
    p.soundingReport = {
      vehicleName: p.soundingVehicle?.name ?? "Sponsored rocket",
      peakAltitude: 0,
      hardwareSpent: q.hardwareCost,
      propellantSpent,
      creditsAwarded: 0,
      researchAwarded: 0,
    };
  }
  p.award = {
    credits: q.credits,
    research: q.research,
    milestoneBonus: q.firstTimeBonus,
  };
  p.paid = true;
  return "";
}

export function latitude(p: Program, f: Flight) {
  return p.inclination === 90
    ? (Math.asin(clamp(f.y / radius(f), -1, 1)) * 180) / Math.PI
    : 0;
}

const LEO_PASS_SECONDS = 1300;

function inPrecisionOrbit(f: Flight) {
  const { pe, ap } = orbit(f);
  return f.status === "flying" && stable(f) && pe >= 54000 && ap <= 66000;
}

export interface ContractTask {
  name: string;
  done: boolean;
  remainingSeconds?: number;
}

// A read-only view of the same requirements used to settle the current sortie.
export function contractTasks(p: Program, f: Flight): ContractTask[] {
  switch (p.sortie) {
    case "practice":
      return [];
    case "sounding":
      return [{ name: `Reach ${SOUNDING_TARGET / 1000} km`, done: f.maxAlt >= SOUNDING_TARGET }];
    case "hop":
      return [
        { name: `Reach ${AIR / 1000} km`, done: f.maxAlt >= AIR },
        { name: "Separate booster", done: f.stage >= 1 },
      ];
    case "orbit": {
      const { pe, ap } = orbit(f);
      return [
        { name: "Establish stable orbit", done: f.orbitEarned },
        { name: "Hold periapsis ≥ 30 km", done: pe >= AIR },
        { name: "Hold apoapsis ≥ 38 km", done: ap >= 38000 },
      ];
    }
    case "recovery":
      return [
        { name: "Reach 20 km", done: f.maxAlt >= 20000 },
        { name: "Land safely", done: f.status === "landed" },
      ];
    case "return":
      return [
        { name: "Establish stable orbit", done: f.orbitEarned },
        { name: "Land safely", done: f.status === "landed" },
      ];
    case "lunar_flyby":
      return [{ name: "Enter lunar influence", done: Boolean(f.moonVisited || f.body === "moon") }];
    case "lunar_colony":
      return [
        { name: "Enter lunar influence", done: Boolean(f.moonVisited || f.body === "moon") },
        { name: "Land on the Moon", done: f.body === "moon" && f.status === "landed" },
      ];
    case "relay": {
      const { pe, ap } = orbit(f);
      return [
        { name: "Hold periapsis ≥ 35 km", done: f.status === "flying" && pe >= 35000 },
        { name: "Hold apoapsis ≥ 250 km", done: f.status === "flying" && Number.isFinite(ap) && ap >= 250000 },
      ];
    }
    case "leo": {
      const inBand = inPrecisionOrbit(f);
      const elapsed = inBand && p.leoPassStartSec !== null ? Math.max(0, f.t - p.leoPassStartSec) : 0;
      return [
        { name: "Hold a 54–66 km orbit", done: inBand },
        { name: "Maintain for one pass", done: elapsed >= LEO_PASS_SECONDS,
          remainingSeconds: Math.max(0, Math.ceil(LEO_PASS_SECONDS - elapsed)) },
      ];
    }
  }
}

export function contractConditionMet(p: Program, f: Flight): boolean {
  const tasks = contractTasks(p, f);
  if (p.sortie === "leo") {
    // Only the simulation advances or resets the pass, even when the HUD is closed.
    if (tasks[0].done) p.leoPassStartSec ??= f.t;
    else p.leoPassStartSec = null;
  }
  return tasks.length > 0 && tasks.every(task => task.done);
}

export function settle(p: Program, f: Flight): string {
  if (f.body === "moon" && f.status === "landed" && !p.lunar.unlocked) {
    unlockLunarColony(p.lunar);
  }
  const job = p.sortie;
  const report = job === "sounding" && p.paid ? p.soundingReport : undefined;
  if (report) report.peakAltitude = Math.max(report.peakAltitude, f.maxAlt);
  if (job === "practice" || !p.paid || p.rewarded) return "";
  if (!contractConditionMet(p, f)) return "";
  const booked = p.award;
  if (!booked) return "";
  const caps = getStorageCaps(p);
  const totalCredits = booked.credits + booked.milestoneBonus;
  const prevCredits = p.credits;
  p.credits = Math.max(p.credits, Math.min(p.credits + totalCredits, caps.credits));
  p.research = Math.max(0, p.research + booked.research);
  p.completed[job] = (p.completed[job] ?? 0) + 1;
  p.milestones.firstSounding ||= job === "sounding";
  p.milestones.firstKarman ||= job === "hop";
  p.milestones.firstOrbit ||= job === "orbit";
  p.rewarded = true;
  p.activeContracts = p.activeContracts.filter((j) => j !== job);
  p.contractCooldowns = {
    ...(p.contractCooldowns ?? {}),
    [job]: Date.now() + contractCooldownSec(p, job) * 1000,
  };
  const gainedC = p.credits - prevCredits;
  if (report) {
    report.creditsAwarded = gainedC;
    report.researchAwarded = booked.research;
  }
  const capNote = gainedC < totalCredits ? " (capped)" : "";
  return `${CONTRACTS[job].name} complete · +${gainedC.toLocaleString("en-US")} C${capNote} · +${booked.research} RD`;
}

function validBlueprint(bp: unknown): bp is RocketBlueprint {
  if (!bp || typeof bp !== "object") return false;
  const b = bp as RocketBlueprint;
  if (
    typeof b.id !== "string" ||
    !b.id.length ||
    typeof b.name !== "string" ||
    !b.name.length ||
    !Number.isSafeInteger(b.version) ||
    b.version < 1 ||
    !Array.isArray(b.parts) ||
    b.parts.length > 64
  )
    return false;
  return b.parts.every(
    (p) =>
      p &&
      typeof p.uid === "string" &&
      Object.hasOwn(PARTS, p.partId) &&
      Number.isSafeInteger(p.stage) &&
      p.stage >= 0 &&
      p.stage <= 5 &&
      (p.symmetry === 1 || p.symmetry === 2),
  );
}

export function validProgram(value: unknown, f: Flight): value is Program {
  if (!value || typeof value !== "object") return false;
  const p = value as Program;
  if (p.clearedTiles !== undefined) {
    if (!Array.isArray(p.clearedTiles) || p.clearedTiles.length > SIZE * SIZE) return false;
    const valid = p.clearedTiles.every((key) => {
      if (typeof key !== "string" || !/^[0-7],[0-7]$/.test(key)) return false;
      const [x, y] = key.split(",").map(Number);
      return ["grove", "rock"].includes(terrain(x, y));
    });
    if (!valid || new Set(p.clearedTiles).size !== p.clearedTiles.length) return false;
  }
  const natural = (n: unknown) =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  if (
    !natural(p.credits) ||
    !natural(p.research) ||
    typeof p.propellant !== "number" ||
    !Number.isFinite(p.propellant) ||
    p.propellant < 0 ||
    !p.collectors ||
    typeof p.collectors.credits !== "number" ||
    !Number.isFinite(p.collectors.credits) ||
    p.collectors.credits < 0 ||
    typeof p.collectors.propellant !== "number" ||
    !Number.isFinite(p.collectors.propellant) ||
    p.collectors.propellant < 0 ||
    typeof p.lastRealTimestampMs !== "number" ||
    !Number.isFinite(p.lastRealTimestampMs) ||
    p.lastRealTimestampMs < 0 ||
    typeof p.simTimeSec !== "number" ||
    !Number.isFinite(p.simTimeSec) ||
    p.simTimeSec < 0 ||
    !Array.isArray(p.buildings) ||
    p.buildings.length < STARTER_KINDS.length ||
    p.buildings.length > FACILITY_KINDS.length + 3 ||
    !p.completed ||
    !CONTRACT_JOBS.every((k) => natural(p.completed[k])) ||
    !Array.isArray(p.activeContracts) ||
    !p.activeContracts.every((j) => Object.hasOwn(CONTRACTS, j)) ||
    !p.milestones ||
    typeof p.milestones.firstSounding !== "boolean" ||
    typeof p.milestones.firstKarman !== "boolean" ||
    typeof p.milestones.firstOrbit !== "boolean" ||
    !(p.sortie === "practice" || Object.hasOwn(CONTRACTS, p.sortie)) ||
    typeof p.paid !== "boolean" ||
    typeof p.rewarded !== "boolean" ||
    !Array.isArray(p.blueprints) ||
    p.blueprints.length < 1 ||
    p.blueprints.length > 16 ||
    !p.blueprints.every(validBlueprint) ||
    typeof p.activeBlueprintId !== "string"
  )
    return false;
  if (
    !p.buildings.every(
      (b) =>
        b &&
        Object.hasOwn(FACILITIES, b.kind) &&
        natural(b.level) &&
        b.level >= 1 &&
        b.level <= MAX_LEVEL,
    ) ||
    FACILITY_KINDS.some((k) => countBuilt(p, k) > maxBuildingCount(p, k)) ||
    !STARTER_KINDS.every((k) => level(p, k) >= 1) ||
    p.buildings.some((b) => placement(p, b.kind, b.x, b.y, { x: b.x, y: b.y }))
  )
    return false;

  const caps = getWalletLimits(p);
  const hopCaps = getCollectorCaps(p);
  if (
    p.credits > caps.credits ||
    p.propellant > caps.propellant + 1e-6 ||
    p.collectors.credits > hopCaps.credits + 1e-6 ||
    p.collectors.propellant > hopCaps.propellant + 1e-6
  )
    return false;

  const finitePositive = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) && n > 0;
  const validCustomVehicle = (vehicle: VehicleSpec, expectedCargo: number) =>
    Boolean(
      vehicle &&
        f.customStages &&
        f.vehicleName === vehicle.name &&
        typeof vehicle.name === "string" &&
        vehicle.name.length > 0 &&
        finitePositive(vehicle.wetMassTonnes) &&
        finitePositive(vehicle.heightMeters) &&
        natural(vehicle.hardwareCost) &&
        natural(vehicle.propellantCost) &&
        vehicle.cargo === expectedCargo &&
        vehicle.sponsored === undefined,
    );

  const vehicle = p.soundingVehicle;
  if (
    vehicle !== undefined &&
    (p.sortie !== "sounding" || !validCustomVehicle(vehicle, CONTRACTS.sounding.cargo))
  ) return false;

  const stagedContractVehicle = p.contractVehicle;
  if (
    stagedContractVehicle !== undefined &&
    (p.sortie === "practice" ||
      p.sortie === "sounding" ||
      !validCustomVehicle(stagedContractVehicle, CONTRACTS[p.sortie].cargo))
  ) return false;

  const report = p.soundingReport;
  if (
    report !== undefined &&
    (!report ||
      typeof report.vehicleName !== "string" ||
      !report.vehicleName.length ||
      !(report.peakAltitude === 0 || finitePositive(report.peakAltitude)) ||
      !natural(report.hardwareSpent) ||
      !(report.propellantSpent === 0 || finitePositive(report.propellantSpent)) ||
      !natural(report.creditsAwarded) ||
      !natural(report.researchAwarded))
  ) return false;

  const expectedCargo =
    p.sortie === "practice" ? 0 : CONTRACTS[p.sortie].cargo;
  if (f.cargo !== expectedCargo) return false;

  if (p.paid) {
    if (
      p.sortie === "practice" ||
      !p.award ||
      !natural(p.award.credits) ||
      !natural(p.award.research) ||
      !natural(p.award.milestoneBonus)
    )
      return false;
  } else if (p.award !== null) return false;

  if (p.sortie === "practice") return !p.paid && !p.rewarded;
  if (p.paid !== (f.status !== "pad")) return false;
  return !p.rewarded || (p.paid && p.completed[p.sortie] > 0);
}
