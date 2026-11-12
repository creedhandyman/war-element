# Economy and rewards

Moved out of CLAUDE.md to keep it short. Same text, same rules — read it before working in this area.

## Foil rerolls — what spare essence buys (owner's call, 2026-10-01)

A foil's bonus is HASHED from the card id (data/foils.ts) and stays the
default. Once a collection is done essence has nothing to buy, so the Shop's
**Crafter** lists your foils under the purse filter ("Foils · reroll a bonus"):
**Reroll · 100 essence of the card's element** (`FOIL_REROLL_COST`) rolls one of
the other three stats (`rollFoilStat`), then a dialog asks **Keep new / Keep
old** — the essence is spent either way, so a reroll never makes a card worse
(`rerollFoil` spends + rolls, `keepFoilStat` records the pick; closing the
dialog keeps the old). The card view shows the foil as ONE pill
(`.cd-foil-line`, "✦ Foil +1 DMG"), the reroll's result included.

- **Stored in `gifts`, not a new save field**: `foil:<card id>:<stat>`, last one
  wins (`withFoilMark` replaces). `loadStory` is a field whitelist, and an older
  build that loads the save keeps every gifts string but drops unknown fields —
  see the Hard-mode loss. `foilStatsOf(save)` reads them back.
- **In a match** the stat rides on the seat as `players[seat].foilStats`, which
  `summonCard` reads before the hash. App's `stampFoilStats` sets it for your
  seats on every deal (Arena/hot-seat, story fights, Void Tower trials, the
  rematch — which used to deal NO foils at all and now carries them).
- **Online**: the guest sends `foilStats` with its join (optional — an older
  client's foils play at the default); the host validates them against the
  four stats and stamps them into the state it broadcasts, so every client
  agrees without trusting a number per summon.
- `foil-reroll.test.ts` pins the roll, the ledger, the cost/element, a save
  round-trip and the summon.

## Pack element lean (owner's call, 2026-10-01)

The Shop's Packs tab has an **Element lean** row (Any + the eight elements).
With an element set, each card slot of `openPack` has `PACK_LEAN` (0.5) chance
to draw from that element alone (the guarantee slot too), else from the whole
set — about 56% of a pack, every card still possible. The coin is only tossed
when a lean is set, so unleaned packs roll exactly as before. First pick free,
stopping (back to Any) always free; leaning toward a NEW element after the free
pick costs `PACK_LEAN_CHANGE_COST` (50 shards) and asks to confirm. Stored in `gifts` as `packlean:<EL|none>` (same
old-build reasoning as the foil rerolls); `packLeanOf` / `packLeanCost` /
`setPackLean` in story.ts, and `packOdds(guaranteed, lean)` quotes the leaned
mix. `pack-lean.test.ts` pins the cost rules and the ~56% share.

## Earning against the AI

Three pieces, all in `src/data/`:

- **The ladder** (`custom-decks.ts`). Twelve premades in three rungs of four —
  `PremadeDeck.tier` is `easy | mid | hard`. Difficulty is the DECK, because
  `chooseBattleAction` is one rule set with no skill dial. easy is a melee pile
  with a top-heavy curve and no front line or healer; mid has a curve, a wall
  and a healer; hard floods cheap bodies, heals them, and shoots over the top.
  Against the six originals they win 33/50/62% on 4x4 and 21/34/59% on 5x5.
  The six stay UNTIERED — hand-tuned archetypes, not rungs.

  **The two battlefields are DECOUPLED.** A 5x5 build used to be
  `standard.cards ++ LARGE_EXTRAS[id]`, so the formats could never be tuned
  apart. They want different things: synergy weighting — picking cards that set
  up and pay off each other's statuses — measured **+5.5 on 4x4 and -5.9 on
  5x5** over 528 games a cell, both real. A tight ten-round board rewards a
  combo; a wide fourteen-round one rewards having an answer to more things. The
  4x4 hard decks are synergy-built now and the 5x5 ones are not. The cost is
  that a card changed in a 4x4 list no longer carries into its 5x5 twin —
  `premade-decks.test.ts` covers what the derivation used to give for free.

  **Card choice is otherwise spent as a difficulty lever.** Curve, comp, reach,
  cost cap, rarity, melee bias and mono-element have all been swept and hard
  lands 55-62% whatever they say. Two findings worth not repeating: MONO-ELEMENT
  is clearly WORSE (51-54%) because taking 30 of an element's ~39 buildable
  cards forces its weak ones in and gives up the other element's answers; and
  the cohesion metric is ANTI-CORRELATED with quality — the six hand-tuned
  originals score lowest on it (Inferno Blitz and Frostkeep both 0.00) while the
  weakest generated rung scores highest. A rung harder than this needs a knob
  that is not the deck; §10.6's opening allowance is strong (player 2 slots ->
  1 took hard to 82%/90%) but changes how a match starts.

  Two earlier cuts of this got it wrong and both are worth remembering.
  **Tiering on `rarity` inverted the ladder**: types.ts documents rarity as
  cosmetic, no epic in the set costs under 3, so "hard = epic and up" meant the
  top rung had nothing to cast on round one and lost to a rush in four. Then
  **tiering on a theory of good play** (front line, reach, sustain, lots of
  triggers) produced a ladder that measured FLAT at 4x4 and INVERTED at 5x5,
  where the "easy" swarm beat the "mid" comp 65% of the time.

  So it was tuned against a measurement instead: build a rung, play all four
  decks against the six originals, both seats, three seeds, read the win rate.
  What that found, and what future tuning should start from —
  **cheap-and-wide is the strongest thing a deck can do here.** The budget is
  `dmg*hits + hp + shields*2 + sp ≈ 5*cost + 10` and the +10 is FLAT, so a
  1-cost returns 15 stat points per gold and a 9-cost returns 6.1; capture ends
  ~95% of games and rewards having more bodies out. **Reach is second**, and
  the only lever that separates the 4x4 board, where sixteen slots cap what a
  flood is worth. **A front line and a healer help.** **Trigger density does
  NOT** — weighting it made decks measurably worse, because a trigger is paid
  for out of that same budget and the AI banks little of it.

  One structural gotcha: the 18-card build is a slice of the 30, and slicing
  the cost-sorted list wholesale preserved the curve while throwing away the
  comp (one hard deck came out with a single Support at 4x4 and seven at 5x5),
  which is what inverted the small board. Take three of every five out of each
  ROLE, so the 18 is the 30 in miniature on both axes.

