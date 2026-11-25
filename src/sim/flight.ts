// SI throughout. All coordinates and velocities use an Earth-centred inertial frame.
// Spaceflight Simulator-inspired 1:20 scaled Earth: R = 315 km, 30 km atmosphere, 9.81 m/s^2 surface gravity.
export const R = 315000;
export const G0 = 9.80665;
export const MU = G0 * R * R;
export const AIR = 30000;
export const SCALE_HEIGHT = 3200;
export const MAX_ORBIT_AP = 600000;
export const CHUTE_MAX_SPEED = 200;
export const CHUTE_FULL_ALT = 100;
export const MID_WARP_ALT = 500_000;
export const HIGH_WARP_ALT = 1_500_000;
// SFS-scaled Moon: 85 km radius, 1.62 m/s^2 gravity, 2,400 km orbit, 480 km SOI, vacuum
export const MOON_R = 85000;
export const MOON_G0 = 1.62;
export const MOON_MU = MOON_G0 * MOON_R * MOON_R;
export const MOON_ORBIT_R = 2400000;
export const MOON_SOI = 480000;
export const MOON_OMEGA = Math.sqrt(MU / MOON_ORBIT_R ** 3);
export type Body = "earth" | "moon";

export function bodyParams(body: Body = "earth") {
  return body === "moon"
    ? { R: MOON_R, MU: MOON_MU, AIR: 0, name: "Moon" }
    : { R, MU, AIR, name: "Earth" };
}

export function moonPosition(simTimeSec: number) {
  // Start Moon at +55 deg ahead of North Pole so an eastbound LEO transfer intercepts cleanly
  const a = 0.96 + MOON_OMEGA * simTimeSec;
  const x = MOON_ORBIT_R * Math.cos(a);
  const y = MOON_ORBIT_R * Math.sin(a);
  const speedOrb = MOON_ORBIT_R * MOON_OMEGA;
  const vx = -speedOrb * Math.sin(a);
  const vy = speedOrb * Math.cos(a);
  return { x, y, vx, vy, angle: a };
}
export const STEP = 1 / 20;

export interface StageSpec {
  name: string;
  dry: number;
  fuel: number;
  thrust: number;
  isp: number;
  area: number;
}

export const STAGES: readonly [StageSpec, StageSpec] = [
  {
    name: "Booster",
    dry: 3200,
    fuel: 10500,
    thrust: 360000,
    isp: 285,
    area: 8,
  },
  {
    name: "Orbital stage",
    dry: 1400,
    fuel: 3600,
    thrust: 95000,
    isp: 345,
    area: 5,
  },
] as const;

const DEFAULT_PAYLOAD = 1200;

export type Mode = "manual" | "guide" | "prograde" | "retrograde";
export type Status = "pad" | "flying" | "landed" | "lost";

export interface FlightVisualPart {
  uid?: string;
  partId: string;
  stage: number;
  symmetry: 1 | 2;
  mount?: "center" | "side";
  parentUid?: string;
}

export interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  omega: number;
  mass: number;
  area: number;
  age: number;
  parts?: FlightVisualPart[];
}

export interface Flight {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  cargo: number;
  stage: 0 | 1;
  fuel: [number, number];
  throttle: number;
  pitch: number;
  mode: Mode;
  status: Status;
  orbitEarned: boolean;
  maxAlt: number;
  hasLegs?: boolean;
  hasChute?: boolean;
  legsDeployed?: boolean;
  chuteDeployed?: boolean;
  chuteRipped?: boolean;
  chuteMaxSpeed?: number;
  crashReason?: string;
  /** Active sphere of influence (Earth or Moon). */
  body?: Body;
  moonVisited?: boolean;
  /** Real simulated detached stages falling under gravity & drag. */
  debris?: Debris[];
  /** Optional custom stage specs constructed from a Rocket Workshop blueprint. */
  customStages?: [StageSpec, StageSpec];
  customPayload?: number;
  vehicleName?: string;
  blueprintParts?: FlightVisualPart[];
}

