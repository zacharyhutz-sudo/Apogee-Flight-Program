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
  symmetric: boolean;
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
    hardwareCost: 150,
    propellantCost: 0,
    symmetric: false,
    requiredLabLevel: 0,
    note: "Crewed avionics & guidance core",
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
    hardwareCost: 80,
    propellantCost: 0,
    symmetric: false,
    requiredLabLevel: 0,
    note: "Lightweight uncrewed core",
  },
  tank_s: {
    id: "tank_s",
    name: "Small Cryo Tank",
    shortName: "Tank S",
    category: "tank",
    dryTonnes: 0.75,
    fuelTonnes: 6.0,
    thrustKn: 0,
    ispSl: 0,
    ispVac: 0,
    heightM: 5.5,
    widthM: 2.2,
    areaM2: 5,
    hardwareCost: 70,
    propellantCost: 120,
    symmetric: false,
    requiredLabLevel: 0,
    note: "6.0 t kerolox upper tank",
  },
  tank_m: {
    id: "tank_m",
    name: "Medium Cryo Tank",
    shortName: "Tank M",
    category: "tank",
    dryTonnes: 1.75,
    fuelTonnes: 16.0,
    thrustKn: 0,
    ispSl: 0,
    ispVac: 0,
    heightM: 10.5,
    widthM: 2.6,
    areaM2: 7,
    hardwareCost: 140,
    propellantCost: 320,
    symmetric: false,
    requiredLabLevel: 0,
    note: "16.0 t core booster tank",
  },
  tank_l: {
    id: "tank_l",
    name: "Heavy Cryo Tank",
    shortName: "Tank L",
    category: "tank",
    dryTonnes: 3.5,
    fuelTonnes: 36.0,
    thrustKn: 0,
    ispSl: 0,
    ispVac: 0,
    heightM: 15.0,
    widthM: 3.2,
    areaM2: 10,
    hardwareCost: 260,
    propellantCost: 720,
    symmetric: false,
    requiredLabLevel: 1,
    note: "36.0 t heavy orbital tank",
  },
  eng_kestrel: {
    id: "eng_kestrel",
    name: "Kestrel-1 Booster",
    shortName: "Kestrel",
    category: "engine",
    dryTonnes: 1.2,
    fuelTonnes: 0,
    thrustKn: 480,
    ispSl: 305,
    ispVac: 335,
    heightM: 3.2,
    widthM: 2.2,
    areaM2: 5,
    hardwareCost: 150,
    propellantCost: 0,
    symmetric: false,
    requiredLabLevel: 0,
    note: "480 kN balanced sustainer",
  },
  eng_dart: {
    id: "eng_dart",
    name: "Dart Vacuum Engine",
    shortName: "Dart Vac",
    category: "engine",
    dryTonnes: 0.55,
    fuelTonnes: 0,
    thrustKn: 140,
    ispSl: 220,
    ispVac: 375,
    heightM: 2.4,
    widthM: 1.8,
    areaM2: 4,
    hardwareCost: 120,
    propellantCost: 0,
    symmetric: false,
    requiredLabLevel: 0,
    note: "High-Isp orbital & lander engine",
  },
  eng_titan: {
    id: "eng_titan",
    name: "Titan-4 Heavy Engine",
    shortName: "Titan-4",
    category: "engine",
    dryTonnes: 2.9,
    fuelTonnes: 0,
    thrustKn: 1250,
    ispSl: 295,
    ispVac: 320,
    heightM: 4.2,
    widthM: 3.0,
    areaM2: 8,
    hardwareCost: 360,
    propellantCost: 0,
    symmetric: false,
    requiredLabLevel: 1,
    note: "1,250 kN heavy-lift cluster",
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
    symmetric: false,
    requiredLabLevel: 0,
    note: "Separates upper & lower stages",
  },
  bracket_side: {
    id: "bracket_side",
    name: "Side Bracket",
    shortName: "Bracket",
    category: "stage",
    dryTonnes: 0.2,
    fuelTonnes: 0,
    thrustKn: 0,
    ispSl: 0,
    ispVac: 0,
    heightM: 1.6,
    widthM: 1.0,
    areaM2: 1,
    hardwareCost: 50,
    propellantCost: 0,
    symmetric: true,
    requiredLabLevel: 0,
    note: "Rigid side mount with fuel crossfeed",
  },
  srb_side: {
    id: "srb_side",
    name: "Side Booster Pod",
    shortName: "Side SRB",
    category: "stage",
    dryTonnes: 1.4,
    fuelTonnes: 6.5,
    thrustKn: 400,
    ispSl: 235,
    ispVac: 260,
    heightM: 9.0,
    widthM: 1.3,
    areaM2: 3,
    hardwareCost: 100,
    propellantCost: 105,
    symmetric: true,
    requiredLabLevel: 0,
    note: "Cheap high-TWR radial solid booster",
  },
  chute_mk1: {
    id: "chute_mk1",
    name: "Drogue & Main Chute",
    shortName: "Parachute",
    category: "utility",
    dryTonnes: 0.2,
    fuelTonnes: 0,
    thrustKn: 0,
    ispSl: 0,
    ispVac: 0,
    heightM: 1.0,
    widthM: 1.4,
    areaM2: 2,
    hardwareCost: 60,
    propellantCost: 0,
    symmetric: false,
    requiredLabLevel: 0,
    note: "Atmospheric braking canopy",
  },
  legs_mk1: {
    id: "legs_mk1",
    name: "Landing Legs",
    shortName: "Legs",
    category: "utility",
    dryTonnes: 0.25,
    fuelTonnes: 0,
    thrustKn: 0,
    ispSl: 0,
    ispVac: 0,
    heightM: 1.4,
    widthM: 2.6,
    areaM2: 2,
    hardwareCost: 45,
    propellantCost: 0,
    symmetric: true,
    requiredLabLevel: 0,
    note: "Deployable touchdown struts",
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
    symmetric: false,
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
  /** Optional mount location: center stack or side radial mount/column. */
  mount?: "center" | "side";
  /**
   * Optional parent anchor UID:
   * - For `bracket_side`, `srb_side`, `legs_mk1`: UID of the host tank they attach to.
   * - For parts stacked on a side bracket: UID of the `bracket_side`.
   */
  parentUid?: string;
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
    | "UNFED_ENGINE"
    | "UNUSED_FUEL"
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

export interface TankGroup {
  id: string;
  stage: number;
  tankUids: string[];
  fuelTonnes: number;
  fedEngineUids: string[];
  hasCrossfeed: boolean;
}

export interface FuelTopology {
  tankGroups: TankGroup[];
  tankGroupByUid: Record<string, string>;
  fedEngineUids: Set<string>;
  unfedEngineUids: Set<string>;
  unusedTankGroupIds: Set<string>;
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
  topology: FuelTopology;
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

export function resolvePartMount(item: PlacedPart): "center" | "side" {
  if (item.mount === "center" || item.mount === "side") return item.mount;
  const def = PARTS[item.partId];
  if (item.partId === "bracket_side") return "side";
  if (def?.symmetric && item.symmetry === 2) return "side";
  return "center";
}

export function isBracketChild(item: PlacedPart, partsByUid: Map<string, PlacedPart>): boolean {
  if (resolvePartMount(item) !== "side" || !item.parentUid) return false;
  const parent = partsByUid.get(item.parentUid);
  return parent?.partId === "bracket_side";
}

export function partMultiplier(item: PlacedPart, partsByUid?: Map<string, PlacedPart>): 1 | 2 {
  const def = PARTS[item.partId];
  if (!def) return 1;
  if (resolvePartMount(item) === "side") {
    if (partsByUid && item.parentUid) {
      const parent = partsByUid.get(item.parentUid);
      if (parent?.partId === "bracket_side") return parent.symmetry === 2 ? 2 : 1;
    }
    return item.symmetry === 2 ? 2 : 1;
  }
  return def.symmetric ? item.symmetry : 1;
}

/**
 * Keeps side-bracket children synced with their parent bracket's stage & symmetry,
 * and syncs brackets with their parent centerline tank's stage when attached.
 * Also removes orphaned bracket children if their parent bracket was removed.
 */
export function syncBlueprintHierarchy(parts: PlacedPart[]): PlacedPart[] {
  const byUid = new Map<string, PlacedPart>();
  for (const pt of parts) byUid.set(pt.uid, pt);

  // 1. Sync bracket_side stage to its parent centerline tank if present
  for (const pt of parts) {
    if (pt.partId === "bracket_side") {
      pt.mount = "side";
      if (pt.parentUid) {
        const host = byUid.get(pt.parentUid);
        if (host && resolvePartMount(host) === "center") {
          pt.stage = host.stage;
        } else if (!host) {
          delete pt.parentUid;
        }
      }
    }
  }

  // 2. Sync radial attachments & filter orphaned side-column children
  const valid: PlacedPart[] = [];
  for (const pt of parts) {
    if (pt.mount === "side" && pt.partId !== "bracket_side" && pt.partId !== "srb_side" && pt.partId !== "legs_mk1") {
      const parent = pt.parentUid ? byUid.get(pt.parentUid) : undefined;
      if (!parent || parent.partId !== "bracket_side") {
        // Parent bracket was removed; drop orphaned side-stack part
        continue;
      }
      pt.stage = parent.stage;
      pt.symmetry = parent.symmetry;
    } else if ((pt.partId === "legs_mk1" || pt.partId === "srb_side") && pt.parentUid) {
      const host = byUid.get(pt.parentUid);
      if (host) {
        pt.stage = host.stage;
        if (host.partId === "bracket_side") {
          pt.mount = "side";
          pt.symmetry = host.symmetry;
        }
      } else {
        delete pt.parentUid;
      }
    }
    valid.push(pt);
  }
  return valid;
}

/**
 * Computes contiguous fuel tank pools (including crossfeed across `bracket_side`)
 * and verifies that every liquid engine is placed directly beneath a fuel tank.
 */
export function computeFuelTopology(bp: RocketBlueprint): FuelTopology {
  const byUid = new Map<string, PlacedPart>();
  for (const pt of bp.parts) byUid.set(pt.uid, pt);

  const centerCol: PlacedPart[] = [];
  const brackets: PlacedPart[] = [];
  const sideCols = new Map<string, PlacedPart[]>();

  for (const pt of bp.parts) {
    if (pt.partId === "bracket_side") {
      brackets.push(pt);
      sideCols.set(pt.uid, []);
    } else if (resolvePartMount(pt) === "center") {
      centerCol.push(pt);
    } else if (pt.parentUid && byUid.get(pt.parentUid)?.partId === "bracket_side") {
      const arr = sideCols.get(pt.parentUid);
      if (arr) arr.push(pt);
      else sideCols.set(pt.parentUid, [pt]);
    }
  }

  // Disjoint-set union for tank UIDs
  const dsuParent = new Map<string, string>();
  const find = (u: string): string => {
    let cur = u;
    while (dsuParent.get(cur) !== cur) {
      cur = dsuParent.get(cur)!;
    }
    let walk = u;
    while (dsuParent.get(walk) !== cur) {
      const next = dsuParent.get(walk)!;
      dsuParent.set(walk, cur);
      walk = next;
    }
    return cur;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) dsuParent.set(rb, ra);
  };

  for (const pt of bp.parts) {
    if (PARTS[pt.partId]?.category === "tank") {
      dsuParent.set(pt.uid, pt.uid);
    }
  }

  const fedEngineToTank = new Map<string, string>();
  const fedEngineUids = new Set<string>();
  const unfedEngineUids = new Set<string>();

  const processColumn = (col: PlacedPart[]) => {
    for (let i = 0; i < col.length; i++) {
      const cur = col[i];
      const def = PARTS[cur.partId];
      if (!def) continue;
      if (def.category === "tank" && i > 0) {
        const prev = col[i - 1];
        if (PARTS[prev.partId]?.category === "tank" && prev.stage === cur.stage) {
          union(prev.uid, cur.uid);
        }
      }
      if (def.category === "engine") {
        const prev = i > 0 ? col[i - 1] : undefined;
        if (prev && PARTS[prev.partId]?.category === "tank" && prev.stage === cur.stage) {
          fedEngineUids.add(cur.uid);
          fedEngineToTank.set(cur.uid, prev.uid);
        } else {
          unfedEngineUids.add(cur.uid);
        }
      }
    }
  };

  processColumn(centerCol);
  for (const col of sideCols.values()) {
    processColumn(col);
  }

  // Crossfeed across side brackets: merge side-column tank runs with host centerline tank
  const crossfedRoots = new Set<string>();
  for (const br of brackets) {
    let hostTank: PlacedPart | undefined =
      br.parentUid && PARTS[byUid.get(br.parentUid)?.partId ?? "pod_mk1"]?.category === "tank"
        ? byUid.get(br.parentUid)
        : undefined;
    if (!hostTank) {
      // Fallback: lowest centerline tank in the same stage
      for (let i = centerCol.length - 1; i >= 0; i--) {
        if (centerCol[i].stage === br.stage && PARTS[centerCol[i].partId]?.category === "tank") {
          hostTank = centerCol[i];
          break;
        }
      }
    }
    if (!hostTank || hostTank.stage !== br.stage) continue;
    const col = sideCols.get(br.uid) ?? [];
    for (const child of col) {
      if (PARTS[child.partId]?.category === "tank" && child.stage === hostTank.stage) {
        union(hostTank.uid, child.uid);
        crossfedRoots.add(find(hostTank.uid));
      }
    }
  }

  // Build final TankGroup objects
  const groupMap = new Map<string, TankGroup>();
  const tankGroupByUid: Record<string, string> = {};
  let groupCounter = 0;
  const rootToId = new Map<string, string>();

  for (const pt of bp.parts) {
    const def = PARTS[pt.partId];
    if (!def || def.category !== "tank") continue;
    const root = find(pt.uid);
    let gid = rootToId.get(root);
    if (!gid) {
      gid = `tg_${++groupCounter}`;
      rootToId.set(root, gid);
      groupMap.set(gid, {
        id: gid,
        stage: pt.stage,
        tankUids: [],
        fuelTonnes: 0,
        fedEngineUids: [],
        hasCrossfeed: false,
      });
    }
    const grp = groupMap.get(gid)!;
    const mult = partMultiplier(pt, byUid);
    grp.tankUids.push(pt.uid);
    grp.fuelTonnes += def.fuelTonnes * mult;
    tankGroupByUid[pt.uid] = gid;
  }

  for (const root of crossfedRoots) {
    const finalRoot = find(root);
    const gid = rootToId.get(finalRoot);
    if (gid && groupMap.has(gid)) {
      groupMap.get(gid)!.hasCrossfeed = true;
    }
  }

  for (const [engUid, tankUid] of fedEngineToTank.entries()) {
    const gid = tankGroupByUid[tankUid];
    if (gid && groupMap.has(gid)) {
      groupMap.get(gid)!.fedEngineUids.push(engUid);
    }
  }

  const tankGroups = [...groupMap.values()];
  const unusedTankGroupIds = new Set<string>();
  for (const grp of tankGroups) {
    if (grp.fuelTonnes > 0 && grp.fedEngineUids.length === 0) {
      unusedTankGroupIds.add(grp.id);
    }
  }

  return {
    tankGroups,
    tankGroupByUid,
    fedEngineUids,
    unfedEngineUids,
    unusedTankGroupIds,
  };
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
  const byUid = new Map<string, PlacedPart>();
  for (const item of bp.parts) byUid.set(item.uid, item);

  const topology = computeFuelTopology(bp);

  let partCount = 0;
  let dryTonnes = 0;
  let fuelTonnes = 0;
  let centerHeight = 0;
  let rawHardware = 0;
  let propellantCost = 0;
  let hasPod = false;

  const sideHeights = new Map<string, number>();
  const stageIndices = new Set<number>();

  for (const item of bp.parts) {
    const def = PARTS[item.partId];
    if (!def) continue;
    const mult = partMultiplier(item, byUid);
    const mount = resolvePartMount(item);
    partCount += mult;
    dryTonnes += def.dryTonnes * mult;
    fuelTonnes += def.fuelTonnes * mult;
    if (mount === "center") {
      centerHeight += def.heightM;
    } else if (item.parentUid && byUid.get(item.parentUid)?.partId === "bracket_side") {
      sideHeights.set(item.parentUid, (sideHeights.get(item.parentUid) ?? 0) + def.heightM);
    }
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
    if (topology.unfedEngineUids.has(item.uid)) {
      warnings.push({
        code: "UNFED_ENGINE",
        severity: "error",
        message: `${def.shortName} must be placed directly under a fuel tank.`,
      });
    }
    stageIndices.add(item.stage);
  }

  let heightMeters = centerHeight;
  for (const sh of sideHeights.values()) {
    heightMeters = Math.max(heightMeters, sh);
  }

  if (topology.unusedTankGroupIds.size > 0) {
    warnings.push({
      code: "UNUSED_FUEL",
      severity: "warn",
      message: "Fuel tank has no engine directly beneath it.",
    });
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
    let stTotalFuel = 0;
    let stUsableFuel = 0;
    let stThrust = 0;
    let flowSl = 0;
    let flowVac = 0;
    let areaM2 = 4;

    // Track which tank groups in this stage actually have a fed engine
    const fedGroupsInStage = new Set<string>();
    for (const grp of topology.tankGroups) {
      if (grp.stage === st && grp.fedEngineUids.length > 0) {
        fedGroupsInStage.add(grp.id);
      }
    }

    for (const item of items) {
      const def = PARTS[item.partId];
      if (!def) continue;
      const mult = partMultiplier(item, byUid);
      stDry += def.dryTonnes * mult;
      const itemFuel = def.fuelTonnes * mult;
      stTotalFuel += itemFuel;

      if (def.category === "tank") {
        const gid = topology.tankGroupByUid[item.uid];
        if (gid && fedGroupsInStage.has(gid)) {
          stUsableFuel += itemFuel;
        }
      } else if (itemFuel > 0) {
        // Self-contained solid booster fuel
        stUsableFuel += itemFuel;
      }

      const isFedEngine =
        def.category !== "engine" || topology.fedEngineUids.has(item.uid);
      if (def.thrustKn > 0 && isFedEngine) {
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
        const mult = partMultiplier(item, byUid);
        upperWet += (def.dryTonnes + def.fuelTonnes) * mult;
      }
    }

    const wetAtStart = upperWet + stDry + stTotalFuel;
    const dryAtEnd = wetAtStart - stUsableFuel;
    const ispSl = flowSl > 0 ? stThrust / flowSl : 0;
    const ispVac = flowVac > 0 ? stThrust / flowVac : 0;
    const twr = wetAtStart > 0 ? stThrust / (wetAtStart * G0) : 0;
    const effectiveIsp = st === 0 ? ispSl : ispVac;
    const dv =
      stThrust > 0 && stUsableFuel > 0 && wetAtStart > dryAtEnd && dryAtEnd > 0
        ? effectiveIsp * G0 * Math.log(wetAtStart / dryAtEnd)
        : 0;
    totalDeltaV += dv;

    stages.push({
      stage: st,
      dryTonnes: stDry + (stTotalFuel - stUsableFuel),
      fuelTonnes: stUsableFuel,
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
      message: "Stage 1 needs a fueled engine to lift off.",
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
      w.code === "UNFED_ENGINE" ||
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
    topology,
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
        isp: Math.max(220, Math.round(s0.ispSl || s0.ispVac || 305)),
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
        thrust: Math.max(0, Math.round(s1.thrustKn * 1000)),
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
