import test from "node:test";
import assert from "node:assert/strict";
import {
  R,
  MU,
  AIR,
  STEP,
  G0,
  STAGES,
  canWarp,
  deltaV,
  density,
  initial,
  mass,
  orbit,
  radius,
  speed,
  stage,
  step,
} from "../src/sim/flight.ts";
import { coast } from "../src/sim/coast.ts";
import { fresh, validate } from "../src/persistence/save.ts";
const near = (actual, expected, tol) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${actual} differs from ${expected} by more than ${tol}`,
  );
function apsides(pe = 200000, ap = 200000, retro = false) {
  const s = initial(),
    rp = R + pe,
    ra = R + ap;
  Object.assign(s, {
    status: "flying",
    throttle: 0,
    x: ra,
    vy: Math.sqrt(MU * (2 / ra - 2 / (rp + ra))) * (retro ? -1 : 1),
    mode: "manual",
  });
  return s;
}
function guided(delay = 0) {
  const s = initial();
  s.status = "flying";
  let emptyAt = 0;
  for (let i = 0; i < 9000; i++) {
    step(s);
    if (!s.fuel[0] && !s.stage) {
      emptyAt ||= s.t;
      if (s.t - emptyAt >= delay) stage(s);
    }
    if (s.orbitEarned && !s.throttle) break;
  }
  return s;
}
test("pad, thrust-to-weight, propellant flow and ideal stage delta-v", () => {
  const s = initial(),
    m = mass(s);
  assert.ok(STAGES[0].thrust / (m * G0) > 1);
  const upperMass = STAGES[1].dry + STAGES[1].fuel + 2400;
  near(
    deltaV(s),
    318 * G0 * Math.log(m / (m - STAGES[0].fuel)) +
      367 * G0 * Math.log(upperMass / (upperMass - STAGES[1].fuel)),
    1e-8,
  );
  step(s);
  assert.equal(s.t, 0);
  s.status = "flying";
  step(s);
  near(m - mass(s), (STAGES[0].thrust * STEP) / (STAGES[0].isp * G0), 1e-7);
  assert.ok(radius(s) > R);
  assert.equal(s.fuel[1], STAGES[1].fuel);
});
test("drag decelerates an ascending atmospheric craft", () => {
  const s = apsides();
  s.x = R + 2000;
  s.vx = 800;
  s.vy = 0;
  const before = s.vx,
    grav = MU / s.x ** 2;
  step(s);
  assert.ok(before - s.vx > grav * STEP);
  assert.ok(density(2000) > density(6000));
  assert.equal(density(AIR), 0);
});
test("staging drops remaining booster wet mass and preserves inertial state", () => {
  const s = initial();
  assert.equal(stage(s), false);
  s.status = "flying";
  step(s);
  const before = structuredClone(s),
    dm = STAGES[0].dry + s.fuel[0];
  assert.ok(stage(s));
  near(mass(before) - mass(s), dm, 1e-8);
  assert.equal(s.fuel[0], 0);
  for (const key of ["x", "y", "vx", "vy", "t"])
    assert.equal(s[key], before[key]);
  assert.equal(stage(s), false);
});
test("guided flight reaches low Earth orbit with both prompt and delayed player staging", () => {
  for (const delay of [0, 8, 20]) {
    const s = guided(delay),
      o = orbit(s);
    assert.ok(s.orbitEarned);
    assert.ok(o.pe >= AIR);
    assert.ok(o.ap < 2000000);
    assert.equal(s.stage, 1);
    assert.ok(s.fuel[1] > 0);
    assert.equal(s.throttle, 0);
    assert.ok(canWarp(s));
  }
});
test("simulation reload is bit-exact at a fixed-step boundary", () => {
  const s = initial();
  s.status = "flying";
  for (let i = 0; i < 1200; i++) step(s);
  const restored = validate(
    JSON.parse(JSON.stringify({ ...fresh(), flight: s })),
  ).flight;
  for (let i = 0; i < 1000; i++) {
    step(s);
    step(restored);
  }
  assert.deepEqual(s, restored);
});
test("known eccentric ellipse and fixed-step energy conservation", () => {
  const s = apsides(200000, 550000),
    o = orbit(s);
  near(o.pe, 200000, 1e-6);
  near(o.ap, 550000, 1e-6);
  const energy = () => speed(s) ** 2 / 2 - MU / radius(s),
    initialE = energy();
  for (let i = 0; i < 2400; i++) step(s);
  assert.ok(Math.abs((energy() - initialE) / initialE) < 0.00002);
});
test("analytic coast returns to the initial state after 12 orbits, both directions", () => {
  for (const retro of [true, false]) {
    const s = apsides(210000, 680000, retro),
      o = orbit(s),
      before = structuredClone(s),
      period = 2 * Math.PI * Math.sqrt(o.a ** 3 / MU);
    for (let i = 0; i < 1200; i++) assert.ok(coast(s, period / 100));
    near(s.x, before.x, 0.03);
    near(s.y, 0, 0.03);
    near(s.vy, before.vy, 0.00001);
    near(orbit(s).pe, o.pe, 0.02);
    near(s.t, 12 * period, 1e-6);
  }
});
test("atmosphere, thrust and impact block warp; eccentric coast stops before entry", () => {
  assert.equal(canWarp(initial()), false);
  const s = apsides(20000, 400000);
  s.throttle = 1;
  assert.equal(canWarp(s), false);
  s.throttle = 0;
  assert.equal(coast(s, 10000), false);
  assert.ok(radius(s) - R > AIR + 990 && radius(s) - R < AIR + 2000);
  assert.ok(s.t < 10000);
  s.x = R + 100;
  s.y = 0;
  assert.equal(canWarp(s), false);
});
test("prograde and retrograde burns move the opposite apsis", () => {
  const start = apsides(210000, 400000),
    before = orbit(start);
  for (const mode of ["prograde", "retrograde"]) {
    const s = structuredClone(start);
    stage(s);
    s.mode = mode;
    s.throttle = 0.3;
    for (let i = 0; i < 60; i++) step(s);
    assert.ok(
      mode === "prograde" ? orbit(s).pe > before.pe : orbit(s).pe < before.pe,
    );
  }
});
test("surface collision distinguishes soft vertical contact from an impact", () => {
  for (const [vx, vy, expected] of [
    [-1, 0, "landed"],
    [-30, 0, "lost"],
    [-1, 15, "lost"],
  ]) {
    const s = apsides();
    s.x = R + 0.01;
    s.vx = vx;
    s.vy = vy;
    step(s);
    assert.equal(s.status, expected);
    near(radius(s), R, 1e-5);
    assert.equal(s.throttle, 0);
  }
});
test("JSON validator rejects unsupported versions, nonfinite vectors and impossible fuel", () => {
  assert.deepEqual(validate(fresh()), fresh());
  for (const edit of [
    (m) => m.version++,
    (m) => (m.flight.x = NaN),
    (m) => (m.flight.vx = Infinity),
    (m) => (m.flight.fuel[0] = -1),
    (m) => (m.flight.stage = 2),
    (m) => (m.flight.mode = "unknown"),
    (m) => (m.flight.x = 0),
    (m) => (m.flight.t = 10),
    (m) => (m.log = [{ t: 10, text: "later" }]),
  ]) {
    const m = fresh();
    edit(m);
    assert.throws(() => validate(m));
  }
});
