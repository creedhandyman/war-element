# Tutorial, onboarding and training

Moved out of CLAUDE.md to keep it short. Same text, same rules — read it before working in this area.

## The tutorial had the wrong half — `Onboarding.tsx`

`TutorialCoach` explains the RULES well (goal / mulligan / summon / move /
speed) but it only ever speaks **once a match has started**. Nothing told a new
player how to REACH that match, and the path is not guessable:

- A fresh save owns exactly ONE card (`STARTER_DECK`) and is owed one free pack.
- **`applyPack` adds to `collection` and NOT to `deck`** (`story.ts:1664`).
  Measured live: after opening the free pack the save reads
  `freePacks 0 · collection 6 · deck 1` — six cards owned, squad still one card,
  and the Home tile still says "1 CARD · CAP 6". Nothing in the app connected
  the pack just opened to the squad about to fight. **That is the cliff.**
- L1 Spring Village Outskirts was ALREADY the designed teaching fight
  (`isFirstBattle` → free deployment, formation sized one-for-one against what
  you field) and has carried the note "The tutorial" in its node data since it
  was written. It was simply never pointed at.

So `Onboarding.tsx` is the missing half — three steps on Home: open the pack →
put the cards in your squad → fight L1. Then it is gone forever.

- **DERIVED, NEVER STORED.** `onboardingStep(save)` recomputes from the save
  every render; there is no cursor to desync. Doing a step early skips it, and
  an existing mid-campaign save satisfies every condition and never sees the
  guide — so there is **no migration**.
- The squad step asks "are there cards benched?" (`collection` minus `deck`),
  not `deck.length > 1` — the honest test for the state a pack leaves behind.
- `ONBOARDING_SKIP` is a SEPARATE sentinel from the coach's `"SKIP"`: silencing
  the in-match lessons and silencing the get-to-a-match guide are two different
  decisions. `taught`'s sanitizer keeps any string, so no schema change.
- It blocks nothing — a card with a button, same posture as the coach, because
  the first node is a designed teaching fight rather than a rail.

Verified live on a wiped save through the whole lifecycle: step 1 → Shop/packs,
real pack open → step 2, squad built → step 3 → the map with L1 the only
unlocked node, then `cleared:["L1"]` → the guide is gone and Home's first child
is `home-logo` again.

## The first battle on rails — `ui/tutorial.ts`, `ui/TutorialRail.tsx`

Owner, 2026-10-04, from a tester: Home was overloaded on first open (a small-font
guide card over it), "redraw to 4" read as a puzzle, and in the first match they
did not know what to tap. Text shown before the player has done anything reads
as optional, so the first battle now TEACHES BY FORCED PLAY.

- **First run** (`needsFirstRun`: no `TUT_DONE`/`TUT_SKIP` in `taught`, nothing
  ever cleared, free pack still owed) opens on `FirstRun`: the title art and one
  Play button, plus "I've played before. Skip the tutorial." Everyone with
  progress keeps their Home. Also replayable from the Training Ground's
  **Basics** row (`onBasics`).
