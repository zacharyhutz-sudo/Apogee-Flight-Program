import {
  CONTRACTS,
  FACILITIES,
  MAX_LEVEL,
  SIZE,
  STARTER_KINDS,
  getStorageCaps,
  placement,
  startProgram,
  syncBuildingLevels,
  validProgram,
  type Building,
  type Kind,
  type Program,
} from "../program/program.ts";
import { starterBlueprints } from "../program/workshop.ts";
import {
  R,
  clamp,
  initial,
  radius,
  stagesOf,
  type Flight,
} from "../sim/flight.ts";

export interface Entry {
  t: number;
  text: string;
}

export interface Snapshot {
  version: 5;
  program: Program;
  revision: number;
  view: "flight" | "map" | "site" | "workshop";
  flight: Flight;
  log: Entry[];
}

export const fresh = (): Snapshot => ({
  version: 5,
  program: startProgram(),
  revision: 0,
  view: "site",
  flight: initial(),
  log: [{ t: 0, text: "Pioneer 01 cleared for flight." }],
});

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

function findFreePlot(p: Program, kind: Kind): { x: number; y: number } {
  const def = FACILITIES[kind].defaultPos;
  if (!placement(p, kind, def.x, def.y)) return { x: def.x, y: def.y };
  for (let y = 1; y < SIZE; y++)
    for (let x = 1; x < SIZE; x++)
      if (!placement(p, kind, x, y)) return { x, y };
  return { x: def.x, y: def.y };
}

function backfillStarterFacilities(p: Program) {
  const seen = new Set(p.buildings.map((b) => b.kind));
  for (const kind of STARTER_KINDS) {
    if (!seen.has(kind)) {
      const pos = findFreePlot(p, kind);
      p.buildings.push({ kind, x: pos.x, y: pos.y, level: 1 });
      seen.add(kind);
    }
  }
  p.buildingLevels = syncBuildingLevels(p.buildings);
}

function migrateV2Program(rawProg: unknown, f: Flight): Program | null {
  if (!record(rawProg)) return null;
  const base = startProgram();
  base.buildings = [];

  const oldCredits =
    typeof rawProg.credits === "number" &&
    Number.isSafeInteger(rawProg.credits) &&
    rawProg.credits >= 0
      ? rawProg.credits
      : null;
  const oldResearch =
    typeof rawProg.research === "number" &&
    Number.isSafeInteger(rawProg.research) &&
    rawProg.research >= 0
      ? rawProg.research
      : null;
  const oldElapsed =
    typeof rawProg.elapsed === "number" &&
    Number.isFinite(rawProg.elapsed) &&
    rawProg.elapsed >= 0
      ? rawProg.elapsed
      : null;

  if (oldCredits === null || oldResearch === null || oldElapsed === null)
    return null;

  if (!Array.isArray(rawProg.buildings)) return null;
  const seen = new Set<Kind>();
  const kindMap: Record<string, Kind> = {
    command: "command",
    pad: "pad",
    fuel: "tanks",
    lab: "lab",
  };

  for (const item of rawProg.buildings) {
    if (!record(item)) return null;
    const mapped = kindMap[String(item.kind)];
    if (!mapped || seen.has(mapped)) return null;
    const lv = Number(item.level);
    const x = Number(item.x);
    const y = Number(item.y);
    if (
      !Number.isSafeInteger(lv) ||
      lv < 1 ||
      lv > MAX_LEVEL ||
      !Number.isInteger(x) ||
      !Number.isInteger(y)
    )
      return null;
    const b: Building = { kind: mapped, x, y, level: lv };
    if (placement(base, mapped, x, y)) return null;
    base.buildings.push(b);
    seen.add(mapped);
  }

  backfillStarterFacilities(base);

  const caps = getStorageCaps(base);
  base.credits = clamp(oldCredits, 0, caps.credits);
  base.propellant = clamp(900, 0, caps.propellant);
  base.research = oldResearch;
  base.simTimeSec = oldElapsed;
  base.elapsed = oldElapsed;

  if (record(rawProg.completed)) {
    const hopDone = Number(rawProg.completed.hop ?? 0);
    const orbitDone = Number(rawProg.completed.orbit ?? 0);
    if (
      !Number.isSafeInteger(hopDone) ||
      hopDone < 0 ||
      !Number.isSafeInteger(orbitDone) ||
      orbitDone < 0
    )
      return null;
    base.completed.hop = hopDone;
    base.completed.orbit = orbitDone;
    base.milestones.firstKarman = hopDone > 0;
    base.milestones.firstOrbit = orbitDone > 0;
  }

  const oldSortie = String(rawProg.sortie ?? "practice");
  if (oldSortie === "hop" || oldSortie === "orbit") {
    base.sortie = oldSortie;
    base.paid = Boolean(rawProg.paid) && f.status !== "pad";
    base.rewarded = Boolean(rawProg.rewarded) && base.paid;
    if (base.paid) {
      const c = CONTRACTS[oldSortie];
      base.award = {
        credits: c.credits,
        research: c.research,
        milestoneBonus: 0,
      };
      if (!base.rewarded) base.activeContracts = [oldSortie];
    }
    f.cargo = CONTRACTS[oldSortie].cargo;
  } else {
    base.sortie = "practice";
    base.paid = false;
    base.rewarded = false;
    base.award = null;
    f.cargo = 0;
  }
  base.inclination = 0;
  base.leoPassStartSec = null;
  base.warpAlert = "";
  return base;
}

