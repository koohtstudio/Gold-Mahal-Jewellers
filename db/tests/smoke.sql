-- Smoke test for db/migrations/0001_init.sql. Run by scripts/check-migration.sh against a throwaway local Postgres.
\set ON_ERROR_STOP on

insert into settings (hours, ready_text, expiry_text, default_making_bps) values (
  '{"sun":{"open":660,"close":1170},"mon":null,"tue":{"open":690,"close":1140},"wed":{"open":690,"close":1140},"thu":{"open":690,"close":1140},"fri":{"open":690,"close":1170},"sat":{"open":690,"close":1170}}',
  'Your Gold Mahal reservation is ready. Show code {code} at the counter.', 'Your hold on {item} ends tomorrow.', '{"Earrings":1000}');
insert into profiles (id, email, role) values ('00000000-0000-0000-0000-000000000001', 'owner@demo.test', 'owner'), ('00000000-0000-0000-0000-000000000002', 'staff@demo.test', 'staff');
insert into rates (rate24_cents, published_by) values (20800, '00000000-0000-0000-0000-000000000001');
insert into pieces (tag, slug, name, category, karat, net_grams_milli, making_bps, image, units, options) values
  ('GM-1001', '22k-gold-balis', '22k Gold Balis', 'Earrings', 22, 1600, 1400, '/images/hoops.jpg', 2, '{Pair}');
insert into pieces (tag, slug, name, category, karat, net_grams_milli, making_bps, image, units, options, tax_free) values
  ('GM-1009', '10-g-gold-bar', '10 g Gold Bar', 'Bars', 24, 10000, 9999, '/images/gold-bars.jpg', 5, '{"10 g"}', true);
insert into pieces (tag, slug, name, category, karat, fixed_cents, image, units, options) values
  ('GM-1008', 'moissanite-halo-ring', 'Moissanite Halo Ring', 'Diamonds', null, 65000, '/images/ring-pear.jpg', 1, '{5,6}');

-- The view computes the same prices as lib/pricing.
do $$
begin
  assert (select total_cents from v_shop_pieces where tag = 'GM-1001') = 34778, 'balis price';
  assert (select making_cents from v_shop_pieces where tag = 'GM-1001') = 4271, 'balis making';
  assert (select total_cents from v_shop_pieces where tag = 'GM-1009') = 212160, 'bar uses the premium, not the piece making field';
  assert (select total_cents from v_shop_pieces where tag = 'GM-1008') = 65000, 'fixed price';
  assert div_he(5, 2) = 2 and div_he(7, 2) = 4 and div_he(25, 10) = 2 and div_he(35, 10) = 4, 'half to even';
  assert rate_for(20800, 22::smallint) = 19067, 'rate for 22k';
end $$;

-- Reserve as the public server route would, then sell as the owner.
create temp table ids as select tag, id from pieces;
grant select on ids to app_server;
set role app_server;
select set_config('app.role', '', false);
do $$
declare
  d date := (now() at time zone 'America/Toronto')::date + 2;
  s timestamptz;
  r reservations;
  pid uuid := (select id from ids where tag = 'GM-1001');
  caught text;
begin
  while extract(dow from d) = 1 loop d := d + 1; end loop;
  s := (d + time '13:00') at time zone 'America/Toronto';
  r := create_reservation('Smoke Test', '(416) 555-0100', s, s + interval '2 hours', 'Test visit', jsonb_build_array(jsonb_build_object('pieceId', pid, 'option', 'Pair', 'qty', 1)));
  assert r.code ~ '^GM-[0-9]{4}$', 'code format';
  assert r.locked_rate24_cents = 20800, 'rate locked';
  assert r.subtotal_cents = 34778 and r.hst_cents = 4521 and r.total_cents = 39299, 'totals and HST';
  assert r.hold_until >= s + interval '2 hours', 'hold runs to the end of the visit window';

  -- Two units exist, so one more is fine and a third is refused.
  perform create_reservation('Second Person', '416 555 0101', s, s + interval '2 hours', 'Test visit', jsonb_build_array(jsonb_build_object('pieceId', pid, 'option', 'Pair', 'qty', 1)));
  begin
    perform create_reservation('Third Person', '416 555 0102', s, s + interval '2 hours', 'Test visit', jsonb_build_array(jsonb_build_object('pieceId', pid, 'option', 'Pair', 'qty', 1)));
  exception when others then get stacked diagnostics caught = pg_exception_hint;
  end;
  assert caught = 'sold_out' or caught = 'conflict', 'a third reservation is refused';

  begin
    perform create_reservation('Bad Phone', '12345', s, s + interval '2 hours', 'x', jsonb_build_array(jsonb_build_object('pieceId', pid, 'option', 'Pair', 'qty', 1)));
  exception when others then get stacked diagnostics caught = pg_exception_hint;
  end;
  assert caught = 'validation', 'phone is validated in the database too';

  -- Customers cannot read reservations, the books or ID references.
  assert (select count(*) from reservations) = 0, 'no session sees no reservations';
  assert (select count(*) from pieces) = 0, 'no session reads the pieces table directly';
  assert (select count(*) from ledger_entries) = 0, 'no session sees no ledger';
  begin
    perform id_ref from old_gold;
    assert false, 'id_ref must not be readable';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Owner marks the first reservation sold. Staff cannot read the ledger, the owner can.
select set_config('app.role', 'owner', false), set_config('app.user_id', '00000000-0000-0000-0000-000000000001', false);
do $$
declare rid uuid := (select id from reservations order by created_at limit 1); r reservations;
begin
  r := mark_reservation_sold(rid);
  assert r.status = 'sold', 'sold';
  assert (select count(*) from ledger_entries where ref = r.code and source = 'reservation' and net_cents = 34778 and hst_cents = 4521) = 1, 'ledger row written';
  assert (select units_sold from pieces where tag = 'GM-1001') = 1, 'unit moved from reserved to sold';
  assert (select units_reserved from pieces where tag = 'GM-1001') = 1, 'the other reservation still holds one unit';
  assert (select count(*) from audit_log where action = 'reservation.sold') = 1, 'audit row written';
end $$;

select set_config('app.role', 'staff', false);
do $$
begin
  assert (select count(*) from ledger_entries) = 0, 'staff cannot read the ledger';
  assert (select count(*) from reservations) = 2, 'staff can read reservations';
  begin
    perform reveal_old_gold_id(gen_random_uuid());
    assert false, 'staff cannot reveal ID';
  exception when others then null;
  end;
  begin
    insert into old_gold (customer, karat, grams_milli, pure_grams_milli, buy_rate_cents, paid_cents, id_checked, id_ref) values ('x', 22, 1000, 900, 100, 100, false, 'x');
    assert false, 'old gold without the ID check must fail';
  exception when check_violation or insufficient_privilege or sqlstate '42501' then null;
  end;
end $$;

-- Expiry frees pieces.
reset role;
update reservations set hold_until = now() - interval '1 hour' where status = 'new';
set role app_server;
select set_config('app.role', 'owner', false);
do $$
begin
  assert expire_holds() = 1, 'one hold expired';
  assert (select units_reserved from pieces where tag = 'GM-1001') = 0, 'expired hold frees the unit';
end $$;

reset role;
select 'migration smoke test passed' as result;
