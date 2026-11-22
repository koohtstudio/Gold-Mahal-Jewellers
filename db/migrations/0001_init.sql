-- Gold Mahal Jewellers: live schema for Neon Postgres.
-- WRITTEN, NOT APPLIED to any production database. It was run against a throwaway local Postgres to prove it loads
-- (see db/tests/smoke.sql). Apply order and the rest of the live work are in TODO-LIVE.md.
--
-- Access model: the Next.js server routes connect as a login role that is a member of app_server. After the Neon Auth session
-- is verified, each request runs `select set_config('app.user_id', '<uuid>', true), set_config('app.role', 'owner'|'staff', true)`
-- inside its transaction. Row level security policies read those settings. Public shop reads use shop_reader and one view.
-- Money is integer cents. Weight is integer milligrams. Rounding is half to even, matching lib/pricing.

begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_server') then create role app_server nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'shop_reader') then create role shop_reader nologin; end if;
end $$;

/* Request context and money helpers */

create or replace function app_role() returns text language sql stable as $$ select nullif(current_setting('app.role', true), '') $$;
create or replace function app_user() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;
create or replace function is_staff() returns boolean language sql stable as $$ select coalesce(app_role() in ('owner', 'staff'), false) $$;
create or replace function is_owner() returns boolean language sql stable as $$ select coalesce(app_role() = 'owner', false) $$;

-- Integer division rounded half to even. Same behaviour as divHE in lib/pricing/money.ts.
create or replace function div_he(n bigint, d bigint) returns bigint language plpgsql immutable as $$
declare q bigint; r bigint;
begin
  if d <= 0 then raise exception 'div_he: divisor must be positive'; end if;
  if n < 0 then return -div_he(-n, d); end if;
  q := n / d;
  r := n - q * d;
  if r * 2 < d then return q;
  elsif r * 2 > d then return q + 1;
  elsif q % 2 = 0 then return q;
  else return q + 1;
  end if;
end $$;

create or replace function rate_for(rate24_cents integer, karat smallint) returns integer language sql immutable as $$
  select div_he(rate24_cents::bigint * karat, 24)::integer
$$;

/* Tables */

