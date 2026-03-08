create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.users_profile (
  id uuid primary key,
  email text not null unique,
  family_id uuid not null references public.families(id) on delete cascade,
  full_name text,
  family_name text,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  subscription_tier text not null default 'Free' check (subscription_tier in ('Free', 'Premium')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  barcode text,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  product_name text not null,
  category text not null,
  barcode text,
  image_url text,
  status text not null check (status in ('In_List', 'At_Home')),
  expiry_date date not null,
  price numeric(10,2) not null default 0,
  quantity integer not null default 1,
  purchased_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  inviter_user_id uuid not null,
  invitee_user_id uuid references public.users_profile(id) on delete cascade,
  invitee_email text,
  invitee_family_name text,
  status text not null default 'Pending' check (status in ('Pending', 'Accepted', 'Declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  sender_user_id uuid not null references public.users_profile(id) on delete cascade,
  sender_name text,
  body text not null,
  image_path text,
  image_url text,
  kind text not null default 'message' check (kind in ('message', 'decision', 'system')),
  related_product_name text,
  substitute_for text,
  created_at timestamptz not null default now()
);

alter table public.chat_messages add column if not exists image_path text;

create table if not exists public.chat_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  storage_path text not null,
  file_name text,
  mime_type text,
  file_size integer,
  created_at timestamptz not null default now()
);

create table if not exists public.product_substitutes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  original_product_name text not null,
  substitute_product_name text not null,
  source_message_id uuid references public.chat_messages(id) on delete set null,
  confidence numeric(4,2) not null default 0.7,
  learned_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (family_id, original_product_name, substitute_product_name)
);

create table if not exists public.family_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade unique,
  plan_name text not null default 'Monthly',
  monthly_price_ils numeric(10,2) not null default 80.00,
  billing_interval_months integer not null default 1,
  commitment_months integer not null default 1,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  annual_first_month_free boolean not null default false
);

create table if not exists public.store_wallets (
  user_id uuid primary key references public.users_profile(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  balance_coins integer not null default 0 check (balance_coins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users_profile(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  direction text not null check (direction in ('credit', 'debit')),
  amount_coins integer not null check (amount_coins > 0),
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.store_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users_profile(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  item_id text not null,
  category text not null check (category in ('skin', 'feature')),
  skin_id text check (skin_id in ('default', 'ocean', 'sunset', 'midnight') or skin_id is null),
  unlocked_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create table if not exists public.user_store_preferences (
  user_id uuid primary key references public.users_profile(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  active_skin text not null default 'default' check (active_skin in ('default', 'ocean', 'sunset', 'midnight')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users_profile(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  provider text not null default 'demo-provider',
  provider_reference text,
  pack_id text not null check (pack_id in ('pack-small', 'pack-medium', 'pack-large')),
  amount_coins integer not null check (amount_coins > 0),
  amount_ils numeric(10,2) not null check (amount_ils >= 0),
  status text not null default 'Pending' check (status in ('Pending', 'Paid', 'Failed', 'Expired')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('processed', 'rejected')),
  processed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_profile_family_name on public.users_profile (family_name);
create index if not exists idx_chat_messages_family_created on public.chat_messages (family_id, created_at desc);
create index if not exists idx_chat_attachments_message on public.chat_message_attachments (message_id);
create index if not exists idx_chat_attachments_family on public.chat_message_attachments (family_id, created_at desc);
create index if not exists idx_product_substitutes_family_original on public.product_substitutes (family_id, original_product_name);
create index if not exists idx_family_invitations_family_status on public.family_invitations (family_id, status);
create index if not exists idx_store_wallet_family on public.store_wallets (family_id);
create index if not exists idx_store_wallet_tx_user_created on public.store_wallet_transactions (user_id, created_at desc);
create index if not exists idx_store_unlocks_user on public.store_unlocks (user_id, unlocked_at desc);
create index if not exists idx_store_unlocks_family on public.store_unlocks (family_id, unlocked_at desc);
create index if not exists idx_payment_checkout_user_created on public.payment_checkout_sessions (user_id, created_at desc);
create index if not exists idx_payment_checkout_family_created on public.payment_checkout_sessions (family_id, created_at desc);
create index if not exists idx_payment_webhooks_processed on public.payment_webhook_events (processed_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 5242880, null)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.families enable row level security;
alter table public.users_profile enable row level security;
alter table public.inventory enable row level security;
alter table public.family_invitations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_message_attachments enable row level security;
alter table public.product_substitutes enable row level security;
alter table public.family_subscriptions enable row level security;
alter table public.store_wallets enable row level security;
alter table public.store_wallet_transactions enable row level security;
alter table public.store_unlocks enable row level security;
alter table public.user_store_preferences enable row level security;
alter table public.payment_checkout_sessions enable row level security;
alter table public.payment_webhook_events enable row level security;

drop policy if exists "family members can read inventory" on public.inventory;
create policy "family members can read inventory"
on public.inventory
for select
using (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = inventory.family_id
  )
);

drop policy if exists "family members can mutate inventory" on public.inventory;
create policy "family members can mutate inventory"
on public.inventory
for all
using (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = inventory.family_id
  )
)
with check (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = inventory.family_id
  )
);

drop policy if exists "family members can read invitations" on public.family_invitations;
create policy "family members can read invitations"
on public.family_invitations
for select
using (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = family_invitations.family_id
  )
);

drop policy if exists "family members can mutate invitations" on public.family_invitations;
create policy "family members can mutate invitations"
on public.family_invitations
for all
using (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = family_invitations.family_id
  )
)
with check (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = family_invitations.family_id
  )
);

drop policy if exists "family members can read chat" on public.chat_messages;
create policy "family members can read chat"
on public.chat_messages
for select
using (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = chat_messages.family_id
  )
);

drop policy if exists "family members can post chat" on public.chat_messages;
create policy "family members can post chat"
on public.chat_messages
for insert
with check (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = chat_messages.family_id
  )
);

drop policy if exists "family members can read chat attachments" on public.chat_message_attachments;
create policy "family members can read chat attachments"
on public.chat_message_attachments
for select
using (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = chat_message_attachments.family_id
  )
);

