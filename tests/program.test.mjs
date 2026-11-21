import test from "node:test";
import assert from "node:assert/strict";
import { fresh, validate } from "../src/persistence/save.ts";
import { initial, step, stage } from "../src/sim/flight.ts";
import {
  STARTER_KINDS,
  startProgram,
  getStorageCaps,
  getPropellantRatePerHour,
  advanceEconomyClock,
  canAffordUpgrade,
  canLaunchVehicle,
  applyContractReward,
  contractVehicle,
  payLaunch,
  prepare,
  launchIssue,
  upgrade,
  place,
  quote,
  settle,
  padCaps,
  level,
} from "../src/program/program.ts";

function fly(p, job) {
  const f = prepare(p, job);
  assert.equal(payLaunch(p), "");
  f.status = "flying";
  for (let i = 0; i < 8000; i++) {
    step(f);
    if (!f.stage && !f.fuel[0]) stage(f);
    if (settle(p, f)) break;
    if (job === "orbit" && f.orbitEarned && !f.throttle) break;
  }
  return f;
}

test("unified simulation clock trickles propellant strictly to hard cap and never prints credits", () => {
  const p = startProgram();
  assert.deepEqual(getStorageCaps(p), {
    credits: 5000,
    propellant: 1000,
    activeContracts: 1,
  });
  assert.equal(getPropellantRatePerHour(p), 120);

  p.propellant = 200;
  const afterHalfHour = advanceEconomyClock(p, 1800);
  assert.equal(p.propellant, 200);
  assert.equal(afterHalfHour.propellant, 260);
  assert.equal(afterHalfHour.credits, p.credits);
  assert.equal(afterHalfHour.simTimeSec, 1800);

  // 30-day warp fills tanks to 100% cap and never exceeds it or prints credits
  const after30Days = advanceEconomyClock(p, 30 * 86400);
  assert.equal(after30Days.propellant, 1000);
  assert.equal(after30Days.credits, p.credits);
  assert.equal(after30Days.research, p.research);

  // Negative or NaN dt cannot corrupt stock
  const safeNeg = advanceEconomyClock(p, -500);
  assert.equal(safeNeg.propellant, 200);
  const safeNaN = advanceEconomyClock(p, Number.NaN);
  assert.equal(safeNaN.propellant, 200);
});

test("free simulation mode is strictly zero-cost and zero-payout", () => {
  const p = startProgram();
  const beforeC = p.credits;
  const beforeP = p.propellant;
  const beforeR = p.research;
  const f = fly(p, "practice");
  assert.ok(f.orbitEarned);
  assert.equal(p.credits, beforeC);
  assert.equal(p.propellant, beforeP);
  assert.equal(p.research, beforeR);
  assert.equal(p.paid, false);
  assert.equal(p.rewarded, false);
});

test("real launch deducts hardware + propellant, first-orbit milestone awards once, failure loses cost", () => {
  const p = startProgram();
  const f = fly(p, "orbit");
  assert.ok(f.orbitEarned);
  // Started 600 C / 900 Prop -> spent 500 C / 750 Prop -> earned 1800 + 1000 1st time = 2900 C, 35 RD
  assert.equal(p.credits, 2900);
  assert.equal(p.propellant, 150);
  assert.equal(p.research, 35);
  assert.equal(p.milestones.firstOrbit, true);
  assert.equal(p.completed.orbit, 1);

  // One-time settlement survives save/load
  const saved = validate({ ...fresh(), program: p, flight: f });
  assert.equal(settle(saved.program, saved.flight), "");

  // Failed real launch loses spent hardware and propellant
  p.propellant = 800;
  const doomed = prepare(p, "hop");
  assert.equal(payLaunch(p), "");
  assert.equal(p.credits, 2600);
  assert.equal(p.propellant, 400);
  doomed.status = "lost";
  assert.equal(settle(p, doomed), "");
  assert.equal(p.credits, 2600);
  assert.equal(p.propellant, 400);
});

test("anti-softlock guarantee: zero credits and zero propellant can still fly Atmospheric Sounding", () => {
  const p = startProgram();
  p.credits = 0;
  p.propellant = 0;

  assert.ok(launchIssue(p, "hop"));
  assert.ok(launchIssue(p, "orbit"));
  assert.equal(launchIssue(p, "sounding"), "");

  const check = canLaunchVehicle(p, contractVehicle(p, "sounding"));
  assert.equal(check.ok, true);
  assert.equal(check.hardwareCost, 0);
  assert.equal(check.emergencyFuelUsed, 150);

  const f = fly(p, "sounding");
  assert.ok(f.maxAlt >= 45000);
  assert.equal(p.credits, 450);
  assert.equal(p.propellant, 0);
  assert.equal(p.research, 5);
  assert.equal(p.completed.sounding, 1);
});

