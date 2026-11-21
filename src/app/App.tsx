import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  FastForward,
  Gauge,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Check,
  Database,
  Flag,
  Layers2,
  List,
  Orbit,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Rocket,
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
      aria-label={title}
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
    [error, E] = useState("");
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
  const pilotDisabled = !m.loaded || ended;
  const actionText = lowThrust
    ? "Thrust too low"
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
        <small>{unit}</small>
      </strong>
    </div>
  );
  return (
    <>
      <main
        className={"game " + (active ? "range-view" : "map-view")}
        aria-label="Pioneer 01 flight simulator"
      >
        <div className="scene-wrap" hidden={!active}>
          <FlightScene vessel={m.vessel} />
        </div>
        {!active && <OrbitalMap s={s} />}
        <div className="shade" aria-hidden="true" />
        <div className="hud">
          <header className="topline">
            <div className="identity">
              <span className="insignia">
                <Orbit />
              </span>
              <div>
                <strong>Pioneer 01</strong>
                <span className="timer">T+ {clock(s.t)}</span>
              </div>
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
              <button
                aria-label={m.paused ? "Resume" : "Pause"}
                title={m.paused ? "Resume" : "Pause"}
                disabled={!flying}
                onClick={m.togglePause}
              >
                {m.paused ? <Play /> : <Pause />}
              </button>
              <button
                aria-label="Mission menu"
                title="Mission menu"
                onClick={() => open("menu")}
              >
                <Menu />
              </button>
            </nav>
          </header>
          <div className="telemetry">
            {instrument("ALT", distance(m.alt), "km")}
            {instrument(
              "VEL",
              Math.round(speed(s)).toLocaleString("en-US"),
              "m/s",
            )}
            {!active && (
              <>
                {instrument(
                  "Ap",
                  pad ? "—" : distance(Math.max(0, o.ap)),
                  pad || !Number.isFinite(o.ap) ? "" : "km",
                )}
                {instrument("Pe", pad ? "—" : distance(o.pe), pad ? "" : "km")}
              </>
            )}
          </div>
          <div className="quick">
            <button
              title="Flight plan"
              aria-label="Flight plan"
              onClick={() => open("plan")}
            >
              <Flag />
            </button>
            <button
              title="Event log"
              aria-label="Event log"
              onClick={() => open("log")}
            >
              <List />
            </button>
          </div>
          <div className="pilot-left">
            <label className="assist">
              <Gauge size={15} />
              <span>
                {
                  {
                    guide: "Guide",
                    manual: "Manual",
                    prograde: "Prograde",
                    retrograde: "Retrograde",
                  }[s.mode]
                }
              </span>
              <select
                aria-label="Attitude"
                disabled={pilotDisabled}
                value={s.mode}
                onChange={(e) => flightMode(e.target.value as Mode)}
              >
                <option value="guide">Ascent guide</option>
                <option value="manual">Manual pitch</option>
                <option value="prograde">Prograde hold</option>
                <option value="retrograde">Retrograde hold</option>
              </select>
            </label>
            <div className="pitch">
              <span className="control-label">
                Pitch <b>{Math.round(s.pitch)}°</b>
              </span>
              <div className="pitch-pair">
                <button
                  aria-label="Decrease pitch by five degrees"
                  title="Pitch left"
                  disabled={pilotDisabled}
                  onClick={() => pitch(s.pitch - 5)}
                >
                  <ChevronLeft />
                </button>
                <button
                  aria-label="Increase pitch by five degrees"
                  title="Pitch right"
                  disabled={pilotDisabled}
                  onClick={() => pitch(s.pitch + 5)}
                >
                  <ChevronRight />
                </button>
              </div>
            </div>
          </div>
          <label className="thrust">
            <span className="control-label">Thrust</span>
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
          <div className="command">
            <span
              role="status"
              className={
                "state" + (booster && flying && !fuelPct ? " alert" : "")
              }
            >
              <i />
              {flightStatus()}
            </span>
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
            <div className="fuel-label">
              <span>S{s.stage + 1} FUEL</span>
              <b>{Math.ceil(fuelPct)}%</b>
            </div>
            <div className="fuel-track">
              <i style={{ width: fuelPct + "%" }} />
            </div>
          </div>
          {(!active || m.rate > 1) && (
            <button
              className="warp-toggle"
              title="Time warp"
              aria-label="Time warp"
              onClick={() => D("warp")}
            >
              <FastForward />
              {m.rate}×
            </button>
          )}
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
              <h3>First orbit</h3>
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
                {[1, 5, 20].map((n) => (
                  <button
                    key={n}
                    aria-pressed={n === m.rate}
                    disabled={!m.loaded || (n > 1 && (!canWarp(s) || m.paused))}
                    onClick={() => {
                      m.warp(n);
                      D("");
                    }}
                  >
                    {n}×
                  </button>
                ))}
              </div>
              {(!canWarp(s) || m.paused) && (
                <p>
                  Warp is available while coasting above 101 km with flight
                  running.
                </p>
              )}
            </>
          )}
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
                  <b>Stage.</b> At about T+02:10 the booster runs dry. Tap
                  Stage. The upper engine uses your current throttle setting.
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