export function stagesOf(s: Flight): readonly [StageSpec, StageSpec] {
  return s.customStages ?? STAGES;
}

export function payloadOf(s: Flight): number {
  return s.customPayload !== undefined ? s.customPayload : DEFAULT_PAYLOAD;
}

/** Checks whether a part is still attached on the active or upper stages (not jettisoned). */
export function hasActivePart(s: Flight, partId: string): boolean {
  if (!s.blueprintParts) {
    if (partId === "legs_mk1") return s.hasLegs !== false;
    if (partId === "chute_mk1") return s.hasChute !== false;
    return false;
  }
  return s.blueprintParts.some((p) => p.partId === partId && p.stage >= s.stage);
}

/** Returns local radial (vr, +up/-down) and tangential (vt, +east/-west) surface speeds in m/s. */
export function surfaceVelocity(s: Flight): { vr: number; vt: number } {
  const r = radius(s) || bodyParams(s.body).R;
  const nx = s.x / r;
  const ny = s.y / r;
  return {
    vr: nx * s.vx + ny * s.vy,
    vt: nx * s.vy - ny * s.vx,
  };
}

/** Returns current safe touchdown limits (m/s and degrees) based on active deployed landing legs. */
export function landingLimits(s: Flight) {
  const legsActive = Boolean(s.legsDeployed && hasActivePart(s, "legs_mk1"));
  return {
    legsActive,
    maxVr: legsActive ? 15 : 6,
    maxVt: legsActive ? 10 : 5,
    maxTilt: legsActive ? 30 : 18,
  };
}

export function initial(
  customStages?: [StageSpec, StageSpec],
  customPayload?: number,
  vehicleName?: string,
  blueprintParts?: FlightVisualPart[],
): Flight {
  const st = customStages ?? STAGES;
  const f: Flight = {
    x: R,
    y: 0,
    vx: 0,
    vy: 0,
    t: 0,
    cargo: 0,
    stage: 0,
    fuel: [st[0].fuel, st[1].fuel],
    throttle: 1,
    pitch: 0,
    mode: "manual",
    status: "pad",
    orbitEarned: false,
    maxAlt: 0,
    hasLegs: true,
    hasChute: true,
    legsDeployed: false,
    chuteDeployed: false,
    chuteRipped: false,
    body: "earth",
    moonVisited: false,
  };
  if (customStages) f.customStages = customStages;
  if (customPayload !== undefined) f.customPayload = customPayload;
  if (vehicleName) f.vehicleName = vehicleName;
  if (blueprintParts) {
    f.blueprintParts = blueprintParts.map((p) => ({
      ...(p.uid ? { uid: p.uid } : {}),
      partId: p.partId,
      stage: p.stage,
      symmetry: p.symmetry,
      ...(p.mount ? { mount: p.mount } : {}),
      ...(p.parentUid ? { parentUid: p.parentUid } : {}),
    }));
    f.hasLegs = hasActivePart(f, "legs_mk1");
    f.hasChute = hasActivePart(f, "chute_mk1");
  }
  return f;
}

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
export const radius = (s: { x: number; y: number }) => Math.hypot(s.x, s.y);
export const speed = (s: { vx: number; vy: number }) => Math.hypot(s.vx, s.vy);

/** World-space thrust unit vector (tx, ty) in inertial frame (+x north, +y east). */
export function headingVector(s: Flight) {
  const r = radius(s) || R;
  const nx = s.x / r,
    ny = s.y / r;
  const theta = (s.pitch * Math.PI) / 180;
  const tx = nx * Math.cos(theta) - ny * Math.sin(theta);
  const ty = ny * Math.cos(theta) + nx * Math.sin(theta);
  return { tx, ty, angle: Math.atan2(ty, tx) };
}

