# Milo Voss — portrait release

The only new game UI is Milo's animated pixel face and name on Earth range. Open the included `Milo-Voss.html` for a standalone preview. The tutorial remains a proposal in `TUTORIAL_PLAN.md`.

## Included changes

- `index.html`: portrait markup and stylesheet link for source builds.
- `public/art/milo-guide.css`: blink timing, responsive layout, screen visibility, and reduced-motion support.
- `public/art/milo-voss.png`: transparent four-frame head atlas.
- `docs/index.html`, `docs/art/`, and `docs/sw.js`: the same addition to the supplied static release, with the offline cache regenerated.

The existing JavaScript bundles are unchanged. The portrait has no click handler, focus target, tutorial dialogue, save data, or effect on the simulation. It uses CSS `:has()` to appear only on Earth range, with no inspector or open dialog. It requires a modern browser supporting `:has()`; unsupported browsers simply omit the portrait.

## Validation and limitations

- Confirmed the atlas is square RGBA with fully transparent background corners and four equal cells.
- Confirmed source/static portrait markup and assets match, every local portrait URL resolves, and both assets appear in the generated offline cache list.
- Ran the supplied Node test suite on both the original uploaded source and this version: **13 passed, 13 failed in each**, with the same named outcomes. No simulation, economy, persistence, or test source was changed. Existing failures include outdated starting-resource expectations and flight assertions.
- A full npm build could not run because this environment rejected dependency downloads with HTTP 403. The deliverable updates the existing static build directly for this HTML/CSS-only addition; a future normal `npm run build` copies the same public assets from source.
- Browser automation could not start Chromium because the environment denied its required process socket. Responsive geometry, the live blink, screen changes, and offline reload still need a browser smoke check; they are not claimed as browser-verified.

To check locally, extract the ZIP and run `node scripts/preview.mjs`, then open `http://127.0.0.1:4173/apogee/`. Confirm the portrait at desktop, phone portrait, and phone landscape sizes. Open Build and a facility inspector, then visit VAB and Pad; Milo should hide on those screens and return on Earth range. Enable reduced motion and confirm a still face. Load once online, wait for offline caching, then reload offline. The standalone HTML preview also works directly from disk.

## Artwork provenance

Created with the built-in image-generation tool, then refined with the same tool to remove the translucent background. Final atlas: `public/art/milo-voss.png`.

Generation brief: a friendly original male mission-control guide, Milo Voss, with warm tan skin, swept chestnut hair, tidy stubble, a navy/teal headset, amber accents, and a reassuring smile. Pixel-art head only; four identically aligned frames in a transparent 2 × 2 grid: eyes open, half closed, closed, and half open. No body, text, scenery, or panel.

Refinement brief: preserve the four faces and their grid alignment; remove all pale background, shadow, grain, glow, and halo outside the head silhouettes; keep the background fully transparent.
