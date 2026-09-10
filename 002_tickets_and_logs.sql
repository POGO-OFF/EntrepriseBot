-- À exécuter une seule fois dans l'éditeur SQL Supabase.

create table if not exists public.discord_tickets (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.discord_guilds(id) on delete cascade,
  discord_channel_id text not null unique,
  opener_discord_id text not null,
  opener_name text,
  ticket_type text not null default 'support' check (ticket_type in ('support','moderation','impersonation','partnership')),
  claimed_by_discord_id text,
  claimed_by_name text,
  status text not null default 'open' check (status in ('open','claimed','closed')),
  close_reason text,
  transcript_text text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  closed_at timestamptz,
  closed_by_discord_id text
);

create index if not exists idx_discord_tickets_guild_status
  on public.discord_tickets(guild_id, status, created_at desc);
create index if not exists idx_discord_tickets_opener
  on public.discord_tickets(guild_id, opener_discord_id, status);

alter table public.discord_tickets add column if not exists ticket_type text not null default 'support';

create table if not exists public.discord_event_logs (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid references public.discord_guilds(id) on delete cascade,
  event_type text not null,
  actor_discord_id text,
  target_discord_id text,
  discord_channel_id text,
  discord_message_id text,
  summary text,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_discord_event_logs_guild_date
  on public.discord_event_logs(guild_id, created_at desc);
create index if not exists idx_discord_event_logs_type
  on public.discord_event_logs(guild_id, event_type, created_at desc);
