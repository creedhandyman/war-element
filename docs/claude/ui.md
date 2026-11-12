# UI, game feel and performance

Moved out of CLAUDE.md to keep it short. Same text, same rules — read it before working in this area.

## Game feel — sound, the win moment, the turn cue (2026-10-13)

Owner asked for the game to be as intuitive and as fun as it can be. A new
player played the first ten minutes at 375x812 (real taps, headless Edge over
CDP) and these came out of it. The funnel that prompted it (play_funnel, Oct
7-12): 18 new devices, 5 finished the scripted first battle.

- **Sound** (`ui/sfx.ts`): the game had music and ONE chime. `playSfx(kind)`
  now covers tap, place, hit, break, win, lose, claim, turn and the pack's tear
  plus a flip that climbs with rarity (rare < epic < legend < mythic). All
  synthesized (no files), one limiter bus, per-sound min gaps, muted by the
  existing music toggle (`we_music_muted`), never throws. `renderSfx(ctx, kind,
  t)` draws onto ANY context, so a level check is an OfflineAudioContext render
  (peaks 0.05-0.45, no NaN). Phone speakers give up below ~150 Hz, so the
  thud is built from a mid-range knock; do not retune it on a desktop speaker.
  `buzz()` = short vibration (Android only), off for reduced motion.
- **What a step sounds like** (`ui/match-sounds.ts`): `soundsForStep(prev, next)`
  is a pure state diff (card arrived -> place, toughness fell -> hit scaled by
  damage, card gone -> break; a fresh board dealt at once, a lower round or a
  rematch = silence). `yourMoveReturned` = the soft two-note cue when
  `needsInput` hands the move back to you. `useMatchSounds(game, started,
  me !== null)` is called in App right after `me`. Tested, incl. against the
  real scripted battle (3+ places, exactly 2 breaks).
- **The win moment** (`ui/Celebration.tsx`): confetti (30 transform/opacity
  pieces, one burst, none for reduced motion) + fanfare + buzz on a win;
  just the low three-note sigh on a loss. Mounted INSIDE the `.overlay`, beside
  the modal (the modal scrolls and would clip it), in WinScreen, StoryResult
  and TutorialDone. Titles pop (`win-pop`), story recruits arrive one by one.
- **Turn cue** (`ui/turn-cue.ts`, `.turn-cue` in Hand.tsx): phones hide the
  hint line in every phase and the readout only speaks once a card is tapped,
  so the band above the hand was blank between taps. One pill there: "Lead
  with a card - your first is free" (opening deploy), "Your move - tap a
  glowing card to play it", "Not enough Gold yet - move a card, or Pass",
  "Their move...". Prep only; off in the scripted lessons and Training Ground
  (`cue={!tutDef && !trainingRun}`); quiet when the Home row is full (the hand
  already says so).
- **Tap, not click** (`ui/pointer.ts`): `tapWords(html)` rewrites click->tap on a
  coarse pointer; App's two `hint` render sites use it, RulesBook uses
  `tapVerb()`. Hover `title` tooltips keep "click" (desktop only).
- **Fewer popups after the first win (2026-10-15)**: the first level-up of a save
  that has never cleared a node is paid and shown as a toast (`LevelToast`,
  `quietLevel` in App) instead of a third card to dismiss after the victory card
  and the pack tally; one that carries a free pack, and every later one, keeps
  its full card. The tutorial's Skip is a quiet link INSIDE the instruction
  banner (`.tut-skip`), no longer a corner pill sitting on the phase ribbon.
