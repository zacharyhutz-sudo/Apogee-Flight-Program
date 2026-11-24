import type { Snapshot } from "../persistence/save.ts";
import { SOUNDING_TARGET } from "../program/program.ts";
import { hasUpperStage, thrustToWeight } from "../sim/flight.ts";

export function flightPrompt(save: Snapshot, paused: boolean) {
  const { tutorial, program: p, flight: f } = save;
  const sounding = tutorial.status === "active" && p.sortie === "sounding";
  const hop = (tutorial.status === "active" || tutorial.status === "complete") &&
    !tutorial.stagingSeen && p.sortie === "hop" && f.stage === 0 && hasUpperStage(f);
  if (!sounding && !hop) return null;
  if (sounding && p.rewarded) {
    const report = p.soundingReport;
    const payout = report ? `+${report.creditsAwarded} credits and +${report.researchAwarded} RD.` : "Payout received.";
    return { target: "base", text: `Good reading! ${payout} Tap Base to plan your next build.` };
  }
  if (f.status === "lost" || f.status === "landed")
    return sounding ? { target: "base", text: `Peak altitude was ${(f.maxAlt / 1000).toFixed(1)} km. Return to Base and fly Sounding again at full throttle, straight up.` } : null;
  if (f.status === "pad") {
    if (thrustToWeight(f) <= 1)
      return { target: "throttle", text: "We need more lift. Raise the throttle until Launch lights up." };
    if (sounding && f.throttle < 1)
      return { target: "throttle", text: "For this climb, slide the throttle to 100%, then tap Launch." };
    return { target: "command", text: sounding ? "Throttle’s set. Keep her upright and tap Launch." : "Launch upright. We’ll separate the booster when its fuel runs out." };
  }
  if (paused) return { target: "resume", text: "Flight paused. Tap Resume when you’re ready to continue." };
  if (hop) return f.fuel[0] <= 0
    ? { target: "command", text: "Booster’s dry. Tap Stage to shed it and fly the upper stage." }
    : { target: "fuel", text: "Watch S1 fuel. When it reaches zero, tap Stage to separate the booster." };
  return { target: "altitude", text: `Watch ALT. At ${SOUNDING_TARGET / 1000} kilometers, that reading is ours.` };
}
