import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import {
  PARTS,
  PART_IDS,
  analyzeBlueprint,
  resolvePartMount,
  syncBlueprintHierarchy,
  type PartCategory,
  type PartId,
  type PlacedPart,
  type RocketBlueprint,
} from "../program/workshop";
import {
  CONTRACTS,
  MODIFIER_META,
  PERK_META,
  PILOT_BY_ID,
  RARITY_META,
  contractVehicle,
  ensureCrew,
  getFacilityLimits,
  inspectContractBlueprint,
  inspectRotatingBlueprint,
  level,
  pilotStats,
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
const DRAG_THRESHOLD_PX = 8;

const CATEGORIES: Array<{ id: PartCategory; label: string }> = [
  { id: "pod", label: "Pods" },
  { id: "tank", label: "Tanks" },
  { id: "engine", label: "Engines" },
  { id: "stage", label: "Stages" },
  { id: "utility", label: "Payload" },
];

type SnapTarget =
  | {
      kind: "center-insert";
      insertIndex: number; // index within centerParts
      stage: number;
      x: number;
      y: number;
      w: number;
      valid: boolean;
      reason?: string;
    }
  | {
      kind: "tank-flank";
      hostUid: string;
      stage: number;
      x: number;
      y: number;
      w: number;
      h: number;
      valid: boolean;
      reason?: string;
    }
  | {
      kind: "side-insert";
      bracketUid: string;
      insertIndex: number; // index within bracket children
      stage: number;
      symmetry: 1 | 2;
      x: number;
      y: number;
      w: number;
      valid: boolean;
      reason?: string;
    };

interface DragState {
  source: "tray" | "canvas";
  partId: PartId;
  uid?: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  snap: SnapTarget | null;
  overTrash: boolean;
}

export function Workshop({
  mission: m,
  onSite,
}: {
  mission: ReturnType<typeof useMission>;
  onSite: () => void;
}) {
  const p = m.mission.program;
  const tutorial = m.mission.tutorial;
  const lesson =
    m.loaded &&
    (tutorial.status === "active" || tutorial.status === "complete") &&
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
  const [selectedPilotId, setSelectedPilotId] = useState("");
  const [drag, setDrag] = useState<DragState | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const crew = ensureCrew(p);
  const readyPilots = crew.pilots.filter((x) => x.status === "ready");
  const hasCrewedPod = activeBp.parts.some((pt) => pt.partId === "pod_mk1");
  const effectivePilotId =
    hasCrewedPod && readyPilots.some((x) => x.id === selectedPilotId) ? selectedPilotId : "";
  const seatedPilot = effectivePilotId
    ? readyPilots.find((x) => x.id === effectivePilotId)
    : undefined;
  const seatedDef = seatedPilot ? PILOT_BY_ID[seatedPilot.id] : undefined;
  const seatedStats = seatedPilot ? pilotStats(seatedPilot) : null;

  const pendingContract = m.pendingContract;
  const fixedJob = pendingContract?.kind === "fixed" ? pendingContract.job : null;
  const rotatingOffer = pendingContract?.kind === "rotating" ? pendingContract.offer : null;
  const contractName = fixedJob
    ? CONTRACTS[fixedJob].name
    : rotatingOffer
      ? rotatingOffer.name
      : null;
  const contractGoal = fixedJob
    ? CONTRACTS[fixedJob].goal
    : rotatingOffer
      ? rotatingOffer.goal
      : null;
  const contractPayout = fixedJob
    ? (() => {
        const q = quote(p, fixedJob, contractVehicle(p, fixedJob));
        return { credits: q.credits, research: q.research };
      })()
    : rotatingOffer
      ? {
          credits: rotatingOffer.credits,
          research: Math.round(rotatingOffer.research * (1 + 0.1 * level(p, "lab"))),
        }
      : null;
  const contractCheck = useMemo(() => {
    if (fixedJob) return inspectContractBlueprint(p, fixedJob, activeBp.id, effectivePilotId || undefined);
    if (rotatingOffer) return inspectRotatingBlueprint(p, rotatingOffer, activeBp.id, effectivePilotId || undefined);
    return null;
  }, [fixedJob, rotatingOffer, p, activeBp, p.credits, p.propellant, effectivePilotId]);
  const soundingGuide =
    m.loaded &&
    tutorial.status === "active" &&
    !p.milestones.firstSounding &&
    fixedJob === "sounding";

  const analysis = useMemo(
    () => analyzeBlueprint(activeBp, limits),
    [activeBp, limits],
  );

  const selectedPart =
    activeBp.parts.find((pt) => pt.uid === selectedUid) ?? null;

  const selectedTankGroup = useMemo(() => {
    if (!selectedPart || PARTS[selectedPart.partId]?.category !== "tank") return null;
    const gid = analysis.topology.tankGroupByUid[selectedPart.uid];
    if (!gid) return null;
    return analysis.topology.tankGroups.find((g) => g.id === gid) ?? null;
  }, [selectedPart, analysis.topology]);

  function mutateBlueprint(fn: (bp: RocketBlueprint) => RocketBlueprint) {
    const next = fn(structuredClone(activeBp));
    next.parts = syncBlueprintHierarchy(next.parts);
    m.saveBlueprint(next);
    setNotice("");
    setSavedMsg("");
  }

  // --- 2D Layout Engine (center stack + side brackets + side columns + stage-anchored legs/SRBs) ---
  const layout = useMemo(() => {
    const scalePx = 5.4;
    const byUid = new Map<string, PlacedPart>();
    for (const pt of activeBp.parts) byUid.set(pt.uid, pt);

    const centerParts: PlacedPart[] = [];
    const brackets: PlacedPart[] = [];
    const bracketChildren = new Map<string, PlacedPart[]>();
    const standaloneRadial: PlacedPart[] = [];

    for (const pt of activeBp.parts) {
      if (pt.partId === "bracket_side") {
        brackets.push(pt);
        bracketChildren.set(pt.uid, []);
      } else if (resolvePartMount(pt) === "center") {
        centerParts.push(pt);
      } else if (pt.parentUid && byUid.get(pt.parentUid)?.partId === "bracket_side") {
        const arr = bracketChildren.get(pt.parentUid);
        if (arr) arr.push(pt);
        else bracketChildren.set(pt.parentUid, [pt]);
      } else {
        standaloneRadial.push(pt);
      }
    }

    // First pass: measure widths to pick svgW so side columns never clip
    let coreHalfW = 16;
    for (const pt of centerParts) {
      coreHalfW = Math.max(coreHalfW, getPartPixelSize(pt.partId, scalePx).w / 2);
    }
    let maxSideSpan = 0;
    const brSize = getRadialPixelSize("bracket_side", scalePx);
    for (const br of brackets) {
      let colMaxW = 18;
      for (const ch of bracketChildren.get(br.uid) ?? []) {
        colMaxW = Math.max(colMaxW, getPartPixelSize(ch.partId, scalePx).w);
      }
      maxSideSpan = Math.max(maxSideSpan, brSize.w + colMaxW + 18);
    }
    for (const rp of standaloneRadial) {
      maxSideSpan = Math.max(maxSideSpan, getRadialPixelSize(rp.partId, scalePx).w + 16);
    }

    const svgW = Math.max(320, Math.ceil((coreHalfW + maxSideSpan + 74) * 2));
    const cx = Math.round(svgW / 2);

    let cursorY = 34;
    const stackNodes = centerParts.map((pt, index) => {
      const def = PARTS[pt.partId];
      const { cols, rows, w, h } = getPartPixelSize(pt.partId, scalePx);
      const y = cursorY;
      cursorY += h;
      return { pt, def, index, cols, rows, x: cx - w / 2, y, w, h };
    });

    const nodeByUid = new Map(stackNodes.map((n) => [n.pt.uid, n]));
    const stageBounds = new Map<number, { minY: number; maxY: number; maxHalfW: number }>();
    const lowestTankByStage = new Map<number, (typeof stackNodes)[number]>();

    for (const n of stackNodes) {
      const cur = stageBounds.get(n.pt.stage);
      const hw = n.w / 2;
      if (!cur) {
        stageBounds.set(n.pt.stage, { minY: n.y, maxY: n.y + n.h, maxHalfW: hw });
      } else {
        cur.minY = Math.min(cur.minY, n.y);
        cur.maxY = Math.max(cur.maxY, n.y + n.h);
        cur.maxHalfW = Math.max(cur.maxHalfW, hw);
      }
      if (n.def.category === "tank") {
        lowestTankByStage.set(n.pt.stage, n);
      }
    }

    // Side brackets + their child stacks
    let maxBottomY = cursorY;
    const bracketLayouts = brackets.map((br) => {
      const hostNode =
        (br.parentUid ? nodeByUid.get(br.parentUid) : undefined) ??
        lowestTankByStage.get(br.stage) ??
        stackNodes[stackNodes.length - 1];
      const hostHw = hostNode ? hostNode.w / 2 : coreHalfW;
      const anchorY = hostNode
        ? Math.round((hostNode.y + hostNode.h / 2 - brSize.h / 2) / VAB_PX) * VAB_PX
        : Math.max(48, cursorY - brSize.h - 8);
      const leftBrX = cx - hostHw - brSize.w;
      const rightBrX = cx + hostHw;

      const children = bracketChildren.get(br.uid) ?? [];
      let colH = 0;
      let colMaxW = 16;
      const childSizes = children.map((ch) => {
        const sz = getPartPixelSize(ch.partId, scalePx);
        colH += sz.h;
        colMaxW = Math.max(colMaxW, sz.w);
        return { pt: ch, def: PARTS[ch.partId], ...sz };
      });

      const hostBottom = hostNode ? hostNode.y + hostNode.h : cursorY;
      const hasEngine = children.some((c) => PARTS[c.partId]?.category === "engine");
      const targetBottom = hasEngine ? hostBottom + 10 : hostBottom;
      let childY = Math.max(
        26,
        Math.round((targetBottom - colH) / VAB_PX) * VAB_PX,
      );
      if (children.length === 0) childY = anchorY;

      const leftColCenterX = leftBrX - colMaxW / 2;
      const rightColCenterX = rightBrX + brSize.w + colMaxW / 2;

      const childNodes = childSizes.map((cs, index) => {
        const y = childY;
        childY += cs.h;
        maxBottomY = Math.max(maxBottomY, childY);
        return {
          ...cs,
          index,
          y,
          leftX: leftColCenterX - cs.w / 2,
          rightX: rightColCenterX - cs.w / 2,
        };
      });

      return {
        pt: br,
        def: PARTS[br.partId],
        hostNode,
        brSize,
        anchorY,
        leftBrX,
        rightBrX,
        leftColCenterX,
        rightColCenterX,
        colMaxW,
        colStartY: childNodes[0]?.y ?? anchorY,
        colEndY: childNodes.length
          ? childNodes[childNodes.length - 1].y + childNodes[childNodes.length - 1].h
          : anchorY + brSize.h,
        childNodes,
      };
    });

    // Standalone radial parts (legs_mk1, srb_side) anchored to their host tank or assigned stage bottom!
    const radialLayouts = standaloneRadial.map((pt, idx) => {
      const def = PARTS[pt.partId];
      const sz = getRadialPixelSize(pt.partId, scalePx);
      const hostNode =
        (pt.parentUid ? nodeByUid.get(pt.parentUid) : undefined) ??
        lowestTankByStage.get(pt.stage);
      const stBound = stageBounds.get(pt.stage);
      const hostHw = hostNode ? hostNode.w / 2 : (stBound?.maxHalfW ?? coreHalfW);
      const anchorBottom = hostNode
        ? hostNode.y + hostNode.h
        : (stBound?.maxY ?? cursorY);
      const gap = VAB_PX * 2;
      const y = Math.max(
        28,
        Math.round((anchorBottom - sz.h - (idx > 0 && !pt.parentUid ? idx * 6 : 0)) / VAB_PX) * VAB_PX,
      );
      maxBottomY = Math.max(maxBottomY, y + sz.h);
      const leftX = cx - hostHw - gap - sz.w;
      const rightX = cx + hostHw + gap;
      return { pt, def, ...sz, y, leftX, rightX };
    });

    const baseY = Math.max(210, maxBottomY + 8);
    const svgH = Math.max(248, baseY + 26);

    return {
      scalePx,
      svgW,
      svgH,
      cx,
      baseY,
      coreHalfW,
      centerParts,
      stackNodes,
      bracketLayouts,
      radialLayouts,
      stageBounds,
      lowestTankByStage,
    };
  }, [activeBp]);

  // Compute valid snap targets for a given dragged part
  function computeSnapTargets(partId: PartId, draggedUid?: string): SnapTarget[] {
    const def = PARTS[partId];
    const targets: SnapTarget[] = [];
    const center = layout.stackNodes.filter((n) => n.pt.uid !== draggedUid);
    const isRadialOnly = partId === "bracket_side" || partId === "srb_side";
    const canMountOnFlank =
      partId === "bracket_side" || partId === "srb_side" || partId === "legs_mk1";
    const canStackInSide =
      def.category === "tank" ||
      def.category === "engine" ||
      partId === "chute_mk1" ||
      partId === "legs_mk1";

    // 1. Centerline stack slots
    if (!isRadialOnly) {
      if (center.length === 0) {
        targets.push({
          kind: "center-insert",
          insertIndex: 0,
          stage: 0,
          x: layout.cx,
          y: 70,
          w: 36,
          valid: def.category !== "engine",
          reason: def.category === "engine" ? "Place under a fuel tank" : undefined,
        });
      } else {
        for (let i = 0; i <= center.length; i++) {
          const above = i > 0 ? center[i - 1] : null;
          const below = i < center.length ? center[i] : null;
          const slotY = above ? above.y + above.h : below!.y;
          const slotW = Math.max(26, above?.w ?? below?.w ?? 30);

          let stage = above?.pt.stage ?? below?.pt.stage ?? 0;
          if (partId === "decoupler" && below) stage = below.pt.stage;
          else if (above && above.pt.partId === "decoupler" && below) stage = below.pt.stage;
          else if (def.category === "pod" && i === 0) stage = below?.pt.stage ?? Math.min(1, limits.maxStages - 1);

          let valid = true;
          let reason: string | undefined;
          if (def.category === "engine") {
            if (!above || above.def.category !== "tank") {
              valid = false;
              reason = "Place under a fuel tank";
            } else {
              stage = above.pt.stage;
            }
          }

          targets.push({
            kind: "center-insert",
            insertIndex: i,
            stage,
            x: layout.cx,
            y: slotY,
            w: slotW,
            valid,
            reason,
          });
        }
      }
    }

    // 2. Centerline tank flanks (for Side Brackets, Side SRBs, Landing Legs)
    if (canMountOnFlank) {
      const tanks = center.filter((n) => n.def.category === "tank");
      const flankHosts = tanks.length > 0 ? tanks : partId === "legs_mk1" ? center : [];
      for (const host of flankHosts) {
        targets.push({
          kind: "tank-flank",
          hostUid: host.pt.uid,
          stage: host.pt.stage,
          x: host.x + host.w + 14,
          y: host.y + host.h / 2,
          w: 16,
          h: Math.max(16, host.h * 0.65),
          valid: true,
        });
        targets.push({
          kind: "tank-flank",
          hostUid: host.pt.uid,
          stage: host.pt.stage,
          x: host.x - 14,
          y: host.y + host.h / 2,
          w: 16,
          h: Math.max(16, host.h * 0.65),
          valid: true,
        });
      }
    }

    // 3. Side-bracket columns (for Tanks, Engines, Chutes, Legs)
    if (canStackInSide) {
      for (const bl of layout.bracketLayouts) {
        if (bl.pt.uid === draggedUid) continue;
        const kids = bl.childNodes.filter((c) => c.pt.uid !== draggedUid);
        const colCenters =
          bl.pt.symmetry === 2
            ? [bl.leftColCenterX, bl.rightColCenterX]
            : [bl.rightColCenterX];

        for (const colX of colCenters) {
          if (kids.length === 0) {
            const valid = def.category !== "engine";
            targets.push({
              kind: "side-insert",
              bracketUid: bl.pt.uid,
              insertIndex: 0,
              stage: bl.pt.stage,
              symmetry: bl.pt.symmetry,
              x: colX,
              y: bl.anchorY + bl.brSize.h / 2,
              w: Math.max(22, bl.colMaxW),
              valid,
              reason: valid ? undefined : "Place a tank on the bracket first",
            });
          } else {
            for (let i = 0; i <= kids.length; i++) {
              const above = i > 0 ? kids[i - 1] : null;
              const below = i < kids.length ? kids[i] : null;
              const slotY = above ? above.y + above.h : below!.y;
              let valid = true;
              let reason: string | undefined;
              if (def.category === "engine" && (!above || above.def.category !== "tank")) {
                valid = false;
                reason = "Place under a fuel tank";
              }
              targets.push({
                kind: "side-insert",
                bracketUid: bl.pt.uid,
                insertIndex: i,
                stage: bl.pt.stage,
                symmetry: bl.pt.symmetry,
                x: colX,
                y: slotY,
                w: Math.max(22, bl.colMaxW),
                valid,
                reason,
              });
            }
          }
        }
      }
    }

    return targets;
  }

  function clientToSvg(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  function findBestSnap(
    clientX: number,
    clientY: number,
    partId: PartId,
    draggedUid?: string,
  ): { snap: SnapTarget | null; overTrash: boolean } {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const insideCanvas = Boolean(
      canvasRect &&
        clientX >= canvasRect.left - 12 &&
        clientX <= canvasRect.right + 12 &&
        clientY >= canvasRect.top - 12 &&
        clientY <= canvasRect.bottom + 12,
    );
    if (!insideCanvas) {
      return { snap: null, overTrash: Boolean(draggedUid) };
    }
    const svgPt = clientToSvg(clientX, clientY);
    if (!svgPt) return { snap: null, overTrash: false };

    const candidates = computeSnapTargets(partId, draggedUid);
    let best: SnapTarget | null = null;
    let bestDist = 52; // SVG units snap radius
    for (const t of candidates) {
      const d = Math.hypot(svgPt.x - t.x, svgPt.y - t.y);
      // Slight preference for valid slots when nearly equidistant
      const score = t.valid ? d : d + 10;
      if (score < bestDist) {
        bestDist = score;
        best = t;
      }
    }
    return { snap: best, overTrash: false };
  }

  function commitDrop(state: DragState) {
    const { source, partId, uid, snap, overTrash } = state;

    if (source === "canvas" && uid && overTrash) {
      mutateBlueprint((bp) => {
        bp.parts = bp.parts.filter((x) => x.uid !== uid && x.parentUid !== uid);
        bp.version++;
        return bp;
      });
      if (selectedUid === uid) setSelectedUid(null);
      return;
    }

    if (!snap) return;
    if (!snap.valid) {
      setNotice(snap.reason ?? "Cannot place part there.");
      return;
    }

    const def = PARTS[partId];
    const newUid = uid ?? "pt_" + Math.random().toString(36).slice(2, 8);

    mutateBlueprint((bp) => {
      const existing = uid ? bp.parts.find((x) => x.uid === uid) : undefined;
      // Remove existing item before re-inserting at target position
      if (uid) {
        bp.parts = bp.parts.filter((x) => x.uid !== uid);
      }

      if (snap.kind === "center-insert") {
        const item: PlacedPart = {
          uid: newUid,
          partId,
          stage: snap.stage,
          symmetry: 1,
          mount: "center",
        };
        const centerUids = bp.parts
          .filter((x) => resolvePartMount(x) === "center")
          .map((x) => x.uid);
        if (snap.insertIndex >= centerUids.length) {
          bp.parts.push(item);
        } else {
          const refUid = centerUids[snap.insertIndex];
          const rawIdx = bp.parts.findIndex((x) => x.uid === refUid);
          bp.parts.splice(Math.max(0, rawIdx), 0, item);
        }
      } else if (snap.kind === "tank-flank") {
        const item: PlacedPart = {
          uid: newUid,
          partId,
          stage: snap.stage,
          symmetry: existing?.symmetry ?? (def.symmetric ? 2 : 1),
          mount: "side",
          parentUid: snap.hostUid,
        };
        bp.parts.push(item);
      } else if (snap.kind === "side-insert") {
        const item: PlacedPart = {
          uid: newUid,
          partId,
          stage: snap.stage,
          symmetry: snap.symmetry,
          mount: "side",
          parentUid: snap.bracketUid,
        };
        const siblingUids = bp.parts
          .filter((x) => x.mount === "side" && x.parentUid === snap.bracketUid)
          .map((x) => x.uid);
        if (snap.insertIndex >= siblingUids.length) {
          bp.parts.push(item);
        } else {
          const refUid = siblingUids[snap.insertIndex];
          const rawIdx = bp.parts.findIndex((x) => x.uid === refUid);
          bp.parts.splice(Math.max(0, rawIdx), 0, item);
        }
      }

      bp.version++;
      return bp;
    });

    setSelectedUid(newUid);
  }

  // Smart tap fallback when user taps a catalog card without dragging
  function addPart(partId: PartId) {
    const def = PARTS[partId];
    if (def.requiredLabLevel > limits.labLevel) {
      setNotice(`Requires Research Lab Lv ${def.requiredLabLevel}.`);
      return;
    }
    const uid = "pt_" + Math.random().toString(36).slice(2, 8);
    const hasTwoStages = activeBp.parts.some((x) => x.stage >= 1);
    const upperStage = hasTwoStages ? 1 : Math.min(1, limits.maxStages - 1);

    if (partId === "bracket_side" || partId === "srb_side") {
      const preferredStage = selectedPart ? selectedPart.stage : 0;
      const hostTank =
        layout.lowestTankByStage.get(preferredStage) ??
        layout.lowestTankByStage.get(0) ??
        layout.stackNodes.find((n) => n.def.category === "tank");
      const targetStage = selectedPart ? preferredStage : (hostTank?.pt.stage ?? 0);
      const item: PlacedPart = {
        uid,
        partId,
        stage: targetStage,
        symmetry: 2,
        mount: "side",
        ...(hostTank && hostTank.pt.stage === targetStage ? { parentUid: hostTank.pt.uid } : {}),
      };
      mutateBlueprint((bp) => {
        bp.parts.push(item);
        bp.version++;
        return bp;
      });
      setSelectedUid(uid);
      return;
    }

    if (partId === "legs_mk1") {
      // Default legs to upper/lander stage when present, anchored to its tank
      const targetStage = hasTwoStages ? upperStage : 0;
      const hostTank =
        layout.lowestTankByStage.get(targetStage) ??
        layout.lowestTankByStage.get(0);
      const item: PlacedPart = {
        uid,
        partId,
        stage: hostTank?.pt.stage ?? targetStage,
        symmetry: 2,
        mount: "side",
        ...(hostTank ? { parentUid: hostTank.pt.uid } : {}),
      };
      mutateBlueprint((bp) => {
        bp.parts.push(item);
        bp.version++;
        return bp;
      });
      setSelectedUid(uid);
      return;
    }

    const defaultStage =
      def.category === "pod" || partId === "eng_dart" || partId === "tank_s"
        ? upperStage
        : 0;

    // Smart engine placement: insert right under the lowest tank in defaultStage (or stage 0)
    if (def.category === "engine") {
      const targetTank =
        layout.lowestTankByStage.get(defaultStage) ??
        layout.lowestTankByStage.get(0) ??
        [...layout.stackNodes].reverse().find((n) => n.def.category === "tank");
      const item: PlacedPart = {
        uid,
        partId,
        stage: targetTank?.pt.stage ?? defaultStage,
        symmetry: 1,
        mount: "center",
      };
      mutateBlueprint((bp) => {
        if (targetTank) {
          const idx = bp.parts.findIndex((x) => x.uid === targetTank.pt.uid);
          bp.parts.splice(idx + 1, 0, item);
        } else {
          bp.parts.push(item);
        }
        bp.version++;
        return bp;
      });
      setSelectedUid(uid);
      return;
    }

    const item: PlacedPart = {
      uid,
      partId,
      stage: defaultStage,
      symmetry: 1,
      mount: "center",
    };
    mutateBlueprint((bp) => {
      bp.version++;
      if (def.category === "pod") bp.parts.unshift(item);
      else bp.parts.push(item);
      return bp;
    });
    setSelectedUid(uid);
  }

  function startTrayDrag(e: ReactPointerEvent, partId: PartId) {
    const def = PARTS[partId];
    if (def.requiredLabLevel > limits.labLevel) {
      setNotice(`Requires Research Lab Lv ${def.requiredLabLevel}.`);
      return;
    }
    if (e.button !== 0 && e.pointerType === "mouse") return;
    setDrag({
      source: "tray",
      partId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
      snap: null,
      overTrash: false,
    });
  }

  function startCanvasDrag(e: ReactPointerEvent, pt: PlacedPart) {
    e.stopPropagation();
    if (e.button !== 0 && e.pointerType === "mouse") return;
    setDrag({
      source: "canvas",
      partId: pt.partId,
      uid: pt.uid,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
      snap: null,
      overTrash: false,
    });
  }

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur) return;
      const dist = Math.hypot(e.clientX - cur.startX, e.clientY - cur.startY);
      const isActive = cur.active || dist >= DRAG_THRESHOLD_PX;
      if (!isActive) return;
      const { snap, overTrash } = findBestSnap(
        e.clientX,
        e.clientY,
        cur.partId,
        cur.uid,
      );
      setDrag({
        ...cur,
        x: e.clientX,
        y: e.clientY,
        active: true,
        snap,
        overTrash,
      });
    };
    const onUp = () => {
      const cur = dragRef.current;
      setDrag(null);
      if (!cur) return;
      if (cur.active) {
        commitDrop(cur);
      } else if (cur.source === "tray") {
        addPart(cur.partId);
      } else if (cur.uid) {
        setSelectedUid(cur.uid);
      }
    };
    const onCancel = () => setDrag(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [Boolean(drag), layout, activeBp]);

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
      const nextStage = (item.stage + 1) % Math.max(2, limits.maxStages);
      item.stage = nextStage;
      // When moving legs/SRB/bracket to a new stage, re-anchor to a tank in that stage so it visibly moves there
      if (
        item.partId === "legs_mk1" ||
        item.partId === "srb_side" ||
        item.partId === "bracket_side"
      ) {
        const tankInStage = [...bp.parts]
          .reverse()
          .find(
            (x) =>
              x.stage === nextStage &&
              resolvePartMount(x) === "center" &&
              PARTS[x.partId]?.category === "tank",
          );
        if (tankInStage) item.parentUid = tankInStage.uid;
        else delete item.parentUid;
      }
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
      bp.parts = bp.parts.filter(
        (x) => x.uid !== selectedPart.uid && x.parentUid !== selectedPart.uid,
      );
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
    if (!pendingContract) return;
    if (!confirmed && m.mission.flight.status !== "pad") {
      setReplaceTarget({ useBlueprint });
      return;
    }
    const err =
      pendingContract.kind === "fixed"
        ? m.stageContract(
            pendingContract.job,
            useBlueprint ? activeBp.id : undefined,
            useBlueprint ? effectivePilotId || undefined : undefined,
          )
        : m.stageRotatingContract(
            pendingContract.offer,
            activeBp.id,
            effectivePilotId || undefined,
          );
    setReplaceTarget(null);
    if (err) setNotice(err);
  }

  const visibleParts = PART_IDS.filter((id) => PARTS[id].category === category);
  const canAffordReal =
    analysis.canLaunchWithLimits &&
    p.credits >= analysis.hardwareCost &&
    p.propellant >= analysis.propellantCost;

  // Contiguous vertical tank seam indicators
  const tankSeams = useMemo(() => {
    const seams: Array<{ x: number; y: number }> = [];
    for (let i = 1; i < layout.stackNodes.length; i++) {
      const prev = layout.stackNodes[i - 1];
      const cur = layout.stackNodes[i];
      if (
        prev.def.category === "tank" &&
        cur.def.category === "tank" &&
        prev.pt.stage === cur.pt.stage
      ) {
        seams.push({ x: Math.min(prev.x, cur.x) - 3, y: cur.y });
      }
    }
    return seams;
  }, [layout.stackNodes]);

  return (
    <main
      className={"game workshop-game" + (drag?.active ? " is-dragging" : "")}
      aria-label="Rocket Workshop"
    >
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

      {contractName && contractGoal && contractPayout && (
        <section className="vab-contract-banner" aria-label="Selected contract">
          <div className="vab-contract-info">
            <div className="vab-contract-head">
              <ClipboardList size={14} />
              <strong>{contractName}</strong>
              <span className="vab-contract-payout">
                +{contractPayout.credits.toLocaleString("en-US")} C · +{contractPayout.research} RD
              </span>
            </div>
            <p>{contractGoal}</p>
            {rotatingOffer && rotatingOffer.modifiers.length > 0 && (
              <div className="vab-mod-strip">
                {rotatingOffer.modifiers.map((mod) => (
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

      {!soundingGuide && lesson && !saveDialogOpen && (
        <MiloGuide dismissLabel="Dismiss design lesson" dismiss={dismissLesson}>
          {tutorial.workshop === "picker"
            ? "Your saved design is selected above. Open the dropdown to switch rockets."
            : "Like this design? Tap the save icon beside its name to keep a named copy."}
        </MiloGuide>
      )}

      <div className="vab-pilot-bar" aria-label="Pilot assignment">
        <UserCheck size={14} />
        {hasCrewedPod ? (
          <>
            <select
              aria-label="Assign pilot"
              value={effectivePilotId}
              onChange={(e) => setSelectedPilotId(e.target.value)}
            >
              <option value="">Uncrewed (No Pilot)</option>
              {readyPilots.map((owned) => {
                const def = PILOT_BY_ID[owned.id];
                if (!def) return null;
                return (
                  <option key={owned.id} value={owned.id}>
                    “{def.callsign}” {def.name} · Lv {owned.level} {RARITY_META[def.rarity].label}
                  </option>
                );
              })}
            </select>
            {seatedDef && seatedStats && (
              <span className="vab-pilot-bonus">
                +{(seatedStats.isp * 100).toFixed(1)}% Isp · +{(seatedStats.credits * 100).toFixed(1)}% C
                {seatedDef.perk ? ` · ${PERK_META[seatedDef.perk].label}` : ""}
              </span>
            )}
          </>
        ) : (
          <span className="vab-pilot-hint">Uncrewed probe — add Mk-1 Pod to seat a pilot</span>
        )}
      </div>

      <div className="vab-metrics" aria-label="Vehicle engineering readouts">
        <div className="vab-stat">
          <span>MASS</span>
          <strong className={analysis.wetTonnes > limits.maxMassTonnes ? "over-limit" : ""}>
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
          <strong className={analysis.partCount > limits.maxParts ? "over-limit" : ""}>
            {analysis.partCount}
            <small>/{limits.maxParts}</small>
          </strong>
        </div>
      </div>

      <section
        ref={canvasRef}
        className={"vab-stage-canvas" + (drag?.active ? " drag-active" : "")}
        aria-label="Rocket assembly bay"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${layout.svgW} ${layout.svgH}`}
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
          <rect width={layout.svgW} height={layout.svgH} fill="url(#vab-grid)" />
          <line
            x1={layout.cx}
            y1="10"
            x2={layout.cx}
            y2={layout.baseY}
            stroke="#72d6c62b"
            strokeDasharray="4 4"
          />

          {/* Pixel-art launchpad assembly stand matching FlightScene pad */}
          <g shapeRendering="crispEdges">
            <rect x={layout.cx - 116} y={layout.baseY} width="232" height="8" fill="#283643" />
            <rect x={layout.cx - 120} y={layout.baseY - 2} width="240" height="3" fill="#b8b2a1" />
            {[-88, -60, -32, 32, 60, 88].map((dx) => (
              <rect
                key={dx}
                x={layout.cx + dx - 4}
                y={layout.baseY + 1}
                width="8"
                height="2"
                fill="#d99357"
              />
            ))}
          </g>

          {/* Contiguous tank manifold connectors */}
          {tankSeams.map((s, i) => (
            <rect
              key={`seam-${i}`}
              x={s.x}
              y={s.y - 4}
              width="2"
              height="8"
              fill="#72d6c6"
              opacity="0.85"
              shapeRendering="crispEdges"
            />
          ))}

          {/* Centerline stack */}
          {layout.stackNodes.map(({ pt, def, cols, rows, x, y, w, h }) => {
            const isSel = pt.uid === selectedUid;
            const isUnfed = analysis.topology.unfedEngineUids.has(pt.uid);
            const isDragged = drag?.active && drag.uid === pt.uid;
            return (
              <g
                key={pt.uid}
                className={"svg-part" + (isDragged ? " dragging-origin" : "")}
                onPointerDown={(e) => startCanvasDrag(e, pt)}
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
                {isUnfed && (
                  <rect
                    x={x - 3}
                    y={y - 2}
                    width={w + 6}
                    height={h + 4}
                    fill="none"
                    stroke="#f07c6b"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                    shapeRendering="crispEdges"
                  />
                )}
                {isSel && !isUnfed && (
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
                {layout.bracketLayouts.length === 0 && (
                  <text
                    x={Math.max(x + w, layout.cx + layout.coreHalfW) + 12}
                    y={y + h / 2 + 3}
                    className={isSel ? "stage-tag active" : "stage-tag"}
                  >
                    S{pt.stage + 1} · {def.shortName}
                  </text>
                )}
              </g>
            );
          })}

          {/* Side brackets & their mirrored side-column stacks */}
          {layout.bracketLayouts.map((bl) => {
            const isBrSel = bl.pt.uid === selectedUid;
            const isBrDragged = drag?.active && drag.uid === bl.pt.uid;
            return (
              <g key={bl.pt.uid}>
                <g
                  className={"svg-part" + (isBrDragged ? " dragging-origin" : "")}
                  onPointerDown={(e) => startCanvasDrag(e, bl.pt)}
                >
                  {bl.pt.symmetry === 2 && (
                    <PixelRocketPart
                      partId="bracket_side"
                      x={bl.leftBrX}
                      y={bl.anchorY}
                      cols={bl.brSize.cols}
                      rows={bl.brSize.rows}
                      px={VAB_PX}
                      selected={isBrSel}
                      radialSide={-1}
                    />
                  )}
                  <PixelRocketPart
                    partId="bracket_side"
                    x={bl.rightBrX}
                    y={bl.anchorY}
                    cols={bl.brSize.cols}
                    rows={bl.brSize.rows}
                    px={VAB_PX}
                    selected={isBrSel}
                    radialSide={1}
                  />
                </g>

                {bl.childNodes.map((ch) => {
                  const isSel = ch.pt.uid === selectedUid;
                  const isUnfed = analysis.topology.unfedEngineUids.has(ch.pt.uid);
                  const isDragged = drag?.active && drag.uid === ch.pt.uid;
                  return (
                    <g
                      key={ch.pt.uid}
                      className={"svg-part" + (isDragged ? " dragging-origin" : "")}
                      onPointerDown={(e) => startCanvasDrag(e, ch.pt)}
                    >
                      {bl.pt.symmetry === 2 && (
                        <PixelRocketPart
                          partId={ch.pt.partId}
                          x={ch.leftX}
                          y={ch.y}
                          cols={ch.cols}
                          rows={ch.rows}
                          px={VAB_PX}
                          selected={isSel}
                        />
                      )}
                      <PixelRocketPart
                        partId={ch.pt.partId}
                        x={ch.rightX}
                        y={ch.y}
                        cols={ch.cols}
                        rows={ch.rows}
                        px={VAB_PX}
                        selected={isSel}
                      />
                      {isUnfed && (
                        <rect
                          x={ch.rightX - 3}
                          y={ch.y - 2}
                          width={ch.w + 6}
                          height={ch.h + 4}
                          fill="none"
                          stroke="#f07c6b"
                          strokeWidth="1.4"
                          strokeDasharray="3 2"
                          shapeRendering="crispEdges"
                        />
                      )}
                      <text
                        x={ch.rightX + ch.w + 8}
                        y={ch.y + ch.h / 2 + 3}
                        className={isSel ? "stage-tag active" : "stage-tag"}
                      >
                        S{ch.pt.stage + 1} · {bl.pt.symmetry}× {ch.def.shortName}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Standalone radial parts (stage-anchored Landing Legs & Side SRBs) */}
          {layout.radialLayouts.map(({ pt, def, cols, rows, w, h, y, leftX, rightX }) => {
            const isSel = pt.uid === selectedUid;
            const isDragged = drag?.active && drag.uid === pt.uid;
            return (
              <g
                key={pt.uid}
                className={"svg-part" + (isDragged ? " dragging-origin" : "")}
                onPointerDown={(e) => startCanvasDrag(e, pt)}
              >
                {pt.symmetry === 2 && (
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
                )}
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
                  S{pt.stage + 1} · {pt.symmetry}× {def.shortName}
                </text>
              </g>
            );
          })}

          {/* Live drag-and-drop snap indicator */}
          {drag?.active && drag.snap && (
            <g className="snap-indicator" pointerEvents="none">
              {drag.snap.kind === "tank-flank" ? (
                <rect
                  x={drag.snap.x - drag.snap.w / 2}
                  y={drag.snap.y - drag.snap.h / 2}
                  width={drag.snap.w}
                  height={drag.snap.h}
                  rx="2"
                  fill={drag.snap.valid ? "#72d6c644" : "#f07c6b44"}
                  stroke={drag.snap.valid ? "#72d6c6" : "#f07c6b"}
                  strokeWidth="1.6"
                  strokeDasharray="3 2"
                />
              ) : (
                <>
                  <line
                    x1={drag.snap.x - drag.snap.w / 2 - 6}
                    y1={drag.snap.y}
                    x2={drag.snap.x + drag.snap.w / 2 + 6}
                    y2={drag.snap.y}
                    stroke={drag.snap.valid ? "#72d6c6" : "#f07c6b"}
                    strokeWidth="2.5"
                  />
                  <circle
                    cx={drag.snap.x}
                    cy={drag.snap.y}
                    r="4"
                    fill={drag.snap.valid ? "#72d6c6" : "#f07c6b"}
                  />
                </>
              )}
              {drag.snap.reason && (
                <text
                  x={drag.snap.x}
                  y={Math.max(16, drag.snap.y - 10)}
                  textAnchor="middle"
                  className="snap-reason"
                >
                  {drag.snap.reason}
                </text>
              )}
            </g>
          )}
        </svg>

        {drag?.active && drag.source === "canvas" && (
          <div className={"vab-trash-zone" + (drag.overTrash ? " armed" : "")}>
            <Trash2 size={15} />
            <span>{drag.overTrash ? "Release to Remove Part" : "Drag outside bay to remove"}</span>
          </div>
        )}

        {!drag?.active && selectedPart && (
          <div className="part-toolbar" aria-label="Selected part controls">
            <span className="part-toolbar-name">
              {PARTS[selectedPart.partId].shortName} · S{selectedPart.stage + 1}
              {selectedTankGroup && selectedTankGroup.tankUids.length > 1
                ? ` · ${selectedTankGroup.fuelTonnes.toFixed(1)}t pool`
                : ""}
            </span>
            <button aria-label="Move part up" onClick={() => moveSelected(-1)}>
              <ArrowUp size={16} />
            </button>
            <button aria-label="Move part down" onClick={() => moveSelected(1)}>
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
                type="button"
                className={"part-card" + (locked ? " locked" : "")}
                aria-label={"Add " + def.name}
                onPointerDown={(e) => startTrayDrag(e, id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    addPart(id);
                  }
                }}
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
                      {def.propellantCost > 0 ? ` · ${def.propellantCost} P` : ""}
                    </em>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {drag?.active && (
        <div
          className={
            "vab-drag-ghost" +
            (drag.snap && !drag.snap.valid ? " invalid" : "") +
            (drag.overTrash ? " trash" : "")
          }
          style={{ left: drag.x, top: drag.y }}
          aria-hidden="true"
        >
          <PartPixelThumb partId={drag.partId} />
          <span>{PARTS[drag.partId].shortName}</span>
        </div>
      )}

      <footer className="vab-actions">
        {fixedJob === "sounding" ? (
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
              aria-label={`Fly ${contractName} with ${activeBp.name}`}
              disabled={Boolean(contractCheck?.error)}
              onClick={() => stageSelectedContract(true)}
            >
              <span>Fly Blueprint</span>
              <small className="vab-launch-price">
                <span>
                  <Coins />
                  {contractCheck?.vehicle?.hardwareCost ?? analysis.hardwareCost}
                </span>
                <span>
                  <Flame />
                  {contractCheck?.vehicle?.propellantCost ?? analysis.propellantCost}
                </span>
              </small>
            </button>
          </>
        ) : pendingContract ? (
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
              aria-label={`Fly ${contractName} with ${activeBp.name}`}
              disabled={Boolean(contractCheck?.error)}
              onClick={() => stageSelectedContract(true)}
            >
              <span>Fly Contract</span>
              <small className="vab-launch-price">
                <span>
                  <Coins />
                  {contractCheck?.vehicle?.hardwareCost ?? analysis.hardwareCost}
                </span>
                <span>
                  <Flame />
                  {contractCheck?.vehicle?.propellantCost ?? analysis.propellantCost}
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

      {replaceTarget && contractName && (
        <Dialog tone="warning" title="Replace flight?" close={() => setReplaceTarget(null)}>
          <p>
            Retire the active vehicle and stage{" "}
            {replaceTarget.useBlueprint ? activeBp.name : "the Sponsored Rocket"} for{" "}
            {contractName}?
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
          {lesson && (
            <MiloGuide dismissLabel="Dismiss design lesson" dismiss={dismissLesson}>
              {p.blueprints.length < MAX_BLUEPRINTS
                ? "Give the rocket a name and choose Save as New."
                : "All design slots are full. Update Current to keep changes to this design."}
            </MiloGuide>
          )}
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