export function mass(s: Flight) {
  const st = stagesOf(s);
  return (
    payloadOf(s) +
    s.cargo +
    st[1].dry +
    s.fuel[1] +
    (s.stage === 0 ? st[0].dry + s.fuel[0] : 0)
  );
}

export function thrustToWeight(s: Flight) {
  const st = stagesOf(s);
  const thrust = s.fuel[s.stage] > 0 ? st[s.stage].thrust * s.throttle : 0;
  const bp = bodyParams(s.body);
  return thrust / ((mass(s) * bp.MU) / radius(s) ** 2);
}

export function deltaV(s: Flight) {
  const st = stagesOf(s);
  const pay = payloadOf(s);
  const upperDry = pay + s.cargo + st[1].dry;
  const upper =
    st[1].fuel > 0 && st[1].thrust > 0 && upperDry > 0
      ? st[1].isp * G0 * Math.log((upperDry + s.fuel[1]) / upperDry)
      : 0;
  const lower =
    s.stage === 0 && s.fuel[0] > 0 && st[0].thrust > 0
      ? st[0].isp * G0 * Math.log(mass(s) / (mass(s) - s.fuel[0]))
      : 0;
  return upper + lower;
}

export function orbit(s: Flight) {
  const bp = bodyParams(s.body);
  const r = radius(s),
    v = speed(s),
    dot = s.x * s.vx + s.y * s.vy;
  const h = s.x * s.vy - s.y * s.vx;
  const ex = ((v * v - bp.MU / r) * s.x - dot * s.vx) / bp.MU,
    ey = ((v * v - bp.MU / r) * s.y - dot * s.vy) / bp.MU;
  const e = Math.hypot(ex, ey),
    p = (h * h) / bp.MU;
  const a = 1 / (2 / r - (v * v) / bp.MU);
  return {
    e,
    a,
    p,
    h,
    arg: Math.atan2(ey, ex),
    pe: p / (1 + e) - bp.R,
    ap: a > 0 ? a * (1 + e) - bp.R : Infinity,
  };
}

export function stable(s: Flight) {
  const o = orbit(s);
  if (s.body === "moon") return o.pe >= 3000 && o.ap <= MOON_SOI * 0.9;
  return o.pe >= AIR && o.ap <= MAX_ORBIT_AP;
}

export function hasUpperStage(s: Flight) {
  return stagesOf(s)[1].thrust > 0;
}

export function stage(s: Flight) {
  if (s.status !== "flying" || s.stage !== 0 || !hasUpperStage(s)) return false;
  const st = stagesOf(s);
  const { tx, ty, angle } = headingVector(s);
  const sepSpeed = 5.5;
  const boosterMass = Math.max(200, st[0].dry + s.fuel[0]);
  const piece: Debris = {
    x: s.x - tx * 14,
    y: s.y - ty * 14,
    vx: s.vx - tx * sepSpeed - ty * 0.45,
    vy: s.vy - ty * sepSpeed + tx * 0.45,
    angle,
    omega: 0.32,
    mass: boosterMass,
    area: st[0].area,
    age: 0,
    parts: s.blueprintParts?.filter((p) => p.stage === 0),
  };
  s.debris = [...(s.debris ?? []), piece].slice(-4);
  s.stage = 1;
  s.fuel[0] = 0;
  if (s.blueprintParts) {
    s.hasLegs = hasActivePart(s, "legs_mk1");
    s.hasChute = hasActivePart(s, "chute_mk1");
    if (!s.hasLegs) s.legsDeployed = false;
    if (!s.hasChute) s.chuteDeployed = false;
  }
  return true;
}

export function toggleLegs(s: Flight) {
  if (!hasActivePart(s, "legs_mk1")) return false;
  s.legsDeployed = !s.legsDeployed;
  return true;
}

