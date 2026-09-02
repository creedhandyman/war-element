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
  deckCapFor, freePacks, isCleared, isOpen, type StoryRegion, type StorySave,
} from "../data/story";
import { loadSquads } from "../data/squads";
import { activeAvatar, avatarArt, earnedAvatars, playerLevel } from "../data/player";
import { CARDS, TOKENS, getDef } from "../data/cards";
import { openEvents, type GameEvent } from "../data/events";
import { boardOfRun, runOver, runReward } from "../data/gauntlet";
import { decksForTier } from "../data/custom-decks";
import { deckArtUrl, finisherOf } from "./DeckPickerSheet";
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

/** What the Gallery tile counts: the WHOLE set, bosses and tokens included.
 *  Deliberately not `PLACED_CARDS` (what the campaign can drop) — that is the
 *  Collection tile's number, and the two tiles sit next to each other. */
const GALLERY_COUNT = CARDS.length + TOKENS.length;

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
  /** The reference book — every card, boss and token in the game, art and all.
   *  Sits next to Collection because that is where a player looks for a card;
   *  it is a different question, though, and the tile says so. */
  onGallery: () => void;
  /** Wear a boss head, or `undefined` to go back to the initial. Persisted by
   *  the caller; the picker here only ever offers heads the save has earned. */
  onAvatar: (cardId: string | undefined) => void;
  /** Open the account panel — email sign-in and the cloud save. */
  onAccount: () => void;
  /** Open the rules book. Home needs its own route because the onboarding card
   *  that renders HERE promises "you can still read How to play any time", and
   *  until now the only entry point in the whole app was the Arena lobby. */
  onRules: () => void;
  /** Open the story map on the FIRST node. The first-run guide's last step
   *  needs to land on L1 specifically; `onStory` only opens a region. */
  onFightFirst: () => void;
  /** Hide the first-run guide for good. */
  onSkipOnboarding: () => void;
  /** Signed-in address, or null. Only used to label the button, so the home
   *  screen never has to know how any of that works. */
  accountEmail: string | null;
}) {
  const { save } = props;
  const hero = save.hero;
  const heads = earnedAvatars(save);
  const worn = activeAvatar(save);
  const level = playerLevel(save);
  /** Next head in the earned list, wrapping through "none" so a player can
   *  always get back to their initial without a second control. */
  const cycleHead = () => {
    const at = worn ? heads.indexOf(worn) : -1;
    props.onAvatar(at + 1 >= heads.length ? undefined : heads[at + 1]);
  };
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

  /** Cards you own and have not opened yet. Scoped to the collection so a flag
   *  left behind by a card you no longer hold cannot inflate it. */
  const newCards = useMemo(() => {
    const owned = new Set(save.collection);
    return (save.unseen ?? []).filter((id) => owned.has(id)).length;
  }, [save.unseen, save.collection]);

  /** The squad you last took into a fight, by id.
   *
   *  NOT a search for the newest untagged one, which is what this used to do:
   *  since the two libraries merged, "untagged" means "built in the Arena", so
   *  that search would name an Arena deck as your campaign squad — and the prep
   *  screen one tap away would say otherwise. Two screens naming different
   *  squads is the bug this line exists to avoid, in both of its versions. */
  const teamName = useMemo(
    () => loadSquads().find((s) => s.id === save.lastTeamId)?.name ?? null,
    [save.lastTeamId],
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
  const events = useMemo(() => homeEvents(save), [save]);

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
          {/* THE HEAD IS A TROPHY. A boss you have beaten, worn — earned only by
              clearing the fight, and the only cosmetic in the game with no
              other route to it. Tapping cycles through what you have taken and
              then back to the initial, which is a picker cheap enough to live
              on the home row: with eighteen bosses in the game and most saves
              holding none or one, a modal would be a modal to choose between
              two things. */}
          <button
            className={`home-av${worn ? " has-head" : ""}`}
            onClick={heads.length ? cycleHead : undefined}
            disabled={!heads.length}
            title={
              heads.length
                ? `${worn ? getDef(worn).name : "No trophy"} — tap to change (${heads.length} earned)`
                : "Beat a Void Tower boss to wear its head"
            }
          >
            {worn
              ? <img src={avatarArt(worn)} alt="" draggable={false} />
              : (hero?.name ?? "?").slice(0, 1).toUpperCase()}
          </button>
          <span className="home-name">{hero?.name ?? "Keeper"}</span>
          {/* LEVEL = cards collected + bosses beaten. Beside the name because it
              describes the player rather than the run. */}
          <span className="home-lvl" title={`${new Set(save.collection ?? []).size} cards collected + ${heads.length} boss${heads.length === 1 ? "" : "es"} beaten`}>
            LV <b>{level}</b>
          </span>
          {/* Wrapped so the walkthrough can spotlight the two currencies as the
              one idea they are. `display: contents` on the wrapper keeps the
              flex row laid out exactly as before — but a contents box has no
              rect of its own to measure, so the guide anchor goes on the shard
              purse and the ring's padding covers the essence beside it. */}
          <span className="home-purses">
            <span className="home-purse p-shard" data-guide="home-purse" title={`${shards} shards`}>
              <i className="shard" aria-hidden="true" /><b>{shards}</b>
            </span>
            <span className="home-purse p-ess" title={`${totalEssence} essence, across every element`}>
              <i className="ess" aria-hidden="true" /><b>{totalEssence}</b>
            </span>
          </span>
          {/* Beside the purse because it belongs to the HERO — it is what says
              which account all of this hangs off — rather than in the tile grid
              below, which is about what to do next. */}
          <button
            className="home-acct"
            onClick={props.onAccount}
            title="Sign in to save your progress across devices"
          >
            {props.accountEmail ? "\u2601" : "\u2601\uFE0F"}
            <span>{props.accountEmail ? "Synced" : "Sign in"}</span>
          </button>
          {/* Beside the account button rather than in the tile grid: the tiles
              are about what to DO next, and this is a reference you reach for
              mid-thought. Small on purpose — a new player should be reading the
              onboarding card above, not this. */}
          <button
            className="home-acct"
            onClick={props.onRules}
            title="The rules — win conditions, phases, keywords and statuses"
          >
            {"❓"}
            <span>Rules</span>
          </button>
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

        {/* THE EVENTS, as a matched set. Their own section rather than seats in
            the band above, because that band promotes its head to a card and
            leaves the rest as rows — which rendered one of a matched pair with
            full-bleed art and its twin as a 26px sigil, on nothing but list
            order. Two tiles, identical treatment, each wearing the face of the
            deck it seats. */}
        {events.length > 0 && (
          <>
            <div className="home-lbl">
              <span>EVENTS</span>
              <em>One time only</em>
            </div>
            <div className="home-evs">
              {events.map(({ event, art, leader }) => (
                <button
                  key={event.id}
                  className="home-ev"
                  style={event.rim ? { ["--rim" as string]: event.rim } : undefined}
                  onClick={() => onEvent(event)}
                >
                  {art && <img className="home-ev-art" src={art} alt="" loading="lazy" />}
                  <span className="home-ev-body">
                    {/* The leader's NAME as well as its face: the portrait is
                        the hook, but "led by Imperator" is the part a player
                        can actually plan against. */}
                    {leader && <span className="home-ev-led">Led by {leader}</span>}
                    <span className="home-ev-name">{event.name}</span>
                    <span className="home-ev-cta">Challenge</span>
                  </span>
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
          <button className="home-tile deck" data-guide="home-builder" onClick={props.onBuilder}>
            <span className="home-tile-name">Squad builder</span>
            <span className="home-tile-sub">{teamName ?? "No squad saved"}</span>
            <span className={`home-tile-num ${deckEmpty ? "warn" : "ok"}`}>
              {deckEmpty ? "NO SQUAD" : `${save.deck.length} CARD${save.deck.length === 1 ? "" : "S"} · CAP ${deckCap}`}
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
          {/* NOT a third way to look at your collection. Collection answers
              "what have I got and where is the rest"; this answers "what is in
              this game at all" — including the bosses and tokens no other
              screen will show you. */}
          <button className="home-tile gal" onClick={props.onGallery}>
            <span className="home-tile-name">Gallery</span>
            <span className="home-tile-sub">Every card & token</span>
            <span className="home-tile-num">{GALLERY_COUNT} PLATES</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** The events still open to the player, with the face of the deck each one
 *  seats.
 *
 *  THE LEADER, not a region map. The two events used to wear `/maps/dusk.webp`
 *  and `/maps/dawn.webp` — the same backdrop the Blight row uses — which said
 *  "DUSK happens here" and nothing whatever about the fight. What you are
 *  actually walking into is a specific deck with a specific card at the top of
 *  it, so that card's portrait is the honest illustration: the Shadow Horsemen
 *  for Darkest Night, the Imperator for The Brightest Day.
 *
 *  `finisherOf` picks it — highest cost, biggest body on a tie — which is the
 *  same rule the Arena seats use to choose a deck's face, so a deck looks like
 *  itself wherever it is shown. Derived rather than authored per event: an
 *  event that changed its list would otherwise keep advertising a card it no
 *  longer runs. */
function homeEvents(save: StorySave): { event: GameEvent; art: string | null; leader: string | null }[] {
  // `!e.bossId`: Void Trials came off Home the day the tower screen shipped —
  // seven boss cards drowned the two real events, and a fight behind a locked
  // floor must not be reachable from here anyway. They still exist (the settle
  // path finds them by deck id); the Tower tab offers them, gated by floor.
  return openEvents(save)
    .filter((e) => !e.bossId)
    .map((event) => {
      const id = finisherOf(event.deck.cards);
      return { event, art: deckArtUrl(event.deck.cards), leader: id ? getDef(id).name : null };
    });
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

  // EVENTS ARE NOT IN THIS BAND ANY MORE — see `homeEvents` and the section
  // that renders them. This list is one feature card and a tail of plain rows,
  // and with two events in it exactly one of them got the art while its twin
  // got a 26px sigil: two halves of one matched pair, rendered as if they were
  // different kinds of thing, purely because of list order. They are a set and
  // they now look like one.
  //
  // Nothing below decays either, but the rest of this band is genuinely about
  // what is happening right now; an event waits, which is why it never carried
  // the `live` dot even when it lived here.

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
  const owed = freePacks(save);
  if (owed > 0 || shards >= PACK_COST) {
    // Owed packs count toward the headline and lead the body — beating the
    // event has to visibly change this screen, and "75 shards banked" is the
    // same sentence it showed before the reward landed.
    const n = owed + Math.floor(shards / PACK_COST);
    out.push({
      id: "packs", tag: "Shop",
      title: n === 1 ? "A pack is waiting" : `${n} packs are waiting`,
      body: owed > 0
        ? `${owed} free — yours to open · one Epic or better in each`
        : `${shards} shards banked · ${PACK_COST} a pack, one Epic or better in each`,
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
