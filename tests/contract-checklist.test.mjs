import assert from "node:assert/strict";
import test from "node:test";
import { CONTRACT_JOBS, contractConditionMet, contractTasks, prepare, startProgram } from "../src/program/program.ts";
import { MU, R } from "../src/sim/flight.ts";

function setOrbit(f, pe, ap) {
  const ra = R + ap;
  Object.assign(f, { x: ra, y: 0, vx: 0, vy: Math.sqrt(MU * (2 / ra - 2 / (ra + R + pe))) });
}

test("each staged contract starts with pending tasks, and practice has none", () => {
  const p = startProgram();
  for (const job of CONTRACT_JOBS) {
    const tasks = contractTasks(p, prepare(p, job));
    assert.ok(tasks.length > 0, job);
    assert.ok(tasks.every(t => !t.done), job);
  }
  assert.deepEqual(contractTasks(p, prepare(p, "practice")), []);
});

test("partial progress matches the individual mission and an award needs all requirements", () => {
  const p = startProgram();
  const f = prepare(p, "hop");
  f.status = "flying";
  f.maxAlt = 40000;
  const checks = () => contractTasks(p, f).map(t => t.done);
  assert.deepEqual(checks(), [true, false]);
  assert.equal(contractConditionMet(p, f), false);
  f.stage = 1;
  assert.equal(contractConditionMet(p, f), true);
  p.sortie = "relay";
  setOrbit(f, 32000, 270000);
  assert.deepEqual(checks(), [false, true]);
  assert.equal(contractConditionMet(p, f), false);
  setOrbit(f, 36000, 270000);
  assert.equal(contractConditionMet(p, f), true);
  p.sortie = "orbit";
  setOrbit(f, 32000, 37000);
  f.orbitEarned = true;
  assert.deepEqual(checks(), [true, true, false]);
  p.sortie = "return";
  assert.deepEqual(checks(), [true, false]);
  p.sortie = "recovery";
  assert.deepEqual(checks(), [true, false]);
  p.sortie = "lunar_flyby";
  f.moonVisited = true;
  assert.deepEqual(checks(), [true]);
  p.sortie = "lunar_colony";
  f.status = "landed";
  assert.deepEqual(checks(), [true, false]);
  f.body = "moon";
  assert.equal(contractConditionMet(p, f), true);
});

test("reading a precision checklist never starts its timer and leaving the band resets the pass", () => {
  const p = startProgram();
  const f = prepare(p, "leo");
  Object.assign(f, { status: "flying", t: 25 });
  setOrbit(f, 59000, 61000);
  assert.equal(contractTasks(p, f)[1].remainingSeconds, 1300);
  assert.equal(p.leoPassStartSec, null);
  assert.equal(contractConditionMet(p, f), false);
  assert.equal(p.leoPassStartSec, 25);
  f.t += 900;
  assert.equal(contractTasks(p, f)[1].remainingSeconds, 400);
  setOrbit(f, 53000, 61000);
  assert.equal(contractConditionMet(p, f), false);
  assert.equal(p.leoPassStartSec, null);
  setOrbit(f, 58000, 62000);
  assert.equal(contractConditionMet(p, f), false);
  f.t += 1300;
  assert.equal(contractConditionMet(p, f), true);
});