export function toggleChute(s: Flight): "deployed" | "ripped" | "cut" | "blocked" {
  if (!hasActivePart(s, "chute_mk1")) return "blocked";
  if (s.status !== "flying" || s.chuteRipped) return "blocked";
  const bp = bodyParams(s.body);
  const alt = radius(s) - bp.R;
  if (s.chuteDeployed) {
    s.chuteDeployed = false;
    return "cut";
  }
  if (bp.AIR <= 0 || alt >= bp.AIR) return "blocked";
  if (speed(s) > (s.chuteMaxSpeed ?? CHUTE_MAX_SPEED)) {
    s.chuteRipped = true;
    s.chuteDeployed = false;
    return "ripped";
  }
  s.chuteDeployed = true;
  s.throttle = 0;
  s.mode = "manual";
  s.pitch = 0;
  return "deployed";
}

export function density(alt: number) {
  return alt >= AIR ? 0 : 1.225 * Math.exp(-Math.max(0, alt) / SCALE_HEIGHT);
}

export function burning(s: Flight) {
  const st = stagesOf(s);
  return (
    s.status === "flying" &&
    s.throttle > 0 &&
    s.fuel[s.stage] > 0 &&
    st[s.stage].thrust > 0
  );
}

export function canWarp(s: Flight) {
  const bp = bodyParams(s.body);
  return s.status === "flying" && !burning(s) && radius(s) > bp.R + bp.AIR + 500;
}

export function canMidWarp(s: Flight) {
  const bp = bodyParams(s.body);
  return canWarp(s) && radius(s) - bp.R >= MID_WARP_ALT;
}

export function canHighWarp(s: Flight) {
  const bp = bodyParams(s.body);
  return canWarp(s) && radius(s) - bp.R >= HIGH_WARP_ALT;
}

export function canChuteWarp(s: Flight) {
  return s.status === "flying" && Boolean(s.chuteDeployed) && !burning(s);
}

export function alignToVelocity(_s: Flight) {
  // All flight attitude controls are strictly manual.
}

export function stepDebris(s: Flight, dt: number) {
  if (!s.debris || !s.debris.length || dt <= 0) return;
  const keep: Debris[] = [];
  for (const d of s.debris) {
    const r = radius(d);
    if (r <= R || d.age > 3600) continue;
    const alt = r - R;
    const v = speed(d);
    const nx = d.x / r,
      ny = d.y / r;
    const grav = MU / (r * r);
    const drag = (0.5 * density(alt) * 0.42 * d.area * v) / Math.max(100, d.mass);
    const ax = -nx * grav - drag * d.vx;
    const ay = -ny * grav - drag * d.vy;
    d.x += d.vx * dt + (ax * dt * dt) / 2;
    d.y += d.vy * dt + (ay * dt * dt) / 2;
    d.vx += ax * dt;
    d.vy += ay * dt;
    d.angle += d.omega * dt;
    d.age += dt;
    if (radius(d) > R) keep.push(d);
  }
  s.debris = keep.length ? keep : undefined;
}

export function checkSoiTransition(s: Flight, simTimeSec: number): Body | null {
  if (s.status !== "flying") return null;
  const m = moonPosition(simTimeSec);
  if (s.body !== "moon") {
    const dx = s.x - m.x;
    const dy = s.y - m.y;
    if (Math.hypot(dx, dy) <= MOON_SOI) {
      s.body = "moon";
      s.moonVisited = true;
      s.x = dx;
      s.y = dy;
      s.vx -= m.vx;
      s.vy -= m.vy;
      return "moon";
    }
  } else if (radius(s) > MOON_SOI * 1.04) {
    s.body = "earth";
    s.x += m.x;
    s.y += m.y;
    s.vx += m.vx;
    s.vy += m.vy;
    return "earth";
  }
  return null;
}