create table profiles (
  id uuid primary key,                       -- the Neon Auth user id
  email text not null unique,
  role text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

create table settings (
  id boolean primary key default true check (id),
  accept_orders boolean not null default true,
  hold_hours integer not null default 48 check (hold_hours between 1 and 336),
  lock_rate boolean not null default true,
  same_day boolean not null default true,
  hours jsonb not null,
  ready_text text not null,
  expiry_text text not null,
  buy_rate_pct numeric(5, 2) not null default 94 check (buy_rate_pct between 50 and 100),
  bar_premium_pct numeric(5, 2) not null default 2 check (bar_premium_pct between 0 and 20),
  default_making_bps jsonb not null,
  morning_suggestion boolean not null default true,
  show_updated_at boolean not null default true,
  show_rate_on_site boolean not null default true,
  text_on_new boolean not null default true,
  slot_capacity integer not null default 3 check (slot_capacity between 1 and 20)
);

create table rates (
  id uuid primary key default gen_random_uuid(),
  published_at timestamptz not null default now(),
  rate24_cents integer not null check (rate24_cents between 5000 and 100000),
  published_by uuid references profiles (id)
);
create index rates_latest on rates (published_at desc);
create view latest_rate as select * from rates order by published_at desc limit 1;

create table pieces (
  id uuid primary key default gen_random_uuid(),
  tag text not null unique,
  slug text not null unique,
  name text not null,
  category text not null check (category in ('Earrings', 'Chains', 'Bridal', 'Diamonds', 'Bars')),
  karat smallint check (karat in (24, 22, 18, 14)),
  net_grams_milli integer not null default 0 check (net_grams_milli >= 0),
  making_bps integer not null default 0 check (making_bps between 0 and 10000),
  stone_cents integer not null default 0 check (stone_cents >= 0),
  fixed_cents integer check (fixed_cents >= 0),
  units integer not null default 1 check (units >= 0),
  units_reserved integer not null default 0 check (units_reserved >= 0),
  units_sold integer not null default 0 check (units_sold >= 0),
  visible boolean not null default true,
  certificate_ref text,
  tax_free boolean not null default false,
  image text not null,
  description text not null default '',
  option_label text not null default 'Option',
  options text[] not null default '{}',
  badge text,
  created_at timestamptz not null default now(),
  check (karat is not null or fixed_cents is not null),
  check (units_reserved + units_sold <= units)
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                  -- R-1042
  code text not null unique check (code ~ '^GM-[0-9]{4}$'),
  customer text not null,
  phone text not null check (phone ~ '^[0-9]{10}$'),
  locked_rate24_cents integer not null check (locked_rate24_cents > 0),
  subtotal_cents integer not null default 0,
  hst_cents integer not null default 0,
  total_cents integer not null default 0,
  visit_at timestamptz not null,
  visit_end_at timestamptz not null,
  visit_label text not null,
  hold_until timestamptz not null,
  status text not null default 'new' check (status in ('new', 'ready', 'sold', 'released', 'expired')),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  sold_at timestamptz,
  released_at timestamptz,
  notice_at timestamptz
);
create index reservations_open on reservations (status, hold_until) where status in ('new', 'ready');
create index reservations_slot on reservations (visit_at) where status in ('new', 'ready');
create sequence reservation_ref_seq start 1043;

create table reservation_lines (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations (id) on delete cascade,
  piece_id uuid not null references pieces (id),
  name text not null,
  option text not null default '',
  qty integer not null check (qty between 1 and 20),
  unit_cents integer not null check (unit_cents >= 0),
  tax_free boolean not null default false,
  image text not null
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  ticket text not null unique,
  customer text not null,
  phone text,
  type text not null check (type in ('custom', 'repair', 'resize')),
  title text not null,
  quote_cents integer not null check (quote_cents >= 0),
  deposit_cents integer not null default 0 check (deposit_cents >= 0 and deposit_cents <= quote_cents),
  due_date date not null,
  stage text not null default 'intake' check (stage in ('intake', 'workshop', 'ready')),
  created_at timestamptz not null default now(),
  texted_at timestamptz,
  closed_at timestamptz
);
create sequence job_ticket_seq start 215;

create table old_gold (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  customer text not null,
  karat smallint not null check (karat in (24, 22, 18, 14)),
  grams_milli integer not null check (grams_milli > 0),
  pure_grams_milli integer not null check (pure_grams_milli > 0),
  buy_rate_cents integer not null check (buy_rate_cents > 0),
  paid_cents integer not null check (paid_cents >= 0),
  id_checked boolean not null,
  id_ref text not null,                      -- sensitive. Column level access below. Never exported.
  awaiting_melt boolean not null default true,
  melted_at timestamptz,
  check (id_checked)                         -- a payout row cannot exist without the photo ID check
);

create table layaway (
  id uuid primary key default gen_random_uuid(),
  customer text not null,
  piece_id uuid references pieces (id),
  item_label text not null,
  total_cents integer not null check (total_cents > 0),
  paid_cents integer not null default 0 check (paid_cents >= 0 and paid_cents <= total_cents),
  instalment_cents integer not null check (instalment_cents > 0),
  next_due date
);
create table layaway_payments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references layaway (id) on delete cascade,
  date date not null default current_date,
  amount_cents integer not null check (amount_cents > 0)
);

create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  ref text not null,
  source text not null check (source in ('reservation', 'counter', 'bullion', 'layaway', 'job')),
  customer text not null,
  net_cents integer not null check (net_cents >= 0),
  hst_cents integer not null check (hst_cents >= 0),
  metal jsonb                                -- [{"karat":22,"gramsMilli":1600}] for the metal ledger
);
create index ledger_date on ledger_entries (date);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  vendor text not null,
  category text not null check (category in ('Gold purchase', 'Diamonds and stones', 'Rent', 'Insurance', 'Packaging', 'Advertising', 'Other')),
  net_cents integer not null check (net_cents > 0),
  hst_cents integer not null default 0 check (hst_cents >= 0),
  invoice_url text,                          -- a private object storage key, never a public URL
  metal_karat smallint check (metal_karat in (24, 22, 18, 14)),
  metal_grams_milli integer check (metal_grams_milli >= 0)
);
create index expenses_date on expenses (date);

