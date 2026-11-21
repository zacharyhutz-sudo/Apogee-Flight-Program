import {
  CONTRACTS,
  launchIssue,
  payLaunch,
  place,
  prepare,
  settle,
  upgrade,
  type Kind,
  type Sortie,
} from "../program/program";
import { useEffect, useRef, useState } from "react";
import {
  STEP,
  AIR,
  R,
  canWarp,
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
} from "../persistence/save";
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
  function install(data: Snapshot) {
    mission.current = data;
    vessel.current = data.flight;
    rate.current = 1;
    paused.current = data.flight.status === "flying";
    refresh();
  }
  function log(text: string) {
    const m = mission.current;
    m.log.push({ t: m.flight.t, text });
    m.log = m.log.slice(-64);
  }
  function save() {
    if (!ready.current) return;
    const m = mission.current;
    m.revision++;
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
  }
  function change(fn: (s: Flight) => void, msg?: string) {
    if (!ready.current) return;
    fn(vessel.current);
    if (msg) log(msg);
    if (!canWarp(vessel.current)) rate.current = 1;
    save();
    refresh();
  }
  function launch() {
    if (vessel.current.status !== "pad" || thrustToWeight(vessel.current) <= 1)
      return;
    if (!ready.current) return;
    const reason = payLaunch(mission.current.program);
    if (reason) {
      setNotice(reason);
      return;
    }
    change((s) => {
      s.status = "flying";
      paused.current = false;
    }, "Ignition confirmed. Pioneer 01 is in flight.");
  }
  function separate() {
    if (stage(vessel.current)) {
      if (!canWarp(vessel.current)) rate.current = 1;
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
    if (value !== 1 && !canWarp(vessel.current)) return;
    rate.current = value;
    refresh();
  }
  function newSortie(job: Sortie) {
    if (!ready.current) return false;
    const data = mission.current,
      issue = launchIssue(data.program, job);
    if (issue) {
      setNotice(issue);
      return false;
    }
    data.flight = prepare(data.program, job);
    data.log = [
      {
        t: 0,
        text:
          job === "practice"
            ? "Pioneer 01 cleared for flight."
            : CONTRACTS[job].name + " accepted.",
      },
    ];
    data.view = "flight";
    install(data);
    setNotice("");
    save();
    return true;
  }
  function reset() {
    newSortie("practice");
  }
  function editSite(kind: Kind, tile?: { x: number; y: number }) {
    if (!ready.current) return "Save is still loading.";
    const p = mission.current.program;
    const issue = tile ? place(p, kind, tile.x, tile.y) : upgrade(p, kind);
    if (!issue) {
      save();
      refresh();
    }
    return issue;
  }
  function visitSite() {
    if (!ready.current) return;
    if (vessel.current.status === "flying") paused.current = true;
    rate.current = 1;
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
        if (data) install(data);
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
        const startTime = s.t;
        const prevFuel = s.fuel[s.stage],
          wasOrbit = s.orbitEarned,
          wasAlt = s.maxAlt;
        acc += dt;
        while (acc + 1e-9 >= STEP && s.status === "flying") {
          if (rate.current > 1) {
            if (!coast(s, STEP * rate.current)) {
              rate.current = 1;
              log("Warp ended before atmospheric entry.");
            }
          } else if (canWarp(s)) {
            const before = s.t;
            // At ordinary speed integrate any remainder across the atmosphere boundary.
            if (!coast(s, STEP)) {
              const left = STEP - (s.t - before);
              if (left > 1e-8) step(s, left);
            }
          } else step(s);
          acc -= STEP;
        }
        dirty.current = true;
        program.elapsed += s.t - startTime;
        const reward = settle(program, s);
        let event = Boolean(reward);
        if (reward) {
          log(reward);
          setNotice(reward);
        }
        if (prevFuel > 0 && s.fuel[s.stage] === 0) {
          log(
            s.stage === 0
              ? "Booster depleted. Separate stage to continue."
              : "Orbital stage propellant depleted.",
          );
          event = true;
        }
        if (wasAlt < AIR && s.maxAlt >= AIR) {
          log("Crossed the 100 km atmospheric boundary.");
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
          program.elapsed += dt;
          dirty.current = true;
          if (now - saveAt >= 5000) {
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
      id = requestAnimationFrame(frame);
    }
    function suspend() {
      last = 0;
      acc = 0;
      if (dirty.current) save();
    }
    function visibility() {
      if (document.hidden) suspend();
      else last = 0;
    }
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", suspend);
    return () => {
      alive = false;
      cancelAnimationFrame(id);
      suspend();
      ready.current = false;
      releaseLock();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", suspend);
    };
  }, []);
  return {
    mission: mission.current,
    vessel,
    loaded,
    saveStatus,
    notice,
    setNotice,
    paused: paused.current,
    rate: rate.current,
    change,
    launch,
    separate,
    newSortie,
    editSite,
    visitSite,
    togglePause,
    warp,
    reset,
    restore,
    save,
    alt: Math.max(0, radius(vessel.current) - R),
  };
}
