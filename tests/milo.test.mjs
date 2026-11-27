import test from "node:test";
import assert from "node:assert/strict";
import { fresh, validate } from "../src/persistence/save.ts";
import { flightPrompt } from "../src/app/miloFlight.ts";
import {
  prepare,
  payLaunch,
  settle,
  extraBuildCost,
  costShortfall,
  countBuilt,
  place,
  placement,
  inspectContractBlueprint,
  prepareContractBlueprint,
} from "../src/program/program.ts";
import { step } from "../src/sim/flight.ts";

test("new programs welcome Milo, older saves opt in and each lesson survives export", () => {
  const s = fresh();
  assert.equal(s.tutorial.status, "welcome");
  assert.equal(s.tutorial.vabStep, 0);
  assert.equal(s.tutorial.contractsStep, 0);
  assert.equal(s.tutorial.apPeSeen, false);
  const legacy = structuredClone(s);
  delete legacy.tutorial;
  assert.equal(validate(legacy).tutorial.status, "off");
  const corrupt = validate({ ...s, tutorial: { status: "unknown" } });
  assert.equal(corrupt.tutorial.status, "off");
  assert.deepEqual(corrupt.program, validate(s).program);
  for (const status of ["welcome", "active", "complete", "off"]) {
    Object.assign(s.tutorial, {
      status,
      workshop: "picker",
      vabStep: 2,
      contractsStep: 1,
      apPeSeen: true,
      stagingSeen: true,
      collectionTip: true,
      hideInvite: status === "off",
    });
    assert.deepEqual(validate(s).tutorial, s.tutorial);
  }
});

test("new programs start with enough credits and propellant for the first launch (blueprint or sponsored)", () => {
  const s = fresh();
  const p = s.program;
  assert.ok(p.credits >= 670, "starting credits cover Pioneer Orbital hardware");
  assert.ok(p.propellant >= 440, "starting propellant covers Pioneer Orbital fuel");

  // Default Pioneer Orbital blueprint can be staged & launched for first Atmospheric Sounding
  const check = inspectContractBlueprint(p, "sounding", p.blueprints[0].id);
  assert.equal(check.error, "");
  const staged = prepareContractBlueprint(p, "sounding", p.blueprints[0].id);
  assert.equal(staged.error, "");
  assert.equal(payLaunch(p), "");
});

test("Milo reads the sponsored flight, explains AP/PE in launch view, payout and construction", () => {
  let s = fresh();
  s.tutorial.status = "active";
  s.flight = prepare(s.program, "sounding");
  assert.equal(flightPrompt(s, false).target, "command");
  s.flight.throttle = 0;
  assert.equal(flightPrompt(s, false).target, "throttle");
  s.flight.throttle = 1;
  assert.equal(payLaunch(s.program), "");
  s.flight.status = "flying";
  for (let i = 0; i < 40; i++) step(s.flight);
  s = validate(s);
  assert.equal(flightPrompt(s, true).target, "resume");
  assert.equal(flightPrompt(s, false).target, "altitude");

  // Once airborne past 1.5 km, Milo explains AP and PE in the launch view
  for (let i = 0; i < 1200 && s.flight.maxAlt < 1600; i++) step(s.flight);
  const apPe = flightPrompt(s, false);
  assert.equal(apPe.target, "appe");
  assert.equal(apPe.ack, "apPeSeen");
  assert.match(apPe.text, /Apoapsis.*Periapsis/i);

  // Dismissing AP/PE returns to altitude tracking until 15 km
  s.tutorial.apPeSeen = true;
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
      if (!placement(s.program, "foundry", x, y)) {
        plot = { x, y };
        break;
      }
  assert.ok(plot);
  assert.equal(place(s.program, "foundry", plot.x, plot.y), "");
  const p = validate(s).program;
  assert.equal(countBuilt(p, "foundry"), 2);
  assert.deepEqual([p.credits, p.propellant, p.research, p.completed.sounding], [700, 350, 5, 1]);
  s.flight.status = "lost";
  assert.equal(flightPrompt(s, false).target, "base");
  s.tutorial.status = "off";
  assert.equal(flightPrompt(s, false), null);
});
