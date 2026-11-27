import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function useFlightClock(page) {
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window),
      caf = window.cancelAnimationFrame.bind(window);
    const frames = new Map();
    let seq = 0,
      offset = 0;
    window.requestAnimationFrame = (fn) => {
      const id = ++seq;
      const native = raf((t) => {
        if (frames.delete(id)) fn(t + offset);
      });
      frames.set(id, { native, fn });
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      const f = frames.get(id);
      if (f) {
        caf(f.native);
        frames.delete(id);
      }
    };
    window.advanceFlight = (seconds) => {
      const base = performance.now();
      for (let i = 0; i < seconds * 20; i++) {
        offset += 50;
        const pending = [...frames];
        frames.clear();
        for (const [, f] of pending) {
          caf(f.native);
          f.fn(base + offset);
        }
      }
    };
  });
}

async function downloadSave(page) {
  await page.getByRole("button", { name: "Mission menu" }).click();
  await page.getByRole("button", { name: "Mission data" }).click();
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const data = JSON.parse(await readFile(await (await waiting).path(), "utf8"));
  await page.getByRole("button", { name: "Close", exact: true }).click();
  return data;
}

test("v0.3 dual-economy flow: launch deducts resources, orbit completes contract, upgrades raise caps, reload preserves state", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await useFlightClock(page);
  const button = (name) => page.getByRole("button", { name, exact: true });

  await page.goto("./");
  const resources = page.getByLabel("Program resources");
  await expect(resources).toContainText("600");
  await expect(resources).toContainText("900");

  // Accept First Stable Orbit (500 C / 750 Prop) and launch
  await button("Contracts").click();
  await expect(button("Accept High Elliptical Relay")).toBeDisabled();
  await button("Accept First Stable Orbit").click();
  await expect(page.getByLabel("Launch cost")).toContainText("500 C");
  await expect(page.getByLabel("Launch cost")).toContainText("750 Prop");
  await expect(button("Simulate Free")).toBeEnabled();

  await button("Launch vehicle").click();
  await page.evaluate(() => window.advanceFlight(131));
  await expect(page.getByText("Stage ready", { exact: true })).toBeVisible();
  await button("Separate stage").click();
  await page.evaluate(() => window.advanceFlight(175));
  await expect(
    page.getByText(/First Stable Orbit complete/).first(),
  ).toBeVisible();

  // Return to Earth launch site and verify payout (600 - 500 + 2800 = 2,900 C, 35 RD)
  await button("Earth launch site").click();
  await button("Dismiss message").click();
  await expect(resources).toContainText("2,900");
  await expect(resources).toContainText("35");

  // Fly Atmospheric Sounding (0 C / 150 Prop) to reach 40 RD for Mission Control Lv 2
  await button("Contracts").click();
  await button("Accept Atmospheric Sounding").click();
  await button("Prepare flight").click();
  await button("Launch vehicle").click();
  await page.evaluate(() => window.advanceFlight(120));
  await expect(
    page.getByText(/Atmospheric Sounding complete/).first(),
  ).toBeVisible();
  await button("Earth launch site").click();
  await button("Dismiss message").click();
  await expect(resources).toContainText("40");

  // Upgrade Mission Control to Lv 2 (2,200 C + 40 RD)
  await button("Build").click();
  await button("Inspect Mission Control").click();
  await page.getByRole("button", { name: /Upgrade · 2,200 C/ }).click();
  await expect(page.getByText("Lv 2/4")).toBeVisible();
  await button("Close inspector").click();

  // Upgrade Cryo Tank Farm to Lv 2 (1,000 C) -> raises Propellant cap from 1,000 to 2,800
  await button("Build").click();
  await button("Inspect Cryo Tank Farm").click();
  await page.getByRole("button", { name: /Upgrade · 1,000 C/ }).click();
  await expect(page.getByText("2,800 Prop cap")).toBeVisible();
  await expect(resources).toContainText("/2,800");

  // Reload and verify exact economy state persists
  await page.reload();
  await expect(resources).toContainText("/2,800");
  await button("Flight deck").click();
  const saved = await downloadSave(page);
  expect(saved.version).toBe(3);
  expect(saved.program.buildingLevels.command).toBe(2);
  expect(saved.program.buildingLevels.tanks).toBe(2);
  expect(saved.program.completed.orbit).toBe(1);
  expect(saved.program.completed.sounding).toBe(1);
  expect(errors).toEqual([]);
});

test("free simulation mode costs 0 credits and 0 propellant and awards 0 payout", async ({
  page,
}) => {
  await useFlightClock(page);
  const button = (name) => page.getByRole("button", { name, exact: true });
  await page.goto("./");
  await button("Flight deck").click();
  await button("Launch vehicle").click();
  await page.evaluate(() => window.advanceFlight(131));
  await button("Separate stage").click();
  await page.evaluate(() => window.advanceFlight(175));
  await expect(page.getByText("In orbit", { exact: true })).toBeVisible();
  const saved = await downloadSave(page);
  expect(saved.program.credits).toBe(600);
  expect(saved.program.research).toBe(0);
  expect(saved.program.paid).toBe(false);
});

