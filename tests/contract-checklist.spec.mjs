import { expect, test } from "@playwright/test";

test("the active contract checks off in the launch HUD and clears for a free flight", async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => raf(time => callback(time * 12));
  });
  const button = name => page.getByRole("button", { name, exact: true });
  const panel = page.getByRole("region", { name: "Active contract" });
  const checkbox = name => panel.getByRole("checkbox", { name, exact: true });
  await page.goto("./");
  await button("Let’s fly").click();
  await button("Contracts").click();
  await button("Accept Atmospheric Sounding").click();
  await button("Fly Sponsored Rocket").click();
  await expect(panel.getByRole("heading")).toHaveText("Atmospheric Sounding");
  await expect(checkbox("Lift off")).not.toBeChecked();
  await expect(checkbox("Reach 15 km")).not.toBeChecked();
  await button("Launch vehicle").click();
  await expect(checkbox("Lift off")).toBeChecked();
  await expect(checkbox("Reach 15 km")).toBeChecked({ timeout: 30000 });
  // The readout and Milo must both fit without covering each other or the controls.
  const box = await panel.boundingBox();
  const { width, height } = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(box.y + box.height).toBeLessThan(height);
  for (const target of [".flight-milo", ".telemetry", ".hud-bottom"]) {
    const other = await page.locator(target).boundingBox();
    expect(box.x >= other.x + other.width || other.x >= box.x + box.width ||
      box.y >= other.y + other.height || other.y >= box.y + box.height).toBe(true);
  }
  await page.reload();
  await expect(checkbox("Reach 15 km")).toBeChecked();
  await button("Orbital map").click();
  await expect(panel).toHaveCount(0);
  await button("Flight view").click();
  await expect(checkbox("Reach 15 km")).toBeChecked();
  await button("Earth launch site").click();
  await button("Contracts").click();
  await page.getByRole("button", {name:/Free simulation ·/}).click();
  await button("Prepare flight").click();
  await expect(button("Launch vehicle")).toBeEnabled();
  await expect(panel).toHaveCount(0);
});
