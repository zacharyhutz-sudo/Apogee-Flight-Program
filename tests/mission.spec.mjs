import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
// Advance foreground animation timestamps in small frames. The production game
// still integrates each 50 ms tick and receives every action from its real HUD.
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
test("launch, stage, insert, warp, reload and exchange a flight save", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await useFlightClock(page);
  await page.goto("./");
  await expect(page.locator(".flight-scene canvas")).toBeVisible();
  await page.getByRole("button", { name: "Orbital map", exact: true }).click();
  await page.getByRole("button", { name: "Time warp" }).click();
  await expect(page.getByRole("button", { name: "20×" })).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Flight view", exact: true }).click();
  await page.getByRole("button", { name: "Launch vehicle" }).click();
  await page.evaluate(() => window.advanceFlight(131));
  await expect(page.getByText("Stage ready", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Separate stage", exact: true })
    .click();
  await page.getByRole("button", { name: "Orbital map", exact: true }).click();
  await expect(page.getByLabel("Live Earth orbital map")).toBeVisible();
  await page.evaluate(() => window.advanceFlight(170));
  await expect(page.getByText("In orbit", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Time warp" }).click();
  await page.getByRole("button", { name: "20×" }).click();
  await expect(page.getByRole("button", { name: "Time warp" })).toHaveText(
    "20×",
  );
  await page.evaluate(() => window.advanceFlight(3));
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const snapshot = await downloadSave(page);
  expect(snapshot.flight.orbitEarned).toBe(true);
  expect(snapshot.flight.t).toBeGreaterThan(350);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeEnabled();
  expect((await downloadSave(page)).flight).toEqual(snapshot.flight);
  await page.getByRole("button", { name: "Mission menu" }).click();
  await page.getByRole("button", { name: "Mission data" }).click();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await page.getByRole("button", { name: "Start new flight" }).click();
  await expect(
    page.getByRole("button", { name: "Launch vehicle" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Mission menu" }).click();
  await page.getByRole("button", { name: "Mission data" }).click();
  const input = page.locator("input[type=file]");
  await input.setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole("alert")).toContainText("valid");
  await input.setInputFiles({
    name: "mission.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(snapshot)),
  });
  await page
    .getByRole("button", { name: "Restore flight", exact: true })
    .click();
  expect((await downloadSave(page)).flight).toEqual(snapshot.flight);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("offline cold reload from project URL keeps the local flight", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Launch vehicle" }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await page.evaluate(() => localStorage.clear()); // force the IndexedDB restore path
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".flight-scene canvas")).toBeVisible();
  await page.getByRole("button", { name: "Orbital map", exact: true }).click();
  await expect(page.getByLabel("Live Earth orbital map")).toBeVisible();
});
test("pilot inputs, map camera, stage confirmation and touch controls", async ({
  page,
}, info) => {
  await page.goto("./");
  const primary = page.getByRole("button", { name: "Launch vehicle" });
  await expect(primary).toBeEnabled();
  await page.getByLabel("Throttle", { exact: true }).fill("32");
  await expect(
    page.getByRole("button", { name: "Raise throttle to launch" }),
  ).toBeDisabled();
  await page.getByLabel("Throttle", { exact: true }).fill("100");
  await expect(primary).toBeInViewport();
  if (info.project.name !== "desktop") await primary.tap();
  else await primary.click();
  await page.getByLabel("Increase pitch by five degrees").click();
  await expect(page.getByLabel("Attitude", { exact: true })).toHaveValue(
    "manual",
  );
  await page.getByLabel("Throttle", { exact: true }).fill("82");
  await page
    .getByRole("button", { name: "Separate stage", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("remaining fuel");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Orbital map", exact: true }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.locator(".map-selection")).toContainText("1.6×");
  await page.getByRole("button", { name: "Track craft" }).click();
  await expect(page.locator(".map-selection")).toContainText("Pioneer 01");
  await page.getByRole("button", { name: "Fit Earth" }).click();
  await page.getByRole("button", { name: "Flight view", exact: true }).click();
  await expect(page.locator(".flight-scene canvas")).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  const data = await downloadSave(page);
  expect(data.flight.stage).toBe(0);
  expect(data.flight.mode).toBe("manual");
  expect(data.flight.throttle).toBe(0.82);
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
});
test("both worlds fill the viewport and mission text stays in overlays", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("button", { name: "Launch vehicle" }),
  ).toBeEnabled();
  for (const [mode, selector] of [
    ["flight", ".scene-wrap canvas"],
    ["map", ".orbital>svg"],
  ]) {
    if (mode === "map")
      await page.getByLabel("Orbital map", { exact: true }).click();
    const size = await page.locator(selector).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return [
        r.x,
        r.y,
        Math.abs(r.width - innerWidth),
        Math.abs(r.height - innerHeight),
      ];
    });
    expect(size.every((n) => Math.abs(n) < 2)).toBe(true);
    const scroll = await page.evaluate(
      () => document.documentElement.scrollHeight - innerHeight,
    );
    expect(scroll).toBeLessThanOrEqual(1);
    await expect(page.getByText("First orbit", { exact: true })).toHaveCount(0);
    for (const [button, content] of [
      ["Flight plan", "First orbit"],
      ["Event log", "Pioneer 01 cleared for flight."],
    ]) {
      await page.getByRole("button", { name: button, exact: true }).click();
      await expect(
        page.getByRole("dialog").getByText(content, { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close dialog" }).click();
    }
  }
});
test("moving the thrust lever up increases throttle", async ({ page }) => {
  await page.goto("./");
  const lever = page.getByLabel("Throttle", { exact: true });
  await expect(lever).toBeEnabled();
  const box = await lever.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.8);
  const low = Number(await lever.inputValue());
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.2);
  expect(low).toBeLessThan(45);
  expect(Number(await lever.inputValue())).toBeGreaterThan(55);
});
