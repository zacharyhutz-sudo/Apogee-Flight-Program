import { validate, type Snapshot } from "./save";

const env =
  (import.meta as unknown as { env?: Record<string, string | undefined> })
    .env ?? {};

const RAW_URL =
  env.VITE_SUPABASE_URL || "https://adszbforazgobdzaxrhp.supabase.co";
export const SUPABASE_URL = RAW_URL.replace(/\/rest\/v1\/?$/, "").replace(
  /\/+$/,
  "",
);
export const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_T5kpt8zED2O7eNmKglf0PQ_yQCR1a7d";

const SESSION_KEY = "apogee:supabase-session:v1";

export interface CloudSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  email: string;
}

export function getCloudSession(): CloudSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CloudSession>;
    if (
      typeof parsed.accessToken === "string" &&
      typeof parsed.refreshToken === "string" &&
      typeof parsed.userId === "string" &&
      typeof parsed.email === "string"
    ) {
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        expiresAt:
          typeof parsed.expiresAt === "number" ? parsed.expiresAt : 0,
        userId: parsed.userId,
        email: parsed.email,
      };
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

function saveCloudSession(session: CloudSession | null) {
  try {
    if (!session) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage errors
  }
}

function parseSessionPayload(
  data: Record<string, unknown>,
  fallbackEmail = "",
): CloudSession | null {
  const accessToken =
    typeof data.access_token === "string" ? data.access_token : "";
  const refreshToken =
    typeof data.refresh_token === "string" ? data.refresh_token : "";
  const expiresIn =
    typeof data.expires_in === "number" ? data.expires_in : 3600;
  const userObj =
    data.user && typeof data.user === "object"
      ? (data.user as Record<string, unknown>)
      : null;
  const userId = userObj && typeof userObj.id === "string" ? userObj.id : "";
  const email =
    userObj && typeof userObj.email === "string"
      ? userObj.email
      : fallbackEmail;
  if (!accessToken || !refreshToken || !userId) return null;
  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
    userId,
    email,
  };
}

function extractError(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    for (const k of ["msg", "message", "error_description", "error"]) {
      if (typeof rec[k] === "string" && rec[k]) return String(rec[k]);
    }
  }
  return fallback;
}

export async function signUpEmail(
  email: string,
  password: string,
): Promise<{ session: CloudSession | null; message: string }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(extractError(data, "Could not create account."));
  }
  const session = parseSessionPayload(data, email.trim());
  if (session) {
    saveCloudSession(session);
    return { session, message: "Account created & signed in." };
  }
  return {
    session: null,
    message: "Check your email to confirm your account, then sign in.",
  };
}

export async function signInEmail(
  email: string,
  password: string,
): Promise<CloudSession> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email.trim(), password }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(extractError(data, "Invalid email or password."));
  }
  const session = parseSessionPayload(data, email.trim());
  if (!session) throw new Error("Sign-in succeeded without a valid session.");
  saveCloudSession(session);
  return session;
}

export async function ensureFreshSession(): Promise<CloudSession | null> {
  const current = getCloudSession();
  if (!current) return null;
  if (Date.now() < current.expiresAt) return current;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: current.refreshToken }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      saveCloudSession(null);
      return null;
    }
    const refreshed = parseSessionPayload(data, current.email);
    if (!refreshed) {
      saveCloudSession(null);
      return null;
    }
    saveCloudSession(refreshed);
    return refreshed;
  } catch {
    return current;
  }
}

export async function signOutCloudSession(): Promise<void> {
  const current = getCloudSession();
  saveCloudSession(null);
  if (!current) return;
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${current.accessToken}`,
      },
    });
  } catch {
    // Best-effort remote logout
  }
}

export async function pullCloudSave(): Promise<{
  revision: number;
  snapshot: Snapshot;
} | null> {
  const session = await ensureFreshSession();
  if (!session) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/saves?user_id=eq.${encodeURIComponent(session.userId)}&select=revision,payload`,
    {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        Accept: "application/json",
      },
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(extractError(err, "Could not fetch cloud save."));
  }
  const rows = (await res.json()) as Array<{
    revision?: number;
    payload?: unknown;
  }>;
  if (!Array.isArray(rows) || rows.length === 0 || !rows[0]?.payload) {
    return null;
  }
  const snapshot = validate(rows[0].payload);
  const revision =
    typeof rows[0].revision === "number"
      ? rows[0].revision
      : snapshot.revision;
  return { revision, snapshot };
}

export async function pushCloudSave(snapshot: Snapshot): Promise<void> {
  const session = await ensureFreshSession();
  if (!session) return;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/saves?on_conflict=user_id`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: session.userId,
        revision: snapshot.revision,
        payload: snapshot,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(extractError(err, "Could not upload cloud save."));
  }
}
