import { useState, useEffect } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  ClipboardList,
  Coins,
  Crosshair,
  FlaskConical,
  Globe,
  Landmark,
  Minus,
  Move,
  Plus,
  Rocket,
  Warehouse,
  X,
} from "lucide-react";
import { EarthScene, type Tile } from "../game/scenes/EarthScene";
import {
  CONTRACTS,
  FACILITIES,
  SIZE,
  launchMass,
  launchIssue,
  level,
  padCaps,
  placement,
  quote,
  terrain,
  upgradeCost,
  type Kind,
  type Job,
  type Sortie,
  type Program,
} from "../program/program";
import type { useMission } from "./useMission";
import { Dialog } from "./Dialog";
import "./site.css";
const glyph = {
  command: Landmark,
  pad: Rocket,
  lab: FlaskConical,
  fuel: Warehouse,
};
const kinds = Object.keys(FACILITIES) as Kind[];
const jobs = Object.keys(CONTRACTS) as Job[];
function benefit(k: Kind, n: number) {
  if (k === "pad") {
    const c = padCaps(n);
    return c.tonnes + " t · " + c.height + " m clearance";
  }
  if (k === "lab") return "+" + n + " research per contract";
  if (k === "fuel") return "−" + 10 * n + " credits per paid launch";
  return n === 1
    ? "Standard mission payouts"
    : "+" + 15 * (n - 1) + " credits per contract";
}
function freeTile(p: Program, k: Kind): Tile {
  for (let y = 1; y < SIZE; y++)
    for (let x = 1; x < SIZE; x++) if (!placement(p, k, x, y)) return { x, y };
  return { x: 2, y: 2 };
}
export function LaunchSite({
  mission: m,
  onFlight,
}: {
  mission: ReturnType<typeof useMission>;
  onFlight: () => void;
}) {
  const p = m.mission.program,
    flight = m.mission.flight;
  const [panel, P] = useState<"board" | "build" | "replace" | null>(null);
  const [selected, S] = useState<Tile | null>(null),
    [placing, G] = useState<Kind | null>(null),
    [pending, Q] = useState<Sortie>("practice");
  const [zoom, Z] = useState(0),
    [home, H] = useState(0),
    [message, M] = useState("");
  const b = p.buildings.find((b) => b.x === selected?.x && b.y === selected?.y);
  const issue =
    selected && placing ? placement(p, placing, selected.x, selected.y) : "";
  const cellName = selected
    ? String.fromCharCode(65 + selected.x) + (selected.y + 1)
    : "";
  const credits = (n: number) => n.toLocaleString("en-US");
  function cancel() {
    S(null);
    G(null);
    M("");
  }
  function chooseTile(t: Tile) {
    S(t);
    M("");
  }
  function startPlace(k: Kind) {
    const built = p.buildings.find((b) => b.kind === k);
    S(built ? { x: built.x, y: built.y } : freeTile(p, k));
    G(k);
    M("");
    P(null);
  }
  function pick(job: Sortie) {
    Q(job);
    if (flight.status !== "pad") {
      P("replace");
      return;
    }
    if (m.newSortie(job)) P(null);
  }
  function confirm() {
    if (!placing || !selected) return;
    const result = m.editSite(placing, selected);
    if (result) M(result);
    else {
      G(null);
      M("");
    }
  }
  function move(dx: number, dy: number) {
    if (selected)
      chooseTile({
        x: Math.min(7, Math.max(0, selected.x + dx)),
        y: Math.min(7, Math.max(0, selected.y + dy)),
      });
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (panel || !selected) return;
      if (e.key === "Escape") {
        cancel();
        return;
      }
      const dirs: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (placing && dirs[e.key]) {
        e.preventDefault();
        move(...dirs[e.key]);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function showPanel(v: "build" | "board") {
    cancel();
    P(v);
  }
  const buttonsDisabled = !m.loaded;
  return (
    <main className="game site-game" aria-label="Earth launch site">
      <EarthScene
        program={p}
        selected={selected}
        placing={placing}
        onTile={chooseTile}
        zoom={zoom}
        recenter={home}
      />
      <div className="site-vignette" />
      <div className="site-hud">
        <header className="site-top">
          <div className="site-identity">
            <Globe />
            <div>
              <h1>Earth range</h1>
              <small>Launch complex 01</small>
            </div>
          </div>
          <div className="wallet" aria-label="Program resources">
            <span title="Credits">
              <Coins />
              {credits(p.credits)}
            </span>
            <span title="Research">
              <FlaskConical />
              {p.research}
            </span>
          </div>
        </header>
        <div className="site-cameras">
          <button aria-label="Zoom in on site" onClick={() => Z((v) => v + 1)}>
            <Plus />
          </button>
          <button aria-label="Zoom out of site" onClick={() => Z((v) => v - 1)}>
            <Minus />
          </button>
          <button aria-label="Center site" onClick={() => H((v) => v + 1)}>
            <Crosshair />
          </button>
        </div>
        {selected && (
          <section className="inspector">
            <header>
              <div>
                <small>Plot {cellName}</small>
                <h2>
                  {placing
                    ? (level(p, placing) ? "Move " : "Place ") +
                      FACILITIES[placing].name
                    : b
                      ? FACILITIES[b.kind].name
                      : terrain(selected.x, selected.y) === "land"
                        ? "Open ground"
                        : "Reserved terrain"}
                </h2>
              </div>
              <button aria-label="Close inspector" onClick={cancel}>
                <X />
              </button>
            </header>
            {placing ? (
              <>
                <p>{issue || "Tap a plot to preview placement."}</p>
                <div className="inspect-actions">
                  <button onClick={cancel}>Cancel</button>
                  <button
                    className="primary"
                    disabled={Boolean(issue) || buttonsDisabled}
                    onClick={confirm}
                  >
                    <Check />
                    Confirm placement
                  </button>
                </div>
              </>
            ) : b ? (
              <>
                <p>
                  Level {b.level} · {benefit(b.kind, b.level)}
                </p>
                <div className="inspect-actions">
                  <button onClick={() => startPlace(b.kind)}>
                    <Move />
                    Move
                  </button>
                  {b.level < 3 && (
                    <button
                      className="primary"
                      disabled={
                        buttonsDisabled ||
                        p.credits < upgradeCost(b.kind, b.level).credits ||
                        p.research < upgradeCost(b.kind, b.level).research
                      }
                      onClick={() => M(m.editSite(b.kind))}
                    >
                      Upgrade · {upgradeCost(b.kind, b.level).credits} cr /{" "}
                      {upgradeCost(b.kind, b.level).research} RP
                    </button>
                  )}
                </div>
                {b.level < 3 && (
                  <small>Next · {benefit(b.kind, b.level + 1)}</small>
                )}
              </>
            ) : (
              <p>
                {terrain(selected.x, selected.y) === "land"
                  ? "Choose Facilities to place a building."
                  : "Choose a clear plot for construction."}
              </p>
            )}
            {message && <p role="alert">{message}</p>}
          </section>
        )}
        <div className="site-dock">
          <button disabled={buttonsDisabled} onClick={() => showPanel("build")}>
            <Building2 />
            Facilities
          </button>
          <button
            className="primary"
            disabled={buttonsDisabled}
            onClick={() => showPanel("board")}
          >
            <ClipboardList />
            Contracts
          </button>
          <button disabled={buttonsDisabled} onClick={onFlight}>
            <Rocket />
            Flight deck
          </button>
        </div>
      </div>
      {m.notice && (
        <div className="site-toast" role="status">
          {m.notice}
          <button aria-label="Dismiss message" onClick={() => m.setNotice("")}>
            <X />
          </button>
        </div>
      )}
      {panel && (
        <Dialog
          title={
            panel === "board"
              ? "Contracts"
              : panel === "build"
                ? "Facilities"
                : "Replace current flight?"
          }
          close={() => P(null)}
        >
          {panel === "board" && (
            <>
              <div className="contract-list">
                {jobs.map((job) => {
                  const c = CONTRACTS[job],
                    q = quote(p, job),
                    reason = launchIssue(p, job);
                  return (
                    <article className="contract" key={job}>
                      <header>
                        <h3>{c.name}</h3>
                        <small>
                          {q.fee ? q.fee + " cr launch" : "Sponsored"}
                        </small>
                      </header>
                      <p>{c.goal}</p>
                      <div className="mission-row">
                        <span>
                          <Coins />
                          {q.credits} <FlaskConical />
                          {q.research}
                        </span>
                        <button
                          disabled={Boolean(reason)}
                          aria-label={"Accept " + c.name}
                          onClick={() => pick(job)}
                        >
                          Accept <ArrowRight />
                        </button>
                      </div>
                      {job === "polar" && (
                        <small>
                          Pioneer Survey · {launchMass(job).toFixed(1)} t /{" "}
                          {c.height} m
                        </small>
                      )}
                      {reason && <small>{reason}</small>}
                      {p.completed[job] > 0 && (
                        <small>Completed ×{p.completed[job]}</small>
                      )}
                    </article>
                  );
                })}
              </div>
              <button className="practice-btn" onClick={() => pick("practice")}>
                <Rocket />
                Free simulation
              </button>
            </>
          )}
          {panel === "build" && (
            <div className="facilities-list">
              {kinds.map((k) => {
                const built = p.buildings.find((b) => b.kind === k),
                  Icon = glyph[k];
                return (
                  <button
                    key={k}
                    aria-label={
                      built
                        ? "Inspect " + FACILITIES[k].name
                        : "Build " + FACILITIES[k].name
                    }
                    disabled={!built && p.credits < FACILITIES[k].cost}
                    onClick={() => {
                      if (!built) {
                        startPlace(k);
                        return;
                      }
                      S({ x: built.x, y: built.y });
                      G(null);
                      P(null);
                      H((v) => v + 1);
                    }}
                  >
                    <Icon />
                    <span>
                      <strong>{FACILITIES[k].name}</strong>
                      <small>{benefit(k, built?.level ?? 1)}</small>
                    </span>
                    <b>
                      {built ? "Lv " + built.level : FACILITIES[k].cost + " cr"}
                    </b>
                  </button>
                );
              })}
            </div>
          )}
          {panel === "replace" && (
            <>
              <p>
                Retire the current vehicle and prepare{" "}
                {pending === "practice"
                  ? "a free simulation"
                  : CONTRACTS[pending].name.toLowerCase()}
                . Unfinished contracts earn no reward.
              </p>
              <button
                className="primary"
                onClick={() => {
                  if (m.newSortie(pending)) P(null);
                }}
              >
                Prepare flight
              </button>
            </>
          )}
          {panel === "board" && (
            <small className="program-clock">
              Range time {Math.floor(p.elapsed / 3600)}h{" "}
              {Math.floor(p.elapsed / 60) % 60}m · Charged at ignition
            </small>
          )}
        </Dialog>
      )}
    </main>
  );
}
