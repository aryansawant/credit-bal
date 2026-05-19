# Bank Sync Setup

This app uses Supabase Edge Functions as the backend for Plaid. The Expo app
only stores public Supabase config and a random local owner key. Plaid secrets
and access tokens stay on Supabase.

## 1. Configure the Expo app

Copy `.env.example` to `.env` and fill in:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Restart Expo after changing `.env`.

## 2. Configure Supabase

Apply the migration:

```sh
supabase link --project-ref your-project-ref
supabase db push
```

Set Edge Function secrets:

```sh
supabase secrets set PLAID_CLIENT_ID=your-plaid-client-id
supabase secrets set PLAID_SECRET=your-plaid-sandbox-secret
supabase secrets set PLAID_ENV=sandbox
```

Deploy the function:

```sh
supabase functions deploy plaid-banking
```

## 3. Test in the app

Open the Debit tab and tap `Connect sandbox bank`. The returned Plaid Sandbox
depository accounts are added as bank-synced debit cards.

## Production notes

The current app path is Sandbox-first and does not include the native Plaid Link
SDK yet. For real bank linking, add Plaid Link in the mobile app, then send the
Link `public_token` to the `exchange_public_token` action in the same Supabase
function.

The `Refresh balances` action requests fresh balances from Plaid. In non-sandbox
Plaid environments, confirm your Plaid product and pricing before using fresh
balance calls heavily.
