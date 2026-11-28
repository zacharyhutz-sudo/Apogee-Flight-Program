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
  await expect(button("Orbital map")).toHaveText("Map");
  const clock = page.locator(".timer");
  for(let i=0;i<5;i++) await button("Zoom out").click();
  await expect(button("Focus craft")).toBeVisible();
  await expect(button("Flight view")).toHaveText("Rocket");
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
  await expect(button("Orbital map")).toHaveText("Map");
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

test("panning still works after pinching across the view boundary", async ({page,context},info) => {
  test.skip(info.project.name === "desktop","Touch gesture");
  const save = fresh();
  save.view = "flight";
  save.tutorial.status = "off";
  Object.assign(save.flight,{status:"flying",t:21,x:R+73000,vx:126,maxAlt:73000});
  await page.addInitScript(data => localStorage.setItem("apogee-v1:/apogee/",JSON.stringify(data)),save);
  await page.goto("./");
  const button = name => page.getByRole("button",{name,exact:true});
  await expect(button("Orbital map")).toBeEnabled();
  const {width,height} = page.viewportSize();
  const session = await context.newCDPSession(page);
  const touch = (type,touchPoints = []) => session.send("Input.dispatchTouchEvent",{type,touchPoints});
  // Begin the pinch on a fresh map drag and then repeat after a rocket handoff.
  for (const startInFlight of [false,true]) {
    if (!startInFlight) await button("Orbital map").click();
    const fingers = fraction => [-1,1].map((side,id) => ({id,x:width/2+side*width*fraction,y:height*0.44}));
    const [first,second] = fingers(0.37);
    await touch("touchStart",[first]);
    await touch("touchStart",[first,second]);
    for (const fraction of [0.28,0.18,0.12,0.05]) await touch("touchMove",fingers(fraction));
    await touch("touchEnd");
    await expect(button("Flight view")).toBeVisible();
    await button("Fit Earth").click();
    const anchor = page.getByText("EARTH",{exact:true});
    const before = await anchor.boundingBox();
    const start = {x:width*0.52,y:height*0.46,id:7};
    await touch("touchStart",[start]);
    for (const dx of [6,18,34,60]) await touch("touchMove",[{...start,x:start.x+dx}]);
    await touch("touchEnd");
    await expect.poll(async () => (await anchor.boundingBox()).x).toBeGreaterThan(before.x+40);
    await button("Flight view").click();
    await button("Recenter rocket").click();
  }
});

test("compact orbital pitch controls steer without taking over the map", async ({page,context},info) => {
  const save = fresh();
  save.view = "map";
  save.tutorial.status = "off";
  Object.assign(save.flight,{status:"flying",t:21,x:R+73000,vx:126,maxAlt:73000,pitch:0});
  await page.addInitScript(data => localStorage.setItem("apogee-v1:/apogee/",JSON.stringify(data)),save);
  await page.goto("./");
  const button = name => page.getByRole("button",{name,exact:true});
  const left = button("Hold to pitch left");
  const right = button("Hold to pitch right");
  await expect(left).toBeDisabled();
  await button("Resume").click();
  const readPitch = async () => parseInt(await page.locator(".telemetry .meter").filter({hasText:"PITCH"}).locator("strong").textContent(),10);
  const touch = info.project.name === "desktop" ? null : await context.newCDPSession(page);
  for (const [control, delta] of [[left,-1],[right,1]]) {
    const before = await readPitch();
    const box = await control.boundingBox();
    expect(box.width).toBe(44);
    expect(box.height).toBe(44);
    const x = box.x + box.width/2;
    const y = box.y + box.height/2;
    if (touch) {
      await touch.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
    } else {
      await page.mouse.move(x,y);
      await page.mouse.down();
    }
    try {
      await expect.poll(async () => delta*((await readPitch())-before)).toBeGreaterThan(4);
    } finally {
      if (touch) await touch.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
      else await page.mouse.up();
    }
  }
  await button("Pause").click();
  await button("Fit Earth").click();
  const anchor = page.getByText("EARTH",{exact:true});
  const before = await anchor.boundingBox();
  const {width,height} = page.viewportSize();
  await page.mouse.move(width/2,height*0.42);
  await page.mouse.down();
  await page.mouse.move(width/2+60,height*0.42,{steps:6});
  await page.mouse.up();
  await expect.poll(async () => (await anchor.boundingBox()).x).toBeGreaterThan(before.x+40);
});
