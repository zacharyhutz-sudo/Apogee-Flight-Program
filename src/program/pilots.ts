import { clamp } from "../sim/flight.ts";

export type PilotRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type PilotStatus = "ready" | "flying" | "stranded";
export type DutyStation = "foundry" | "lab" | "office";
export type PilotPerkId =
  | "iron_canopy"
  | "lunar_pathfinder"
  | "cold_soak"
  | "hot_stage"
  | "quick_turnaround"
  | "salvage_eye";

export const PILOT_PULL_COST = 5000;
export const MAX_PILOT_LEVEL = 10;
export const MAX_PILOT_STARS = 5;
export const PITY_RARE_AT = 5;
export const PITY_LEGENDARY_AT = 25;

export interface PilotRarityMeta {
  label: string;
  rankTitle: string;
  rate: number;
  baseSum: number;
  maxSum: number;
  dupXp: number;
  recoveryFee: number;
  dutyBase: number;
  color: string;
}

export const RARITY_META: Record<PilotRarity, PilotRarityMeta> = {
  common: {
    label: "Common",
    rankTitle: "Cadet",
    rate: 0.5,
    baseSum: 0.04,
    maxSum: 0.13,
    dupXp: 120,
    recoveryFee: 1000,
    dutyBase: 0.05,
    color: "#A4B3C2",
  },
  uncommon: {
    label: "Uncommon",
    rankTitle: "Specialist",
    rate: 0.28,
    baseSum: 0.07,
    maxSum: 0.19,
    dupXp: 180,
    recoveryFee: 1400,
    dutyBase: 0.08,
    color: "#5CD6A8",
  },
  rare: {
    label: "Rare",
    rankTitle: "Flight Officer",
    rate: 0.14,
    baseSum: 0.11,
    maxSum: 0.26,
    dupXp: 260,
    recoveryFee: 1800,
    dutyBase: 0.11,
    color: "#66B2FF",
  },
  epic: {
    label: "Epic",
    rankTitle: "Commander",
    rate: 0.06,
    baseSum: 0.15,
    maxSum: 0.33,
    dupXp: 400,
    recoveryFee: 2400,
    dutyBase: 0.15,
    color: "#C792EA",
  },
  legendary: {
    label: "Legendary",
    rankTitle: "Pioneer",
    rate: 0.02,
    baseSum: 0.2,
    maxSum: 0.42,
    dupXp: 600,
    recoveryFee: 3000,
    dutyBase: 0.2,
    color: "#F5B951",
  },
};

export const PERK_META: Record<PilotPerkId, { label: string; summary: string }> = {
  iron_canopy: {
    label: "Iron Canopy",
    summary: "Parachutes survive up to 260 m/s",
  },
  lunar_pathfinder: {
    label: "Lunar Pathfinder",
    summary: "+20% Credits on Lunar contracts",
  },
  cold_soak: {
    label: "Cold-Soak Specialist",
    summary: "−15% launch propellant cost",
  },
  hot_stage: {
    label: "Hot-Stage Ace",
    summary: "+8% upper-stage Isp",
  },
  quick_turnaround: {
    label: "Quick Turnaround",
    summary: "+15% contract XP gain",
  },
  salvage_eye: {
    label: "Salvage Eye",
    summary: "+12% contract Credits on safe landing",
  },
};

export interface PilotDef {
  id: string;
  name: string;
  callsign: string;
  rarity: PilotRarity;
  role: string;
  bio: string;
  suitColor: string;
  visorColor: string;
  weights: { isp: number; thrust: number; rd: number; credits: number };
  perk?: PilotPerkId;
}

export interface OwnedPilot {
  id: string;
  xp: number;
  level: number;
  stars: number;
  status: PilotStatus;
  duty?: DutyStation;
  missionsFlown: number;
}

export interface CrewState {
  pilots: OwnedPilot[];
  pullsSinceRare: number;
  pullsSinceLegendary: number;
  totalPulls: number;
}

export interface PilotStats {
  isp: number;
  thrust: number;
  rd: number;
  credits: number;
  total: number;
}

export interface PullResult {
  pilot: PilotDef;
  owned: OwnedPilot;
  isDuplicate: boolean;
  starPromoted: boolean;
  xpAwarded: number;
  leveledUp: boolean;
  pityTriggered: "none" | "rare" | "legendary";
}