- **Review pass (2026-10-16)**: the speaker button is three states now — all /
  effects only (🔉) / silent — via `we_music_muted` + `we_sfx_muted`
  (`nextSoundMode`, `useGameMusic`); a device that never set the effects key
  follows the music mute, as before. The tab bar shows a plain RED dot when
  something is waiting (`ui/nav-attention.ts`: Home = unclaimed daily reward or
  claimable achievements; Shop = free packs; the old rainbow dot still means
  unspent essence). The pack tally shows five full cards WITH NAMES (a title
  attribute does not exist on a phone); 54px so all five fit one row and the
  sheet keeps its gutters. **Pass guard (2026-10-16)**: `ui/pass-guard.ts`
  `shouldConfirmPass` — passing with NO card of yours on the board while a card
  in hand is summonable turns the button to "Pass anyway?" (4 s) and the second
  tap passes; once per round, never in the scripted lessons / Training Ground.
  Anyone with a card out, or nothing playable, passes silently. **NEW tags** were
  already in the Collection (`save.unseen`, `markUnseen` on every acquisition
  path, count on the Home tile); they now also show in the Deck Builder
  (`StoryBuildMode.unseen/onSeen`) and the story squad picker (`.sq-new`), and
  touching a card there clears it like opening it in the Collection. The badge
  background is solid (it was unreadable over bright art). NOT done, needs the owner: there is NO privacy-policy
  link anywhere in the game (Play's Data safety form needs one; telemetry is
  device id + app interactions), and the play_events funnel is polluted by
  automated opens (bursts of 20-30 devices an hour with zero engagement).
- **Retention pass (2026-10-17, from the retention review)**: (1) the daily
  reward no longer resets to day 1 on a missed day: a miss steps back one day
  (day 5 -> 4; a finished week just starts over; `LAPSE_DAYS` = 14 missed in a
  row starts the calendar from the top) — `dailyStatus` carries `steppedBack`,
  Home says "Welcome back — day N". (2) Once the first story node is cleared and
  nobody is signed in, Home shows a gold "Back up your cards" card
  (`ui/backup-nudge.ts`; "Not now" hides it a week, three refusals stop it,
  device-local `we_backup_nudge`, not in SAVE_KEYS) pointing at the account
  panel; telemetry `backup_shown` / `backup_tap`. (3) Analytics without the
  bots: telemetry skips `navigator.webdriver` browsers, and Supabase has views
  `play_humans` (devices that did more than open the app), `play_funnel_humans`
  and `play_retention` (cohort D1/D3/D7 among humans) — read those, not
  `play_funnel`, which counts the automated opens (169 devices ever vs 9 humans
  on 2026-10-17).
- **Daily goals (2026-10-17)**: three goals a day (`data/goals.ts`), shown as a
  Home card under the daily reward once the first node is cleared
  (`ui/DailyGoals.tsx`). WHICH three is a pure function of the date (one easy /
  medium / hard, never two on the same event; pool = play 2, win 1, win a story
  fight, win an Arena match, win 2, win 3, win 2 story, win 2 Arena), so nothing
  is stored or rolled. Progress and claims are ledgered in `save.gifts` for
  today only (`gc:<day>:<event>:<n>`, `gk:<day>:<goalId|bonus>`, other days swept
  on the next write) so an older build rewriting the save keeps them. Rewards
  10 / 15 / 20 (by tier) + `GOAL_BONUS` 15 once all three are claimed = 55 a day,
  about one pack — tune `GOAL_POOL` / `GOAL_BONUS`. Events come from ONE App effect
  on game-over (`goalSettled`), not the three settle paths; `goalEventsFor`
  decides what counts: nothing for a concession or a match under 3 rounds, never
  the tutorial / Training Ground / hot-seat; a story win is also `story_won`; an
  Arena win vs AI (not online, Void Tower or an event) is also `arena_won`. A
  claimable goal lights the Home tab dot (`navAttention`). Not done: goals about
  packs or crafting (they need shards to be possible), a streak across days.
- **Stalled fights (2026-10-17)**: a simulated first run had 13-27% of its story
  fights past round 30 (boards where both sides had played everything and sat at
  full health, or one card was slowly chipped down) — round 45 on a phone is
  not a game. Two OPT-IN engine rules (off unless set, so every other mode is
  byte-identical): `GameState.deadlockRounds` (the end-of-round board —
  `boardSignature`: who stands where at what HP, locked slots, hand/deck sizes,
  walls/traps/fields; NOT gold, Magic or round — unchanged that many rounds
  ends it on the board, `win.by = "deadlock"`) and `GameState.roundCap` (a
  shorter limit than `MAX_ROUNDS`; `decideOnTime`, same ladder: Home slots
  captured, then cards standing, then HP; a battle-log warning 5 rounds before).
  Both ignore Void Tower fights. Story fights set `STORY_DEADLOCK_ROUNDS = 4` and
  `STORY_ROUND_CAP = 30` in App's `fresh` state (data/story.ts has the
  measurement); StoryResult says "The fight stalled, and was decided on the
  board" instead of "won by elimination". Measured on 240 simulated fights
  (L2-L12, beginner dial on P2 via `weSetSkillSeat`): deadlock alone = 0 winner
  changes but catches only ~1 in 4 long fights (most are SLOW grinds, not
  frozen boards — LEAF regen and spawners keep the signature moving); with the
  cap, 2 fights changed hands (enemy win -> player win, a late landmark), mean
  20.4 -> 17.3 rounds, longest 50 -> 30. Arena/Quick Match vs AI were NOT
  measured and NOT changed. The harness: a scratch AUDIT_RUN test (starter +
  5-card pack + 2 recruits per cleared node, P1 default AI, P2 `learning`).
