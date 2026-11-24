import { expect, test } from "@playwright/test";
import { fresh } from "../src/persistence/save.ts";

test("store exchanges survive a reload and each shard removes ten minutes", async ({ page }) => {
  const save = fresh();
  save.tutorial.status = "off";
  save.program.research = 60;
  await page.addInitScript(save => {
    const key = "apogee-v1:" + new URL(".", location.href).pathname;
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(save));
  }, save);
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  const button = name => page.getByRole("button", { name, exact: true });
  await page.goto("./");
  await expect(page.getByLabel("Nova Shards: unlimited")).toHaveText("∞Shards");
  await button("Store").click();
  for (let i = 0; i < 5; i++) await button("Exchange 1 Nova Shard for 1000 credits").click();
  await button("Exchange 1 Nova Shard for 1000 propellant").click();
  await page.reload();
  await expect(page.locator(".credits strong")).toHaveText("5,300");
  await expect(page.locator(".propellant strong")).toHaveText("1,350");
  await button("Build").click();
  await button("Inspect Mission Control").click();
  await page.getByRole("button", {name: /^Upgrade ·/}).click();
  const boost = page.getByTitle("Spend 1 Nova Shard to speed up by 10 minutes");
  const deadline = () => page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("apogee-v1:" + new URL(".", location.href).pathname)).program;
    return p.buildings.find(b => b.kind === "command").upgradingUntilMs;
  });
  const before = await deadline();
  await boost.click();
  expect(await deadline()).toBe(before - 600000);
  await boost.click();
  await expect(boost).toHaveCount(0);
  await expect(page.locator(".inspector .lv-badge")).toContainText("Lv 2");
  await expect(page.locator(".res-pill.nova strong")).toHaveText("∞");
});
