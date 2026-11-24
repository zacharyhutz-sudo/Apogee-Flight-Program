import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ClipboardList,
  Coins,
  Copy,
  Flame,
  Landmark,
  Layers2,
  Lock,
  Plus,
  Rocket,
  Save,
  Split,
  Trash2,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import {
  PARTS,
  PART_IDS,
  analyzeBlueprint,
  type PartCategory,
  type PartId,
  type PlacedPart,
  type RocketBlueprint,
} from "../program/workshop";
import {
  CONTRACTS,
  contractVehicle,
  getFacilityLimits,
  inspectContractBlueprint,
  quote,
} from "../program/program";
import { MiloGuide } from "./MiloGuide";
import { Dialog } from "./Dialog";
import {
  PartPixelThumb,
  PixelRocketPart,
  VAB_PX,
  getPartPixelSize,
  getRadialPixelSize,
} from "./PixelRocketPart";
import type { useMission } from "./useMission";

const MAX_BLUEPRINTS = 16;

const CATEGORIES: Array<{ id: PartCategory; label: string }> = [
  { id: "pod", label: "Pods" },
  { id: "tank", label: "Tanks" },
  { id: "engine", label: "Engines" },
  { id: "stage", label: "Stages" },
  { id: "utility", label: "Payload" },
];

