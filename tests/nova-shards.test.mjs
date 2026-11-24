import assert from "node:assert/strict";
import test from "node:test";
import { fresh, validate } from "../src/persistence/save.ts";
import { exchangeNovaShard, boostFacility, tickEconomy, collectResource, applyContractReward } from "../src/program/program.ts";

test("store overfill survives ticks, capped rewards and save validation", () => {
  const save = fresh();
  const p = save.program;
  exchangeNovaShard(p, "credits");
  exchangeNovaShard(p, "credits");
  exchangeNovaShard(p, "propellant");
  tickEconomy(p, 120);
  assert.equal(p.credits, 2300);
  assert.equal(collectResource(p, "credits").collected, 0);
  assert.equal(applyContractReward(p, "sounding").state.credits, 2300);
  const restored = validate(JSON.parse(JSON.stringify(save))).program;
  assert.equal(restored.credits, 2300);
  assert.equal(restored.propellant, 1350);
});

test("boosting one facility leaves another timer alone and completes the last partial boost once", () => {
  const p = fresh().program;
  const [a,b] = p.buildings;
  const now = 1000;
  a.upgradingUntilMs = now + 900000;
  b.upgradingUntilMs = now + 1200000;
  boostFacility(p, a, now);
  assert.equal(a.upgradingUntilMs, now + 300000);
  boostFacility(p, a, now);
  boostFacility(p, a, now);
  assert.equal(a.level, 2);
  assert.equal(p.buildingLevels[a.kind], 2);
  assert.equal(b.upgradingUntilMs, now + 1200000);
});
