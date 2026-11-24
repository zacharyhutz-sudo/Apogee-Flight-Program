import { expect, test } from "@playwright/test";
import { fresh } from "../src/persistence/save.ts";
import { prepare, payLaunch, settle } from "../src/program/program.ts";
import { step } from "../src/sim/flight.ts";

const button = (page, name) => page.getByRole("button", { name, exact: true });
const guide = page => page.getByRole("complementary", { name: "Milo's guidance" });
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem("apogee-v1:" + new URL(".", location.href).pathname)));

async function seed(page, snapshot) {
  await page.addInitScript(data => {
    const key = "apogee-v1:" + new URL(".", location.href).pathname;
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));
  }, snapshot);
}

function launchSnapshot(job) {
  const s = fresh();
  s.tutorial.status = "active";
  s.program.propellant = 900;
  s.flight = prepare(s.program, job);
  if (payLaunch(s.program)) throw Error("Invalid test launch");
  s.flight.status = "flying";
  s.view = "flight";
  return s;
}

test.beforeEach(async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", route => route.abort());
});

test("Milo guides a new program through a paid flight, reload and a single foundry purchase", async ({ page }) => {
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => raf(t => cb(t * 12));
  });
  await page.goto("./");
  await button(page, "Let’s fly").click();
  await button(page, "Contracts").click();
  await expect(guide(page)).toContainText("sponsor");
  await button(page, "Close dialog").click();
  await expect(button(page, "Contracts")).toHaveAttribute("data-milo-focus", "true");
  await button(page, "Contracts").click();
  await button(page, "Accept Atmospheric Sounding").click();
  await button(page, "Fly Sponsored Rocket").click();
  await expect(guide(page)).toContainText("tap Launch");
  await page.getByLabel("Throttle", {exact:true}).press("Home");
  await expect(guide(page)).toContainText("Raise the throttle");
  await page.getByLabel("Throttle", {exact:true}).press("End");
  await button(page, "Launch vehicle").click();
  await page.reload();
  await expect(guide(page)).toContainText("Resume");
  await button(page, "Resume").click();
  await expect(guide(page)).toContainText("+450 credits and +5 RD", {timeout: 30000});
  await button(page, "Earth launch site").click();
  await button(page, "Build").click();
  await button(page, "Build 2nd Solar Foundry").click();
  await expect(guide(page)).toContainText("open plot");
  await page.getByRole("button", {name:/^Confirm/}).click();
  await expect(guide(page)).toContainText("Two foundries");
  await button(page, "Got it").click();
  const data = await saved(page);
  expect(data.program.credits).toBe(150);
  expect(data.program.propellant).toBe(100);
  expect(data.program.completed.sounding).toBe(1);
  expect(data.program.buildings.filter(b => b.kind === "foundry")).toHaveLength(2);
  expect(data.tutorial.status).toBe("complete");
  await expect(guide(page)).toContainText("Credits ready");
  const island = page.locator(".earth-canvas canvas");
  const box = await island.boundingBox();
  const scale = Math.min(box.width / 455, box.height / 340, 2.35);
  const foundry = data.program.buildings.find(b => b.kind === "foundry");
  const badge = {
    x: box.width / 2 + (foundry.x - foundry.y) * 32 * scale,
    y: box.height * .49 + ((foundry.x + foundry.y) * 16 - 112 - 44) * scale,
  };
  await island.click({ position: badge });
  await expect(guide(page)).toHaveCount(0);
  expect((await saved(page)).program.credits).toBeGreaterThan(150);
  await expect(button(page, "Ask Milo for guidance")).toHaveCount(0);
  await page.reload();
  await expect(button(page, "Contracts")).toBeEnabled();
  await expect(button(page, "Ask Milo for guidance")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("legacy programs opt in, skip silently, and learn to save a named rocket", async ({page}) => {
  const s = fresh();
  delete s.tutorial;
  await seed(page, s);
  await page.goto("./");
  await expect(guide(page)).toHaveCount(0);
  await button(page, "Ask Milo for guidance").click();
  await button(page, "Hide tutorial").click();
  await page.reload();
  await expect(button(page, "Ask Milo for guidance")).toBeVisible();
  await button(page, "Ask Milo for guidance").click();
  await button(page, "Rocket Workshop").click();
  await expect(guide(page)).toContainText("save icon");
  await button(page, "Save rocket design").click();
  await page.locator("#bp-name-input").fill("Milo I");
  await button(page, "Save as New").click();
  await expect(guide(page)).toContainText("dropdown");
  await expect(page.getByLabel("Select blueprint")).toHaveAttribute("data-milo-focus", "true");
  await expect(page.locator("select[aria-label='Select blueprint'] option:checked")).toContainText("Milo I");
  await button(page, "Dismiss design lesson").click();
  expect((await saved(page)).tutorial.workshop).toBe("done");
});

test("Ask Milo button can be removed without completing the tutorial", async ({ page }) => {
  const s = fresh();
  s.tutorial.status = "off";
  await seed(page, s);
  await page.goto("./");
  await expect(button(page, "Ask Milo for guidance")).toBeVisible();
  await button(page, "Remove Ask Milo button").click();
  await expect(button(page, "Ask Milo for guidance")).toHaveCount(0);
  const data = await saved(page);
  expect(data.tutorial.status).toBe("off");
  expect(data.tutorial.hideInvite).toBe(true);
  await page.reload();
  await expect(button(page, "Ask Milo for guidance")).toHaveCount(0);
});

test("a shortfall offers an exit without spending or repeating the payout", async ({page}) => {
  const s = launchSnapshot("sounding");
  for (let i = 0; i < 12000 && !s.program.rewarded; i++) { step(s.flight); settle(s.program, s.flight); }
  expect(s.program.rewarded).toBe(true);
  s.program.credits = 100;
  s.view = "site";
  await seed(page, s);
  await page.goto("./");
  await expect(guide(page)).toContainText("later");
  await button(page, "Keep my resources").click();
  const data = await saved(page);
  expect(data.program.credits).toBe(100);
  expect(data.program.buildings.filter(b => b.kind === "foundry")).toHaveLength(1);
  expect(data.tutorial.status).toBe("complete");
});

test("a failed sounding flight can be restaged from the contract board", async ({page}) => {
  const s = launchSnapshot("sounding");
  step(s.flight);
  s.flight.throttle = 0;
  for (let i = 0; i < 12000 && s.flight.status === "flying"; i++) step(s.flight);
  expect(s.flight.status).not.toBe("flying");
  settle(s.program, s.flight);
  await seed(page, s);
  await page.goto("./");
  await expect(guide(page)).toContainText("Peak altitude");
  await button(page, "Earth launch site").click();
  await button(page, "Contracts").click();
  await button(page, "Accept Atmospheric Sounding").click();
  await button(page, "Fly Sponsored Rocket").click();
  await button(page, "Prepare flight").click();
  await expect(button(page, "Launch vehicle")).toBeEnabled();
});

test("the hop staging hint retires on actual separation", async ({page}) => {
  const s = launchSnapshot("hop");
  for (let i = 0; i < 20000 && s.flight.fuel[0] > 0; i++) step(s.flight);
  expect(s.flight.fuel[0]).toBe(0);
  await seed(page, s);
  await page.goto("./");
  await button(page, "Resume").click();
  await expect(guide(page)).toContainText("Booster’s dry");
  await button(page, "Separate stage").click();
  await expect(guide(page)).toHaveCount(0);
  expect((await saved(page)).tutorial.stagingSeen).toBe(true);
});
