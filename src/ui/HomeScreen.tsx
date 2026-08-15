/** Home — where was I, what is on right now, and where do I go to prepare.
 *
 *  Home used to BE the collection. That was a deliberate call and the comment
 *  that made it is worth keeping in mind: the landing card it replaced was "a
 *  menu pretending to be a destination" — a title and two shortcuts, nothing on
 *  it you could not have guessed before you tapped. This screen is not that
 *  card again. Everything on it is live state, and every tile carries the one
 *  number that decides whether you need to go there.
 *
 *  The order is by what DECAYS. Continue is where you left off and it is the
 *  reflex reach. What is happening now expires. Deck builder and Collection
 *  will still be there tomorrow, so they sit last and smallest — and they sit
 *  here rather than in the nav because both are things you do BETWEEN fights
 *  and neither earns a permanent tab against four.
 *
 *  ON THE MIDDLE BAND. The design this came from proposes an events system —
 *  timed modifiers with their own cards, "Double BORE essence for 2d 04h". No
 *  such system exists, and the design says so itself and calls that band a
 *  proposal rather than a transcription. Inventing one here would have meant
 *  hardcoded copy for content that never changes and never expires: a live dot
 *  next to a lie. So the band keeps the design's shape and takes its content
 *  from state the game already tracks — a Gauntlet run mid-flight, a region
 *  that has gone to full Blight, shards that will buy a pack, essence that will
 *  buy a card. When none of that is true it renders nothing at all, which is
 *  the honest state of a fresh save and one of the cases the design asks for.
 */
import { useMemo } from "react";
import {
  BLIGHT_MAX, PACK_COST, PLACED_CARDS, REGIONS, blightLevel, canCraft, craftCostOf,
  deckCapFor, isCleared, isOpen, preferredLoadout, type StoryRegion, type StorySave,
} from "../data/story";
import { CARDS } from "../data/cards";
import { openEvents, type GameEvent } from "../data/events";
import { boardOfRun, runOver, runReward } from "../data/gauntlet";
import { decksForTier } from "../data/custom-decks";
import { deckArtUrl } from "./DeckPickerSheet";
import { EL_COLOR, EL_ICON } from "./shared";

/** One row in the middle band. `feature` promotes it to the big card at the
 *  top — only one thing can be the most urgent. */
interface Live {
  id: string;
  feature?: boolean;
  /** Renders the pulsing dot and LIVE tag. Reserved for things that are
   *  genuinely running and can end without you. */
  live?: boolean;
  tag: string;
  title: string;
  body: string;
  cta: string;
  onGo: () => void;
  /** Full-bleed art on a feature card; a 26px element sigil on a row. */
  art?: string;
  el?: string;
  rim?: string;
}