- **Two see-through panels**: `.gd-tip` (the first-run guide card) had a 16%-
  alpha gradient and nothing under it, so the page behind collided with the
  first sentence a new player reads — it has a solid base now. The pack reveal
  (`.overlay.pack-overlay`) is a near-black vignette so the shop's prices do
  not read through. Gradient-over-nothing is the thing to grep for.
- **Pack pulls show what they do**: the reveal card carries DMG/HP/SP in the
  board's colours and "class - attack type - N Gold" (`.pack-stats`).
- **The guide tucks itself away** (`GuideOverlay.tsx`): with no spotlight on
  screen (the step lives on another tab) the card minimises to its pill after
  9 s; a new step always opens in full.
- **Testing this on a phone-size pane**: the Browser pane's clicks land at 1/4
  scale under mobile emulation (and `computer` coordinates are 2x), so use a
  CDP driver (headless Edge, `Emulation.setDeviceMetricsOverride` 375x812 @2x,
  real `Input.dispatchMouseEvent`, and `--disable-renderer-backgrounding` +
  `Emulation.setFocusEmulationEnabled` or the rail's rAF stalls). To catch a
  CSS animation mid-flight, pause `document.getAnimations()` and set
  `currentTime`; do not race the clock. Never run two driver loops against one
  browser (they toggle each other's selections).

## A big board lags on the GPU, not the engine — what repaints every frame

Owner report 2026-09-28: "trouble keeping up" in boss fights on a full 5x5 and
much worse on the 7x7. Measured before touching anything: the engine and AI
are about 1 ms per `advance()` even in a four-seat 7x7, and React's commit is
~2 ms. The GPU was the bottleneck — its main thread pinned near 100%, nearly
all of it re-rasterising page tiles at the phone's pixel density.

Two causes, both fixed in one change:

- **Always-on animations of paint properties** (`box-shadow`, `border-color`,
  `outline-color`, `text-shadow`, `background-position`) repaint their element
  every frame. A tile is not a layer, so a pulse on a tile re-rasterises the
  BOARD's layer, every frame, for as long as it is lit. The contested Points
  and the Well on the 7x7, a threatened Home slot, a boss's blast zone and
  clock, the speed queue's next row, the card awaiting your call, every
  playable card and ready button, and every FOIL's sweep did this. Each now
  keeps the dim end of its pulse still on the element and fades the bright end
  in on a child layer's `opacity` (`.slot-cue` in Slot.tsx for the tiles,
  pseudo-elements for the rest); the foil sheen is a 260% `.foil-sheen::before`
  that slides one tile on `transform`. `styles.test.ts` ratchets the repainting
  always-on animations down to four, all off the battle screen.
- **The tile sigil was an SVG mask** — vector paths (two dashed rings) re-run
  for every square in a tile every time the tile rasterised. It was over half
  the GPU raster work of a battle step. `public/tile-sigil.png` is the same
  shape as a 256px alpha PNG; the test pins the mask to it.

Measured in headless Edge at a 412x915 phone viewport, DPR 2.625, before ->
after: 7x7 four-way battle 31 -> 54 fps (GPU busy 98% -> 24%); full 5x5 boss
fight with foils 31 -> 54 fps (98% -> 36%); idle on YOUR turn, with foils,
25-33 fps with the GPU at 100% -> 56 fps at 10-12% and zero repaints. Every
pulse was screenshotted frozen at its dim and bright points on both builds;
they match (the one real difference, a ring on the closed citadels, is fixed).

**The rule going forward:** an animation that runs for more than a moment
animates `opacity` or `transform` only, on a layer of its own. Anything else
is a repaint per frame, and on the board that is a whole-board raster.

**The main thread, next (same day).** With the CPU throttled 4x (a phone) the
main thread was the limit, and a battle step made App render ~5 times — the
strike lit, the step landing, the effects' pacing tick, a nested update — each
redrawing every square, every card and the speed queue, and re-reading layout
mid-commit. `Board`, `Slot` and `SpeedQueue` are `memo` now; App hands the board
props that keep their identity (`boardAim`/`boardPickCounts` kept BY VALUE via
`useSameValue`, because the selection state is reset with a fresh `[]` all over
App; `boardHandlers` call the latest handler through refs); `Slot` compares the
three objects Board rebuilds per render (terrain, POI suit, strike) by value.
Board indexes cards by square once per render, its card-slide pass reads no
layout on a render of the same game, the spotlight keeps ONE ResizeObserver,
and `--bar-h` is measured only when the bar is a new node (its observer does the
rest) instead of on every App render. At 4x: React work per step roughly
halved, long-task time per step on a full 5x5 ~30 -> ~17 ms. `board-memo.test.ts`
guards the wiring — an inline array or arrow function handed to `<Board>`
silently switches the memo off.

**The effects draw from a worker (same day).** What was left after that was the
effects layer's render loop running ON the page: while the Pixi ticker ran, its
rAF made the page produce a main frame on every vsync, and each one re-styled
every running CSS animation on the board (~50 ms of style, ~30 of paint, ~30 of
layerize per step at 4x). Switching the layer off at 4x removed 40-50% of the
main thread's work per step, and most of that was NOT Pixi. (Stopping its
Graphics from re-tessellating every frame was tried first: ~7% of the layer's
own time, and a few pixels changed. Reverted.) The layer now draws from a Web
Worker:

