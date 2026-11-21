import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Database,
  Flag,
  Focus,
  Layers2,
  List,
  Minus,
  Navigation2,
  Orbit,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Rocket,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from "lucide-react";
import { FlightScene } from "../game/scenes/FlightScene";
import { OrbitalMap } from "../game/orbital/OrbitalMap";
import {
  AIR,
  STAGES,
  thrustToWeight,
  canWarp,
  clamp,
  deltaV,
  orbit,
  speed,
  type Mode,
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
function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button aria-label="Close dialog" onClick={close}>
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function App() {
  const m = useMission(),
    s = m.vessel.current,
    active = m.mission.view === "flight",
    o = orbit(s);
  const [dialog, D] = useState(""),
    [error, E] = useState(""),
    [allLog, L] = useState(false);
  const upload = useRef<HTMLInputElement>(null),
    backup = useRef<ReturnType<typeof validate> | null>(null);
  const pad = s.status === "pad",
    flying = s.status === "flying",
    ended = !pad && !flying,
    booster = s.stage === 0;
  const fuelPct = (100 * s.fuel[s.stage]) / STAGES[s.stage].fuel;
  const twr = thrustToWeight(s);
  const lowThrust = pad && twr <= 1;
  function flightStatus() {
    if (pad) return "On pad";
    if (m.paused) return "Paused";
    if (s.status === "lost") return "Vehicle lost";
    if (s.status === "landed") return "Landed";
    if (booster && fuelPct === 0) return "Stage ready";
    if (s.orbitEarned && o.pe >= AIR) return "In orbit";
    return s.throttle > 0 && fuelPct > 0 ? "Powered flight" : "Coasting";
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
  function pitch(value: number) {
    m.change((f) => {
      f.mode = "manual";
      f.pitch = clamp(value, -180, 180);
    });
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
          if (!ended) pitch(s.pitch - 5);
          break;
        case "ArrowRight":
          if (!ended) pitch(s.pitch + 5);
          break;
        case "ArrowUp":
          if (!ended) throttle(s.throttle + 0.05);
          break;
        case "ArrowDown":
          if (!ended) throttle(s.throttle - 0.05);
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
    { name: "Separate booster", done: !booster },
    { name: "Establish orbit", done: s.orbitEarned },
  ];
  const current = objectives.findIndex((t) => !t.done);
  const guidance = ended
    ? s.status === "lost"
      ? "Surface impact. Return to the pad for another flight."
      : "Touchdown confirmed. Start a new flight when ready."
    : pad
      ? "Launch at full throttle. Ascent guide will fly the pitch program."
      : booster && fuelPct === 0
        ? "Booster depleted. Separate the stage to ignite the upper engine."
        : s.orbitEarned
          ? "Orbit milestone complete. Switch to the map and coast at 5× or 20×."
          : booster
            ? "Watch booster fuel. Separate the stage when its tank reaches zero."
            : s.mode === "guide"
              ? "Hold full throttle. The guide cuts thrust when the orbit is stable."
              : "Raise periapsis above 100 km and keep apoapsis below 2,000 km.";
  const flightMode = (mode: Mode) =>
    m.change((f) => {
      f.mode = mode;
    });
  const visibleLog = [...m.mission.log].reverse().slice(0, allLog ? 64 : 3);
  return (
    <>
      <header>
        <div className="bar wrap">
          <div className="brand">
            <span className="brand-icon">
              <Orbit size={27} />
            </span>
            APOGEE<span className="brand-sub">Flight program</span>
          </div>
          <div className="header-actions">
            <button
              className="compact-guide"
              onClick={() => open("guide")}
              aria-label="Open flight guide"
            >
              <BookOpen size={16} />
            </button>
            <span className="saved">
              <i />
              {m.saveStatus}
            </span>
            <button
              className="data-btn"
              onClick={() => open("data")}
              aria-label="Mission data"
            >
              <Database size={15} />
              <span>Mission data</span>
            </button>
          </div>
        </div>
      </header>
      <main className="wrap">
        <div className="heading">
          <div>
            <div className="location">
              <span className="locator" />
              Earth <b>/</b> Launch complex 01
            </div>
            <h1>Launch operations</h1>
          </div>
          <button className="guide-btn" onClick={() => open("guide")}>
            <BookOpen size={16} />
            <span>Flight guide</span>
          </button>
        </div>
        {m.notice && (
          <div className="notice" role="status">
            <TriangleAlert size={16} />
            {m.notice}
            <button
              aria-label="Dismiss message"
              onClick={() => m.setNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="dashboard">
          <section className="view-panel panel" aria-label="Flight monitor">
            <div className="view-toolbar">
              <div className="tabs">
                <button aria-pressed={active} onClick={() => toggleView(false)}>
                  <Rocket /> Flight view
                </button>
                <button aria-pressed={!active} onClick={() => toggleView(true)}>
                  <Orbit /> Orbital map
                </button>
              </div>
              <div className="met" title="Mission elapsed time">
                <Clock3 size={14} />
                <span>T+ {clock(s.t)}</span>
              </div>
            </div>
            <div className="viewport">
              <div className="scene-wrap" hidden={!active}>
                <FlightScene vessel={m.vessel} />
              </div>
              {!active && <OrbitalMap s={s} />}
              {booster && flying && !fuelPct && (
                <div className="stage-alert" role="status">
                  <Layers2 size={14} />
                  Booster empty · Separate stage
                </div>
              )}
              {active && (
                <>
                  <div className="feed">
                    <Radio size={12} /> Range camera
                  </div>
                  <div className="cam-label">
                    <span className="corner" /> Pioneer 01{" "}
                    <span className="cam-divider">/</span>{" "}
                    {m.alt < 1000
                      ? "Launch pad"
                      : m.alt < AIR
                        ? "Ascent camera"
                        : "Orbital camera"}
                  </div>
                </>
              )}
            </div>
            <div className="telemetry">
              {[
                [<Navigation2 />, "Altitude", distance(m.alt), "km"],
                [
                  <Activity />,
                  "Velocity",
                  Math.round(speed(s)).toLocaleString("en-US"),
                  "m/s",
                ],
                [
                  <Orbit />,
                  "Apoapsis",
                  pad ? "—" : distance(Math.max(0, o.ap)),
                  pad || !Number.isFinite(o.ap) ? "" : "km",
                ],
                [
                  <Focus />,
                  "Periapsis",
                  pad ? "—" : distance(o.pe),
                  pad ? "" : "km",
                ],
              ].map(([icon, label, num, unit]) => (
                <div key={String(label)}>
                  <span className="small-label">
                    {icon}
                    {label}
                  </span>
                  <div className="readout">
                    {num}
                    <small>{unit}</small>
                  </div>
                </div>
              ))}
            </div>
            <div className="warp">
              <div className="small-label">
                <Clock3 />
                Time warp
              </div>
              <div className="pills">
                {[1, 5, 20].map((n) => (
                  <button
                    key={n}
                    aria-pressed={m.rate === n}
                    disabled={!m.loaded || (n > 1 && (!canWarp(s) || m.paused))}
                    onClick={() => m.warp(n)}
                  >
                    {n}×
                  </button>
                ))}
              </div>
              <button
                className="pause"
                disabled={!flying}
                onClick={m.togglePause}
              >
                {m.paused ? <Play size={14} /> : <Pause size={14} />}{" "}
                {m.paused ? "Resume" : "Pause"}
              </button>
            </div>
          </section>
          <section className="control panel">
            <div className="panel-title">
              <h2>
                <SlidersHorizontal />
                Flight controls
              </h2>
              <span className={"status " + (ended ? "terminal" : "")}>
                <i />
                {flightStatus()}
              </span>
            </div>
            <div className="vehicle">
              <div className="vehicle-icon">
                <Rocket size={23} />
              </div>
              <div>
                <h3>Pioneer 01</h3>
                <p>Two-stage launch vehicle</p>
              </div>
            </div>
            <fieldset disabled={!m.loaded || ended}>
              <div className="row">
                <label htmlFor="throttle" className="small-label">
                  Throttle
                </label>
                <span className="twr" title="Thrust-to-weight ratio">
                  TWR {twr.toFixed(2)}
                </span>
                <strong>
                  {Math.round(s.throttle * 100)}
                  <em>%</em>
                </strong>
              </div>
              <input
                id="throttle"
                className="slider"
                style={
                  { "--level": s.throttle * 100 + "%" } as React.CSSProperties
                }
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round(s.throttle * 100)}
                onChange={(e) => throttle(+e.target.value / 100)}
              />
              <div className="attitude">
                <label className="small-label" htmlFor="attitude">
                  Attitude
                </label>
                <div className="select">
                  <select
                    id="attitude"
                    value={s.mode}
                    onChange={(e) => flightMode(e.target.value as Mode)}
                  >
                    <option value="guide">Ascent guide</option>
                    <option value="manual">Manual pitch</option>
                    <option value="prograde">Prograde hold</option>
                    <option value="retrograde">Retrograde hold</option>
                  </select>
                  <ChevronDown size={13} />
                </div>
              </div>
              <div className="pitch">
                <span className="small-label">Pitch</span>
                <div className="stepper">
                  <button
                    aria-label="Decrease pitch by five degrees"
                    onClick={() => pitch(s.pitch - 5)}
                  >
                    <Minus size={14} />
                  </button>
                  <output>{Math.round(s.pitch)}°</output>
                  <button
                    aria-label="Increase pitch by five degrees"
                    onClick={() => pitch(s.pitch + 5)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </fieldset>
            <div className="engine">
              <div className="row">
                <span className="small-label">
                  <Layers2 />
                  Stage {s.stage + 1} / 2
                </span>
                <span>{STAGES[s.stage].name}</span>
              </div>
              <div className="fuel">
                <span style={{ width: fuelPct + "%" }} />
              </div>
              <div className="fuel-row">
                <span>
                  Propellant <b>{Math.ceil(fuelPct)}%</b>
                </span>
                <span>
                  Δv <b>{Math.round(deltaV(s)).toLocaleString("en-US")} m/s</b>
                </span>
              </div>
            </div>
            <button
              className="primary"
              onClick={primary}
              disabled={
                !m.loaded || lowThrust || (flying && !booster && !fuelPct)
              }
            >
              {pad ? (
                <Rocket size={17} />
              ) : ended ? (
                <RotateCcw size={17} />
              ) : booster ? (
                <Layers2 size={17} />
              ) : (
                <Radio size={17} />
              )}{" "}
              {primaryLabel()}
            </button>
          </section>
          <section className="mission panel">
            <div className="panel-title">
              <h2>
                <Flag />
                Flight plan
              </h2>
              <span className="counter">
                {objectives.filter((t) => t.done).length} / 3
              </span>
            </div>
            <div className="mission-inner">
              <h3>First orbit</h3>
              <p>{guidance}</p>
              <div className="steps">
                {objectives.map((t, i) => (
                  <span
                    key={t.name}
                    className={t.done ? "done" : i === current ? "next" : ""}
                  >
                    <i>{t.done ? <Check size={11} /> : i + 1}</i>
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          </section>
          <section className="log panel">
            <div className="panel-title">
              <h2>
                <List />
                Event log
              </h2>
              {m.mission.log.length > 3 && (
                <button className="text-btn" onClick={() => L(!allLog)}>
                  {allLog ? "Show less" : "Show all"}
                </button>
              )}
            </div>
            <ul>
              {visibleLog.map((e, i) => (
                <li key={i}>
                  <time>{clock(e.t)}</time>
                  <span>{e.text}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <footer>
          <span>Apogee Flight Program</span>
          <span>
            Flight build <b>0.1.0</b>
          </span>
        </footer>
      </main>
      {dialog && (
        <Dialog
          title={
            dialog === "guide"
              ? "Flight guide"
              : dialog === "data"
                ? "Mission data"
                : dialog === "stage"
                  ? "Separate booster?"
                  : dialog === "import"
                    ? "Restore this flight?"
                    : "Start a new flight?"
          }
          close={() => D("")}
        >
          {dialog === "guide" && (
            <>
              <h3>Your first orbit</h3>
              <ol>
                <li>
                  <b>Launch.</b> Leave Ascent guide selected and throttle at
                  100%. The guide steers the rocket from vertical ascent into
                  its gravity turn.
                </li>
                <li>
                  <b>Stage.</b> At about T+02:10 the booster runs dry. Select
                  Separate stage. The upper engine uses your current throttle
                  setting.
                </li>
                <li>
                  <b>Reach orbit.</b> With prompt staging, insertion takes about
                  five minutes from liftoff. The guide cuts the engine once
                  periapsis clears 100 km and apoapsis is below 2,000 km.
                </li>
              </ol>
              <h3>Fly the map</h3>
              <p>
                Ap marks the highest point of your current ballistic path. Pe
                marks the lowest. A negative Pe passes through Earth. Drag to
                pan, pinch or scroll to zoom, or track the craft for a closer
                view.
              </p>
              <p>
                After insertion, select prograde to burn along your velocity or
                retrograde to slow down. Burning prograde near Ap lifts Pe.
                Manual pitch is measured clockwise from local vertical in the
                flight view.
              </p>
              <p>
                Set throttle to zero to coast. Warp unlocks above 101 km and
                drops to 1× before atmospheric entry. Closing the game suspends
                flight. A restored flight opens paused.
              </p>
              <h3>Keyboard</h3>
              <p>
                <kbd>M</kbd> switch view · <kbd>P</kbd> pause · <kbd>Space</kbd>{" "}
                primary action · <kbd>← →</kbd> pitch · <kbd>↑ ↓</kbd> throttle
              </p>
            </>
          )}
          {dialog === "data" && (
            <>
              <p>
                Back up this mission or move it to another browser. Flight state
                and event history travel together.
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
                  <p>Return Pioneer 01 to the launchpad.</p>
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
                This replaces the current mission and its log. You can export a
                backup first.
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
                Replace this mission with the saved Pioneer 01 flight at T+{" "}
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
            <p className="pause-note">
              Flight paused. Select Resume on the console to continue.
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="close-bottom" onClick={() => D("")}>
            {dialog === "guide" || dialog === "data" ? "Close" : "Cancel"}
          </button>
        </Dialog>
      )}
    </>
  );
}