create table accountant_settings (
  id boolean primary key default true check (id),
  name text not null default '',
  email text not null default '',
  format text not null default 'standard' check (format in ('standard', 'quickbooks', 'xero', 'pdf')),
  auto_send boolean not null default false,
  include_receipts boolean not null default true
);

create table send_log (
  id uuid primary key default gen_random_uuid(),
  period text not null,
  period_label text not null,
  format text not null check (format in ('standard', 'quickbooks', 'xero', 'pdf')),
  to_email text not null,
  sent_at timestamptz not null default now(),
  status text not null check (status in ('sent', 'failed')),
  unique (period, to_email)                  -- makes the monthly cron job idempotent
);

create table visit_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null,
  preferred_date date not null,
  name text not null,
  phone text not null check (phone ~ '^[0-9]{10}$'),
  status text not null default 'new' check (status in ('new', 'called', 'done'))
);
create table valuation_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  karat smallint not null check (karat in (24, 22, 18, 14)),
  grams_milli integer not null check (grams_milli > 0),
  estimate_cents integer not null check (estimate_cents >= 0),
  name text not null,
  phone text not null check (phone ~ '^[0-9]{10}$'),
  preferred_date date not null,
  status text not null default 'new' check (status in ('new', 'called', 'done'))
);

create table sent_messages (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  channel text not null check (channel in ('sms', 'email')),
  to_address text not null,
  subject text,
  body text not null,
  kind text not null
);

create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  target text not null,
  meta text
);

create table cron_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  period text not null,
  ran_at timestamptz not null default now(),
  unique (job, period)
);

/* Audit helper */

create or replace function write_audit(p_action text, p_target text, p_meta text default null) returns void language sql security definer set search_path = public as $$
  insert into audit_log (actor, action, target, meta)
  values (coalesce((select email from profiles where id = app_user()), 'customer'), p_action, p_target, p_meta)
$$;

/* The shop reads one view. Prices are computed here, from the latest rate, so they cannot drift from the formula. */

create view v_shop_pieces as
select
  p.id, p.tag, p.slug, p.name, p.category, p.karat, p.net_grams_milli, p.making_bps, p.stone_cents, p.fixed_cents, p.tax_free,
  p.image, p.description, p.option_label, p.options, p.badge,
  greatest(p.units - p.units_reserved - p.units_sold, 0) as units_available,
  lr.published_at as rate_published_at,
  calc.rate_per_gram_cents, calc.gold_cents, calc.making_cents,
  case when calc.fixed then p.fixed_cents else calc.gold_cents + calc.making_cents + p.stone_cents end as total_cents
from pieces p
cross join latest_rate lr
cross join settings s
cross join lateral (
  select
    (p.karat is null and p.fixed_cents is not null) as fixed,
    case when p.karat is null then 0 else rate_for(lr.rate24_cents, p.karat) end as rate_per_gram_cents,
    case when p.karat is null then 0 else div_he(p.net_grams_milli::bigint * rate_for(lr.rate24_cents, p.karat), 1000)::integer end as gold_cents,
    case when p.karat is null then 0
         else div_he(div_he(p.net_grams_milli::bigint * rate_for(lr.rate24_cents, p.karat), 1000) * (case when p.category = 'Bars' then round(s.bar_premium_pct * 100)::bigint else p.making_bps::bigint end), 10000)::integer end as making_cents
) calc
where p.visible;

/* Reservations are created here, in one transaction, with the rate locked in the same transaction. Called with the service role. */

create or replace function create_reservation(p_name text, p_phone text, p_visit_start timestamptz, p_visit_end timestamptz, p_visit_label text, p_lines jsonb)
returns reservations language plpgsql security definer set search_path = public as $$
declare
  st settings%rowtype;
  lr rates%rowtype;
  res reservations%rowtype;
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  hrs jsonb;
  dow text;
  ln jsonb;
  pc pieces%rowtype;
  qty integer;
  unit_c integer;
  gold_c bigint;
  make_c bigint;
  sub bigint := 0;
  taxable bigint := 0;
  hst bigint;
  tries integer := 0;
  new_code text;