- `ui/vfx/worker-layer.ts`, the page's side, makes the same `.vfx-layer`
  canvas, `transferControlToOffscreen()`s it, and stands in for the
  `ImpactLayer`: every call is a `postMessage` and nothing waits for an answer.
  The one synchronous question, a signature's shake and lunge, is a table the
  worker sends with `ready`. `ui/vfx/vfx-worker.ts` runs the SAME
  `createImpactLayer`, given a `LayerHost`: the OffscreenCanvas, the size, the
  density, and `setVisible`, which messages the page (the element is the
  page's). `worker-protocol.ts` holds the messages and the support check and
  imports no Pixi, because the page loads it eagerly.
- Whatever `impact()`/`play()` are handed crosses by structured clone: plain
  rects and numbers, never a function or a DOM object.
- **Fallback:** `workerLayerSupported()` needs a Worker, OffscreenCanvas and
  `transferControlToOffscreen`. Any failure to START rejects, and `loadLayer`
  (use-spell-impacts.ts) builds the layer on the page exactly as before: the
  worker saying `fail` (an older Safari: no WebGL on an OffscreenCanvas, or no
  rAF in a worker), a script error, no `ready` within 10 s, a canvas that
  cannot be handed over. After a good start a crash only logs; the effects
  stop and the game plays on. **Phones default to the page** (`isTouch()`, 2026-10-17: black frames on a real phone, the worker having only ever been checked in an emulated one); `?vfx=worker` / `we_vfx_worker` = "1" puts one back. **Kill switch:** `?vfx=page`, or localStorage
  `we_vfx_page` = "1".
- `vite.config.ts` `worker: { format: "es" }`: Pixi loads its renderer as a
  separate chunk, and only ES worker output can split.
- **Pixel-identical, proven:** the deterministic effects lab (fake clock,
  seeded random; every element look, ice, every signature; 3634 frames) hashed
  straight off the framebuffer with `gl.readPixels` matches page vs worker
  byte for byte. Read back through a 2D canvas (`drawImage` + `getImageData`)
  the two differ by 1 on faint pixels: un-premultiply rounding, not rendering.
- Measured on a 7x7 four-way battle: at 4x the main thread went 70-72% -> 56%
  busy and its JS time fell by a third (long-task time per step only ~8%
  less); at 1x the main thread is as idle while the worker draws as with the
  effects switched off (15.0% busy vs 15.4%; 20.6% before).
  `vfx-worker.test.ts` drives the page's side against a fake worker and pins
  the wiring.

What the worker does NOT change: every main frame the page still makes (a
board step, a card sliding) re-styles each running CSS animation, so the rule
above stands.

## The bundle — what is in it, and what is NOT in the first chunk

Read the composition off the build's own sourcemap rather than guessing (
`vite build --sourcemap`, then attribute each generated byte to its source).
The single 390 KB gz chunk every visitor used to download was:

