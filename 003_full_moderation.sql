-- Contrôle depuis le site, configuration de protection et preuves.

alter table public.sanctions
  add column if not exists automatic boolean not null default false;

create table if not exists public.bot_action_queue (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.discord_guilds(id) on delete cascade,
  action_type text not null check (action_type in ('warn','timeout','kick','ban','unban','send_embed')),
  target_discord_id text,
  discord_channel_id text,
  requested_by_discord_id text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  result jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_bot_action_queue_pending
  on public.bot_action_queue(status, created_at);

create table if not exists public.guild_moderation_config (
  guild_id uuid primary key references public.discord_guilds(id) on delete cascade,
  progressive_enabled boolean not null default true,
  warning_timeout_threshold integer not null default 2,
  warning_ban_threshold integer not null default 4,
  timeout_minutes integer not null default 60,
  anti_spam_enabled boolean not null default true,
  anti_links_enabled boolean not null default false,
  anti_invites_enabled boolean not null default true,
  max_mentions integer not null default 5,
  updated_at timestamptz not null default now()
);

alter table public.guild_moderation_config enable row level security;
alter table public.bot_action_queue enable row level security;

-- Le site doit créer ses propres politiques RLS pour les administrateurs connectés.
-- Le bot utilise la clé service_role et conserve donc son accès serveur.
