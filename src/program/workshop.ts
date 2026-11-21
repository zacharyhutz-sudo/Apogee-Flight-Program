import { G0 } from "../sim/flight.ts";

export type PartCategory = "pod" | "tank" | "engine" | "stage" | "utility";

export interface PartDef {
  id: string;
  name: string;
  shortName: string;
  category: PartCategory;
  /** Dry mass in tonnes (t). */
  dryTonnes: number;
  /** Propellant mass in tonnes (t) for tanks / SRBs. */
  fuelTonnes: number;
  /** Sea-level thrust in kN (engines / boosters). */
  thrustKn: number;
  /** Sea-level Isp (s). */
  ispSl: number;
  /** Vacuum Isp (s). */
  ispVac: number;
  /** Visual height in meters. */
  heightM: number;
  /** Visual width in meters (for SVG rendering). */
  widthM: number;
  /** Aerodynamic drag cross-section (m^2). */
  areaM2: number;
  /** Hardware cost in Credits. */
  hardwareCost: number;
  /** Propellant load cost in Earth Propellant units. */
  propellantCost: number;
  /** Supports 2x mirror radial symmetry. */
  symmetric?: boolean;
  /** Required Research Lab level (0 = available from start). */
  requiredLabLevel: number;
  /** Short technical note for part tray. */
  note: string;
}

