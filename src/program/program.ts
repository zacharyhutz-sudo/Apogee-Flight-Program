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
  PARTS,
  analyzeBlueprint,
  buildVehicleInstance,
  starterBlueprints,
  type FacilityLimits,
  type RocketBlueprint,
} from "./workshop.ts";

export const MAX_LEVEL = 4;

export interface Cost {
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
    role: "Program tier & facility cap",
    defaultPos: { x: 2, y: 3 },
    costs: [
      { credits: 0, research: 0 },
      { credits: 2200, research: 40 },
      { credits: 9000, research: 180 },
      { credits: 32000, research: 600 },
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
      { credits: 1800, research: 0 },
      { credits: 7500, research: 0 },
      { credits: 26000, research: 0 },
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
      { credits: 850, research: 0 },
      { credits: 3400, research: 0 },
      { credits: 11500, research: 0 },
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
      { credits: 900, research: 0 },
      { credits: 3600, research: 0 },
      { credits: 12000, research: 0 },
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
      { credits: 1000, research: 0 },
      { credits: 4200, research: 0 },
      { credits: 14000, research: 0 },
    ],
  },
  office: {
    name: "Contract Office",
    shortName: "Contracts",
    tier: 1,
    role: "Credit cap & active slots",
    defaultPos: { x: 2, y: 5 },
    costs: [
      { credits: 0, research: 0 },
      { credits: 1200, research: 0 },
      { credits: 4800, research: 0 },
      { credits: 16000, research: 0 },
    ],
  },
  vab: {
    name: "Vehicle Assembly Building",
    shortName: "VAB",
    tier: 2,
    role: "Parts, stages & hardware discount",
    defaultPos: { x: 3, y: 5 },
    costs: [
      { credits: 1400, research: 0 },
      { credits: 3200, research: 0 },
      { credits: 9500, research: 0 },
      { credits: 28000, research: 0 },
    ],
  },
  tracking: {
    name: "Tracking Station",
    shortName: "Tracking",
    tier: 2,
    role: "Orbital map navigation tools",
    defaultPos: { x: 5, y: 5 },
    costs: [
      { credits: 1600, research: 0 },
      { credits: 4500, research: 80 },
      { credits: 15000, research: 300 },
      { credits: 45000, research: 900 },
    ],
  },
  lab: {
    name: "Research Lab",
    shortName: "Lab",
    tier: 2,
    role: "Telemetry bonus & tech unlocks",
    defaultPos: { x: 2, y: 1 },
    costs: [
      { credits: 1500, research: 0 },
      { credits: 4000, research: 60 },
      { credits: 13000, research: 250 },
      { credits: 38000, research: 750 },
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

export const CONTRACTS = {
  sounding: {
    name: "Atmospheric Sounding",
    tier: 0,
    tierLabel: "Recovery",
    goal: "Reach Ap ≥ 15 km (sponsor-funded light vehicle).",
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
} as const satisfies Record<string, ContractDef>;

export type Job = keyof typeof CONTRACTS;
export const CONTRACT_JOBS = Object.keys(CONTRACTS) as Job[];
export type Sortie = Job | "practice";

export interface Building {
  kind: Kind;
  x: number;
  y: number;
  level: number;
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

export interface EconomyState {
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
}

export type Program = EconomyState;

const PAD_MASS_BY_LEVEL = [0, 35, 90, 220, 500] as const;
const PAD_HEIGHT_BY_LEVEL = [0, 42, 56, 74, 96] as const;

// Clash-of-Clans-style collector output per hour & local hopper cap (~2.5-3 hr capacity)
const FOUNDRY_RATE_BY_LEVEL = [0, 180, 420, 950, 2200] as const;
const FOUNDRY_HOPPER_BY_LEVEL = [0, 450, 1100, 2500, 6000] as const;
const REFINERY_RATE_BY_LEVEL = [0, 140, 320, 720, 1650] as const;
const REFINERY_HOPPER_BY_LEVEL = [0, 350, 850, 2000, 4800] as const;

const TANK_CAP_BY_LEVEL = [0, 1000, 2800, 7500, 18000] as const;
const CREDIT_CAP_BY_LEVEL = [0, 5000, 15000, 45000, 150000] as const;
const ACTIVE_CONTRACTS_BY_LEVEL = [0, 1, 2, 3, 4] as const;
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
    office: 0,
    vab: 0,
    tracking: 0,
    lab: 0,
  };
  for (const b of buildings) map[b.kind] = b.level;
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
    credits: 600,
    propellant: 900,
    research: 0,
    collectors: { credits: 0, propellant: 0 },
    lastRealTimestampMs: 0,
    simTimeSec: 0,
    elapsed: 0,
    buildings,
    buildingLevels: syncBuildingLevels(buildings),
    activeContracts: [],
    completed: { sounding: 0, hop: 0, orbit: 0, relay: 0, leo: 0 },
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

export const level = (p: Program, k: Kind): number =>
  p.buildings.find((b) => b.kind === k)?.level ?? 0;

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
    case "office":
      return `${CREDIT_CAP_BY_LEVEL[lv].toLocaleString("en-US")} C cap · ${ACTIVE_CONTRACTS_BY_LEVEL[lv]} active`;
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

function safeFinite(v: number, fallback = 0): number {
  return Number.isFinite(v) ? v : fallback;
}

export function getStorageCaps(state: Program) {
  const officeLv = clamp(level(state, "office"), 1, MAX_LEVEL);
  const tanksLv = clamp(level(state, "tanks"), 1, MAX_LEVEL);
  return {
    credits: CREDIT_CAP_BY_LEVEL[officeLv],
    propellant: TANK_CAP_BY_LEVEL[tanksLv],
    activeContracts: ACTIVE_CONTRACTS_BY_LEVEL[officeLv],
  };
}

export function getCollectorCaps(state: Program) {
  const foundryLv = clamp(level(state, "foundry"), 0, MAX_LEVEL);
  const refLv = clamp(level(state, "refinery"), 0, MAX_LEVEL);
  return {
    credits: FOUNDRY_HOPPER_BY_LEVEL[foundryLv],
    propellant: REFINERY_HOPPER_BY_LEVEL[refLv],
  };
}

export function getCreditRatePerHour(state: Program): number {
  const foundryLv = clamp(level(state, "foundry"), 0, MAX_LEVEL);
  return FOUNDRY_RATE_BY_LEVEL[foundryLv];
}

export function getPropellantRatePerHour(state: Program): number {
  const refLv = clamp(level(state, "refinery"), 0, MAX_LEVEL);
  return REFINERY_RATE_BY_LEVEL[refLv];
}

/**
 * Pure helper: advances unified simulation clock and fills local tap-to-collect hoppers
 * (Solar Foundry for Credits, Propellant Refinery for Propellant) strictly up to their hopper caps.
 * Never auto-deposits into main storage until the player taps the building.
 */
export function advanceEconomyClock(state: Program, dtSimSec: number): Program {
  const dt = Number.isFinite(dtSimSec) && dtSimSec > 0 ? dtSimSec : 0;
  const storageCaps = getStorageCaps(state);
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
  return {
    state: {
      ...state,
      collectors: { credits: nextC, propellant: nextP },
      lastRealTimestampMs: validNow,
    },
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
        reason: "Credit storage full — upgrade Contract Office or spend Credits.",
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
}

export function canAffordUpgrade(state: Program, buildingId: Kind) {
  const current = level(state, buildingId);
  const targetLevel = current + 1;
  const mcLevel = level(state, "command");
  const def = FACILITIES[buildingId];
  const requiredCommandLevel =
    buildingId === "command"
      ? current
      : current === 0 && def.tier === 2
        ? 2
        : Math.max(def.tier, targetLevel);

  if (current >= MAX_LEVEL) {
    return {
      ok: false,
      reason: "Maximum level reached.",
      cost: { credits: 0, research: 0 },
      targetLevel: MAX_LEVEL,
      requiredCommandLevel: MAX_LEVEL,
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
    };
  }
  if (state.credits < cost.credits || state.research < cost.research) {
    const missing: string[] = [];
    if (state.credits < cost.credits)
      missing.push(
        `${(cost.credits - state.credits).toLocaleString("en-US")} C`,
      );
    if (state.research < cost.research)
      missing.push(`${cost.research - state.research} RD`);
    return {
      ok: false,
      reason: `Need ${missing.join(" + ")} more.`,
      cost,
      targetLevel,
      requiredCommandLevel,
    };
  }
  return {
    ok: true,
    reason: "",
    cost,
    targetLevel,
    requiredCommandLevel,
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

export function quote(p: Program, job: Job) {
  const c = CONTRACTS[job];
  const spec = contractVehicle(p, job);
  const labLv = level(p, "lab");
  const research = Math.round(c.research * (1 + 0.1 * labLv));
  const firstTimeBonus =
    job === "orbit" && !p.milestones.firstOrbit ? c.firstTimeCredits : 0;
  return {
    hardwareCost: spec.hardwareCost,
    propellantCost: spec.propellantCost,
    credits: c.credits,
    firstTimeBonus,
    research,
  };
}

export function launchIssue(p: Program, job: Sortie): string {
  if (job === "practice") return "";
  const c = CONTRACTS[job];
  const mcLv = level(p, "command");
  if (c.tier > mcLv) {
    return `Requires Mission Control Lv ${c.tier}.`;
  }
  const check = canLaunchVehicle(p, contractVehicle(p, job));
  return check.ok ? "" : check.reason;
}

export function applyContractReward(state: Program, contractId: Job) {
  const caps = getStorageCaps(state);
  const q = quote(state, contractId);
  const milestoneBonus = q.firstTimeBonus;
  const totalCredits = q.credits + milestoneBonus;
  const nextCredits = clamp(state.credits + totalCredits, 0, caps.credits);
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

export function place(p: Program, k: Kind, x: number, y: number): string {
  const problem = placement(p, k, x, y);
  if (problem) return problem;
  const existing = p.buildings.find((b) => b.kind === k);
  if (existing) {
    existing.x = x;
    existing.y = y;
    return "";
  }
  const check = canAffordUpgrade(p, k);
  if (!check.ok) return check.reason;
  p.credits = Math.max(0, p.credits - check.cost.credits);
  p.research = Math.max(0, p.research - check.cost.research);
  p.buildings.push({ kind: k, x, y, level: 1 });
  p.buildingLevels = syncBuildingLevels(p.buildings);
  return "";
}

export function upgrade(p: Program, k: Kind): string {
  const b = p.buildings.find((b) => b.kind === k);
  if (!b) {
    const def = FACILITIES[k].defaultPos;
    if (!placement(p, k, def.x, def.y)) return place(p, k, def.x, def.y);
    for (let y = 1; y < SIZE; y++)
      for (let x = 1; x < SIZE; x++)
        if (!placement(p, k, x, y)) return place(p, k, x, y);
    return "No open plot available.";
  }
  const check = canAffordUpgrade(p, k);
  if (!check.ok) return check.reason;
  p.credits = Math.max(0, p.credits - check.cost.credits);
  p.research = Math.max(0, p.research - check.cost.research);
  b.level++;
  p.buildingLevels = syncBuildingLevels(p.buildings);
  return "";
}

export function prepare(p: Program, job: Sortie): Flight {
  p.sortie = job;
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
  const flight = initial();
  flight.cargo = job === "practice" ? 0 : CONTRACTS[job].cargo;
  return flight;
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
  p.sortie = "practice";
  p.award = null;
  p.paid = false;
  p.rewarded = false;
  p.inclination = 0;
  p.leoPassStartSec = null;
  const flight = initial(instance.stages, instance.payloadDryKg, instance.name, bp.parts);
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
  const spec = contractVehicle(p, p.sortie);
  const check = canLaunchVehicle(p, spec);
  if (!check.ok) return check.reason;
  const q = quote(p, p.sortie);
  p.credits = Math.max(0, p.credits - check.hardwareCost);
  p.propellant = Math.max(0, p.propellant - check.propellantCost);
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

export function contractConditionMet(p: Program, f: Flight): boolean {
  const job = p.sortie;
  if (job === "practice") return false;
  const o = orbit(f);
  switch (job) {
    case "sounding":
      return f.maxAlt >= 15000;
    case "hop":
      return f.maxAlt >= AIR && f.stage >= 1;
    case "orbit":
      return f.orbitEarned && o.pe >= AIR && o.ap >= 38000;
    case "relay":
      return (
        f.status === "flying" &&
        o.pe >= 35000 &&
        Number.isFinite(o.ap) &&
        o.ap >= 250000
      );
    case "leo": {
      const inBand =
        f.status === "flying" &&
        stable(f) &&
        o.pe >= 54000 &&
        o.ap <= 66000;
      if (!inBand) {
        p.leoPassStartSec = null;
        return false;
      }
      if (p.leoPassStartSec === null) {
        p.leoPassStartSec = f.t;
        return false;
      }
      return f.t - p.leoPassStartSec >= 1300;
    }
  }
}

export function settle(p: Program, f: Flight): string {
  const job = p.sortie;
  if (job === "practice" || !p.paid || p.rewarded) return "";
  if (!contractConditionMet(p, f)) return "";
  const booked = p.award;
  if (!booked) return "";
  const caps = getStorageCaps(p);
  const totalCredits = booked.credits + booked.milestoneBonus;
  const prevCredits = p.credits;
  p.credits = clamp(p.credits + totalCredits, 0, caps.credits);
  p.research = Math.max(0, p.research + booked.research);
  p.completed[job] = (p.completed[job] ?? 0) + 1;
  p.milestones.firstSounding ||= job === "sounding";
  p.milestones.firstKarman ||= job === "hop";
  p.milestones.firstOrbit ||= job === "orbit";
  p.rewarded = true;
  p.activeContracts = p.activeContracts.filter((j) => j !== job);
  const gainedC = p.credits - prevCredits;
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
    p.buildings.length > FACILITY_KINDS.length ||
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
    new Set(p.buildings.map((b) => b.kind)).size !== p.buildings.length ||
    !STARTER_KINDS.every((k) => level(p, k) >= 1) ||
    p.buildings.some((b) => placement(p, b.kind, b.x, b.y))
  )
    return false;

  const caps = getStorageCaps(p);
  const hopCaps = getCollectorCaps(p);
  if (
    p.credits > caps.credits ||
    p.propellant > caps.propellant + 1e-6 ||
    p.collectors.credits > hopCaps.credits + 1e-6 ||
    p.collectors.propellant > hopCaps.propellant + 1e-6
  )
    return false;

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
