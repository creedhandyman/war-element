-- THE FOIL MARKET (owner, 2026-10-03). Players list foils they do not want for
-- shards; other players browse and buy. See src/data/market.ts (the rules the
-- client applies to its save) and src/net/market.ts (the calls).
--
-- TRUST MODEL, stated plainly: a player's shards and foils live in their own
-- save, so the server cannot check that a seller really holds the foil or that
-- a buyer can really pay. What it CAN own is the listing itself: one buyer per
-- listing (row lock), a price inside the rarity's band, at most five live
-- listings a seller, and a ledger of who is owed what. Each side applies its
-- half to its own save from that ledger (`market_pending`), then confirms it
-- (`market_ack`), so a crash between the two can be retried without loss.

create table if not exists public.market_listings (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references auth.users on delete cascade default auth.uid(),
  seller_name     text not null default 'Keeper' check (char_length(seller_name) between 1 and 24),
  card_id         text not null check (char_length(card_id) between 1 and 64),
  rarity          text not null check (rarity in ('rare', 'epic', 'legendary', 'mythic')),
  price           integer not null,
  status          text not null default 'active' check (status in ('active', 'sold', 'cancelled', 'expired')),
  buyer_id        uuid references auth.users on delete set null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '7 days',
  sold_at         timestamptz,
  seller_settled  boolean not null default false,
  buyer_settled   boolean not null default false,
  -- The price band, by rarity: the crafting cost ratios (4 : 8 : 16 : 50),
  -- anchored on a Mythic foil at 1,000 shards. The maximum is five times the
  -- minimum. Mirrored in src/data/market.ts MARKET_BANDS.
  constraint market_price_band check (
    (rarity = 'rare'      and price between   80 and  400) or
    (rarity = 'epic'      and price between  160 and  800) or
    (rarity = 'legendary' and price between  320 and 1600) or
    (rarity = 'mythic'    and price between 1000 and 5000)
  )
);

create index if not exists market_active_idx on public.market_listings (status, expires_at) where status = 'active';
create index if not exists market_seller_idx on public.market_listings (seller_id);
create index if not exists market_buyer_idx  on public.market_listings (buyer_id);

alter table public.market_listings enable row level security;

-- Read: every signed-in player sees the live listings; you also see your own
-- listings and your purchases, whatever their status.
drop policy if exists "market read" on public.market_listings;
create policy "market read" on public.market_listings for select to authenticated
  using (status = 'active' or seller_id = auth.uid() or buyer_id = auth.uid());

-- List: only as yourself, only a fresh live listing. Status, buyer, dates and
-- the settled flags are forced server-side by the trigger below. No UPDATE or
-- DELETE policy at all: every later change goes through the functions.
drop policy if exists "market list" on public.market_listings;
create policy "market list" on public.market_listings for insert to authenticated
  with check (seller_id = auth.uid());

create or replace function public.market_on_insert() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.seller_id := auth.uid();
  new.status := 'active';
  new.buyer_id := null;
  new.sold_at := null;
  new.created_at := now();
  new.expires_at := now() + interval '7 days';
  new.seller_settled := false;
  new.buyer_settled := false;
  if (select count(*) from public.market_listings
        where seller_id = new.seller_id and status = 'active' and expires_at > now()) >= 5 then
    raise exception 'market: at most 5 live listings';
  end if;
  return new;
end $$;

drop trigger if exists market_on_insert on public.market_listings;
create trigger market_on_insert before insert on public.market_listings
  for each row execute function public.market_on_insert();

-- BUY: one buyer per listing. The row lock is what makes two simultaneous buys
-- of the same foil resolve to one sale.
create or replace function public.market_buy(p_id uuid) returns public.market_listings
language plpgsql security definer set search_path = public as $$
declare l public.market_listings;
begin
  if auth.uid() is null then raise exception 'market: sign in to buy'; end if;
  select * into l from public.market_listings where id = p_id for update;
  if not found then raise exception 'market: listing not found'; end if;
  if l.seller_id = auth.uid() then raise exception 'market: that is your own listing'; end if;
  if l.status <> 'active' or l.expires_at <= now() then raise exception 'market: no longer for sale'; end if;
  update public.market_listings
     set status = 'sold', buyer_id = auth.uid(), sold_at = now()
   where id = p_id
   returning * into l;
  return l;
end $$;

-- CANCEL: the seller takes a live listing down; the foil comes back to them
-- through market_pending like any other settlement.
create or replace function public.market_cancel(p_id uuid) returns public.market_listings
language plpgsql security definer set search_path = public as $$
declare l public.market_listings;
begin
  update public.market_listings set status = 'cancelled'
   where id = p_id and seller_id = auth.uid() and status = 'active'
   returning * into l;
  if not found then raise exception 'market: nothing to cancel'; end if;
  return l;
end $$;

-- PENDING: what this player is owed and has not yet applied to their save —
-- a sale's shards, a foil back from a cancel or an expiry, a purchase to
-- collect. Expires this player's own lapsed listings first. Read-only apart
-- from that: nothing is marked settled until market_ack.
create or replace function public.market_pending()
returns table (id uuid, role text, outcome text, card_id text, rarity text, price integer)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.market_listings set status = 'expired'
   where seller_id = auth.uid() and status = 'active' and expires_at <= now();
  return query
    select m.id, 'seller'::text, m.status, m.card_id, m.rarity, m.price
      from public.market_listings m
     where m.seller_id = auth.uid() and m.status in ('sold', 'cancelled', 'expired') and not m.seller_settled
    union all
    select m.id, 'buyer'::text, m.status, m.card_id, m.rarity, m.price
      from public.market_listings m
     where m.buyer_id = auth.uid() and m.status = 'sold' and not m.buyer_settled;
end $$;

-- ACK: mark settlements applied. Only this player's own side of each row.
create or replace function public.market_ack(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.market_listings set seller_settled = true
   where id = any(p_ids) and seller_id = auth.uid() and status in ('sold', 'cancelled', 'expired');
  update public.market_listings set buyer_settled = true
   where id = any(p_ids) and buyer_id = auth.uid() and status = 'sold';
end $$;

revoke all on function public.market_buy(uuid)      from public, anon;
revoke all on function public.market_cancel(uuid)   from public, anon;
revoke all on function public.market_pending()      from public, anon;
revoke all on function public.market_ack(uuid[])    from public, anon;
grant execute on function public.market_buy(uuid)    to authenticated;
grant execute on function public.market_cancel(uuid) to authenticated;
grant execute on function public.market_pending()    to authenticated;
grant execute on function public.market_ack(uuid[])  to authenticated;