export const PARTS = {
  pod_mk1: {
    id: "pod_mk1",
    name: "Mk-1 Command Pod",
    shortName: "Mk-1 Pod",
    category: "pod",
    dryTonnes: 1.4,
    fuelTonnes: 0,
    thrustKn: 0,
    ispSl: 0,
    ispVac: 0,
    heightM: 3.5,
    widthM: 2.2,
    areaM2: 4,
    hardwareCost: 120,
    propellantCost: 0,
    requiredLabLevel: 0,
    note: "Avionics & guidance core",
  },
  pod_probe: {
    id: "pod_probe",
    name: "Survey Probe Core",
    shortName: "Probe",
    category: "pod",
    dryTonnes: 0.6,
    fuelTonnes: 0,
    thrustKn: 0,
    ispSl: 0,
    ispVac: 0,
    heightM: 2.0,
    widthM: 1.8,
    areaM2: 3,
    hardwareCost: 90,
    propellantCost: 0,
    requiredLabLevel: 0,
    note: "Lightweight uncrewed core",
  },
  tank_s: {
    id: "tank_s",
    name: "Small Cryo Tank",
    shortName: "Tank S",
    category: "tank",
    dryTonnes: 0.8,
    fuelTonnes: 6.5,
    thrustKn: 0,
    ispSl: 0,
    ispVac: 0,
    heightM: 5.5,
    widthM: 2.2,
    areaM2: 5,
    hardwareCost: 70,
    propellantCost: 180,
    requiredLabLevel: 0,
    note: "6.5 t kerolox upper tank",
  },
  tank_m: {
    id: "tank_m",
    name: "Medium Cryo Tank",
    shortName: "Tank M",
    category: "tank",
    dryTonnes: 1.8,
    fuelTonnes: 16.5,
    thrustKn: 0,
    ispSl: 0,
    ispVac: 0,
    heightM: 10.5,
    widthM: 2.6,
    areaM2: 7,
    hardwareCost: 140,
    propellantCost: 360,
    requiredLabLevel: 0,
    note: "16.5 t core booster tank",
  },
  tank_l: {
    id: "tank_l",
    name: "Heavy Cryo Tank",
    shortName: "Tank L",
    category: "tank",
    dryTonnes: 3.4,
    fuelTonnes: 36.0,
    thrustKn: 0,
    ispSl: 0,
    ispVac: 0,
    heightM: 15.0,
    widthM: 3.2,
    areaM2: 10,
    hardwareCost: 260,
    propellantCost: 680,
    requiredLabLevel: 1,
    note: "36 t heavy orbital tank",
  },
  eng_kestrel: {
    id: "eng_kestrel",
    name: "Kestrel-1 Booster",
    shortName: "Kestrel",
    category: "engine",
    dryTonnes: 1.2,
    fuelTonnes: 0,
    thrustKn: 520,
    ispSl: 308,
    ispVac: 332,
    heightM: 3.2,
    widthM: 2.2,
    areaM2: 5,
    hardwareCost: 140,
    propellantCost: 0,
    requiredLabLevel: 0,
    note: "520 kN sea-level workhorse",
  },
  eng_dart: {
    id: "eng_dart",
    name: "Dart Vacuum Engine",
    shortName: "Dart Vac",
    category: "engine",
    dryTonnes: 0.5,
    fuelTonnes: 0,
    thrustKn: 140,
    ispSl: 240,
    ispVac: 368,
    heightM: 2.4,
    widthM: 1.8,
    areaM2: 4,
    hardwareCost: 110,
    propellantCost: 0,
    requiredLabLevel: 0,
    note: "High-Isp orbital upper engine",
  },
  eng_titan: {
    id: "eng_titan",
    name: "Titan-4 Heavy Engine",
    shortName: "Titan-4",
    category: "engine",
    dryTonnes: 2.6,
    fuelTonnes: 0,
    thrustKn: 1350,
    ispSl: 318,
    ispVac: 344,
    heightM: 4.2,
    widthM: 3.0,
    areaM2: 8,
    hardwareCost: 320,
    propellantCost: 0,
    requiredLabLevel: 1,
    note: "1,350 kN heavy-lift cluster",
  },
  decoupler: {
    id: "decoupler",
    name: "Stage Decoupler",
    shortName: "Decoupler",
    category: "stage",
    dryTonnes: 0.25,
    fuelTonnes: 0,
    thrustKn: 0,
    ispSl: 0,
    ispVac: 0,
    heightM: 1.2,
    widthM: 2.4,
    areaM2: 4,
    hardwareCost: 40,
    propellantCost: 0,
    requiredLabLevel: 0,
    note: "Separates upper & lower stages",
  },
  srb_side: {
    id: "srb_side",
    name: "Side Booster Pod",
    shortName: "Side SRB",
    category: "stage",
    dryTonnes: 1.1,
    fuelTonnes: 7.5,
    thrustKn: 360,
    ispSl: 285,
    ispVac: 305,
    heightM: 9.0,
    widthM: 1.3,
    areaM2: 3,
    hardwareCost: 130,
    propellantCost: 160,
    symmetric: true,
    requiredLabLevel: 0,
    note: "Radial booster (supports 2× mirror)",
  },
  legs_mk1: {
    id: "legs_mk1",
    name: "Landing Legs",
    shortName: "Legs",
    category: "utility",
    dryTonnes: 0.4,
    fuelTonnes: 0,
    thrustKn: 0,
    ispSl: 0,
    ispVac: 0,
    heightM: 1.4,
    widthM: 2.6,
    areaM2: 2,
    hardwareCost: 90,
    propellantCost: 0,
    symmetric: true,
    requiredLabLevel: 1,
    note: "Touchdown struts (v0.5 Moon ready)",
  },
  colony_kit: {
    id: "colony_kit",
    name: "Colony Starter Kit",
    shortName: "Colony Kit",
    category: "utility",
    dryTonnes: 8.5,
    fuelTonnes: 0,
    thrustKn: 0,
    ispSl: 0,
    ispVac: 0,
    heightM: 4.5,
    widthM: 2.8,
    areaM2: 6,
    hardwareCost: 650,
    propellantCost: 0,
    requiredLabLevel: 2,
    note: "Lunar Hub + Solar payload (v0.5)",
  },
} as const satisfies Record<string, PartDef>;

export type PartId = keyof typeof PARTS;
export const PART_IDS = Object.keys(PARTS) as PartId[];

export interface PlacedPart {
  uid: string;
  partId: PartId;
  /** 0 = bottom (liftoff) stage, 1 = upper stage, etc. */
  stage: number;
  /** 1 = centerline single part, 2 = 2x radial mirror symmetry. */
  symmetry: 1 | 2;
}

export interface RocketBlueprint {
  id: string;
  name: string;
  version: number;
  parts: PlacedPart[];
}