- **Three MODES, not three overlapping selections** (`arenaGame` in App.tsx —
  `casual` / `streak` / `gauntlet`). Exactly one owns the lobby, the opponent
  seat, and the settlement, and switching away PARKS the others rather than
  scoring them. **Streak and Gauntlet are CHALLENGES**, and `startGate` is what
  makes that word mean something: the opponent chair is dealt in both (no
  `onChange` — Casual is where picking your own fight lives), neither will start
  "a normal match" (gauntlet mode with no run armed refuses, rather than quietly
  fighting a deck you picked), the battlefield is locked to a live run's board,
  and your squad must be the format's exact size. That last one is enforced
  NOWHERE ELSE — the engine never checked deck length — so a 30-card 5x5 squad
  would otherwise walk into a 4x4 gauntlet with twelve extra cards of depth.
  Casual warns instead of blocking; a sandbox is what it is for. Difficulty in
  gauntlet mode is its own control (`runTierPick`) — it used to be read off
  whichever deck sat in the opponent chair, which stopped working the moment
  that chair was dealt rather than chosen. This is load-bearing, not cosmetic: `settleArena` used to
  advance — and on a loss END — any live Gauntlet run, guarded only by
  `runOver`, so one casual match destroyed a run it was never part of. The
  caller now states `gauntletSeat`, and the ladder is likewise gated on streak
  mode (a Gauntlet seat was scoring on two ladders at once). If you add a fourth
  kind of AI match, it is a mode, and it says which settlements it belongs to.

- **The matchmaker** — the OPPONENT row in the Arena, shown in STREAK mode.
  Pick a rung, it rolls a deck from it, and re-rolling the same rung avoids the
  deck already seated. The old "OR PICK" manual rung row is gone: it let you
  hand yourself any difficulty and then climb on it, and it was dead weight
  besides — an off-rung match already scored nothing. Streak also deals the NEXT opponent the moment a match
  ends, off the rung you are on *after* it, excluding the deck you just beat —
  and the win screen shows what is queued (name, elements, rung, pay) with
  Fight and Leave as equals. Rematch stands down while a dealt opponent waits:
  it runs the same two decks back, which is the one thing a streak may not do.

- **The Gauntlet** (`gauntlet.ts`). Four dealt opponents from one rung, order
  fixed at the start, 10/18/30 shards on completion, one loss ends it. The four
  anti-farm properties are in that file's header; the important one for future
  work is that the run lives in the SAVE, not React state, so it cannot be
  re-rolled by leaving. `settleArena` is a pure function on purpose — the money
  path should be testable without playing four matches. **A win against a deck
  the player BUILT pays nothing**, which is what closed the original farm.
  It is not tamper-proof and the header says so; the claim is only that the
  honest path is no longer the slow one. A run now SURVIVES you playing other
  modes — leaving is a supported thing to do, and the mode strip shows a dot
  when one is waiting.

- **Online pays 10 for a win and 5 for a loss** (`onlineMatchShards`), the only
  mode that pays a loser, because a human opponent is not infinite the way the
  AI seat is. A CONCEDE pays zero, or the best rate in the game is two people
  surrendering to each other. Online settles on its own short path and touches
  neither the ladder nor a run — it used to fall through the arena's, where
  `won` was hardcoded to P1 and so paid a losing GUEST (who sits in P2).

