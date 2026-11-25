import test from "node:test";
import assert from "node:assert/strict";
import {
  PARTS,
  analyzeBlueprint,
  buildVehicleInstance,
  computeFuelTopology,
  starterBlueprints,
  syncBlueprintHierarchy,
} from "../src/program/workshop.ts";
import {
  hasActivePart,
  initial,
  stage,
  toggleLegs,
} from "../src/sim/flight.ts";

const LV1_LIMITS = {
  maxMassTonnes: 90,
  maxHeightMeters: 56,
  maxParts: 24,
  maxStages: 3,
  hardwareDiscount: 0,
  maxPropellantCap: 2200,
  labLevel: 1,
};

test("starter blueprints pass validation with balanced stats", () => {
  for (const bp of starterBlueprints()) {
    const a = analyzeBlueprint(bp, LV1_LIMITS);
    assert.equal(a.canSimulate, true, `${bp.name} should be simulatable`);
    assert.equal(a.canLaunchWithLimits, true, `${bp.name} should launch within limits`);
    assert.ok(a.liftoffTwr > 1.2, `${bp.name} should have healthy liftoff TWR`);
  }
});

test("cryo fuel tanks use linear 20 P/t propellant pricing", () => {
  for (const id of ["tank_s", "tank_m", "tank_l"]) {
    const def = PARTS[id];
    assert.equal(
      def.propellantCost / def.fuelTonnes,
      20,
      `${id} should cost 20 Propellant per tonne of fuel`,
    );
  }
});

test("landing legs on stage 0 cannot deploy after staging to stage 1", () => {
  const bp = {
    id: "bp_legs_s0",
    name: "Booster Legs",
    version: 1,
    parts: [
      { uid: "p1", partId: "pod_mk1", stage: 1, symmetry: 1 },
      { uid: "p2", partId: "tank_s", stage: 1, symmetry: 1 },
      { uid: "p3", partId: "eng_dart", stage: 1, symmetry: 1 },
      { uid: "p4", partId: "decoupler", stage: 0, symmetry: 1 },
      { uid: "p5", partId: "tank_m", stage: 0, symmetry: 1 },
      { uid: "p6", partId: "eng_kestrel", stage: 0, symmetry: 1 },
      { uid: "p7", partId: "legs_mk1", stage: 0, symmetry: 2, mount: "side", parentUid: "p5" },
    ],
  };
  const a = analyzeBlueprint(bp, LV1_LIMITS);
  const inst = buildVehicleInstance(bp, a);
  const f = initial(inst.stages, inst.payloadDryKg, inst.name, bp.parts);
  f.status = "flying";

  assert.equal(hasActivePart(f, "legs_mk1"), true);
  assert.equal(toggleLegs(f), true);
  assert.equal(f.legsDeployed, true);

  assert.equal(stage(f), true);
  assert.equal(f.stage, 1);
  assert.equal(f.hasLegs, false);
  assert.equal(f.legsDeployed, false);
  assert.equal(hasActivePart(f, "legs_mk1"), false);
  assert.equal(toggleLegs(f), false);
});

test("landing legs on stage 1 remain deployable after staging", () => {
  const bp = {
    id: "bp_legs_s1",
    name: "Lander Legs",
    version: 1,
    parts: [
      { uid: "p1", partId: "pod_mk1", stage: 1, symmetry: 1 },
      { uid: "p2", partId: "tank_s", stage: 1, symmetry: 1 },
      { uid: "p3", partId: "eng_dart", stage: 1, symmetry: 1 },
      { uid: "p4", partId: "legs_mk1", stage: 1, symmetry: 2, mount: "side", parentUid: "p2" },
      { uid: "p5", partId: "decoupler", stage: 0, symmetry: 1 },
      { uid: "p6", partId: "tank_m", stage: 0, symmetry: 1 },
      { uid: "p7", partId: "eng_kestrel", stage: 0, symmetry: 1 },
    ],
  };
  const a = analyzeBlueprint(bp, LV1_LIMITS);
  const inst = buildVehicleInstance(bp, a);
  const f = initial(inst.stages, inst.payloadDryKg, inst.name, bp.parts);
  f.status = "flying";

  assert.equal(stage(f), true);
  assert.equal(f.hasLegs, true);
  assert.equal(toggleLegs(f), true);
  assert.equal(f.legsDeployed, true);
});