- **The match**: seed 1, Birch + Forest Deer vs two Grills (no abilities), 4x4,
  opening deploy `{P1:1,P2:1}`, mulligans pre-applied. BOTH seats are human so
  the AI loop leaves P2 alone; an App effect plays `enemyStep` (scripted, 1.1s)
  and `me` is pinned to P1. Each Grill's HP is set as it is placed (5, then 3)
  so each dies to one hit before it acts: no enemy strike, so no element aura
  (Burn, bark shield) ever fires. 19 beats: place (free), Pass, move, Attack +
  a DIAGONAL hit (the 8 squares), buy Forest Deer (RANGED, cost 2) with 3 Gold
  onto (3,3), priority back-and-forth, step onto their red home row, then the
  last Grill steps to (1,3) and the Deer shoots it 2 squares up its column —
  win on round 3. The ranged card (owner, 2026-10-04) replaced Cactus, which
  was bought and never acted: one line of range only ("up to 2 squares away,
  unless an enemy is in the way"); the rest is the Melee and Ranged lesson's.
- **Beats are derived, never counted**: `beatIndex(game, tutUi)` from beat 0
  every render, each `done` reading the board plus what is selected/armed, so
  letting go of a card steps back to "tap it". `TutorialRail` dims everything
  but a hole over the target (found by `data-def` on hand cards, `data-pos` on
  squares, `.pass-btn`, `data-verb` on ring verbs), re-measured every frame;
  while P1 cannot act the whole screen is held and the beat's `wait` line shows.
- **`tutorial-script.test.ts` plays it end to end** with `scriptedIntent`: every
  beat in order, win on round 3, (0,1) captured, no status or grown shield, no
  Grill hit, 3 Gold for a 2-cost ranged Forest Deer, one Birch hit and one Deer
  shot (from (3,3)). A stat or rule
  change that breaks the lesson fails there.
- **After it**: winning marks `TUT_DONE` in the settle effect; Continue goes to
  the Shop with the free pack ringed. The tutorial writes no history entry, no
  WinScreen, no skill-dial result.
- **Same pass**: the guide hides during the pack reveal and the level-up modal
  (one popup at a time); guide text 19/14.5px and every body one short line;
  mulligan copy "Tap a card to swap it for a new
  one." / "Swap N cards" / "Keep this hand". **L1 stops at its roster**
  (`buildFormation`, `firstFight`): with the pack opened first, one-for-one met
  six cards with six (the roster twice) and a Learning-AI seat won 76% in 17.6
  rounds; the roster once is 99% in 12.2 (80 fresh saves). The squad step is
  already rare: `foldIntoSquad` puts the first pack straight in when it fits.
- **CSS**: the rail lives beside `.tut-coach` (before `.draft-screen`/`.lvl-up`,
  whose tests scan to EOF for `infinite`). The rail's skip is `.tut-rail-skip`.
- **The second battle** (spells, Specials, shields) shipped next — see below.

## The second scripted battle — `ui/tutorial-magic.ts`

Owner, 2026-10-04. Training Ground → Basics, second row ("Spells, Specials and
shields"); never forced on anyone. Both battles are `TutorialDef`s
(ui/tutorial.ts) listed in `ui/tutorials.ts`; App keeps `tutorialRun = {id,
from}` and drives `create` / `beats` / `enemyStep` / `result` from the def. A
won battle writes its own `mark` (`TUT_DONE`, `TUT2_DONE`).

- **The board is SET, not dealt** (`summonCard` in `createMagicState`, decks
  empty, no deploy): Granite Armadillo (3,1) + Lazor (3,2) vs two GALE Dusters,
  near (2,1) and far (1,3). Patched: P1 starts with 2 Magic (3 in round 1), the
  near Duster 5 HP and +3 SP (it must act before Lazor so the soak is seen
  first), the far one 7 HP. Seed 1: the enemy has the first prep turn.
- **The lesson**: round 1 — Pebble Toss (1 Magic) on the far Duster: 3 damage
  and +1 shield to the Armadillo; the near Duster hits the Armadillo for 0
  (shields soak it, one wears off; the shield-hit plate plays); Lazor's Special
  (2 Magic, any range) kills it. Round 2 — the far Duster steps up and hits
  Lazor, who has no shields, for 5; the Special is recharging, so its basic
  attack wins. 9 beats.
- **Chosen so nothing else fires**: no statuses (GALE's power only adds speed),
  the Armadillo has no passives, Lazor's Special is plain damage. Shields on a
  board token are ONLY the silver end of its health bar (`tk-bar-sh`, no
  number), so the line says so.
- **Rail additions**: target kinds `spellbook` (`.spellbook-toggle`) and `spell`
  (`.spellchip[data-spell]`, added to SpellTray), `verb: "special"`; a beat's
  `pre` step is shown while its real target is folded away (the phone's closed
  spellbook); several matches → the first VISIBLE one (the desktop rail's tray
  and the phone's panel tray are both mounted). Not actionable while a cast's art
  flashes; the flashing spell counts as armed. Round-ending Pass beats use
  `prepOver` (both sides passed) so the enemy's last pass shows "The enemy
  passes." rather than the next beat's line.
- **Testing gotcha**: the rail re-measures on `requestAnimationFrame`, which a
  HIDDEN preview pane pauses — interleave screenshots when driving it.
- `tutorial-script.test.ts` plays both battles beat by beat (`it.each`), checks
  no status ever lands, and for Magic: the 0-damage soak (HP same, shields −1),
  the spell's shield landing first, one Special, Lazor's HP hit, the Magic
  numbers the beats quote.

## After the first battle: no lectures, one-line tips when stuck — `ui/struggle.ts`

Owner, 2026-10-04, playing L1 after the scripted battle: "a pop-up for every
single thing you do, making it hard to focus on battling." The first node lets
the player fight; they train once they notice they need help.

- **Gone**: `TutorialCoach` (goal/summon/income/move/speed cards, shown once
  each up front) and the five-card post-L1 tour (shards, Arena, Tower, the loop,
  "now train") with its skip machinery (`ONBOARDING_SKIP`, `canSkipGuide`,
  `skipLockedNote`, `tourPress`). `Onboarding.tsx` is now pack → (squad, rare)
  → fight L1, then nothing. `useCoachDock` moved to `ui/coach-dock.ts`
  (LessonCoach still uses it and the `.tut-coach` card styles).
- **`StruggleTip`** shows ONE small line under the phase ribbon (at the top: at
  the bottom it covered the player's own Home row) only on a struggle sign, read
  off the board by `boardStruggle(prev, next, seat, mem)`: an enemy took a Home
  square; a faster enemy killed my card before it acted (queue position + higher
  `effectiveSp`); the prep turn ended with my board empty and an affordable card;
  my Home row all mine with an affordable card; two rounds in a row broke with
  nobody home to earn. Plus idle tips (deploy / prep / battle) after 25 s with
  no tap or 45 s with no game step on my own turn — never on the mulligan, under
  a modal, or mid-action (`midAction` = something selected/armed/staged), and an
  idle tip leaves the moment the player acts. Nothing at game over (a surrender
  ends the prep turn too).
- **Limits**: board tips at most `TIPS_PER_MATCH` (2) a match and once ever;
  idle tips once per match per kind, 3 times ever. Counted in `taught` as
  `tip:<id>`, `tip:<id>#2`… "No more tips" sets the old coach's `"SKIP"`. Not in
  online, hot seat, a lesson or the tutorial; Domination gets idle tips only.
- **Loss screens point at training**: `TrainingNudge` ("Stuck on something?
  Practice in the Training Ground") on a story loss (StoryResult) and a vs-AI
  loss (WinScreen), while a lesson is still unwon.
- **One popup at a time**: the level-up waits for the match and its result
  screen (`showLevelUp`), not only the pack reveal; it used to stack on the
  story result. L1's node note no longer says "The tutorial."
- `struggle.test.ts` fires every sign on an edited real state, checks the
  silent cases, and plays the whole scripted first battle to show a well-played
  match never trips one.

## Training Ground — `ui/training.ts`, `ui/LessonCoach.tsx`, `ui/TrainingGround.tsx`

Owner, 2026-10-02: practice fights that teach statuses, melee vs ranged, the
element auras, crit, trample, evasion and the keywords. Opened from Home's fifth
tile (it spans the row on a phone).

- **A lesson is an ordinary match with both decks fixed** (`Lesson.you/foe`, 14
  cards each, 4x4, no spells, AI `"learning"`), its subject stacked into the
  opening hand (`youFirst`/`foeFirst` → `createInitialState`'s `stacked`). Dealt
  by App's `startLesson`; `trainingRun` (state, not derived from the lobby)
  marks the match. Any order, nothing locked.
- **Tips fire on what the board shows** (`LessonTip.when(game)`): the first BURN
  on any card, the first `CRITS` log line, a trampler beside a lighter enemy in
  Prep. LessonCoach queues each the first time it holds and shows them one at a
  time; nothing persists, so a refight teaches again. The rule text is QUOTED
  from STATUS_TEXT, `describeSharedPassives` and ELEMENT_AURA — never retype it.
  The card uses the `.tut-coach` look and `useCoachDock` (ui/coach-dock.ts);
  struggle tips are off during a lesson.
- **Pays once:** `completeLesson` adds the id to `StorySave.trainingDone` (in the
  loadStory whitelist) and pays LESSON_SHARDS in the same write; the last new
  lesson also pays GRADUATION_PACKS. It settles at the top of the Arena settle
  effect and returns, so a lesson never touches the skill dial, runs, the ladder
  or the Arena achievements. Rematch deals the lesson again; New Match goes back
  to the lesson list.
- **Balance, measured** (P1 on the full AI vs the learning AI, 40 seeds, scratch
  harness): reach 88%, statuses 83, auras 73, crit 93, trample 75, evasion 98,
  keywords 73. Re-measure after a card change to any lesson deck.
  `training.test.ts` checks every deck card is real, tips are unique and
  non-empty, the payout, the save round trip, and that each lesson plays out
  with its intro and at least two more tips firing.
