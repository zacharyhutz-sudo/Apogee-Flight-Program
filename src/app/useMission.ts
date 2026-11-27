import {
  CONTRACTS,
  applyOfflineProgress,
  collectFromBuilding,
  boostFacility,
  exchangeNovaShard,
  type StoreResource,
  abandonActivePilot,
  assignPilotDuty,
  completeFinishedUpgrades,
  contractVehicle,
  ensureRotatingBoard,
  hasRotatingContracts,
  launchIssue,
  payLaunch,
  place,
  prepare,
  prepareBlueprintFlight,
  prepareContractBlueprint,
  prepareRotatingContractBlueprint,
  prepareSoundingBlueprint,
  pullPilotCard,
  reclaimTile,
  recoverStrandedPilot,
  rerollRotatingBoard,
  resolvePilotFlightOutcome,
  clearObstacle,
  settle,
  tickEconomy,
  upgrade,
  type DutyStation,
  type Job,
  type Kind,
  type RotatingContract,
  type Sortie,
} from "../program/program";
import type { RocketBlueprint } from "../program/workshop";
import { buildOrUpgradeLunar, collectLunar, type LunarKind } from "../program/lunar";
import { useEffect, useRef, useState } from "react";
import {
  STEP,
  AIR,
  MOON_R,
  bodyParams,
  canChuteWarp,
  canMidWarp,
  canHighWarp,
  canWarp,
  hasUpperStage,
  thrustToWeight,
  radius,
  stage,
  step,
  type Flight,
} from "../sim/flight";
import { coast } from "../sim/coast";
import {
  checkpoint,
  fresh,
  readSave,
  writeSave,
  type Snapshot,
  type Tutorial,
} from "../persistence/save";
import {
  getCloudSession,
  pullCloudSave,
  pushCloudSave,
  signInEmail,
  signOutCloudSession,
  signUpEmail,
} from "../persistence/cloud";

export type PendingContract =
  | { kind: "fixed"; job: Job }
  | { kind: "rotating"; offer: RotatingContract };