// 40 curated named pilots: 14 Common, 10 Uncommon, 8 Rare, 5 Epic, 3 Legendary
export const PILOT_CATALOG: readonly PilotDef[] = [
  // Common (14)
  { id: "p_c01", name: "Alex Reyes", callsign: "Spark", rarity: "common", role: "Range Cadet", bio: "First on the tarmac, always double-checks the chute pins.", suitColor: "#4f6d7a", visorColor: "#ffd18a", weights: { isp: 0.3, thrust: 0.25, rd: 0.2, credits: 0.25 } },
  { id: "p_c02", name: "Hana Park", callsign: "Breeze", rarity: "common", role: "Telemetry Cadet", bio: "Logs every altitude tick with obsessive neatness.", suitColor: "#546e7a", visorColor: "#80deea", weights: { isp: 0.2, thrust: 0.2, rd: 0.4, credits: 0.2 } },
  { id: "p_c03", name: "Devon Brooks", callsign: "Torque", rarity: "common", role: "Booster Tech", bio: "Former engine test-stand mechanic chasing flight hours.", suitColor: "#607d8b", visorColor: "#ffcc80", weights: { isp: 0.2, thrust: 0.4, rd: 0.15, credits: 0.25 } },
  { id: "p_c04", name: "Nadia Benali", callsign: "Compass", rarity: "common", role: "Guidance Cadet", bio: "Calm hands during gravity turns and crosswinds.", suitColor: "#455a64", visorColor: "#a5d6a7", weights: { isp: 0.35, thrust: 0.25, rd: 0.25, credits: 0.15 } },
  { id: "p_c05", name: "Tomas Novak", callsign: "Cinder", rarity: "common", role: "Sounding Pilot", bio: "Loves short, loud suborbital hops.", suitColor: "#5d6d7e", visorColor: "#ffab91", weights: { isp: 0.25, thrust: 0.35, rd: 0.15, credits: 0.25 } },
  { id: "p_c06", name: "Priya Nair", callsign: "Pulse", rarity: "common", role: "Comms Cadet", bio: "Keeps crisp downlinks even through upper-stage staging.", suitColor: "#4a6572", visorColor: "#80cbc4", weights: { isp: 0.2, thrust: 0.2, rd: 0.35, credits: 0.25 } },
  { id: "p_c07", name: "Liam O'Connor", callsign: "Gale", rarity: "common", role: "Recovery Cadet", bio: "Trained on coastal splashdown drills.", suitColor: "#546e7a", visorColor: "#ffe082", weights: { isp: 0.25, thrust: 0.25, rd: 0.2, credits: 0.3 } },
  { id: "p_c08", name: "Mei-Ling Zhou", callsign: "Quartz", rarity: "common", role: "Systems Cadet", bio: "Reads tank pressure gauges like sheet music.", suitColor: "#4e6a78", visorColor: "#90caf9", weights: { isp: 0.35, thrust: 0.2, rd: 0.3, credits: 0.15 } },
  { id: "p_c09", name: "Mateo Silva", callsign: "Rivet", rarity: "common", role: "Pad Trainee", bio: "Knows every bolt on the Mk-1 capsule.", suitColor: "#5c6f7b", visorColor: "#ffd54f", weights: { isp: 0.2, thrust: 0.3, rd: 0.2, credits: 0.3 } },
  { id: "p_c10", name: "Zara Mensah", callsign: "Echo", rarity: "common", role: "Range Observer", bio: "Spots apogee drift before the plot updates.", suitColor: "#486370", visorColor: "#81d4fa", weights: { isp: 0.3, thrust: 0.2, rd: 0.35, credits: 0.15 } },
  { id: "p_c11", name: "Owen Gallagher", callsign: "Flint", rarity: "common", role: "Propulsion Cadet", bio: "Runs lean mixtures to squeeze extra seconds of burn.", suitColor: "#526975", visorColor: "#ffca28", weights: { isp: 0.4, thrust: 0.25, rd: 0.15, credits: 0.2 } },
  { id: "p_c12", name: "Sofia Alvarez", callsign: "Lark", rarity: "common", role: "Flight Trainee", bio: "Natural feel for soft touchdowns.", suitColor: "#4c6875", visorColor: "#a5d6a7", weights: { isp: 0.25, thrust: 0.25, rd: 0.25, credits: 0.25 } },
  { id: "p_c13", name: "Kenji Takahashi", callsign: "Vector", rarity: "common", role: "Avionics Cadet", bio: "Prefers clean circular orbits over flashy burns.", suitColor: "#465e6b", visorColor: "#80deea", weights: { isp: 0.3, thrust: 0.2, rd: 0.3, credits: 0.2 } },
  { id: "p_c14", name: "Claire Dubois", callsign: "Beacon", rarity: "common", role: "Sponsor Liaison", bio: "Turns every sounding shot into press coverage.", suitColor: "#586d7a", visorColor: "#ffe082", weights: { isp: 0.15, thrust: 0.2, rd: 0.25, credits: 0.4 } },

  // Uncommon (10)
  { id: "p_u01", name: "Elena Vance", callsign: "Drift", rarity: "uncommon", role: "Orbital Specialist", bio: "Smooth coasting burns with minimal propellant waste.", suitColor: "#2d6a5b", visorColor: "#a7f3d0", weights: { isp: 0.45, thrust: 0.2, rd: 0.2, credits: 0.15 } },
  { id: "p_u02", name: "Marcus Thorne", callsign: "Anvil", rarity: "uncommon", role: "Heavy-Lift Tech", bio: "Specializes in high-mass liftoffs right near pad limits.", suitColor: "#2e7d63", visorColor: "#fde68a", weights: { isp: 0.2, thrust: 0.45, rd: 0.15, credits: 0.2 } },
  { id: "p_u03", name: "Amina Okafor", callsign: "Prism", rarity: "uncommon", role: "Science Specialist", bio: "Extracts rich telemetry from every upper-atmosphere pass.", suitColor: "#2a6f68", visorColor: "#99f6e4", weights: { isp: 0.2, thrust: 0.15, rd: 0.5, credits: 0.15 } },
  { id: "p_u04", name: "Lucas Lindqvist", callsign: "Frost", rarity: "uncommon", role: "Cryo Specialist", bio: "Keeps liquid oxygen chilled to the last second on the pad.", suitColor: "#28665e", visorColor: "#bae6fd", weights: { isp: 0.4, thrust: 0.25, rd: 0.15, credits: 0.2 } },
  { id: "p_u05", name: "Sora Watanabe", callsign: "Kite", rarity: "uncommon", role: "Recovery Specialist", bio: "Precision canopy handling on high-speed returns.", suitColor: "#317362", visorColor: "#fef08a", weights: { isp: 0.25, thrust: 0.25, rd: 0.2, credits: 0.3 } },
  { id: "p_u06", name: "Rafael Morales", callsign: "Broker", rarity: "uncommon", role: "Contract Pilot", bio: "Commercial sponsors request him by name.", suitColor: "#2c6b58", visorColor: "#fcd34d", weights: { isp: 0.15, thrust: 0.2, rd: 0.2, credits: 0.45 } },
  { id: "p_u07", name: "Freya Lindholm", callsign: "Needle", rarity: "uncommon", role: "Precision Pilot", bio: "Holds circular LEO bands within a few hundred meters.", suitColor: "#296963", visorColor: "#a7f3d0", weights: { isp: 0.35, thrust: 0.2, rd: 0.3, credits: 0.15 } },
  { id: "p_u08", name: "Tariq Al-Mansoor", callsign: "Zenith", rarity: "uncommon", role: "High-Alt Specialist", bio: "Built his reputation on 300 km elliptical relays.", suitColor: "#2d705c", visorColor: "#fde68a", weights: { isp: 0.35, thrust: 0.3, rd: 0.2, credits: 0.15 } },
  { id: "p_u09", name: "Chloe Bennett", callsign: "Spindle", rarity: "uncommon", role: "Stage Specialist", bio: "Clean separations even under heavy booster loads.", suitColor: "#27645a", visorColor: "#99f6e4", weights: { isp: 0.25, thrust: 0.4, rd: 0.2, credits: 0.15 } },
  { id: "p_u10", name: "Viktor Petrov", callsign: "Sable", rarity: "uncommon", role: "Payload Officer", bio: "Delivers commercial cargo on tight margins.", suitColor: "#306e60", visorColor: "#fcd34d", weights: { isp: 0.2, thrust: 0.25, rd: 0.2, credits: 0.35 } },

  // Rare (8)
  { id: "p_r01", name: "Kira Lind", callsign: "Apogee", rarity: "rare", role: "Flight Officer", bio: "Veteran orbital navigator with textbook transfer burns.", suitColor: "#24578a", visorColor: "#93c5fd", weights: { isp: 0.4, thrust: 0.25, rd: 0.2, credits: 0.15 } },
  { id: "p_r02", name: "Dante Rossini", callsign: "Valkyrie", rarity: "rare", role: "Test Officer", bio: "Pushes prototype VAB stacks past their paper limits.", suitColor: "#1f4e82", visorColor: "#fde68a", weights: { isp: 0.25, thrust: 0.45, rd: 0.15, credits: 0.15 } },
  { id: "p_r03", name: "Yuki Sato", callsign: "Kepler", rarity: "rare", role: "Astrodynamicist", bio: "Turns every orbital pass into breakthrough lab data.", suitColor: "#225387", visorColor: "#7dd3fc", weights: { isp: 0.25, thrust: 0.15, rd: 0.45, credits: 0.15 } },
  { id: "p_r04", name: "Samuel Adeyemi", callsign: "Gilded", rarity: "rare", role: "Commercial Ace", bio: "Negotiates top-dollar milestones for high-profile launches.", suitColor: "#265c91", visorColor: "#fcd34d", weights: { isp: 0.2, thrust: 0.2, rd: 0.15, credits: 0.45 } },
  { id: "p_r05", name: "Ingrid Solberg", callsign: "Polaris", rarity: "rare", role: "Deep-Range Officer", bio: "Specializes in long coast arcs and lunar encounters.", suitColor: "#1e4b7d", visorColor: "#bae6fd", weights: { isp: 0.4, thrust: 0.2, rd: 0.25, credits: 0.15 } },
  { id: "p_r06", name: "Gabriel Costa", callsign: "Halcyon", rarity: "rare", role: "Recovery Officer", bio: "Never lost a capsule in forty coastal descents.", suitColor: "#235588", visorColor: "#a7f3d0", weights: { isp: 0.3, thrust: 0.25, rd: 0.2, credits: 0.25 } },
  { id: "p_r07", name: "Linnea Berg", callsign: "Quasar", rarity: "rare", role: "Telemetry Officer", bio: "Pairs clean burns with high-yield science sweeps.", suitColor: "#205082", visorColor: "#93c5fd", weights: { isp: 0.2, thrust: 0.2, rd: 0.4, credits: 0.2 } },
  { id: "p_r08", name: "Omar Haddad", callsign: "Brimstone", rarity: "rare", role: "Booster Officer", bio: "Gets heavy payloads off the pad with fuel to spare.", suitColor: "#255a8f", visorColor: "#fdba74", weights: { isp: 0.3, thrust: 0.4, rd: 0.1, credits: 0.2 } },

  // Epic (5)
  { id: "p_e01", name: "Valerie Chen", callsign: "Ironclad", rarity: "epic", role: "Recovery Commander", bio: "Reinforces every descent harness personally before rollout.", suitColor: "#63398a", visorColor: "#e9d5ff", weights: { isp: 0.3, thrust: 0.25, rd: 0.2, credits: 0.25 }, perk: "iron_canopy" },
  { id: "p_e02", name: "Henrik Lind", callsign: "Subzero", rarity: "epic", role: "Cryo Commander", bio: "Pioneered densified propellant loading across the range.", suitColor: "#5b3282", visorColor: "#bae6fd", weights: { isp: 0.4, thrust: 0.25, rd: 0.2, credits: 0.15 }, perk: "cold_soak" },
  { id: "p_e03", name: "Camila Vega", callsign: "Afterburn", rarity: "epic", role: "Propulsion Commander", bio: "Fires upper stages milliseconds after separation.", suitColor: "#6b3d94", visorColor: "#fde68a", weights: { isp: 0.35, thrust: 0.35, rd: 0.15, credits: 0.15 }, perk: "hot_stage" },
  { id: "p_e04", name: "Dr. Aris Thorne", callsign: "Catalyst", rarity: "epic", role: "Mission Commander", bio: "Mentors crews and turns every sortie into rapid mastery.", suitColor: "#5f3585", visorColor: "#a7f3d0", weights: { isp: 0.2, thrust: 0.2, rd: 0.4, credits: 0.2 }, perk: "quick_turnaround" },
  { id: "p_e05", name: "Sienna Vance", callsign: "Windfall", rarity: "epic", role: "Operations Commander", bio: "Recovers intact hardware and maximizes sponsor bonuses.", suitColor: "#673b8f", visorColor: "#fcd34d", weights: { isp: 0.2, thrust: 0.2, rd: 0.2, credits: 0.4 }, perk: "salvage_eye" },

  // Legendary (3)
  { id: "p_l01", name: "Cmdr. Elena Rostova", callsign: "Selene", rarity: "legendary", role: "Lunar Pioneer", bio: "First to chart low-energy Moon transfers by hand.", suitColor: "#8f6218", visorColor: "#fef08a", weights: { isp: 0.35, thrust: 0.2, rd: 0.2, credits: 0.25 }, perk: "lunar_pathfinder" },
  { id: "p_l02", name: "Capt. Julian Vance", callsign: "Nova", rarity: "legendary", role: "Chief Test Pilot", bio: "Flew the first two-stage orbital prototype on fumes.", suitColor: "#9a6b1b", visorColor: "#fde68a", weights: { isp: 0.35, thrust: 0.35, rd: 0.15, credits: 0.15 }, perk: "hot_stage" },
  { id: "p_l03", name: "Dr. Amara Osei", callsign: "Horizon", rarity: "legendary", role: "Flight Director", bio: "Unmatched re-entry precision and deep-range science lead.", suitColor: "#855a14", visorColor: "#a7f3d0", weights: { isp: 0.25, thrust: 0.2, rd: 0.35, credits: 0.2 }, perk: "iron_canopy" },
];

