import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StoredAppData } from "../storage/appStorage";

const SESSION_STORAGE_KEY = "ccpp.supabaseSession.v1";

type AuthUser = {
  id: string;
  email?: string;
};

export type CloudSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  user: AuthUser;
};

export type CloudSnapshot = {
  data: StoredAppData;
  updatedAt: string;
};

type AuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: AuthUser;
  error?: string;
  error_description?: string;
  msg?: string;
};

type SnapshotRow = {
  data: StoredAppData;
  updated_at: string;
};

function getSupabaseUrl(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
}

function getSupabaseAnonKey(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

function assertConfigured() {
  if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
    throw new Error("Supabase account sync is not configured.");
  }
}

function authUrl(path: string): string {
  return `${getSupabaseUrl().replace(/\/$/, "")}/auth/v1${path}`;
}

function restUrl(path: string): string {
  return `${getSupabaseUrl().replace(/\/$/, "")}/rest/v1${path}`;
}

function authHeaders(accessToken?: string) {
  const anonKey = getSupabaseAnonKey();

  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken ?? anonKey}`,
    "Content-Type": "application/json",
  };
}

function sessionFromAuthResponse(payload: AuthResponse): CloudSession {
  if (payload.user?.id && (!payload.access_token || !payload.refresh_token)) {
    throw new Error("Account created. Check your email, then sign in.");
  }

  if (!payload.access_token || !payload.refresh_token || !payload.user?.id) {
    const message =
      payload.error_description ?? payload.error ?? payload.msg ?? "Auth failed.";

    throw new Error(message);
  }

  return {
    accessToken: payload.access_token,
    expiresAt:
      payload.expires_at ??
      (payload.expires_in
        ? Math.floor(Date.now() / 1000) + payload.expires_in
        : undefined),
    refreshToken: payload.refresh_token,
    user: payload.user,
  };
}

async function saveSession(session: CloudSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

async function requestAuth(
  path: string,
  body: Record<string, unknown>
): Promise<CloudSession> {
  assertConfigured();

  const response = await fetch(authUrl(path), {
    body: JSON.stringify(body),
    headers: authHeaders(),
    method: "POST",
  });
  const payload = (await response.json().catch(() => ({}))) as AuthResponse;

  if (!response.ok) {
    throw new Error(
      payload.error_description ?? payload.error ?? payload.msg ?? "Auth failed."
    );
  }

  const session = sessionFromAuthResponse(payload);
  await saveSession(session);
  return session;
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<CloudSession> {
  return requestAuth("/signup", { email, password });
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<CloudSession> {
  return requestAuth("/token?grant_type=password", { email, password });
}

export async function getStoredCloudSession(): Promise<CloudSession | null> {
  const value = await AsyncStorage.getItem(SESSION_STORAGE_KEY);

  if (!value) {
    return null;
  }

  try {
    const session = JSON.parse(value) as CloudSession;

    if (!session.accessToken || !session.refreshToken || !session.user?.id) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function refreshCloudSession(
  session: CloudSession
): Promise<CloudSession> {
  return requestAuth("/token?grant_type=refresh_token", {
    refresh_token: session.refreshToken,
  });
}

export async function getValidCloudSession(): Promise<CloudSession | null> {
  const session = await getStoredCloudSession();

  if (!session) {
    return null;
  }

  const expiresSoon =
    typeof session.expiresAt === "number" &&
    session.expiresAt - Math.floor(Date.now() / 1000) < 120;

  if (!expiresSoon) {
    return session;
  }

  try {
    return await refreshCloudSession(session);
  } catch {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export async function signOutCloudAccount(
  session: CloudSession
): Promise<void> {
  await fetch(authUrl("/logout"), {
    headers: authHeaders(session.accessToken),
    method: "POST",
  }).catch(() => undefined);
  await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function loadCloudSnapshot(
  session: CloudSession
): Promise<CloudSnapshot | null> {
  assertConfigured();

  const response = await fetch(
    restUrl(
      `/app_snapshots?select=data,updated_at&user_id=eq.${session.user.id}&limit=1`
    ),
    {
      headers: authHeaders(session.accessToken),
      method: "GET",
    }
  );

  if (!response.ok) {
    throw new Error("Could not load account data.");
  }

  const rows = (await response.json()) as SnapshotRow[];
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    data: row.data,
    updatedAt: row.updated_at,
  };
}

export async function saveCloudSnapshot(
  session: CloudSession,
  data: StoredAppData
): Promise<CloudSnapshot> {
  assertConfigured();

  const updatedAt = new Date().toISOString();
  const response = await fetch(restUrl("/app_snapshots?on_conflict=user_id"), {
    body: JSON.stringify({
      data,
      updated_at: updatedAt,
      user_id: session.user.id,
    }),
    headers: {
      ...authHeaders(session.accessToken),
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Could not save account data.");
  }

  const rows = (await response.json()) as SnapshotRow[];
  const row = rows[0];

  return {
    data: row?.data ?? data,
    updatedAt: row?.updated_at ?? updatedAt,
  };
}
