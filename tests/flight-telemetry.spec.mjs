import { expect, test } from "@playwright/test";
import { fresh } from "../src/persistence/save.ts";
import { R } from "../src/sim/flight.ts";

for (const descending of [false, true]) {
  test(`shows one telemetry strip during ${descending ? "descent" : "ascent"} and keeps other metrics available`, async ({page}) => {
    const save = fresh();
    save.view = "flight";
    save.tutorial.status = "off";
    Object.assign(save.flight, {status:"flying", x:R+1200, vx:descending ? -217 : 217, vy:25, t:20, pitch:14, maxAlt:1200});
    await page.addInitScript(data => localStorage.setItem("apogee-v1:/apogee/",JSON.stringify(data)), save);
    await page.goto("./");
    const button = name => page.getByRole("button",{name,exact:true});
    await expect(button("Resume")).toBeVisible();
    const labels = page.locator(".telemetry .meter > span");
    await expect(labels).toHaveText(descending ? ["ALT","V/S","H/S","TILT"] : ["ALT","VEL","PITCH","S1 FUEL"]);
    await expect(page.getByRole("region",{name:"Landing descent telemetry"})).toHaveCount(descending ? 1 : 0);
    const details = button("Telemetry details");
    await details.click();
    await expect(page.locator(".telemetry-details .meter > span")).toHaveText(descending ? ["AP","PE","VEL","S1 FUEL"] : ["AP","PE"]);
    await expect(page.locator(".telemetry-details")).toBeVisible();
    await details.click();
    await expect(page.locator(".telemetry-details")).toBeHidden();

    await button("Orbital map").click();
    await expect(labels).toHaveText(["AP","PE","PITCH","S1 FUEL"]);
    await details.click();
    await expect(page.locator(".telemetry-details .meter > span")).toHaveText(["ALT","VEL"]);
    await expect(button("Resume")).toBeVisible();

    const strip = await page.locator(".telemetry").boundingBox();
    const first = await labels.first().boundingBox();
    const last = await labels.last().boundingBox();
    expect(last.y).toBeCloseTo(first.y);
    expect(strip.height).toBeLessThan(48);
    expect(await page.locator(".telemetry .meter strong").evaluateAll(nodes =>
      nodes.every(node => node.scrollWidth <= node.clientWidth+1))).toBe(true);
  });
}