export const PILOT_BY_ID: Record<string, PilotDef> = Object.fromEntries(
  PILOT_CATALOG.map((p) => [p.id, p]),
);

export function initialCrewState(): CrewState {
  return {
    pilots: [
      {
        id: "p_c01",
        xp: 0,
        level: 1,
        stars: 1,
        status: "ready",
        missionsFlown: 0,
      },
    ],
    pullsSinceRare: 0,
    pullsSinceLegendary: 0,
    totalPulls: 0,
  };
}

export function xpForLevel(level: number): number {
  const lv = clamp(Math.floor(level), 1, MAX_PILOT_LEVEL);
  return 100 * (lv - 1) * (lv - 1);
}

export function levelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let lv = 1;
  while (lv < MAX_PILOT_LEVEL && safeXp >= xpForLevel(lv + 1)) lv++;
  return lv;
}

export function pilotStats(owned: OwnedPilot): PilotStats {
  const def = PILOT_BY_ID[owned.id];
  if (!def) return { isp: 0, thrust: 0, rd: 0, credits: 0, total: 0 };
  const meta = RARITY_META[def.rarity];
  const lvFrac = (clamp(owned.level, 1, MAX_PILOT_LEVEL) - 1) / (MAX_PILOT_LEVEL - 1);
  const starMult = 1 + 0.04 * (clamp(owned.stars, 1, MAX_PILOT_STARS) - 1);
  const total = (meta.baseSum + (meta.maxSum - meta.baseSum) * lvFrac) * starMult;
  return {
    isp: total * def.weights.isp,
    thrust: total * def.weights.thrust,
    rd: total * def.weights.rd,
    credits: total * def.weights.credits,
    total,
  };
}