drop policy if exists "family members can mutate chat attachments" on public.chat_message_attachments;
create policy "family members can mutate chat attachments"
on public.chat_message_attachments
for all
using (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = chat_message_attachments.family_id
  )
)
with check (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = chat_message_attachments.family_id
  )
);

drop policy if exists "family members can read substitutes" on public.product_substitutes;
create policy "family members can read substitutes"
on public.product_substitutes
for select
using (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = product_substitutes.family_id
  )
);

drop policy if exists "family members can mutate substitutes" on public.product_substitutes;
create policy "family members can mutate substitutes"
on public.product_substitutes
for all
using (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = product_substitutes.family_id
  )
)
with check (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = product_substitutes.family_id
  )
);

drop policy if exists "family members can read subscription" on public.family_subscriptions;
create policy "family members can read subscription"
on public.family_subscriptions
for select
using (
  exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = family_subscriptions.family_id
  )
);

drop policy if exists "users can read own wallet" on public.store_wallets;
create policy "users can read own wallet"
on public.store_wallets
for select
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = store_wallets.family_id
  )
);

drop policy if exists "users can mutate own wallet" on public.store_wallets;
create policy "users can mutate own wallet"
on public.store_wallets
for all
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = store_wallets.family_id
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = store_wallets.family_id
  )
);

drop policy if exists "users can read own wallet transactions" on public.store_wallet_transactions;
create policy "users can read own wallet transactions"
on public.store_wallet_transactions
for select
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = store_wallet_transactions.family_id
  )
);

drop policy if exists "users can mutate own wallet transactions" on public.store_wallet_transactions;
create policy "users can mutate own wallet transactions"
on public.store_wallet_transactions
for all
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = store_wallet_transactions.family_id
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = store_wallet_transactions.family_id
  )
);

drop policy if exists "users can read own unlocks" on public.store_unlocks;
create policy "users can read own unlocks"
on public.store_unlocks
for select
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = store_unlocks.family_id
  )
);

drop policy if exists "users can mutate own unlocks" on public.store_unlocks;
create policy "users can mutate own unlocks"
on public.store_unlocks
for all
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = store_unlocks.family_id
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = store_unlocks.family_id
  )
);

drop policy if exists "users can read own store preferences" on public.user_store_preferences;
create policy "users can read own store preferences"
on public.user_store_preferences
for select
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = user_store_preferences.family_id
  )
);

drop policy if exists "users can mutate own store preferences" on public.user_store_preferences;
create policy "users can mutate own store preferences"
on public.user_store_preferences
for all
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = user_store_preferences.family_id
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = user_store_preferences.family_id
  )
);

drop policy if exists "users can read own payment sessions" on public.payment_checkout_sessions;
create policy "users can read own payment sessions"
on public.payment_checkout_sessions
for select
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = payment_checkout_sessions.family_id
  )
);

drop policy if exists "users can create own payment sessions" on public.payment_checkout_sessions;
create policy "users can create own payment sessions"
on public.payment_checkout_sessions
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = payment_checkout_sessions.family_id
  )
);

drop policy if exists "users can update own payment sessions" on public.payment_checkout_sessions;
create policy "users can update own payment sessions"
on public.payment_checkout_sessions
for update
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = payment_checkout_sessions.family_id
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.family_id = payment_checkout_sessions.family_id
  )
);

drop policy if exists "service role manages payment webhooks" on public.payment_webhook_events;
create policy "service role manages payment webhooks"
on public.payment_webhook_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "authenticated upload chat images" on storage.objects;
create policy "authenticated upload chat images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-images'
  and auth.uid() is not null
);

drop policy if exists "authenticated read chat images" on storage.objects;
create policy "authenticated read chat images"
on storage.objects
for select
to authenticated
using (bucket_id = 'chat-images' and auth.uid() is not null);

update public.chat_messages
set image_url = 'storage:chat-images/' || replace(
  regexp_replace(
    image_url,
    '^.*?/storage/v1/object/(?:sign|public)/chat-images/([^?]+).*$','\1'
  ),
  '%2F',
  '/'
)
where image_url is not null
  and image_url not like 'storage:chat-images/%'
  and image_url ~ '/storage/v1/object/(sign|public)/chat-images/';

update public.chat_messages
set image_path = replace(image_url, 'storage:chat-images/', '')
where image_url like 'storage:chat-images/%'
  and (image_path is null or image_path = '');

update public.chat_messages
set image_path = replace(
  regexp_replace(
    image_url,
    '^.*?/storage/v1/object/(?:sign|public)/chat-images/([^?]+).*$','\1'
  ),
  '%2F',
  '/'
)
where image_url is not null
  and image_url ~ '/storage/v1/object/(sign|public)/chat-images/'
  and (image_path is null or image_path = '');

insert into public.chat_message_attachments (message_id, family_id, storage_path, file_name, mime_type, file_size)
select cm.id,
       cm.family_id,
       cm.image_path,
       null,
       null,
       null
from public.chat_messages cm
where cm.image_path is not null
  and cm.image_path <> ''
  and not exists (
    select 1 from public.chat_message_attachments a
    where a.message_id = cm.id and a.storage_path = cm.image_path
  );
