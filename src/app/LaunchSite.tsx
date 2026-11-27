import { useState, useEffect } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  ClipboardList,
  Cloud,
  Coins,
  Database,
  Factory,
  Flame,
  FlaskConical,
  Hammer,
  Gem,
  Store,
  Landmark,
  Lock,
  Moon,
  Move,
  Radar,
  RefreshCw,
  Rocket,
  Sun,
  Users,
  Waves,
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
  MODIFIER_META,
  NOVA_BOOST_MINUTES,
  NOVA_EXCHANGE_UNITS,
  SIZE,
  activeUpgrades,
  canAffordUpgrade,
  clearingQuote,
  costShortfall,
  contractCooldownRemainingMs,
  contractVehicle,
  ensureCrew,
  ensureRotatingBoard,
  hasRotatingContracts,
  type Cost,
  canReclaimTile,
  countBuilt,
  extraBuildCost,
  facilityBenefit,
  formatDuration,
  getCollectorCaps,
  getCreditRatePerHour,
  getPropellantRatePerHour,
  getStorageCaps,
  level,
  maxBuilderSlots,
  maxBuildingCount,
  placement,
  quote,
  reclaimCost,
  rerollCostCredits,
  tileTerrain,
  upgradeStatDelta,
  type Job,
  type Kind,
  type Program,
  type RotatingContract,
} from "../program/program";
import type { PendingContract, useMission } from "./useMission";
import { MiloGuide } from "./MiloGuide";
import { Dialog } from "./Dialog";
import { CloudSyncPanel } from "./CloudSyncPanel";
import { SoundingReport } from "./SoundingReport";
import { CrewModal } from "./CrewModal";

const BUILD_GROUPS: { title: string; kinds: Kind[] }[] = [
  { title: "Resources & Storage", kinds: ["foundry", "refinery", "bank", "tanks"] },
  { title: "Command & Launch", kinds: ["command", "pad", "office"] },
  { title: "Engineering & Tech", kinds: ["vab", "tracking", "lab"] },
];

const glyph: Record<Kind, typeof Landmark> = {
  command: Landmark,
  pad: Rocket,
  foundry: Sun,
  refinery: Factory,
  tanks: Flame,
  bank: Coins,
  office: ClipboardList,
  vab: Hammer,
  tracking: Radar,
  lab: FlaskConical,
};

const researchFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function compactNum(n: number) {
  if (n >= 10000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return Math.floor(n).toLocaleString("en-US");
}

function facilitySummary(kind: Kind, level: number) {
  if (kind === "tracking") return ["Live orbital map", "Moon encounters", "Mars transfers", "Galaxy scanner"][level - 1];
  return facilityBenefit(kind, level).split(" · ")[0];
}

function price(cost: Cost) {
  return [
    cost.credits ? compactNum(cost.credits) + " C" : "",
    cost.propellant ? compactNum(cost.propellant) + " Prop" : "",
    cost.research ? compactNum(cost.research) + " RD" : "",
  ].filter(Boolean).join(" + ");
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
  onLunar,
}: {
  mission: ReturnType<typeof useMission>;
  onFlight: () => void;
  onWorkshop: (contract?: PendingContract) => void;
  onLunar: () => void;
}) {
  const p = m.mission.program,
    flight = m.mission.flight;
  const caps = getStorageCaps(p);
  const hopperCaps = getCollectorCaps(p);
  const creditRate = getCreditRatePerHour(p);
  const propRate = getPropellantRatePerHour(p);
  const propPct = Math.min(100, (100 * p.propellant) / caps.propellant);
  const credPct = Math.min(100, (100 * p.credits) / caps.credits);

  const [panel, P] = useState<
    "board" | "store" | "build" | "crew" | "replace" | "cloud" | "sounding-report" | null
  >(null);
  const [selected, S] = useState<Tile | null>(null);
  const [inspectLocked, setInspectLocked] = useState<Kind | null>(null);
  const [placing, G] = useState<Kind | null>(null);
  const [movingFrom, setMovingFrom] = useState<Tile | null>(null);
  const [pending, Q] = useState<Job | "practice">("practice");
  const [boardNotice, setBoardNotice] = useState("");
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
    selected && placing
      ? placement(p, placing, selected.x, selected.y, movingFrom)
      : "";

  const canExpandSelected =
    Boolean(selected) &&
    !placing &&
    !builtAtTile &&
    canReclaimTile(p, selected!.x, selected!.y);
  const buttonsDisabled = !m.loaded;
  const clearing = selected && !builtAtTile ? clearingQuote(p, selected.x, selected.y) : null;
  const buildCost = placing && !movingFrom && countBuilt(p, placing) > 0 ? extraBuildCost(placing) : null;
  const buildShortfall = buildCost ? costShortfall(p, buildCost) : "";
  const clearShortfall = clearing ? costShortfall(p, { ...clearing, credits: 0, research: 0 }) : "";
  const clearButton = selected && clearing && (
    <button className="primary grow" disabled={buttonsDisabled || Boolean(clearShortfall)}
      onClick={() => M(m.improveTerrain(selected.x, selected.y, "clear"))}>
      {clearing.action} · {clearing.propellant} Prop
    </button>
  );
  const expandPrice = reclaimCost(p);

  function cancel() {
    S(null);
    setInspectLocked(null);
    G(null);
    setMovingFrom(null);
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
        color: res.resource === "credits" ? "#ffd298" : "#4fd1a5",
        seq: (prev?.seq ?? 0) + 1,
      }));
      return true;
    }
    return false;
  }

  function chooseTile(t: Tile) {
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

  function startPlace(k: Kind, existingTile?: Tile) {
    if (existingTile) {
      S({ x: existingTile.x, y: existingTile.y });
      setMovingFrom({ x: existingTile.x, y: existingTile.y });
    } else {
      S(freeTile(p, k));
      setMovingFrom(null);
    }
    setInspectLocked(null);
    G(k);
    M("");
    P(null);
  }

  function pick(job: Job | "practice") {
    if (job !== "practice") {
      if (tutorial.contractsStep !== "done") {
        m.updateTutorial({ contractsStep: "done" });
      }
      P(null);
      onWorkshop({ kind: "fixed", job });
      return;
    }
    Q(job);
    if (flight.status !== "pad") {
      P("replace");
      return;
    }
    if (m.newSortie(job)) P(null);
  }

  function pickRotating(offer: RotatingContract) {
    P(null);
    onWorkshop({ kind: "rotating", offer });
  }

  function confirmPlacement() {
    if (!placing || !selected) return;
    const result = m.editSite(placing, selected, movingFrom);
    if (result) M(result);
    else {
      if (buildingLesson && placing === "foundry" && !movingFrom) S(null);
      G(null);
      setMovingFrom(null);
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

  function showPanel(v: "build" | "board" | "cloud" | "store" | "crew") {
    cancel();
    setBoardNotice("");
    if (v === "board" && hasRotatingContracts(p)) m.refreshRotatingBoard();
    P(v);
  }

  const tutorial = m.mission.tutorial;
  const touring = m.loaded && tutorial.status === "active";
  const needsFlight = touring && !p.milestones.firstSounding;
  const hasActiveFlight =
    flight.status === "flying" ||
    (flight.status === "pad" && p.sortie !== "practice");
  const resumeFlight = needsFlight && p.sortie === "sounding" &&
    (flight.status === "pad" || flight.status === "flying");
  const buildingLesson = touring && p.milestones.firstSounding;
  const hasTwoFoundries = countBuilt(p, "foundry") >= 2;
  const secondCost = extraBuildCost("foundry");
  const shortage = costShortfall(p, secondCost);
  const collectTip = tutorial.status === "complete" && tutorial.collectionTip &&
    p.collectors.credits >= 1 && p.credits < caps.credits;
  const skipTour = () => m.updateTutorial({ status: "off", collectionTip: false });
  const finishTour = () => m.updateTutorial({ status: "complete", collectionTip: true });

  const contractsTour = touring && tutorial.contractsStep !== "done";
  const contractsStepNum = typeof tutorial.contractsStep === "number" ? tutorial.contractsStep : 0;

  function siteGuide() {
    if (!m.loaded) return null;
    if (tutorial.status === "welcome")
      return <MiloGuide title="Milo Voss · Range crew" actions={<>
        <button className="primary" onClick={() => m.updateTutorial({ status: "active", contractsStep: 0, vabStep: 0, apPeSeen: false })}>Let’s fly</button>
        <button onClick={skipTour}>Skip tutorial</button>
      </>}>See that pad? I’ll walk you through contracts, building rockets in the VAB, and reading flight telemetry for your first launch.</MiloGuide>;
    if (needsFlight)
      return <MiloGuide dismiss={skipTour}>{resumeFlight
        ? "Your sounding rocket is ready on the flight deck. Tap Resume to launch."
        : "First stop: open Contracts. I’ll show you how missions, payouts, and free simulations work."}</MiloGuide>;
    if (buildingLesson && hasTwoFoundries)
      return <MiloGuide actions={<button className="primary" onClick={finishTour}>Got it</button>}>
        Two foundries on the range! Tap gold Credit badges and teal Propellant badges above collectors to bank resources. Upgrade Mission Control to unlock Tier 2 contracts, the VAB, Lab, and Rotating Contracts at Lv 3.
      </MiloGuide>;
    if (buildingLesson)
      return <MiloGuide actions={<button onClick={() => {
        if (placing === "foundry" && !movingFrom) cancel();
        finishTour();
      }}>Keep my resources</button>} dismiss={skipTour}>
        {shortage ? shortage + " You can save this build for later."
          : placing === "foundry" && !movingFrom
            ? "Pick an open plot or use the one marked on the map. Tap Confirm to build."
            : "Open Build and choose Solar Foundry. A second one earns credits faster."}
      </MiloGuide>;
    if (collectTip)
      return <MiloGuide dismissLabel="Dismiss collection tip" dismiss={() => m.updateTutorial({ collectionTip: false })}>
        Credits ready! Tap the gold badge over a Solar Foundry to move them into your bank.
      </MiloGuide>;
    if (selected || tutorial.status !== "off" || tutorial.hideInvite) return null;
    return (
      <div className="milo-invite">
        <button
          className="milo-invite-open"
          aria-label="Ask Milo for guidance"
          onClick={() => m.updateTutorial({ status: "active", hideInvite: false, contractsStep: 0, vabStep: 0, apPeSeen: false })}
        >
          <span className="milo-face" aria-hidden="true" />Ask Milo
        </button>
        <button
          className="milo-close milo-invite-close"
          aria-label="Remove Ask Milo button"
          onClick={() => m.updateTutorial({ status: "off", collectionTip: false, hideInvite: true })}
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  const nowMs = Date.now();
  const busyCrews = activeUpgrades(p, nowMs).length;
  const totalCrews = maxBuilderSlots(p);
  const activeLv = builtAtTile ? builtAtTile.level : 0;
  const activeUpgradeRemMs =
    builtAtTile?.upgradingUntilMs && builtAtTile.upgradingUntilMs > nowMs
      ? builtAtTile.upgradingUntilMs - nowMs
      : 0;
  const activeUpgradePct =
    activeUpgradeRemMs > 0
      ? Math.min(
          100,
          Math.max(
            3,
            Math.round(
              (1 -
                activeUpgradeRemMs /
                  Math.max(1000, (builtAtTile?.upgradingDurationSec ?? 60) * 1000)) *
                100,
            ),
          ),
        )
      : 0;
  const upgCheck = activeKind
    ? canAffordUpgrade(p, activeKind, activeLv, nowMs)
    : null;
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
        movingFrom={movingFrom}
        onTile={chooseTile}
        collectBurst={burst}
        guideFoundries={m.loaded && collectTip && !panel && !placing}
      />
      <div className="site-vignette" />
      <div className="site-hud">
        <header className="site-top">
          <div className="resource-bar" aria-label="Program resources">
            <div className="res-pill credits" title="Credits">
              <div className="res-row">
                <img width="16" height="16" alt="" src={import.meta.env.BASE_URL + "art/credits.png"} />
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
                <img width="16" height="16" alt="" src={import.meta.env.BASE_URL + "art/propellant.png"} />
                <strong>{compactNum(p.propellant)}</strong>
                <small>/{compactNum(caps.propellant)}</small>
                <em className="res-rate">+{propRate}/h</em>
              </div>
              <div className="res-track">
                <i style={{ width: propPct + "%" }} />
              </div>
            </div>
            <div className="res-pill nova" title="Nova Shards · Unlimited" aria-label="Nova Shards: unlimited">
              <div className="res-row"><Gem aria-hidden="true" /><strong>∞</strong><small>Shards</small></div>
            </div>
            <div className="res-pill research" title={`Research data: ${p.research.toLocaleString("en-US")}`}>
              <div className="res-row">
                <FlaskConical />
                <strong>{p.research < 10000 ? compactNum(p.research) : researchFormat.format(p.research)}</strong>
                <small>RD</small>
              </div>
            </div>
          </div>
        </header>

        <button
          className={"site-cloud-btn" + (m.cloudEmail ? " synced" : "")}
          aria-label="Cloud save"
          title={m.cloudEmail ? `Cloud synced (${m.cloudEmail})` : "Sign in for cloud save"}
          onClick={() => showPanel("cloud")}
        >
          <Cloud size={18} />
          <i />
        </button>

        {selected && (
          <section className="inspector" aria-label="Facility inspector">
            <header>
              <div className="inspect-title">
                <h2>
                  {placing
                    ? (movingFrom ? "Move " : "Build ") +
                      FACILITIES[placing].shortName
                    : activeKind
                      ? FACILITIES[activeKind].name
                      : canExpandSelected
                        ? "Coastal Ocean"
                        : tileTerrain(p, selected.x, selected.y) === "land"
                          ? "Open plot"
                          : clearing?.name ?? "Terrain"}
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

            {!panel && siteGuide()}
            {placing ? (
              <>
                <p>{clearing ? (clearShortfall || "Clear this tile to continue.") : issue || buildShortfall || "Tap an open plot to place."}</p>
                <div className="inspect-actions">
                  <button onClick={cancel}>Cancel</button>
                  {clearing ? clearButton : <button
                    className="primary"
                    disabled={Boolean(issue || buildShortfall) || buttonsDisabled}
                    data-milo-focus={buildingLesson && placing === "foundry" && !movingFrom && !issue && !buildShortfall}
                    onClick={confirmPlacement}
                  >
                    <Check />
                    Confirm{buildCost ? " · " + price(buildCost) : ""}
                  </button>}
                </div>
              </>
            ) : clearing ? (
              <>
                <p className="inspect-stat">{clearShortfall || "Clear this tile for construction."}</p>
                <div className="inspect-actions">{clearButton}</div>
              </>
            ) : canExpandSelected ? (
              <>
                <p className="inspect-stat">
                  Reclaim this coastal tile into buildable land.
                </p>
                <div className="upgrade-delta">
                  +1 Buildable Land Tile
                </div>
                <div className="inspect-actions">
                  <button
                    className="primary grow"
                    disabled={buttonsDisabled || p.credits < expandPrice}
                    onClick={() => {
                      const err = m.improveTerrain(selected.x, selected.y, "reclaim");
                      if (err) M(err);
                      else M("");
                    }}
                  >
                    <Waves size={16} />
                    Expand Land · {expandPrice.toLocaleString("en-US")} C
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
                  <div className="upgrade-delta" aria-label="Upgrade stat increase">
                    {activeLv === 0 ? "Unlocks: " : `Lv ${activeLv + 1} Gain: `}
                    <strong>{upgradeStatDelta(activeKind, activeLv)}</strong>
                  </div>
                )}
                {activeUpgradeRemMs > 0 ? (
                  <div className="upgrade-progress" role="status">
                    <div className="upgrade-progress-head">
                      <span>Upgrading to Lv {activeLv + 1}</span>
                      <strong>{formatDuration(activeUpgradeRemMs / 1000)}</strong>
                    </div>
                    <div className="upgrade-progress-track">
                      <i style={{ width: activeUpgradePct + "%" }} />
                    </div>
                  </div>
                ) : (
                  <>
                    {upgCheck && !upgCheck.ok && (
                      <div className="prereq-tag">
                        <Lock size={13} />
                        {upgCheck.reason}
                      </div>
                    )}
                    {activeLv < MAX_LEVEL && upgCheck && (
                      <div className="inspect-price">
                        <span>
                          {activeLv === 0 ? "Build cost" : "Upgrade cost"} ·{" "}
                          {formatDuration(upgCheck.durationSec)}
                        </span>
                        <b>{price(upgCheck.cost)}</b>
                      </div>
                    )}
                  </>
                )}
                <div className="inspect-actions">
                  {activeUpgradeRemMs > 0 && selected && (
                    <button className="nova-boost" disabled={buttonsDisabled}
                      title={`Spend 1 Nova Shard to speed up by ${NOVA_BOOST_MINUTES} minutes`}
                      onClick={() => M(m.useShard(selected))}>
                      <Gem size={15} />1 · Speed up {NOVA_BOOST_MINUTES}m
                    </button>
                  )}
                  {builtAtTile && (
                    <button
                      aria-label="Move"
                      title="Move facility"
                      onClick={() => startPlace(activeKind, selected)}
                    >
                      <Move />
                    </button>
                  )}
                  {isCollector && activeLv > 0 && collectorStored >= 1 && (
                    <button
                      aria-label="Collect resources"
                      onClick={() => triggerCollect(activeKind, selected)}
                    >
                      Collect
                    </button>
                  )}
                  {activeLv < MAX_LEVEL && upgCheck && activeUpgradeRemMs === 0 && (
                    <button
                      className="primary grow"
                      aria-label={`${activeLv === 0 ? "Build" : "Upgrade"} · ${price(upgCheck.cost)}`}
                      disabled={buttonsDisabled || !upgCheck.ok}
                      onClick={() => {
                        if (activeLv === 0 && !builtAtTile) {
                          const err = m.editSite(activeKind);
                          if (err) M(err);
                          else setInspectLocked(null);
                        } else {
                          M(m.editSite(activeKind, undefined, undefined, selected));
                        }
                      }}
                    >
                      {activeLv === 0 ? "Build" : "Upgrade"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p>
                Tap a building to inspect, tap coastal water to expand land, or
                open Build.
              </p>
            )}
            {message && <p role="alert">{message}</p>}
          </section>
        )}

        <div className="site-dock">
          {p.lunar.unlocked && (
            <button aria-label="Lunar Outpost" onClick={onLunar}>
              <Moon />
              Moon
            </button>
          )}
          <button className="secondary" data-milo-focus={!panel && buildingLesson && !hasTwoFoundries && !placing && !shortage} disabled={buttonsDisabled} onClick={() => showPanel("build")}>
            <Building2 />
            Build
          </button>
          <button
            className="secondary"
            aria-label="Rocket Workshop"
            disabled={buttonsDisabled}
            onClick={() => onWorkshop()}
          >
            <Wrench />
            VAB
          </button>
          <button
            className="primary"
            disabled={buttonsDisabled}
            data-milo-focus={!panel && needsFlight && !resumeFlight}
            onClick={() => showPanel("board")}
          >
            <ClipboardList />
            Contracts
          </button>
          {hasActiveFlight && (
            <button
              data-milo-focus={!panel && resumeFlight}
              aria-label="Resume flight"
              disabled={buttonsDisabled}
              onClick={onFlight}
            >
              <Rocket />
              Resume
            </button>
          )}
          <button disabled={buttonsDisabled} onClick={() => showPanel("crew")}>
            <Users />
            Crew
            {ensureCrew(p).pilots.some((x) => x.status === "stranded") && (
              <span className="crew-alert-dot" aria-label="Stranded pilot" />
            )}
          </button>
          <button disabled={buttonsDisabled} onClick={() => showPanel("store")}><Store />Store</button>
        </div>
      </div>

      {!panel && !selected && <div className="site-milo">{siteGuide()}</div>}

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
          tone={panel === "replace" ? "warning" : undefined}
          title={
            panel === "store"
              ? "Store"
              : panel === "crew"
                ? "Crew Quarters"
                : panel === "board"
                  ? "Contracts"
                  : panel === "build"
                    ? "Facilities"
                    : panel === "cloud"
                      ? "Cloud Save"
                      : panel === "sounding-report"
                        ? "Sounding report"
                        : "Replace flight?"
          }
          close={() => P(null)}
        >
          {panel === "store" && (
            <div className="nova-store">
              <div className="nova-wallet"><Gem /><strong>Nova Shards</strong><b>∞</b></div>
              <p>Unlimited shards for testing. Each shard buys {NOVA_EXCHANGE_UNITS.toLocaleString("en-US")} units, even above storage capacity.</p>
              {(["credits", "propellant"] as const).map(resource => (
                <div className="nova-offer" key={resource}>
                  <img src={import.meta.env.BASE_URL + "art/" + resource + ".png"} alt="" />
                  <div><strong>{NOVA_EXCHANGE_UNITS.toLocaleString("en-US")} {resource}</strong>
                    <small>Balance {p[resource].toLocaleString("en-US", { maximumFractionDigits: 0 })}</small></div>
                  <button aria-label={`Exchange 1 Nova Shard for ${NOVA_EXCHANGE_UNITS} ${resource}`}
                    onClick={() => M(m.useShard(resource))}><Gem size={15} />1 shard</button>
                </div>
              ))}
              {message && <p role="status">{message}</p>}
            </div>
          )}
          {panel === "board" && (
            <>
              {contractsTour ? (
                <MiloGuide
                  title={`Milo Voss · Contracts (${contractsStepNum + 1}/3)`}
                  dismiss={skipTour}
                  actions={
                    <>
                      {contractsStepNum > 0 && (
                        <button
                          type="button"
                          onClick={() => m.updateTutorial({ contractsStep: contractsStepNum - 1 })}
                        >
                          Back
                        </button>
                      )}
                      {contractsStepNum < 2 ? (
                        <button
                          type="button"
                          className="primary"
                          onClick={() => m.updateTutorial({ contractsStep: contractsStepNum + 1 })}
                        >
                          Next
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="primary"
                          onClick={() => m.updateTutorial({ contractsStep: "done" })}
                        >
                          Got it
                        </button>
                      )}
                    </>
                  }
                >
                  {contractsStepNum === 0
                    ? "Contracts fund your space program with Credits (C) and Research Data (RD). Use Free simulation at the top anytime to test a rocket at zero credit or fuel cost."
                    : contractsStepNum === 1
                      ? "Each Program Milestone shows its goal, estimated hardware & propellant cost, mass, and payout. Upgrading Mission Control unlocks Tier 2 contracts at Lv 2 and Rotating Contracts at Lv 3."
                      : "Let’s start with Atmospheric Sounding (reach 15 km). The sponsor covers hardware (0 C) if you use their rocket, or you can fly your own VAB blueprint. Tap VAB on Atmospheric Sounding to continue!"}
                </MiloGuide>
              ) : (
                needsFlight && (
                  <MiloGuide dismiss={skipTour}>
                    The sponsor supplies the rocket (0 C) or you can fly your own VAB design. Pick Atmospheric Sounding to enter the VAB.
                  </MiloGuide>
                )
              )}
              <button
                className="practice-btn"
                data-milo-focus={contractsTour && contractsStepNum === 0}
                onClick={() => pick("practice")}
              >
                <Rocket />
                Free simulation · No cost or payout
              </button>
              {hasRotatingContracts(p) && (() => {
                const board = ensureRotatingBoard(p, nowMs);
                const rerollPrice = rerollCostCredits(board);
                const refreshLeftSec = Math.max(0, Math.ceil((board.nextRefreshAtMs - nowMs) / 1000));
                const labLv = level(p, "lab");
                return (
                  <section className="rotating-section" aria-label="Rotating contracts">
                    <div className="rotating-head">
                      <div>
                        <h3 className="contract-section-title">Rotating Contracts</h3>
                        <small>Refreshes in {formatDuration(refreshLeftSec)}</small>
                      </div>
                      <button
                        type="button"
                        className="reroll-btn"
                        disabled={rerollPrice > 0 && p.credits < rerollPrice}
                        onClick={() => setBoardNotice(m.rerollContracts())}
                      >
                        <RefreshCw size={13} />
                        {rerollPrice === 0 ? "Reroll · Free" : `Reroll · ${rerollPrice} C`}
                      </button>
                    </div>
                    {boardNotice && <p className="lock-note" role="alert">{boardNotice}</p>}
                    <div className="contract-list">
                      {board.offers.map((offer) => {
                        const rdTotal = Math.round(offer.research * (1 + 0.1 * labLv));
                        const expSec = Math.max(0, Math.ceil((offer.expiresAtMs - nowMs) / 1000));
                        return (
                          <article className="contract contract-rotating" key={offer.id}>
                            <header>
                              <h3>{offer.name}</h3>
                              <span className={"tier-chip tier-" + offer.tier}>
                                Tier {offer.tier} · {formatDuration(expSec)}
                              </span>
                            </header>
                            <p>{offer.goal}</p>
                            {offer.modifiers.length > 0 && (
                              <div className="mod-strip">
                                {offer.modifiers.map((mod) => (
                                  <span
                                    key={mod}
                                    className={"mod-chip mod-" + MODIFIER_META[mod].type}
                                    title={MODIFIER_META[mod].summary}
                                  >
                                    {MODIFIER_META[mod].label}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="cost-strip">
                              {offer.cargoKg > 0 && (
                                <span>
                                  <Database size={13} />
                                  +{(offer.cargoKg / 1000).toFixed(1)} t cargo
                                </span>
                              )}
                              {offer.maxWetTonnes !== undefined && (
                                <span>≤ {offer.maxWetTonnes} t wet</span>
                              )}
                              {offer.maxStages !== undefined && (
                                <span>1 stage max</span>
                              )}
                              {offer.maxParts !== undefined && (
                                <span>≤ {offer.maxParts} parts</span>
                              )}
                              {offer.hardwareDiscount !== undefined && (
                                <span>−{Math.round(offer.hardwareDiscount * 100)}% hardware</span>
                              )}
                            </div>
                            <div className="mission-row">
                              <span className="payout-chip">
                                +{offer.credits.toLocaleString("en-US")} C · +{rdTotal} RD
                              </span>
                              <button
                                className="primary"
                                aria-label={"Accept " + offer.name}
                                onClick={() => pickRotating(offer)}
                              >
                                VAB <ArrowRight />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })()}
              <h3 className="contract-section-title">Program Milestones</h3>
              <div className="contract-list">
                {CONTRACT_JOBS.map((job) => {
                  const c = CONTRACTS[job];
                  const vehicle = contractVehicle(p, job);
                  const q = quote(p, job, vehicle);
                  const mcLv = level(p, "command");
                  const remMs = contractCooldownRemainingMs(p, job, nowMs);
                  const reason =
                    c.tier > mcLv
                      ? `Requires Mission Control Lv ${c.tier}.`
                      : remMs > 0
                        ? `Contract refreshing · ${formatDuration(remMs / 1000)} remaining.`
                        : "";
                  return (
                    <article
                      className={
                        "contract" + (reason ? " contract-locked" : "")
                      }
                      data-milo-focus={contractsTour && contractsStepNum === 1 && job === "sounding"}
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
                          {vehicle.sponsored
                            ? "0 C (Sponsored)"
                            : `~${q.hardwareCost.toLocaleString("en-US")} C`}
                        </span>
                        <span>
                          <Flame size={13} />
                          {vehicle.sponsored
                            ? `${q.propellantCost.toLocaleString("en-US")} Prop`
                            : `~${q.propellantCost.toLocaleString("en-US")} Prop`}
                        </span>
                        <span>
                          <Database size={13} />
                          {Number(vehicle.wetMassTonnes.toFixed(1))} t
                        </span>
                      </div>
                      <div className="mission-row">
                        <span className="payout-chip">
                          +{q.credits.toLocaleString("en-US")} C
                          {q.firstTimeBonus > 0
                            ? ` (+${q.firstTimeBonus.toLocaleString("en-US")} 1st)`
                            : ""}{" "}
                          · +{q.research} RD
                          {q.isRepeat ? " (Repeat)" : ""}
                        </span>
                        <button
                          className={!reason ? "primary" : ""}
                          disabled={Boolean(reason)}
                          data-milo-focus={needsFlight && job === "sounding" && !reason && (!contractsTour || contractsStepNum === 2)}
                          aria-label={"Accept " + c.name}
                          onClick={() => pick(job)}
                        >
                          VAB <ArrowRight />
                        </button>
                      </div>
                      {reason && <small className="lock-note">{reason}</small>}
                      {job === "sounding" && p.soundingReport && (
                        <button className="sounding-report-btn" onClick={() => P("sounding-report")}>
                          Sounding report
                        </button>
                      )}
                      {p.completed[job] > 0 && (
                        <small>Completed ×{p.completed[job]}</small>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {panel === "build" && (
            <div className="facilities-groups">
              {buildingLesson && !hasTwoFoundries && <MiloGuide dismiss={skipTour}>
                Choose Solar Foundry under Resources &amp; Storage. The second one costs {price(secondCost)}.
              </MiloGuide>}
              <div className="crew-banner">
                <span>Engineering Crews</span>
                <strong>
                  {totalCrews - busyCrews}/{totalCrews} available
                </strong>
              </div>
              {BUILD_GROUPS.map((group) => (
                <section className="build-group" key={group.title}>
                  <h3 className="build-group-title">{group.title}</h3>
                  <div className="facilities-list">
                    {group.kinds.map((k) => {
                      const builtList = p.buildings.filter((b) => b.kind === k),
                        built = builtList[0],
                        builtNum = countBuilt(p, k),
                        maxNum = maxBuildingCount(p, k),
                        canBuildExtra = builtNum > 0 && builtNum < maxNum,
                        Icon = glyph[k],
                        check = canAffordUpgrade(p, k, 0),
                        locked =
                          !built &&
                          !check.ok &&
                          check.reason.includes("Mission Control");
                      return (
                        <button
                          key={k}
                          data-milo-focus={buildingLesson && k === "foundry" && canBuildExtra}
                          aria-label={
                            canBuildExtra
                              ? `Build 2nd ${FACILITIES[k].name}`
                              : built
                                ? "Inspect " + FACILITIES[k].name
                                : "Build " + FACILITIES[k].name
                          }
                          onClick={() => {
                            if (canBuildExtra) {
                              startPlace(k);
                              return;
                            }
                            const pos = built
                              ? { x: built.x, y: built.y }
                              : FACILITIES[k].defaultPos;
                            S(pos);
                            setInspectLocked(built ? null : k);
                            G(null);
                            setMovingFrom(null);
                            P(null);
                          }}
                        >
                          <Icon />
                          <strong>{FACILITIES[k].name}</strong>
                          <b className={locked ? "locked-badge" : ""}>
                            {maxNum > 1 ? `${builtNum}/${maxNum}` : built ? `Lv ${built.level}` : locked ? "Locked" : "Build"}
                          </b>
                          <small>{canBuildExtra
                            ? `Build second · ${price(extraBuildCost(k))}`
                            : locked ? "Requires Mission Control Lv 2"
                            : built ? facilitySummary(k, built.level)
                            : price(FACILITIES[k].costs[0])}</small>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {panel === "crew" && <CrewModal mission={m} />}
          {panel === "cloud" && <CloudSyncPanel mission={m} />}
          {panel === "sounding-report" && p.soundingReport && (
            <>
              <SoundingReport report={p.soundingReport} />
              <button onClick={() => P("board")}>Back to contracts</button>
            </>
          )}

          {panel === "replace" && (
            <>
              {needsFlight && pending === "sounding" && <MiloGuide dismiss={skipTour}>
                Prepare flight retires the previous vehicle and rolls your sounding rocket onto the pad.
              </MiloGuide>}
              <p>
                Retire the active vehicle and stage{" "}
                {pending === "practice"
                  ? "a free simulation"
                  : CONTRACTS[pending].name}?
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