begin
  select * into st from settings;
  if not st.accept_orders then raise exception 'Online reserving is paused.' using errcode = 'P0001', hint = 'closed'; end if;
  if length(digits) = 11 and left(digits, 1) = '1' then digits := substr(digits, 2); end if;
  if digits !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' then raise exception 'Please enter a 10 digit mobile number.' using errcode = 'P0001', hint = 'validation'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Please enter your name.' using errcode = 'P0001', hint = 'validation'; end if;
  if p_visit_end <= p_visit_start or p_visit_end <= now() then raise exception 'Please choose a visit time that has not passed.' using errcode = 'P0001', hint = 'validation'; end if;
  dow := (array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])[extract(dow from p_visit_start at time zone 'America/Toronto')::int + 1];
  hrs := st.hours -> dow;
  if hrs is null or jsonb_typeof(hrs) = 'null' then raise exception 'We are closed that day. Please choose another.' using errcode = 'P0001', hint = 'closed'; end if;
  if (select count(*) from reservations where status in ('new', 'ready') and visit_at = p_visit_start) >= st.slot_capacity then
    raise exception 'That time is full. Please choose another window.' using errcode = 'P0001', hint = 'conflict';
  end if;

  select * into lr from latest_rate;
  if not found then raise exception 'No gold rate has been published yet.' using errcode = 'P0001', hint = 'not_found'; end if;

  loop
    tries := tries + 1;
    new_code := 'GM-' || (2000 + floor(random() * 8000))::int;
    begin
      insert into reservations (ref, code, customer, phone, locked_rate24_cents, visit_at, visit_end_at, visit_label, hold_until)
      values ('R-' || nextval('reservation_ref_seq'), new_code, trim(p_name), digits, lr.rate24_cents, p_visit_start, p_visit_end, p_visit_label,
              greatest(now() + make_interval(hours => st.hold_hours), p_visit_end))
      returning * into res;
      exit;
    exception when unique_violation then
      if tries > 200 then raise exception 'Please try again in a moment.' using errcode = 'P0001', hint = 'conflict'; end if;
    end;
  end loop;

  -- Lock pieces in a stable order so two reservations cannot deadlock.
  for ln in select value from jsonb_array_elements(p_lines) order by value ->> 'pieceId' loop
    qty := (ln ->> 'qty')::int;
    select * into pc from pieces where id = (ln ->> 'pieceId')::uuid and visible for update;
    if not found then raise exception 'One of those pieces is no longer listed.' using errcode = 'P0001', hint = 'not_found'; end if;
    if pc.units - pc.units_reserved - pc.units_sold < qty then
      raise exception '% was just reserved or sold. Please remove it from your bag.', pc.name using errcode = 'P0001', hint = 'sold_out';
    end if;
    if pc.karat is null then
      unit_c := pc.fixed_cents;
    else
      gold_c := div_he(pc.net_grams_milli::bigint * rate_for(lr.rate24_cents, pc.karat), 1000);
      make_c := div_he(gold_c * (case when pc.category = 'Bars' then round(st.bar_premium_pct * 100)::bigint else pc.making_bps::bigint end), 10000);
      unit_c := (gold_c + make_c + pc.stone_cents)::int;
    end if;
    insert into reservation_lines (reservation_id, piece_id, name, option, qty, unit_cents, tax_free, image)
    values (res.id, pc.id, pc.name, coalesce(ln ->> 'option', ''), qty, unit_c, pc.tax_free, pc.image);
    update pieces set units_reserved = units_reserved + qty where id = pc.id;
    sub := sub + unit_c::bigint * qty;
    if not pc.tax_free then taxable := taxable + unit_c::bigint * qty; end if;
  end loop;

  hst := div_he(taxable * 13, 100);
  update reservations set subtotal_cents = sub, hst_cents = hst, total_cents = sub + hst where id = res.id returning * into res;
  return res;
end $$;

create or replace function mark_reservation_sold(p_id uuid) returns reservations language plpgsql security definer set search_path = public as $$
declare
  r reservations%rowtype;
  l record;
  taxable_net bigint := 0;
  bullion_net bigint := 0;
  taxable_metal jsonb := '[]'::jsonb;
  bullion_metal jsonb := '[]'::jsonb;
  pc pieces%rowtype;
