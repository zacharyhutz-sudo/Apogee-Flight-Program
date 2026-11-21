# Apogee Flight Program

Version 0.2 combines the full-screen flight simulator with an isometric Earth launch site, three repeatable contracts, and a persistent upgrade economy. New programs begin at Earth range. An existing v0.1 program resumes in its saved flight or map view. Tap the building icon beside the vehicle name to visit the site.

## Play the Earth range milestone

1. Open **Contracts → Suborbital hop → Accept**, then launch at full thrust. At booster burnout around T+02:10, tap **Stage**. Cross 100 km to earn the base reward of 100 credits and 4 research. This sponsored flight is always available, even with an empty treasury.
2. Tap the building icon to return to **Earth range**. Open **Facilities → Research Lab**, tap an outlined free plot, and confirm placement for 65 credits. One level of research lab adds 1 research to future contract rewards.
3. Inspect the **Launchpad** and upgrade it for 105 credits and 3 research. Level 2 supports vehicles up to 347 t and 55 m. That clears the 314.1 t, 49 m Pioneer Survey for a polar mission. A second hop can fund the launch if you have spent your remaining credits on facilities.
4. In **Polar orbit**, the game dispatches Pioneer Survey into a northbound 90° plane. Stage and reach orbit, then open the orbital map and coast toward 75° N. The survey pays once you reach that latitude in a stable low orbit.

Tap structures to inspect them. Drag or pinch the site to move the camera. Zoom and recenter buttons are available. The Facilities list also opens each building inspector. When placing or relocating, green previews are valid and red previews are blocked. Keyboard arrows move a placement preview by one plot. Roads, water, groves, rock, occupied plots, and the launchpad safety buffer restrict construction.

| Contract | Base ignition fee | Base reward | Milestone |
| --- | ---: | --- | --- |
| Suborbital hop | Sponsored | 100 credits, 4 research | Cross 100 km |
| First orbit | 45 credits | 180 credits, 7 research | Reach stable low Earth orbit |
| Polar orbit | 70 credits | 275 credits, 12 research | Reach 75° N in low orbit with the 4 t survey payload |

Fuel Storage cuts each paid ignition fee by 10 credits per level. The Research Lab adds 1 research per level. Command Center upgrades add 15 credits per level above the first. The launchpad raises clearance and mass limits. All four buildings can move and reach level 3. Construction is immediate and mission rewards are fixed at ignition. The program clock follows flight time, including warp, and runs at normal speed at the idle site or pad. Pausing a vehicle or closing the game suspends its clock. Economy changes come from player actions and missions.

Fees are deducted at ignition. Each dispatch uses a fresh vehicle, and a crash forfeits the fee. A qualifying flight receives its reward automatically once. Starting a new dispatch asks before retiring an existing flight. **Free simulation** flies the starter rocket without fees or rewards.

## Publish the included build

1. Extract the ZIP. Upload the extracted contents to the root of a GitHub repository on `main`. The root should contain `README.md`, `package.json`, `src/`, and `docs/`.
2. In **Settings → Pages**, select **Deploy from a branch**. Choose **main** and **/docs**, then save.
3. Open the site URL shown in Pages settings when deployment finishes. The compiled game in `docs/` is ready to serve. All images, fonts, and game code ship with it.

For automatic builds after source changes, include `.github/workflows/pages.yml` and select **GitHub Actions** as the Pages source. Then push to `main` or run **Actions → Test and deploy Apogee → Run workflow**. The workflow installs locked dependencies, tests the simulator, builds the production files, runs the browser suite, and publishes if the repository uses Actions as its Pages source. With branch publishing, rebuild and commit `docs/` whenever you change the source.

