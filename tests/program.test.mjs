import test from "node:test";
import assert from "node:assert/strict";
import { fresh, validate } from "../src/persistence/save.ts";
import { initial, step, stage } from "../src/sim/flight.ts";
import {
  STARTER_KINDS,
  startProgram,
  getStorageCaps,
  getCollectorCaps,
  getCreditRatePerHour,
  getPropellantRatePerHour,
  advanceEconomyClock,
  applyOfflineProgress,
  collectResource,
  collectFromBuilding,
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

test("collectors fill local hoppers strictly to cap and transfer only on tap-to-collect", () => {
  const p = startProgram();
  assert.deepEqual(getStorageCaps(p), {
    credits: 5000,
    propellant: 1000,
    activeContracts: 1,
  });
  assert.deepEqual(getCollectorCaps(p), {
    credits: 450,
    propellant: 350,
  });
  assert.equal(getCreditRatePerHour(p), 180);
  assert.equal(getPropellantRatePerHour(p), 140);

  // Half hour fills hoppers only (wallet unchanged until tapped!)
  const afterHalfHour = advanceEconomyClock(p, 1800);
  assert.equal(p.collectors.credits, 0);
  assert.equal(afterHalfHour.collectors.credits, 90);
  assert.equal(afterHalfHour.collectors.propellant, 70);
  assert.equal(afterHalfHour.credits, 600);
  assert.equal(afterHalfHour.propellant, 900);

  // 30-day warp caps strictly at local hopper limits (450 C / 350 Prop)
  const after30Days = advanceEconomyClock(p, 30 * 86400);
  assert.equal(after30Days.collectors.credits, 450);
  assert.equal(after30Days.collectors.propellant, 350);
  assert.equal(after30Days.credits, 600);
  assert.equal(after30Days.propellant, 900);

  // Tap Solar Foundry -> transfers 450 C into wallet (600 -> 1,050)
  const cTap = collectResource(after30Days, "credits");
  assert.equal(cTap.collected, 450);
  assert.equal(cTap.state.credits, 1050);
  assert.equal(cTap.state.collectors.credits, 0);

  // Tap Refinery when tanks have only 100 room -> transfers 100, leaves 250 in hopper
  const pTap = collectResource(cTap.state, "propellant");
  assert.equal(pTap.collected, 100);
  assert.equal(pTap.state.propellant, 1000);
  assert.equal(pTap.state.collectors.propellant, 250);

  // Negative or NaN dt cannot corrupt stock
  assert.equal(advanceEconomyClock(p, -500).collectors.credits, 0);
  assert.equal(advanceEconomyClock(p, Number.NaN).collectors.propellant, 0);
});

test("offline wall-clock progress fills hoppers up to cap while browser is closed", () => {
  const p = startProgram();
  p.lastRealTimestampMs = 1_000_000;
  // 1 hour away -> +180 C, +140 Prop in hoppers
  const oneHr = applyOfflineProgress(p, 1_000_000 + 3600 * 1000);
  assert.equal(oneHr.creditsAdded, 180);
  assert.equal(oneHr.propellantAdded, 140);
  assert.equal(oneHr.state.credits, 600); // still in hopper until tapped!
  assert.equal(oneHr.state.collectors.credits, 180);

  // 10 days away -> strictly capped at Lv 1 hopper limits (450 C / 350 Prop)
  const tenDays = applyOfflineProgress(p, 1_000_000 + 10 * 86400 * 1000);
  assert.equal(tenDays.state.collectors.credits, 450);
  assert.equal(tenDays.state.collectors.propellant, 350);
});

test("free simulation mode is strictly zero-cost and zero-payout", () => {
  const p = startProgram();
  const f = fly(p, "practice");
  assert.ok(f.orbitEarned);
  assert.equal(p.credits, 600);
  assert.equal(p.propellant, 900);
  assert.equal(p.research, 0);
});

test("real launch deducts hardware + propellant, first-orbit milestone awards once, failure loses cost", () => {
  const p = startProgram();
  const f = fly(p, "orbit");
  assert.ok(f.orbitEarned);
  assert.equal(p.credits, 2900);
  assert.equal(p.propellant, 150);
  assert.equal(p.research, 35);
  assert.equal(p.milestones.firstOrbit, true);

  const saved = validate({ ...fresh(), program: p, flight: f });
  assert.equal(settle(saved.program, saved.flight), "");

  p.propellant = 800;
  const doomed = prepare(p, "hop");
  assert.equal(payLaunch(p), "");
  doomed.status = "lost";
  assert.equal(settle(p, doomed), "");
  assert.equal(p.credits, 2600);
  assert.equal(p.propellant, 400);
});

test("anti-softlock guarantee: zero credits and zero propellant can still fly Atmospheric Sounding", () => {
  const p = startProgram();
  p.credits = 0;
  p.propellant = 0;
  assert.equal(launchIssue(p, "sounding"), "");
  const check = canLaunchVehicle(p, contractVehicle(p, "sounding"));
  assert.equal(check.ok, true);
  assert.equal(check.emergencyFuelUsed, 150);
  const f = fly(p, "sounding");
  assert.ok(f.maxAlt >= 15000);
  assert.equal(p.credits, 450);
  assert.equal(p.research, 5);
});

test("Mission Control gating, Solar Foundry & Cryo Tank upgrades, and Tier 2 contracts", () => {
  const p = startProgram();
  assert.equal(canAffordUpgrade(p, "foundry").ok, false);
  assert.match(canAffordUpgrade(p, "foundry").reason, /Mission Control Lv 2/);

  fly(p, "orbit");
  fly(p, "sounding");
  assert.equal(upgrade(p, "command"), "");
  assert.equal(level(p, "command"), 2);

  // Upgrade Cryo Tanks (1,000 C) -> cap 2,800
  assert.equal(upgrade(p, "tanks"), "");
  assert.equal(getStorageCaps(p).propellant, 2800);

  // Upgrade Solar Foundry (850 C) -> rate 420 C/hr, hopper 1,100
  p.credits = 2000;
  assert.equal(upgrade(p, "foundry"), "");
  assert.equal(getCreditRatePerHour(p), 420);
  assert.equal(getCollectorCaps(p).credits, 1100);

  // Tap collect from Solar Foundry works in-place
  p.collectors.credits = 250;
  const tap = collectFromBuilding(p, "foundry");
  assert.equal(tap.collected, 250);
  assert.equal(p.collectors.credits, 0);

  // Upgrade Launchpad -> 90 t, fill propellant, unlock Tier 2 relay
  p.credits = 2000;
  assert.equal(upgrade(p, "pad"), "");
  assert.equal(padCaps(level(p, "pad")).tonnes, 90);
  p.credits = 1500;
  p.propellant = 1400;
  assert.equal(launchIssue(p, "relay"), "");
});

test("v1, v2, and v4 saves migrate deterministically to v5 with Solar Foundry and hoppers", () => {
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
  assert.equal(m1.version, 5);
  assert.ok(STARTER_KINDS.every((k) => level(m1.program, k) === 1));
  assert.deepEqual(validate(m1), m1);

  const rawV4 = structuredClone(fresh());
  rawV4.version = 4;
  rawV4.program.buildings = rawV4.program.buildings.filter(
    (b) => b.kind !== "foundry",
  );
  delete rawV4.program.collectors;
  delete rawV4.program.lastRealTimestampMs;
  const m4 = validate(rawV4);
  assert.equal(m4.version, 5);
  assert.equal(level(m4.program, "foundry"), 1);
  assert.deepEqual(m4.program.collectors, { credits: 0, propellant: 0 });
  assert.deepEqual(validate(m4), m4);
});

test("program validator rejects negative stock, over-cap resources, and over-cap hoppers", () => {
  for (const edit of [
    (p) => (p.credits = -1),
    (p) => (p.credits = 99999),
    (p) => (p.propellant = -5),
    (p) => (p.propellant = 5000),
    (p) => (p.collectors.credits = 9999),
    (p) => (p.collectors.propellant = -1),
    (p) => (p.research = 1.5),
    (p) => (p.simTimeSec = Infinity),
    (p) => p.buildings.push({ ...p.buildings[0] }),
  ]) {
    const m = fresh();
    edit(m.program);
    assert.throws(() => validate(m));
  }
});