begin
  if not is_staff() then raise exception 'Please sign in to the admin.' using errcode = 'P0001', hint = 'forbidden'; end if;
  select * into r from reservations where id = p_id for update;
  if not found then raise exception 'That reservation was not found.' using errcode = 'P0001', hint = 'not_found'; end if;
  if r.status not in ('new', 'ready') then raise exception 'Only an open reservation can be marked sold.' using errcode = 'P0001', hint = 'bad_state'; end if;
  for l in select * from reservation_lines where reservation_id = r.id loop
    select * into pc from pieces where id = l.piece_id for update;
    update pieces set units_reserved = greatest(units_reserved - l.qty, 0), units_sold = units_sold + l.qty where id = l.piece_id;
    if l.tax_free then
      bullion_net := bullion_net + l.unit_cents::bigint * l.qty;
      if pc.karat is not null then bullion_metal := bullion_metal || jsonb_build_object('karat', pc.karat, 'gramsMilli', pc.net_grams_milli * l.qty); end if;
    else
      taxable_net := taxable_net + l.unit_cents::bigint * l.qty;
      if pc.karat is not null then taxable_metal := taxable_metal || jsonb_build_object('karat', pc.karat, 'gramsMilli', pc.net_grams_milli * l.qty); end if;
    end if;
  end loop;
  if taxable_net > 0 or (bullion_net = 0) then
    insert into ledger_entries (ref, source, customer, net_cents, hst_cents, metal)
    values (r.code, 'reservation', r.customer, taxable_net, div_he(taxable_net * 13, 100), nullif(taxable_metal, '[]'::jsonb));
  end if;
  if bullion_net > 0 then
    insert into ledger_entries (ref, source, customer, net_cents, hst_cents, metal)
    values (r.code, 'bullion', r.customer, bullion_net, 0, nullif(bullion_metal, '[]'::jsonb));
  end if;
  update reservations set status = 'sold', sold_at = now() where id = r.id returning * into r;
  perform write_audit('reservation.sold', r.code, (r.total_cents / 100)::text);
  return r;
end $$;

-- Run by the scheduled job (Vercel Cron, every 15 minutes). Idempotent.
create or replace function expire_holds() returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; r record;
begin
  for r in select id from reservations where status in ('new', 'ready') and hold_until <= now() for update skip locked loop
    update pieces p set units_reserved = greatest(p.units_reserved - l.qty, 0) from reservation_lines l where l.reservation_id = r.id and p.id = l.piece_id;
    update reservations set status = 'expired', released_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Only the owner can read an ID reference, and every read is logged.
