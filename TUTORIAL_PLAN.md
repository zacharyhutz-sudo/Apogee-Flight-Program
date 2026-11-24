# Apogee Flight Program — Milo and the first-flight tutorial

## Release 1: face and name only

**Milo Voss** is the player's mission-control guide: a calm, approachable human engineer with a communications headset, a small smile, and a short blink every 4.6 seconds.

This release shows only his pixel face and name on Earth range. He has no dialogue, interaction, quest marker, tutorial button, or gameplay effect. The portrait clears away when a facility inspector or dialog is open and is absent from the workshop, flight deck, orbital map, and lunar outpost. Reduced-motion users see his open-eyed still portrait.

The PNG is a transparent 2 × 2 atlas: open eyes, half closed, closed, half open. The page shell and `public/art/milo-guide.css` display and animate it without adding JavaScript or save state. Relative URLs work under a GitHub Pages repository path. The same files are included in the static `docs/` release and its offline cache. A future interactive tutorial should move the portrait into the React tutorial UI.

## Tutorial goal and voice

Help a new player complete one sponsored Atmospheric Sounding flight, understand where its reward went, and choose a next activity. Aim for about five to eight minutes of guided play, then offer short optional lessons when their prerequisites are met. This is a design target, not a measured completion time.

Milo speaks in short, practical sentences: one idea and one action per prompt. He explains terms when they become useful and responds to setbacks without blaming the player. Example: “We'll start with a sponsored rocket. Open Contracts.” He does not speak in the first release.

## Proposed first-session flow

| Step | What Milo introduces | Player action | Completion / recovery |
| --- | --- | --- | --- |
| 1. Welcome | “I'm Milo. Let's get your first rocket off the ground.” Offer Start, Explore on my own, and Later. | Choose a guided first flight. | Only an explicit Start begins the tutorial. Returning saves receive an optional invitation. |
| 2. Your home base | Earth range, dragging/pinching the camera, and the resource strip: Credits, Propellant, and Research Data. | Pan the site, then open Contracts. | Camera practice is optional. Continue on the actual Contracts panel opening. |
| 3. Choose a first mission | Atmospheric Sounding; its target, sponsored hardware, propellant quote, and reward. | Leave Vehicle on Sponsored rocket and select Fly. | Advance when `program.sortie` becomes `sounding`. Respect Replace flight confirmation. Never prepare a mission automatically. |
| 4. Read the pad | Altitude, fuel, throttle, Launch, and Pause. Keep Ascent guide selected. | Set throttle to 100%, review the charge, then launch. | Wait for a real ignition and `program.paid`. Display the game's exact validation reason when launch is blocked. |
| 5. Watch the climb | Altitude is height; fuel drains while the engine runs. Give one small prompt at a time. | Fly to the Sounding target. | Use `SOUNDING_TARGET` (currently 15,000 m) and the actual reward settlement. Do not add a staging requirement to this mission. |
| 6. First success | Point out the mission reward and Sounding report, including peak altitude and the launch cost. | Open the report, then return to Earth range. | Acknowledge completion once. On vehicle loss before the target, offer retry via Contracts and let the player prepare and launch again. |
| 7. Where resources come from | Foundry produces Credits, Refinery produces Propellant, Bank and Cryo Tanks hold collected stock. Research comes from missions. | Collect an available resource or inspect its building. | Do not require collection from an empty hopper or full store. Read actual collection results. |
| 8. Choose your next goal | Build manages the base; VAB edits rockets; Contracts chooses objectives; Pad returns to the current vehicle. | Choose a next activity or finish the tour. | Mark the first-flight lesson complete, show optional lesson choices, and release all highlights. |

Use live contract and facility definitions for names, limits, costs, timers, and rewards. Do not copy old README values into tutorial text. Sponsored hardware does not mean every flight has zero propellant cost; the current sponsored fallback supplies emergency fuel when stock is short. Free simulation is separate and pays no mission reward.

## Optional lessons and the new-player tour

| Lesson | When to offer it | What the player does | Completion signal |
| --- | --- | --- | --- |
| Base economy | After the first reward or on opening Build | Inspect Foundry, Refinery, Bank, Cryo Tanks, Contract Office, Mission Control, and Launchpad in short contextual groups. Explain hopper versus storage, costs, active contract capacity, crew limits, and upgrade timers. | Inspections can be acknowledged; purchases require the normal game validation. An upgrade finishes only when its timer has completed. |
| First custom rocket | After first flight; start with an available starter blueprint | Open VAB, select Sounding Arrow, clone it, inspect a part, change one part, read wet mass / TWR / delta-v / part limits, and save. | A valid saved blueprint, followed optionally by selecting it for Sounding. Use `analyzeBlueprint` and `inspectSoundingBlueprint`, not tutorial-specific validity rules. |
| Staging | When Kármán Line Hop is affordable and launchable | Review its quote, launch, wait for booster burnout, then separate. Explain that early staging discards fuel. | The game's `contractConditionMet` and settled reward. Current code requires actual maximum altitude ≥ 30 km plus a stage separation; merely predicting a 30 km apogee is insufficient. |
| First orbit | When First Stable Orbit is launchable | Explain sideways speed, Ap and Pe, guided ascent, staging, flight/map switching, and safe coasting. | Use the existing orbit milestone and contract settlement. Read thresholds from game state; this game uses a scaled world. |
| Recovery | When the chosen vehicle has suitable recovery hardware | Explain descent speed, parachute conditions, landing legs, and a safe touchdown. | Actual landed status and the appropriate contract reward. Respect all existing deployment limits. |
| Advanced facilities | After the progression blocker below is resolved and Mission Control 2 is reachable | Introduce VAB facility upgrades, Tracking Station, and Research Lab when they become available. | Real facility construction and unlock state. The workshop screen is accessible before its facility is built; do not hide the starter blueprint lesson behind that construction. |
| Lunar exploration | After Earth fundamentals and the relevant unlocks | Explain lunar encounter controls, lunar missions, and the outpost only when those screens are available. | Existing lunar visit / landing / colony state. Do not present future Mars or galaxy features as completed lessons. |
| Keep your progress | After the first flight or when the player asks for help | Explain local autosave and Mission data export/import; show optional Cloud Save. | Viewing the explanation is enough. Do not require sign-in, an import, or an overwrite to finish onboarding. |