| | |
| --- | --- |
| `src/data/*` | 380 KB raw — the card and campaign tables |
| `src/engine/*` | 239 KB — combat, phases, rules, ai |
| `src/ui/*` | 221 KB |
| `@supabase/*` | 204 KB — auth + realtime SDK |
| `react*` | 192 KB |

`deferred()` at the top of App.tsx (the render sites are unchanged) puts each
reachable-by-tapping screen in its own chunk: shop,
gallery, rules, campaign map/prep/collection, draft, profile, account, tower,
chat, builder. **The builder needed its own wrapper** — it renders ALWAYS and
hides itself on `open={false}`, so a plain lazy would fetch it on the first
frame exactly like a static import.

**Not `React.lazy` any more** (2026-09-26, "a black screen for about a second"
on every tab). A lazy component suspends on its first mount even when its module
is already in the page, and React holds a suspended boundary on its fallback for
its 300 ms reveal throttle, so the first open of each tab was ~300 ms of blank
on desktop even after the warm. `deferred` now remembers the module once `load`
resolves (the warm or an open), and a mount that finds it draws it in the tap's
own frame. One not yet loaded draws nothing until it lands (no throttle), and a
failed load is thrown in render for `ScreenBoundary`. The warm runs in declaration
order, so StoryMap, VoidTower and Shop are declared first. Measured on the
production build: first opens 25-37 ms (next frame) vs ~318 ms live before.

Supabase is fetched at the tap that hosts or joins a room, and from the auth
effect **only when a session exists** — supabase-js keeps it in localStorage as
`sb-<project>-auth-token`, so a signed-out visitor never downloads the SDK.
`onlineConfigured` lives in `net/net-config.ts` (two env reads, no SDK) so the
Arena can disable Online immediately. **First load: 390 -> 311 KB gz, and it is
the only request.**

What is still in the entry chunk is there for a reason: `data/cards` is read by
the engine and by every screen, and the engine runs the match App itself
drives. Splitting either means restructuring App, not moving an import.

Verify bundle changes against `vite preview` (the production build), never the
dev server, which serves modules unbundled and tells you nothing about chunks.

## Card Gallery — the screen that shows what the other grids hide

`src/ui/CardGallery.tsx`. Every def in the game in one grid: **366 plates** —
339 CARDS (19 of them Void Tower bosses) + 27 TOKENS.

THE REASON IT EXISTS: the two card grids that already existed both filter, and
between them **46 finished paintings had nowhere to be looked at**. The deck
builder shows what you can draft; `StoryCollection` opens with
`CARDS.filter((d) => !d.boss)` and neither has ever touched the `TOKENS` array.
A player could only see a boss or a token by meeting one mid-match.

- **Reuses `CardView` in browse mode for the detail panel** rather than drawing
  a second one — that mode already renders Special, passives, keyword rules and
  lore from a bare `CardDef` with no `GameState` (its zones 3 / 3b / 2c). Two
  card panels is exactly how the pair this codebase used to have drifted apart.
- **Tokens need no special-casing.** Measured, not assumed: all 27 carry cost,
  rarity, cardClass, keywords, lore and every stat; 22 carry `tribe`; only 1
  has a `special`. So the same panel renders them.
- **No missing art, and it is test-enforced** — `art.test.ts` already covers
  `CARDS` *and* `TOKENS`. An audit across all 366 found 0 missing (and 18 orphan
  .webp files nothing points at). This grid is the only place all 366 render at
  once, so a hole here would be very visible.
- **`SPAWNED_BY` is derived, not authored**: a deep string scan of every def for
  a token id, because there are at least five fields that can spawn one
  (`summonSpawn`, `special.params.spawnToken`, `transformOnDefeat.into`,
  `reviveAs`, `onHitSpawn.token`) and a hand-written field list goes stale.
