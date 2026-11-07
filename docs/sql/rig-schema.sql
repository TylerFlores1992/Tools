-- Rig Planner schema, applied to Supabase project mraeprivokvmxbvhwbbj on 2026-11-07
-- (migration "rig_schema"). Kept here as the record; Supabase is the authority.
-- Same lock-down as `money`, `mail` and `learn`: not exposed to the Data API, money_app only.
create schema if not exists rig;
revoke all on schema rig from public, anon, authenticated, service_role;
create table rig.designs (
  id text primary key,
  name text not null,
  design jsonb not null,
  build_list jsonb,
  status text not null default 'draft' check (status in ('draft', 'approved', 'built')),
  approved_at timestamptz,
  built_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index designs_updated_idx on rig.designs (updated_at desc);
alter table rig.designs enable row level security;
grant usage on schema rig to money_app;
grant select, insert, update, delete on all tables in schema rig to money_app;
create policy money_app_all on rig.designs to money_app using (true) with check (true);
