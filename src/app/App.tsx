import { flightPrompt } from "./miloFlight";
import { MiloGuide } from "./MiloGuide";
import { MissionComplete } from "./MissionComplete";
import { useZoomInput, type Camera } from "../game/flightCamera";
import { Dialog } from "./Dialog";
import { CloudSyncPanel } from "./CloudSyncPanel";
import { LaunchSite } from "./LaunchSite";
import { Workshop } from "./Workshop";
import { LunarSite } from "./LunarSite";
import { SoundingReport } from "./SoundingReport";
import { CONTRACTS, activeContractInfo, contractTasks, level, type ContractTask } from "../program/program";
import { useEffect, useRef, useState } from "react";
import {
  Minus, Plus, LocateFixed, ChevronDown, ChevronLeft,
  ChevronRight,
  Menu,
  FastForward,
  Landmark,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Check,
  ClipboardList,
  Coins,
  Database,
  Flag,
  Flame,
  Layers2,
  List,
  Orbit,
  Pause,
  Power,
  Play,
  Radio,
  RotateCcw,
  Rocket,
  TriangleAlert,
  Wind,
  Wrench,
  X,
} from "lucide-react";
import { FlightTelemetry, type FlightMetric } from "./FlightTelemetry";
import { FlightScene } from "../game/scenes/FlightScene";
import { OrbitalMap } from "../game/orbital/OrbitalMap";
import {
  AIR,
  CHUTE_MAX_SPEED,
  burning,
  stagesOf,
  hasUpperStage,
  thrustToWeight,
  toggleChute,
  toggleLegs,
  canChuteWarp,
  canMidWarp,
  canHighWarp,
  canWarp,
  clamp,
  deltaV,
  orbit,
  landingLimits,
  speed,
  surfaceVelocity,
} from "../sim/flight";
import { validate } from "../persistence/save";
import { useMission } from "./useMission";
import "./interface.css";

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