export function validate(raw: unknown): Snapshot {
  const invalid = (): never => {
    throw Error("This file is not a valid Apogee flight save.");
  };
  if (
    !record(raw) ||
    ![1, 2, 3, 4, 5].includes(Number(raw.version)) ||
    !num(raw.revision, 0, Number.MAX_SAFE_INTEGER) ||
    !Number.isSafeInteger(raw.revision) ||
    !(
      raw.version === 1
        ? ["flight", "map"]
        : Number(raw.version) >= 4
          ? ["flight", "map", "site", "workshop"]
          : ["flight", "map", "site"]
    ).includes(String(raw.view)) ||
    !Array.isArray(raw.log) ||
    raw.log.length > 64 ||
    !record(raw.flight)
  )
    return invalid();

  const f = structuredClone(raw.flight) as unknown as Flight;
  if (raw.version === 1) f.cargo = 0;

  const st = stagesOf(f);
  if (
    ![0, 1].includes(f.stage) ||
    !["manual", "guide", "prograde", "retrograde"].includes(f.mode) ||
    !["pad", "flying", "landed", "lost"].includes(f.status) ||
    typeof f.orbitEarned !== "boolean" ||
    !num(f.pitch, -360, 360) ||
    !num(f.throttle, 0, 1) ||
    !num(f.t, 0, 1e14) ||
    !num(f.maxAlt, 0, 1e19) ||
    ![f.x, f.y].every((v) => num(v, -1e19, 1e19)) ||
    ![f.vx, f.vy].every((v) => num(v, -1e7, 1e7)) ||
    radius(f) < R - 0.01 ||
    !Array.isArray(f.fuel) ||
    f.fuel.length !== 2 ||
    !f.fuel.every((v, i) => num(v, 0, st[i].fuel)) ||
    (f.stage === 1 && f.fuel[0] !== 0)
  )
    return invalid();

  if (
    f.status === "pad" &&
    (f.t !== 0 ||
      f.stage !== 0 ||
      f.x !== R ||
      f.y !== 0 ||
      f.vx !== 0 ||
      f.vy !== 0 ||
      f.fuel.some((v, i) => v !== st[i].fuel) ||
      f.orbitEarned)
  )
    return invalid();

  if (
    raw.log.some(
      (e) =>
        !record(e) ||
        !num(e.t, 0, f.t + 0.01) ||
        typeof e.text !== "string" ||
        e.text.length > 180,
    )
  )
    return invalid();

  let program: unknown;
  if (raw.version === 1) {
    program = { ...startProgram(), simTimeSec: f.t, elapsed: f.t };
  } else if (raw.version === 2) {
    program = migrateV2Program(raw.program, f);
  } else {
    program = structuredClone(raw.program);
    if (record(program) && Array.isArray(program.buildings)) {
      if (
        typeof program.elapsed !== "number" &&
        typeof program.simTimeSec === "number"
      ) {
        program.elapsed = program.simTimeSec;
      }
      if (Number(raw.version) <= 3 || !Array.isArray(program.blueprints)) {
        const defaults = starterBlueprints();
        program.blueprints = defaults;
        program.activeBlueprintId = defaults[0].id;
      }
      if (Number(raw.version) <= 4) {
        if (!record(program.collectors)) {
          program.collectors = { credits: 0, propellant: 0 };
        }
        if (typeof program.lastRealTimestampMs !== "number") {
          program.lastRealTimestampMs = 0;
        }
        backfillStarterFacilities(program as unknown as Program);
      } else {
        program.buildingLevels = syncBuildingLevels(
          program.buildings as Building[],
        );
      }
    }
  }

  if (!validProgram(program, f)) return invalid();

  return {
    version: 5,
    program,
    flight: f,
    view: raw.view as Snapshot["view"],
    log: structuredClone(raw.log) as Entry[],
    revision: Number(raw.revision),
  };
}

const scope = () => new URL(".", document.baseURI).pathname;
const key = () => "apogee-v1:" + scope();
let db: Promise<IDBDatabase> | undefined;

function openDB() {
  return (db ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(key(), 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("missions");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      db = undefined;
      reject(req.error);
    };
  }));
}

export async function writeSave(data: Snapshot) {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("missions", "readwrite");
    tx.objectStore("missions").put(data, "active");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function checkpoint(data: Snapshot) {
  localStorage.setItem(key(), JSON.stringify(data));
}

export async function readSave(): Promise<Snapshot | null> {
  let fallback: Snapshot | undefined, fallbackError: unknown;
  try {
    const txt = localStorage.getItem(key());
    if (txt) fallback = validate(JSON.parse(txt));
  } catch (e) {
    fallbackError = e;
  }
  try {
    const db = await openDB();
    const raw = await new Promise<unknown>((resolve, reject) => {
      const req = db
        .transaction("missions")
        .objectStore("missions")
        .get("active");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const stored = raw ? validate(raw) : null;
    if (!stored && !fallback && fallbackError) throw fallbackError;
    return fallback && (!stored || fallback.revision > stored.revision)
      ? fallback
      : stored;
  } catch (e) {
    if (fallback) return fallback;
    throw e;
  }
}
