import { clamp } from "../sim/flight.ts";

export type LunarKind =
  | "hub"
  | "solar"
  | "extractor"
  | "isru"
  | "refuel"
  | "science";

export interface LunarFacilityDef {
  name: string;
  shortName: string;
  role: string;
  powerDelta: readonly [number, number, number, number]; // + generates, - consumes
  costs: readonly [
    { ore: number; ice: number },
    { ore: number; ice: number },
    { ore: number; ice: number },
    { ore: number; ice: number },
  ];
}

export const LUNAR_FACILITIES: Record<LunarKind, LunarFacilityDef> = {
  hub: {
    name: "Colony Hub",
    shortName: "Hub",
    role: "Outpost core & building cap",
    powerDelta: [-10, -16, -24, -36],
    costs: [
      { ore: 0, ice: 0 },
      { ore: 180, ice: 140 },
      { ore: 550, ice: 420 },
      { ore: 1600, ice: 1200 },
    ],
  },
  solar: {
    name: "Lunar Solar Array",
    shortName: "Solar",
    role: "Powers colony structures",
    powerDelta: [35, 75, 140, 260],
    costs: [
      { ore: 40, ice: 0 },
      { ore: 120, ice: 60 },
      { ore: 360, ice: 180 },
      { ore: 980, ice: 480 },
    ],
  },
  extractor: {
    name: "Regolith & Ice Extractor",
    shortName: "Extractor",
    role: "Tap-to-collect Exotic Ore & Water Ice",
    powerDelta: [-18, -28, -42, -60],
    costs: [
      { ore: 50, ice: 0 },
      { ore: 160, ice: 100 },
      { ore: 480, ice: 320 },
      { ore: 1350, ice: 900 },
    ],
  },
  isru: {
    name: "ISRU Propellant Plant",
    shortName: "ISRU",
    role: "Refines Water Ice into Lunar Propellant",
    powerDelta: [-20, -32, -48, -70],
    costs: [
      { ore: 90, ice: 60 },
      { ore: 240, ice: 160 },
      { ore: 680, ice: 440 },
      { ore: 1800, ice: 1200 },
    ],
  },
  refuel: {
    name: "Landing & Refuel Pad",
    shortName: "Moon Pad",
    role: "Launch & refuel directly from the Moon",
    powerDelta: [-8, -12, -18, -26],
    costs: [
      { ore: 110, ice: 80 },
      { ore: 300, ice: 220 },
      { ore: 820, ice: 600 },
      { ore: 2100, ice: 1500 },
    ],
  },
  science: {
    name: "Lunar Science Outpost",
    shortName: "Outpost",
    role: "Tap-to-collect high-yield Research Data",
    powerDelta: [-15, -24, -36, -54],
    costs: [
      { ore: 140, ice: 100 },
      { ore: 380, ice: 260 },
      { ore: 1050, ice: 720 },
      { ore: 2800, ice: 1900 },
    ],
  },
};

export const LUNAR_KINDS = Object.keys(LUNAR_FACILITIES) as LunarKind[];

export interface LunarBuilding {
  kind: LunarKind;
  level: number;
}

export interface LunarColony {
  unlocked: boolean;
  /** Separate Lunar economy resources (independent from Earth!). */
  exoticOre: number;
  waterIce: number;
  propellant: number;
  /** Local tap-to-collect hoppers on the Moon. */
  hoppers: {
    ore: number;
    ice: number;
    propellant: number;
    research: number;
  };
  buildings: LunarBuilding[];
  powerAlert: string;
}

const ORE_RATE = [0, 60, 145, 340, 780] as const;
const ICE_RATE = [0, 80, 190, 440, 1000] as const;
const ISRU_RATE = [0, 120, 290, 680, 1600] as const;
const SCI_RATE = [0, 18, 42, 95, 220] as const;

export function initialLunarColony(): LunarColony {
  return {
    unlocked: false,
    exoticOre: 80,
    waterIce: 60,
    propellant: 0,
    hoppers: { ore: 0, ice: 0, propellant: 0, research: 0 },
    buildings: [],
    powerAlert: "",
  };
}

export function unlockLunarColony(c: LunarColony) {
  if (c.unlocked) return;
  c.unlocked = true;
  if (!c.buildings.length) {
    // Unpack Colony Starter Kit -> Hub Lv 1 + Starter Solar Array Lv 1
    c.buildings = [
      { kind: "hub", level: 1 },
      { kind: "solar", level: 1 },
    ];
  }
}

export function lunarLevel(c: LunarColony, k: LunarKind): number {
  return c.buildings.find((b) => b.kind === k)?.level ?? 0;
}

export function lunarPowerBalance(c: LunarColony) {
  let produced = 0;
  let consumed = 0;
  for (const b of c.buildings) {
    const lv = clamp(b.level, 1, 4);
    const d = LUNAR_FACILITIES[b.kind].powerDelta[lv - 1];
    if (d >= 0) produced += d;
    else consumed += -d;
  }
  return { produced, consumed, net: produced - consumed };
}

