import type { Snapshot } from "../persistence/save.ts";
import { SOUNDING_TARGET } from "../program/program.ts";
import { bodyParams, hasUpperStage, radius, thrustToWeight } from "../sim/flight.ts";

export interface FlightGuidePrompt {
  target: "base" | "throttle" | "command" | "resume" | "fuel" | "altitude" | "appe";
  text: string;
  title?: string;
  ack?: "apPeSeen";
}

export function flightPrompt(save: Snapshot, paused: boolean): FlightGuidePrompt | null {
  const { tutorial, program: p, flight: f } = save;
  const activeOrDone = tutorial.status === "active" || tutorial.status === "complete";
  const sounding = tutorial.status === "active" && p.sortie === "sounding";
  const hop =
    activeOrDone &&
    !tutorial.stagingSeen &&
    p.sortie === "hop" &&
    f.stage === 0 &&
    hasUpperStage(f);
  const needsApPe = activeOrDone && !tutorial.apPeSeen && f.status === "flying";

  if (!sounding && !hop && !needsApPe) return null;

  if (sounding && p.rewarded) {
    const report = p.soundingReport;
    const payout = report
      ? `+${report.creditsAwarded} credits and +${report.researchAwarded} RD.`
      : "Payout received.";
    return {
      target: "base",
      text: `Good reading! ${payout} Watch AP and PE in telemetry as you coast, or tap Base to plan your next build.`,
    };
  }

  if (f.status === "lost" || f.status === "landed") {
    return sounding
      ? {
          target: "base",
          text: `Peak altitude was ${(f.maxAlt / 1000).toFixed(1)} km. Return to Base and fly Sounding again at full throttle, straight up.`,
        }
      : null;
  }

  if (f.status === "pad") {
    if (!sounding && !hop) return null;
    if (thrustToWeight(f) <= 1) {
      return {
        target: "throttle",
        text: "We need more lift (TWR > 1.00). Raise the throttle until Launch lights up.",
      };
    }
    if (sounding && f.throttle < 1) {
      return {
        target: "throttle",
        text: "For this climb, slide the throttle to 100% (or tap ON/OFF to toggle saved thrust), then tap Launch.",
      };
    }
    return {
      target: "command",
      text: sounding
        ? "Throttle’s set. Keep her upright and tap Launch — or use Simulate free to practice with zero cost."
        : "Launch upright, then hold the right screen edge to start your gravity turn. We’ll separate the booster when Stage 1 runs dry.",
    };
  }

  if (paused) {
    return {
      target: "resume",
      text: "Flight paused. Tap Resume when you’re ready to continue.",
    };
  }

  // Urgent staging prompt always takes priority on a dry booster
  if (hop && f.fuel[0] <= 0) {
    return {
      target: "command",
      text: "Booster’s dry. Tap Stage to shed it and fly the upper stage.",
    };
  }

  // Explain AP (Apoapsis) and PE (Periapsis) right in the launch view once airborne
  const alt = Math.max(0, radius(f) - bodyParams(f.body).R);
  const apPeAlt = sounding ? 1500 : 1000;
  if (needsApPe && alt >= apPeAlt) {
    return {
      target: "appe",
      title: "Milo Voss · Orbit Telemetry",
      ack: "apPeSeen",
      text: "Watch AP & PE in telemetry (tap the three-dot button for additional readouts): AP (Apoapsis) is the highest point your trajectory will reach; PE (Periapsis) is the lowest point. Push AP past your altitude target — and on orbital flights, pitch sideways to raise PE above 30 km for a stable orbit.",
    };
  }

  if (hop) {
    return {
      target: "fuel",
      text: "Watch S1 fuel. When it reaches zero, tap Stage to separate the booster.",
    };
  }

  if (sounding) {
    return {
      target: "altitude",
      text: `Watch ALT. Tap telemetry details to check AP, your projected high point. At ${SOUNDING_TARGET / 1000} kilometers, that reading is ours. Hold the left or right screen edges if you need to steer.`,
    };
  }

  return null;
}
