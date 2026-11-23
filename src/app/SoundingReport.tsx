import { SOUNDING_TARGET, type SoundingReport as Report } from "../program/program";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function SoundingReport({ report }: { report: Report }) {
  const reachedGoal = report.peakAltitude >= SOUNDING_TARGET;
  return (
    <dl className="sounding-report" aria-label="Atmospheric Sounding results">
      <dt>Vehicle</dt>
      <dd>{report.vehicleName}</dd>
      <dt>Peak altitude</dt>
      <dd>{number.format(report.peakAltitude / 1000)} km</dd>
      <dt>15 km goal</dt>
      <dd>{reachedGoal ? "Reached" : "Unmet"}</dd>
      <dt>Payout</dt>
      <dd>{number.format(report.creditsAwarded)} C + {number.format(report.researchAwarded)} RD</dd>
      <dt>Hardware spent</dt>
      <dd>{number.format(report.hardwareSpent)} C</dd>
      <dt>Propellant spent</dt>
      <dd>{number.format(report.propellantSpent)} Prop</dd>
    </dl>
  );
}
