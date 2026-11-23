import { useState } from "react";
import {
  Building2,
  Droplets,
  Flame,
  FlaskConical,
  Gem,
  Globe,
  Rocket,
  Sun,
  TriangleAlert,
  Zap,
} from "lucide-react";
import {
  LUNAR_FACILITIES,
  LUNAR_KINDS,
  lunarCaps,
  lunarLevel,
  lunarPowerBalance,
  type LunarKind,
} from "../program/lunar";
import type { useMission } from "./useMission";

const icons: Record<LunarKind, typeof Sun> = {
  hub: Building2,
  solar: Sun,
  extractor: Gem,
  isru: Flame,
  refuel: Rocket,
  science: FlaskConical,
};

export function LunarSite({
  mission: m,
  onEarth,
}: {
  mission: ReturnType<typeof useMission>;
  onEarth: () => void;
}) {
  const c = m.mission.program.lunar;
  const pwr = lunarPowerBalance(c);
  const caps = lunarCaps(c);
  const [msg, setMsg] = useState("");

  function handleCollect(k: LunarKind) {
    const txt = m.collectLunarFacility(k);
    if (txt) setMsg(`Collected ${txt}`);
  }

  function handleUpgrade(k: LunarKind) {
    const err = m.upgradeLunarFacility(k);
    setMsg(err || `${LUNAR_FACILITIES[k].shortName} upgraded!`);
  }

  const canMoonLaunch = lunarLevel(c, "refuel") >= 1;

  return (
    <main className="game lunar-game" aria-label="Lunar Outpost">
      <header className="lunar-top">
        <button
          className="insignia"
          aria-label="Return to Earth base"
          title="Earth Base"
          onClick={onEarth}
        >
          <Globe />
        </button>
        <div className="lunar-res-bar" aria-label="Lunar colony resources">
          <div className="l-pill ore" title="Exotic Ore">
            <Gem size={14} />
            <strong>{Math.floor(c.exoticOre)}</strong>
            <small>/{caps.ore}</small>
          </div>
          <div className="l-pill ice" title="Water Ice">
            <Droplets size={14} />
            <strong>{Math.floor(c.waterIce)}</strong>
            <small>/{caps.ice}</small>
          </div>
          <div className="l-pill prop" title="Lunar Propellant">
            <Flame size={14} />
            <strong>{Math.floor(c.propellant)}</strong>
            <small>/{caps.propellant}</small>
          </div>
          <div
            className={"l-pill pwr" + (pwr.net < 0 ? " deficit" : "")}
            title="Power Balance"
          >
            <Zap size={14} />
            <strong>{pwr.net >= 0 ? `+${pwr.net}` : pwr.net}</strong>
          </div>
        </div>
      </header>

      {pwr.net < 0 && (
        <div className="lunar-alert" role="alert">
          <TriangleAlert size={15} />
          Power deficit! Build or upgrade Lunar Solar Array.
        </div>
      )}

      {msg && (
        <div className="lunar-toast" role="status">
          {msg}
        </div>
      )}

      <section className="lunar-grid" aria-label="Lunar Outpost facilities">
        {LUNAR_KINDS.map((k) => {
          const def = LUNAR_FACILITIES[k];
          const lv = lunarLevel(c, k);
          const Icon = icons[k];
          const nextCost = lv < 4 ? def.costs[lv] : null;
          const pDelta = def.powerDelta[Math.max(0, lv - 1)];
          const hopperReady =
            k === "extractor"
              ? Math.floor(c.hoppers.ore) >= 1 || Math.floor(c.hoppers.ice) >= 1
              : k === "isru"
                ? Math.floor(c.hoppers.propellant) >= 1
                : k === "science"
                  ? Math.floor(c.hoppers.research) >= 1
                  : false;
          const hopperLabel =
            k === "extractor"
              ? `+${Math.floor(c.hoppers.ore)} Ore · +${Math.floor(c.hoppers.ice)} Ice`
              : k === "isru"
                ? `+${Math.floor(c.hoppers.propellant)} Prop`
                : k === "science"
                  ? `+${Math.floor(c.hoppers.research)} RD`
                  : "";

          return (
            <article
              key={k}
              className={"lunar-card" + (lv === 0 ? " unbuilt" : "")}
            >
              <div className="lunar-card-head">
                <div className="lunar-card-title">
                  <Icon size={18} />
                  <div>
                    <h3>{def.name}</h3>
                    <small>{def.role}</small>
                  </div>
                </div>
                <span className="lv-badge">
                  {lv > 0 ? `Lv ${lv}/4` : "Unbuilt"}
                </span>
              </div>

              <div className="lunar-card-meta">
                <span className={pDelta >= 0 ? "pwr-pos" : "pwr-neg"}>
                  {pDelta >= 0 ? `+${pDelta} PWR` : `${pDelta} PWR`}
                </span>
                {hopperReady && (
                  <button
                    className="collect-chip"
                    onClick={() => handleCollect(k)}
                  >
                    Tap {hopperLabel}
                  </button>
                )}
              </div>

              {nextCost && (
                <button
                  className="primary lunar-upg-btn"
                  disabled={
                    c.exoticOre < nextCost.ore ||
                    c.waterIce < nextCost.ice ||
                    (k !== "hub" && lv + 1 > lunarLevel(c, "hub"))
                  }
                  onClick={() => handleUpgrade(k)}
                >
                  {lv === 0 ? "Build" : "Upgrade"} · {nextCost.ore} Ore
                  {nextCost.ice > 0 ? ` + ${nextCost.ice} Ice` : ""}
                </button>
              )}
            </article>
          );
        })}
      </section>

      <footer className="lunar-dock">
        <button onClick={onEarth}>
          <Globe size={16} />
          Earth Base
        </button>
        <button
          className="primary"
          disabled={!canMoonLaunch}
          onClick={m.launchFromMoon}
        >
          <Rocket size={16} />
          {canMoonLaunch ? "Launch from Moon" : "Build Moon Pad"}
        </button>
      </footer>
    </main>
  );
}
