import test from "node:test";
import assert from "node:assert/strict";
import { canHighWarp, canMidWarp, HIGH_WARP_ALT, MID_WARP_ALT, 
  R,
  MU,
  AIR,
  MAX_ORBIT_AP,
  STEP,
  G0,
  STAGES,
  canWarp,
  deltaV,
  density,
  headingVector,
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

function apsides(pe = 55000, ap = 55000, retro = false) {
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
  for (let i = 0; i < 6000; i++) {
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
  const upperMass = STAGES[1].dry + STAGES[1].fuel + 1200;
  near(
    deltaV(s),
    STAGES[0].isp * G0 * Math.log(m / (m - STAGES[0].fuel)) +
      STAGES[1].isp * G0 * Math.log(upperMass / (upperMass - STAGES[1].fuel)),
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
  s.vx = 500;
  s.vy = 0;
  const before = s.vx,
    grav = MU / s.x ** 2;
  step(s);
  assert.ok(before - s.vx > grav * STEP);
  assert.ok(density(2000) > density(6000));
  assert.equal(density(AIR), 0);
});

test("staging spawns physical tumbling debris and preserves upper-stage inertial state", () => {
  const s = initial();
  assert.equal(stage(s), false);
  s.status = "flying";
  for (let i = 0; i < 40; i++) step(s);
  const before = structuredClone(s),
    dm = STAGES[0].dry + s.fuel[0];
  assert.ok(stage(s));
  near(mass(before) - mass(s), dm, 1e-8);
  assert.equal(s.fuel[0], 0);
  for (const key of ["x", "y", "vx", "vy", "t"])
    assert.equal(s[key], before[key]);
  assert.equal(s.debris?.length, 1);
  const d0 = structuredClone(s.debris[0]);
  for (let i = 0; i < 40; i++) step(s);
  assert.equal(s.debris?.length, 1);
  // Detached booster must separate further and tumble under gravity/drag
  assert.ok(s.debris[0].angle > d0.angle);
  assert.ok(
    Math.hypot(s.debris[0].x - s.x, s.debris[0].y - s.y) >
      Math.hypot(d0.x - before.x, d0.y - before.y),
  );
  assert.equal(stage(s), false);
});

test("world-fixed heading points up at North Pole and down at South Pole", () => {
  const north = initial();
  near(headingVector(north).angle, 0, 1e-9);
  const south = initial();
  south.x = -R;
  south.y = 0;
  near(Math.abs(headingVector(south).angle), Math.PI, 1e-9);
});

test("guided flight reaches SFS-scale low Earth orbit with prompt and delayed staging", () => {
  for (const delay of [0, 4, 8]) {
    const s = guided(delay),
      o = orbit(s);
    assert.ok(s.orbitEarned, `delay=${delay} failed orbit: pe=${o.pe} ap=${o.ap}`);
    assert.ok(o.pe >= AIR);
    assert.ok(o.ap <= MAX_ORBIT_AP);
    assert.equal(s.stage, 1);
    assert.ok(s.fuel[1] > 0);
    assert.equal(s.throttle, 0);
    assert.ok(canWarp(s));
  }
});

test("simulation reload is bit-exact at a fixed-step boundary", () => {
  const s = initial();
  s.status = "flying";
  for (let i = 0; i < 600; i++) step(s);
  const restored = validate(
    JSON.parse(JSON.stringify({ ...fresh(), flight: s })),
  ).flight;
  for (let i = 0; i < 400; i++) {
    step(s);
    step(restored);
  }
  assert.deepEqual(s, restored);
});

test("known eccentric ellipse and fixed-step energy conservation", () => {
  const s = apsides(50000, 180000),
    o = orbit(s);
  near(o.pe, 50000, 1e-5);
  near(o.ap, 180000, 1e-5);
  const energy = () => speed(s) ** 2 / 2 - MU / radius(s),
    initialE = energy();
  for (let i = 0; i < 1200; i++) step(s);
  assert.ok(Math.abs((energy() - initialE) / initialE) < 0.0001);
});

test("analytic coast returns to the initial state after 12 orbits, both directions", () => {
  for (const retro of [true, false]) {
    const s = apsides(55000, 160000, retro),
      o = orbit(s),
      before = structuredClone(s),
      period = 2 * Math.PI * Math.sqrt(o.a ** 3 / MU);
    for (let i = 0; i < 1200; i++) assert.ok(coast(s, period / 100));
    near(s.x, before.x, 0.05);
    near(s.y, 0, 0.05);
    near(s.vy, before.vy, 0.0001);
    near(orbit(s).pe, o.pe, 0.05);
    near(s.t, 12 * period, 1e-5);
  }
});

test("atmosphere, thrust and impact block warp; eccentric coast stops before entry", () => {
  assert.equal(canWarp(initial()), false);
  const s = apsides(8000, 120000);
  s.throttle = 1;
  assert.equal(canWarp(s), false);
  s.throttle = 0;
  assert.equal(coast(s, 5000), false);
  assert.ok(radius(s) - R > AIR + 450 && radius(s) - R < AIR + 1500);
  assert.ok(s.t < 5000);
  s.x = R + 100;
  s.y = 0;
  assert.equal(canWarp(s), false);
});

test("prograde and retrograde burns move the opposite apsis", () => {
  const start = apsides(55000, 120000),
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

test("100x warp unlocks at 500 km while 500x warp unlocks at 1,500 km", () => {
  const s = initial();
  s.status = "flying";
  s.throttle = 0;
  s.y = 0;

  s.x = R + MID_WARP_ALT - 1;
  assert.equal(canMidWarp(s), false);
  assert.equal(canHighWarp(s), false);

  s.x = R + MID_WARP_ALT;
  assert.equal(canMidWarp(s), true);
  assert.equal(canHighWarp(s), false);

  s.x = R + HIGH_WARP_ALT;
  assert.equal(canMidWarp(s), true);
  assert.equal(canHighWarp(s), true);
});
