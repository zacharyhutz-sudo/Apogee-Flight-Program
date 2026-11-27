import { expect, test } from "@playwright/test";
import { fresh } from "../src/persistence/save.ts";

const button = (page, name) => page.getByRole("button", { name, exact: true });

async function seed(page, change = () => {}) {
  const data = fresh();
  data.view = "workshop";
  Object.assign(data.tutorial, {
    status: "off",
    workshop: "done",
    vabStep: "done",
  });
  change(data);
  await page.addInitScript((s) => {
    const key = "apogee-v1:" + new URL(".", location.href).pathname;
    if (!localStorage.getItem(key))
      localStorage.setItem(key, JSON.stringify(s));
  }, data);
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.goto("./");
  await expect(page.getByLabel("Rocket assembly bay")).toBeVisible();
}

async function tapCenter(page, locator) {
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function selectCatalog(page, category, name) {
  await button(page, "Parts").click();
  await page
    .getByLabel("Part catalog")
    .getByRole("button", { name: category, exact: true })
    .click();
  await button(page, "Add " + name).click();
}

test("fit, select and restage the decoupler, save and recover the design", async ({
  page,
}) => {
  await seed(page);
  const bp = page.getByLabel("Select blueprint");
  const bay = page.locator(".vab-svg");
  const initial = await bay.boundingBox();
  expect(initial.height / page.viewportSize().height).toBeGreaterThan(0.65);
  const pod = await page.locator('[data-part-uid="p1"]').boundingBox();
  const engine = await page.locator('[data-part-uid="p6"]').boundingBox();
  expect((engine.y + engine.height - pod.y) / initial.height).toBeGreaterThan(
    0.67,
  );
  const view = await bay.getAttribute("viewBox");
  await button(page, "Zoom in").click();
  await expect(bay).not.toHaveAttribute("viewBox", view);
  await button(page, "Fit rocket").click();
  await expect(bay).toHaveAttribute("viewBox", view);
  await tapCenter(page, page.locator('[data-part-uid="p4"]'));
  await expect(page.locator(".vab-drawer-heading")).toContainText(
    "Stage Decoupler",
  );
  await button(page, "Switch stage").click();
  await expect(page.locator(".part-toolbar-name")).toHaveText("Stage 2");
  await button(page, "Stages").click();
  await expect(page.locator(".vab-stage-list section").last()).toContainText(
    "Stage Decoupler",
  );
  await page.locator('[data-stage-part="p4"]').click();
  await expect(page.locator(".vab-drawer-heading")).toContainText(
    "Stage Decoupler",
  );
  await button(page, "Save rocket design").click();
  await page.getByLabel("Design Name", { exact: false }).fill("Pioneer Test");
  await button(page, "Save as New").click();
  await page.reload();
  await expect(bp.locator("option:checked")).toHaveText(/Pioneer Test/);
  await button(page, "Stages").click();
  await expect(page.locator(".vab-stage-list section").last()).toContainText(
    "Stage Decoupler",
  );
});

test("attach and simulate a mirrored side stack by tapping sockets", async ({
  page,
}) => {
  await seed(page, (s) => {
    s.program.activeBlueprintId = "bp_sounding_dart";
  });
  await selectCatalog(page, "Staging", "Side Bracket");
  await tapCenter(
    page,
    page.locator('[data-socket="tank-flank"] circle').first(),
  );
  await expect(page.locator(".vab-drawer-heading")).toContainText(
    "Side Bracket",
  );
  await expect(page.getByLabel("Toggle mirror symmetry")).toContainText("2×");
  await selectCatalog(page, "Tanks", "Small Cryo Tank");
  await tapCenter(
    page,
    page.locator('[data-socket="side-insert"] circle').first(),
  );
  await expect(page.locator(".vab-drawer-heading")).toContainText(
    "Small Cryo Tank",
  );
  await selectCatalog(page, "Engines", "Dart Vacuum Engine");
  await tapCenter(
    page,
    page.locator('[data-socket="side-insert"] circle').first(),
  );
  await expect(page.locator(".vab-drawer-heading")).toContainText(
    "Dart Vacuum Engine",
  );
  await button(page, "Preflight").click();
  await expect(page.locator(".flight-checks")).not.toContainText(
    "Dart Vac must be placed",
  );
  await expect(page.locator(".vab-metrics")).toBeVisible();
  await expect(page.getByLabel("Pilot assignment")).toContainText(
    "Uncrewed probe",
  );
  await expect(button(page, "Simulate Free")).toBeEnabled();
  await button(page, "Simulate Free").click();
  await expect(button(page, "Launch vehicle")).toBeVisible();
});

test("dropping outside cancels relocation and preflight identifies the precise unfed engine", async ({
  page,
}) => {
  await seed(page, (s) => {
    const bp = s.program.blueprints.find(
      (b) => b.id === s.program.activeBlueprintId,
    );
    bp.parts.unshift({
      uid: "test-unfed",
      partId: "eng_dart",
      stage: 0,
      symmetry: 1,
    });
  });
  const part = page.locator('[data-part-uid="p4"]');
  const box = await part.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(3, 3, { steps: 8 });
  await page.mouse.up();
  await expect(part).toHaveCount(1);
  await button(page, "Preflight").click();
  await page.getByRole("button", { name: /Dart Vac must be placed/ }).click();
  await expect(page.locator(".vab-drawer-heading")).toContainText(
    "Dart Vacuum Engine",
  );
  await button(page, "Remove part").click();
  await expect(page.locator('[data-part-uid="test-unfed"]')).toHaveCount(0);
  await expect(page.locator('[data-part-uid="p3"]')).toHaveCount(1);
});

test("stage a named blueprint for the quoted Sounding price", async ({
  page,
}) => {
  await seed(page);
  await button(page, "Earth launch site").click();
  await button(page, "Contracts").click();
  await button(page, "Accept Atmospheric Sounding").click();
  await expect(page.locator(".vab-drawer-heading")).toHaveText("Preflight");
  await page.getByLabel("Select blueprint").selectOption("bp_sounding_dart");
  await expect(button(page, "Fly Sponsored Rocket")).toContainText("150 P");
  const fly = button(page, "Fly Atmospheric Sounding with Sounding Arrow");
  await expect(fly).toBeEnabled();
  const quote = await fly.locator(".vab-launch-price span").allTextContents();
  await fly.click();
  const cost = page.getByLabel("Launch cost");
  await expect(cost).toContainText(quote[0] + " C");
  await expect(cost).toContainText(quote[1] + " Prop");
  await page.reload();
  await expect(cost).toContainText(quote[0] + " C");
});

test("fit and navigate a tall mirrored vehicle without editing the design", async ({
  page,
}) => {
  await seed(page, (s) => {
    const bp = s.program.blueprints[0];
    for (let n = 0; n < 8; n++)
      bp.parts.splice(4, 0, {
        uid: "extra-" + n,
        partId: "tank_m",
        stage: 0,
        symmetry: 1,
      });
    bp.parts.push(
      {
        uid: "bracket",
        partId: "bracket_side",
        stage: 0,
        symmetry: 2,
        mount: "side",
        parentUid: "p5",
      },
      {
        uid: "side-tank",
        partId: "tank_m",
        stage: 0,
        symmetry: 2,
        mount: "side",
        parentUid: "bracket",
      },
    );
  });
  const svg = page.locator(".vab-svg");
  const bay = await svg.boundingBox();
  const original = await svg.getAttribute("viewBox");
  for (const part of await page.locator("[data-part-uid]").all()) {
    const r = await part.boundingBox();
    expect(r.x).toBeGreaterThanOrEqual(bay.x);
    expect(r.x + r.width).toBeLessThanOrEqual(bay.x + bay.width);
    expect(r.y).toBeGreaterThanOrEqual(bay.y);
    expect(r.y + r.height).toBeLessThanOrEqual(bay.y + bay.height);
  }
  if (test.info().project.use.hasTouch) {
    const session = await page.context().newCDPSession(page);
    const x = bay.x + bay.width / 2,
      y = bay.y + bay.height / 2;
    const touch = (type, pts) =>
      session.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
    const finger = (id, dx) => ({ id, x: x + dx, y });
    await touch("touchStart", [finger(1, 0)]);
    await touch("touchStart", [finger(1, 0), finger(2, 45)]);
    await touch("touchMove", [finger(1, -25), finger(2, 80)]);
    await touch("touchEnd", []);
  } else {
    await page.mouse.move(bay.x + bay.width * 0.2, bay.y + bay.height * 0.6);
    await page.mouse.down();
    await page.mouse.move(bay.x + bay.width * 0.25, bay.y + bay.height * 0.65, {
      steps: 4,
    });
    await page.mouse.up();
  }
  await expect(svg).not.toHaveAttribute("viewBox", original);
  await expect(page.getByLabel("Workshop panel")).toHaveCount(0);
  await button(page, "Fit rocket").click();
  await expect(svg).toHaveAttribute("viewBox", original);
  await expect(
    page.getByLabel("Select blueprint").locator("option:checked"),
  ).toContainText("v1");
});

test("tutorial opens the matching tools and catalog dragging attaches a part", async ({
  page,
}) => {
  await seed(page, (s) =>
    Object.assign(s.tutorial, { status: "active", vabStep: 0 }),
  );
  await button(page, "Next").click();
  await expect(page.getByLabel("Vehicle engineering readouts")).toBeVisible();
  await button(page, "Next").click();
  await expect(page.getByLabel("Part catalog")).toBeVisible();
  await button(page, "Skip VAB tour").click();
  const from = await button(page, "Add Small Cryo Tank")
    .locator("svg")
    .first()
    .boundingBox();
  const tank = await page.locator('[data-part-uid="p2"]').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(tank.x + tank.width / 2, tank.y + tank.height, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(page.locator(".vab-drawer-heading")).toHaveText(
    "Small Cryo Tank",
  );
  await expect(page.locator("[data-part-uid]")).toHaveCount(7);
  await selectCatalog(page, "Tanks", "Small Cryo Tank");
  await button(page, "Quick add").click();
  await expect(page.locator("[data-part-uid]")).toHaveCount(8);
});
