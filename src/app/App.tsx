import { Dialog } from "./Dialog";
import { LaunchSite } from "./LaunchSite";
import { Workshop } from "./Workshop";
import { LunarSite } from "./LunarSite";
import { CONTRACTS, level, quote } from "../program/program";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  FastForward,
  Landmark,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Check,
  Coins,
  Database,
  Flag,
  Flame,
  Layers2,
  List,
  Orbit,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Rocket,
  TriangleAlert,
  Wind,
  Wrench,
  X,
} from "lucide-react";
import { FlightScene } from "../game/scenes/FlightScene";
import { OrbitalMap } from "../game/orbital/OrbitalMap";
import {
  AIR,
  CHUTE_MAX_SPEED,
  burning,
  stagesOf,
  thrustToWeight,
  toggleChute,
  toggleLegs,
  canChuteWarp,
  canWarp,
  clamp,
  deltaV,
  orbit,
  speed,
} from "../sim/flight";
import { validate } from "../persistence/save";
import { useMission } from "./useMission";
import "./style.css";

const clock = (t: number) =>
  [Math.floor(t / 3600), Math.floor(t / 60) % 60, Math.floor(t) % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");

const distance = (n: number) =>
  Number.isFinite(n)
    ? (n / 1000).toLocaleString("en-US", {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      })
    : "Escape";

const wrapPitch = (deg: number) => {
  const p = ((((deg + 180) % 360) + 360) % 360) - 180;
  return p === -180 && deg > 0 ? 180 : p;
};

export default function App() {
  const m = useMission(),
    s = m.vessel.current,
    active = m.mission.view === "flight",
    o = orbit(s);
  const [dialog, D] = useState(""),
    [error, E] = useState("");
  const [steerDir, setSteerDir] = useState<-1 | 0 | 1>(0);
  const steerDirRef = useRef<-1 | 0 | 1>(0);
  const steerPointerId = useRef<number | null>(null);
  const upload = useRef<HTMLInputElement>(null),
    backup = useRef<ReturnType<typeof validate> | null>(null);

  const pad = s.status === "pad",
    flying = s.status === "flying",
    ended = !pad && !flying,
    booster = s.stage === 0;
  const st = stagesOf(s);
  const stageMaxFuel = st[s.stage].fuel;
  const fuelPct =
    stageMaxFuel > 0 ? (100 * s.fuel[s.stage]) / stageMaxFuel : 0;
  const twr = thrustToWeight(s);
  const lowThrust = pad && twr <= 1;
  const sortie = m.mission.program.sortie;
  const isRealContract = sortie !== "practice";
  const launchQuote = isRealContract ? quote(m.mission.program, sortie) : null;
  const trackingLevel = level(m.mission.program, "tracking");

  function flightStatus() {
    if (pad)
      return isRealContract
        ? CONTRACTS[sortie].name
        : s.vehicleName || "Free Simulation";
    if (m.paused) return "Paused";
    if (s.status === "lost") return "Vehicle lost";
    if (s.status === "landed") return "Landed";
    if (booster && fuelPct === 0) return "Stage ready";
    if (s.orbitEarned && o.pe >= AIR) return "In orbit";
    return s.throttle > 0 && fuelPct > 0 ? "Powered" : "Coasting";
  }

  function primaryLabel() {
    if (lowThrust) return "Raise throttle to launch";
    if (pad) return "Launch vehicle";
    if (ended) return "Return to pad";
    if (booster) return "Separate stage";
    if (!fuelPct) return "Stage depleted";
    return s.throttle > 0 ? "Cut engine" : "Ignite engine";
  }

  function open(name: string) {
    if (flying && !m.paused) m.togglePause();
    E("");
    D(name);
  }

  function toggleView(map: boolean) {
    m.change(() => {
      m.mission.view = map ? "map" : "flight";
    });
  }

  function primary() {
    if (!m.loaded || lowThrust || (flying && !booster && !fuelPct)) return;
    if (pad) m.launch();
    else if (ended) m.reset();
    else if (booster) {
      if (fuelPct > 1) open("stage");
      else m.separate();
    } else
      m.change(
        (f) => {
          f.throttle = f.throttle > 0 ? 0 : 1;
        },
        s.throttle > 0
          ? "Engine cutoff commanded."
          : "Engine ignition commanded.",
      );
  }

  const canSteer = m.loaded && !m.paused && flying && burning(s) && !s.chuteDeployed;

  function pitch(value: number) {
    if (!canSteer) return;
    m.change((f) => {
      f.mode = "manual";
      f.pitch = wrapPitch(value);
    });
  }

  function startSteer(dir: -1 | 1, e: React.PointerEvent<HTMLButtonElement>) {
    if (!canSteer) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }
    steerPointerId.current = e.pointerId;
    steerDirRef.current = dir;
    setSteerDir(dir);
  }

  function stopSteer(e?: React.PointerEvent<HTMLButtonElement>) {
    if (
      e &&
      steerPointerId.current !== null &&
      e.pointerId !== steerPointerId.current
    ) {
      return;
    }
    if (steerDirRef.current !== 0) {
      steerDirRef.current = 0;
      steerPointerId.current = null;
      setSteerDir(0);
      m.save();
    }
  }

  useEffect(() => {
    if (steerDir === 0) return;
    let rafId = 0;
    let lastTime = performance.now();
    const RATE_DEG_PER_SEC = 52;
    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      const cur = m.vessel.current;
      if (
        steerDirRef.current !== 0 &&
        m.loaded &&
        !m.paused &&
        cur.status === "flying" &&
        burning(cur) &&
        !cur.chuteDeployed
      ) {
        cur.mode = "manual";
        cur.pitch = wrapPitch(
          cur.pitch + steerDirRef.current * RATE_DEG_PER_SEC * dt,
        );
      } else {
        steerDirRef.current = 0;
        steerPointerId.current = null;
        setSteerDir(0);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [steerDir, m.loaded, m.paused]);

  function handleChuteToggle() {
    if (!m.loaded || !flying || s.chuteRipped) return;
    const outcome = toggleChute(s);
    if (outcome === "ripped") {
      m.setNotice(`Parachute ripped! Deployed above ${CHUTE_MAX_SPEED} m/s.`);
      m.change(() => {}, `Parachute ripped above ${CHUTE_MAX_SPEED} m/s.`);
    } else if (outcome === "deployed") {
      m.change(() => {}, "Parachute deployed — attitude locked to gravity.");
    } else if (outcome === "cut") {
      m.change(() => {}, "Parachute cut.");
    }
  }

  function throttle(value: number) {
    m.change((f) => {
      f.throttle = clamp(value, 0, 1);
    });
  }

  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        dialog ||
        m.mission.view === "site" ||
        m.mission.view === "workshop" ||
        m.mission.view === "lunar" ||
        !m.loaded ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        (e.target instanceof HTMLElement &&
          /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))
      )
        return;
      switch (e.code) {
        case "KeyM":
          toggleView(active);
          break;
        case "Escape":
          if (!active) toggleView(false);
          break;
        case "KeyP":
          m.togglePause();
          break;
        case "Space":
          if (!e.repeat) primary();
          break;
        case "ArrowLeft":
        case "KeyA":
          if (canSteer) pitch(s.pitch - 2);
          break;
        case "ArrowRight":
        case "KeyD":
          if (canSteer) pitch(s.pitch + 2);
          break;
        case "ArrowUp":
        case "KeyW":
          if (!ended) throttle(s.throttle + 0.05);
          break;
        case "ArrowDown":
        case "KeyS":
          if (!ended) throttle(s.throttle - 0.05);
          break;
        case "KeyL":
          if (flying && s.hasLegs !== false)
            m.change(
              (f) => {
                toggleLegs(f);
              },
              s.legsDeployed
                ? "Landing legs retracted."
                : "Landing legs deployed.",
            );
          break;
        case "KeyC":
          handleChuteToggle();
          break;
        default:
          return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  function exportSave() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(m.mission, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "apogee-flight-" + Math.floor(s.t) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const objectives = [
    { name: "Lift off", done: !pad },
    ...(sortie === "recovery"
      ? [
          { name: "Reach 20 km", done: s.maxAlt >= 20000 },
          { name: "Land safely on Earth", done: s.status === "landed" },
        ]
      : sortie === "return"
        ? [
            { name: "Separate booster", done: !booster },
            { name: "Establish orbit", done: s.orbitEarned },
            { name: "Land safely on Earth", done: s.status === "landed" },
          ]
        : [
            { name: "Separate booster", done: !booster },
            ...(sortie === "sounding"
              ? [{ name: "Reach 15 km", done: s.maxAlt >= 15000 }]
              : sortie === "hop"
                ? [{ name: "Reach 30 km", done: s.maxAlt >= AIR }]
                : [{ name: "Establish orbit", done: s.orbitEarned }]),
          ]),
  ];
  const current = objectives.findIndex((t) => !t.done);
  const guidance = m.mission.program.rewarded
    ? "Reward collected. Return to Base to upgrade facilities."
    : ended
      ? s.status === "lost"
        ? "Surface impact. Return to pad for another flight."
        : "Touchdown confirmed."
      : pad
        ? isRealContract
          ? "Launch commits Hardware + Propellant, or test in Simulate Free."
          : "Free simulation (0 cost, 0 payout). Launch when ready."
        : booster && fuelPct === 0
          ? "Booster empty. Tap Stage."
          : s.orbitEarned
            ? "Orbit reached. Open Map to coast at 5× or 20×."
            : "Hold left or right screen edges while thrusting to pitch.";

  const pilotDisabled = !m.loaded || ended;
  const actionText = lowThrust
    ? "Low thrust"
    : pad
      ? "Launch"
      : ended
        ? "Restart"
        : booster
          ? "Stage"
          : primaryLabel();

  const instrument = (label: string, value: string, unit: string) => (
    <div className="meter" key={label}>
      <span>{label}</span>
      <strong>
        {value}
        {unit && <small>{unit}</small>}
      </strong>
    </div>
  );

  if (m.mission.view === "site")
    return (
      <LaunchSite
        mission={m}
        onFlight={() => toggleView(false)}
        onWorkshop={m.openWorkshop}
        onLunar={m.openLunar}
      />
    );
  if (m.mission.view === "workshop")
    return <Workshop mission={m} onSite={m.visitSite} />;
  if (m.mission.view === "lunar")
    return <LunarSite mission={m} onEarth={m.visitSite} />;

  return (
    <>
      <main
        className={"game " + (active ? "range-view" : "map-view")}
        aria-label="Pioneer 01 flight simulator"
      >
        <div className="scene-wrap" hidden={!active}>
          <FlightScene vessel={m.vessel} />
        </div>
        {!active && (
          <OrbitalMap s={s} trackingLevel={trackingLevel} />
        )}
        <div className="shade" aria-hidden="true" />
        <div className="hud">
          {flying && (
            <>
              <button
                type="button"
                className={
                  "steer-zone steer-left" +
                  (steerDir === -1 ? " steering" : "") +
                  (!canSteer ? " steer-locked" : "")
                }
                aria-label="Hold to pitch left"
                disabled={!canSteer}
                onPointerDown={(e) => startSteer(-1, e)}
                onPointerUp={stopSteer}
                onPointerCancel={stopSteer}
                onLostPointerCapture={() => stopSteer()}
              >
                <span className="steer-pill">
                  <ChevronLeft size={20} />
                </span>
              </button>
              <button
                type="button"
                className={
                  "steer-zone steer-right" +
                  (steerDir === 1 ? " steering" : "") +
                  (!canSteer ? " steer-locked" : "")
                }
                aria-label="Hold to pitch right"
                disabled={!canSteer}
                onPointerDown={(e) => startSteer(1, e)}
                onPointerUp={stopSteer}
                onPointerCancel={stopSteer}
                onLostPointerCapture={() => stopSteer()}
              >
                <span className="steer-pill">
                  <ChevronRight size={20} />
                </span>
              </button>
            </>
          )}

          <header className="topline">
            <div className="identity">
              <button
                className="insignia"
                aria-label="Earth launch site"
                title="Base"
                onClick={m.visitSite}
              >
                <Landmark />
              </button>
              <span className="timer">T+ {clock(s.t)}</span>
              {(!active || m.rate > 1 || Boolean(s.chuteDeployed && flying)) && (
                <button
                  className={
                    "warp-toggle" + (m.rate > 1 ? " warp-active" : "")
                  }
                  title={
                    canChuteWarp(s) && active
                      ? "Toggle 3× parachute warp"
                      : "Time warp"
                  }
                  aria-label={
                    canChuteWarp(s) && active
                      ? "Toggle 3× parachute warp"
                      : "Time warp"
                  }
                  onClick={() => {
                    if (s.chuteDeployed && flying && active) {
                      m.warp(m.rate === 3 ? 1 : 3);
                    } else {
                      D("warp");
                    }
                  }}
                >
                  <FastForward size={14} />
                  {m.rate}×
                </button>
              )}
            </div>
            <nav aria-label="Flight views and tools">
              <button
                className={!active ? "selected" : ""}
                aria-label={active ? "Orbital map" : "Flight view"}
                title={active ? "Orbital map" : "Flight view"}
                onClick={() => toggleView(active)}
              >
                {active ? <Orbit /> : <Rocket />}
              </button>
              {flying && (
                <button
                  aria-label={m.paused ? "Resume" : "Pause"}
                  title={m.paused ? "Resume" : "Pause"}
                  onClick={m.togglePause}
                >
                  {m.paused ? <Play /> : <Pause />}
                </button>
              )}
              <button
                aria-label="Mission menu"
                title="Menu"
                onClick={() => open("menu")}
              >
                <Menu />
              </button>
            </nav>
          </header>

          {(!pad || !active) && (
            <div className="telemetry">
              {m.alt < 1000 ? instrument("ALT", String(Math.round(m.alt)), "m") : instrument("ALT", distance(m.alt), "km")}
              {instrument(
                "VEL",
                Math.round(speed(s)).toLocaleString("en-US"),
                "m/s",
              )}
              {active ? (
                instrument(
                  s.chuteDeployed ? "CHUTE" : "PITCH",
                  s.chuteDeployed ? "LOCK" : `${Math.round(s.pitch)}°`,
                  "",
                )
              ) : (
                <>
                  {instrument(
                    "AP",
                    pad ? "—" : distance(Math.max(0, o.ap)),
                    pad || !Number.isFinite(o.ap) ? "" : "km",
                  )}
                  {instrument(
                    "PE",
                    pad ? "—" : distance(o.pe),
                    pad ? "" : "km",
                  )}
                </>
              )}
            </div>
          )}

          <div className="hud-bottom">
            <label className="thrust">
              <span className="control-label">Thr</span>
              <b>{Math.round(s.throttle * 100)}%</b>
              <input
                aria-label="Throttle"
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round(s.throttle * 100)}
                disabled={pilotDisabled}
                style={
                  { "--fill": s.throttle * 100 + "%" } as React.CSSProperties
                }
                onChange={(e) => throttle(+e.target.value / 100)}
              />
            </label>

            <div className={"flight-actions" + (pad ? " actions-pad" : "")}>
              {flying && (s.hasLegs !== false || s.hasChute !== false) && (
                <div className="landing-toggles">
                  {s.hasLegs !== false && (
                    <button
                      className={s.legsDeployed ? "active-gear" : ""}
                      aria-label="Toggle landing legs"
                      onClick={() =>
                        m.change(
                          (f) => {
                            toggleLegs(f);
                          },
                          s.legsDeployed
                            ? "Landing legs retracted."
                            : "Landing legs deployed.",
                        )
                      }
                    >
                      <ArrowDownToLine size={14} />
                      Legs
                    </button>
                  )}
                  {s.hasChute !== false && (
                    <button
                      className={
                        s.chuteRipped
                          ? "ripped-gear"
                          : s.chuteDeployed
                            ? "active-gear"
                            : ""
                      }
                      aria-label="Toggle parachute"
                      disabled={
                        Boolean(s.chuteRipped) ||
                        (!s.chuteDeployed && m.alt >= AIR)
                      }
                      onClick={handleChuteToggle}
                    >
                      <Wind size={14} />
                      {s.chuteRipped ? "Ripped" : "Chute"}
                    </button>
                  )}
                </div>
              )}

              <div className="command-card">
                <span
                  role="status"
                  className={
                    "state" + (booster && flying && !fuelPct ? " alert" : "")
                  }
                >
                  <i />
                  {flightStatus()}
                </span>

                {pad && launchQuote && (
                  <div className="launch-costs" aria-label="Launch cost">
                    <span>
                      <Coins size={12} />
                      {launchQuote.hardwareCost.toLocaleString("en-US")} C
                    </span>
                    <span>
                      <Flame size={12} />
                      {launchQuote.propellantCost.toLocaleString("en-US")} Prop
                    </span>
                  </div>
                )}

                <button
                  className="primary"
                  aria-label={primaryLabel()}
                  disabled={
                    !m.loaded || lowThrust || (flying && !booster && !fuelPct)
                  }
                  onClick={primary}
                >
                  {pad ? (
                    <Rocket />
                  ) : ended ? (
                    <RotateCcw />
                  ) : booster ? (
                    <Layers2 />
                  ) : (
                    <Radio />
                  )}
                  {actionText}
                </button>

                {pad && isRealContract && (
                  <button
                    className="sim-free-btn"
                    aria-label="Simulate Free"
                    disabled={!m.loaded || lowThrust}
                    onClick={m.launchFreeSim}
                  >
                    Simulate Free · 0 Cost
                  </button>
                )}

                {!pad && (
                  <div className="fuel-bar-wrap">
                    <div className="fuel-label">
                      <span>S{s.stage + 1} FUEL</span>
                      <b>{Math.ceil(fuelPct)}%</b>
                    </div>
                    <div className="fuel-track">
                      <i style={{ width: fuelPct + "%" }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {m.notice && (
          <div className="notice" role="alert">
            <TriangleAlert size={16} />
            {m.notice}
            <button
              aria-label="Dismiss message"
              onClick={() => m.setNotice("")}
            >
              <X />
            </button>
          </div>
        )}
      </main>

      {dialog && (
        <Dialog
          title={
            {
              menu: "Mission menu",
              plan: "Flight plan",
              log: "Event log",
              warp: "Time warp",
              guide: "Flight guide",
              data: "Mission data",
              stage: "Separate booster?",
              import: "Restore this flight?",
              reset: "Start a new flight?",
            }[dialog] || "Mission"
          }
          close={() => D("")}
        >
          {dialog === "menu" && (
            <>
              <div className="menu-grid">
                <button
                  onClick={() => {
                    D("");
                    m.visitSite();
                  }}
                >
                  <Landmark size={19} />
                  Earth launch site
                </button>
                <button
                  onClick={() => {
                    D("");
                    m.openWorkshop();
                  }}
                >
                  <Wrench size={19} />
                  Rocket Workshop
                </button>
                {[
                  [Flag, "Flight plan", "plan"],
                  [List, "Event log", "log"],
                  [BookOpen, "Flight guide", "guide"],
                  [Database, "Mission data", "data"],
                ].map(([Icon, label, key]) => {
                  const Glyph = Icon as typeof Flag;
                  return (
                    <button key={String(key)} onClick={() => D(String(key))}>
                      <Glyph size={19} />
                      {String(label)}
                    </button>
                  );
                })}
              </div>
              <div className="details">
                <span>{m.saveStatus}</span>
                <span>
                  TWR {twr.toFixed(2)} · Δv{" "}
                  {Math.round(deltaV(s)).toLocaleString("en-US")} m/s
                </span>
              </div>
            </>
          )}
          {dialog === "plan" && (
            <>
              <h3>
                {isRealContract ? CONTRACTS[sortie].name : "Free simulation"}
              </h3>
              {isRealContract && launchQuote && (
                <p>
                  {CONTRACTS[sortie].goal}{" "}
                  {m.mission.program.rewarded
                    ? "Reward collected."
                    : pad
                      ? `Cost: ${launchQuote.hardwareCost} C + ${launchQuote.propellantCost} Prop.`
                      : ""}
                </p>
              )}
              <p>{guidance}</p>
              <ol className="steps">
                {objectives.map((t, i) => (
                  <li
                    key={t.name}
                    className={t.done ? "done" : i === current ? "next" : ""}
                  >
                    <i>{t.done ? <Check size={13} /> : i + 1}</i>
                    {t.name}
                  </li>
                ))}
              </ol>
            </>
          )}
          {dialog === "log" && (
            <ul className="events">
              {[...m.mission.log].reverse().map((e, i) => (
                <li key={i}>
                  <time>{clock(e.t)}</time>
                  <span>{e.text}</span>
                </li>
              ))}
            </ul>
          )}
          {dialog === "warp" && (
            <>
              <div className="rates">
                {(canChuteWarp(s) ? [1, 3] : [1, 5, 20]).map((n) => (
                  <button
                    key={n}
                    aria-pressed={n === m.rate}
                    disabled={
                      !m.loaded ||
                      (n > 1 &&
                        (m.paused ||
                          (n === 3 ? !canChuteWarp(s) : !canWarp(s))))
                    }
                    onClick={() => {
                      m.warp(n);
                      D("");
                    }}
                  >
                    {n}×
                  </button>
                ))}
              </div>
              {(!canWarp(s) && !canChuteWarp(s) || m.paused) && (
                <p>
                  Warp is available while coasting above 30.5 km (5×/20×) or
                  descending under parachute (3×) with flight running.
                </p>
              )}
            </>
          )}
          {dialog === "guide" && (
            <>
              <h3>Manual flight controls</h3>
              <ol>
                <li>
                  <b>Launch.</b> Set throttle with the left slider and tap
                  Launch.
                </li>
                <li>
                  <b>Steer pitch.</b> Tap and hold the left or right side of the
                  screen while thrusting to turn east into your gravity turn.
                </li>
                <li>
                  <b>Stage & orbit.</b> Tap Stage when the booster runs dry,
                  then burn horizontally near apoapsis until periapsis clears 30
                  km.
                </li>
                <li>
                  <b>Safe landing.</b> Slow below 200 m/s in atmosphere before
                  deploying Chute, and extend Legs before touchdown.
                </li>
              </ol>
              <h3>Keyboard</h3>
              <p>
                <kbd>M</kbd> map · <kbd>P</kbd> pause · <kbd>Space</kbd> action
                · <kbd>← → / A D</kbd> pitch · <kbd>↑ ↓ / W S</kbd> throttle ·{" "}
                <kbd>L</kbd> legs · <kbd>C</kbd> chute
              </p>
            </>
          )}
          {dialog === "data" && (
            <>
              <p>
                Back up your program and active flight as JSON or restore a
                previous save.
              </p>
              <div className="dialog-actions">
                <button disabled={!m.loaded} onClick={exportSave}>
                  <ArrowDownToLine size={16} />
                  Export JSON
                </button>
                <button
                  disabled={!m.loaded}
                  onClick={() => upload.current?.click()}
                >
                  <ArrowUpFromLine size={16} />
                  Import JSON
                </button>
              </div>
              <input
                ref={upload}
                hidden
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    if (file.size > 200000)
                      throw Error("The save file is too large.");
                    backup.current = validate(JSON.parse(await file.text()));
                    D("import");
                    E("");
                  } catch (err) {
                    E(
                      err instanceof SyntaxError
                        ? "The file contains invalid JSON."
                        : String((err as Error).message),
                    );
                  }
                }}
              />
              <div className="reset-row">
                <div>
                  <h3>New flight</h3>
                  <p>Return to the launchpad.</p>
                </div>
                <button disabled={!m.loaded} onClick={() => D("reset")}>
                  <RotateCcw size={15} />
                  Restart
                </button>
              </div>
            </>
          )}
          {dialog === "stage" && (
            <>
              <p>
                The booster still holds {Math.ceil(fuelPct)}% propellant.
                Separation discards the remaining fuel.
              </p>
              <button
                className="primary"
                onClick={() => {
                  m.separate();
                  D("");
                }}
              >
                Separate now
              </button>
            </>
          )}
          {dialog === "reset" && (
            <>
              <p>
                Return to the pad for a free simulation. Base facilities and
                resources are kept.
              </p>
              <button
                className="primary"
                onClick={() => {
                  m.reset();
                  D("");
                }}
              >
                Start new flight
              </button>
            </>
          )}
          {dialog === "import" && backup.current && (
            <>
              <p>
                Replace this mission with the saved flight at T+{" "}
                {clock(backup.current.flight.t)}?
              </p>
              <button
                className="primary"
                onClick={() => {
                  if (backup.current) m.restore(backup.current);
                  backup.current = null;
                  D("");
                }}
              >
                Restore flight
              </button>
            </>
          )}
          {flying && m.paused && (
            <p className="pause-note">Flight paused. Tap ▶ to resume.</p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="close-bottom" onClick={() => D("")}>
            {["stage", "reset", "import"].includes(dialog) ? "Cancel" : "Close"}
          </button>
        </Dialog>
      )}
    </>
  );
}
