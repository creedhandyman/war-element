# Modes: Domination and Arena

Moved out of CLAUDE.md to keep it short. Same text, same rules — read it before working in this area.

## Domination — the third and fourth seats are the player's to choose

The 7x7 is the only mode that deals more than two seats, and the extra ones used
to be filled FOR the player: `modePremades.filter(not already seated)[i]`. So a
four-way free-for-all was three armies you could not see and one you could —
you were about to fight them and the lobby would not say what they were.

`p3DeckId` / `p4DeckId` are lobby state now, seated exactly like P1 and P2 and
resolved through the same `resolveDeckCards` / `resolveDeckSpells` — so a CUSTOM
deck is legal in seat three, and an id left over from another battlefield
degrades to this board's shelf the same way the first two do. Defaults are
distinct decks off the large shelf, so an untouched lobby still deals four
different armies.

WHERE THEY RENDER: below the versus card, not inside it. `.ar-vs` draws a DUEL —
two seats facing each other across a VS — and a free-for-all is not that shape.
The extra seats are a side-by-side row (`.ar-table`) in a neutral gold rather
than the opponent's red, because a third and fourth RED seat reads as three
opponents ganging up on you when in fact everyone is everyone's problem. Hidden
online (the host does not pick other people's decks) and in hot-seat (which
cannot deal more than two anyway).

The 7x7 draws from the LARGE shelf — `premadeDecksFor` matches `boardSize >= 5`,
so it offers the 30-card builds, which are the only ones legal there.

`domination-seats.test.ts` pins the wiring rather than the picker: a deck NAMED
for the third seat is the deck sitting in that chair, its spellbook comes with
it, and four seats still deal four distinct armies. Note `players[p].deck` is
the remaining DRAW PILE — the opening hand is already dealt off it — so a
seating check has to compare `deck + hand` or it finds 26 of 30 and looks like
the wrong deck.