export function awardPilotXp(owned: OwnedPilot, amount: number): { leveledUp: boolean; gained: number } {
  const def = PILOT_BY_ID[owned.id];
  const mult = def?.perk === "quick_turnaround" ? 1.15 : 1;
  const gained = Math.max(0, Math.round(amount * mult));
  const prevLv = owned.level;
  owned.xp = Math.max(0, Math.floor(owned.xp + gained));
  owned.level = levelFromXp(owned.xp);
  return { leveledUp: owned.level > prevLv, gained };
}

export function contractXpReward(tier: 0 | 1 | 2, hasChallengeModifier = false): number {
  const base = tier === 0 ? 40 : tier === 1 ? 100 : 220;
  return hasChallengeModifier ? Math.round(base * 1.3) : base;
}

export function rollPilotRarity(
  crew: CrewState,
  rng: () => number = Math.random,
): { rarity: PilotRarity; pityTriggered: "none" | "rare" | "legendary" } {
  if (crew.pullsSinceLegendary >= PITY_LEGENDARY_AT - 1) {
    return { rarity: "legendary", pityTriggered: "legendary" };
  }
  if (crew.pullsSinceRare >= PITY_RARE_AT - 1) {
    const r = rng();
    if (r < 0.06) return { rarity: "legendary", pityTriggered: "rare" };
    if (r < 0.3) return { rarity: "epic", pityTriggered: "rare" };
    return { rarity: "rare", pityTriggered: "rare" };
  }
  const r = rng();
  if (r < 0.02) return { rarity: "legendary", pityTriggered: "none" };
  if (r < 0.08) return { rarity: "epic", pityTriggered: "none" };
  if (r < 0.22) return { rarity: "rare", pityTriggered: "none" };
  if (r < 0.5) return { rarity: "uncommon", pityTriggered: "none" };
  return { rarity: "common", pityTriggered: "none" };
}

