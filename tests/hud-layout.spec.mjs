import { expect, test } from "@playwright/test";
import { fresh } from "../src/persistence/save.ts";

test("a fourth resource digit leaves the HUD stationary and all facility rows fit", async ({ page }) => {
  const save = fresh();
  Object.assign(save.program, { credits: 999, propellant: 999, collectors: { credits: 1, propellant: 1 } });
  await page.addInitScript((snapshot) => {
    const scope = new URL(".", location.href).pathname;
    localStorage.setItem("apogee-v1:" + scope, JSON.stringify(snapshot));
  }, save);
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Flight deck" })).toBeEnabled();
  const island = page.locator(".earth-canvas canvas");
  await expect(island).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const box = await island.boundingBox();
  const scale = Math.min(box.width / 455, box.height / 340, 2.35);
  const pills = page.locator(".res-pill");
  const bounds = () => pills.evaluateAll((els) => els.map(el => el.getBoundingClientRect().toJSON()));
  const before = await bounds();
  for (const [resource, x, y] of [["credits", 1, 3], ["propellant", 3, 2]]) {
    const badge = {
      x: box.width / 2 + (x - y) * 32 * scale,
      y: box.height * .49 + ((x + y) * 16 - 112 - 44) * scale,
    };
    // Asset decoding can finish after the HUD mounts. Retry until the badge responds.
    await expect(async () => {
      await island.click({ position: badge });
      await expect(page.locator(".res-pill." + resource + " strong")).toHaveText("1,000", { timeout: 350 });
    }).toPass();
    expect(await bounds()).toEqual(before);
  }
  await page.getByRole("button", { name: "Build", exact: true }).click();
  const rows = page.locator(".facilities-list button");
  await expect(rows).toHaveCount(9);
  const heights = await rows.evaluateAll(els => els.map(el => el.offsetHeight));
  expect(new Set(heights).size).toBe(1);
  const labelsFit = await rows.locator("strong, small, b").evaluateAll(els => els.every(el => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines = [...range.getClientRects()].filter(rect => rect.width > 0);
    return lines.length === 1 && el.scrollWidth <= el.clientWidth + 1;
  }));
  expect(labelsFit).toBe(true);
});
