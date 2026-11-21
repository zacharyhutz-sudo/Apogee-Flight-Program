import test from "node:test";
import assert from "node:assert/strict";
import { fresh, validate } from "../src/persistence/save.ts";
import { initial, step, stage, mass, stable } from "../src/sim/flight.ts";
import { coast } from "../src/sim/coast.ts";
import {
  CONTRACTS,
  startProgram,
  payLaunch,
  prepare,
  launchIssue,
  upgrade,
  place,
  quote,
  settle,
  validProgram,
  padCaps,
  latitude,
} from "../src/program/program.ts";
function fly(p, job) {
  const f = prepare(p, job);
  assert.equal(payLaunch(p), "");
  f.status = "flying";
  for (let i = 0; i < 8000; i++) {
    step(f);
    if (!f.stage && !f.fuel[0]) stage(f);
    if (settle(p, f)) break;
    if (job === "polar" && !f.throttle && stable(f)) break;
  }
  return f;
}
test("sponsored rescue, payout, construction, pad upgrade and one-time settlement", () => {
  const p = startProgram();
  p.credits = 0;
  assert.equal(launchIssue(p, "hop"), "");
  const f = fly(p, "hop");
  assert.equal(p.credits, 100);
  assert.equal(p.research, 4);
  const backup = validate({ ...fresh(), program: p, flight: f });
  assert.equal(settle(backup.program, backup.flight), "");
  assert.equal(place(p, "fuel", 2, 2), "");
  assert.equal(p.credits, 45);
  fly(p, "hop");
  assert.equal(upgrade(p, "pad"), "");
  assert.deepEqual(padCaps(2), { tonnes: 347, height: 55 });
  assert.equal(quote(p, "orbit").fee, 35);
});
test("an active flight keeps its booked reward; practice and failure never pay", () => {
  const p = startProgram(),
    practice = fly(p, "practice");
  assert.ok(practice.orbitEarned);
  assert.equal(p.credits, 80);
  const f = prepare(p, "orbit");
  assert.equal(payLaunch(p), "");
  assert.equal(p.credits, 35);
  assert.ok(payLaunch(p));
  f.status = "lost";
  assert.equal(settle(p, f), "");
  assert.equal(p.credits, 35);
  const hop = prepare(p, "hop");
  payLaunch(p);
  p.credits = 100;
  place(p, "lab", 2, 2);
  hop.status = "flying";
  hop.maxAlt = 100001;
  settle(p, hop);
  assert.equal(p.research, 4);
  assert.equal(quote(p, "hop").research, 5);
});
test("first orbit and polar survey both fly the real vehicle and pay at distinct milestones", () => {
  const p = startProgram(),
    orb = fly(p, "orbit");
  assert.ok(orb.orbitEarned);
  assert.equal(p.credits, 215);
  assert.match(launchIssue(p, "polar"), /level 2/);
  assert.equal(upgrade(p, "pad"), "");
  assert.equal(launchIssue(p, "polar"), "");
  const f = fly(p, "polar");
  assert.ok(stable(f));
  assert.equal(p.completed.polar, 0);
  assert.ok(f.cargo === 4000);
  for (let i = 0; i < 2500 && !p.rewarded; i++) {
    coast(f, 1);
    settle(p, f);
  }
  assert.ok(latitude(p, f) >= 75);
  assert.equal(p.completed.polar, 1);
  assert.equal(p.research, 16);
  const saved = validate({ ...fresh(), flight: f, program: p });
  assert.equal(saved.program.completed.polar, 1);
});
test("terrain, pad buffers and occupied plots reject placement without spending", () => {
  const p = startProgram(),
    before = structuredClone(p);
  for (const pos of [
    [5, 3],
    [4, 3],
    [2, 4],
    [1, 2],
    [0, 3],
    [0, 0],
    [-1, 4],
  ])
    assert.ok(place(p, "lab", ...pos));
  assert.deepEqual(p, before);
  assert.ok(upgrade(p, "pad"));
  assert.deepEqual(p, before);
  assert.equal(place(p, "lab", 1, 1), "");
  assert.equal(place(p, "lab", 1, 3), "");
  assert.equal(p.buildings.length, 3);
  assert.equal(p.credits, 15);
});
test("v1 backups migrate flight vectors into free simulations with distinct program time", () => {
  const f = initial();
  f.status = "flying";
  step(f);
  const original = { ...f };
  delete original.cargo;
  const old = {
      version: 1,
      revision: 3,
      view: "map",
      flight: original,
      log: [],
    },
    migrated = validate(old);
  assert.deepEqual(migrated.flight, f);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.view, "map");
  assert.equal(migrated.program.elapsed, f.t);
  assert.equal(migrated.program.sortie, "practice");
  assert.deepEqual(validate(migrated), migrated);
  assert.equal(old.flight.cargo, undefined);
});
test("program validator rejects malformed economy, duplicate facilities and inconsistent dispatch", () => {
  for (const edit of [
    (p) => (p.credits = -1),
    (p) => (p.research = 1.5),
    (p) => (p.elapsed = Infinity),
    (p) => p.buildings.push({ ...p.buildings[0] }),
    (p) => (p.buildings[0].x = 50),
    (p) => (p.sortie = "ghost"),
    (p) => (p.paid = true),
    (p) => (p.inclination = 90),
    (p) => (p.completed.hop = -1),
  ]) {
    const m = fresh();
    edit(m.program);
    assert.throws(() => validate(m));
  }
});