export function executePilotPull(
  crew: CrewState,
  rng: () => number = Math.random,
): PullResult {
  const { rarity, pityTriggered } = rollPilotRarity(crew, rng);
  const pool = PILOT_CATALOG.filter((p) => p.rarity === rarity);
  const picked = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];

  crew.totalPulls += 1;
  if (rarity === "legendary") {
    crew.pullsSinceLegendary = 0;
    crew.pullsSinceRare = 0;
  } else if (rarity === "epic" || rarity === "rare") {
    crew.pullsSinceRare = 0;
    crew.pullsSinceLegendary += 1;
  } else {
    crew.pullsSinceRare += 1;
    crew.pullsSinceLegendary += 1;
  }

  const existing = crew.pilots.find((p) => p.id === picked.id);
  if (existing) {
    let starPromoted = false;
    if (existing.stars < MAX_PILOT_STARS) {
      existing.stars += 1;
      starPromoted = true;
    }
    const { leveledUp, gained } = awardPilotXp(existing, RARITY_META[rarity].dupXp);
    return {
      pilot: picked,
      owned: existing,
      isDuplicate: true,
      starPromoted,
      xpAwarded: gained,
      leveledUp,
      pityTriggered,
    };
  }

  const created: OwnedPilot = {
    id: picked.id,
    xp: 0,
    level: 1,
    stars: 1,
    status: "ready",
    missionsFlown: 0,
  };
  crew.pilots.push(created);
  return {
    pilot: picked,
    owned: created,
    isDuplicate: false,
    starPromoted: false,
    xpAwarded: 0,
    leveledUp: false,
    pityTriggered,
  };
}