export interface StageStats {
  stage: number;
  dryTonnes: number;
  fuelTonnes: number;
  wetTonnes: number;
  thrustKn: number;
  ispSl: number;
  ispVac: number;
  twr: number;
  deltaV: number;
  areaM2: number;
}

export interface ValidationWarning {
  code:
    | "NO_POD"
    | "LOW_TWR"
    | "NO_ENGINE"
    | "DISCONNECTED_STAGE"
    | "OVER_MASS"
    | "OVER_HEIGHT"
    | "OVER_PARTS"
    | "OVER_STAGES"
    | "OVER_TANK_CAP"
    | "LOCKED_PART";
  severity: "error" | "warn";
  message: string;
}

export interface FacilityLimits {
  maxMassTonnes: number;
  maxHeightMeters: number;
  maxParts: number;
  maxStages: number;
  hardwareDiscount: number;
  maxPropellantCap: number;
  labLevel: number;
}

export interface BlueprintAnalysis {
  partCount: number;
  stageCount: number;
  dryTonnes: number;
  fuelTonnes: number;
  wetTonnes: number;
  heightMeters: number;
  hardwareCost: number;
  propellantCost: number;
  liftoffTwr: number;
  totalDeltaV: number;
  stages: StageStats[];
  warnings: ValidationWarning[];
  canSimulate: boolean;
  canLaunchWithLimits: boolean;
}

/** Constructed flight vehicle instance passed to src/sim/flight.ts */
export interface VehicleStageSpec {
  name: string;
  dry: number;
  fuel: number;
  thrust: number;
  isp: number;
  area: number;
}

export interface VehicleInstance {
  blueprintId: string;
  blueprintVersion: number;
  name: string;
  wetMassTonnes: number;
  heightMeters: number;
  hardwareCost: number;
  propellantCost: number;
  payloadDryKg: number;
  stages: [VehicleStageSpec, VehicleStageSpec];
}

export function starterBlueprints(): RocketBlueprint[] {
  return [
    {
      id: "bp_pioneer_orbiter",
      name: "Pioneer Orbital",
      version: 1,
      parts: [
        { uid: "p1", partId: "pod_mk1", stage: 1, symmetry: 1 },
        { uid: "p2", partId: "tank_s", stage: 1, symmetry: 1 },
        { uid: "p3", partId: "eng_dart", stage: 1, symmetry: 1 },
        { uid: "p4", partId: "decoupler", stage: 0, symmetry: 1 },
        { uid: "p5", partId: "tank_m", stage: 0, symmetry: 1 },
        { uid: "p6", partId: "eng_kestrel", stage: 0, symmetry: 1 },
      ],
    },
    {
      id: "bp_sounding_dart",
      name: "Sounding Arrow",
      version: 1,
      parts: [
        { uid: "s1", partId: "pod_probe", stage: 0, symmetry: 1 },
        { uid: "s2", partId: "tank_s", stage: 0, symmetry: 1 },
        { uid: "s3", partId: "eng_kestrel", stage: 0, symmetry: 1 },
      ],
    },
  ];
}