test("liquid engines must sit directly under a fuel tank to produce thrust", () => {
  const unfedBp = {
    id: "bp_unfed",
    name: "Unfed Engine",
    version: 1,
    parts: [
      { uid: "p1", partId: "pod_probe", stage: 0, symmetry: 1 },
      { uid: "p2", partId: "eng_kestrel", stage: 0, symmetry: 1 },
      { uid: "p3", partId: "tank_s", stage: 0, symmetry: 1 },
    ],
  };
  const a = analyzeBlueprint(unfedBp, LV1_LIMITS);
  assert.equal(a.canSimulate, false);
  assert.ok(a.warnings.some((w) => w.code === "UNFED_ENGINE"));
  assert.equal(a.stages[0].thrustKn, 0);
  assert.equal(a.topology.unfedEngineUids.has("p2"), true);
});

test("contiguous vertical tanks and side-bracket tanks share one fuel pool", () => {
  const bp = {
    id: "bp_heavy_2d",
    name: "Heavy Bracket Lifter",
    version: 1,
    parts: [
      { uid: "p1", partId: "pod_mk1", stage: 0, symmetry: 1 },
      { uid: "t1", partId: "tank_s", stage: 0, symmetry: 1 },
      { uid: "t2", partId: "tank_m", stage: 0, symmetry: 1 },
      { uid: "e1", partId: "eng_kestrel", stage: 0, symmetry: 1 },
      { uid: "br1", partId: "bracket_side", stage: 0, symmetry: 2, mount: "side", parentUid: "t2" },
      { uid: "st1", partId: "tank_s", stage: 0, symmetry: 2, mount: "side", parentUid: "br1" },
      { uid: "se1", partId: "eng_kestrel", stage: 0, symmetry: 2, mount: "side", parentUid: "br1" },
    ],
  };
  const topo = computeFuelTopology(bp);
  assert.equal(topo.tankGroups.length, 1);
  assert.equal(topo.tankGroups[0].hasCrossfeed, true);
  // 6t + 16t + 2 * 6t = 34t shared fuel pool
  assert.equal(topo.tankGroups[0].fuelTonnes, 34);
  assert.equal(topo.fedEngineUids.has("e1"), true);
  assert.equal(topo.fedEngineUids.has("se1"), true);

  const a = analyzeBlueprint(bp, LV1_LIMITS);
  assert.equal(a.canSimulate, true);
  // Core Kestrel (480) + 2x Side Kestrel (960) = 1440 kN
  assert.equal(a.stages[0].thrustKn, 1440);
  assert.equal(a.stages[0].fuelTonnes, 34);
});

test("syncBlueprintHierarchy keeps side-bracket children synced and cleans orphans", () => {
  const parts = [
    { uid: "t1", partId: "tank_m", stage: 1, symmetry: 1 },
    { uid: "br1", partId: "bracket_side", stage: 0, symmetry: 2, mount: "side", parentUid: "t1" },
    { uid: "st1", partId: "tank_s", stage: 0, symmetry: 1, mount: "side", parentUid: "br1" },
    { uid: "orphan", partId: "tank_s", stage: 0, symmetry: 2, mount: "side", parentUid: "missing_br" },
  ];
  const synced = syncBlueprintHierarchy(parts);
  assert.equal(synced.length, 3);
  assert.equal(synced.find((x) => x.uid === "br1")?.stage, 1);
  assert.equal(synced.find((x) => x.uid === "st1")?.stage, 1);
  assert.equal(synced.find((x) => x.uid === "st1")?.symmetry, 2);
});
