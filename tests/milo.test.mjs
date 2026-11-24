import test from "node:test";
import assert from "node:assert/strict";
import { fresh, validate } from "../src/persistence/save.ts";
import { flightPrompt } from "../src/app/miloFlight.ts";
import { prepare, payLaunch, settle, extraBuildCost, costShortfall, countBuilt, place, placement } from "../src/program/program.ts";
import { step } from "../src/sim/flight.ts";

test("new programs welcome Milo, older saves opt in and each lesson survives export", () => {
  const s = fresh();
  assert.equal(s.tutorial.status, "welcome");
  const legacy = structuredClone(s);
  delete legacy.tutorial;
  assert.equal(validate(legacy).tutorial.status, "off");
  const corrupt = validate({ ...s, tutorial: { status: "unknown" } });
  assert.equal(corrupt.tutorial.status, "off");
  assert.deepEqual(corrupt.program, validate(s).program);
  for (const status of ["welcome", "active", "complete", "off"]) {
    Object.assign(s.tutorial, { status, workshop: "picker", stagingSeen: true, collectionTip: true, hideInvite: status === "off" });
    assert.deepEqual(validate(s).tutorial, s.tutorial);
  }
});

test("Milo reads the sponsored flight, payout and construction without changing the economy", () => {
  let s = fresh();
  s.tutorial.status = "active";
  s.flight = prepare(s.program, "sounding");
  assert.equal(flightPrompt(s, false).target, "command");
  s.flight.throttle = 0;
  assert.equal(flightPrompt(s, false).target, "throttle");
  s.flight.throttle = 1;
  assert.equal(payLaunch(s.program), "");
  s.flight.status = "flying";
  for (let i = 0; i < 100; i++) step(s.flight);
  s = validate(s);
  assert.equal(flightPrompt(s, true).target, "resume");
  assert.equal(flightPrompt(s, false).target, "altitude");
  for (let i = 0; i < 12000 && !s.program.rewarded; i++) {
    step(s.flight);
    settle(s.program, s.flight);
  }
  assert.match(flightPrompt(s, false).text, /450 credits and \+5 RD/);
  assert.equal(settle(s.program, s.flight), "");
  assert.equal(costShortfall(s.program, extraBuildCost("foundry")), "");
  let plot;
  for (let y = 1; y < 8 && !plot; y++)
    for (let x = 1; x < 8; x++)
      if (!placement(s.program, "foundry", x, y)) { plot = {x, y}; break; }
  assert.ok(plot);
  assert.equal(place(s.program, "foundry", plot.x, plot.y), "");
  const p = validate(s).program;
  assert.equal(countBuilt(p, "foundry"), 2);
  assert.deepEqual([p.credits, p.propellant, p.research, p.completed.sounding], [150, 100, 5, 1]);
  s.flight.status = "lost";
  assert.equal(flightPrompt(s, false).target, "base");
  s.tutorial.status = "off";
  assert.equal(flightPrompt(s, false), null);
});
