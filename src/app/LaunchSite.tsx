import { useState, useEffect } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  ClipboardList,
  Coins,
  Database,
  Factory,
  Flame,
  FlaskConical,
  Hammer,
  Landmark,
  Lock,
  Move,
  Radar,
  Rocket,
  Sun,
  Wrench,
  X,
} from "lucide-react";
import {
  EarthScene,
  type CollectBurst,
  type Tile,
} from "../game/scenes/EarthScene";
import {
  CONTRACTS,
  CONTRACT_JOBS,
  FACILITIES,
  FACILITY_KINDS,
  MAX_LEVEL,
  SIZE,
  canAffordUpgrade,
  facilityBenefit,
  getCollectorCaps,
  getCreditRatePerHour,
  getPropellantRatePerHour,
  getStorageCaps,
  launchIssue,
  level,
  placement,
  quote,
  terrain,
  type Kind,
  type Sortie,
  type Program,
} from "../program/program";
import type { useMission } from "./useMission";
import { Dialog } from "./Dialog";
import "./site.css";

const glyph: Record<Kind, typeof Landmark> = {
  command: Landmark,
  pad: Rocket,
  foundry: Sun,
  refinery: Factory,
  tanks: Flame,
  office: ClipboardList,
  vab: Hammer,
  tracking: Radar,
  lab: FlaskConical,
};

