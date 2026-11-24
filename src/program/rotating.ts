import { clamp } from "../sim/flight.ts";

export type RotatingTemplateId =
  | "sounding_sweep"
  | "orbit_insertion"
  | "precision_band"
  | "recovery_sortie"
  | "lunar_logistics";

export type ModifierId =
  | "urgent_rush"
  | "science_grant"
  | "sponsor_subsidy"
  | "featherweight"
  | "single_stage"
  | "minimalist"
  | "heavy_cargo"
  | "fuel_reserve"
  | "express_window";

export interface ModifierMeta {
  label: string;
  type: "bonus" | "challenge";
  summary: string;
}

export const MODIFIER_META: Record<ModifierId, ModifierMeta> = {
  urgent_rush: {
    label: "Urgent Rush",
    type: "bonus",
    summary: "+40% Credits · shorter expiry",
  },
  science_grant: {
    label: "Science Grant",
    type: "bonus",
    summary: "+50% RD",
  },
  sponsor_subsidy: {
    label: "Sponsor Subsidy",
    type: "bonus",
    summary: "−35% hardware cost",
  },
  featherweight: {
    label: "Featherweight",
    type: "challenge",
    summary: "Wet mass cap · +35% Credits",
  },
  single_stage: {
    label: "Single-Stage",
    type: "challenge",
    summary: "1 stage max · +45% C · +25% RD",
  },
  minimalist: {
    label: "Minimalist",
    type: "challenge",
    summary: "≤ 6 parts · +30% Credits",
  },
  heavy_cargo: {
    label: "Heavy Cargo",
    type: "challenge",
    summary: "Extra payload · +40% Credits",
  },
  fuel_reserve: {
    label: "Fuel Reserve",
    type: "challenge",
    summary: "≥ 15% fuel left · +30% C · +20% RD",
  },
  express_window: {
    label: "Express Window",
    type: "challenge",
    summary: "Finish < 4m · +35% Credits",
  },
};

export interface RotatingContract {
  id: string;
  template: RotatingTemplateId;
  name: string;
  tier: 1 | 2;
  goal: string;
  targetApM?: number;
  targetPeM?: number;
  precisionBandM?: { min: number; max: number };
  requireLanding?: boolean;
  requireMoonSoi?: boolean;
  requireMoonLanding?: boolean;
  cargoKg: number;
  credits: number;
  research: number;
  modifiers: ModifierId[];
  maxWetTonnes?: number;
  maxStages?: number;
  maxParts?: number;
  hardwareDiscount?: number;
  minFuelFrac?: number;
  maxTimeSec?: number;
  expiresAtMs: number;
}

export interface RotatingBoardState {
  offers: RotatingContract[];
  nextRefreshAtMs: number;
  freeRerollsUsed: number;
  rerollCount: number;
}

const REFRESH_SEC_BY_OFFICE_LV = [14400, 14400, 10800, 9000, 7200] as const;

export function rotatingSlotCount(officeLevel: number): number {
  const lv = clamp(Math.floor(officeLevel), 1, 4);
  if (lv >= 4) return 4;
  if (lv >= 2) return 3;
  return 2;
}

export function rotatingRefreshSec(officeLevel: number): number {
  const lv = clamp(Math.floor(officeLevel), 1, 4);
  return REFRESH_SEC_BY_OFFICE_LV[lv];
}

export function rerollCostCredits(board: RotatingBoardState): number {
  if (board.freeRerollsUsed < 1) return 0;
  const paidCount = Math.max(0, board.rerollCount - 1);
  return 150 * Math.pow(2, Math.min(4, paidCount));
}

