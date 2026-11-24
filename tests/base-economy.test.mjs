import test from "node:test";
import assert from "node:assert/strict";
import { canAffordUpgrade, clearObstacle, collectResource, getStorageCaps,
  inspectContractBlueprint, place, placement, prepareContractBlueprint,
  reclaimCost, reclaimTile, startProgram, terrain, tileTerrain, upgrade, upgradeCost } from "../src/program/program.ts";
import { fresh, validate } from "../src/persistence/save.ts";

test("old saves can clear a grove and rocks, build, reload and reclaim the coast independently", () => {
  const save = fresh();
  delete save.program.clearedTiles;
  const p = validate(save).program;
  save.program = p;
  assert.equal(reclaimTile(p, 0, 1), "");
  const coastPrice = reclaimCost(p);
  for (const [x, y, cost] of [[0, 3, 50], [1, 2, 100]]) {
    const before = p.propellant;
    assert.notEqual(placement(p, "foundry", x, y), "");
    assert.equal(clearObstacle(p, x, y), "");
    assert.equal(p.propellant, before - cost);
    assert.equal(tileTerrain(p, x, y), "land");
    assert.notEqual(clearObstacle(p, x, y), "");
    assert.equal(p.propellant, before - cost);
  }
  assert.equal(p.propellant, 750);
  assert.equal(reclaimCost(p), coastPrice);
  assert.equal(place(p, "foundry", 0, 3), "");
  const restored = validate(JSON.parse(JSON.stringify(save))).program;
  assert.equal(tileTerrain(restored, 0, 1), "land");
  assert.equal(tileTerrain(restored, 1, 2), "land");
  assert.equal(restored.buildings.find(b => b.x === 0 && b.y === 3)?.kind, "foundry");
  assert.equal(restored.propellant, 675);
});

test("every natural obstacle has a fixed price and insufficient fuel leaves the plot untouched", () => {
  const p = startProgram();
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      const ground = terrain(x, y);
      const cost = ground === "grove" ? 50 : ground === "rock" ? 100 : 0;
      p.propellant = cost ? cost - 1 : 300;
      const before = structuredClone(p);
      assert.notEqual(clearObstacle(p, x, y), "");
      assert.deepEqual(p, before);
      if (cost) {
        p.propellant = cost;
        assert.equal(clearObstacle(p, x, y), "");
        assert.equal(p.propellant, 0);
      }
    }
  }
});

test("foundry purchases charge each resource once, preserve free moves and level the selected building", () => {
  const p = startProgram();
  const target = { x: 3, y: 1 };
  p.credits = 300;
  p.propellant = 74;
  assert.match(place(p, "foundry", target.x, target.y), /1 Prop/);
  assert.equal(p.credits, 300);
  p.propellant++;
  assert.equal(place(p, "foundry", target.x, target.y), "");
  assert.deepEqual([p.credits, p.propellant], [0, 0]);
  const moved = { x: 3, y: 0 };
  p.propellant = 50;
  assert.equal(clearObstacle(p, moved.x, moved.y), "");
  assert.equal(place(p, "foundry", moved.x, moved.y, target), "");
  p.buildings.find(b => b.kind === "command").level = 4;
  for (const [current, credits, propellant] of [[1, 750, 100], [2, 3000, 300], [3, 10500, 750]]) {
    assert.deepEqual(upgradeCost("foundry", current), { credits, propellant, research: 0 });
    p.credits = credits;
    p.propellant = propellant - 1;
    assert.match(upgrade(p, "foundry", moved), /1 Prop/);
    assert.equal(p.credits, credits);
    p.propellant++;
    assert.equal(upgrade(p, "foundry", moved), "");
    assert.deepEqual([p.credits, p.propellant], [0, 0]);
  }
  assert.deepEqual(p.buildings.filter(b => b.kind === "foundry").map(b => b.level), [1, 4]);
});

test("credit bank can upgrade one level ahead of mission control and full-storage prompt names Credit Bank", () => {
  const p = startProgram();
  const cmd = p.buildings.find(b => b.kind === "command");
  const bank = p.buildings.find(b => b.kind === "bank");

  // Full credit storage prompt names Credit Bank
  p.credits = getStorageCaps(p).credits;
  p.collectors.credits = 100;
  const fullRes = collectResource(p, "credits");
  assert.equal(fullRes.collected, 0);
  assert.equal(fullRes.reason, "Credit storage full — upgrade Credit Bank to store more credits.");

  // MC Lv 1 allows Bank Lv 2 (1,400 C), blocks Bank Lv 3
  p.credits = 1400;
  assert.equal(canAffordUpgrade(p, "bank", 1).ok, true);
  assert.equal(canAffordUpgrade(p, "bank", 2).ok, false);
  assert.match(canAffordUpgrade(p, "bank", 2).reason, /Mission Control Lv 2/);

  // MC Lv 2 allows Bank Lv 3 (6,000 C) so players can hold 24,000 C for MC Lv 3 (18,000 C)
  cmd.level = 2;
  bank.level = 2;
  p.credits = 6000;
  assert.equal(canAffordUpgrade(p, "bank", 2).ok, true);
  assert.equal(canAffordUpgrade(p, "bank", 3).ok, false);
  assert.match(canAffordUpgrade(p, "bank", 3).reason, /Mission Control Lv 3/);
});

test("any contract can stage a custom VAB blueprint and survive save validation", () => {
  const save = fresh();
  const p = save.program;
  p.credits = 2000;
  p.propellant = 750;
  const bpId = p.blueprints[0].id;
  const check = inspectContractBlueprint(p, "hop", bpId);
  assert.equal(check.error, "");
  const staged = prepareContractBlueprint(p, "hop", bpId);
  assert.equal(staged.error, "");
  assert.ok(staged.flight);
  save.flight = staged.flight;
  const restored = validate(JSON.parse(JSON.stringify(save)));
  assert.equal(restored.program.sortie, "hop");
  assert.equal(restored.program.contractVehicle?.name, p.blueprints[0].name);
});
