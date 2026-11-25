import { useState } from "react";
import { Coins, Flame, ShieldAlert, Sparkles, Star, Users } from "lucide-react";
import {
  MAX_PILOT_LEVEL,
  PERK_META,
  PILOT_BY_ID,
  PILOT_CATALOG,
  PILOT_PULL_COST,
  PITY_LEGENDARY_AT,
  PITY_RARE_AT,
  RARITY_META,
  crewDutyBonus,
  ensureCrew,
  pilotRecoveryFee,
  pilotStats,
  xpForLevel,
  type DutyStation,
  type OwnedPilot,
  type PilotRarity,
  type PullResult,
} from "../program/program";
import type { useMission } from "./useMission";

const RARITY_ORDER: Record<PilotRarity, number> = {
  legendary: 5,
  epic: 4,
  rare: 3,
  uncommon: 2,
  common: 1,
};

const DUTY_LABELS: Array<{ id: DutyStation; label: string; effect: string }> = [
  { id: "foundry", label: "Solar Foundry", effect: "+C/hr" },
  { id: "lab", label: "Research Lab", effect: "+RD" },
  { id: "office", label: "Contract Office", effect: "−Cooldown" },
];

export function CrewModal({ mission: m }: { mission: ReturnType<typeof useMission> }) {
  const p = m.mission.program;
  const crew = ensureCrew(p);
  const [filter, setFilter] = useState<"all" | "ready" | "stranded" | "high">("all");
  const [lastPull, setLastPull] = useState<PullResult | null>(null);
  const [notice, setNotice] = useState("");

  const rareIn = Math.max(1, PITY_RARE_AT - crew.pullsSinceRare);
  const legIn = Math.max(1, PITY_LEGENDARY_AT - crew.pullsSinceLegendary);
  const canPull = p.credits >= PILOT_PULL_COST;

  function doPull() {
    const res = m.pullPilot();
    if (res.error) {
      setNotice(res.error);
      return;
    }
    setNotice("");
    if (res.result) setLastPull(res.result);
  }

  function handleRecover(pilotId: string) {
    const err = m.recoverPilot(pilotId);
    setNotice(err);
  }

  function handleDuty(pilotId: string, station?: DutyStation) {
    const err = m.setPilotDuty(pilotId, station);
    setNotice(err);
  }

  const sortedPilots = [...crew.pilots]
    .filter((owned) => {
      const def = PILOT_BY_ID[owned.id];
      if (!def) return false;
      if (filter === "ready") return owned.status === "ready";
      if (filter === "stranded") return owned.status === "stranded";
      if (filter === "high") return def.rarity === "epic" || def.rarity === "legendary";
      return true;
    })
    .sort((a, b) => {
      const da = PILOT_BY_ID[a.id];
      const db = PILOT_BY_ID[b.id];
      const rd = (RARITY_ORDER[db?.rarity ?? "common"] ?? 0) - (RARITY_ORDER[da?.rarity ?? "common"] ?? 0);
      if (rd !== 0) return rd;
      if (b.level !== a.level) return b.level - a.level;
      return b.stars - a.stars;
    });

  return (
    <div className="crew-modal">
      <section className="crew-recruit-bar">
        <div className="crew-recruit-info">
          <strong>
            <Users size={15} /> Pilot Recruitment ({crew.pilots.length}/{PILOT_CATALOG.length})
          </strong>
          <small>
            Rare+ guaranteed in {rareIn} · Legendary in {legIn}
          </small>
        </div>
        <button
          type="button"
          className="primary crew-pull-btn"
          disabled={!canPull}
          onClick={doPull}
        >
          <Sparkles size={15} />
          Pull Card · {PILOT_PULL_COST.toLocaleString("en-US")} C
        </button>
      </section>

      {notice && (
        <p className="lock-note" role="alert">
          {notice}
        </p>
      )}

      {lastPull && (
        <section
          className={"crew-reveal rarity-" + lastPull.pilot.rarity}
          aria-live="polite"
        >
          <div
            className="pilot-avatar"
            style={{
              background: lastPull.pilot.suitColor,
              borderColor: RARITY_META[lastPull.pilot.rarity].color,
            }}
          >
            <span className="pilot-visor" style={{ background: lastPull.pilot.visorColor }} />
          </div>
          <div className="crew-reveal-body">
            <div className="crew-reveal-head">
              <span
                className="rarity-pill"
                style={{ color: RARITY_META[lastPull.pilot.rarity].color }}
              >
                {RARITY_META[lastPull.pilot.rarity].label}
              </span>
              <strong>
                {lastPull.pilot.name} · “{lastPull.pilot.callsign}”
              </strong>
              <span className="star-row">
                {Array.from({ length: lastPull.owned.stars }, (_, i) => (
                  <Star key={i} size={11} fill="currentColor" />
                ))}
              </span>
            </div>
            <p>{lastPull.pilot.bio}</p>
            <small>
              {lastPull.isDuplicate
                ? `${lastPull.starPromoted ? `Promoted to ★${lastPull.owned.stars}! ` : ""}+${lastPull.xpAwarded} XP${lastPull.leveledUp ? ` · Lv ${lastPull.owned.level}!` : ""}`
                : `New recruit joined your roster · ${lastPull.pilot.role}`}
              {lastPull.pilot.perk
                ? ` · Perk: ${PERK_META[lastPull.pilot.perk].label}`
                : ""}
            </small>
          </div>
        </section>
      )}

      <section className="duty-strip" aria-label="Base Duty Assignments">
        {DUTY_LABELS.map((st) => {
          const assigned = crew.pilots.find((x) => x.status === "ready" && x.duty === st.id);
          const def = assigned ? PILOT_BY_ID[assigned.id] : null;
          const pct = Math.round(crewDutyBonus(crew, st.id) * 100);
          return (
            <div className="duty-slot" key={st.id}>
              <span>{st.label}</span>
              <strong>{def ? def.callsign : "Open"}</strong>
              <small>{pct > 0 ? `${st.effect} ${pct}%` : "Assign idle pilot"}</small>
            </div>
          );
        })}
      </section>

      <div className="crew-filters" role="tablist" aria-label="Filter pilots">
        {(
          [
            ["all", `All (${crew.pilots.length})`],
            ["ready", `Ready (${crew.pilots.filter((x) => x.status === "ready").length})`],
            ["stranded", `Stranded (${crew.pilots.filter((x) => x.status === "stranded").length})`],
            ["high", "Epic+"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filter === id ? "active" : ""}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="crew-list">
        {sortedPilots.map((owned: OwnedPilot) => {
          const def = PILOT_BY_ID[owned.id];
          if (!def) return null;
          const stats = pilotStats(owned);
          const meta = RARITY_META[def.rarity];
          const curFloor = xpForLevel(owned.level);
          const nextReq = owned.level < MAX_PILOT_LEVEL ? xpForLevel(owned.level + 1) : curFloor;
          const xpPct =
            owned.level >= MAX_PILOT_LEVEL
              ? 100
              : Math.min(100, Math.round(((owned.xp - curFloor) / Math.max(1, nextReq - curFloor)) * 100));
          const fee = pilotRecoveryFee(owned.id);

          return (
            <article className={"pilot-card rarity-" + def.rarity} key={owned.id}>
              <div className="pilot-card-top">
                <div
                  className="pilot-avatar"
                  style={{ background: def.suitColor, borderColor: meta.color }}
                >
                  <span className="pilot-visor" style={{ background: def.visorColor }} />
                </div>
                <div className="pilot-card-meta">
                  <div className="pilot-name-row">
                    <strong>
                      {def.name} <em>“{def.callsign}”</em>
                    </strong>
                    <span className="pilot-status-tag" data-status={owned.status}>
                      {owned.status === "ready"
                        ? owned.duty
                          ? `Duty: ${owned.duty}`
                          : "Ready"
                        : owned.status === "flying"
                          ? "In Flight"
                          : "Stranded"}
                    </span>
                  </div>
                  <div className="pilot-sub-row">
                    <span className="rarity-pill" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <span>Lv {owned.level}</span>
                    <span className="star-row">
                      {Array.from({ length: owned.stars }, (_, i) => (
                        <Star key={i} size={10} fill="currentColor" />
                      ))}
                    </span>
                    <span>{owned.missionsFlown} flights</span>
                  </div>
                  <div className="pilot-xp-bar" aria-label={`Level ${owned.level} XP`}>
                    <i style={{ width: `${xpPct}%`, background: meta.color }} />
                  </div>
                </div>
              </div>

              <div className="pilot-stats-row">
                <span>
                  <Flame size={11} /> +{(stats.isp * 100).toFixed(1)}% Isp
                </span>
                <span>+{(stats.thrust * 100).toFixed(1)}% Thrust</span>
                <span>+{(stats.rd * 100).toFixed(1)}% RD</span>
                <span>
                  <Coins size={11} /> +{(stats.credits * 100).toFixed(1)}% C
                </span>
              </div>

              {def.perk && (
                <div className="pilot-perk-line">
                  <strong>{PERK_META[def.perk].label}:</strong> {PERK_META[def.perk].summary}
                </div>
              )}

              {owned.status === "stranded" && (
                <div className="pilot-card-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={p.credits < fee}
                    onClick={() => handleRecover(owned.id)}
                  >
                    <ShieldAlert size={13} />
                    Recover Pod · {fee.toLocaleString("en-US")} C
                  </button>
                </div>
              )}

              {owned.status === "ready" && (
                <div className="pilot-duty-actions">
                  {DUTY_LABELS.map((st) => {
                    const active = owned.duty === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        className={active ? "active" : ""}
                        onClick={() => handleDuty(owned.id, active ? undefined : st.id)}
                      >
                        {st.id === "foundry" ? "Foundry" : st.id === "lab" ? "Lab" : "Office"}
                      </button>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
        {sortedPilots.length === 0 && (
          <p className="crew-empty">No pilots match this filter.</p>
        )}
      </div>
    </div>
  );
}