export function analyzeBlueprint(
  bp: RocketBlueprint,
  limits: FacilityLimits,
): BlueprintAnalysis {
  const warnings: ValidationWarning[] = [];
  let partCount = 0;
  let dryTonnes = 0;
  let fuelTonnes = 0;
  let heightMeters = 0;
  let rawHardware = 0;
  let propellantCost = 0;
  let hasPod = false;

  const stageIndices = new Set<number>();
  for (const item of bp.parts) {
    const def = PARTS[item.partId];
    if (!def) continue;
    const mult = def.symmetric ? item.symmetry : 1;
    partCount += mult;
    dryTonnes += def.dryTonnes * mult;
    fuelTonnes += def.fuelTonnes * mult;
    if (mult === 1) heightMeters += def.heightM;
    rawHardware += def.hardwareCost * mult;
    propellantCost += def.propellantCost * mult;
    if (def.category === "pod") hasPod = true;
    if (def.requiredLabLevel > limits.labLevel) {
      warnings.push({
        code: "LOCKED_PART",
        severity: "error",
        message: `${def.shortName} requires Research Lab Lv ${def.requiredLabLevel}.`,
      });
    }
    stageIndices.add(item.stage);
  }

  const orderedStages = [...stageIndices].sort((a, b) => a - b);
  const stageCount = orderedStages.length;

  // Check for disconnected stage numbering (gaps like stage 0 and stage 2 without stage 1)
  for (let i = 0; i < orderedStages.length; i++) {
    if (orderedStages[i] !== i) {
      warnings.push({
        code: "DISCONNECTED_STAGE",
        severity: "error",
        message: `Disconnected stage sequence (gap before Stage ${orderedStages[i] + 1}).`,
      });
      break;
    }
  }

  // Compute per-stage mass, thrust, Isp, TWR, and delta-V (bottom-up: stage 0 lifts everything)
  const stages: StageStats[] = [];
  let totalDeltaV = 0;

  for (let i = 0; i < orderedStages.length; i++) {
    const st = orderedStages[i];
    const items = bp.parts.filter((p) => p.stage === st);
    let stDry = 0;
    let stFuel = 0;
    let stThrust = 0;
    let flowSl = 0;
    let flowVac = 0;
    let areaM2 = 4;

    for (const item of items) {
      const def = PARTS[item.partId];
      if (!def) continue;
      const mult = def.symmetric ? item.symmetry : 1;
      stDry += def.dryTonnes * mult;
      stFuel += def.fuelTonnes * mult;
      if (def.thrustKn > 0) {
        const th = def.thrustKn * mult;
        stThrust += th;
        if (def.ispSl > 0) flowSl += th / def.ispSl;
        if (def.ispVac > 0) flowVac += th / def.ispVac;
      }
      areaM2 = Math.max(areaM2, def.areaM2);
    }

    // Mass carried above this stage
    let upperWet = 0;
    for (let j = i + 1; j < orderedStages.length; j++) {
      const upSt = orderedStages[j];
      for (const item of bp.parts) {
        if (item.stage !== upSt) continue;
        const def = PARTS[item.partId];
        if (!def) continue;
        const mult = def.symmetric ? item.symmetry : 1;
        upperWet += (def.dryTonnes + def.fuelTonnes) * mult;
      }
    }

    const wetAtStart = upperWet + stDry + stFuel;
    const dryAtEnd = upperWet + stDry;
    const ispSl = flowSl > 0 ? stThrust / flowSl : 0;
    const ispVac = flowVac > 0 ? stThrust / flowVac : 0;
    const twr = wetAtStart > 0 ? stThrust / (wetAtStart * G0) : 0;
    const effectiveIsp = st === 0 ? ispSl : ispVac;
    const dv =
      stThrust > 0 && stFuel > 0 && wetAtStart > dryAtEnd && dryAtEnd > 0
        ? effectiveIsp * G0 * Math.log(wetAtStart / dryAtEnd)
        : 0;
    totalDeltaV += dv;

    stages.push({
      stage: st,
      dryTonnes: stDry,
      fuelTonnes: stFuel,
      wetTonnes: wetAtStart,
      thrustKn: stThrust,
      ispSl,
      ispVac,
      twr,
      deltaV: dv,
      areaM2,
    });
  }

  const wetTonnes = dryTonnes + fuelTonnes;
  const liftoffTwr = stages[0]?.twr ?? 0;
  const hardwareCost = Math.max(
    0,
    Math.round(rawHardware * (1 - limits.hardwareDiscount)),
  );

  if (!hasPod) {
    warnings.push({
      code: "NO_POD",
      severity: "error",
      message: "Missing command module or probe core.",
    });
  }
  if (!stages.length || stages[0].thrustKn <= 0) {
    warnings.push({
      code: "NO_ENGINE",
      severity: "error",
      message: "Stage 1 needs an engine to lift off.",
    });
  } else if (liftoffTwr <= 1.0) {
    warnings.push({
      code: "LOW_TWR",
      severity: "error",
      message: `Liftoff TWR is ${liftoffTwr.toFixed(2)} (must exceed 1.00).`,
    });
  }
  if (wetTonnes > limits.maxMassTonnes) {
    warnings.push({
      code: "OVER_MASS",
      severity: "error",
      message: `Wet mass ${wetTonnes.toFixed(1)} t exceeds Launchpad ${limits.maxMassTonnes} t cap.`,
    });
  }
  if (heightMeters > limits.maxHeightMeters) {
    warnings.push({
      code: "OVER_HEIGHT",
      severity: "error",
      message: `Height ${heightMeters.toFixed(1)} m exceeds Launchpad ${limits.maxHeightMeters} m cap.`,
    });
  }
  if (partCount > limits.maxParts) {
    warnings.push({
      code: "OVER_PARTS",
      severity: "error",
      message: `${partCount} parts exceeds VAB ${limits.maxParts}-part limit.`,
    });
  }
  if (stageCount > limits.maxStages) {
    warnings.push({
      code: "OVER_STAGES",
      severity: "error",
      message: `${stageCount} stages exceeds VAB ${limits.maxStages}-stage limit.`,
    });
  }
  if (propellantCost > limits.maxPropellantCap) {
    warnings.push({
      code: "OVER_TANK_CAP",
      severity: "error",
      message: `Needs ${propellantCost} Prop (exceeds Cryo Tank cap ${limits.maxPropellantCap}).`,
    });
  }

  const structuralError = warnings.some(
    (w) =>
      w.code === "NO_POD" ||
      w.code === "NO_ENGINE" ||
      w.code === "LOW_TWR" ||
      w.code === "DISCONNECTED_STAGE" ||
      w.code === "LOCKED_PART",
  );
  const anyError = warnings.some((w) => w.severity === "error");

  return {
    partCount,
    stageCount,
    dryTonnes,
    fuelTonnes,
    wetTonnes,
    heightMeters,
    hardwareCost,
    propellantCost,
    liftoffTwr,
    totalDeltaV,
    stages,
    warnings,
    canSimulate: !structuralError,
    canLaunchWithLimits: !anyError,
  };
}

