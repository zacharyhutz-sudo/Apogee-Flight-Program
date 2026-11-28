import { useLayoutEffect, useRef } from "react";
import { Flag } from "lucide-react";
import type { Flight } from "../sim/flight";

export function MissionComplete({ flight, choose }: { flight: Flight; choose: (base: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const el = ref.current!;
    el.showModal();
    heading.current?.focus();
    return () => el.close();
  }, []);
  const reward = flight.completion!;
  return <dialog ref={ref} className="mission-complete" aria-labelledby="complete-title" onCancel={e => e.preventDefault()}>
    <section><Flag aria-hidden="true" />
      <h1 id="complete-title" tabIndex={-1} ref={heading}>Mission complete</h1>
      <p>{reward.name}</p>
      <dl><div><dt>Credits</dt><dd>+{reward.credits.toLocaleString("en-US")}</dd></div>
        <div><dt>Research</dt><dd>+{reward.research.toLocaleString("en-US")}</dd></div></dl>
      <button className="primary" onClick={() => choose(false)}>{flight.status === "flying" ? "Continue flying" :
        flight.status === "landed" ? "View landing site" : "View flight result"}</button>
      <button onClick={() => choose(true)}>Return to base</button>
      <small>{flight.launchOrigin === "moon" ? "Lunar Base" : "Earth Base"}</small>
    </section>
  </dialog>;
}