export function Workshop({
  mission: m,
  onSite,
}: {
  mission: ReturnType<typeof useMission>;
  onSite: () => void;
}) {
  const p = m.mission.program;
  const tutorial = m.mission.tutorial;
  const lesson = m.loaded && (tutorial.status === "active" || tutorial.status === "complete") &&
    tutorial.workshop !== "done";
  const dismissLesson = () => m.updateTutorial({ workshop: "done" });
  const limits = getFacilityLimits(p);
  const activeBp =
    p.blueprints.find((b) => b.id === p.activeBlueprintId) ?? p.blueprints[0];

  const [category, setCategory] = useState<PartCategory>("tank");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [replaceTarget, setReplaceTarget] = useState<{ useBlueprint: boolean } | null>(null);

  const contractJob = m.pendingContract;
  const contractDef = contractJob ? CONTRACTS[contractJob] : null;
  const contractQuote = contractJob
    ? quote(p, contractJob, contractVehicle(p, contractJob))
    : null;
  const contractCheck = useMemo(
    () => (contractJob ? inspectContractBlueprint(p, contractJob, activeBp.id) : null),
    [contractJob, p, activeBp, p.credits, p.propellant],
  );
  const soundingGuide =
    m.loaded &&
    tutorial.status === "active" &&
    !p.milestones.firstSounding &&
    contractJob === "sounding";

  const analysis = useMemo(
    () => analyzeBlueprint(activeBp, limits),
    [activeBp, limits],
  );

  const selectedPart =
    activeBp.parts.find((pt) => pt.uid === selectedUid) ?? null;

  function mutateBlueprint(fn: (bp: RocketBlueprint) => RocketBlueprint) {
    m.saveBlueprint(fn(structuredClone(activeBp)));
    setNotice("");
    setSavedMsg("");
  }

  function addPart(partId: PartId) {
    const def = PARTS[partId];
    if (def.requiredLabLevel > limits.labLevel) {
      setNotice(`Requires Research Lab Lv ${def.requiredLabLevel}.`);
      return;
    }
    const uid = "pt_" + Math.random().toString(36).slice(2, 8);
    const defaultStage =
      def.category === "pod" || partId === "eng_dart" || partId === "tank_s"
        ? Math.min(1, limits.maxStages - 1)
        : 0;
    const item: PlacedPart = {
      uid,
      partId,
      stage: defaultStage,
      symmetry: def.symmetric ? 2 : 1,
    };
    mutateBlueprint((bp) => {
      bp.version++;
      if (def.category === "pod") bp.parts.unshift(item);
      else bp.parts.push(item);
      return bp;
    });
    setSelectedUid(uid);
  }

  function moveSelected(delta: -1 | 1) {
    if (!selectedPart) return;
    mutateBlueprint((bp) => {
      const idx = bp.parts.findIndex((x) => x.uid === selectedPart.uid);
      const next = idx + delta;
      if (idx < 0 || next < 0 || next >= bp.parts.length) return bp;
      const [removed] = bp.parts.splice(idx, 1);
      bp.parts.splice(next, 0, removed);
      bp.version++;
      return bp;
    });
  }

  function cycleStage() {
    if (!selectedPart) return;
    mutateBlueprint((bp) => {
      const item = bp.parts.find((x) => x.uid === selectedPart.uid);
      if (!item) return bp;
      item.stage = (item.stage + 1) % Math.max(2, limits.maxStages);
      bp.version++;
      return bp;
    });
  }

  function toggleSymmetry() {
    if (!selectedPart) return;
    const def = PARTS[selectedPart.partId];
    if (!def.symmetric) return;
    mutateBlueprint((bp) => {
      const item = bp.parts.find((x) => x.uid === selectedPart.uid);
      if (!item) return bp;
      item.symmetry = item.symmetry === 2 ? 1 : 2;
      bp.version++;
      return bp;
    });
  }

  function removeSelected() {
    if (!selectedPart) return;
    mutateBlueprint((bp) => {
      bp.parts = bp.parts.filter((x) => x.uid !== selectedPart.uid);
      bp.version++;
      return bp;
    });
    setSelectedUid(null);
  }

  function cloneBlueprint() {
    if (p.blueprints.length >= MAX_BLUEPRINTS) {
      setNotice(`Design hangar full (${MAX_BLUEPRINTS}/${MAX_BLUEPRINTS}). Delete an older design first.`);
      return;
    }
    const id = "bp_" + Math.random().toString(36).slice(2, 7);
    const copy: RocketBlueprint = {
      ...structuredClone(activeBp),
      id,
      name: activeBp.name.slice(0, 14) + " Mk" + (p.blueprints.length + 1),
      version: 1,
    };
    m.saveBlueprint(copy, true);
    setSelectedUid(null);
    setNotice("");
    setSavedMsg(`Cloned "${copy.name}".`);
  }

  function openSaveDialog() {
    setDraftName(activeBp.name);
    setDialogError("");
    setSaveDialogOpen(true);
  }

  function saveAsNewDesign(e?: FormEvent) {
    e?.preventDefault();
    const clean = draftName.trim().slice(0, 32);
    if (!clean) {
      setDialogError("Enter a name for this rocket design.");
      return;
    }
    if (p.blueprints.length >= MAX_BLUEPRINTS) {
      setDialogError(
        `All ${MAX_BLUEPRINTS} design slots are full. Update or delete an existing design.`,
      );
      return;
    }
    const id = "bp_" + Math.random().toString(36).slice(2, 7);
    const saved: RocketBlueprint = {
      id,
      name: clean,
      version: 1,
      parts: structuredClone(activeBp.parts),
    };
    const ok = m.saveBlueprint(saved, true);
    if (!ok) {
      setDialogError("Could not save rocket design.");
      return;
    }
    setSaveDialogOpen(false);
    setSelectedUid(null);
    setNotice("");
    if (lesson) m.updateTutorial({ workshop: "picker" });
    setSavedMsg(`Saved "${clean}" to rocket designs.`);
  }

  function overwriteCurrentDesign() {
    const clean = draftName.trim().slice(0, 32);
    if (!clean) {
      setDialogError("Enter a name for this rocket design.");
      return;
    }
    const updated: RocketBlueprint = {
      ...structuredClone(activeBp),
      name: clean,
    };
    m.saveBlueprint(updated, true);
    setSaveDialogOpen(false);
    setNotice("");
    setSavedMsg(`Updated "${clean}".`);
  }

  function deleteCurrentDesign() {
    if (p.blueprints.length <= 1) return;
    const removedName = activeBp.name;
    if (m.deleteBlueprint(activeBp.id)) {
      setSaveDialogOpen(false);
      setSelectedUid(null);
      setNotice("");
      setSavedMsg(`Deleted "${removedName}".`);
    }
  }

  function launchMode(mode: "practice" | "real") {
    const err = m.launchBlueprint(activeBp.id, mode);
    if (err) setNotice(err);
  }

  function stageSelectedContract(useBlueprint: boolean, confirmed = false) {
    if (!contractJob) return;
    if (!confirmed && m.mission.flight.status !== "pad") {
      setReplaceTarget({ useBlueprint });
      return;
    }
    const err = m.stageContract(contractJob, useBlueprint ? activeBp.id : undefined);
    setReplaceTarget(null);
    if (err) setNotice(err);
  }

  // Compute pixel-grid-aligned SVG stack geometry (top to bottom)
  const scalePx = 5.4;
  const centerParts = activeBp.parts.filter((pt) => {
    const def = PARTS[pt.partId];
    return !(def.symmetric && pt.symmetry === 2);
  });
  const radialParts = activeBp.parts.filter((pt) => {
    const def = PARTS[pt.partId];
    return Boolean(def.symmetric && pt.symmetry === 2);
  });

  let cursorY = 36;
  let coreHalfW = 16;
  const stackNodes = centerParts.map((pt) => {
    const def = PARTS[pt.partId];
    const { cols, rows, w, h } = getPartPixelSize(pt.partId, scalePx);
    const y = cursorY;
    cursorY += h;
    coreHalfW = Math.max(coreHalfW, w / 2);
    return { pt, def, cols, rows, x: 160 - w / 2, y, w, h };
  });
  const baseY = Math.max(210, cursorY + 4);
  const svgH = Math.max(246, baseY + 26);

  const visibleParts = PART_IDS.filter((id) => PARTS[id].category === category);
  const canAffordReal =
    analysis.canLaunchWithLimits &&
    p.credits >= analysis.hardwareCost &&
    p.propellant >= analysis.propellantCost;

  return (
    <main className="game workshop-game" aria-label="Rocket Workshop">
      <header className="vab-top">
        <button
          className="insignia"
          aria-label="Earth launch site"
          title="Base"
          onClick={onSite}
        >
          <Landmark />
        </button>

        <div className="bp-picker">
          <select
            data-milo-focus={lesson && tutorial.workshop === "picker"}
            aria-label="Select blueprint"
            value={activeBp.id}
            onChange={(e) => {
              m.selectBlueprint(e.target.value);
              if (lesson && tutorial.workshop === "picker") dismissLesson();
              setSelectedUid(null);
              setNotice("");
              setSavedMsg("");
            }}
          >
            {p.blueprints.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (v{b.version})
              </option>
            ))}
          </select>
          <button
            className="save-bp-btn"
            data-milo-focus={lesson && tutorial.workshop === "offer"}
            aria-label="Save rocket design"
            title="Save rocket design"
            onClick={openSaveDialog}
          >
            <Save size={16} />
          </button>
          <button
            aria-label="Clone blueprint"
            title="Clone blueprint"
            onClick={cloneBlueprint}
          >
            <Copy size={16} />
          </button>
        </div>
      </header>

      {contractDef && contractQuote && (
        <section className="vab-contract-banner" aria-label="Selected contract">
          <div className="vab-contract-info">
            <div className="vab-contract-head">
              <ClipboardList size={14} />
              <strong>{contractDef.name}</strong>
              <span className="vab-contract-payout">
                +{contractQuote.credits.toLocaleString("en-US")} C · +{contractQuote.research} RD
              </span>
            </div>
            <p>{contractDef.goal}</p>
          </div>
          <button
            type="button"
            className="vab-contract-clear"
            aria-label="Clear selected contract"
            onClick={m.clearPendingContract}
          >
            <X size={15} />
          </button>
        </section>
      )}

      {soundingGuide && !saveDialogOpen && (
        <MiloGuide dismiss={() => m.updateTutorial({ status: "off", collectionTip: false })}>
          Pick or build a rocket here, or tap Sponsored Rocket to launch for 0 credits.
        </MiloGuide>
      )}

      {!soundingGuide && lesson && !saveDialogOpen && <MiloGuide dismissLabel="Dismiss design lesson" dismiss={dismissLesson}>
        {tutorial.workshop === "picker" ? "Your saved design is selected above. Open the dropdown to switch rockets."
          : "Like this design? Tap the save icon beside its name to keep a named copy."}
      </MiloGuide>}
      <div className="vab-metrics" aria-label="Vehicle engineering readouts">
        <div className="vab-stat">
          <span>MASS</span>
          <strong
            className={
              analysis.wetTonnes > limits.maxMassTonnes ? "over-limit" : ""
            }
          >
            {analysis.wetTonnes.toFixed(1)}
            <small>/{limits.maxMassTonnes}t</small>
          </strong>
        </div>
        <div className="vab-stat">
          <span>Δv</span>
          <strong>
            {Math.round(analysis.totalDeltaV).toLocaleString("en-US")}
            <small>m/s</small>
          </strong>
        </div>
        <div className="vab-stat">
          <span>TWR</span>
          <strong className={analysis.liftoffTwr <= 1 ? "over-limit" : ""}>
            {analysis.liftoffTwr.toFixed(2)}
          </strong>
        </div>
        <div className="vab-stat">
          <span>PARTS</span>
          <strong
            className={analysis.partCount > limits.maxParts ? "over-limit" : ""}
          >
            {analysis.partCount}
            <small>/{limits.maxParts}</small>
          </strong>
        </div>
      </div>

      <section className="vab-stage-canvas" aria-label="Rocket assembly bay">
        <svg
          viewBox={`0 0 320 ${svgH}`}
          className="vab-svg"
          onClick={() => setSelectedUid(null)}
        >
          <defs>
            <pattern
              id="vab-grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M20 0H0V20"
                fill="none"
                stroke="#85a8b322"
                strokeWidth="0.7"
              />
            </pattern>
          </defs>
          <rect width="320" height={svgH} fill="url(#vab-grid)" />
          <line
            x1="160"
            y1="10"
            x2="160"
            y2={baseY}
            stroke="#72d6c62b"
            strokeDasharray="4 4"
          />

          {/* Pixel-art launchpad assembly stand matching FlightScene pad */}
          <g shapeRendering="crispEdges">
            <rect x="44" y={baseY} width="232" height="8" fill="#283643" />
            <rect x="40" y={baseY - 2} width="240" height="3" fill="#b8b2a1" />
            {[-88, -60, -32, 32, 60, 88].map((dx) => (
              <rect
                key={dx}
                x={160 + dx - 4}
                y={baseY + 1}
                width="8"
                height="2"
                fill="#d99357"
              />
            ))}
          </g>

          {stackNodes.map(({ pt, def, cols, rows, x, y, w, h }) => {
            const isSel = pt.uid === selectedUid;
            return (
              <g
                key={pt.uid}
                className="svg-part"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedUid(pt.uid);
                }}
              >
                <PixelRocketPart
                  partId={pt.partId}
                  x={x}
                  y={y}
                  cols={cols}
                  rows={rows}
                  px={VAB_PX}
                  selected={isSel}
                />
                {isSel && (
                  <rect
                    x={x - 3}
                    y={y - 2}
                    width={w + 6}
                    height={h + 4}
                    fill="none"
                    stroke="#ffd166"
                    strokeWidth="1.2"
                    strokeDasharray="4 2"
                    shapeRendering="crispEdges"
                  />
                )}
                <text
                  x={Math.max(x + w, 160 + coreHalfW) + 12}
                  y={y + h / 2 + 3}
                  className={isSel ? "stage-tag active" : "stage-tag"}
                >
                  S{pt.stage + 1} · {def.shortName}
                </text>
              </g>
            );
          })}

          {radialParts.map((pt, idx) => {
            const def = PARTS[pt.partId];
            const isSel = pt.uid === selectedUid;
            const { cols, rows, w, h } = getRadialPixelSize(pt.partId, scalePx);
            const gap = VAB_PX * 2;
            const y = Math.max(
              48,
              Math.round((cursorY - h - idx * 8) / VAB_PX) * VAB_PX,
            );
            const leftX = 160 - coreHalfW - gap - w;
            const rightX = 160 + coreHalfW + gap;
            return (
              <g
                key={pt.uid}
                className="svg-part"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedUid(pt.uid);
                }}
              >
                <PixelRocketPart
                  partId={pt.partId}
                  x={leftX}
                  y={y}
                  cols={cols}
                  rows={rows}
                  px={VAB_PX}
                  selected={isSel}
                  radialSide={-1}
                />
                <PixelRocketPart
                  partId={pt.partId}
                  x={rightX}
                  y={y}
                  cols={cols}
                  rows={rows}
                  px={VAB_PX}
                  selected={isSel}
                  radialSide={1}
                />
                <text
                  x={rightX + w + 8}
                  y={y + h / 2 + 3}
                  className={isSel ? "stage-tag active" : "stage-tag"}
                >
                  2× {def.shortName}
                </text>
              </g>
            );
          })}
        </svg>

        {selectedPart && (
          <div className="part-toolbar" aria-label="Selected part controls">
            <span className="part-toolbar-name">
              {PARTS[selectedPart.partId].shortName} · S{selectedPart.stage + 1}
            </span>
            <button
              aria-label="Move part up"
              onClick={() => moveSelected(-1)}
            >
              <ArrowUp size={16} />
            </button>
            <button
              aria-label="Move part down"
              onClick={() => moveSelected(1)}
            >
              <ArrowDown size={16} />
            </button>
            <button aria-label="Switch stage" onClick={cycleStage}>
              <Layers2 size={16} />
              S{selectedPart.stage + 1}
            </button>
            {PARTS[selectedPart.partId].symmetric && (
              <button
                aria-label="Toggle mirror symmetry"
                onClick={toggleSymmetry}
              >
                <Split size={16} />
                {selectedPart.symmetry}×
              </button>
            )}
            <button
              className="danger"
              aria-label="Remove part"
              onClick={removeSelected}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </section>

      {savedMsg && !notice && (
        <div className="vab-saved-toast" role="status">
          <Check size={14} />
          <span>{savedMsg}</span>
        </div>
      )}

      {(analysis.warnings.length > 0 || notice || contractCheck?.error) && (
        <div className="vab-warnings" role="status">
          <TriangleAlert size={14} />
          <span>{notice || contractCheck?.error || analysis.warnings[0].message}</span>
        </div>
      )}

      <section className="vab-tray" aria-label="Part catalog">
        <div className="tray-tabs">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={category === c.id ? "active" : ""}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="tray-grid">
          {visibleParts.map((id) => {
            const def = PARTS[id];
            const locked = def.requiredLabLevel > limits.labLevel;
            return (
              <button
                key={id}
                className={"part-card" + (locked ? " locked" : "")}
                aria-label={"Add " + def.name}
                onClick={() => addPart(id)}
              >
                <div className="part-card-body">
                  <PartPixelThumb partId={id} />
                  <div className="part-card-info">
                    <div className="part-card-top">
                      <strong>{def.shortName}</strong>
                      {locked ? (
                        <span className="part-lock">
                          <Lock size={11} /> Lab {def.requiredLabLevel}
                        </span>
                      ) : (
                        <Plus size={14} />
                      )}
                    </div>
                    <small>
                      {def.thrustKn > 0
                        ? `${def.thrustKn} kN · ${def.ispVac}s`
                        : def.fuelTonnes > 0
                          ? `${def.fuelTonnes} t fuel`
                          : `${def.dryTonnes} t`}
                    </small>
                    <em className="part-cost">
                      {def.hardwareCost} C
                      {def.propellantCost > 0
                        ? ` · ${def.propellantCost} P`
                        : ""}
                    </em>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="vab-actions">
        {contractJob === "sounding" ? (
          <>
            <button
              className="sim-btn"
              data-milo-focus={soundingGuide}
              aria-label="Fly Sponsored Rocket"
              onClick={() => stageSelectedContract(false)}
            >
              <Rocket size={16} />
              Sponsored (0 C)
            </button>
            <button
              className="primary launch-btn"
              aria-label={`Fly ${contractDef?.name} with ${activeBp.name}`}
              disabled={Boolean(contractCheck?.error)}
              onClick={() => stageSelectedContract(true)}
            >
              <span>Fly Blueprint</span>
              <small className="vab-launch-price">
                <span>
                  <Coins />
                  {analysis.hardwareCost}
                </span>
                <span>
                  <Flame />
                  {analysis.propellantCost}
                </span>
              </small>
            </button>
          </>
        ) : contractJob ? (
          <>
            <button
              className="sim-btn"
              disabled={!analysis.canSimulate}
              onClick={() => launchMode("practice")}
            >
              <Wrench size={16} />
              Simulate Free
            </button>
            <button
              className="primary launch-btn"
              aria-label={`Fly ${contractDef?.name} with ${activeBp.name}`}
              disabled={Boolean(contractCheck?.error)}
              onClick={() => stageSelectedContract(true)}
            >
              <span>Fly Contract</span>
              <small className="vab-launch-price">
                <span>
                  <Coins />
                  {analysis.hardwareCost}
                </span>
                <span>
                  <Flame />
                  {analysis.propellantCost}
                </span>
              </small>
            </button>
          </>
        ) : (
          <>
            <button
              className="sim-btn"
              disabled={!analysis.canSimulate}
              onClick={() => launchMode("practice")}
            >
              <Wrench size={16} />
              Simulate Free
            </button>
            <button
              className="primary launch-btn"
              aria-label={`Launch · ${analysis.hardwareCost} credits + ${analysis.propellantCost} propellant`}
              disabled={!canAffordReal}
              onClick={() => launchMode("real")}
            >
              <span>Launch</span>
              <small className="vab-launch-price">
                <span>
                  <Coins />
                  {analysis.hardwareCost}
                </span>
                <span>
                  <Flame />
                  {analysis.propellantCost}
                </span>
              </small>
            </button>
          </>
        )}
      </footer>

      {replaceTarget && contractDef && (
        <Dialog tone="warning" title="Replace flight?" close={() => setReplaceTarget(null)}>
          <p>
            Retire the active vehicle and stage{" "}
            {replaceTarget.useBlueprint ? activeBp.name : "the Sponsored Rocket"} for{" "}
            {contractDef.name}?
          </p>
          <button
            className="primary"
            onClick={() => stageSelectedContract(replaceTarget.useBlueprint, true)}
          >
            Prepare flight
          </button>
        </Dialog>
      )}

      {saveDialogOpen && (
        <Dialog title="Save Rocket Design" close={() => setSaveDialogOpen(false)}>
          {lesson && <MiloGuide dismissLabel="Dismiss design lesson" dismiss={dismissLesson}>
            {p.blueprints.length < MAX_BLUEPRINTS ? "Give the rocket a name and choose Save as New."
              : "All design slots are full. Update Current to keep changes to this design."}
          </MiloGuide>}
          <form className="save-bp-form" onSubmit={saveAsNewDesign}>
            <label className="save-bp-label" htmlFor="bp-name-input">
              Design Name
              <span className="save-bp-slots">
                {p.blueprints.length}/{MAX_BLUEPRINTS} saved
              </span>
            </label>
            <input
              id="bp-name-input"
              className="save-bp-input"
              type="text"
              maxLength={32}
              autoFocus
              value={draftName}
              placeholder="e.g. Lunar Heavy"
              onChange={(e) => {
                setDraftName(e.target.value);
                setDialogError("");
              }}
            />

            <div className="save-bp-summary">
              <span>{analysis.partCount} parts</span>
              <span>{analysis.wetTonnes.toFixed(1)} t</span>
              <span>{Math.round(analysis.totalDeltaV).toLocaleString("en-US")} m/s</span>
              <span>TWR {analysis.liftoffTwr.toFixed(2)}</span>
            </div>

            {dialogError && (
              <p className="save-bp-error" role="alert">
                {dialogError}
              </p>
            )}

            <div className="dialog-actions">
              <button
                data-milo-focus={lesson && p.blueprints.length < MAX_BLUEPRINTS}
                type="submit"
                className="primary"
                disabled={p.blueprints.length >= MAX_BLUEPRINTS}
              >
                <Save size={15} />
                Save as New
              </button>
              <button type="button" onClick={overwriteCurrentDesign}>
                Update Current
              </button>
            </div>

            {p.blueprints.length > 1 && (
              <div className="save-bp-danger-row">
                <button
                  type="button"
                  className="save-bp-delete"
                  onClick={deleteCurrentDesign}
                >
                  <Trash2 size={14} />
                  Delete "{activeBp.name}"
                </button>
              </div>
            )}
          </form>
        </Dialog>
      )}
    </main>
  );
}
