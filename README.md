# Apogee Flight Program

A playable, mobile-first two-stage orbital flight simulator. This is the S0 / v0.1 milestone from the Space Civilization Game Build Blueprint v1.3. Pioneer 01 launches from Earth, stages into orbit, and remains exactly where you saved it between sessions.

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

The game starts on the pad. A fresh launch costs nothing in this release. **Menu → Mission data → Restart** returns the vehicle to the pad and replaces the active flight after confirmation.

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

Use **Menu → Mission data → Export JSON** for a portable backup. Import validates the file and asks before replacing your mission. The save belongs to the browser and site path. A different device, private browsing session, or new Pages URL has its own save. Browsers supporting Web Locks allow one active flight tab per project.

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
| `src/game/scenes/` | Phaser side-view range and vehicle rendering |
| `src/game/orbital/` | Interactive vector map projected from the active flight state |
| `src/persistence/` | Save schema, version validation, IndexedDB transactions, and checkpoint recovery |
| `public/` | PWA manifest, icons, original pixel art, and third-party notices |
| `scripts/` | Original artwork generator, offline build step, and subpath test server |
| `tests/` | Physics, save validation, and browser acceptance tests |
| `docs/` | Prebuilt static release for GitHub Pages |

### Simulation assumptions

The Earth-centred 2D simulation uses SI units, spherical gravity, a stationary exponential atmosphere, constant stage thrust and specific impulse, and continuous propellant loss. Powered flight advances in fixed 50 ms steps. Elliptical vacuum coasts use Kepler's equation. Near-radial and open paths keep fixed-step numerical integration. Warp checks for the atmospheric boundary along the path and drops to 1× before re-entry. The map and side view share position, velocity, stage, fuel, and clock.

The displayed delta-v is the remaining ideal stage budget. The map shows the instantaneous ballistic path, so it changes during a burn. The range, camera scale, sprite dimensions, and artwork are illustrative. The vehicle specifications and guide tuning were chosen for this game.

### Acceptance checks

The automated suite exercises the full guided flight through the real HUD, map switching, warp, state-vector preservation across reload, JSON round trips, offline cold reload, manual controls, and touch-target sizes. Browser projects cover desktop at 1360×900, portrait at 390×844, and landscape at 844×390 in Chromium. The tests advance animation timestamps during long flights and retain the production fixed-step physics.

The live Pages deployment and a physical iPhone Safari run remain field checks. After upload, fly the first orbit on the phone, rotate between orientations, reload once in orbit, and reopen the installed app offline. Earth base building and the first contract economy are the next blueprint milestone, v0.2.