export function useMission() {
  const mission = useRef(fresh()),
    vessel = useRef<Flight>(mission.current.flight);
  const rate = useRef(1),
    paused = useRef(false),
    ready = useRef(false),
    dirty = useRef(false);
  const [loaded, load] = useState(false),
    [saveStatus, setSaveStatus] = useState("Opening save");
  const [, paint] = useState(0),
    refresh = () => paint((v) => v + 1);
  const [notice, setNotice] = useState("");
  const [pendingContract, setPendingContract] = useState<PendingContract | null>(null);
  const [cloudEmail, setCloudEmail] = useState<string | null>(
    () => getCloudSession()?.email ?? null,
  );
  const [cloudStatus, setCloudStatus] = useState<string>(() =>
    getCloudSession() ? "Cloud ready" : "Local only",
  );
  const [cloudBusy, setCloudBusy] = useState(false);
  const lastCloudPushAt = useRef(0);

  function install(data: Snapshot) {
    mission.current = data;
    vessel.current = data.flight;
    rate.current = 1;
    paused.current = data.flight.status === "flying";
    refresh();
  }

  function log(text: string) {
    const m = mission.current;
    m.log.push({ t: m.flight.t, text: text.slice(0, 180) });
    m.log = m.log.slice(-64);
  }

  function save() {
    if (!ready.current) return;
    const m = mission.current;
    m.revision++;
    m.program.lastRealTimestampMs = Date.now();
    dirty.current = false;
    const copy = structuredClone(m);
    let journal = true;
    try {
      checkpoint(copy);
    } catch {
      journal = false;
    }
    void writeSave(copy)
      .then(() => {
        if (mission.current.revision === copy.revision)
          setSaveStatus("Saved locally");
      })
      .catch(() =>
        setSaveStatus(journal ? "Backup saved" : "Save unavailable"),
      );
    const nowMs = Date.now();
    if (getCloudSession() && nowMs - lastCloudPushAt.current >= 15000) {
      lastCloudPushAt.current = nowMs;
      void pushCloudSave(copy)
        .then(() => setCloudStatus("Cloud synced"))
        .catch(() => setCloudStatus("Cloud offline"));
    }
  }

  async function syncCloudNow(): Promise<string> {
    if (!getCloudSession()) return "Sign in first to sync.";
    setCloudBusy(true);
    setCloudStatus("Syncing...");
    try {
      const remote = await pullCloudSave();
      const local = mission.current;
      if (remote && remote.revision > local.revision) {
        const offline = applyOfflineProgress(remote.snapshot.program, Date.now());
        remote.snapshot.program = offline.state;
        install(remote.snapshot);
        save();
        setCloudStatus("Cloud synced");
        setNotice("Loaded newer cloud save.");
        return "Loaded newer cloud save.";
      }
      lastCloudPushAt.current = Date.now();
      await pushCloudSave(structuredClone(local));
      setCloudStatus("Cloud synced");
      return "Cloud save up to date.";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Cloud sync failed.";
      setCloudStatus("Sync error");
      return msg;
    } finally {
      setCloudBusy(false);
    }
  }

  async function signInCloud(email: string, password: string): Promise<string> {
    setCloudBusy(true);
    try {
      const session = await signInEmail(email, password);
      setCloudEmail(session.email);
      setCloudStatus("Syncing...");
      const syncMsg = await syncCloudNow();
      return syncMsg;
    } catch (err) {
      return err instanceof Error ? err.message : "Sign-in failed.";
    } finally {
      setCloudBusy(false);
    }
  }

  async function signUpCloud(email: string, password: string): Promise<string> {
    setCloudBusy(true);
    try {
      const res = await signUpEmail(email, password);
      if (res.session) {
        setCloudEmail(res.session.email);
        await syncCloudNow();
      }
      return res.message;
    } catch (err) {
      return err instanceof Error ? err.message : "Sign-up failed.";
    } finally {
      setCloudBusy(false);
    }
  }

  async function signOutCloud(): Promise<void> {
    setCloudBusy(true);
    try {
      await signOutCloudSession();
      setCloudEmail(null);
      setCloudStatus("Local only");
    } finally {
      setCloudBusy(false);
    }
  }

  function change(fn: (s: Flight) => void, msg?: string) {
    if (!ready.current) return;
    fn(vessel.current);
    if (msg) log(msg);
    if (rate.current >= 500 && !canHighWarp(vessel.current)) rate.current = canMidWarp(vessel.current) ? 100 : canWarp(vessel.current) ? 20 : 1;
    if (rate.current >= 100 && !canMidWarp(vessel.current)) rate.current = canWarp(vessel.current) ? 20 : 1;
    if (rate.current > 1 && !canWarp(vessel.current) && !(rate.current === 3 && canChuteWarp(vessel.current))) rate.current = 1;
    save();
    refresh();
  }

  function updateTutorial(patch: Partial<Tutorial>) {
    if (!ready.current) return;
    Object.assign(mission.current.tutorial, patch);
    save();
    refresh();
  }

  function collectFacility(kind: Kind) {
    if (!ready.current)
      return { collected: 0, resource: null as "credits" | "propellant" | null, reason: "" };
    const res = collectFromBuilding(mission.current.program, kind);
    if (res.collected > 0) {
      if (kind === "foundry") mission.current.tutorial.collectionTip = false;
      save();
      refresh();
    } else if (res.reason) {
      setNotice(res.reason);
    }
    return res;
  }

  function launch() {
    if (vessel.current.status !== "pad" || thrustToWeight(vessel.current) <= 1)
      return;
    if (!ready.current) return;
    const prog = mission.current.program;
    const { credits, propellant } = prog;
    const reason = payLaunch(prog);
    if (reason) {
      setNotice(reason);
      return;
    }
    const costNote = prog.sortie === "practice"
      ? `${vessel.current.vehicleName || "Vehicle"} ignition.`
      : `Ignition · −${(credits - prog.credits).toLocaleString("en-US")} C · −${(propellant - prog.propellant).toLocaleString("en-US")} Prop`;
    change((s) => {
      s.status = "flying";
      paused.current = false;
    }, costNote);
  }

  function launchFreeSim() {
    if (!ready.current) return;
    const data = mission.current;
    if (data.program.sortie !== "practice" || vessel.current.status !== "pad") {
      const customSounding =
        (data.program.soundingVehicle || data.program.contractVehicle) &&
        vessel.current.status === "pad";
      data.flight = prepare(
        data.program,
        "practice",
        customSounding ? vessel.current : undefined,
      );
      data.log = [{ t: 0, text: "Free simulation ready (0 cost · 0 payout)." }];
      data.view = "flight";
      install(data);
      setNotice("");
      save();
    }
    if (thrustToWeight(vessel.current) > 1) {
      change((s) => {
        s.status = "flying";
        paused.current = false;
      }, "Free simulation ignition (0 cost · 0 payout).");
    }
  }

  function openWorkshop(contract?: PendingContract) {
    if (!ready.current) return;
    if (vessel.current.status === "flying") paused.current = true;
    rate.current = 1;
    setPendingContract(contract ?? null);
    change(() => {
      mission.current.view = "workshop";
    });
  }

  function refreshRotatingBoard() {
    if (!ready.current) return;
    if (!hasRotatingContracts(mission.current.program)) return;
    ensureRotatingBoard(mission.current.program, Date.now());
    save();
    refresh();
  }

  function rerollContracts(): string {
    if (!ready.current) return "Save is still loading.";
    const err = rerollRotatingBoard(mission.current.program, Date.now());
    if (!err) {
      save();
      refresh();
    }
    return err;
  }

  function pullPilot() {
    if (!ready.current) return { result: null, error: "Save is still loading." };
    const res = pullPilotCard(mission.current.program);
    if (!res.error) {
      save();
      refresh();
    }
    return res;
  }

  function setPilotDuty(pilotId: string, station?: DutyStation): string {
    if (!ready.current) return "Save is still loading.";
    const err = assignPilotDuty(mission.current.program, pilotId, station);
    if (!err) {
      save();
      refresh();
    }
    return err;
  }

  function recoverPilot(pilotId: string): string {
    if (!ready.current) return "Save is still loading.";
    const err = recoverStrandedPilot(mission.current.program, pilotId);
    if (!err) {
      save();
      refresh();
    }
    return err;
  }

  function stageContract(job: Job, blueprintId?: string, pilotId?: string): string {
    if (!ready.current) return "Save is still loading.";
    const data = mission.current;
    const abandonNote = abandonActivePilot(data.program);
    if (blueprintId) {
      const result = prepareContractBlueprint(data.program, job, blueprintId, pilotId);
      if (!result.flight) return result.error || "Unable to stage vehicle.";
      data.flight = result.flight;
      data.log = [
        {
          t: 0,
          text: `${result.flight.vehicleName ?? CONTRACTS[job].name} staged for ${CONTRACTS[job].name}.`.slice(0, 180),
        },
      ];
      data.view = "flight";
      setPendingContract(null);
      install(data);
      setNotice(abandonNote);
      save();
      return "";
    }
    const issue = launchIssue(
      data.program,
      job,
      job === "sounding" ? contractVehicle(data.program, job) : undefined,
    );
    if (issue) return issue;
    if (!newSortie(job)) return "Unable to stage contract.";
    setPendingContract(null);
    if (abandonNote) setNotice(abandonNote);
    return "";
  }

  function stageRotatingContract(
    offer: RotatingContract,
    blueprintId: string,
    pilotId?: string,
  ): string {
    if (!ready.current) return "Save is still loading.";
    const data = mission.current;
    const abandonNote = abandonActivePilot(data.program);
    const result = prepareRotatingContractBlueprint(data.program, offer, blueprintId, pilotId);
    if (!result.flight) return result.error || "Unable to stage vehicle.";
    data.flight = result.flight;
    data.log = [
      {
        t: 0,
        text: `${result.flight.vehicleName ?? offer.name} staged for ${offer.name}.`.slice(0, 180),
      },
    ];
    data.view = "flight";
    setPendingContract(null);
    install(data);
    setNotice(abandonNote);
    save();
    return "";
  }

  function selectBlueprint(id: string) {
    if (!ready.current) return;
    const p = mission.current.program;
    if (!p.blueprints.some((b) => b.id === id)) return;
    p.activeBlueprintId = id;
    save();
    refresh();
  }

  function saveBlueprint(bp: RocketBlueprint, selectNew = false): boolean {
    if (!ready.current) return false;
    const p = mission.current.program;
    const idx = p.blueprints.findIndex((b) => b.id === bp.id);
    if (idx >= 0) p.blueprints[idx] = bp;
    else if (p.blueprints.length < 16) p.blueprints.push(bp);
    else return false;
    if (selectNew || idx < 0) p.activeBlueprintId = bp.id;
    save();
    refresh();
    return true;
  }

  function deleteBlueprint(id: string): boolean {
    if (!ready.current) return false;
    const p = mission.current.program;
    if (p.blueprints.length <= 1) return false;
    const idx = p.blueprints.findIndex((b) => b.id === id);
    if (idx < 0) return false;
    p.blueprints.splice(idx, 1);
    if (p.activeBlueprintId === id) {
      p.activeBlueprintId = p.blueprints[Math.max(0, idx - 1)].id;
    }
    save();
    refresh();
    return true;
  }

  function launchBlueprint(id: string, mode: "practice" | "real"): string {
    if (!ready.current) return "Save is still loading.";
    const data = mission.current;
    const res = prepareBlueprintFlight(data.program, id, mode);
    if (res.error || !res.flight) return res.error || "Unable to stage vehicle.";
    data.flight = res.flight;
    data.log = [
      {
        t: 0,
        text:
          mode === "real"
            ? `${res.flight.vehicleName} rolled to pad (−${res.hardwareCost} C · −${res.propellantCost} Prop).`
            : `${res.flight.vehicleName} staged for free simulation.`,
      },
    ];
    data.view = "flight";
    install(data);
    setNotice("");
    save();
    return "";
  }

  function separate() {
    if (stage(vessel.current)) {
      if (rate.current >= 500 && !canHighWarp(vessel.current)) rate.current = canMidWarp(vessel.current) ? 100 : canWarp(vessel.current) ? 20 : 1;
      if (rate.current >= 100 && !canMidWarp(vessel.current)) rate.current = canWarp(vessel.current) ? 20 : 1;
    if (rate.current > 1 && !canWarp(vessel.current) && !(rate.current === 3 && canChuteWarp(vessel.current))) rate.current = 1;
      if (mission.current.program.sortie === "hop" && mission.current.tutorial.status !== "off")
        mission.current.tutorial.stagingSeen = true;
      log("Booster separated. Orbital stage selected.");
      save();
      refresh();
    }
  }

  function togglePause() {
    if (vessel.current.status !== "flying") return;
    paused.current = !paused.current;
    rate.current = 1;
    save();
    refresh();
  }

  function warp(value: number) {
    if (value === 3 && vessel.current.chuteDeployed && vessel.current.status === "flying") {
      vessel.current.throttle = 0;
    }
    const chuteAllowed = value === 3 && canChuteWarp(vessel.current);
    if (value >= 500 && !canHighWarp(vessel.current)) return;
    if (value >= 100 && !canMidWarp(vessel.current)) return;
    if (value !== 1 && !canWarp(vessel.current) && !chuteAllowed) return;
    if (value > 1 && mission.current.program.warpAlert) {
      setNotice(mission.current.program.warpAlert);
      return;
    }
    rate.current = value;
    refresh();
  }

  function newSortie(job: Job | "practice", soundingBlueprintId = "") {
    if (!ready.current) return false;
    const data = mission.current;
    const abandonNote = abandonActivePilot(data.program);
    if (job === "sounding" && soundingBlueprintId) {
      const result = prepareSoundingBlueprint(data.program, soundingBlueprintId);
      if (!result.flight) {
        setNotice(result.error);
        return false;
      }
      data.flight = result.flight;
    } else {
      const issue = launchIssue(
        data.program,
        job,
        job === "sounding" ? contractVehicle(data.program, job) : undefined,
      );
      if (issue) {
        setNotice(issue);
        return false;
      }
      data.flight = prepare(data.program, job);
    }
    data.log = [
      {
        t: 0,
        text:
          job === "practice"
            ? "Free simulation ready (0 cost · 0 payout)."
            : `${data.flight.vehicleName ?? CONTRACTS[job].name} staged on pad.`.slice(0, 180),
      },
    ];
    data.view = "flight";
    install(data);
    setNotice(abandonNote);
    save();
    return true;
  }

  function reset() {
    newSortie("practice");
  }

  function editSite(
    kind: Kind,
    tile?: { x: number; y: number },
    fromTile?: { x: number; y: number } | null,
    upgradeTile?: { x: number; y: number } | null,
  ) {
    if (!ready.current) return "Save is still loading.";
    const p = mission.current.program;
    const issue = tile
      ? place(p, kind, tile.x, tile.y, fromTile)
      : upgrade(p, kind, upgradeTile);
    if (!issue) {
      save();
      refresh();
    }
    return issue;
  }

  function useShard(action: StoreResource | { x: number; y: number }) {
    if (!ready.current) return "Save is still loading.";
    const program = mission.current.program;
    const message = typeof action === "string"
      ? exchangeNovaShard(program, action)
      : boostFacility(program, action);
    save();
    refresh();
    return message;
  }

  function improveTerrain(x: number, y: number, action: "clear" | "reclaim") {
    if (!ready.current) return "Save is still loading.";
    const p = mission.current.program;
    const issue = action === "clear" ? clearObstacle(p, x, y) : reclaimTile(p, x, y);
    if (!issue) {
      save();
      refresh();
    }
    return issue;
  }

  function openLunar() {
    if (!ready.current || !mission.current.program.lunar.unlocked) return;
    if (vessel.current.status === "flying") paused.current = true;
    rate.current = 1;
    change(() => {
      mission.current.view = "lunar";
    });
  }

  function collectLunarFacility(kind: LunarKind) {
    if (!ready.current) return "";
    const p = mission.current.program;
    const res = collectLunar(p.lunar, kind);
    if (res.researchGained > 0) p.research += res.researchGained;
    if (res.text) {
      save();
      refresh();
    }
    return res.text;
  }

  function upgradeLunarFacility(kind: LunarKind) {
    if (!ready.current) return "Save is still loading.";
    const err = buildOrUpgradeLunar(mission.current.program.lunar, kind);
    if (!err) {
      save();
      refresh();
    }
    return err;
  }

  function launchFromMoon() {
    if (!ready.current) return;
    const data = mission.current;
    const f = prepare(data.program, "practice");
    f.body = "moon";
    f.x = MOON_R;
    f.y = 0;
    f.moonVisited = true;
    data.flight = f;
    data.log = [{ t: 0, text: "Lunar Refuel Pad launch ready." }];
    data.view = "flight";
    install(data);
    save();
  }

  function visitSite() {
    if (!ready.current) return;
    // Milo has already read this payout in flight. Clear its duplicate before
    // the Earth scene puts a tappable collector badge beneath the toast.
    const { program, tutorial } = mission.current;
    if (tutorial.status === "active" && program.sortie === "sounding" && program.rewarded)
      setNotice(current => current.startsWith(CONTRACTS.sounding.name + " complete") ? "" : current);
    if (vessel.current.status === "flying") paused.current = true;
    rate.current = 1;
    setPendingContract(null);
    change(() => {
      mission.current.view = "site";
    });
  }

  function restore(data: Snapshot) {
    data.revision = mission.current.revision;
    install(data);
    save();
    setNotice("Flight restored from backup.");
  }

  useEffect(() => {
    let alive = true,
      id = 0,
      last = 0,
      acc = 0,
      paintAt = 0,
      saveAt = 0,
      releaseLock = () => {};

    async function start() {
      try {
        const data = await readSave();
        if (!alive) return;
        if (data) {
          const offline = applyOfflineProgress(data.program, Date.now());
          data.program = offline.state;
          install(data);
          if (offline.creditsAdded >= 5 || offline.propellantAdded >= 5) {
            setNotice(
              "Collectors filled while away — tap Solar Foundry or Refinery to collect.",
            );
          }
        } else {
          mission.current.program.lastRealTimestampMs = Date.now();
        }
        setSaveStatus(data ? "Saved locally" : "Local save ready");
      } catch {
        if (!alive) return;
        setSaveStatus("Save unavailable");
        setNotice(
          "Could not open the previous save. Export a backup from Mission data while flying.",
        );
      }
      ready.current = true;
      load(true);
      if (getCloudSession()) {
        void syncCloudNow();
      }
      id = requestAnimationFrame(frame);
    }

    if (navigator.locks) {
      void navigator.locks
        .request(
          "apogee-flight:" + location.pathname.replace(/index\.html$/, ""),
          { ifAvailable: true },
          async (lock) => {
            if (!alive) return;
            if (!lock) {
              setSaveStatus("Open in another tab");
              setNotice(
                "Close the other flight tab, then reload this tab to take control.",
              );
              return;
            }
            const hold = new Promise<void>((r) => {
              releaseLock = r;
            });
            await start();
            await hold;
          },
        )
        .catch(() => {
          if (alive) void start();
        });
    } else void start();

    function frame(now: number) {
      if (!alive) return;
      const dt = last ? Math.min((now - last) / 1000, 0.25) : 0;
      last = now;
      const s = vessel.current;
      const program = mission.current.program;
      if (!document.hidden && !paused.current && s.status === "flying") {
        const prevFuel = s.fuel[s.stage],
          wasOrbit = s.orbitEarned,
          wasAlt = s.maxAlt;
        acc += dt;
        while (acc + 1e-9 >= STEP && s.status === "flying") {
          if (rate.current > 1 && canChuteWarp(s)) {
            for (let k = 0; k < rate.current && s.status === "flying" && canChuteWarp(s); k++) {
              step(s);
            }
            if (!canChuteWarp(s)) rate.current = 1;
          } else if (rate.current > 1) {
            if (rate.current >= 500 && !canHighWarp(s)) {
              rate.current = canMidWarp(s) ? 100 : canWarp(s) ? 20 : 1;
              log("Warp stepped down below 1,500 km.");
            }
            if (rate.current >= 100 && !canMidWarp(s)) {
              rate.current = canWarp(s) ? 20 : 1;
              log("Warp stepped down below 500 km.");
            }
            if (rate.current > 1 && !coast(s, STEP * rate.current)) {
              rate.current = 1;
              log("Warp ended before atmospheric entry.");
            } else if (rate.current >= 500 && !canHighWarp(s)) {
              rate.current = canMidWarp(s) ? 100 : canWarp(s) ? 20 : 1;
              log("Warp stepped down below 1,500 km.");
            } else if (rate.current >= 100 && !canMidWarp(s)) {
              rate.current = canWarp(s) ? 20 : 1;
              log("Warp stepped down below 500 km.");
            }
          } else if (canWarp(s)) {
            const before = s.t;
            if (!coast(s, STEP)) {
              const left = STEP - (s.t - before);
              if (left > 1e-8) step(s, left);
            }
          } else step(s);
          acc -= STEP;
        }
        dirty.current = true;
        tickEconomy(program, dt);
        if (completeFinishedUpgrades(program, Date.now()) > 0) {
          save();
          refresh();
        }
        if (program.warpAlert && rate.current > 1) {
          rate.current = 1;
          log(program.warpAlert);
          setNotice(program.warpAlert);
        }
        const reward = settle(program, s);
        let event = Boolean(reward);
        if (reward) {
          log(reward);
          setNotice(reward);
        }
        if (prevFuel > 0 && s.fuel[s.stage] === 0) {
          log(
            !hasUpperStage(s)
              ? "Propellant depleted."
              : s.stage === 0
                ? "Booster depleted. Separate stage to continue."
                : "Orbital stage propellant depleted.",
          );
          event = true;
        }
        if (wasAlt < AIR && s.maxAlt >= AIR) {
          log("Crossed the 30 km atmospheric boundary.");
          event = true;
        }
        if (!wasOrbit && s.orbitEarned) {
          log("Low Earth orbit achieved.");
          event = true;
        }
        if (s.status !== "flying") {
          log(
            s.status === "lost"
              ? "Surface impact. Vehicle lost."
              : "Soft touchdown confirmed.",
          );
          const pilotMsg = resolvePilotFlightOutcome(program, s);
          if (pilotMsg) {
            log(pilotMsg);
            setNotice(reward ? `${reward} · ${pilotMsg}` : pilotMsg);
          }
          rate.current = 1;
          event = true;
        }
        if (event || now - saveAt >= 1500) {
          save();
          saveAt = now;
        }
        if (event) refresh();
      } else {
        acc = 0;
        if (!document.hidden && !paused.current && s.status !== "flying") {
          tickEconomy(program, dt);
          const doneUpgrades = completeFinishedUpgrades(program, Date.now());
          dirty.current = true;
          if (doneUpgrades > 0) {
            setNotice("Facility upgrade complete!");
            save();
            refresh();
            saveAt = now;
          } else if (now - saveAt >= 5000) {
            save();
            saveAt = now;
          }
        }
      }
      if (
        !paused.current &&
        (s.status === "flying" || dirty.current) &&
        now - paintAt >= (s.status === "flying" ? 100 : 1000)
      ) {
        refresh();
        paintAt = now;
      }
      if (paused.current && mission.current.view === "site" && !document.hidden && now - paintAt >= 1000) {
        if (completeFinishedUpgrades(program, Date.now()) > 0) save();
        refresh();
        paintAt = now;
      }
      id = requestAnimationFrame(frame);
    }

    function catchUpBackground() {
      if (!ready.current) return;
      const res = applyOfflineProgress(mission.current.program, Date.now());
      mission.current.program = res.state;
      if (res.creditsAdded > 0 || res.propellantAdded > 0) {
        save();
        refresh();
      }
    }
    function suspend() {
      last = 0;
      acc = 0;
      if (ready.current) {
        mission.current.program.lastRealTimestampMs = Date.now();
        save();
        if (getCloudSession()) {
          lastCloudPushAt.current = Date.now();
          void pushCloudSave(structuredClone(mission.current)).catch(() => {});
        }
      }
    }
    function visibility() {
      if (document.hidden) suspend();
      else {
        last = 0;
        catchUpBackground();
      }
    }
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", catchUpBackground);
    window.addEventListener("blur", suspend);
    window.addEventListener("pagehide", suspend);
    return () => {
      alive = false;
      cancelAnimationFrame(id);
      suspend();
      ready.current = false;
      releaseLock();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", catchUpBackground);
      window.removeEventListener("blur", suspend);
      window.removeEventListener("pagehide", suspend);
    };
  }, []);

  return {
    mission: mission.current,
    vessel,
    loaded,
    saveStatus,
    cloudEmail,
    cloudStatus,
    cloudBusy,
    signInCloud,
    signUpCloud,
    signOutCloud,
    syncCloudNow,
    notice,
    setNotice,
    paused: paused.current,
    rate: rate.current,
    change,
    collectFacility,
    updateTutorial,
    launch,
    launchFreeSim,
    openWorkshop,
    pendingContract,
    clearPendingContract: () => setPendingContract(null),
    stageContract,
    stageRotatingContract,
    refreshRotatingBoard,
    rerollContracts,
    pullPilot,
    setPilotDuty,
    recoverPilot,
    selectBlueprint,
    saveBlueprint,
    deleteBlueprint,
    launchBlueprint,
    separate,
    newSortie,
    editSite,
    useShard,
    improveTerrain,
    openLunar,
    collectLunarFacility,
    upgradeLunarFacility,
    launchFromMoon,
    visitSite,
    togglePause,
    warp,
    reset,
    restore,
    save,
    alt: Math.max(0, radius(vessel.current) - bodyParams(vessel.current.body).R),
  };
}