/** Converts a validated RocketBlueprint into a concrete 2-stage VehicleInstance for src/sim/flight.ts */
export function buildVehicleInstance(
  bp: RocketBlueprint,
  analysis: BlueprintAnalysis,
): VehicleInstance {
  const s0 = analysis.stages[0];
  const s1 = analysis.stages[1];
  const stage0: VehicleStageSpec = s0
    ? {
        name: "Booster",
        dry: Math.max(500, Math.round(s0.dryTonnes * 1000)),
        fuel: Math.max(1000, Math.round(s0.fuelTonnes * 1000)),
        thrust: Math.max(50000, Math.round(s0.thrustKn * 1000)),
        isp: Math.max(220, Math.round(s0.ispSl || s0.ispVac || 308)),
        area: s0.areaM2,
      }
    : {
        name: "Booster",
        dry: 16000,
        fuel: 238000,
        thrust: 5700000,
        isp: 318,
        area: 16,
      };

  const stage1: VehicleStageSpec = s1
    ? {
        name: "Orbital stage",
        dry: Math.max(400, Math.round(s1.dryTonnes * 1000)),
        fuel: Math.max(0, Math.round(s1.fuelTonnes * 1000)),
        thrust: Math.max(20000, Math.round(s1.thrustKn * 1000)),
        isp: Math.max(250, Math.round(s1.ispVac || s1.ispSl || 360)),
        area: s1.areaM2,
      }
    : {
        name: "Orbital stage",
        dry: 400,
        fuel: 0,
        thrust: 0,
        isp: 360,
        area: 4,
      };

  return {
    blueprintId: bp.id,
    blueprintVersion: bp.version,
    name: bp.name,
    wetMassTonnes: Number(analysis.wetTonnes.toFixed(1)),
    heightMeters: Number(analysis.heightMeters.toFixed(1)),
    hardwareCost: analysis.hardwareCost,
    propellantCost: analysis.propellantCost,
    payloadDryKg: 0,
    stages: [stage0, stage1],
  };
}
