import test from "node:test";
import assert from "node:assert/strict";
import { fresh, validate } from "../src/persistence/save.ts";
import {
  contractTasks,
  ensureRotatingBoard,
  inspectRotatingBlueprint,
  payLaunch,
  prepareRotatingContractBlueprint,
  rerollCostCredits,
  rerollRotatingBoard,
  rotatingSlotCount,
  settle,
} from "../src/program/program.ts";

function makeRng(seed = 42) {
  let x = seed >>> 0;
  return () => {
    x = (1664525 * x + 1013904223) >>> 0;
    return x / 0x100000000;
  };
}

test("rotating board scales with Contract Office level and supports free then paid rerolls", () => {
  const p = fresh().program;
  assert.equal(rotatingSlotCount(1), 2);
  assert.equal(rotatingSlotCount(2), 3);
  assert.equal(rotatingSlotCount(4), 4);

  const now = 1_700_000_000_000;
  const board = ensureRotatingBoard(p, now, makeRng(1));
  assert.equal(board.offers.length, 2);
  assert.equal(rerollCostCredits(board), 0);

  // First reroll is free
  p.credits = 100;
  assert.equal(rerollRotatingBoard(p, now, makeRng(2)), "");
  assert.equal(p.credits, 100);
  assert.equal(rerollCostCredits(p.rotatingBoard), 150);

  // Second reroll costs 150 C
  assert.match(rerollRotatingBoard(p, now, makeRng(3)), /50 C/);
  p.credits = 200;
  assert.equal(rerollRotatingBoard(p, now, makeRng(3)), "");
  assert.equal(p.credits, 50);
});

test("VAB modifiers validate constraints, apply subsidy discount, and settle rotating contracts cleanly", () => {
  const save = fresh();
  const p = save.program;
  p.credits = 2000;
  p.propellant = 750;
  const bp = p.blueprints[0];
  const now = 1_700_000_000_000;
  ensureRotatingBoard(p, now, makeRng(7));

  const strictOffer = {
    id: "rot_test_1",
    template: "sounding_sweep",
    name: "Sounding Sweep 24 km",
    tier: 1,
    goal: "Reach Ap ≥ 24 km altitude.",
    targetApM: 24_000,
    cargoKg: 0,
    credits: 1600,
    research: 30,
    modifiers: ["sponsor_subsidy", "minimalist", "express_window"],
    maxParts: 1,
    hardwareDiscount: 0.35,
    maxTimeSec: 240,
    expiresAtMs: now + 3_600_000,
  };

  // Fails minimalist cap of 1 part
  const blocked = inspectRotatingBlueprint(p, strictOffer, bp.id);
  assert.match(blocked.error, /Minimalist/);

  // Relax maxParts and stage
  strictOffer.maxParts = 12;
  p.rotatingBoard.offers = [strictOffer];
  const staged = prepareRotatingContractBlueprint(p, strictOffer, bp.id);
  assert.equal(staged.error, "");
  assert.ok(staged.flight);
  save.flight = staged.flight;

  // Survives save/reload validation
  const restored = validate(JSON.parse(JSON.stringify(save)));
  assert.equal(restored.program.sortie, "rotating");
  assert.equal(restored.program.activeRotating?.id, "rot_test_1");

  // Launch & settle removes completed offer from rotating board
  assert.equal(payLaunch(restored.program), "");
  restored.flight.status = "flying";
  restored.flight.t = 120;
  restored.flight.maxAlt = 25_000;
  const tasks = contractTasks(restored.program, restored.flight);
  assert.ok(tasks.every((t) => t.done));
  const msg = settle(restored.program, restored.flight);
  assert.match(msg, /Sounding Sweep 24 km complete/);
  assert.equal(restored.program.rotatingBoard.offers.length, 0);
});
