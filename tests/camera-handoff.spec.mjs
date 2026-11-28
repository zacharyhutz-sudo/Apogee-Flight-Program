import { expect, test } from "@playwright/test";
import { fresh } from "../src/persistence/save.ts";
import { R } from "../src/sim/flight.ts";

test("zoom handoff keeps flight running and the map toolbar reachable", async ({page}) => {
  const save = fresh();
  Object.assign(save.flight, {status:"flying", t:21, x:R+1300, vx:126, maxAlt:1300});
  save.view = "flight";
  save.tutorial.status = "off";
  await page.addInitScript(data => localStorage.setItem("apogee-v1:/apogee/",JSON.stringify(data)), save);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("./");
  const button = name => page.getByRole("button",{name,exact:true});
  await button("Resume").click();
  const clock = page.locator(".timer");
  for(let i=0;i<5;i++) await button("Zoom out").click();
  await expect(button("Focus craft")).toBeVisible();
  const map = page.getByLabel("Live orbital map");
  const largest = await map.locator("circle[r]").evaluateAll(nodes => Math.max(...nodes.map(n => n.r.baseVal.value)));
  expect(largest).toBeLessThan(8*Math.max(page.viewportSize().width,page.viewportSize().height));
  const time = await clock.innerText();
  await expect(clock).not.toHaveText(time);
  const bar = await page.locator(".map-tools").boundingBox();
  expect(bar.y).toBeLessThan(page.viewportSize().height*0.35);
  await button("Pause").click();
  await button("Fit Earth").click();
  await button("Focus Moon").click();
  await expect(button("Resume")).toBeVisible();
  await button("Resume").click();
  await button("Flight view").click();
  await expect(button("Recenter rocket")).toBeVisible();
  expect(errors).toEqual([]);
});

test("wheel handoffs work repeatedly with a paused flight", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Mouse wheel");
  const save = fresh();
  save.view = "flight";
  Object.assign(save.flight, {status:"flying", x:R+1300, vx:126, t:21, maxAlt:1300});
  await page.addInitScript(data => localStorage.setItem("apogee-v1:/apogee/",JSON.stringify(data)),save);
  await page.goto("./");
  const button = name => page.getByRole("button",{name,exact:true});
  await expect(button("Resume")).toBeEnabled();
  const time = await page.locator(".timer").innerText();
  await page.mouse.move(680,450);
  for(let i=0;i<4;i++) {
    await button("Recenter rocket").click();
    await page.mouse.move(680,450);
    await page.mouse.wheel(0,320);
    await page.mouse.wheel(0,320);
    await expect(button("Focus craft")).toBeVisible();
    await page.mouse.wheel(0,-320);
    await expect(button("Recenter rocket")).toBeVisible();
  }
  await expect(page.locator(".timer")).toHaveText(time);
  await button("Resume").click();
  await expect(page.locator(".timer")).not.toHaveText(time);
});
