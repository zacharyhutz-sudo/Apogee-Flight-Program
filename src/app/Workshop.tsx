import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Coins,
  Copy,
  Flame,
  Landmark,
  Layers2,
  Lock,
  Plus,
  Rocket,
  Split,
  Trash2,
  TriangleAlert,
  Wrench,
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
import { getFacilityLimits } from "../program/program";
import type { useMission } from "./useMission";
import "./workshop.css";

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
  const limits = getFacilityLimits(p);
  const activeBp =
    p.blueprints.find((b) => b.id === p.activeBlueprintId) ?? p.blueprints[0];

  const [category, setCategory] = useState<PartCategory>("tank");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const analysis = useMemo(
    () => analyzeBlueprint(activeBp, limits),
    [activeBp, limits],
  );

  const selectedPart =
    activeBp.parts.find((pt) => pt.uid === selectedUid) ?? null;

  function mutateBlueprint(fn: (bp: RocketBlueprint) => RocketBlueprint) {
    m.saveBlueprint(fn(structuredClone(activeBp)));
    setNotice("");
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
    const id = "bp_" + Math.random().toString(36).slice(2, 7);
    const copy: RocketBlueprint = {
      ...structuredClone(activeBp),
      id,
      name: activeBp.name.slice(0, 14) + " Mk" + (p.blueprints.length + 1),
      version: 1,
    };
    m.saveBlueprint(copy, true);
    setSelectedUid(null);
  }

  function launchMode(mode: "practice" | "real") {
    const err = m.launchBlueprint(activeBp.id, mode);
    if (err) setNotice(err);
  }

  // Compute SVG stack geometry (top to bottom)
  const scalePx = 5.4;
  const centerParts = activeBp.parts.filter((pt) => {
    const def = PARTS[pt.partId];
    return !(def.symmetric && pt.symmetry === 2);
  });
  const radialParts = activeBp.parts.filter((pt) => {
    const def = PARTS[pt.partId];
    return Boolean(def.symmetric && pt.symmetry === 2);
  });

  let cursorY = 38;
  const stackNodes = centerParts.map((pt) => {
    const def = PARTS[pt.partId];
    const h = Math.max(12, def.heightM * scalePx);
    const w = Math.max(18, def.widthM * scalePx * 2.2);
    const y = cursorY;
    cursorY += h;
    return { pt, def, x: 160 - w / 2, y, w, h };
  });
  const baseY = Math.max(210, cursorY + 12);
  const svgH = Math.max(245, baseY + 22);

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
            aria-label="Select blueprint"
            value={activeBp.id}
            onChange={(e) => {
              m.selectBlueprint(e.target.value);
              setSelectedUid(null);
              setNotice("");
            }}
          >
            {p.blueprints.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (v{b.version})
              </option>
            ))}
          </select>
          <button
            aria-label="Clone blueprint"
            title="Clone blueprint"
            onClick={cloneBlueprint}
          >
            <Copy size={16} />
          </button>
        </div>
      </header>

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
          <line
            x1="36"
            y1={baseY}
            x2="284"
            y2={baseY}
            stroke="#9eb9c266"
            strokeWidth="2"
          />

          {stackNodes.map(({ pt, def, x, y, w, h }) => {
            const isSel = pt.uid === selectedUid;
            const stroke = isSel ? "#f3a953" : "#9eb9c288";
            const fill =
              def.category === "pod"
                ? "#e7e1d4"
                : def.category === "tank"
                  ? "#d2d9d5"
                  : def.category === "engine"
                    ? "#425563"
                    : def.category === "stage"
                      ? "#d98d4c"
                      : "#7ea8ab";
            return (
              <g
                key={pt.uid}
                className="svg-part"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedUid(pt.uid);
                }}
              >
                {def.category === "pod" ? (
                  <polygon
                    points={`160,${y} ${x + w},${y + h} ${x},${y + h}`}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSel ? 2.4 : 1.2}
                  />
                ) : def.category === "engine" ? (
                  <polygon
                    points={`${x + w * 0.22},${y} ${x + w * 0.78},${y} ${x + w * 0.92},${y + h} ${x + w * 0.08},${y + h}`}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSel ? 2.4 : 1.2}
                  />
                ) : (
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx="2"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSel ? 2.4 : 1.2}
                  />
                )}
                {def.category === "tank" && (
                  <line
                    x1={x + 2}
                    y1={y + h * 0.5}
                    x2={x + w - 2}
                    y2={y + h * 0.5}
                    stroke="#f3a953"
                    strokeWidth="2.5"
                  />
                )}
                <text
                  x={x + w + 8}
                  y={y + h / 2 + 3}
                  className="stage-tag"
                >
                  S{pt.stage + 1} · {def.shortName}
                </text>
              </g>
            );
          })}

          {radialParts.map((pt, idx) => {
            const def = PARTS[pt.partId];
            const isSel = pt.uid === selectedUid;
            const h = Math.max(24, def.heightM * scalePx);
            const w = Math.max(12, def.widthM * scalePx * 2);
            const y = Math.max(52, cursorY - h - idx * 8);
            const stroke = isSel ? "#f3a953" : "#72d6c6aa";
            return (
              <g
                key={pt.uid}
                className="svg-part"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedUid(pt.uid);
                }}
              >
                <rect
                  x={120 - w}
                  y={y}
                  width={w}
                  height={h}
                  rx="3"
                  fill="#cfd8d4"
                  stroke={stroke}
                  strokeWidth={isSel ? 2.4 : 1.2}
                />
                <rect
                  x={200}
                  y={y}
                  width={w}
                  height={h}
                  rx="3"
                  fill="#cfd8d4"
                  stroke={stroke}
                  strokeWidth={isSel ? 2.4 : 1.2}
                />
                <text x={200 + w + 6} y={y + h / 2 + 3} className="stage-tag">
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
              <button aria-label="Toggle mirror symmetry" onClick={toggleSymmetry}>
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

      {(analysis.warnings.length > 0 || notice) && (
        <div className="vab-warnings" role="status">
          <TriangleAlert size={14} />
          <span>{notice || analysis.warnings[0].message}</span>
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
                  {def.propellantCost > 0 ? ` · ${def.propellantCost} P` : ""}
                </em>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="vab-actions">
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
          disabled={!canAffordReal}
          onClick={() => launchMode("real")}
        >
          <Rocket size={16} />
          Launch · <Coins size={13} />
          {analysis.hardwareCost} · <Flame size={13} />
          {analysis.propellantCost}
        </button>
      </footer>
    </main>
  );
}