function pickOne<T>(items: readonly T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

function randInt(min: number, max: number, step: number, rng: () => number): number {
  const steps = Math.max(1, Math.floor((max - min) / step) + 1);
  return min + Math.floor(rng() * steps) * step;
}

export function generateRotatingOffers(
  mcLevel: number,
  officeLevel: number,
  nowMs: number,
  rng: () => number = Math.random,
): RotatingContract[] {
  const count = rotatingSlotCount(officeLevel);
  const refreshMs = rotatingRefreshSec(officeLevel) * 1000;
  const tier1Templates: RotatingTemplateId[] = [
    "sounding_sweep",
    "orbit_insertion",
    "recovery_sortie",
  ];
  const tier2Templates: RotatingTemplateId[] = [
    "orbit_insertion",
    "precision_band",
    "recovery_sortie",
    "lunar_logistics",
  ];

  const offers: RotatingContract[] = [];
  const usedTemplates = new Set<string>();

  for (let i = 0; i < count; i++) {
    const tier: 1 | 2 =
      mcLevel >= 2 && (i > 0 || rng() < 0.65) ? 2 : 1;
    const pool = tier === 2 ? tier2Templates : tier1Templates;
    const freshPool = pool.filter((t) => !usedTemplates.has(`${tier}:${t}`));
    const template = pickOne(freshPool.length ? freshPool : pool, rng);
    usedTemplates.add(`${tier}:${template}`);

    const id = `rot_${nowMs.toString(36)}_${i}_${Math.floor(rng() * 1e5).toString(36)}`;
    let name = "";
    let goal = "";
    let targetApM: number | undefined;
    let targetPeM: number | undefined;
    let precisionBandM: { min: number; max: number } | undefined;
    let requireLanding = false;
    let requireMoonSoi = false;
    let requireMoonLanding = false;
    let cargoKg = 0;
    let credits = 1000;
    let research = 20;

    switch (template) {
      case "sounding_sweep": {
        const apKm = randInt(22, 44, 2, rng);
        const land = rng() < 0.45;
        targetApM = apKm * 1000;
        requireLanding = land;
        name = land ? `Recovery Sweep ${apKm} km` : `Sounding Sweep ${apKm} km`;
        goal = land
          ? `Reach Ap ≥ ${apKm} km and land safely on Earth.`
          : `Reach Ap ≥ ${apKm} km altitude.`;
        credits = 850 + apKm * 18 + (land ? 350 : 0);
        research = 15 + Math.round(apKm * 0.4) + (land ? 8 : 0);
        break;
      }
      case "orbit_insertion": {
        const apKm = tier === 2 ? randInt(120, 320, 20, rng) : randInt(40, 80, 10, rng);
        const peKm = tier === 2 ? randInt(35, 55, 5, rng) : 32;
        cargoKg = tier === 2 ? randInt(1000, 2500, 500, rng) : randInt(500, 1000, 500, rng);
        targetApM = apKm * 1000;
        targetPeM = peKm * 1000;
        name = `Orbit Insertion ${apKm} km`;
        goal = `Achieve Pe ≥ ${peKm} km and Ap ≥ ${apKm} km (${(cargoKg / 1000).toFixed(1)} t payload).`;
        credits = tier === 2 ? 2400 + apKm * 5 + Math.round(cargoKg * 0.35) : 1450 + apKm * 8;
        research = tier === 2 ? 55 + Math.round(apKm * 0.1) : 28 + Math.round(apKm * 0.15);
        break;
      }
      case "precision_band": {
        const centerKm = randInt(55, 115, 10, rng);
        const minKm = centerKm - 8;
        const maxKm = centerKm + 8;
        cargoKg = randInt(1000, 2000, 500, rng);
        precisionBandM = { min: minKm * 1000, max: maxKm * 1000 };
        name = `Precision Band ${centerKm} km`;
        goal = `Hold ${minKm}–${maxKm} km circular orbit for 1 full pass.`;
        credits = 3100 + centerKm * 8;
        research = 70 + Math.round(centerKm * 0.25);
        break;
      }
      case "recovery_sortie": {
        if (tier === 2) {
          targetPeM = 32_000;
          targetApM = randInt(45, 90, 15, rng) * 1000;
          requireLanding = true;
          name = "Orbital Recovery Sortie";
          goal = `Reach stable orbit (Ap ≥ ${targetApM / 1000} km), deorbit, and land safely.`;
          credits = 3600 + (targetApM / 1000) * 10;
          research = 80;
        } else {
          const apKm = randInt(24, 42, 3, rng);
          targetApM = apKm * 1000;
          requireLanding = true;
          name = `Capsule Recovery ${apKm} km`;
          goal = `Reach Ap ≥ ${apKm} km and land safely back on Earth.`;
          credits = 1200 + apKm * 16;
          research = 24 + Math.round(apKm * 0.3);
        }
        break;
      }
      case "lunar_logistics": {
        const land = rng() < 0.45;
        cargoKg = land ? randInt(2000, 4000, 500, rng) : randInt(1000, 2500, 500, rng);
        requireMoonSoi = true;
        requireMoonLanding = land;
        name = land ? "Lunar Cargo Delivery" : "Lunar Reconnaissance";
        goal = land
          ? `Land safely on the Moon with ${(cargoKg / 1000).toFixed(1)} t cargo.`
          : `Enter the Moon's SOI with ${(cargoKg / 1000).toFixed(1)} t payload.`;
        credits = land ? 6200 + Math.round(cargoKg * 0.4) : 4400 + Math.round(cargoKg * 0.3);
        research = land ? 180 : 120;
        break;
      }
    }

    // Roll 1-2 compatible modifiers
    const bonusPool: ModifierId[] = ["urgent_rush", "science_grant", "sponsor_subsidy"];
    const challengePool: ModifierId[] = [
      "featherweight",
      "minimalist",
      "heavy_cargo",
      "fuel_reserve",
    ];
    if (template !== "lunar_logistics" && template !== "precision_band") {
      challengePool.push("single_stage");
    }
    if (template !== "lunar_logistics" && template !== "precision_band" && !requireLanding) {
      challengePool.push("express_window");
    }

    const modifiers: ModifierId[] = [];
    const wantBonus = rng() < 0.6;
    const wantChallenge = !wantBonus || (tier === 2 ? rng() < 0.75 : rng() < 0.45);
    if (wantBonus) modifiers.push(pickOne(bonusPool, rng));
    if (wantChallenge) modifiers.push(pickOne(challengePool, rng));

    let creditMult = 1;
    let rdMult = 1;
    let expiresAtMs = nowMs + refreshMs;
    let maxWetTonnes: number | undefined;
    let maxStages: number | undefined;
    let maxParts: number | undefined;
    let hardwareDiscount: number | undefined;
    let minFuelFrac: number | undefined;
    let maxTimeSec: number | undefined;

    for (const mod of modifiers) {
      switch (mod) {
        case "urgent_rush":
          creditMult += 0.4;
          expiresAtMs = nowMs + Math.round(refreshMs * 0.5);
          break;
        case "science_grant":
          rdMult += 0.5;
          break;
        case "sponsor_subsidy":
          hardwareDiscount = 0.35;
          break;
        case "featherweight":
          maxWetTonnes = tier === 2 ? 48 : 24;
          creditMult += 0.35;
          break;
        case "single_stage":
          maxStages = 1;
          creditMult += 0.45;
          rdMult += 0.25;
          break;
        case "minimalist":
          maxParts = 6;
          creditMult += 0.3;
          break;
        case "heavy_cargo": {
          const extraKg = tier === 2 ? 2500 : 1500;
          cargoKg += extraKg;
          creditMult += 0.4;
          break;
        }
        case "fuel_reserve":
          minFuelFrac = 0.15;
          creditMult += 0.3;
          rdMult += 0.2;
          break;
        case "express_window":
          maxTimeSec = 240;
          creditMult += 0.35;
          break;
      }
    }

    offers.push({
      id,
      template,
      name,
      tier,
      goal,
      ...(targetApM !== undefined ? { targetApM } : {}),
      ...(targetPeM !== undefined ? { targetPeM } : {}),
      ...(precisionBandM !== undefined ? { precisionBandM } : {}),
      ...(requireLanding ? { requireLanding } : {}),
      ...(requireMoonSoi ? { requireMoonSoi } : {}),
      ...(requireMoonLanding ? { requireMoonLanding } : {}),
      cargoKg,
      credits: Math.round((credits * creditMult) / 25) * 25,
      research: Math.max(5, Math.round(research * rdMult)),
      modifiers,
      ...(maxWetTonnes !== undefined ? { maxWetTonnes } : {}),
      ...(maxStages !== undefined ? { maxStages } : {}),
      ...(maxParts !== undefined ? { maxParts } : {}),
      ...(hardwareDiscount !== undefined ? { hardwareDiscount } : {}),
      ...(minFuelFrac !== undefined ? { minFuelFrac } : {}),
      ...(maxTimeSec !== undefined ? { maxTimeSec } : {}),
      expiresAtMs,
    });
  }

  return offers;
}

export function isValidRotatingContract(value: unknown): value is RotatingContract {
  if (!value || typeof value !== "object") return false;
  const c = value as RotatingContract;
  return (
    typeof c.id === "string" &&
    c.id.length > 0 &&
    typeof c.name === "string" &&
    c.name.length > 0 &&
    typeof c.goal === "string" &&
    (c.tier === 1 || c.tier === 2) &&
    typeof c.cargoKg === "number" &&
    Number.isFinite(c.cargoKg) &&
    c.cargoKg >= 0 &&
    typeof c.credits === "number" &&
    Number.isSafeInteger(c.credits) &&
    c.credits > 0 &&
    typeof c.research === "number" &&
    Number.isSafeInteger(c.research) &&
    c.research >= 0 &&
    Array.isArray(c.modifiers) &&
    c.modifiers.every((m) => Object.hasOwn(MODIFIER_META, m)) &&
    typeof c.expiresAtMs === "number" &&
    Number.isFinite(c.expiresAtMs) &&
    c.expiresAtMs > 0
  );
}
