import { X } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
  dismiss?: () => void;
  dismissLabel?: string;
}

export function MiloGuide({ children, title = "Milo Voss", actions, dismiss, dismissLabel = "Hide tutorial" }: Props) {
  return (
    <aside className="milo-card" aria-label="Milo's guidance">
      <span className="milo-face" aria-hidden="true" />
      <div className="milo-copy">
        <strong>{title}</strong>
        <p aria-live="polite" aria-atomic="true">{children}</p>
        {actions && <div className="milo-actions">{actions}</div>}
      </div>
      {dismiss && <button className="milo-close" aria-label={dismissLabel} onClick={dismiss}><X size={16} /></button>}
    </aside>
  );
}
