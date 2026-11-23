import test from "node:test";
import assert from "node:assert/strict";
import { fresh, validate } from "../src/persistence/save.ts";
import {
  SOUNDING_TARGET,
  inspectSoundingBlueprint,
  payLaunch,
  prepare,
  prepareSoundingBlueprint,
  quote,
  settle,
} from "../src/program/program.ts";
import { stage, step } from "../src/sim/flight.ts";

const arrowId = "bp_sounding_dart";
const reload = (save) => validate(JSON.parse(JSON.stringify(save)));

test("Sounding locks the staged blueprint and charges its quoted price at ignition once", () => {
  const save = fresh();
  const p = save.program;
  const invalid = { id: "unfinished", name: "Unfinished", version: 1, parts: [] };
  p.blueprints.push(invalid);
  assert.match(inspectSoundingBlueprint(p, invalid.id).error, /Missing command/);
  assert.equal(prepareSoundingBlueprint(p, invalid.id).flight, null);
  assert.equal(p.sortie, "practice");

  const { flight } = prepareSoundingBlueprint(p, arrowId);
  assert.ok(flight);
  save.flight = flight;
  assert.equal(p.credits, 600);
  assert.equal(p.propellant, 900);
  p.blueprints.find((b) => b.id === arrowId).parts.push({
    uid: "extra-tank",
    partId: "tank_m",
    stage: 0,
    symmetry: 1,
  });

  const { program: restored, flight: staged } = reload(save);
  assert.equal(staged.vehicleName, "Sounding Arrow");
  assert.equal(staged.blueprintParts.length, 3);
  assert.equal(quote(restored, "sounding").hardwareCost, 300);
  assert.equal(quote(restored, "sounding").propellantCost, 180);

  restored.propellant = 100;
  assert.match(payLaunch(restored), /Need 80 more Propellant/);
  assert.equal(restored.credits, 600);
  assert.equal(restored.paid, false);
  restored.propellant = 900;
  assert.equal(payLaunch(restored), "");
  staged.status = "flying";
  assert.equal(stage(staged), false);
  assert.match(payLaunch(restored), /already dispatched/);
  assert.equal(restored.credits, 300);
  assert.equal(restored.propellant, 720);
  assert.equal(reload({ ...save, program: restored, flight: staged }).program.paid, true);
});

test("Both Workshop rockets earn one Sounding payout and keep their reports after reload", () => {
  const reports = [false, true].map((addTank) => {
    const save = fresh();
    const p = save.program;
    if (addTank) {
      p.blueprints.find((b) => b.id === arrowId).parts.push({
        uid: "extra-tank",
        partId: "tank_m",
        stage: 0,
        symmetry: 1,
      });
    }
    const { flight } = prepareSoundingBlueprint(p, arrowId);
    assert.ok(flight);
    assert.equal(payLaunch(p), "");
    flight.status = "flying";
    assert.equal(settle(p, flight), "");
    while (flight.status === "flying" && flight.maxAlt < SOUNDING_TARGET && flight.t < 180) {
      step(flight);
      settle(p, flight);
    }
    assert.ok(flight.maxAlt >= SOUNDING_TARGET);

    const restored = reload({ ...save, flight });
    assert.equal(settle(restored.program, restored.flight), "");
    while (restored.flight.status === "flying" && restored.flight.t < 300) {
      step(restored.flight);
      assert.equal(settle(restored.program, restored.flight), "");
    }
    const { soundingReport: report } = restored.program;
    assert.equal(report.peakAltitude, restored.flight.maxAlt);
    assert.equal(report.creditsAwarded, 450);
    assert.equal(report.researchAwarded, 5);
    assert.equal(restored.program.completed.sounding, 1);
    restored.flight = prepare(restored.program, "practice");
    assert.deepEqual(reload(restored).program.soundingReport, report);
    return report;
  });
  assert.equal(reports[1].hardwareSpent - reports[0].hardwareSpent, 140);
  assert.equal(reports[1].propellantSpent - reports[0].propellantSpent, 360);
});