export function crewDutyBonus(crew: CrewState | undefined, station: DutyStation): number {
  if (!crew) return 0;
  const assigned = crew.pilots.find((p) => p.status === "ready" && p.duty === station);
  if (!assigned) return 0;
  const def = PILOT_BY_ID[assigned.id];
  if (!def) return 0;
  const meta = RARITY_META[def.rarity];
  const lvScale = 1 + 0.05 * (clamp(assigned.level, 1, MAX_PILOT_LEVEL) - 1);
  return Math.min(0.25, meta.dutyBase * lvScale);
}

export function pilotRecoveryFee(pilotId: string): number {
  const def = PILOT_BY_ID[pilotId];
  return def ? RARITY_META[def.rarity].recoveryFee : 1000;
}

export function isValidCrewState(value: unknown): value is CrewState {
  if (!value || typeof value !== "object") return false;
  const c = value as CrewState;
  const natural = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  if (
    !Array.isArray(c.pilots) ||
    !natural(c.pullsSinceRare) ||
    !natural(c.pullsSinceLegendary) ||
    !natural(c.totalPulls)
  )
    return false;
  const seen = new Set<string>();
  return c.pilots.every((p) => {
    if (!p || typeof p !== "object" || typeof p.id !== "string" || !PILOT_BY_ID[p.id] || seen.has(p.id))
      return false;
    seen.add(p.id);
    return (
      natural(p.xp) &&
      natural(p.level) &&
      p.level >= 1 &&
      p.level <= MAX_PILOT_LEVEL &&
      natural(p.stars) &&
      p.stars >= 1 &&
      p.stars <= MAX_PILOT_STARS &&
      (p.status === "ready" || p.status === "flying" || p.status === "stranded") &&
      (p.duty === undefined || p.duty === "foundry" || p.duty === "lab" || p.duty === "office") &&
      natural(p.missionsFlown)
    );
  });
}