[GitHub Pages publishing settings](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Fly the first mission

1. Leave **Ascent guide** selected, set throttle to **100%**, and tap **Launch**. The guide adjusts attitude in response to altitude and velocity. You control staging and can take over pitch at any time.
2. At approximately **T+02:10**, the booster empties. Tap **Stage**. The upper engine inherits your throttle. Early separation discards remaining booster propellant and asks for confirmation.
3. Open **Orbital map** while the engine runs. The solid line is the current thrust-free trajectory. **Ap** is the highest altitude. **Pe** is the lowest. A negative Pe intersects Earth. Subsurface portions of a path are hidden.
4. With prompt staging, the guided flight takes about **4 minutes 53 seconds** to enter low Earth orbit. The guide cuts thrust and switches to prograde hold once Pe reaches 100 km and Ap is at or below 2,000 km. The exact orbit depends on how you fly.
5. In map view, tap the fast-forward icon and select **5×** or **20×** to coast above 101 km. Try a short prograde burn near Ap and watch Pe rise. Choose retrograde to slow down. The flight plan records your first successful insertion, even if you later deorbit.

The Flight deck opens the currently prepared vehicle. A fresh program has a free simulation ready. **Menu → Mission data → Restart** returns the vehicle to the pad and replaces the active flight after confirmation.

## Flight controls

| Action | Touch or mouse | Keyboard |
| --- | --- | --- |
| Launch, stage, or toggle upper engine | Amber action button | Space |
| Switch between flight and orbital map | Orbit / rocket button at upper right | M |
| Pause or resume flight | Pause / Resume | P |
| Set manual pitch | Left / right pitch buttons | Left / right arrows |
| Adjust throttle | Vertical thrust slider | Up / down arrows |
| Hold prograde or retrograde | Attitude selector | Tab to selector |
| Explore the map | Drag to pan, pinch or scroll to zoom, or use zoom buttons | Tab to map controls |
| Focus the camera | Track craft / Fit Earth | Tab to camera button |

Pitch is local to the vehicle. Zero points up, and +90° points along the local horizontal in the initial downrange direction. The keyboard shortcuts apply when focus is on the flight console background. Focused buttons, sliders, and selectors retain their native keyboard behavior. The flag opens the flight plan and the list opens the event log. Opening a mission panel pauses an active flight. Use **Resume** when ready.

## Saves and offline play

Flight state, propellant, attitude, stage, event log, selected view, and the milestone are written to IndexedDB at launch, staging, pilot input, and mission events. Active flight also checkpoints about every 1.5 seconds. A synchronous local checkpoint covers suspension or tab close. Reloading an active flight restores it paused at 1×.

Version 2 saves include structures, upgrades, balances, contract receipts, program time, and the active flight. Existing version 1 local saves and JSON backups migrate as practice flights with an initial site. Use **Menu → Mission data → Export JSON** for a portable backup. Import validates the file and asks before replacing your mission. The save belongs to the browser and site path. A different device, private browsing session, or new Pages URL has its own save. Browsers supporting Web Locks allow one active flight tab per project.

Open the deployed site online once so the service worker can finish caching its assets. It can then reopen offline from the same URL. On an iPhone, the hosted game can also be added to the Home Screen. Localhost and HTTPS support the offline worker. A local HTTP server is required to preview the compiled files.

## Develop and verify

Use Node.js 24, or Node.js 22.18 or later.

```sh
npm ci
npm run dev
```

The development server prints the local address. For a release build and its automated checks:

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

On Linux CI use `npx playwright install --with-deps chromium`. The workflow does this automatically. To preview the built release, run `npm run preview`. To reproduce the GitHub project-path layout, run `node scripts/preview.mjs` and open `http://127.0.0.1:4173/apogee/`.

| Directory | Responsibility |
| --- | --- |
| `src/sim/` | Framework-free TypeScript dynamics, two-stage mass accounting, orbital elements, coast propagation, and warp guard |
| `src/app/` | React HUD, controls, guided flight, event log, simulation clock, lifecycle, and responsive layout |
| `src/game/scenes/` | Phaser side-view range, vehicles, and isometric Earth site |
| `src/game/orbital/` | Interactive vector map projected from the active flight state |
| `src/program/` | Facility placement, upgrade costs, contract eligibility, settlement and program validation |
| `src/persistence/` | Save schema, version validation, IndexedDB transactions, and checkpoint recovery |
| `public/` | PWA manifest, icons, original pixel art, and third-party notices |
| `scripts/` | Original artwork generator, offline build step, and subpath test server |
| `tests/` | Physics, save validation, and browser acceptance tests |
| `docs/` | Prebuilt static release for GitHub Pages |

### Simulation assumptions

The polar survey flies in a fixed meridional plane from an equatorial launch origin. Latitude is derived from the live position vector. The extra payload enters thrust-to-weight, drag acceleration and delta-v calculations. The Earth-centred 2D simulation uses SI units, spherical gravity, a stationary exponential atmosphere, constant stage thrust and specific impulse, and continuous propellant loss. Powered flight advances in fixed 50 ms steps. Elliptical vacuum coasts use Kepler's equation. Near-radial and open paths keep fixed-step numerical integration. Warp checks for the atmospheric boundary along the path and drops to 1× before re-entry. The map and side view share position, velocity, stage, fuel, and clock.

The displayed delta-v is the remaining ideal stage budget. The map shows the instantaneous ballistic path, so it changes during a burn. The range, camera scale, sprite dimensions, and artwork are illustrative. The vehicle specifications and guide tuning were chosen for this game.

### Acceptance checks

The automated suite exercises the full guided flight through the real HUD, map switching, warp, state-vector preservation across reload, JSON round trips, offline cold reload, manual controls, and touch-target sizes. Browser projects cover desktop at 1360×900, portrait at 390×844, and landscape at 844×390 in Chromium. The tests advance animation timestamps during long flights and retain the production fixed-step physics.

The live Pages deployment and a physical iPhone Safari run remain field checks. After upload, fly the first orbit on the phone, rotate between orientations, reload once in orbit, and reopen the installed app offline. On the site, place a building, upgrade the pad, and reopen the game to verify the same facilities and balances. The next blueprint milestone is the modular rocket workshop.