- **Tapping a tile opens the PAINTING, full screen** (`.gal-lightbox`), not a
  panel about the painting — the abilities are one more tap from there. Every
  other place this app draws a card uses `object-fit: cover` and crops it,
  including `CardView`'s own `.cd-art` (a 122x150 box); this is the one place
  the whole image is on screen. Arrow keys, swipe, and full-height tap columns
  page it; Escape steps back one layer (rules → painting → grid) rather than
  dumping you out and losing the filter.
- **A `contain` image in a `place-items: center` grid needs a DEFINITE track.**
  With `auto` rows the grid area sizes to its content, so the plate's own
  `max-height: 100%` resolved against a track the plate had already stretched:
  a 750x1000 card rendered at 750x1000 in a 720px viewport and hung off the
  bottom of the screen. Fixed with `grid-template-rows: minmax(0, 1fr)` plus
  viewport-unit maxes (`100dvh`, so a phone's retracting URL bar cannot crop
  it). Caught by measuring the DOM in a browser, not by reading the CSS.
- Perf for 366 tiles is `loading="lazy"` + `decoding="async"`, nothing more.
- Routed like `RulesBook`: a top-level boolean in App.tsx, mounted beside it,
  and added to the `!rulesOpen` guard that hides `BottomNav`. Opened from a
  third Home tile (`.home-tile.gal`). It never reads or writes the save.
- `.gal-grid` overrides `.db-grid`'s `max-height: 60vh` — that cap is a
  deck-builder PANEL rule and would box a full-screen gallery.

`src/engine/__tests__/card-gallery.test.ts` pins the ABSENCE of a filter (the
set is the whole set, bosses and tokens are non-empty, no duplicate ids) —
rendering is not tested because this repo has **no DOM test environment**
(`vite.config.ts`: `environment: "node"`) and no component tests at all.

## The UI after the mobile redesign

Eight landings took the phone match screen from a square board with 58x60 tiles
to a portrait board with 71x90 ones. If you are about to change layout, these
are the contracts that make it work — breaking one is easy and silent.

**Design tokens live in the ONE `:root` at the top of `styles.css`.** Type scale
`--fs-1..8` (10-34px), spacing `--sp-1..9`, radii, elevations. Do not paste a
second `:root` above it: for any duplicated name the LATER declaration wins, so
the new block loses and looks like it did nothing.

**The 10px floor.** No TEXT below 10px, anywhere. Glyph-only marks (status pips,
the auto letter) may sit at 9px because they are read as shapes. If something
will not fit at 10px it is DROPPED and rehoused, never shrunk — that rule is
what let four separate shrink mechanisms be deleted from the tile.

**The z-ladder is two bands, and the split is the point.** Band one (`--z-queue`
25 ... `--z-sheet` 62) is in-match chrome at its historical values — named, not
renumbered. Band two is full-screen surfaces: **overlay 300 < nav 350 < toast
400 < modal 500**. That ordering has been shipped wrong three times (nav at 60,
then 66, then 71 squeezed between 70 and 72). Raw `z-index` is legal ONLY as a
sort order inside a component that is already a stacking context — `.board` is
z-1 and owns the whole 0-11 ladder of slots, walls, tokens and damage floats,
whose ORDER carries meaning. `styles.test.ts` fails on any raw z-index >= 100.

**Every surface shown while the nav is up must pay for it in layout.** The nav
is deliberately above them, so clearance is `padding-bottom`/`margin-bottom`,
never a z-index argument. Missing it makes a button's centre untappable while
its corner still works — which reads as your thumb, not a bug.

**The board is no longer square.** `--board-size` is the WIDTH; `--board-h`
defaults to it and the compact tier overrides it to make the tile portrait.
`--hud-budget` is the single number for everything outside the board — lower it
and the board grows. Frame and seam are px, not %: a seam needs the same few
pixels at every size.

**`data-el` drives element colour.** Eight `[data-el="..."]` rules set
`--el-rim`, `--el` and the stripe pair. Do NOT re-add inline `style={{"--el":...}}`
— inline beats `[data-el]`, so a surviving one makes the whole block inert.
Alias `--el` INSIDE each rule, not once in `:root`: a custom property is
substituted at computed-value time on the element that DECLARES it, so a
`:root` alias freezes to the root value and every element goes gold.