Story teams carry their own spellbook (`Loadout.spells`, resolved by
`bookForLoadout`). Absent or empty keeps meaning "use the hero's shelf" —
every pre-existing team is that case — and the offer in the builder is gated
on what the hero has actually unlocked, because spells are earned by walking a
region.

### Squads

- **It is a SQUAD, on screen, everywhere.** The same saved object used to be a
  deck, a squad, a team, an army and a loadout depending on which screen you
  stood on — a tile marked "Deck builder" reading "No team saved" opening a
  modal titled "Squad Builder". `Squad` is also the only type (`squads.ts`,
  `we_squads_v1`); `CustomDeck` and `Loadout` are aliases. **"Deck" now means
  exactly one thing in user-facing copy: the pile you draw from once the match
  starts.** If you add a string, pick the right one of those two.

- **Both editors can do both verbs.** `DeckBuilder` was the only surface that
  could ADD a card and had no fill; `StoryPrep` had a fill and could not touch a
  single card. So the builder has **Auto-fill** (tops up, never replaces, and
  fills from the FILTERED pool — narrow to GALE Rangers and it builds GALE
  Rangers) and prep's chips are tappable to drop with an Add beside them. The
  builder's spell fill must NOT go through `autoDeck`: that reads `getDef`,
  which knows cards and throws on a spell id, and the two are both `string[]`.

- **The builder is one job per screen on a phone, a rail plus tabs on a
  desktop** (2026-09-27, reported as crowded). The phone builder was a card
  pool with a drawer rising over it, and the drawer carried a whole desktop
  rail — name, board, a second count and ruler, Save/Fill/Clear, three notes,
  the check, the list, two tool pills and whichever panel was open. Now the
  squad's NAME is the header; a phone has tabs Cards · Squad · Spells ·
  Library, with the count, Fill and Save in a bar under the thumb; a desktop
  keeps the squad as its rail — never behind a pill, since the old
  Composition default hid it — and tabs Cards · Spells · Squads & premades
  over the wide column. `phone` is live (a matchMedia listener) because it
  picks the whole tree, and the phone's back button walks check → Squad →
  Cards before it leaves the builder.

- **The campaign builder's cap and board follow the PREPPED NODE** when prep is
  open (`builderCap` / `builderBoard` in App.tsx), and the region's maximum
  otherwise. Those were quietly different numbers, and the region-max answer
  painted a 20-card squad legal that the 12-cap node in front of you then
  rejected. The cap line names the fight so the shifting ceiling reads as
  intent. Related: `buildSize` is `useState(props.boardSize)` and the builder is
  mounted all session, so it needs the prop-sync effect — without it the board
  freezes at the first render of the APP.

- **An empty spellbook was NO spellbook in the Arena** (fixed 2026-09-27).
  `clean` in squads.ts turned a missing book into `[]`, `resolveDeckSpells`
  passed it through, and the engine reads `[]` as "chose none" — so every squad
  saved without opening Spells fought with zero spells under a builder line
  promising an automatic book. Measured on the fill's 28 pair squads against
  the 4x4 premades: 44.0% with no book, 52.4% with the derived one, 26 of 28
  better. An empty book now loads as `undefined`, which derives.

