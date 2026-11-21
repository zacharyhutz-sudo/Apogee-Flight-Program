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
  await page.getByRole("button", { name: "Flight deck", exact: true }).click();
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
  await page.getByRole("button", { name: "Flight deck", exact: true }).click();
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
  await page.getByRole("button", { name: "Flight deck", exact: true }).click();
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
  await page.getByRole("button", { name: "Flight deck", exact: true }).click();
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
  await page.getByRole("button", { name: "Flight deck", exact: true }).click();
  const lever = page.getByLabel("Throttle", { exact: true });
  await expect(lever).toBeEnabled();
  const box = await lever.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.8);
  const low = Number(await lever.inputValue());
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.2);
  expect(low).toBeLessThan(45);
  expect(Number(await lever.inputValue())).toBeGreaterThan(55);
});
test("commission a mission, spend its payout, unlock the survey launch, and restore the site", async ({
  page,
}) => {
  await useFlightClock(page);
  const button = (name) => page.getByRole("button", { name, exact: true });
  const close = () => button("Close dialog").click();
  await page.goto("./");
  await button("Contracts").click();
  await expect(button("Accept Polar orbit")).toBeDisabled();
  await button("Accept Suborbital hop").click();
  await button("Launch vehicle").click();
  await page.evaluate(() => window.advanceFlight(131));
  await button("Separate stage").click();
  await page.evaluate(() => window.advanceFlight(55));
  await expect(
    page.getByText(/Suborbital hop complete ·/).first(),
  ).toBeVisible();
  await button("Earth launch site").click();
  await button("Dismiss message").click();
  const wallet = page.getByLabel("Program resources");
  await expect(wallet).toContainText("180");
  await button("Facilities").click();
  await button("Build Research Lab").click();
  await button("Confirm placement").click();
  await expect(wallet).toContainText("115");
  await button("Close inspector").click();
  await button("Facilities").click();
  await button("Inspect Launchpad").click();
  await page.getByRole("button", { name: /Upgrade · 105/ }).click();
  await expect(
    page.getByText("Level 2 · 347 t · 55 m clearance"),
  ).toBeVisible();
  await page.reload();
  await expect(wallet).toContainText("10");
  await button("Facilities").click();
  await expect(button("Inspect Research Lab")).toBeEnabled();
  await close();
  await button("Contracts").click();
  await expect(button("Accept Polar orbit")).toBeDisabled();
  await expect(page.getByText(/Insufficient credits/).first()).toBeVisible();
  await button("Accept Suborbital hop").click();
  await button("Prepare flight").click();
  await button("Launch vehicle").click();
  await page.evaluate(() => window.advanceFlight(131));
  await button("Separate stage").click();
  await page.evaluate(() => window.advanceFlight(55));
  await button("Earth launch site").click();
  await button("Dismiss message").click();
  await button("Contracts").click();
  await button("Accept Polar orbit").click();
  await button("Prepare flight").click();
  await button("Launch vehicle").click();
  await page.evaluate(() => window.advanceFlight(131));
  await button("Separate stage").click();
  await page.evaluate(() => window.advanceFlight(180));
  await button("Orbital map").click();
  await button("Time warp").click();
  await button("20×").click();
  await page.evaluate(() => window.advanceFlight(85));
  const saved = await downloadSave(page);
  expect(saved.program.rewarded).toBe(true);
  expect(saved.program.completed).toEqual({ hop: 2, orbit: 0, polar: 1 });
  expect(saved.program.credits).toBe(315);
  expect(saved.program.research).toBe(19);
  expect(saved.flight.cargo).toBe(4000);
  expect(saved.program.elapsed).toBeGreaterThan(saved.flight.t);
  await page.reload();
  const reloaded = await downloadSave(page);
  expect(reloaded.program).toEqual(saved.program);
});
test("tap a plot, preview blocked ground, build and relocate a facility", async ({
  page,
}) => {
  await page.goto("./");
  const button = (name) => page.getByRole("button", { name, exact: true });
  await button("Facilities").click();
  await button("Build Fuel Storage").click();
  const tapPlot = async (x, y) => {
    const { width: w, height: h } = page.viewportSize();
    const z = Math.min(w / 455, h / 340, 2.35);
    await page.mouse.click(
      w / 2 + (x - y) * 32 * z,
      h * 0.49 + ((x + y) * 16 - 112) * z,
    );
  };
  await tapPlot(3, 4);
  await expect(button("Confirm placement")).toBeDisabled();
  await tapPlot(4, 1);
  await expect(button("Confirm placement")).toBeEnabled();
  await button("Confirm placement").click();
  await expect(
    page.getByRole("heading", { name: "Fuel Storage" }),
  ).toBeVisible();
  await button("Move").click();
  await tapPlot(1, 1);
  await button("Confirm placement").click();
  await expect(page.getByText("Plot B2")).toBeVisible();
  await button("Close inspector").click();
  await button("Zoom in on site").click();
  await button("Center site").click();
  await page.reload();
  await button("Facilities").click();
  await button("Inspect Fuel Storage").click();
  await expect(page.getByText("Plot B2")).toBeVisible();
  await expect(page.getByLabel("Program resources")).toContainText("25");
});
test("upgrade an existing v1 IndexedDB orbit and retain it when visiting Earth", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Flight deck", exact: true }).click();
  await page.getByRole("button", { name: "Launch vehicle" }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const newSave = await downloadSave(page);
  const old = {
    version: 1,
    revision: newSave.revision + 50,
    view: "map",
    flight: { ...newSave.flight },
    log: newSave.log,
  };
  delete old.flight.cargo;
  await page.evaluate(async (raw) => {
    const name = "apogee-v1:" + new URL(".", document.baseURI).pathname;
    localStorage.removeItem(name);
    await new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onsuccess = () => {
        const db = req.result,
          tx = db.transaction("missions", "readwrite");
        tx.objectStore("missions").put(raw, "active");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, old);
  await page.reload();
  await expect(page.getByLabel("Live Earth orbital map")).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume" })).toBeEnabled();
  await page
    .getByRole("button", { name: "Earth launch site", exact: true })
    .click();
  await page.getByRole("button", { name: "Flight deck", exact: true }).click();
  const migrated = await downloadSave(page);
  expect(migrated.version).toBe(2);
  expect(migrated.flight).toEqual({ ...old.flight, cargo: 0 });
  expect(migrated.program.credits).toBe(80);
  expect(migrated.program.sortie).toBe("practice");
});