export function lunarCaps(c: LunarColony) {
  const hubLv = clamp(lunarLevel(c, "hub"), 1, 4);
  return {
    ore: [0, 800, 2400, 7000, 20000][hubLv],
    ice: [0, 1000, 3000, 8500, 24000][hubLv],
    propellant: [0, 1200, 3600, 10000, 28000][hubLv],
    hopperOre: Math.max(150, ORE_RATE[clamp(lunarLevel(c, "extractor"), 0, 4)] * 3),
    hopperIce: Math.max(200, ICE_RATE[clamp(lunarLevel(c, "extractor"), 0, 4)] * 3),
    hopperProp: Math.max(300, ISRU_RATE[clamp(lunarLevel(c, "isru"), 0, 4)] * 3),
    hopperResearch: Math.max(40, SCI_RATE[clamp(lunarLevel(c, "science"), 0, 4)] * 3),
  };
}

/** Advances the separate Lunar Colony economy on the unified simulation clock. Returns warpAlert if upkeep fails. */
export function tickLunarColony(c: LunarColony, dtSec: number): string {
  if (!c.unlocked || !Number.isFinite(dtSec) || dtSec <= 0) return "";
  const pwr = lunarPowerBalance(c);
  if (pwr.net < 0) {
    c.powerAlert = "Lunar outpost power deficit! Build or upgrade Lunar Solar Array.";
    return c.powerAlert;
  }
  c.powerAlert = "";
  const caps = lunarCaps(c);
  const extLv = clamp(lunarLevel(c, "extractor"), 0, 4);
  const isruLv = clamp(lunarLevel(c, "isru"), 0, 4);
  const sciLv = clamp(lunarLevel(c, "science"), 0, 4);

  if (extLv > 0) {
    c.hoppers.ore = clamp(c.hoppers.ore + (ORE_RATE[extLv] / 3600) * dtSec, 0, caps.hopperOre);
    c.hoppers.ice = clamp(c.hoppers.ice + (ICE_RATE[extLv] / 3600) * dtSec, 0, caps.hopperIce);
  }
  if (isruLv > 0 && c.waterIce > 0) {
    const prod = (ISRU_RATE[isruLv] / 3600) * dtSec;
    const iceNeeded = prod * 0.35;
    const scale = Math.min(1, c.waterIce / Math.max(1e-6, iceNeeded));
    c.waterIce = Math.max(0, c.waterIce - iceNeeded * scale);
    c.hoppers.propellant = clamp(
      c.hoppers.propellant + prod * scale,
      0,
      caps.hopperProp,
    );
  }
  if (sciLv > 0) {
    c.hoppers.research = clamp(
      c.hoppers.research + (SCI_RATE[sciLv] / 3600) * dtSec,
      0,
      caps.hopperResearch,
    );
  }
  return "";
}

export function buildOrUpgradeLunar(c: LunarColony, kind: LunarKind): string {
  if (!c.unlocked) return "Land on the Moon first to establish the Lunar Outpost.";
  const existing = c.buildings.find((b) => b.kind === kind);
  const curLv = existing?.level ?? 0;
  if (curLv >= 4) return "Maximum level reached.";
  const hubLv = lunarLevel(c, "hub");
  if (kind !== "hub" && curLv + 1 > hubLv) {
    return `Requires Colony Hub Lv ${curLv + 1}.`;
  }
  const cost = LUNAR_FACILITIES[kind].costs[curLv];
  if (c.exoticOre < cost.ore || c.waterIce < cost.ice) {
    return `Need ${cost.ore} Ore${cost.ice ? ` + ${cost.ice} Ice` : ""}.`;
  }
  c.exoticOre = Math.max(0, c.exoticOre - cost.ore);
  c.waterIce = Math.max(0, c.waterIce - cost.ice);
  if (existing) existing.level++;
  else c.buildings.push({ kind, level: 1 });
  return "";
}

export function collectLunar(
  c: LunarColony,
  kind: LunarKind,
): { text: string; researchGained: number } {
  const caps = lunarCaps(c);
  if (kind === "extractor") {
    const oreTake = Math.min(Math.floor(c.hoppers.ore), Math.floor(caps.ore - c.exoticOre));
    const iceTake = Math.min(Math.floor(c.hoppers.ice), Math.floor(caps.ice - c.waterIce));
    if (oreTake < 1 && iceTake < 1) return { text: "", researchGained: 0 };
    c.exoticOre += oreTake;
    c.waterIce += iceTake;
    c.hoppers.ore -= oreTake;
    c.hoppers.ice -= iceTake;
    const parts: string[] = [];
    if (oreTake > 0) parts.push(`+${oreTake} Ore`);
    if (iceTake > 0) parts.push(`+${iceTake} Ice`);
    return { text: parts.join(" · "), researchGained: 0 };
  }
  if (kind === "isru") {
    const take = Math.min(
      Math.floor(c.hoppers.propellant),
      Math.floor(caps.propellant - c.propellant),
    );
    if (take < 1) return { text: "", researchGained: 0 };
    c.propellant += take;
    c.hoppers.propellant -= take;
    return { text: `+${take} Lunar Prop`, researchGained: 0 };
  }
  if (kind === "science") {
    const take = Math.floor(c.hoppers.research);
    if (take < 1) return { text: "", researchGained: 0 };
    c.hoppers.research -= take;
    return { text: `+${take} RD`, researchGained: take };
  }
  return { text: "", researchGained: 0 };
}
