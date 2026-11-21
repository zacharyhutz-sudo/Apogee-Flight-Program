import { R, STAGES, initial, radius, type Flight } from "../sim/flight.ts";
export interface Entry {
  t: number;
  text: string;
}
export interface Snapshot {
  version: 1;
  revision: number;
  view: "flight" | "map";
  flight: Flight;
  log: Entry[];
}
export const fresh = (): Snapshot => ({
  version: 1,
  revision: 0,
  view: "flight",
  flight: initial(),
  log: [{ t: 0, text: "Pioneer 01 cleared for flight." }],
});
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
export function validate(raw: unknown): Snapshot {
  const invalid = () => {
    throw Error("This file is not a valid Apogee v1 flight save.");
  };
  if (
    !record(raw) ||
    raw.version !== 1 ||
    !num(raw.revision, 0, Number.MAX_SAFE_INTEGER) ||
    !Number.isSafeInteger(raw.revision) ||
    !["flight", "map"].includes(String(raw.view)) ||
    !Array.isArray(raw.log) ||
    raw.log.length > 64 ||
    !record(raw.flight)
  )
    return invalid();
  const f = raw.flight as unknown as Flight;
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
    !f.fuel.every((v, i) => num(v, 0, STAGES[i].fuel)) ||
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
      f.fuel.some((v, i) => v !== STAGES[i].fuel) ||
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
  return structuredClone(raw) as unknown as Snapshot;
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
// A synchronous lifecycle checkpoint covers a mobile browser suspending an IDB transaction.
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
