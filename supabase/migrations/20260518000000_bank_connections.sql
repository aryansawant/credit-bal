create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  owner_key text,
  provider text not null default 'plaid',
  item_id text not null,
  access_token text not null,
  institution_name text,
  accounts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_connections_owner_required
    check (user_id is not null or owner_key is not null),
  constraint bank_connections_provider_item_unique
    unique (provider, item_id)
);

create index if not exists bank_connections_user_id_idx
  on public.bank_connections(user_id);

create index if not exists bank_connections_owner_key_idx
  on public.bank_connections(owner_key);

alter table public.bank_connections enable row level security;

drop policy if exists "Users can read own bank connections"
  on public.bank_connections;

create policy "Users can read own bank connections"
  on public.bank_connections
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own bank connections"
  on public.bank_connections;

create policy "Users can delete own bank connections"
  on public.bank_connections
  for delete
  using (auth.uid() = user_id);
