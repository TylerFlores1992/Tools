-- Morning Mail schema, as applied to Supabase project mraeprivokvmxbvhwbbj on 2026-10-18
-- (migration "mail_schema"). Kept here as the record; Supabase is the authority.
create schema if not exists mail;
revoke all on schema mail from public, anon, authenticated, service_role;
create table mail.settings (id int primary key default 1 check (id = 1), gmail_key_hash text, gmail_key_created_at timestamptz, gmail_last_run_at timestamptz, gmail_last_summary jsonb, updated_at timestamptz not null default now());
insert into mail.settings (id) values (1);
create table mail.accounts (id text primary key, kind text not null check (kind in ('gmail','yahoo')), address text not null, secret_enc text, enabled boolean not null default true, uid_validity bigint, last_uid bigint, last_run_at timestamptz, last_ok_at timestamptz, last_error text, created_at timestamptz not null default now());
create table mail.rules (id bigint generated always as identity primary key, match_from text, match_subject text, action text not null check (action in ('trash','file','unsubscribe','hide','important')), folder text, hits int not null default 0, last_hit_at timestamptz, created_at timestamptz not null default now(), check (coalesce(match_from, '') <> '' or coalesce(match_subject, '') <> ''));
create table mail.messages (id text primary key, account_id text not null, report_date date not null, received_at timestamptz, from_name text, from_addr text, subject text not null default '', snippet text not null default '', unsub_http text, unsub_mailto text, one_click boolean not null default false, sorted_by text, bucket text not null check (bucket in ('needs_you','security','junk','updates','bulk','other')), level text not null check (level in ('urgent','normal','info')), title text not null, detail text, rule_id bigint, action text check (action in ('trash','file','unsubscribe','hide','important')), action_folder text, action_status text check (action_status in ('pending','done','failed','manual')), action_note text, created_at timestamptz not null default now());
create index messages_report_date_idx on mail.messages (report_date desc);
create index messages_from_idx on mail.messages (from_addr);
create table mail.dismissed (item_id text primary key, title text, at timestamptz not null default now());
create table mail.unsubscribed (from_addr text primary key, method text not null, at timestamptz not null default now());
create table mail.runs (id bigint generated always as identity primary key, source text not null, started_at timestamptz not null default now(), finished_at timestamptz, ok boolean, message text, counts jsonb);
alter table mail.settings enable row level security; alter table mail.accounts enable row level security; alter table mail.rules enable row level security; alter table mail.messages enable row level security; alter table mail.dismissed enable row level security; alter table mail.unsubscribed enable row level security; alter table mail.runs enable row level security;
grant usage on schema mail to money_app;
grant select, insert, update, delete on all tables in schema mail to money_app;
grant usage, select on all sequences in schema mail to money_app;
create policy money_app_all on mail.settings to money_app using (true) with check (true);
create policy money_app_all on mail.accounts to money_app using (true) with check (true);
create policy money_app_all on mail.rules to money_app using (true) with check (true);
create policy money_app_all on mail.messages to money_app using (true) with check (true);
create policy money_app_all on mail.dismissed to money_app using (true) with check (true);
create policy money_app_all on mail.unsubscribed to money_app using (true) with check (true);
create policy money_app_all on mail.runs to money_app using (true) with check (true);

-- 2026-10-21: two more buckets, "junk" (likely spam) and "updates" (receipts, deliveries, notices).
alter table mail.messages drop constraint if exists messages_bucket_check;
alter table mail.messages add constraint messages_bucket_check check (bucket in ('needs_you','security','junk','updates','bulk','other'));

-- 2026-10-24: who sorted each email, the AI read ('ai') or the code rules alone ('code').
alter table mail.messages add column if not exists sorted_by text;
