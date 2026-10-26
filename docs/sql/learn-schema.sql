-- Learn (read-code lessons) schema, as applied to Supabase project mraeprivokvmxbvhwbbj on 2026-10-26
-- (migration "learn_schema"). Kept here as the record; Supabase is the authority.
-- Same lock-down as `money` and `mail`: not exposed to the Data API, money_app only.
create schema if not exists learn;
revoke all on schema learn from public, anon, authenticated, service_role;
create table learn.lessons (lesson_id text primary key, started_at timestamptz not null default now(), completed_at timestamptz, last_step int not null default 0, score int, out_of int, updated_at timestamptz not null default now());
create table learn.items (item_id text primary key, lesson_id text not null, box int not null default 1 check (box between 1 and 5), due_on date not null default current_date, right_count int not null default 0, wrong_count int not null default 0, last_seen_at timestamptz not null default now());
create index items_due_idx on learn.items (due_on);
create table learn.attempts (id bigint generated always as identity primary key, item_id text not null, lesson_id text not null, kind text not null, correct boolean, answer text, feedback jsonb, source text not null default 'lesson' check (source in ('lesson','review')), created_at timestamptz not null default now());
create index attempts_created_idx on learn.attempts (created_at desc);
alter table learn.lessons enable row level security; alter table learn.items enable row level security; alter table learn.attempts enable row level security;
grant usage on schema learn to money_app;
grant select, insert, update, delete on all tables in schema learn to money_app;
grant usage, select on all sequences in schema learn to money_app;
create policy money_app_all on learn.lessons to money_app using (true) with check (true);
create policy money_app_all on learn.items to money_app using (true) with check (true);
create policy money_app_all on learn.attempts to money_app using (true) with check (true);
