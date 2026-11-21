import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeBlueprint,
  starterBlueprints,
} from "../src/program/workshop.ts";
import {
  getFacilityLimits,
  place,
  prepareBlueprintFlight,
  startProgram,
  upgrade,
} from "../src/program/program.ts";
import { fresh, validate } from "../src/persistence/save.ts";
import { mass, step, thrustToWeight } from "../src/sim/flight.ts";

test("starter blueprints pass validation and fly as distinct constructed vehicle instances", () => {
  const p = startProgram();
  const limits = getFacilityLimits(p);
  const [orbiter, arrow] = p.blueprints;

  const a1 = analyzeBlueprint(orbiter, limits);
  const a2 = analyzeBlueprint(arrow, limits);
  assert.equal(a1.canSimulate, true);
  assert.equal(a1.canLaunchWithLimits, true);
  assert.equal(a2.canSimulate, true);
  assert.equal(a2.canLaunchWithLimits, true);
  assert.ok(a1.wetTonnes > a2.wetTonnes);
  assert.ok(a1.totalDeltaV > a2.totalDeltaV);
  assert.ok(a1.liftoffTwr > 1.0);
  assert.ok(a2.liftoffTwr > 1.0);

  // Free simulation costs 0 C / 0 Prop
  const sim = prepareBlueprintFlight(p, arrow.id, "practice");
  assert.equal(sim.error, "");
  assert.equal(p.credits, 600);
  assert.equal(p.propellant, 900);
  assert.ok(sim.flight);
  assert.equal(sim.flight.vehicleName, "Sounding Arrow");

  // Real launch of Pioneer Orbital deducts Credits + Propellant and constructs distinct stages
  p.credits = 1000;
  p.propellant = 900;
  const real = prepareBlueprintFlight(p, orbiter.id, "real");
  assert.equal(real.error, "");
  assert.ok(real.flight);
  assert.equal(p.credits, 1000 - a1.hardwareCost);
  assert.equal(p.propellant, 900 - a1.propellantCost);
  assert.ok(mass(real.flight) > mass(sim.flight));
  assert.ok(thrustToWeight(real.flight) > 1);
  real.flight.status = "flying";
  step(real.flight);
  assert.ok(real.flight.t > 0);
});

test("pre-launch validation flags missing pod, low TWR, disconnected stage, and facility limits", () => {
  const p = startProgram();
  const limits = getFacilityLimits(p);

  // Missing command pod + disconnected stage (stage 0 and stage 2)
  const broken = {
    id: "bp_broken",
    name: "Broken",
    version: 1,
    parts: [
      { uid: "1", partId: "tank_m", stage: 0, symmetry: 1 },
      { uid: "2", partId: "eng_dart", stage: 0, symmetry: 1 },
      { uid: "3", partId: "tank_s", stage: 2, symmetry: 1 },
    ],
  };
  const res = analyzeBlueprint(broken, limits);
  const codes = new Set(res.warnings.map((w) => w.code));
  assert.ok(codes.has("NO_POD"));
  assert.ok(codes.has("LOW_TWR"));
  assert.ok(codes.has("DISCONNECTED_STAGE"));
  assert.equal(res.canSimulate, false);

  // Over Launchpad Lv 1 35 t mass limit + Research Lab locked part
  const heavy = {
    id: "bp_heavy",
    name: "Heavy",
    version: 1,
    parts: [
      { uid: "1", partId: "pod_mk1", stage: 0, symmetry: 1 },
      { uid: "2", partId: "tank_l", stage: 0, symmetry: 1 },
      { uid: "3", partId: "eng_titan", stage: 0, symmetry: 1 },
    ],
  };
  const hRes = analyzeBlueprint(heavy, limits);
  const hCodes = new Set(hRes.warnings.map((w) => w.code));
  assert.ok(hCodes.has("OVER_MASS"));
  assert.ok(hCodes.has("LOCKED_PART"));

  // Upgrading MC Lv 2 + Pad Lv 2 + Lab Lv 1 + VAB Lv 2 lifts limits and applies -5% discount
  p.credits = 5000;
  p.research = 100;
  assert.equal(upgrade(p, "command"), "");
  assert.equal(upgrade(p, "pad"), "");
  p.credits = 10000;
  assert.equal(place(p, "lab", 2, 1), "");
  assert.equal(place(p, "vab", 3, 5), "");
  assert.equal(upgrade(p, "vab"), "");
  const upgradedRes = analyzeBlueprint(heavy, getFacilityLimits(p));
  assert.equal(upgradedRes.warnings.length, 0);
  assert.equal(upgradedRes.canLaunchWithLimits, true);
  const rawCost = 120 + 260 + 320;
  assert.equal(upgradedRes.hardwareCost, Math.round(rawCost * 0.95));
});

test("mirror symmetry doubles radial booster mass, thrust, part count, and cost", () => {
  const p = startProgram();
  const base = starterBlueprints()[1];
  const single = {
    ...base,
    parts: [...base.parts, { uid: "r1", partId: "srb_side", stage: 0, symmetry: 1 }],
  };
  const twin = {
    ...base,
    parts: [...base.parts, { uid: "r1", partId: "srb_side", stage: 0, symmetry: 2 }],
  };
  const limits = getFacilityLimits(p);
  const a1 = analyzeBlueprint(single, limits);
  const a2 = analyzeBlueprint(twin, limits);
  assert.equal(a2.partCount, a1.partCount + 1);
  assert.ok(a2.wetTonnes > a1.wetTonnes);
  assert.ok(a2.stages[0].thrustKn > a1.stages[0].thrustKn);
});

test("v3 saves migrate deterministically to v4 with starter blueprints", () => {
  const f = fresh();
  const rawV3 = {
    ...structuredClone(f),
    version: 3,
  };
  delete rawV3.program.blueprints;
  delete rawV3.program.activeBlueprintId;
  const migrated = validate(rawV3);
  assert.equal(migrated.version, 4);
  assert.equal(migrated.program.blueprints.length, 2);
  assert.equal(migrated.program.activeBlueprintId, "bp_pioneer_orbiter");
  assert.deepEqual(validate(migrated), migrated);
});