test("Mission Control gating, Cryo Tank Farm upgrade, Launchpad caps, and Tier 2 contracts", () => {
  const p = startProgram();
  assert.equal(canAffordUpgrade(p, "tanks").ok, false);
  assert.match(canAffordUpgrade(p, "tanks").reason, /Mission Control Lv 2/);
  assert.equal(canAffordUpgrade(p, "vab").ok, false);
  assert.match(canAffordUpgrade(p, "vab").reason, /Mission Control Lv 2/);
  assert.match(launchIssue(p, "relay"), /Mission Control Lv 2/);

  // Fly First Orbit + Sounding -> 3,350 C and 40 RD
  fly(p, "orbit");
  fly(p, "sounding");
  assert.equal(p.credits, 3350);
  assert.equal(p.research, 40);

  // Upgrade Mission Control to Lv 2 (2,200 C + 40 RD)
  assert.equal(canAffordUpgrade(p, "command").ok, true);
  assert.equal(upgrade(p, "command"), "");
  assert.equal(level(p, "command"), 2);
  assert.equal(p.credits, 1150);
  assert.equal(p.research, 0);

  // Upgrade Cryo Tank Farm to Lv 2 (1,000 C) -> cap jumps from 1,000 to 2,800
  assert.equal(upgrade(p, "tanks"), "");
  assert.equal(level(p, "tanks"), 2);
  assert.equal(getStorageCaps(p).propellant, 2800);

  // Tier 2 contract still blocked by Launchpad Lv 1 (35 t limit vs 68 t relay)
  assert.match(launchIssue(p, "relay"), /35 t limit/);
  p.credits = 2000;
  assert.equal(upgrade(p, "pad"), "");
  assert.equal(padCaps(level(p, "pad")).tonnes, 90);

  // With enough Credits, still blocked until tanks hold 1,400 Prop
  p.credits = 1500;
  p.propellant = 1000;
  assert.match(launchIssue(p, "relay"), /Propellant/);
  const fueled = advanceEconomyClock(p, 10 * 3600);
  p.propellant = fueled.propellant;
  assert.equal(launchIssue(p, "relay"), "");

  // Build VAB Lv 1 & upgrade to Lv 2 -> -5% hardware discount
  p.credits = 5000;
  assert.equal(place(p, "vab", 3, 5), "");
  assert.equal(upgrade(p, "vab"), "");
  assert.equal(quote(p, "relay").hardwareCost, Math.round(900 * 0.95));
});

test("applyContractReward clamps credits to Contract Office cap without overflow", () => {
  const p = startProgram();
  p.credits = 4800; // Office Lv 1 cap is 5,000
  const res = applyContractReward(p, "orbit");
  assert.equal(res.state.credits, 5000);
  assert.equal(res.creditsAwarded, 200);
  assert.equal(res.researchAwarded, 35);
  assert.equal(p.credits, 4800);
});

test("v1 and v2 saves migrate deterministically to v3 with all starter facilities and propellant", () => {
  const f1 = initial();
  f1.status = "flying";
  step(f1);
  const rawV1 = {
    version: 1,
    revision: 3,
    view: "map",
    flight: { ...f1 },
    log: [],
  };
  delete rawV1.flight.cargo;
  const m1 = validate(rawV1);
  assert.equal(m1.version, 4);
  assert.equal(m1.program.simTimeSec, f1.t);
  assert.equal(m1.program.propellant, 900);
  assert.equal(m1.program.sortie, "practice");
  assert.ok(STARTER_KINDS.every((k) => level(m1.program, k) === 1));
  assert.deepEqual(validate(m1), m1);

  const rawV2 = {
    version: 2,
    revision: 12,
    view: "site",
    flight: initial(),
    log: [{ t: 0, text: "Pioneer 01 cleared for flight." }],
    program: {
      credits: 420,
      research: 14,
      elapsed: 3600,
      buildings: [
        { kind: "command", x: 2, y: 3, level: 2 },
        { kind: "pad", x: 5, y: 3, level: 2 },
        { kind: "fuel", x: 4, y: 1, level: 1 },
        { kind: "lab", x: 2, y: 1, level: 1 },
      ],
      completed: { hop: 2, orbit: 1, polar: 0 },
      award: null,
      sortie: "practice",
      paid: false,
      rewarded: false,
      inclination: 0,
    },
  };
  const m2 = validate(rawV2);
  assert.equal(m2.version, 4);
  assert.equal(m2.program.credits, 420);
  assert.equal(m2.program.research, 14);
  assert.equal(m2.program.simTimeSec, 3600);
  assert.equal(m2.program.propellant, 900);
  assert.equal(level(m2.program, "command"), 2);
  assert.equal(level(m2.program, "pad"), 2);
  assert.equal(level(m2.program, "tanks"), 1);
  assert.equal(level(m2.program, "lab"), 1);
  assert.equal(level(m2.program, "refinery"), 1);
  assert.equal(level(m2.program, "office"), 1);
  assert.equal(m2.program.completed.hop, 2);
  assert.equal(m2.program.completed.orbit, 1);
  assert.equal(m2.program.milestones.firstOrbit, true);
  assert.deepEqual(validate(m2), m2);
});

test("program validator rejects negative stock, over-cap resources, and malformed state", () => {
  for (const edit of [
    (p) => (p.credits = -1),
    (p) => (p.credits = 99999),
    (p) => (p.propellant = -5),
    (p) => (p.propellant = 5000),
    (p) => (p.propellant = Number.NaN),
    (p) => (p.research = 1.5),
    (p) => (p.simTimeSec = Infinity),
    (p) => p.buildings.push({ ...p.buildings[0] }),
    (p) => (p.buildings[0].x = 50),
    (p) => (p.sortie = "ghost"),
    (p) => (p.paid = true),
    (p) => (p.completed.hop = -1),
  ]) {
    const m = fresh();
    edit(m.program);
    assert.throws(() => validate(m));
  }
});
