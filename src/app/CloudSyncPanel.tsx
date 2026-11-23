import { useState } from "react";
import { Cloud, LogOut, RefreshCw } from "lucide-react";
import type { useMission } from "./useMission";

export function CloudSyncPanel({
  mission: m,
}: {
  mission: ReturnType<typeof useMission>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState("");

  async function handleAuth(mode: "signin" | "signup") {
    if (!email.trim() || password.length < 6) {
      setFeedback("Enter a valid email and a password (6+ characters).");
      return;
    }
    setFeedback("");
    const msg =
      mode === "signin"
        ? await m.signInCloud(email, password)
        : await m.signUpCloud(email, password);
    setFeedback(msg);
  }

  async function handleSync() {
    setFeedback("");
    const msg = await m.syncCloudNow();
    setFeedback(msg);
  }

  return (
    <div className="cloud-box">
      <div className="cloud-head">
        <span className="cloud-title">
          <Cloud size={15} />
          Cloud Save
        </span>
        <span className={"cloud-badge" + (m.cloudEmail ? " synced" : "")}>
          {m.cloudStatus}
        </span>
      </div>

      {m.cloudEmail ? (
        <>
          <p className="cloud-account">
            Signed in as <b>{m.cloudEmail}</b>
          </p>
          <div className="dialog-actions">
            <button disabled={m.cloudBusy} onClick={handleSync}>
              <RefreshCw size={15} />
              Sync Now
            </button>
            <button
              disabled={m.cloudBusy}
              onClick={() => {
                setFeedback("");
                void m.signOutCloud();
              }}
            >
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="cloud-hint">
            Sign in to sync your bases, rockets, and flights across devices.
          </p>
          <div className="cloud-fields">
            <input
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password (6+ chars)"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="dialog-actions">
            <button
              className="primary"
              disabled={m.cloudBusy}
              onClick={() => void handleAuth("signin")}
            >
              Sign In
            </button>
            <button
              disabled={m.cloudBusy}
              onClick={() => void handleAuth("signup")}
            >
              Create Account
            </button>
          </div>
        </>
      )}

      {feedback && <p className="cloud-feedback">{feedback}</p>}
    </div>
  );
}