**Specials that point "ahead" are AIMED here** (owner's call, 2026-09-29). On a
board you cross ahead is the only direction that matters; on this one the
Points sit in four corners and enemies come from every side, so a Special
locked to one direction could only threaten a quarter of the board. Every
shape laid out from its caster (`specialAimable`, rules.ts) is pointed by the
first pick: a corridor (`forwardDepth`, aimed before this), the row ahead
(`rowAhead`: Black Ice, Sakuroot, Killer Whale, Skull King, Season), the wave
(`surfsUp`), the lane (`sameColumn`: Coreborer), the far edge (`enemyHomeRow`:
Eagon, Masala), the far-row riders, and the column charge (`battleCharge`:
WarPhant, Equestrian, Rhino, Warkiln). How: `specialTargets` offers all four
directions (`specialAims`); `aimFor` turns the pick into the direction that
actually reaches it; phases.ts resolves the handler under `state.specialAim`
(removed straight after), which every "ahead" reads through `aimOf`, forward
without it — so off Domination nothing changed. The board aims them like an
anchored area (tap = aim, `previewSpecialAim` lights what it covers, Fire
commits); the AI points them where they catch the most (`bestAimPick`).
Left forward-only on purpose: Grand Finally (hits everyone anyway) and the
row of traps. `dom-aim.test.ts` pins one card per shape.

## Arena ladder — four three-element decks, one per rung

`custom-decks.ts` gained Verdant Tide (LEAF/AQUA/DAWN), Stormfront
(PYRO/BOLT/GALE), Deep Shade (DUSK/BORE/AQUA) and Eclipse Guard
(DAWN/DUSK/BOLT), each as a 4x4 + 5x5 twin pair. The shelf had two
three-element decks already (Tempest, Blight); it has six now.

**ONE PER RUNG, and each is built to its rung's PLAN rather than labelled with
it** — easy fields no Tank, no Support and no Mythic; mid and hard carry a comp
of 4+; hard is the densest ranged line, because reach is the axis that separates
that rung and nothing else. Every rung is six decks now.

**WHICH TRIO SITS WHERE WAS FORCED.** Elite caps each element at two decks and
GALE and DAWN were already at two, so Deep Shade (DUSK/BORE/AQUA) is the only
one that can join it. Easy is the tightest rung and its melee pool is nearly
exhausted — fresh melee non-Tank cards run 3/1/0 across LEAF/AQUA/DAWN — so its
build is high-reach by necessity and the ladder's reach ordering had to be
checked by hand before it shipped.

**ONE RULE WAS RELAXED, deliberately.** Elite required every deck to be exactly
two elements at 15/15. It now accepts two-at-15 OR three-at-10 — the property
being protected is an EVEN split, not the number two, and the coverage and
per-element-cap checks that make the rung a tour are untouched.

**FOUR INVARIANTS BIT ON THE WAY IN**, all of them real: the elite rung's shared
`scriptedOpening` (a scripted opening is worth 20+ points, so it is asserted to
exist on elite and NOWHERE else), the near-clone cap (a fifth of the deck shared
with any rung-mate, because `rollOpponent` only avoids the deck already seated),
the ordered min-cheap across rungs, and the reach margin. Fitting a deck to a
rung here is a constraint-satisfaction problem, not a label.

The constraints a new pair has to satisfy: 18 cards / 5 spells on 4x4 and
30 / 8 on 5x5, an `_5`-suffixed twin agreeing on name, note and tier, the same
element SET across both, spells in-element and unrepeated, and an even split —
6/6/6 and 10/10/10, which is the rule the element test already anticipated for
three.

**THE CURVE IS THE DECK, and this is worth remembering.** A second cut picked
the highest-rarity card in each element instead, and produced decks whose
CHEAPEST card cost 3. Gold starts at zero and accrues about one a round, so they
could not play until round three: **9.7%**. The cost-spread version they replaced
read 26-43%.

**AND THE CONTROL SAVED THEM.** At 26-43% against the top six premades they
looked weak enough to re-tune. Running the SAME harness over established decks
first: Tempest 75.0 · Deeproot Ambush 61.1 · Nightfall 53.3 · Frostkeep 50.0 ·
Inferno Blitz 46.7 · Blight 48.3 · **Radiant Host 26.7 · Scrapyard Reactor
15.3**. The shelf spans 15-75, so the new decks are mid-pack, not broken. This
file already warns that ablation needs a control group; the same is true of a
bare win rate against a hand-picked field.

## The Arena is two levels — `ui/arena-nav.ts`, `ui/ArenaScreens.tsx`

The Arena used to be one screen that asked everything at once: who you play (vs
AI / 2 Players / Online), the battlefield, the mode (Casual / Streak / Gauntlet /
Draft) and the AI's skill, as four or five stacked segmented rows above the
matchup — rows that came and went as you picked. Gauntlet, Draft and Online put
their real action mid-screen and left a DISABLED bottom button telling you to go
and press it. Rebuilt in September 2026 as:

- **The list** (`ArenaHub`): Quick match, Streak, Gauntlet, Draft, Domination,
  Play a friend — each a door with at most one badge (`hubBadge`: a live run, the
  rung, a price, or a lock when the player cannot afford it). Nothing is asked
  there. Build a squad / How to play live on the list, not on mode screens.
- **A screen per way to play**: `ArenaHeader` (back pill, title, one-line blurb),
  then only that mode's own question — Gauntlet's difficulty, Domination's
  opponent count, Play a friend's Same device / Online then Host / Join then the
  host's battlefield and players — then the matchup, then ONE bottom button
  (`arenaPrimary`) that is always the next action: Line up the … gauntlet, Begin
  a draft · 50 shards, Create room, Join room, Start … . Null on the list and in
  an online lobby, whose own buttons are the actions.
- **The settings row** (`ArenaSettings`): battlefield and AI skill behind one
  summary line ("4×4 · AI adapts to you"), AI screens only. It opens IN PLACE,
  not as a sheet: nothing to stack over the nav, nothing for back to close. In
  scored modes and events the AI's level is shown read-only.

What holds it together (all pinned in `arena-flow.test.ts`):

- **Every way into a mode screen goes through `enterArenaView`**, which applies
  `VIEW_SETUP[view]` — mode, match kind and the boards on offer. Both friend
  screens are `game: "casual"`, and that is load-bearing: the run settlements
  read only `arenaGame`, so a hot-seat match played while the mode still said
  "gauntlet" was scored against the run.
- **The 7x7 is not a battlefield on Quick match or Draft** — they offer 4x4 and
  5x5 only — and `boardForView` leaves the 7x7 behind on the way out of
  Domination (it carries only between the two friend screens).
- **Streak and Gauntlet list it in their settings row** as the third
  battlefield, "7×7 Domination", beside the 4x4 and 5x5 (owner, 2026-09 — it
  shipped first as a separate Duel / Domination toggle on the screen, and the
  owner moved it). Remembered per screen (`ArenaPrefs.dom`, written by
  `pickArenaBoard`; `VIEW_SETUP.*.dom` marks the two screens). The Streak and
  Gauntlet notes say what the 7x7 changes. See the next section.
- **An event belongs to Quick match.** `seatEventFight` lands there; entering
  any other screen with an event seated gives the P2 seat back and clears
  `bossRun`, so an event can never park a run.
- **No Rematch after an event** (owner, 2026-09-26): Darkest Night, Brightest
  Day and every Void Tower boss. `dealRematch` deals the two decks and nothing
  else (no scripted opening, no boss, gates or tamed ally), but the result
  would still settle as the event, which is read off the deck in the chair
  (`eventRun`). New Match leaves the event seated; Start Match deals it properly.
- **Remembered per device** under `we_arena_v1` — the screen, the last duel
  board, the last friend screen, each scored mode's format — and NOT in `SAVE_KEYS`. Restored at boot by
  re-running `enterArenaView`, so what is stored is the screen and everything it
  implies is derived.
- **Your chair opens on the squad you last fought with** (owner, 2026-09-26):
  `ArenaPrefs.deck`, written by `rememberMyDeck` where a fight is DEALT
  (`startArenaMatch`, `hostStartMatch`, a guest's first state), never at a pick,
  a rejoin or a rematch. It skips the draft deck and event decks. `p1DeckId`
  seeds from it through `openingDeck`, which falls back to the first premade
  when the squad has been deleted. Arena fights only: a story fight passes a card
  list, not a squad id.
- **Back**: a mode screen is a `useBackLayer` over the list — the
  `homeCollection` pattern. Re-tapping the Arena tab returns to the list, wired
  in BottomNav's `onTab` and deliberately NOT in `goTab`: the back stack restores
  tabs through `goTab`, and a restore must land where it left.
- Home's gauntlet "Fight" card opens the Gauntlet SCREEN. It used to set vs-AI
  and nothing else, so from Casual or Streak the run stayed parked and hidden.
- On a phone the header's back pill and the list's ribbon step past the floating
  mute button — the collision `.story-head` clears with its 44px.

## Domination in Streak and Gauntlet — `data/dom-ladder.ts`

Either scored mode can be played on the 7x7 now. Two rules, both in
`dom-ladder.ts` and pinned in `dom-ladder.test.ts`:

- **The table is DEALT, sometimes bigger than a duel.** Beside the seat's own
  deck: none half the time, one more three in ten, two more one in five
  (`EXTRA_FOE_ODDS`), from the SAME rung, never the seat's deck, never one twice
  (`dealExtras`). Streak deals it with every opponent (`dealStreakFight` — the
  matchmaker's button, the re-deal after a match, an off-rung seat; the one
  place `rollOpponent` is called) into `streakExtras`, and `reseatStreak` re-deals
  a stale table (`extrasFit`). Gauntlet deals every seat's table when the run is
  lined up and STORES it (`GauntletRun.extras`), drawn after the seat shuffle so
  a seeded run's four seats are unchanged — a big table you could leave and
  come back from as a duel is a reroll. `startArenaMatch` seats `ladderExtras`
  as P3/P4; the casual pickers stay casual Domination's.
- **The pay: Domination doubles a scored win, and every opponent past the first
  adds half again** (`tablePay`, `tableWinPay`). The half-again is the table's
  odds, not generosity: against F equal opponents you win about 1 in F + 1, and
  (F + 1) / 2 is what keeps the expected shards per MATCH level — so a big table
  is never the worse deal and never the farm. Streak: the whole duel price (flat
  win + ladder bonus) scaled, on a COUNTED win. Gauntlet: a won LIVE seat adds
  its table's bonus (`settleArena`'s `tableBonus` — not a parked run, not a
  Rematch after the run, not against your own deck), and the clearing reward
  scales by the run's tables averaged over its seats (`runReward(..., extras)`,
  `runRewardOf`). The foe count is read off the FINISHED match
  (`seatsOf(game)`), and the screens quote the same function the settlement pays.

A held Point also shows WHOSE it is: the holder's suit above the letter on its
citadel (`poiHolderSuit` in shared.ts), in that seat's suit colour. The letter's
colour is viewer-relative, and in a free-for-all "held against you" has three
answers.
