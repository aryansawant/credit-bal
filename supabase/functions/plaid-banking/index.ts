import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

type PlaidEnvironment = "sandbox" | "development" | "production";

type Owner =
  | {
      userId: string;
      ownerKey?: never;
    }
  | {
      ownerKey: string;
      userId?: never;
    };

type PlaidAccount = {
  account_id: string;
  balances: {
    available: number | null;
    current: number | null;
    iso_currency_code?: string | null;
  };
  mask?: string | null;
  name: string;
  official_name?: string | null;
  subtype?: string | null;
  type: string;
};

type BankAccount = {
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

type ConnectionRow = {
  access_token: string;
  institution_name: string | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
    status,
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function getServiceRoleKey(): string {
  const directValue = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (directValue) {
    return directValue;
  }

  const secretKeysValue = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (!secretKeysValue) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  const secretKeys = JSON.parse(secretKeysValue) as Record<string, string>;
  const defaultKey = secretKeys.default;

  if (!defaultKey) {
    throw new Error("SUPABASE_SECRET_KEYS.default is not configured");
  }

  return defaultKey;
}

function plaidBaseUrl(): string {
  const env = (Deno.env.get("PLAID_ENV") ?? "sandbox") as PlaidEnvironment;

  switch (env) {
    case "production":
      return "https://production.plaid.com";
    case "development":
      return "https://development.plaid.com";
    case "sandbox":
    default:
      return "https://sandbox.plaid.com";
  }
}

async function plaidRequest<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${plaidBaseUrl()}${path}`, {
    body: JSON.stringify({
      client_id: requiredEnv("PLAID_CLIENT_ID"),
      secret: requiredEnv("PLAID_SECRET"),
      ...body,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const plaidError =
      typeof payload?.error_message === "string"
        ? payload.error_message
        : "Plaid request failed";

    throw new Error(plaidError);
  }

  return payload as T;
}

function normalizeAccounts(
  accounts: PlaidAccount[],
  institutionName?: string | null
): BankAccount[] {
  return accounts
    .filter((account) => account.type === "depository")
    .map((account) => ({
      accountId: account.account_id,
      available: account.balances.available,
      current: account.balances.current,
      institutionName: institutionName ?? undefined,
      isoCurrencyCode: account.balances.iso_currency_code,
      mask: account.mask,
      name: account.name,
      officialName: account.official_name,
      subtype: account.subtype,
      type: account.type,
    }));
}

async function getOwner(
  supabase: ReturnType<typeof createClient>,
  req: Request,
  body: Record<string, unknown>
): Promise<Owner> {
  const authorization = req.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (token) {
    const { data } = await supabase.auth.getUser(token);

    if (data.user) {
      return { userId: data.user.id };
    }
  }

  const ownerKey = typeof body.ownerKey === "string" ? body.ownerKey : "";

  if (ownerKey.length >= 24) {
    return { ownerKey };
  }

  throw new Error("Missing Supabase user session or ownerKey");
}

async function listConnections(
  supabase: ReturnType<typeof createClient>,
  owner: Owner
): Promise<ConnectionRow[]> {
  let query = supabase
    .from("bank_connections")
    .select("access_token,institution_name");

  query = owner.userId
    ? query.eq("user_id", owner.userId)
    : query.eq("owner_key", owner.ownerKey);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as ConnectionRow[];
}

async function saveConnection({
  accessToken,
  accounts,
  institutionName,
  itemId,
  owner,
  supabase,
}: {
  accessToken: string;
  accounts: BankAccount[];
  institutionName?: string | null;
  itemId: string;
  owner: Owner;
  supabase: ReturnType<typeof createClient>;
}) {
  const row = {
    access_token: accessToken,
    accounts,
    institution_name: institutionName ?? null,
    item_id: itemId,
    owner_key: owner.ownerKey ?? null,
    provider: "plaid",
    updated_at: new Date().toISOString(),
    user_id: owner.userId ?? null,
  };
  const { error } = await supabase
    .from("bank_connections")
    .upsert(row, { onConflict: "provider,item_id" });

  if (error) {
    throw error;
  }
}

async function getBalancesForAccessToken(
  accessToken: string,
  institutionName?: string | null,
  fresh = false
): Promise<BankAccount[]> {
  const endpoint = fresh ? "/accounts/balance/get" : "/accounts/get";
  const response = await plaidRequest<{ accounts: PlaidAccount[] }>(endpoint, {
    access_token: accessToken,
  });

  return normalizeAccounts(response.accounts, institutionName);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    const supabase = createClient(
      requiredEnv("SUPABASE_URL"),
      getServiceRoleKey()
    );
    const owner = await getOwner(supabase, req, body);

    if (action === "create_link_token") {
      const response = await plaidRequest<{ link_token: string; expiration: string }>(
        "/link/token/create",
        {
          client_name: "Credit Disk",
          country_codes: ["US"],
          language: "en",
          products: ["transactions"],
          user: {
            client_user_id: owner.userId ?? owner.ownerKey,
          },
        }
      );

      return jsonResponse(response);
    }

    if (action === "exchange_public_token") {
      const publicToken =
        typeof body.publicToken === "string" ? body.publicToken : "";
      const institutionName =
        typeof body.institutionName === "string" ? body.institutionName : null;

      if (!publicToken) {
        return jsonResponse({ error: "publicToken is required" }, 400);
      }

      const exchange = await plaidRequest<{
        access_token: string;
        item_id: string;
      }>("/item/public_token/exchange", {
        public_token: publicToken,
      });
      const accounts = await getBalancesForAccessToken(
        exchange.access_token,
        institutionName,
        true
      );

      await saveConnection({
        accessToken: exchange.access_token,
        accounts,
        institutionName,
        itemId: exchange.item_id,
        owner,
        supabase,
      });

      return jsonResponse({ accounts });
    }

    if (action === "sandbox_connect") {
      if ((Deno.env.get("PLAID_ENV") ?? "sandbox") !== "sandbox") {
        return jsonResponse(
          { error: "sandbox_connect is only available when PLAID_ENV=sandbox" },
          400
        );
      }

      const publicToken = await plaidRequest<{ public_token: string }>(
        "/sandbox/public_token/create",
        {
          initial_products: ["transactions"],
          institution_id: "ins_109508",
        }
      );
      const exchange = await plaidRequest<{
        access_token: string;
        item_id: string;
      }>("/item/public_token/exchange", {
        public_token: publicToken.public_token,
      });
      const institutionName = "Plaid Sandbox Bank";
      const accounts = await getBalancesForAccessToken(
        exchange.access_token,
        institutionName,
        true
      );

      await saveConnection({
        accessToken: exchange.access_token,
        accounts,
        institutionName,
        itemId: exchange.item_id,
        owner,
        supabase,
      });

      return jsonResponse({ accounts });
    }

    if (action === "sync_balances") {
      const fresh = body.fresh === true;
      const connections = await listConnections(supabase, owner);
      const results = await Promise.all(
        connections.map((connection) =>
          getBalancesForAccessToken(
            connection.access_token,
            connection.institution_name,
            fresh
          )
        )
      );

      return jsonResponse({ accounts: results.flat() });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected banking error";

    return jsonResponse({ error: message }, 500);
  }
});
