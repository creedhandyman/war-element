# Story Mode and the campaign

Moved out of CLAUDE.md to keep it short. Same text, same rules — read it before working in this area.

## Story Mode

`src/data/story.ts` is the whole campaign layer: pure data + pure functions, no
engine runtime and no React, so it stays testable headlessly
(`src/engine/__tests__/story.test.ts`, ~40 tests). UI is `StoryMap.tsx`
(region map + node panel + the region's squad strip), `StoryRegions.tsx`
(the choose-a-map screen) and `StoryResult.tsx` (post-battle recruitment).

- **Nodes are placed on painted art.** `node.at` is a **percentage** of the
  region map's width/height, not a grid unit — resolution-independent, and the
  art can be re-exported at any size without moving a node. Maps live at
  `public/maps/<region>.webp` and are referenced by `region.art`. The maps are
  **3:2** (1536×1024), carried per region as `region.artRatio`
  (`MAP_RATIO`, 3:2, is only the fallback) and the canvas holds it; the road
  and fog SVGs use `viewBox="0 0 100 100"` + `preserveAspectRatio="none"` so
  roads, fog and nodes share one coordinate space with no px maths.
  To eyeball placement, render markers onto the art with PIL rather than
  screenshotting — the node ids and edges plot straight from `story.ts`.
  Two CSS rules are load-bearing and were both learned the hard way on a phone:
  `.story-canvas` must be `flex: none` (`.story-body` becomes a COLUMN on
  phones, and a growable canvas stretches to fill the height, overriding
  `aspect-ratio` and scaling the art ~3x tall since it is drawn with
  `background-size: 100% 100%`); and every stroked road class (`.trail`,
  `.trail-case`) needs `vector-effect: non-scaling-stroke` on its base rule, or
  the `viewBox="0 0 100 100"` + `preserveAspectRatio="none"` combination scales
  `stroke-width: 2` into a ~20px slab (`styles.test.ts` pins it). A third: the canvas is `width: calc(100% - 2 * var(--map-gutter))`
  with `margin: var(--map-gutter)`, and a breakpoint changes the VARIABLE, never
  the margin. It was `width: 100%` plus a margin, wider than its own column:
  `.story-main` scrolled sideways (558 wide, 582 of scroll at ~900px) and could
  be left scrolled with the map's left edge cut off, while on a phone the 16px
  margin was dead and the map ran past the squad strip's gutter.
  `styles.test.ts` pins this and `flex: none`. Node/badge sizes are
  `cqw`-based off `container-type: inline-size` on the canvas, so they track the
  map rather than the viewport — 42px at desktop's 1180px cap, the 23px floor
  on a phone (Thrones 54/29).
  **The map's look** (2026-09-28, mocked on LEAF, then shipped to all eight):
  a node is a MEDALLION. The button is a bare hit area and spans draw the
  marker — `sn-ground` (a shadow it stands on), `sn-glow`, `sn-pulse` (OPEN
  nodes only, opacity/transform so it passes the infinite-animation ratchet),
  `sn-rim` (metal) and `sn-face` (enamel). State is the rim's metal: iron
  locked, the region's `--el` open, gold cleared, bronze for a gate, violet
  for Blight, gold when selected or keyboard-focused. The shape rides on the
  rim and face (hex Landmarks, diamond Thrones, arched gates) — never clip the
  button itself: a clip-path cuts its border, shadow and outline with it,
  which is why the old hexes needed a drop-shadow stack for an edge. Roads are
  bowed quadratic paths (`roadPath`; the bend is taken on SCREEN through the
  ratio, the side alternates by id) over a dark casing; `live` = out of cleared
  ground, `next` = to a fight open right now. Fog of war is an SVG mask over the
  art with a soft hole per cleared or open node (`FOG_R`, a share of the map's
  WIDTH, `ry` scaled by the ratio so the hole is round on screen), drawn above
  the roads and below the nodes so a locked node is still findable. A region
  with EVERY node cleared drops the fog altogether, so the whole painting
  comes back.
  **The art was repainted for that look** (2026-09-28): text-free (the first
  maps had labels, cartouches, legends and compasses sitting under the
  markers and the fog), one painted landmark per node, all 3:2. Each map was
  painted in ChatGPT from a layout guide: the old art blurred, a ring per
  `node.at`, the roads drawn with `roadPath`'s own curve. Models still drift,
  so every node was then FITTED onto its painted landmark (overlay the art
  with PIL) and the layout checked: no road within 62px of a node it does
  not touch (about one marker, on 1536-wide art), markers at least 90px
  apart, the Blight spot included. Seven roads ran straight through another
  node's marker before that check existed. Refit rule: where a painting's
  roads follow the guide's trails, keep the node where the guide put it,
  because moving it pulls the trail off the road (BOLT); refit when a
  landmark drifted along with its roads (GALE moved 12 of 14).
- **Border gates (§7)**: a region is entered by CLEARING A GATE, not by clearing
  the previous Throne — the Throne only unlocks the gate. Gates are nodes of
  `kind: "gate"` on the SOURCE region's map, and `region.requires` lists the
  gates that open it, satisfied by **ANY** of them (not all): AQUA is reachable
  through LEAF's Eastleaf Port *or* PYRO's Sunfall Harbor, so an AQUA-first
  player never has to walk back through LEAF for the second road. Gate C exists
  twice, once on each side (`GC` / `GC2`), because it is bidirectional.
  A gate's squad lives in **`adds`**, not `roster` — it is a mixed border patrol
  of both elements and a checkpoint rather than a farm, so putting real cards in
  a recruitable roster would place them a second time. That makes gates the one
  exception to the adds-are-tokens rule. `gateCheck` enforces §7's two halves:
  deck length **exactly** at the cap, plus a composition demand. Gates take no
  Blight (a checkpoint is not territory) and `buildFormation` falls back to the
  patrol for its duplicate fill, since a gate has no roster to draw on.
- **GALE, BOLT and BORE are Act IV** — the **5x5 board**, cap 22, all three
  reached through Gate E on AQUA's map (§2: any order, so one gate opens them all
  — `gate.opens` is a LIST for exactly this). Six of eight regions are built;
  DUSK and DAWN are Act V and still need maps.
  **BORE has no tokens**, so its Warden filler is non-recruitable duplicate Rares
  already placed elsewhere in the region — the case the adds rule was generalised
  for ("farmable somewhere", not "must be a token"). Only PYRO and BORE need it. Gate E waits on **both** Green Thrones (P13 AND
  A13), which is §2's revision: arriving on 25 slots with only two elements can't
  field a functional 22-card list. That made `CAP_LADDER.unlockedBy` accept an
  ARRAY meaning ALL-of. Gate E is also the first gate to require a node in
  another region, so the two per-region graph tests exempt gates — the map's edge
  derivation already drops any prerequisite it can't find locally.
  Only **DAWN** still has no theme; `REGION_TRACK` has no entry for it so it
  falls back to the menu/battle pair, which is exactly the designed behaviour.
