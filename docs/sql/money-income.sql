-- Money: Income (pay stubs, W-2s, work calendar). Applied to the Supabase project as migration
-- "money_income" on 2026-10-19. Same rules as the rest of the money schema: not exposed to the
-- Data API, money_app only, RLS on with one policy for money_app.

create table if not exists money.stubs (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'stub' check (kind in ('stub', 'w2')),
  -- reading: the AI is reading it; review: waiting for the owner; saved: counted; failed: unreadable
  status text not null default 'reading' check (status in ('reading', 'review', 'saved', 'failed')),
  employer text,
  payroll_company text,
  show_name text,
  pay_date date,
  period_start date,
  period_end date,
  tax_year int,
  gross numeric(12, 2),
  net numeric(12, 2),
  hours numeric(8, 2),
  check_number text,
  taxes jsonb not null default '{}',       -- {federal, socialSecurity, medicare, state, sdi, local, other}
  deductions jsonb not null default '[]',  -- [{label, amount}]
  earnings jsonb not null default '[]',    -- [{label, kind, hours, rate, amount}]
  ytd jsonb not null default '{}',         -- {gross, net, federal, socialSecurity, medicare, state, sdi, hours}
  w2 jsonb,                                -- W-2 boxes, for kind = 'w2'
  work_days jsonb not null default '[]',   -- ["<event id>|YYYY-MM-DD", ...] the calendar days this pays for
  notes text,
  read_error text,
  model text,
  deposit_txn_id text references money.transactions (id) on delete set null,
  deposit_match text check (deposit_match in ('auto', 'manual', 'none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stubs_pay_date on money.stubs (pay_date);

-- The photo or PDF, kept out of the row so listing stubs never loads it.
create table if not exists money.stub_files (
  stub_id uuid primary key references money.stubs (id) on delete cascade,
  mime text not null,
  bytes bytea not null,
  created_at timestamptz not null default now()
);

-- Work days from Google Calendar, sent by the Apps Script in the owner's account.
create table if not exists money.work_events (
  event_id text primary key,
  title text not null,
  start_day date not null,
  end_day date not null,       -- inclusive
  color text,
  seen_at timestamptz not null default now(),
  recolored_at timestamptz
);

-- One row of settings (calendar key, colors, rates, health plan, tax profile).
create table if not exists money.income_settings (
  id int primary key default 1 check (id = 1),
  calendar_key_hash text,
  calendar_key_created_at timestamptz,
  calendar_last_run_at timestamptz,
  calendar_last_summary jsonb,
  config jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
insert into money.income_settings (id) values (1) on conflict do nothing;

do $$
declare t text;
begin
  foreach t in array array['stubs', 'stub_files', 'work_events', 'income_settings'] loop
    execute format('alter table money.%I enable row level security', t);
    execute format('drop policy if exists money_app_all on money.%I', t);
    execute format('create policy money_app_all on money.%I to money_app using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on money.%I to money_app', t);
    execute format('revoke all on money.%I from anon, authenticated', t);
  end loop;
end $$;

-- 2026-10-20: estimated stubs (estimate.ts) for pay that reached the bank without a stub.
alter table money.stubs add column if not exists estimated boolean not null default false;