export function HomeScreen(props: {
  save: StorySave;
  /** The region the player was last reading. Continue points at this one. */
  regionId: string;
  /** Open the story map. Takes a region because rows on this screen name one:
   *  the Blight card is about a specific region and `open` alone lands you on
   *  whatever map you last read, which for two blighted regions was the same
   *  wrong map twice. */
  onStory: (regionId?: string) => void;
  onArena: () => void;
  /** Start an event match. Home is the ONLY way in — an event deck is not in
   *  any picker — so this is the whole entrance. */
  onEvent: (event: GameEvent) => void;
  onShop: (tab: "packs" | "crafter") => void;
  onBuilder: () => void;
  onCollection: () => void;
}) {
  const { save } = props;
  const hero = save.hero;
  const shards = hero?.shards ?? 0;
  const essence = hero?.essence ?? {};
  const totalEssence = Object.values(essence).reduce((a, b) => a + b, 0);

  const region = REGIONS.find((r) => r.id === props.regionId) ?? REGIONS[0];

  /** Where you actually are in this region: how much is done, and the next
   *  thing you can walk into. `isOpen` is the map's own predicate, so the node
   *  named here is always one you could start right now. */
  const here = useMemo(() => {
    const done = region.nodes.filter((n) => isCleared(save, n.id)).length;
    const next = region.nodes.find((n) => !isCleared(save, n.id) && isOpen(save, n));
    return { done, total: region.nodes.length, next };
  }, [save, region]);
  const fresh = save.cleared.length === 0;

  /** Counted against the cards actually PLACED in the world, matching the
   *  collection screen exactly. `save.collection.length` is a different number
   *  — it includes anything granted outside a node — and two screens one tap
   *  apart disagreeing about how much you own reads as a bug in both. */
  const collected = useMemo(() => {
    const owned = new Set(save.collection);
    return PLACED_CARDS.filter((id) => owned.has(id)).length;
  }, [save.collection]);

  /** Through the shared helper, NOT `loadouts[0]`. Teams are appended, so a
   *  forward search returns the OLDEST match — `preferredLoadout` exists
   *  precisely to stop that, and Story prep goes through it. Two screens one
   *  tap apart naming different teams is the bug it was written for. */
  /** Cards you own and have not opened yet. Scoped to the collection so a flag
   *  left behind by a card you no longer hold cannot inflate it. */
  const newCards = useMemo(() => {
    const owned = new Set(save.collection);
    return (save.unseen ?? []).filter((id) => owned.has(id)).length;
  }, [save.unseen, save.collection]);

  const teamName = useMemo(
    () => preferredLoadout(save, undefined, () => true)?.name ?? null,
    [save],
  );
  /** The cap is a CEILING, not a quota — story.ts says so outright and the
   *  builder repeats it: twelve good cards instead of eighteen mediocre ones is
   *  a legal team. So this tile reports the size and only warns when the deck
   *  cannot field a fight at all. It used to print a red SHORT the moment the
   *  deck was under the ladder value, which on a fresh save meant the first
   *  screen a new player sees flagged "1/12 SHORT" for a deck the builder would
   *  then hard-cap at 1 — a warning with nowhere to go. */
  const deckCap = deckCapFor(save.cleared);
  const deckEmpty = save.deck.length === 0;

  // Destructured: `props` is a fresh object every render, so a dep on it made
  // this memo a no-op and re-ran a ~312-card `canCraft` scan on every paint.
  const { onArena, onEvent, onShop, onStory } = props;
  const live = useMemo(
    () => buildLive(save, { onArena, onEvent, onShop, onStory }),
    [save, onArena, onEvent, onShop, onStory],
  );
  const feature = live.find((l) => l.feature);
  const rows = live.filter((l) => !l.feature);

  return (
    <div className="overlay arena-wrap">
      <div className="home-screen">
        {/* Taller and softer than the Arena's band — this is the one screen
            where the game gets a moment to just be itself. See `.home-logo`
            for why it is a crop and not the uncropped title the mock drew. */}
        <div className="home-logo">
          <picture>
            <source srcSet="/title.webp" type="image/webp" />
            <img src="/title.jpg" alt="War Element" />
          </picture>
        </div>

        <div className="home-you">
          <span className="home-av" aria-hidden="true">{(hero?.name ?? "?").slice(0, 1).toUpperCase()}</span>
          <span className="home-name">{hero?.name ?? "Keeper"}</span>
          <span className="home-purse p-shard" title={`${shards} shards`}>
            <i className="shard" aria-hidden="true" /><b>{shards}</b>
          </span>
          <span className="home-purse p-ess" title={`${totalEssence} essence, across every element`}>
            <i className="ess" aria-hidden="true" /><b>{totalEssence}</b>
          </span>
        </div>

        <button className="home-cont" onClick={() => props.onStory(region.id)}>
          {region.art && <span className="home-cont-art" style={{ backgroundImage: `url(${region.art})` }} aria-hidden="true" />}
          <span className="home-cont-veil" aria-hidden="true" />
          <span className="home-cont-body">
            <span className="home-eyebrow">
              {fresh ? "BEGIN" : "CONTINUE"} · {region.name.toUpperCase()}
            </span>
            <span className="home-cont-node">
              {here.next?.name ?? (here.done === here.total ? "Every node cleared" : "Locked — clear a road in")}
            </span>
            <span className="home-cont-foot">
              <span className="home-bar" aria-hidden="true">
                <i style={{ width: `${here.total ? (here.done / here.total) * 100 : 0}%` }} />
              </span>
              <b>{here.done}/{here.total} NODES</b>
            </span>
          </span>
        </button>

        {live.length > 0 && (
          <>
            <div className="home-lbl">
              <span>HAPPENING NOW</span>
              <em>All {live.length}</em>
            </div>
            <div className="home-live">
              {feature && (
                <button className="home-feat" style={feature.rim ? { borderColor: feature.rim } : undefined}
                  onClick={feature.onGo}>
                  {feature.art && <span className="home-feat-art" style={{ backgroundImage: `url(${feature.art})` }} aria-hidden="true" />}
                  <span className="home-feat-veil" aria-hidden="true" />
                  <span className="home-feat-body">
                    <span className="home-feat-top">
                      {feature.live && <><i className="home-dot" aria-hidden="true" /><b>LIVE</b></>}
                      <em>{feature.tag}</em>
                    </span>
                    <span className="home-feat-name">{feature.title}</span>
                    <span className="home-feat-sub">{feature.body}</span>
                    {/* The card's own action. It was built and then never
                        rendered, so the Gauntlet's "Fight" existed only in the
                        data — the whole card was tappable but said nothing
                        about where it went. */}
                    <span className="home-feat-cta">{feature.cta}</span>
                  </span>
                </button>
              )}
              {rows.map((r) => (
                <button key={r.id} className="home-row" onClick={r.onGo}>
                  <span className="home-row-sig" style={r.el ? { borderColor: EL_COLOR[r.el as keyof typeof EL_COLOR], backgroundImage: `url(${EL_ICON[r.el as keyof typeof EL_ICON]})` } : undefined} aria-hidden="true" />
                  <span className="home-row-meta">
                    <b>{r.title}</b>
                    <em>{r.body}</em>
                  </span>
                  <span className="home-row-cta">{r.cta}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Only when there is a band to sit above. Pinning the tiles to the
            bottom of an otherwise empty screen leaves 340px of hole in the
            MIDDLE, and a hole between content reads as something that failed
            to load; a screen that simply ends reads as a screen that is done.
            A fresh save has nothing running and should look calm, not broken. */}
        {live.length > 0 && <div className="home-gap" />}

        <div className="home-prep">
          <button className="home-tile deck" onClick={props.onBuilder}>
            <span className="home-tile-name">Deck builder</span>
            <span className="home-tile-sub">{teamName ?? "No team saved"}</span>
            <span className={`home-tile-num ${deckEmpty ? "warn" : "ok"}`}>
              {deckEmpty ? "NO DECK" : `${save.deck.length} CARD${save.deck.length === 1 ? "" : "S"} · CAP ${deckCap}`}
            </span>
          </button>
          <button className="home-tile col" onClick={props.onCollection}>
            <span className="home-tile-name">Collection</span>
            <span className="home-tile-sub">{collected} of {PLACED_CARDS.length}</span>
            {/* NEW when there is any, MISSING otherwise. Both are about the
                place this tile opens — you conjure in the Shop, which is why
                it is not that — and NEW is the one that CHANGED since you last
                looked, which is what a tile number is for. */}
            {newCards > 0
              ? <span className="home-tile-num gold">{newCards} NEW</span>
              : <span className="home-tile-num">{PLACED_CARDS.length - collected} MISSING</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The middle band, assembled from things that are actually true right now.
 *  Ordered most-urgent first and the head of the list becomes the feature card,
 *  so the promotion is a consequence of the ordering rather than a second
 *  decision that could disagree with it. */
/** The art for the deck the run is about to seat. The seat id carries its own
 *  board (`…_5` for the large builds), so both are searched rather than
 *  threading a board size onto a screen that has no other use for one. */
function seatArt(run: NonNullable<StorySave["gauntlet"]>["run"]): string | null {
  if (!run) return null;
  const id = run.seats[run.won];
  const deck = [...decksForTier(run.tier, 4), ...decksForTier(run.tier, 5)].find((d) => d.id === id);
  return deck ? deckArtUrl(deck.cards) : null;
}

function buildLive(
  save: StorySave,
  go: {
    onArena: () => void;
    onEvent: (event: GameEvent) => void;
    onShop: (tab: "packs" | "crafter") => void;
    onStory: (regionId?: string) => void;
  },
): Live[] {
  const out: Live[] = [];
  const run = save.gauntlet?.run;

  // A run can END without you — lose one seat and it is gone. Nothing else on
  // this screen is at risk, so nothing else outranks it.
  if (run && !runOver(run)) {
    out.push({
      id: "gauntlet", live: true,
      tag: `Seat ${run.won + 1} of ${run.seats.length}`,
      title: "The Gauntlet",
      // "Even", not "mid": that is what the Arena segment and the deck sheet
      // both call this rung, and Home is the third surface naming it.
      body: `${run.seats.length - run.won} to go on the ${run.tier === "mid" ? "even" : run.tier} rung.`
        + ` One loss ends the run — ${runReward(run.tier, boardOfRun(run))} shards if it does not.`,
      cta: "Fight", onGo: go.onArena,
      // The face of the deck in the next seat, not a generic backdrop. The
      // first cut pointed at `/battlefield.png` — 3.5 MB, the only PNG art
      // reference left in src/, and an asset the match screen itself retired
      // (`.battlefield-bg { display: none }`) — fetched on the LANDING screen
      // for a 118px strip masked to transparency at its left edge.
      art: seatArt(run) ?? undefined, rim: "rgba(201,162,75,.55)",
    });
  }

  // Events sit under a live run and above everything else. A run can be LOST by
  // walking away and an event cannot, so it does not outrank one — but nothing
  // below this decays at all, and an event is the only row here that can be
  // used up. No `live` dot for exactly that reason: this file reserves the dot
  // for things that are running and can end without you, and an event waits.
  for (const e of openEvents(save)) {
    out.push({
      id: e.id,
      tag: e.tag,
      title: e.name,
      body: e.blurb,
      cta: "Challenge",
      onGo: () => go.onEvent(e),
      el: "DUSK", art: "/maps/dusk.webp", rim: "rgba(149,117,255,.5)",
    });
  }

  // Full Blight puts a real node on that region's map. It got there through
  // world progress rather than a timer, which is the closest thing the game
  // has to an event, and it is the one that changes what the map looks like.
  const blighted: StoryRegion[] = REGIONS.filter((r) => r.blightAt && blightLevel(save, r) >= BLIGHT_MAX);
  for (const r of blighted) {
    out.push({
      id: `blight-${r.id}`, live: true,
      tag: r.name,
      title: "The Blight",
      body: `${r.name} is at full shadow. A DUSK squad holds ground you already took — clear it and the shadow drops a level.`,
      cta: "Map", onGo: () => go.onStory(r.id),
      el: "DUSK", art: "/maps/dusk.webp", rim: "rgba(149,117,255,.5)",
    });
  }

  const shards = save.hero?.shards ?? 0;
  if (shards >= PACK_COST) {
    const n = Math.floor(shards / PACK_COST);
    out.push({
      id: "packs", tag: "Shop",
      title: n === 1 ? "A pack is waiting" : `${n} packs are waiting`,
      body: `${shards} shards banked · ${PACK_COST} a pack, one Epic or better in each`,
      cta: "Open", onGo: () => go.onShop("packs"),
      // No element sigil: a pack costs SHARDS. It was stamped DAWN, which put
      // a currency mark on the one row that does not use that currency.
    });
  }

  // Essence only buys the ONE card it was earned for, so "you can afford
  // something" is genuinely new information rather than a running total.
  const ready = CARDS.filter((c) => canCraft(save, c.id).ok);
  if (ready.length) {
    const cheapest = ready.reduce((a, b) => (craftCostOf(a.id) <= craftCostOf(b.id) ? a : b));
    out.push({
      id: "craft", tag: "Crafter",
      title: ready.length === 1 ? "One card is conjurable" : `${ready.length} cards are conjurable`,
      body: `${cheapest.name} costs ${craftCostOf(cheapest.id)} ${cheapest.element} — you have it`,
      cta: "Conjure", onGo: () => go.onShop("crafter"),
      el: cheapest.element,
    });
  }

  if (out.length) out[0].feature = true;
  return out;
}