Do not show a compulsory tour of every building before launch. Use the Build list as the keyboard-accessible equivalent of selecting a world building. When the player explores elsewhere, suspend the current prompt and resume it when its target is available.

## Interaction rules for the later implementation

- One visible prompt and one highlighted target at a time. Keep flight controls, the selected building, and the resource strip readable.
- On desktop, anchor a compact Milo dialogue beside the target. On phones, use a compact tray above the existing dock, safe-area aware; never cover Launch, Stage, Pause, or steering. Hide the world portrait while this dialogue is active.
- Advance action steps from real state transitions, never from clicking Next. Use Next only for explanations. Treat timers and costs as live values.
- Pause for lengthy flight explanations using the existing pause mechanism. Opening a tutorial panel must not silently resume a flight; the player chooses Resume.
- Keep Skip, Later, and replay controls available. Skipping preserves the mission, resources, and completed milestones. Resuming reconciles saved tutorial progress with the current game state.
- Support keyboard focus, screen readers, reduced motion, and touch. Announce only changed instructional text, not the blink or continuously changing altitude. Keep text immediately available; no mandatory typewriter effect.
- If a highlighted target disappears, a building moves, a dialog opens, or orientation changes, recompute the anchor or suspend that step. Never leave an invisible blocker on screen.
- When resources, storage, crew availability, hardware, or a contract cooldown block a step, show the game's reason and offer another available activity. Never silently grant currency or change the economy.

## Proposed implementation milestones

1. **Identity — delivered now.** Face, name, blink, small-screen layout, reduced motion, and offline assets. No tutorial runtime or save migration.
2. **First-flight slice.** Add a React tutorial controller and welcome choice; ship the eight-step Sounding path with retry, skip, and resume. Prototype one full successful flight before adding more lessons.
3. **Contextual site lessons.** Add the dock tour, resource collection, facility inspection, and blueprint lesson. Resolve economy blockers before requiring advanced upgrades.
4. **Flight lessons.** Add staging, orbit, and recovery, each gated by existing eligibility and hardware. Lunar lessons follow after those paths pass playtests.
5. **Validation and tuning.** Run first-time and returning-player sessions; shorten prompts and remove steps that do not help the player act.

Suggested future data shape: `tutorial: { version, status, lessonId, stepId, completedLessons }`. Add it through the existing validated save migration, with defaults for older saves and export/import coverage. Tutorial progress must not replace the flight or program state. The controller should consume `useMission`, `quote`, `launchIssue`, facility levels, flight status, and settlement results. Add stable tutorial anchors to actual controls rather than relying on visible button text. None of this state or instrumentation is implemented in Release 1.

## Issues to resolve before shipping the guided progression

1. **Mission Control progression deadlock.** Current Mission Control 2 costs 4,500 C + 60 RD. A level-1 Bank holds 2,000 C; at most two Banks can be built, so total capacity is 4,000 C. Bank level 2 itself requires Mission Control 2. Choose an economy change before making that upgrade a tutorial objective: lower the Control price, increase early storage, or change the Bank prerequisite. Release 1 does not alter these rules.
2. **Instructions and conditions disagree.** Some contract descriptions use Ap while their completion conditions check maximum achieved altitude. The README contains older contract names, costs, targets, and upgrade behavior. Tutorial copy must be checked against current executable conditions.
3. **Existing tests need alignment.** Several economy, flight, and save assertions in the supplied project fail before this change. Reconcile those expectations and any underlying simulation issues before using them to certify the full tutorial.

## Acceptance criteria for the future tutorial

- A fresh save can finish sponsored Sounding without buying or building anything.
- A player with no Credits or Propellant has a valid sponsored recovery route.
- An empty collector, full store, active upgrade, cooldown, or lost vehicle cannot trap a tutorial step.
- Staging cannot be required on a single-stage vehicle; recovery prompts require compatible hardware.
- Reload at every step restores a sensible prompt without duplicating rewards, purchases, launches, or completion notices.
- Returning players can decline or replay lessons without resetting their save or replacing an active flight automatically.
- Mouse, keyboard, phone portrait, phone landscape, zoomed text, reduced motion, and offline reload all work.
- Success is measured by players completing their first mission and finding their next action without assistance. Any future analytics should record minimal event counts, with no account requirement or message contents.