**`CardView` is one component with a discriminated-union `mode` prop.** Both
modes reduce to a view-model BEFORE rendering, so no zone touches `game` — half
the engine calls it makes (effectiveDmg, cardMods, effectiveMaxHp) walk the
board and are unsafe in browse, where there is no GameState at all. Keep the
union; optional fields would let `props.game!` compile and crash five screens.
Pure def-to-text lives in `card-text.tsx` and is covered by a whole-pool test.

**A card next to the action ring opens on its SECOND tap** (owner, 2026-09-26).
The ring's chips are small (52x26) and sit on the squares around the acting
card, and `.wheel` itself is `pointer-events: none`, so a tap that just missed a
chip opened the card underneath. While the ring is up, `inspectTapped`
(App.tsx) only LINES UP a card within one square of the acting card, including
the acting card itself. The card is outlined via `selectedId`, and "Tap X again
to open it" is echoed into the phone's `.bp-hint`. A second tap opens it. A card
farther away opens on one tap, and a target pick never goes through it. The rule
is `underWheel` / `wheelTap` in ActionWheel.tsx; `linedUp` resets on a new acting
card, a verb armed or cancelled, or the ring going down.

**`HomeScreen.tsx` answers three questions in order** — where was I, what is on
right now, where do I prepare — ordered by what DECAYS. Home used to *be* the
collection, which was the right reaction to the landing card before it: a title
and two shortcuts, a menu pretending to be a destination. The rule that keeps
this from becoming that card again is that **every line is live state and every
tile carries a number that changed since you last looked**. The collection is
one tap down, from a tile, which is where the redesign puts it — building and
browsing happen BETWEEN fights and neither earns a permanent tab against four.

Two things to know before editing it. **The middle band has no event system
behind it.** The redesign proposes one (timed modifiers, "Double BORE essence
for 2d 04h") and says itself that it is a proposal; hardcoding that copy would
have put a pulsing LIVE dot next to content that never changes and never
expires. `buildLive()` reads real state instead — a Gauntlet run mid-flight, a
region at full Blight, shards that will buy a pack, essence that will buy a
card — ordered most-urgent-first, and the head of the list becomes the feature
card so the promotion cannot disagree with the ordering. Nothing true ⇒ the
band and its spacer both disappear, because a hole *between* content reads as a
failed load where a screen that simply ends reads as done.

**A number on a tile has to be about the place the tile opens.** The Collection
tile counts what is MISSING, not what is conjurable, because you conjure in the
Shop; the two rows that do send you to the Shop pass `openTab` so "Open" lands
on Packs and "Conjure" lands on the Crafter. Same reason the collected count is
`PLACED_CARDS ∩ collection` rather than `collection.length` — the collection
screen is one tap away and two screens disagreeing about how much you own reads
as a bug in both.

## The phone's back button — `ui/back-stack.ts`

Android's back gesture used to close the installed app from anywhere: every
screen here is state, and the browser only ever held one history entry. Now
every open layer owns an entry and every tab change records one, so back closes
whatever is on top, then retraces tabs, and leaves the app only from the screen
it opened on.

- **Anything drawn over something else registers itself** with
  `useBackLayer(isOpen, close)` (`ui/use-back-layer.ts`). App.tsx lists its own
  (sheets, full-screen tools, Story's sub-screens, the in-match overlays) in one
  block above its JSX; a component with a detail view of its own registers inside
  the component (DeckBuilder, CardGallery, StoryCollection, Shop, VoidTower). An
  overlay that skips this still works — back just closes whatever sat under it.
- **`isOpen` must be the same condition that draws it.** A layer registered while
  nothing shows eats a press that visibly does nothing.
- **Sticky layers keep the press**: a match (back opens the match menu, and does
  nothing once the result screen is up) and a draft (its exit discards a paid-for
  run). Surrender is never one back press away.
- A layer that closes itself rewinds its own entry, and anything recorded during
  that rewind waits for it to land — `history.back()` is asynchronous, and a tab
  switch in the same tap would otherwise be the entry that got rewound. Entries
  whose layer closed underneath another are skipped by back automatically.
- Tabs are recorded in a LAYOUT effect, so a child opening a layer in the same
  commit (Tower opening straight onto a just-tamed boss) stamps the right tab.
- The logic has no React in it and is tested against a fake history whose
  `back()` lands in a later task (`back-stack.test.ts`). Verified in the browser:
  tab back, overlay back, ✕-close without a wasted press, and back mid-match
  opening and closing the menu without leaving the match.