export function step(s: Flight, dt = STEP) {
  if (s.status !== "flying") return;
  const st = stagesOf(s);
  const bp = bodyParams(s.body);
  const r = radius(s),
    alt = r - bp.R,
    v = speed(s),
    nx = s.x / r,
    ny = s.y / r;
  const vr = nx * s.vx + ny * s.vy,
    vt = nx * s.vy - ny * s.vx;
  const engine = st[s.stage];
  if (s.chuteDeployed) {
    if (v > (s.chuteMaxSpeed ?? CHUTE_MAX_SPEED)) {
      s.chuteRipped = true;
      s.chuteDeployed = false;
    } else {
      // Parachute hangs strictly opposite gravity (+radial), locking vehicle pitch to 0
      s.mode = "manual";
      s.pitch = 0;
    }
  }
  // All launch and flight controls are strictly manual
  s.mode = "manual";
  const used =
    engine.thrust > 0
      ? Math.min(
          s.fuel[s.stage],
          (engine.thrust * s.throttle * dt) / (engine.isp * G0),
        )
      : 0;
  const midMass = mass(s) - used / 2;
  const thrustAcc =
    used > 0 ? (used * engine.isp * G0) / (dt * midMass) : 0;
  const theta = (s.pitch * Math.PI) / 180,
    grav = bp.MU / (r * r);
  const atmoDensity = bp.AIR > 0 ? density(alt) : 0;
  const chuteFull = Boolean(s.chuteDeployed && bp.AIR > 0 && alt <= CHUTE_FULL_ALT);
  const chuteHalf = Boolean(s.chuteDeployed && bp.AIR > 0 && alt > CHUTE_FULL_ALT && alt < bp.AIR);
  const chuteDragFactor = chuteFull
    ? midMass * 0.16
    : chuteHalf && atmoDensity > 0
      ? midMass * ((0.00125 * 1.225) / Math.max(0.04, atmoDensity))
      : 0;
  const rawDrag =
    (0.5 * atmoDensity * (0.32 * engine.area + chuteDragFactor) * v) / midMass;
  // Cap per-step drag damping so stiff full-canopy drag never oscillates numerically
  const drag = Math.min(rawDrag, 0.45 / dt);
  const ax =
    (nx * Math.cos(theta) - ny * Math.sin(theta)) * thrustAcc -
    nx * grav -
    drag * s.vx;
  const ay =
    (ny * Math.cos(theta) + nx * Math.sin(theta)) * thrustAcc -
    ny * grav -
    drag * s.vy;
  s.x += s.vx * dt + (ax * dt * dt) / 2;
  s.y += s.vy * dt + (ay * dt * dt) / 2;
  s.vx += ax * dt;
  s.vy += ay * dt;
  s.t += dt;
  s.fuel[s.stage] -= used;
  const nextR = radius(s);
  if (s.body !== "moon") s.maxAlt = Math.max(s.maxAlt, nextR - bp.R);
  if (nextR <= bp.R) {
    const { maxVr, maxVt, maxTilt } = landingLimits(s);
    const vrOk = Math.abs(vr) < maxVr;
    const vtOk = Math.abs(vt) < maxVt;
    const tiltOk = Math.abs(s.pitch) < maxTilt;
    if (vrOk && vtOk && tiltOk) {
      s.status = "landed";
      s.crashReason = undefined;
    } else {
      s.status = "lost";
      const reasons: string[] = [];
      if (!vrOk) reasons.push(`vertical ${Math.abs(vr).toFixed(1)} m/s (max ${maxVr})`);
      if (!vtOk) reasons.push(`lateral ${Math.abs(vt).toFixed(1)} m/s (max ${maxVt})`);
      if (!tiltOk) reasons.push(`tilt ${Math.abs(Math.round(s.pitch))}° (max ${maxTilt}°)`);
      s.crashReason = `Hard impact: ${reasons.join(", ")}.`;
    }
    s.x *= bp.R / nextR;
    s.y *= bp.R / nextR;
    s.vx = 0;
    s.vy = 0;
    s.throttle = 0;
    s.chuteDeployed = false;
  }
  if (!s.orbitEarned && s.body !== "moon" && stable(s)) s.orbitEarned = true;
  stepDebris(s, dt);
  checkSoiTransition(s, s.t);
}