create or replace function reveal_old_gold_id(p_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare ref text; who text;
begin
  if not is_owner() then raise exception 'Only the owner can do this.' using errcode = 'P0001', hint = 'forbidden'; end if;
  select id_ref, customer || ' ' || date into ref, who from old_gold where id = p_id;
  if not found then raise exception 'That purchase was not found.' using errcode = 'P0001', hint = 'not_found'; end if;
  perform write_audit('oldgold.id.view', who);
  return ref;
end $$;

/* Grants and row level security */

revoke all on all tables in schema public from public, app_server, shop_reader;
revoke execute on all functions in schema public from public;
grant usage on schema public to app_server, shop_reader;
grant execute on function div_he(bigint, bigint), rate_for(integer, smallint), app_role(), app_user(), is_staff(), is_owner() to app_server, shop_reader;

-- Public shop: one view and the settings it needs.
grant select on v_shop_pieces, latest_rate to shop_reader, app_server;
grant select on settings to shop_reader;

grant select on profiles, settings, rates, pieces, reservations, reservation_lines, jobs, layaway, layaway_payments, visit_requests, valuation_requests to app_server;
grant select on ledger_entries, expenses, accountant_settings, send_log, sent_messages, audit_log to app_server;
grant insert on rates, pieces, jobs, layaway, layaway_payments, visit_requests, valuation_requests, expenses, send_log, sent_messages to app_server;
grant update on pieces, jobs, layaway, visit_requests, valuation_requests, settings, accountant_settings to app_server;
grant insert, update on ledger_entries to app_server;
-- Old gold: the ID reference column is not readable by the app role at all. Use reveal_old_gold_id().
grant select (id, date, customer, karat, grams_milli, pure_grams_milli, buy_rate_cents, paid_cents, id_checked, awaiting_melt, melted_at) on old_gold to app_server;
grant insert on old_gold to app_server;
grant update (awaiting_melt, melted_at) on old_gold to app_server;
grant usage on sequence job_ticket_seq to app_server;
grant execute on function create_reservation(text, text, timestamptz, timestamptz, text, jsonb), mark_reservation_sold(uuid), expire_holds(), reveal_old_gold_id(uuid), write_audit(text, text, text) to app_server;

alter table profiles enable row level security;
alter table settings enable row level security;
alter table rates enable row level security;
alter table pieces enable row level security;
alter table reservations enable row level security;
alter table reservation_lines enable row level security;
alter table jobs enable row level security;
alter table old_gold enable row level security;
alter table layaway enable row level security;
alter table layaway_payments enable row level security;
alter table ledger_entries enable row level security;
alter table expenses enable row level security;
alter table accountant_settings enable row level security;
alter table send_log enable row level security;
alter table visit_requests enable row level security;
alter table valuation_requests enable row level security;
alter table sent_messages enable row level security;
alter table audit_log enable row level security;

-- Anyone may read the shop settings and rates (they are shown on the public site).
create policy settings_read on settings for select to app_server, shop_reader using (true);
create policy settings_write on settings for update to app_server using (is_owner());
create policy rates_read on rates for select to app_server, shop_reader using (true);
create policy rates_publish on rates for insert to app_server with check (is_owner());
create policy profiles_read on profiles for select to app_server using (is_staff());

-- Staff tables.
create policy pieces_read on pieces for select to app_server using (is_staff());
create policy pieces_write on pieces for insert to app_server with check (is_staff());
create policy pieces_edit on pieces for update to app_server using (is_staff());
create policy reservations_read on reservations for select to app_server using (is_staff());
create policy reservation_lines_read on reservation_lines for select to app_server using (is_staff());
create policy jobs_all_read on jobs for select to app_server using (is_staff());
create policy jobs_all_write on jobs for insert to app_server with check (is_staff());
create policy jobs_all_edit on jobs for update to app_server using (is_staff());
create policy old_gold_read on old_gold for select to app_server using (is_staff());
create policy old_gold_write on old_gold for insert to app_server with check (is_staff() and id_checked);
create policy old_gold_edit on old_gold for update to app_server using (is_staff());
create policy layaway_read on layaway for select to app_server using (is_staff());
create policy layaway_write on layaway for insert to app_server with check (is_staff());
create policy layaway_edit on layaway for update to app_server using (is_staff());
create policy layaway_payments_read on layaway_payments for select to app_server using (is_staff());
create policy layaway_payments_write on layaway_payments for insert to app_server with check (is_staff());
create policy visits_read on visit_requests for select to app_server using (is_staff());
create policy visits_edit on visit_requests for update to app_server using (is_staff());
create policy valuations_read on valuation_requests for select to app_server using (is_staff());
create policy valuations_edit on valuation_requests for update to app_server using (is_staff());
-- Public forms insert through the server route, which has already validated and rate limited the request.
create policy visits_insert on visit_requests for insert to app_server with check (true);
create policy valuations_insert on valuation_requests for insert to app_server with check (true);

-- Owner only: the books, the accountant, the audit trail and messages.
create policy ledger_owner on ledger_entries for select to app_server using (is_owner());
create policy ledger_write on ledger_entries for insert to app_server with check (is_staff());
create policy expenses_owner on expenses for select to app_server using (is_owner());
create policy expenses_write on expenses for insert to app_server with check (is_owner());
create policy accountant_owner on accountant_settings for select to app_server using (is_owner());
create policy accountant_edit on accountant_settings for update to app_server using (is_owner());
create policy send_log_owner on send_log for select to app_server using (is_owner());
create policy send_log_write on send_log for insert to app_server with check (is_owner());
create policy sent_owner on sent_messages for select to app_server using (is_owner());
create policy sent_write on sent_messages for insert to app_server with check (is_staff() or app_role() is null);
create policy audit_owner on audit_log for select to app_server using (is_owner());
-- audit_log has no insert, update or delete policy for app_server. Rows are written by write_audit() only.

commit;