test("mobile and desktop touch targets are >= 44 CSS px with zero horizontal overflow", async ({
  page,
}) => {
  await page.goto("./");
  const checkViewport = async () => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    expect(overflow).toBe(false);
    const small = await page
      .locator("button:visible,select:visible,input[type=range]:visible")
      .evaluateAll((els) =>
        els
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width < 43.9 || r.height < 43.9;
          })
          .map((el) => el.getAttribute("aria-label") || el.textContent),
      );
    expect(small).toEqual([]);
  };

  await checkViewport();
  await page.getByRole("button", { name: "Flight deck", exact: true }).click();
  await checkViewport();
  await page.getByRole("button", { name: "Orbital map", exact: true }).click();
  await expect(
    page.getByLabel("Tracking Station maneuver node status"),
  ).toContainText("Tracking Lv 2");
  await checkViewport();
});

test("Workshop rockets fly paid Atmospheric Sounding missions with persistent costs and reports", async ({ page }) => {
  await useFlightClock(page);
  const button = (name) => page.getByRole("button", { name, exact: true });
  const checkpoint = () => page.evaluate(() =>
    JSON.parse(localStorage.getItem("apogee-v1:" + new URL(".", document.baseURI).pathname)),
  );
  const report = page.getByRole("dialog", { name: "Sounding report" });

  await page.goto("./");
  await button("Rocket Workshop").click();
  await page.getByLabel("Select blueprint").selectOption("bp_sounding_dart");
  await button("Save rocket design").click();
  await button("Clone blueprint").click();
  await button("Parts").click();
  await button("Add Medium Cryo Tank").click();
  await button("Quick add").click();
  const heavyId = await page.getByLabel("Select blueprint").inputValue();
  const heavyName = await page.getByLabel("Select blueprint").locator("option:checked").textContent();
  await button("Earth launch site").click();

  for (const [index, vehicle] of [
    { id: heavyId, name: heavyName.replace(/ \(v\d+\)$/, "").trim(), credits: 440, propellant: 540 },
    { id: "bp_sounding_dart", name: "Sounding Arrow", credits: 300, propellant: 180 },
  ].entries()) {
    await button("Contracts").click();
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: "Atmospheric Sounding" }) });
    await expect(card).toContainText("0 C (Sponsored)");
    await card.getByLabel("Vehicle").selectOption(vehicle.id);
    await expect(card).toContainText(vehicle.credits + " C");
    await expect(card).toContainText(vehicle.propellant + " Prop");
    await expect(card).toContainText("+450 C");
    await button("Accept Atmospheric Sounding").click();
    if (index > 0) await button("Prepare flight").click();
    await expect(page.getByRole("status")).toContainText(vehicle.name);
    const staged = await checkpoint();

    await page.reload();
    await expect(button("Launch vehicle")).toBeEnabled();
    await expect(page.getByRole("status")).toContainText(vehicle.name);
    await expect(page.getByLabel("Launch cost")).toContainText(vehicle.credits + " C");
    await expect(page.getByLabel("Launch cost")).toContainText(vehicle.propellant + " Prop");
    await button("Launch vehicle").click();
    const launched = await checkpoint();
    expect(launched.program.credits).toBe(staged.program.credits - vehicle.credits);
    expect(launched.program.propellant).toBe(staged.program.propellant - vehicle.propellant);

    await page.evaluate(() => window.advanceFlight(120));
    await expect(page.getByRole("alert")).toContainText("Atmospheric Sounding complete");
    await page.reload();
    await button("Mission menu").click();
    await button("Sounding report").click();
    await expect(report).toContainText(vehicle.name);
    await expect(report).toContainText("Reached");
    await expect(report).toContainText("450 C + 5 RD");
    await expect(report).toContainText(vehicle.credits + " C");
    await expect(report).toContainText(vehicle.propellant + " Prop");
    await button("Close dialog").click();
    if (await button("Resume").count()) {
      await button("Resume").click();
      await page.evaluate(() => window.advanceFlight(180));
    }
    const completed = await checkpoint();
    expect(completed.program.credits).toBe(launched.program.credits + 450);
    expect(completed.program.research).toBe((index + 1) * 5);
    expect(completed.program.completed.sounding).toBe(index + 1);
    await button("Earth launch site").click();
  }

  await page.reload();
  await button("Contracts").click();
  await button("Sounding report").click();
  await expect(report).toContainText("Sounding Arrow");
  await expect(report).toContainText("450 C + 5 RD");
});