- **Regions**: LEAF (open), plus PYRO and AQUA (formerly `requires: ["L14"]` — the
  doc's Act II branch, neither privileged). Each carries its own `artRatio`
  (the first paintings mixed 3:2 and 4:3; every current one is 3:2), and
  forcing one shape would crop somebody's map. A region gate is
  separate from node gates, and `isOpen` checks BOTH — every region's entry node
  has no prerequisites of its own, so without the region check PYRO's P1 would
  read as open on turn one. Switching regions is `StoryRegions.tsx`, reached by
  **Maps** in the map header — one card per region with its art, nodes cleared,
  cards found and, when shut, the gate that opens it by NAME. It replaced eight
  element pills wedged into that header, which were the same size whether a
  region was two nodes from done or had never been opened. Story lands on the
  MAP, not the picker: continuing is the common case. A battle takes its board
  size and Blight from the NODE's own region (`regionOfNode`), never from
  whichever map is on screen.
- **The squad lives under the map** (`StorySquad.tsx`), not only inside prep.
  It used to surface one tap from a battle, which is the worst moment to learn
  your only healer is in another region. Locals fight free, so the editor only
  chooses what you CARRY; at home (`squadCapInRegion` returns null) everything
  fights and the strip says so instead of showing an editor that can't change
  anything. It writes through `packSquad`, the same call prep uses.
- **There is no Leave button on the map.** The bottom nav is on that screen and
  all three of its other tabs already leave; a fifth exit was one more thing in
  a header that had run out of room.
- **Overflow points forward, not back.** PYRO's northern border faces LEAF, but
  every LEAF card cheap enough to qualify is already in the 12-card starter — so
  bleeding one there would hand the player something they own on day one. Only
  the AQUA sea gate at Sunfall Coast carries overflow. A test enforces that no
  overflow card is in `STARTER_DECK`.
- **The art is the authority on geography.** LEAF's node graph was re-gated to
  match it: the Rot Line is in the far *south* (so L8 hangs off L5, not L7),
  and Rustling Woods is at Autumn's Gold in the *north-east* (so L7 hangs off
  L10, making the north arc run west→north→east). Overflow follows the painted
  gates — AQUA at Eastleaf Port (L7), PYRO at the Southern Burn (L8).