const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const hudDistance = (meters: number) =>
  Math.abs(meters) >= 1000000 && Number.isFinite(meters) ? compactNumber.format(meters / 1000) : distance(meters);
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
  const savedThrottleRef = useRef<number>(1);
  const upload = useRef<HTMLInputElement>(null),
    backup = useRef<ReturnType<typeof validate> | null>(null);

  const host = useRef<HTMLElement>(null);
  const rocketCam = useRef<Camera | null>(null);
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null);
  const mapCam = useRef<Camera | null>(null);
  const [mapEntry, setMapEntry] = useState<number | null>(null);
  const [mapKey, remountMap] = useState(0);
  const [checklist, setChecklist] = useState<{ flight: typeof s; pad: boolean; open: boolean } | null>(null);
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const [mapVisited, visitMap] = useState(false);
  const [fading, fade] = useState(false);
  const inFlight = active || m.mission.view === "map";
  useEffect(() => {
    if (!inFlight) { visitMap(false); setMapEntry(null); setChecklist(null); }
    setTelemetryOpen(false);
    if (!active && inFlight) visitMap(true);
    const id = setTimeout(() => fade(false), 170);
    return () => clearTimeout(id);
  }, [inFlight, active]);
  useZoomInput(host, inFlight && !dialog && !s.completion,
    (factor,x,y) => (m.mission.view === "map" ? mapCam : rocketCam).current?.zoom(factor,x,y),
    () => {
      mapCam.current?.cancelDrag?.();
      stopSteer();
    });
  useEffect(() => { if (s.completion) stopSteer(); }, [s.completion]);

  const pad = s.status === "pad",
    flying = s.status === "flying",
    ended = !pad && !flying,
    booster = s.stage === 0 && hasUpperStage(s);
  const st = stagesOf(s);
  const stageMaxFuel = st[s.stage].fuel;
  const fuelPct =
    stageMaxFuel > 0 ? (100 * s.fuel[s.stage]) / stageMaxFuel : 0;
  const twr = thrustToWeight(s);
  const lowThrust = pad && twr <= 1;
  const sortie = m.mission.program.sortie;
  const contractInfo = activeContractInfo(m.mission.program);
  const isRealContract = Boolean(contractInfo);
  const launchQuote = contractInfo;
  const trackingLevel = level(m.mission.program, "tracking");
  const soundingReport = m.mission.program.soundingReport;

  function flightStatus() {
    if (pad)
      return isRealContract
        ? s.vehicleName ?? contractInfo!.name
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

  function toggleView(map: boolean, matched?: number) {
    const nextView = map ? "map" : "flight";
    if (s.completion || m.mission.view === nextView) return;
    stopSteer();
    mapCam.current?.cancelDrag?.();
    fade(!matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (map && (matched !== undefined || mapEntry !== null || !mapVisited)) {
      setMapEntry(matched ?? null);
      remountMap(n => n+1);
    }
    m.change(() => {
      m.mission.view = nextView;
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
      toggleEngine();
  }

  const canSteer = m.loaded && !m.paused && flying && !s.chuteDeployed;

  function pitch(value: number) {
    if (!canSteer) return;
    m.change((f) => {
      f.mode = "manual";
      f.pitch = wrapPitch(value);
    });
  }

  function startSteer(dir: -1 | 1, e: React.PointerEvent<HTMLButtonElement>) {
    if (!canSteer || e.button !== 0) return;
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
    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      const cur = m.vessel.current;
      if (
        steerDirRef.current !== 0 &&
        m.loaded &&
        !m.paused &&
        cur.status === "flying" &&
        !cur.chuteDeployed
      ) {
        const rateDegPerSec = burning(cur) ? 68 : 48;
        cur.mode = "manual";
        cur.pitch = wrapPitch(
          cur.pitch + steerDirRef.current * rateDegPerSec * dt,
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
    const next = clamp(value, 0, 1);
    if (next > 0.005) savedThrottleRef.current = next;
    m.change((f) => {
      f.throttle = next;
    });
  }

  function toggleEngine() {
    if (pilotDisabled) return;
    const turningOff = s.throttle > 0;
    const restore = clamp(savedThrottleRef.current || 1, 0.01, 1);
    if (turningOff) savedThrottleRef.current = s.throttle;
    m.change(
      (f) => {
        f.throttle = turningOff ? 0 : restore;
      },
      turningOff
        ? "Engines cut."
        : `Engines ignited (${Math.round(restore * 100)}%).`,
    );
  }

  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        dialog || m.vessel.current.completion ||
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
          if (telemetryOpen) setTelemetryOpen(false);
          else if (checklistOpen && !pad) setChecklist({ flight: s, pad, open: false });
          else if (!active) toggleView(false);
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
        case "KeyX":
          if (!e.repeat) toggleEngine();
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

  const objectives: ContractTask[] = [
    { name: "Lift off", done: !pad },
    ...(isRealContract
      ? contractTasks(m.mission.program, s)
      : [
          ...(hasUpperStage(s) ? [{ name: "Separate booster", done: !booster }] : []),
          { name: "Establish orbit", done: s.orbitEarned },
        ]),
  ];
  // A settled contract keeps its completed checklist during descent and after reload.
  if (m.mission.program.rewarded) objectives.forEach(task => { task.done = true; });
  const current = objectives.findIndex((t) => !t.done);
  const guidance = m.mission.program.rewarded
    ? "Reward collected. Return to Base to upgrade facilities."
    : ended
      ? s.status === "lost"
        ? (s.crashReason || "Surface impact. Return to pad for another flight.")
        : "Touchdown confirmed."
      : pad
        ? isRealContract
          ? "Launch commits Hardware + Propellant, or test in Simulate Free."
          : "Free simulation (0 cost, 0 payout). Launch when ready."
        : booster && fuelPct === 0
          ? "Booster empty. Tap Stage."
          : s.orbitEarned
            ? "Orbit reached. Open Map to coast at 5×–20× (100× above 500 km, 500× above 1,500 km)."
            : "Hold left or right screen edges to pitch (works in coast or burn).";

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

  const radio = m.loaded && !dialog && !s.completion ? flightPrompt(m.mission, m.paused) : null;
  const radioMessage = radio && (
    <div className="flight-milo">
      <MiloGuide
        title={radio.title}
        actions={
          radio.ack === "apPeSeen" ? (
            <button
              className="primary"
              onClick={() => m.updateTutorial({ apPeSeen: true })}
            >
              Got it
            </button>
          ) : undefined
        }
        dismissLabel={
          radio.ack === "apPeSeen"
            ? "Dismiss AP and PE lesson"
            : sortie === "hop"
              ? "Dismiss staging lesson"
              : "Hide tutorial"
        }
        dismiss={() =>
          m.updateTutorial(
            radio.ack === "apPeSeen"
              ? { apPeSeen: true }
              : sortie === "hop"
                ? { stagingSeen: true }
                : { status: "off" },
          )
        }
      >
        {radio.text}
      </MiloGuide>
    </div>
  );
  const flightNotice = m.notice && !(radio && m.notice.startsWith(CONTRACTS.sounding.name + " complete")) && (
    <div className="notice" role="alert">
      <TriangleAlert size={16} />
      {m.notice}
      <button aria-label="Dismiss message" onClick={() => m.setNotice("")}>
        <X />
      </button>
    </div>
  );
  const checklistOpen = checklist?.flight === s && checklist.pad === pad ? checklist.open : pad;
  const objectivesDone = objectives.filter(task => task.done).length;
  const missionSummary = objectives[current]?.name ?? "Objectives complete";

  const { vr, vt } = surfaceVelocity(s);
  const landing = active && flying && vr < -0.5 && m.alt < (s.body === "moon" ? 5000 : 2000);
  const altitude = m.alt < 1000
    ? { label: "ALT", value: String(Math.round(m.alt)), unit: "m" }
    : { label: "ALT", value: hudDistance(m.alt), unit: "km" };
  const velocity = { label: "VEL", value: compactNumber.format(Math.round(speed(s))), unit: "m/s" };
  const pitchMetric = s.chuteDeployed
    ? { label: "CHUTE", value: "LOCK" }
    : { label: "PITCH", value: `${Math.round(s.pitch)}°` };
  const fuel = { label: `S${s.stage + 1} FUEL`, value: String(Math.ceil(fuelPct)), unit: "%", fuel: fuelPct };
  const apoapsis = { label: "AP", value: pad ? "—" : hudDistance(Math.max(0, o.ap)),
    unit: !pad && Number.isFinite(o.ap) ? "km" : undefined };
  const periapsis = { label: "PE", value: pad ? "—" : hudDistance(o.pe), unit: pad ? undefined : "km" };

  const touchdown = landingLimits(s);
  const descentMetric = (label: string, value: number, limit: number, unit: string): FlightMetric => ({
    label, value: unit === "°" ? String(Math.round(value)) : value.toFixed(1), unit,
    tone: Math.abs(value) >= limit ? "danger" : Math.abs(value) >= limit * 0.65 ? "warn" : "safe",
  });
  const primaryMetrics = landing ? [
    altitude,
    descentMetric("V/S", vr, touchdown.maxVr, "m/s"),
    descentMetric("H/S", Math.abs(vt), touchdown.maxVt, "m/s"),
    descentMetric("TILT", Math.abs(s.pitch), touchdown.maxTilt, "°"),
  ] : active ? [altitude, velocity, pitchMetric, fuel]
    : pad ? [apoapsis, periapsis, altitude, velocity] : [apoapsis, periapsis, pitchMetric, fuel];
  const extraMetrics = landing ? [apoapsis, periapsis, velocity, fuel] : active
    ? [apoapsis, periapsis] : pad ? [pitchMetric, fuel] : [altitude, velocity];

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
      <main ref={host}
        className={"game " + (active ? "range-view" : "map-view")}
        aria-label="Pioneer 01 flight simulator"
      >
        <div className="scene-wrap" hidden={!active && !fading} aria-hidden={!active}>
          <FlightScene vessel={m.vessel} camera={rocketCam} onOpenMap={z => toggleView(true,z)} />
        </div>
        {(!active || mapVisited) && <div className={"orbital-layer" + (active ? " leaving" : "")}
          hidden={active && !fading} aria-hidden={active} inert={active}>
          <OrbitalMap key={mapKey} toolbar={active ? null : toolbar} s={s} entry={mapEntry} camera={mapCam} trackingLevel={trackingLevel}
            onOpenFlight={() => { rocketCam.current?.setZoom?.(0.32); toggleView(false); }} />
        </div>}
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
                onClick={(e) => { if (e.detail === 0) pitch(s.pitch - 2); }}
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
                onClick={(e) => { if (e.detail === 0) pitch(s.pitch + 2); }}
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
                data-milo-focus={radio?.target === "base"}
                title="Base"
                onClick={m.visitSite}
              >
                <Landmark />
              </button>
              <div className="flight-readout">
                <span role="status" className={"state" + (booster && flying && !fuelPct ? " alert" : "")}>
                  <i />{flightStatus()}
                </span>
                {!pad && <span className="timer">T+ {clock(s.t)}</span>}
              </div>
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
                className={"view-switch" + (!active ? " selected" : "")}
                aria-label={active ? "Orbital map" : "Flight view"}
                title={active ? "Open orbital map" : "Return to rocket view"}
                onClick={() => toggleView(active)}
              >
                {active ? <Orbit /> : <Rocket />}
                <span aria-hidden="true">{active ? "Map" : "Rocket"}</span>
              </button>
              {flying && (
                <button
                  aria-label={m.paused ? "Resume" : "Pause"}
                  data-milo-focus={radio?.target === "resume"}
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
            <FlightTelemetry primary={primaryMetrics} secondary={extraMetrics} landing={landing}
              expanded={telemetryOpen} guide={radio?.target}
              toggle={() => {
                if (!telemetryOpen) setChecklist({ flight: s, pad, open: false });
                setTelemetryOpen(!telemetryOpen);
              }}
            />
          )}

          <div className="hud-tools">
            <div className="camera-row" ref={setToolbar}>
              {active && <div className="rocket-camera" aria-label="Rocket camera" role="group">
                <button aria-label="Zoom out" onClick={() => rocketCam.current?.step?.(-1)}><Minus /></button>
                <button aria-label="Zoom in" onClick={() => rocketCam.current?.step?.(1)}><Plus /></button>
                <button aria-label="Recenter rocket" onClick={() => rocketCam.current?.reset()}><LocateFixed /></button>
              </div>}
            </div>
            {isRealContract && (
              <section className="contract-checklist" aria-label="Active contract">
                <button type="button" className="mission-progress" aria-expanded={checklistOpen} aria-controls="flight-tasks"
                  title={missionSummary} onClick={() => {
                    setTelemetryOpen(false);
                    setChecklist({ flight: s, pad, open: !checklistOpen });
                  }}>
                  <span key={objectivesDone} className="progress-count">{objectivesDone}/{objectives.length}</span>
                  <span className="mission-next">{missionSummary}</span>
                  <ChevronDown aria-hidden="true" />
                </button>
                <div id="flight-tasks" className="mission-tasks" hidden={!checklistOpen}>
                  <h2>{contractInfo!.name}</h2>
                  <ul>
                    {objectives.map(task => (
                      <li key={task.name}>
                        <span role="checkbox" aria-readonly="true" aria-checked={task.done} aria-label={task.name}>
                          <i aria-hidden="true">{task.done && <Check size={10} strokeWidth={3} />}</i>
                          {task.name}
                        </span>
                        {!task.done && task.remainingSeconds !== undefined &&
                          <small>{clock(task.remainingSeconds).slice(3)}</small>}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </div>
          {isRealContract ? <div className="contract-messages">{radioMessage}{flightNotice}</div> : radioMessage}
          <div className="hud-bottom">
            <div className="thrust-dock">
              <label className="thrust" data-milo-focus={radio?.target === "throttle"}>
                <span className="control-label">Thr</span>
                <b>{s.throttle > 0 && s.throttle < 0.01 ? "1" : Math.round(s.throttle * 100)}%</b>
                <input
                  aria-label="Throttle"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(Math.sqrt(clamp(s.throttle, 0, 1)) * 100)}
                  disabled={pilotDisabled}
                  style={
                    {
                      "--fill": Math.sqrt(clamp(s.throttle, 0, 1)) * 100 + "%",
                    } as React.CSSProperties
                  }
                  onChange={(e) => {
                    const u = +e.target.value / 100;
                    throttle(u * u);
                  }}
                />
              </label>
              <button
                type="button"
                className={"engine-toggle-btn" + (s.throttle > 0 ? " active-gear" : "")}
                aria-pressed={s.throttle > 0}
                aria-label={
                  s.throttle > 0
                    ? "Cut engine thrust"
                    : `Restore engine thrust to ${Math.round((savedThrottleRef.current || 1) * 100)}%`
                }
                title={
                  s.throttle > 0
                    ? "Cut engine (X)"
                    : `Ignite at ${Math.round((savedThrottleRef.current || 1) * 100)}% (X)`
                }
                disabled={pilotDisabled}
                onClick={toggleEngine}
              >
                <Power size={13} />
                <span>{s.throttle > 0 ? "ON" : "OFF"}</span>
              </button>
            </div>

            <div className={"flight-actions" + (pad ? " actions-pad" : "")}>
              {flying && (s.hasLegs !== false || s.hasChute !== false) && (
                <div className="landing-toggles">
                  {s.hasLegs !== false && (
                    <button
                      className={s.legsDeployed ? "active-gear" : ""}
                      aria-pressed={Boolean(s.legsDeployed)}
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
                      aria-pressed={Boolean(s.chuteDeployed)}
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
                  data-milo-focus={radio?.target === "command"}
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
                    Simulate free
                  </button>
                )}


              </div>
            </div>
          </div>
        </div>

        {!isRealContract && flightNotice}
      </main>

      {s.completion && <MissionComplete flight={s} choose={base => { D(""); m.finishCompletion(base); }} />}
      {dialog && !s.completion && (
        <Dialog
          tone={["reset", "import", "stage"].includes(dialog) ? "warning" : undefined}
          title={
            {
              menu: "Mission menu",
              plan: "Flight plan",
              log: "Event log",
              "sounding-report": "Sounding report",
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
                <button aria-label="Earth launch site"
                  onClick={() => {
                    D("");
                    m.visitSite();
                  }}
                >
                  <Landmark size={19} />
                  Earth base
                </button>
                <button aria-label="Rocket Workshop"
                  onClick={() => {
                    D("");
                    m.openWorkshop();
                  }}
                >
                  <Wrench size={19} />
                  Workshop
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
                {soundingReport && (
                  <button onClick={() => D("sounding-report")}>
                    <ClipboardList size={19} />
                    Sounding report
                  </button>
                )}
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
                {contractInfo ? contractInfo.name : "Free simulation"}
              </h3>
              {contractInfo && launchQuote && (
                <p>
                  {contractInfo.goal}{" "}
                  {m.mission.program.rewarded
                    ? "Reward collected."
                    : pad
                      ? `Cost: ${launchQuote.hardwareCost} C + ${launchQuote.propellantCost} Prop.`
                      : ""}
                </p>
              )}
              {sortie === "sounding" && pad && launchQuote && (
                <p>Payout · {launchQuote.credits} C + {launchQuote.research} RD</p>
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
              {sortie === "sounding" && m.mission.program.paid && soundingReport && (
                <SoundingReport report={soundingReport} />
              )}
            </>
          )}
          {dialog === "sounding-report" && soundingReport && (
            <SoundingReport report={soundingReport} />
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
                {(canChuteWarp(s) ? [1, 3] : [1, 5, 20, 100, 500]).map((n) => (
                  <button
                    key={n}
                    aria-pressed={n === m.rate}
                    disabled={
                      !m.loaded ||
                      (n > 1 &&
                        (m.paused ||
                          (n === 3
                            ? !canChuteWarp(s)
                            : n >= 500
                              ? !canHighWarp(s)
                              : n >= 100
                                ? !canMidWarp(s)
                                : !canWarp(s))))
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
              {((!canWarp(s) && !canChuteWarp(s)) || m.paused) ? (
                <p>
                  Warp is available while coasting above 30.5 km (5×/20×), above
                  500 km (100×), above 1,500 km (500×), or descending under
                  parachute (3×) with flight running.
                </p>
              ) : (
                !canChuteWarp(s) &&
                !canHighWarp(s) && (
                  <p>
                    {!canMidWarp(s)
                      ? "100× warp unlocks while coasting above 500 km altitude, and 500× unlocks above 1,500 km."
                      : "500× warp unlocks while coasting above 1,500 km altitude."}
                  </p>
                )
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
              <h3>Orbital telemetry (AP &amp; PE)</h3>
              <p>
                <b>AP (Apoapsis)</b> is the highest altitude your current
                trajectory will reach. <b>PE (Periapsis)</b> is the lowest
                point. Pitch sideways during ascent and burn near AP to raise PE
                above 30 km for a stable orbit.
              </p>
              <h3>Keyboard</h3>
              <p>
                <kbd>M</kbd> map · <kbd>P</kbd> pause · <kbd>Space</kbd> action
                · <kbd>X</kbd> engine on/off · <kbd>← → / A D</kbd> pitch ·{" "}
                <kbd>↑ ↓ / W S</kbd> throttle · <kbd>L</kbd> legs ·{" "}
                <kbd>C</kbd> chute
              </p>
              <div className="dialog-actions">
                <button
                  type="button"
                  onClick={() => {
                    m.updateTutorial({
                      status: "active",
                      vabStep: 0,
                      contractsStep: 0,
                      apPeSeen: false,
                      stagingSeen: false,
                      hideInvite: false,
                    });
                    D("");
                  }}
                >
                  Replay Milo’s tutorial
                </button>
              </div>
            </>
          )}
          {dialog === "data" && (
            <>
              <CloudSyncPanel mission={m} />
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
                className="danger"
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
                className="danger"
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