- **The Squad Check says only what was measured** (`data/squad-check.ts`).
  Three lines: two 1-cost cards (the engine's `OPENING_CHEAP_MIN` opening
  guarantee), a 7+ ceiling equal to the heaviest premade on the shelf (4 of
  18, 6 of 30 — a test pins it to the shelf), and not one element (the
  ladder's mono sweep). The obvious checklist was built first and ablated on
  the fill's own squads, 3,360 games a line, and most of it MEASURED WRONG:
  six cheap cards by cutting the dearest -4.3, curve-neutrally +0.1, swapping
  every Tank for the best same-cost card of another class **+5.6** (18 of 26
  better), the whole checklist -4.6. Do not re-add Tank / Support / cheap /
  reach advice without an ablation. The Tank result is also a balance question
  for the owner — the swaps take the best card on offer, which flatters any
  swap a little, but no other swap measured came within four points of it.

- **Element count is not a power lever.** The old whole-pool Auto-fill was one
  deterministic stride over all eight elements: 30.3% on 4x4, 62.8% on 5x5.
  Offset strides over the same pool won 52-80 and 31-71; pair strides span
  26-92. Which cards land decides it. Auto-fill builds around a pair (or your
  element picks) because that reads as a squad, and says which. It is still
  `autoDeck` inside the pair — striding each element to an even share lost
  7.0 on 5x5 (5,040 games a side, held on fresh seeds) and was noise on 4x4.

- The builder's list rows are `.dbl-*`. They were `.dp-row` — the Arena squad
  picker's row class — and the later rule had been overriding the picker's
  padding, radius and border.

## Achievements and the daily login reward — `data/achievements.ts`, `data/daily.ts`

Owner, 2026-09-28: "an achievement system, and daily login rewards". The
owner's picks: a 7-day calendar that resets on a missed day; achievements paid
in shards, more for harder ones, a free pack for the hardest; Story, Void Tower
and Collection for the first batch, then "achievements for the Arena and online
matches too"; a screen off a Home tile.

- **Progress is DERIVED from the save, never stored.** Each achievement's
  `measure(save)` reads what the save already knows (`everCleared`,
  `bossesBeaten`, the collection, foils, `tamed`), so there is no second copy of
  the truth to drift, and a veteran opens the screen to a column of Claim
  buttons for things done before it shipped. Intended: it pays for the past
  once. What the save could not answer lives in `save.tally` (the `Tally`
  interface, story.ts) and counts from the day each shipped: packs opened and
  cards crafted (bumped in `applyPack` / `craftCard`), and the Arena and online
  results (`tallyMatch`, below).
- **The Arena and online counts** come from ONE call, `tallyMatch`, in App's
  match-settle effect — on the `settledMatch` guard that pays the match, in the
  same write. Arena: a win against an AI premade (`againstPremade`, the only
  Arena win that pays), a Domination win when `foes > 1`, and the best draft
  run. Never an event (they count as events; Void Trials are the Tower's) and
  never hot-seat, where one player can win both sides. Online: every finish
  counts as played, a win as a win — except a match THIS side surrendered,
  the rule that pays a surrenderer nothing (two friends conceding to each other
  is not a game). Each client counts its own side: the effect runs on both.
- **Arena wins read a proven floor** for a save that played before counting
  began: best Streak + 4 per Gauntlet rung cleared + the held draft run's wins —
  three different modes, so no win is in two. `max` with the count, never a
  sum, which would add a win twice once the count had seen it. Streak, the
  Gauntlet rungs, the draft and the two Home events are read straight off the
  save (`ladder.best`, `gauntlet.cleared`, `draft`, `eventsDone`).
- **Claims and the daily streak live in the `gifts` ledger** — `ach:<id>`, and
  ONE `daily:<YYYY-MM-DD>:<day>` entry — not in fields of their own. Older
  builds rebuild the save from the fields they know and drop a new one (how Hard
  mode lost its flag), but keep every string in `gifts`, so a claim can never be
  paid twice across builds. `tally` IS a new field, and an old build drops it:
  that only sets its counts back, never pays twice.
- **Ids are forever.** A ledger mark names an id — never reuse or remove one;
  retire an achievement by hiding it. A claimed achievement stays DONE when the
  save moves on (a tamed boss spent, a Hard run reset).
- **What it pays.** 50 achievements, ~2,450 shards and 7 packs in all (a pack is
  50 shards); packs only for The War Is Won, No Mercy (the Hard campaign),
  Master of the Tower, Complete Collection, Elite Gauntlet, Perfect Draft (7
  wins in one run) and Champion (50 online wins) — a test pins that list. The week:
  10 / 15 / 20 / 25 / 30 / 40 shards, then a free pack on day 7 — about 140
  shards and a pack a week. Free packs open in the Shop like the level-up ones.
- **A day is the device's LOCAL calendar date** (`localDay`); the day before
  comes from the Date constructor, so month and year ends come out right. A
  clock moved BACK after a claim cannot farm a day (`rec.date >= today` reads as
  claimed); forward is possible — nothing client-only is anti-cheat.
- **UI.** `DailyReward` is a card under Continue — it decays fastest — and
  re-reads the date on `visibilitychange`/`focus`, so an installed app resumed
  in the morning offers the claim. The Achievements tile opens
  `Achievements.tsx` (a lazy chunk; `homeAchievements` mirrors `homeCollection`:
  a back layer, cleared by `goTab`, in `ResumePlace`). `.home-prep` is two by two
  now: four across left "Squad builder" 79px wide on a phone.
- **The toast** (`AchievementToast.tsx`, main bundle, so it is ready when a
  fight pays out). App diffs the claimable set. What is claimable at BOOT is
  taken as known — a veteran gets the tile's count, not a dozen toasts — and
  anything newly claimable after that is queued and shown as ONE toast (the
  first named, the rest counted), so a cloud restore unlocking twenty is one
  line. Held while a match or its result, the level-up card, a pack (`packBusy`
  stays true through the "Pack opened" summary), a builder or a draft owns the
  screen; filtered to still-claimable ids; 5 s; a tap goes to Home and the
  screen, where it is claimed.
- **Achievements vs Trophies.** The profile's TROPHIES are boss heads worn as
  avatars (`earnedAvatars`) — a different thing, hence the name.
