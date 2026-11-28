import { Ellipsis } from "lucide-react";
import type { FlightGuidePrompt } from "./miloFlight";

export interface FlightMetric {
  label: string;
  value: string;
  unit?: string;
  fuel?: number;
  tone?: "danger" | "warn" | "safe";
}

export function FlightTelemetry({ primary, secondary, landing, expanded, toggle, guide }: {
  primary: FlightMetric[];
  secondary: FlightMetric[];
  landing: boolean;
  expanded: boolean;
  toggle: () => void;
  guide?: FlightGuidePrompt["target"];
}) {
  function highlight(label: string) {
    return (label === "ALT" && guide === "altitude") ||
      ((label === "AP" || label === "PE") && guide === "appe") ||
      (label.endsWith("FUEL") && guide === "fuel");
  }

  function meter({ label, value, unit, fuel, tone }: FlightMetric) {
    return (
      <div
        key={label}
        className={["meter", fuel !== undefined && "fuel-meter", tone].filter(Boolean).join(" ")}
        data-milo-focus={highlight(label)}
      >
        <span>{label}</span>
        <strong>{value}{unit && <small>{unit}</small>}</strong>
        {fuel !== undefined && (
          <div className="fuel-track" aria-hidden="true"><i style={{ width: fuel + "%" }} /></div>
        )}
      </div>
    );
  }

  return (
    <section className="flight-telemetry" aria-label={landing ? "Landing descent telemetry" : "Flight telemetry"}>
      <div className="telemetry">{primary.map(meter)}</div>
      <button type="button" className="telemetry-more" aria-label="Telemetry details"
        aria-expanded={expanded} aria-controls="flight-telemetry-details"
        data-milo-focus={!expanded && secondary.some(metric => highlight(metric.label))}
        title="Telemetry details" onClick={toggle}>
        <Ellipsis aria-hidden="true" />
      </button>
      <div id="flight-telemetry-details" className="telemetry-details" hidden={!expanded}>
        {secondary.map(meter)}
      </div>
    </section>
  );
}