- **Edges are derived from `requires`**, never a separate table, so the drawn
  map can't drift from the gating actually enforced.
- **One card, one node** — `story.test.ts` enforces that every draftable LEAF
  card is placed exactly once, that no roster contains a token, and that **no
  node is dead on arrival** (a node whose whole roster is already in the
  starter deck can never pay out; L1 and L2 both shipped that way once).
- **A Throne opens SEATED** (`THRONE_HOLD_ROUNDS`, `throneSeatedCard`). The
  region's climax used to arrive like any other body — bottom of a
  cheapest-first `THRONE_OPENING_STACK`, affordable somewhere past round ten,
  frequently never — so the fight named after Oakgre could end without Oakgre in
  it. Its Mythic is now placed on the **centre of the enemy home row**
  (`centreHomeSeat`, the same square a Void Tower boss stands on) at match
  start, outside the economy, and **one copy is spliced out of the formation**
  so it is fielded once. It **holds that row for three rounds** — a round longer
  than a tower boss's `BOSS_HOLD_ROUNDS`, because a tower run is a built deck
  behind a wall of free Fortress Gates and a Throne is a node you walked to with
  whatever the campaign has given you. It HOLDS rather than freezes: it attacks,
  fires its Special, and slides along its own row; it just cannot advance.
  Mechanically the hold rides on the **instance** (`CardInstance.heldHomeRounds`,
  read by `bossHeldHome`) rather than on the card, because a Throne's Mythic is
  the reward for clearing the node and so can never carry `boss: true`. Nothing
  else changed: the win condition is still the ordinary one, there is no boss
  clock on it, and rewards read `node.roster` as they always did.
- **Recruiting**: one roll per captured slot (min 1); base odds by rarity
  (`DROP_RATE`), `PITY_STEP` per dry clear, guaranteed Mythic on a Throne's
  first clear. Owned cards drop out of the pool, so repeat clears self-target.
- **§10.5 Overflow**: `node.overflow` bleeds cheap Rares from the *neighbouring*
  region at **half base rate** (pity still accrues at full step, so a border
  card is slower but never unreachable). The card keeps its home node.
- **§10.4 The Blight**: DUSK spreads into **cleared** regions only — difficulty
  rises behind you, never in front — which is what makes it safe to be
  aggressive. `blightLevel` = `max(baseBlight, earned)` capped at 3; rises on
  **Throne clears anywhere**, never on idle time (farming is never punished).
  L1–2 add non-recruitable DUSK bodies to Warden-tier and up (Skirmishes and
  Thrones are spared); L2 contests the region's terrain; L3 spawns a generated
  **Blight Node** at `region.blightAt` that *does* drop DUSK — the only way to
  field DUSK early — and clearing it drops the level by one, flooring at the
  region's own `baseBlight`. A Blight Node is never banked into `save.cleared`
  (it can come back). **DUSK and DAWN are immune** (`canBlight`).