function compactNum(n: number) {
  if (n >= 10000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return Math.floor(n).toLocaleString("en-US");
}

function freeTile(p: Program, k: Kind): Tile {
  const def = FACILITIES[k].defaultPos;
  if (!placement(p, k, def.x, def.y)) return { x: def.x, y: def.y };
  for (let y = 1; y < SIZE; y++)
    for (let x = 1; x < SIZE; x++) if (!placement(p, k, x, y)) return { x, y };
  return { x: def.x, y: def.y };
}

export function LaunchSite({
  mission: m,
  onFlight,
  onWorkshop,
}: {
  mission: ReturnType<typeof useMission>;
  onFlight: () => void;
  onWorkshop: () => void;
}) {
  const p = m.mission.program,
    flight = m.mission.flight;
  const caps = getStorageCaps(p);
  const hopperCaps = getCollectorCaps(p);
  const creditRate = getCreditRatePerHour(p);
  const propRate = getPropellantRatePerHour(p);
  const propPct = Math.min(100, (100 * p.propellant) / caps.propellant);
  const credPct = Math.min(100, (100 * p.credits) / caps.credits);

  const [panel, P] = useState<"board" | "build" | "replace" | null>(null);
  const [selected, S] = useState<Tile | null>(null);
  const [inspectLocked, setInspectLocked] = useState<Kind | null>(null);
  const [placing, G] = useState<Kind | null>(null);
  const [pending, Q] = useState<Sortie>("practice");
  const [message, M] = useState("");
  const [burst, setBurst] = useState<CollectBurst | null>(null);

  const builtAtTile = selected
    ? p.buildings.find((b) => b.x === selected.x && b.y === selected.y)
    : undefined;
  const slotKindAtTile =
    selected && !builtAtTile
      ? FACILITY_KINDS.find(
          (k) =>
            level(p, k) === 0 &&
            FACILITIES[k].defaultPos.x === selected.x &&
            FACILITIES[k].defaultPos.y === selected.y,
        ) ?? null
      : null;

  const activeKind: Kind | null = placing
    ? placing
    : builtAtTile
      ? builtAtTile.kind
      : inspectLocked ?? slotKindAtTile;

  const issue =
    selected && placing ? placement(p, placing, selected.x, selected.y) : "";

  function cancel() {
    S(null);
    setInspectLocked(null);
    G(null);
    M("");
  }

  function triggerCollect(kind: Kind, pos: Tile) {
    const res = m.collectFacility(kind);
    if (res.collected > 0 && res.resource) {
      setBurst((prev) => ({
        x: pos.x,
        y: pos.y,
        text:
          res.resource === "credits"
            ? `+${res.collected.toLocaleString("en-US")} C`
            : `+${res.collected.toLocaleString("en-US")} Prop`,
        color: res.resource === "credits" ? "#ffd298" : "#72d6c6",
        seq: (prev?.seq ?? 0) + 1,
      }));
      return true;
    }
    return false;
  }

  function chooseTile(t: Tile) {
    // 1-tap Clash-of-Clans collect when tapping Solar Foundry or Refinery with resources ready
    if (!placing) {
      const hit = p.buildings.find((b) => b.x === t.x && b.y === t.y);
      if (hit && (hit.kind === "foundry" || hit.kind === "refinery")) {
        const avail =
          hit.kind === "foundry"
            ? Math.floor(p.collectors.credits)
            : Math.floor(p.collectors.propellant);
        const alreadySelected = selected?.x === t.x && selected?.y === t.y;
        if (avail >= 1 && !alreadySelected) {
          if (triggerCollect(hit.kind, t)) {
            M("");
            return;
          }
        }
      }
    }
    S(t);
    setInspectLocked(null);
    M("");
  }

  function startPlace(k: Kind) {
    const built = p.buildings.find((b) => b.kind === k);
    S(built ? { x: built.x, y: built.y } : freeTile(p, k));
    setInspectLocked(null);
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

  function confirmPlacement() {
    if (!placing || !selected) return;
    const result = m.editSite(placing, selected);
    if (result) M(result);
    else {
      G(null);
      M("");
    }
  }

  function moveCursor(dx: number, dy: number) {
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
        moveCursor(...dirs[e.key]);
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
  const activeLv = activeKind ? level(p, activeKind) : 0;
  const upgCheck = activeKind ? canAffordUpgrade(p, activeKind) : null;
  const isCollector = activeKind === "foundry" || activeKind === "refinery";
  const collectorStored =
    activeKind === "foundry"
      ? Math.floor(p.collectors.credits)
      : activeKind === "refinery"
        ? Math.floor(p.collectors.propellant)
        : 0;
  const collectorCap =
    activeKind === "foundry"
      ? hopperCaps.credits
      : activeKind === "refinery"
        ? hopperCaps.propellant
        : 0;

  return (
    <main className="game site-game" aria-label="Earth launch site">
      <EarthScene
        program={p}
        selected={selected}
        placing={placing}
        onTile={chooseTile}
        collectBurst={burst}
      />
      <div className="site-vignette" />
      <div className="site-hud">
        <header className="site-top">
          <div className="resource-bar" aria-label="Program resources">
            <div className="res-pill credits" title="Credits">
              <div className="res-row">
                <Coins />
                <strong>{compactNum(p.credits)}</strong>
                <small>/{compactNum(caps.credits)}</small>
                <em className="res-rate">+{creditRate}/h</em>
              </div>
              <div className="res-track">
                <i style={{ width: credPct + "%" }} />
              </div>
            </div>
            <div className="res-pill propellant" title="Propellant">
              <div className="res-row">
                <Flame />
                <strong>{compactNum(p.propellant)}</strong>
                <small>/{compactNum(caps.propellant)}</small>
                <em className="res-rate">+{propRate}/h</em>
              </div>
              <div className="res-track">
                <i style={{ width: propPct + "%" }} />
              </div>
            </div>
            <div className="res-pill research" title="Research Data">
              <div className="res-row">
                <FlaskConical />
                <strong>{p.research.toLocaleString("en-US")}</strong>
                <small>RD</small>
              </div>
            </div>
          </div>
        </header>

        {selected && (
          <section className="inspector" aria-label="Facility inspector">
            <header>
              <div className="inspect-title">
                <h2>
                  {placing
                    ? (level(p, placing) ? "Move " : "Build ") +
                      FACILITIES[placing].shortName
                    : activeKind
                      ? FACILITIES[activeKind].name
                      : terrain(selected.x, selected.y) === "land"
                        ? "Open plot"
                        : "Terrain"}
                </h2>
                {activeKind && !placing && (
                  <span className="lv-badge">
                    {activeLv > 0 ? `Lv ${activeLv}/${MAX_LEVEL}` : "Unbuilt"}
                  </span>
                )}
              </div>
              <button aria-label="Close inspector" onClick={cancel}>
                <X />
              </button>
            </header>

            {placing ? (
              <>
                <p>{issue || "Tap an open plot to place."}</p>
                <div className="inspect-actions">
                  <button onClick={cancel}>Cancel</button>
                  <button
                    className="primary"
                    disabled={Boolean(issue) || buttonsDisabled}
                    onClick={confirmPlacement}
                  >
                    <Check />
                    Confirm
                  </button>
                </div>
              </>
            ) : activeKind ? (
              <>
                <p className="inspect-stat">
                  {activeLv > 0
                    ? facilityBenefit(activeKind, activeLv)
                    : FACILITIES[activeKind].role}
                </p>
                {isCollector && activeLv > 0 && (
                  <p className="inspect-next">
                    Hopper · {collectorStored.toLocaleString("en-US")} /{" "}
                    {collectorCap.toLocaleString("en-US")}{" "}
                    {activeKind === "foundry" ? "C" : "Prop"}
                  </p>
                )}
                {activeLv < MAX_LEVEL && upgCheck && (
                  <p className="inspect-next">
                    {activeLv === 0 ? "Unlocks · " : `Lv ${activeLv + 1} · `}
                    {facilityBenefit(activeKind, Math.max(1, activeLv + 1))}
                  </p>
                )}
                {upgCheck &&
                  !upgCheck.ok &&
                  upgCheck.reason.includes("Mission Control") && (
                    <div className="prereq-tag">
                      <Lock size={13} />
                      {upgCheck.reason}
                    </div>
                  )}
                <div className="inspect-actions">
                  {activeLv > 0 && (
                    <button
                      aria-label="Move"
                      title="Move facility"
                      onClick={() => startPlace(activeKind)}
                    >
                      <Move />
                    </button>
                  )}
                  {isCollector && activeLv > 0 && collectorStored >= 1 && (
                    <button
                      aria-label="Collect resources"
                      onClick={() => triggerCollect(activeKind, selected)}
                    >
                      Collect {collectorStored}
                    </button>
                  )}
                  {activeLv < MAX_LEVEL && upgCheck && (
                    <button
                      className="primary grow"
                      disabled={buttonsDisabled || !upgCheck.ok}
                      onClick={() => {
                        if (activeLv === 0 && !builtAtTile) {
                          const err = m.editSite(activeKind);
                          if (err) M(err);
                          else setInspectLocked(null);
                        } else {
                          M(m.editSite(activeKind));
                        }
                      }}
                    >
                      {activeLv === 0 ? "Build" : "Upgrade"} ·{" "}
                      {upgCheck.cost.credits.toLocaleString("en-US")} C
                      {upgCheck.cost.research > 0
                        ? ` + ${upgCheck.cost.research} RD`
                        : ""}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p>Tap a building to inspect or open Build.</p>
            )}
            {message && <p role="alert">{message}</p>}
          </section>
        )}

        <div className="site-dock">
          <button disabled={buttonsDisabled} onClick={() => showPanel("build")}>
            <Building2 />
            Build
          </button>
          <button
            aria-label="Rocket Workshop"
            disabled={buttonsDisabled}
            onClick={onWorkshop}
          >
            <Wrench />
            VAB
          </button>
          <button
            className="primary"
            disabled={buttonsDisabled}
            onClick={() => showPanel("board")}
          >
            <ClipboardList />
            Contracts
          </button>
          <button
            aria-label="Flight deck"
            disabled={buttonsDisabled}
            onClick={onFlight}
          >
            <Rocket />
            Pad
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
                : "Replace flight?"
          }
          close={() => P(null)}
        >
          {panel === "board" && (
            <>
              <div className="contract-list">
                {CONTRACT_JOBS.map((job) => {
                  const c = CONTRACTS[job],
                    q = quote(p, job),
                    reason = launchIssue(p, job);
                  return (
                    <article
                      className={
                        "contract" + (reason ? " contract-locked" : "")
                      }
                      key={job}
                    >
                      <header>
                        <h3>{c.name}</h3>
                        <span className={"tier-chip tier-" + c.tier}>
                          {c.tierLabel}
                        </span>
                      </header>
                      <p>{c.goal}</p>
                      <div className="cost-strip">
                        <span>
                          <Coins size={13} />
                          {q.hardwareCost === 0
                            ? "0 C (Sponsored)"
                            : `${q.hardwareCost.toLocaleString("en-US")} C`}
                        </span>
                        <span>
                          <Flame size={13} />
                          {q.propellantCost.toLocaleString("en-US")} Prop
                        </span>
                        <span>
                          <Database size={13} />
                          {c.wetMassTonnes} t
                        </span>
                      </div>
                      <div className="mission-row">
                        <span className="payout-chip">
                          +{q.credits.toLocaleString("en-US")} C
                          {q.firstTimeBonus > 0
                            ? ` (+${q.firstTimeBonus.toLocaleString("en-US")} 1st)`
                            : ""}{" "}
                          · +{q.research} RD
                        </span>
                        <button
                          className={!reason ? "primary" : ""}
                          disabled={Boolean(reason)}
                          aria-label={"Accept " + c.name}
                          onClick={() => pick(job)}
                        >
                          Fly <ArrowRight />
                        </button>
                      </div>
                      {reason && <small className="lock-note">{reason}</small>}
                      {p.completed[job] > 0 && (
                        <small>Completed ×{p.completed[job]}</small>
                      )}
                    </article>
                  );
                })}
              </div>
              <button
                className="practice-btn"
                onClick={() => pick("practice")}
              >
                <Rocket />
                Simulate Free (0 C · 0 Prop · 0 Payout)
              </button>
            </>
          )}

          {panel === "build" && (
            <div className="facilities-list">
              {FACILITY_KINDS.map((k) => {
                const built = p.buildings.find((b) => b.kind === k),
                  Icon = glyph[k],
                  check = canAffordUpgrade(p, k),
                  locked =
                    !built &&
                    !check.ok &&
                    check.reason.includes("Mission Control");
                return (
                  <button
                    key={k}
                    aria-label={
                      built
                        ? "Inspect " + FACILITIES[k].name
                        : "Build " + FACILITIES[k].name
                    }
                    onClick={() => {
                      const pos = built
                        ? { x: built.x, y: built.y }
                        : FACILITIES[k].defaultPos;
                      S(pos);
                      setInspectLocked(built ? null : k);
                      G(null);
                      P(null);
                    }}
                  >
                    <Icon />
                    <span>
                      <strong>{FACILITIES[k].name}</strong>
                      <small>{facilityBenefit(k, built?.level ?? 1)}</small>
                    </span>
                    <b className={locked ? "locked-badge" : ""}>
                      {built
                        ? `Lv ${built.level}`
                        : locked
                          ? "MC Lv 2"
                          : `${FACILITIES[k].costs[0].credits.toLocaleString("en-US")} C`}
                    </b>
                  </button>
                );
              })}
            </div>
          )}

          {panel === "replace" && (
            <>
              <p>
                Retire the active vehicle and stage{" "}
                {pending === "practice"
                  ? "a free simulation"
                  : CONTRACTS[pending].name}
                ?
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
        </Dialog>
      )}
    </main>
  );
}
