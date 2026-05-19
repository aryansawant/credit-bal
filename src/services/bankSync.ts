import AsyncStorage from "@react-native-async-storage/async-storage";

const OWNER_KEY_STORAGE_KEY = "ccpp.bankOwnerKey.v1";
const FUNCTION_NAME = "plaid-banking";

export type BankAccountBalance = {
  accountId: string;
  available: number | null;
  current: number | null;
  institutionName?: string;
  isoCurrencyCode?: string | null;
  mask?: string | null;
  name: string;
  officialName?: string | null;
  subtype?: string | null;
  type: string;
};

type BankFunctionResponse = {
  accounts?: BankAccountBalance[];
  error?: string;
};

function randomOwnerKey(): string {
  return `owner-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

function getSupabaseUrl(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
}

function getSupabaseAnonKey(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function isBankSyncConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export async function getOrCreateBankOwnerKey(): Promise<string> {
  const existingValue = await AsyncStorage.getItem(OWNER_KEY_STORAGE_KEY);

  if (existingValue) {
    return existingValue;
  }

  const nextValue = randomOwnerKey();
  await AsyncStorage.setItem(OWNER_KEY_STORAGE_KEY, nextValue);
  return nextValue;
}

async function invokeBankFunction(
  action: "sandbox_connect" | "sync_balances",
  body: Record<string, unknown> = {},
  accessToken?: string
): Promise<BankAccountBalance[]> {
  const supabaseUrl = getSupabaseUrl().replace(/\/$/, "");
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase bank sync is not configured.");
  }

  const ownerKey = accessToken ? undefined : await getOrCreateBankOwnerKey();
  const response = await fetch(`${supabaseUrl}/functions/v1/${FUNCTION_NAME}`, {
    body: JSON.stringify({
      action,
      ...(ownerKey ? { ownerKey } : {}),
      ...body,
    }),
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken ?? supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => ({}))) as BankFunctionResponse;

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? "Bank sync request failed.");
  }

  return payload.accounts ?? [];
}

export async function connectSandboxBank(
  accessToken?: string
): Promise<BankAccountBalance[]> {
  return invokeBankFunction("sandbox_connect", {}, accessToken);
}

export async function syncBankBalances(
  fresh = false,
  accessToken?: string
): Promise<BankAccountBalance[]> {
  return invokeBankFunction("sync_balances", { fresh }, accessToken);
}
