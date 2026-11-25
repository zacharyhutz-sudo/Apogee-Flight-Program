import test from "node:test";
import assert from "node:assert/strict";
import { fresh, validate } from "../src/persistence/save.ts";
import {
  PILOT_CATALOG,
  PILOT_PULL_COST,
  abandonActivePilot,
  assignPilotDuty,
  crewDutyBonus,
  ensureCrew,
  getCreditRatePerHour,
  payLaunch,
  pilotRecoveryFee,
  pilotStats,
  prepareContractBlueprint,
  pullPilotCard,
  recoverStrandedPilot,
  resolvePilotFlightOutcome,
  settle,
} from "../src/program/program.ts";

test("pilot catalog has 40 unique pilots across 5 rarities and pity guarantees Rare+ and Legendary", () => {
  assert.equal(PILOT_CATALOG.length, 40);
  const p = fresh().program;
  p.credits = PILOT_PULL_COST * 30;
  // Always return 0.99 (worst roll) -> should still trigger Rare+ at pull 5 and Legendary at pull 25
  const alwaysLow = () => 0.99;
  let fifthRarity = "";
  let twentyFifthRarity = "";
  for (let i = 1; i <= 25; i++) {
    const res = pullPilotCard(p, alwaysLow);
    assert.equal(res.error, "");
    assert.ok(res.result);
    if (i === 5) fifthRarity = res.result.pilot.rarity;
    if (i === 25) twentyFifthRarity = res.result.pilot.rarity;
  }
  assert.ok(["rare", "epic", "legendary"].includes(fifthRarity));
  assert.equal(twentyFifthRarity, "legendary");
});

test("duplicate pulls promote stars and boost stats; Base Duty boosts Foundry rate", () => {
  const p = fresh().program;
  const crew = ensureCrew(p);
  const starter = crew.pilots[0];
  const baseTotal = pilotStats(starter).total;

  // Force pulling p_c01 (common index 0)
  p.credits = PILOT_PULL_COST;
  const dup = pullPilotCard(p, () => 0.95);
  assert.equal(dup.error, "");
  assert.ok(dup.result);
  if (dup.result.isDuplicate) {
    assert.ok(dup.result.owned.stars >= 2);
    assert.ok(pilotStats(dup.result.owned).total > baseTotal);
  }

  // Base Duty on Solar Foundry increases C/hr
  const beforeRate = getCreditRatePerHour(p);
  assert.equal(assignPilotDuty(p, starter.id, "foundry"), "");
  assert.ok(crewDutyBonus(crew, "foundry") > 0);
  assert.ok(getCreditRatePerHour(p) > beforeRate);
});

test("crewed flight locks pilot until safe landing, awards XP, and strands on crash", () => {
  const save = fresh();
  const p = save.program;
  p.credits = 5000;
  p.propellant = 750;
  const starter = ensureCrew(p).pilots[0];
  const bp = p.blueprints[0];
  const staged = prepareContractBlueprint(p, "sounding", bp.id, starter.id);
  assert.equal(staged.error, "");
  assert.ok(staged.flight);
  save.flight = staged.flight;

  // Validated save survives round-trip
  const restored = validate(JSON.parse(JSON.stringify(save)));
  assert.equal(payLaunch(restored.program), "");
  const flyingPilot = ensureCrew(restored.program).pilots.find((x) => x.id === starter.id);
  assert.equal(flyingPilot.status, "flying");

  // Complete contract + safe landing returns pilot to Ready with XP
  restored.flight.status = "flying";
  restored.flight.maxAlt = 20_000;
  assert.match(settle(restored.program, restored.flight), /Atmospheric Sounding complete/);
  restored.flight.status = "landed";
  restored.flight.body = "earth";
  const recMsg = resolvePilotFlightOutcome(restored.program, restored.flight);
  assert.match(recMsg, /recovered safely/);
  assert.equal(flyingPilot.status, "ready");
  assert.ok(flyingPilot.xp >= 40);

  // Abandoning an in-flight pilot strands them until recovery fee is paid
  const staged2 = prepareContractBlueprint(restored.program, "sounding", bp.id, starter.id);
  assert.equal(staged2.error, "");
  assert.equal(payLaunch(restored.program), "");
  assert.match(abandonActivePilot(restored.program), /stranded/);
  assert.equal(flyingPilot.status, "stranded");
  restored.program.credits = pilotRecoveryFee(starter.id);
  assert.equal(recoverStrandedPilot(restored.program, starter.id), "");
  assert.equal(flyingPilot.status, "ready");
});