- **The collection** (`StoryCollection.tsx`) is the browser AND the story deck
  editor — the same question asked twice ("what do I own" / "what do I fight
  with"), so splitting them would just mean bouncing between screens. Its
  load-bearing half is **Missing**: every unowned card names the node that
  drops it and the live odds there, which is what makes pillar 3 ("you fight
  what you want to own") actually true. `sourcesOf` / `bestSource` in story.ts
  invert the placement data rather than duplicating it, so a node move can
  never desync the answer — tests enforce that every placed card resolves to a
  node that really lists it, and that a full-odds home always sorts before a
  half-odds border. The denominator is `PLACED_CARDS`, not the 300-card set, so
  the counter doesn't read as broken while regions are unbuilt; a card in an
  unbuilt region says "Not in the world yet" rather than appearing as a to-do.
  It opens OVER the map, so "Show" on a card hands a node id back via
  `focusNodeId` (consumed once, then cleared, or it would re-select forever).
  On phones the deck rail stacks BELOW the grid, where an always-open rail took
  more height than the cards it supports — it collapses to a sticky bottom bar
  there and stays open on desktop. Selecting a card force-opens it, since the
  card detail lives inside that collapsible body. Note `.col-wrap .story-body`
  is `overflow: hidden` for the desktop two-column scroll but MUST be `auto` on
  phones: nested scroll containers starved the grid to a 371px window holding
  9,945px of cards.
- **Music**: `useGameMusic.ts` keys off a TRACK, not a menu/battle flag. A story
  region owns the sound for both its map AND its battles (`REGION_TRACK`), so a
  region reads as a place and entering a fight doesn't restart the audio — the
  effect's deps don't change, so nothing re-plays. Regions without an entry fall
  back to the menu/battle pair, so shipping a map before its music is fine. The
  audio pool is built ON DEMAND: a player who never opens Story Mode should
  never fetch its themes. All tracks
  are 96 kb/s — they are looping ambience under SFX, and 320 kb/s masters cost
  3x the bytes for nothing. Transcode with the ffmpeg that ships inside the
  `imageio-ffmpeg` pip package; there is no system ffmpeg on this machine.
  `music.test.ts` guards the two SILENT failure modes — a `TRACKS` url with no
  file behind it, and a `REGION_TRACK` key matching no region id (which just
  plays menu music forever). It lists files with `import.meta.glob`, not
  `existsSync`, for art.test.ts's reason: existsSync on Windows is case-
  INSENSITIVE and would green-light a `City.mp3` that 404s on Vercel.
  All nine are also loudness-matched to **-16 LUFS** (EBU R128, two-pass, -1.5
  dBTP ceiling). They arrived 5.9 dB apart and every one of them clipped, so
  switching regions changed the volume. Normalize from the MASTER, not from the
  committed 96k file, or you stack two generations of lossy encoding.
  **Playback goes through `music-mixer.ts`** (owner, 2026-09-26: tracks came
  back mid-song, battle in/out was a hard cut, the bass was saturated). Each
  track feeds its own GainNode fader into one shared chain: a 40 Hz high-pass,
  a −5 dB low-shelf at 150 Hz (`BASS`), then the master volume. A change of
  track crossfades (`FADE_S`), a start from silence fades in (`START_FADE_S`),
  and a track that STOPS is rewound, so it always comes back from the top. One
  still fading out is picked back up instead. Fades are gain automation because
  iOS ignores `audio.volume`. The context is resumed inside a tap (every tap,
  since iOS suspends it on interruptions), and `navigator.audioSession.type =
  "playback"` keeps the old `<audio>` behaviour of playing through the silent
  switch. With no Web Audio it falls back to element volume. The browser pieces
  are injected, so `music-mixer.test.ts` runs on fakes.
- **HARD MODE** (owner, 2026-09-27; pinned in `story-hard.test.ts`). Beat every
  region's required Throne (`REQUIRED_THRONES`, `campaignComplete`) and the map
  offers a second run: `HardOffer` in StoryMap, two taps because the first one
  says what goes. `startHardMode` sets `hardRun: 1` and empties `cleared`,
  `blight` and `squads` (dead weight: a Hard run has no squad limit); the
  finished run is kept in `firstRunCleared`. Everything else rides through
  untouched: collection, hero (shards, essence, foils, chosen book), teams,
  per-region decks, pity, tamed bosses.
  **Hard must survive an older build** (owner-reported 2026-09-28: LEAF cleared
  on Hard, left, came back to a first run with the Hard clears on it and no way
  back). `loadStory` is a WHITELIST and every version of it was: a build from
  before a field existed drops that field the first time it writes the save,
  and keeps everything it knows. Nothing in the current app drops `hardRun`
  (every writer spreads the save; checked), so the strip came from outside it.
  The fix is to leave a trace old loaders keep: they keep every string in the
  `gifts` ledger, so `startHardMode` writes `HARD_MARK` there, and `loadStory`
  restores `hardRun` from the mark or from `firstRunCleared`. A save that had
  already lost all three gets `canResumeHard` (not on Hard, campaign not done on
  this map, yet every required Throne's Mythic owned — `THRONE_MYTHICS`) and a
  "Back to Hard mode?" banner on the map that puts it back on Hard WITHOUT
  resetting `cleared`. **Any new field that must outlive old builds needs the
  same treatment** — a copy in a list old loaders pass through.
  **The whole collection plays everywhere** (owner, same day): `squadLimitFor(
  save, region)` is null on a Hard run, so every region is home ground from the
  first node — what the first run only gets once DUSK's Throne falls.
  `poolForRegion`, `autoSquad`, `packSquad`, `squadIsOfferable`, StoryPrep and
  StorySquad all read it. `squadCapInRegion(cleared, region)` is the first
  run's ladder alone: never call it with a save in hand. The deck-size ladder
  (`deckCapFor`, 6 up to 30) still resets and still applies.
  **...and every spell** (owner, same day): `spellsUnlockedIn` treats every
  region as fully walked on a Hard run, so `heroSpellShelf` is all 80 — the
  deck builder's campaign offer (`spellPool`), the automatic book and team
  books all read it. A first run can finish on the Thrones alone, a region's
  depth short of its top spells (LEAF's shortest road to L14 is nine nodes), so
  this is more than the first run's shelf. The book's size (5/8), the cost-tier
  law and the builder's own-elements-only offer still apply.
  **Clears now have two readers, and new code must pick one.** `save.cleared`
  is the MAP: open nodes, the deck-cap ladder, squad limits, Blight, musters.
  `everCleared(save)` is the player's HISTORY: spells (`spellsUnlockedIn` —
  they unlock off clears, so a Hard reset would have emptied the book), the
  walkthrough (`firstFightWon` and the tour window in Onboarding.tsx — with an
  empty `cleared` a veteran was walked through the first fight again), the AI's
  opening rung (every `loadAiSkill`/`loadAiTrack`/`recordAiMatch` call in App),
  the profile's Nodes stat, `foldIntoSquad`, and the cloud-save chooser
  (`summarize` in net/account.ts counts both lists, or a finished campaign reads
  as a new save on the one screen that asks which save to keep).
  **Bigger squads, not bigger stats** (owner's pick; AI unchanged):
  `hardFormationSize` = cap x `HARD_FORMATION_SCALE` 1.5; `hardFillProfile` adds
  +10% Legendary / +15% Epic to every kind's quota; no Act I quota ease; Epics
  double everywhere; EVERY region musters; the opener's one-for-one welcome and
  the first battle's free placement (App, `!isHard`) are first-run only.
  Measured (both sides AI, 16 nodes across all regions, a veteran's deck
  auto-built from the region's element plus its heaviest imports, 40 fights a
  cell): 73% against first-run squads, 54% against Hard's. The climbs bite
  (LEAF's Throne 100 -> 28%, AQUA's 63 -> 20%, a GALE Warden 95 -> 40%); the
  first few fights stay gentle, since a six-card cap can still be six Mythics.
  A deck strided across the WHOLE collection (Fill, on a Hard run) is far
  weaker (LEAF's Throne 0%): eight elements give up the terrain and every
  pairing. Prep opens on the remembered team for the region, not on Fill.
  **A Void Tower boss holds every border** (`HARD_BORDER_BOSS`, `borderBossFor`):
  a Void Trial with the story deck. The encounter is `buildVoidEncounter`, the
  board is the tower's 5x5 (`fightBoardFor` / `BORDER_BOSS_BOARD`, pinned equal),
  and the seating is `seatVoidBoss` in `ui/void-seat.ts`, the ONE door shared
  with the Tower's `startArenaMatch` (boss, wall, Fortress Gates, rage, ally).
  Tower rules (slay to win, overrun, the 30-round clock); no terrain, no tamed
  ally. **A full Tower deck, not the Hard ladder** (owner, 2026-09-28: "not
  allowing you to use a full deck to be able to defeat the boss"): `fightCap`
  returns `BORDER_BOSS_DECK` (30) for a Hard border boss, so prep fills to 30
  and the builder opened from prep is sized for it (App's `builderCap` /
  `builderBoard` read `fightCap` / `fightBoardFor` there). `gateCheck` lets any
  deck from 1 up to that cross and drops the composition demand; the first
  run's gates keep their exact size. The ladder (15 at the first borders) had
  the Tower's bosses fought with half a Tower deck.
  **Floors 1-2 only**: floors 3+ are tuned around a tamed ally and were walls —
  Hoarfell at the Arctic Gate won 2 of 40, Spindle at the Shadow Border 0 of 40,
  and no DAWN boss cleared 8%. Each land guards its own shore: both roads into
  PYRO meet Smolder, both into AQUA meet Basilisk. Overclock held two borders
  until its own buff the same day (9x2, 72 HP, three Drones); after it the
  player won 0 of 60 at both, so Basilisk and Nightshrike took them. Shipped
  (60 fights a cell, a full 30-card deck; whole-collection stride / `regionFill`):
  GA Smolder 82/93%, GB Basilisk 52/87%, GC Basilisk 52/98%, GC2 Smolder
  82/87%, GE Nightshrike 68/40%, GF Hoarfell (side at 80%) 19/32%, GS Spindle
  (side at 46%) 45/32%,
  against the first run's own gate fights at 0-77% (mostly ~40%). Early borders
  are the easy end, Act V's the hard end. **The last two borders are the
  owner's picks** (2026-09-28): Hoarfell (floor 3) at the Arctic Gate over
  Permafrost, Spindle (floor 5) at the Shadow Border over Skeleeze — the two
  borders off floors 1-2, named in the test. Both were walls at full strength
  (5% and 0% with Fill), so both fight below their Tower strength
  (`HARD_BORDER_SCALE`: GF 0.8, GS 0.46, read by `borderBossScale`). **The
  scale covers the WHOLE ENEMY SIDE, not the boss**: `seatVoidBoss({ scale })`
  sets `GameState.sideScale.P2`, and `summonCard` — the one door every card,
  token and spawn comes through — scales each P2 arrival with `scaleInstance`.
  Scaling the boss alone could not move Spindle (7% at 30%): its line is "kill
  the brood, not the eye", and the nine-Watcher formation is the fight. The
  Tower's own fights never set `sideScale`. Both land at 32% with Fill; the
  curves are STEEP there (Spindle 12% -> 50% between 0.50 and 0.45), so move
  them in small steps. The sweeps are in the comment.
  A tower buff can wall a border overnight: re-run the borders after one.
  **The deck decides these numbers as much as the boss does**: premade decks
  trimmed to 15 cards lost to Smolder 92% of the time, where the story deck
  (with its Mythics) won 52%. Re-measure with the deck the player really has.

## Repo size

`.git` hit 1.08GB in Aug 2026. Almost none of it was history:

- **863MB was a dead Git LFS cache** — art was migrated OUT of LFS in Jul 2026
  (see `.gitattributes`) but the local objects were never pruned. `git lfs
  prune` reported *403 local objects, 0 retained* and freed all of it.
- **The repo had never been gc'd** — 6,878 loose objects, zero packfiles.
  `git gc --prune=now` took 219MB of loose objects to a 159MB pack.

Together: **1082MB -> 160MB, with no history rewriting.** Reach for `lfs prune`
and `gc` before ever considering a rewrite; the big binaries in history (50MB of
music, 82MB of superseded card WebP) are worth far less than they look, and
purging them would only reach ~120MB in exchange for rewriting every SHA.
- **Campaign overhaul (4x4 default / prep screen / one-sided opening)** — the
  campaign is a 4x4 game that opens to 5x5 only for its set pieces:
  `boardForNode` reads the NODE's kind (`BIG_BATTLE_KINDS` = landmark + throne),
  not `region.board` and not deck size. 82 of 115 nodes are 4x4, 33 are 5x5. The
  cap ladder runs 12/15/20/24/30 and `capForNode` CLAMPS it by board —
  `STANDARD_CAP` 20 on 4x4, `BIG_BOARD_CAP` 30 on 5x5. So the ordinary campaign
  is a 20-card game that opens to 30 for its set pieces, and both boards sit
  inside their constructed format again. The clamp can only LOWER the ladder, so
  an Act I Throne is still 12 rather than 28 against a starter deck. Both sides
  read it (`buildFormation` sizes the enemy from `capForNode`), so a set piece is
  a bigger fight on both sides of the board. `boardsLegalFor` was deleted — board
  no longer follows deck size. Opening deployment
  (§10.6) is now the PLAYER's alone: `ENEMY_DEPLOY = 0` replaced
  `enemyDeployFor`. `StoryPrep.tsx` sits between tapping a node and the battle —
  board/element/terrain/cap, the enemy roster, node lore, and **saved teams**
  (`StorySave.loadouts`, tagged by element, floated to the top by
  `loadoutsFor`). `StoryNode.lore` carries Story Bible flavour ALONGSIDE `note`
  (56 nodes); note is orientation, lore is place. **Also**: the Story
  Bible PDF names 15 champions by their PRE-rename names (Efy, Shock, Zoez,
  Warden, Season, Scar, Score, Diam, Steel, Rain, Commander, Sandman, Griffith,
  The DEEPEST, HOAX) — undecided whether the bible or the code moves.

- **Match report in Story Mode** — `MatchReport.tsx` is the end-of-match stat
  summary (MVP, per-side totals, per-card roster table), split out of
  `WinScreen.tsx` so both endings share it. `StoryResult` now renders it behind
  a collapsed "Match report" toggle, and a story **LOSS** stops on the result
  card instead of bouncing silently to the map — it used to tell you neither
  what beat you nor how close it was. `hasMatchReport(game)` gates the toggle,
  since `<MatchReport>` itself renders null when nothing measurable happened.

- **Formations (§10.7)**: an enemy squad is a FORMATION, not a deck — it may
  field several copies of a card. `formationSize` is now simply the player's
  **deck cap**: the enemy brings a WHOLE DECK matched to your card count, so a
  fight is decided by what the cards are rather than by who ran out of board.
  It is filled **mostly with Rares** — the node's own first, then the rest of the
  REGION's, because a 28-card deck cannot come from three unique cards without
  stacking nine copies of one. Region filler is non-recruitable and every card in
  it is placed on its own node, so nothing is made unobtainable; §6's promise is
  about the RECRUIT pool, which never widens.
  `FILL_PROFILE` gives each node KIND a Legendary/Epic quota as a share of the
  deck, and the power bands fill BEFORE the Rares. A Skirmish is 100% rank and
  file; a Throne is roughly 1 Mythic / 2 Legendary / 4 Epic / 5 Rare at cap 12
  and 1 / 5 / 9 / 13 at cap 28. **Act I runs its quotas at 0.75**
  (`quotaScale`): the starting deck is 12 fixed Rares with no rebuilding done,
  and the full share landed on it as a wall, so L14 is fought at 1 / 1 / 3 / 7. The Mythic is a guaranteed recruit on a first
  clear, so the fight has to earn it — a boss behind ten Rares did not. The
  roster always goes in regardless, so a node whose own cards already exceed its
  quota simply gets nothing more of that rarity.
  Epics double where it serves a purpose — `EPIC_DUPLICATE_FROM_CAP` (Act III)
  **or** `doublesEpics(node)`: gates, landmarks and thrones, the nodes meant to
  stop you. Gates carry a cheap Epic from each side of their border and Thrones
  one from their own region, on top of the Rare escorts.
  The old fill order, for reference:
  every unique first (four identical cards reads as a bug, not a boss), then
  tokens and Blight bodies, then duplicate Rares cheapest-first, then Epics.
  Caps scale with the tier via `copyCapFor`: Rares duplicate up to 3 at every
  Act, **Epics stay unique until cap 18** (`EPIC_DUPLICATE_FROM_CAP`, Act III) and
  double from there, Legendary and Mythic never. A second Epic is a second copy
  of a real Special every round, which is not what an Act I board should be
  padded with. The duplicate pool is drawn from roster + overflow **+ adds**,
  because a Throne's roster is a lone Mythic and a Gate has no roster at all —
  without them a boss fight was two bodies. Thrones also carry **2 Rare escorts**
  in `adds`, drawn from a tribe or locale they already command and farmable
  earlier in the region, which brings every Throne up to the tier target.
  The `adds` rule is **not** "tokens only" — it is that filler must never be the
  ONLY place a card appears, or it would be permanently unrecruitable. Gate
  patrols and Throne escorts are real cards on purpose; the test checks
  `sourcesOf(id)` rather than token-ness. It never TRIMS — a roster card dropped to hit the target would be
  unrecruitable that run. The load-bearing guardrail is that recruitment rolls
  once per UNIQUE card however many copies are on the board: duplicates are a
  difficulty knob, not a loot knob, and a test pins it.
- **Opening deployment (§10.6)** — **STORY-ONLY, and the CAMPAIGN'S FIRST
  FIGHT only.** The PLAYER leads with **one free teammate** before round one and
  the enemy gets nothing (`PLAYER_DEPLOY = 1`, `ENEMY_DEPLOY = 0`); every later
  node uses the ordinary summon ramp (`isFirstBattle` is the gate). It was once
  symmetric, one each and two for a Throne — the doc said so long after the code
  stopped. It matters for more than tidiness: it is why a Throne's home row is
  guaranteed empty at construction, which is what lets the seated Mythic below
  take the centre slot unconditionally. It shipped as a 4-card / 10-gold opening board and was scaled
  back — a whole formation landed before anyone had made a decision. One card
  asks the only interesting question ("who do you lead with?") and leaves the
  rest traditional. The placement costs **nothing**: `canSummon` skips the gold
  check while `state.opening` is set and the SUMMON intent skips the deduction,
  so a side at 0 gold can still place. Skirmish, online and Void Tower are
  untouched — `createInitialState`'s `opening` param is what turns it on.
  Implemented as a prep turn at round 0 rather than a new phase, so every summon
  rule, intent and bit of UI works unchanged; `movedThisTurn` stays true so
  nothing repositions yet. Two traps, both test-pinned:
  There is also a **cost ceiling** (`OPENING_COST_CAP`, in types.ts so rules.ts
  can read it without importing the phase machine). "Free" otherwise means cost
  stops being a brake for exactly one card and every side just leads with the
  biggest thing it drew — a Throne would open with its Mythic on turn zero.
  Two traps, both test-pinned:
  1. **Gold must not leak into round 1.** `doResourcePhase` carries gold (capped
     10) and *then* adds income, so anything seeded here would inflate the first
     turn. Round 1 must pay its normal +1 and no more.
  2. **A summon lands in the home row, which is exactly `boardSize` wide**, so
     slots are clamped to the board — granting more than that silently does
     nothing.

- **Save** is one localStorage key, `we_story_v1`, sanitized on load (unknown
  card/node ids are dropped). To exercise a mid-campaign state in the browser,
  seed it directly rather than playing forward.
