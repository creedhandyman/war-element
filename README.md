# War Element — Alpha Build

A playable vertical slice of the War Element TCG: draw → resource →
turn-based prep → speed-queue battle → win by **elimination** or **slot
capture**. One local human (P1, bottom) vs. a rule-based AI (P2, top).

## Run it

```
npm install
npm run dev      # → http://localhost:5173 (or --port N)
npm test         # 86 engine unit tests, headless (Vitest, no React)
npm run build    # tsc --noEmit + vite production build
```

## How to play

- **Deck select**: on launch (and after each match) pick your deck and the
  AI's from Leaf/Pyro, Bore/Dusk, or Aqua/Dawn, then Start Match.
- **Mulligan**: click opening-hand cards to send back, confirm, redraw.
- **Prep**: glowing hand cards are affordable — click one, then a glowing
  Home slot to summon (any number per turn). Click a board card, then a
  glowing slot to move (one move per priority turn). **Pass Priority**
  when done; two consecutive passes start the Battle.
- **Battle**: cards act in SP order (15 → 0). When one of yours is up,
  pick **Basic / Special / Skip**, then click glowing targets. Multi-hit
  cards (⚔N×D = N hits of D damage) and barrage Specials take up to N
  picks — spread them across targets or repeat one to stack; it fires at
  the cap, or press **Fire** early. The badge on each of your tokens
  cycles its auto mode: MANUAL → AUTO (basic only, never spends pool) →
  FULL (may fire Specials).
- **Win**: wipe the opponent out (board + hand + deck empty) or hold /
  permanently capture all 4 of their Home slots. An invader that survives
  a full round on a Home slot captures it forever.

## Architecture

```
src/engine   pure TypeScript, zero React — types, state, rules (legality),
             combat (damage pipeline + special-handler registry), phases
             (round loop + intent reducer + advance() driver), ai, rng
src/data     58 alpha cards as plain data across 6 elements, grouped into
             three selectable decks (leaf_pyro, bore_dusk, aqua_dawn) via
             the DECKS table; each card once per game. 8 Legendaries.
src/ui       React only renders state and dispatches intents
src/engine/__tests__   Vitest suites for milestones 1–8, incl. full
             AI-vs-AI matches, determinism replay, and both win paths
```

All randomness (shuffles, coin flips, SP tie-breaks, CRIT/EVASION/SLEEP
coins) flows through one seeded RNG in `GameState.rngState`, so any match
replays exactly from its seed.

## Alpha scope notes (deliberate)

- Per the alpha brief, this build uses a **draw/hand model** (5-card
  opening hand, draw 1/round, +1 every 5th, 7-card cap) with fixed
  17-card decks — the full rules' visible-deck model returns post-alpha.
- **King of the Hill is IN**: +1 DMG while in a Mid row, +1 board-wide
  per fully-controlled Mid row (tokens show live effective damage).
- Statuses follow the updated rules doc: BURN melts 1 shield per tick;
  FREEZE = SP 0 + half damage; WEAKEN = −25%; STUN blocks attack, move,
  and Special; SLEEP is a full skip until any hit wakes it; FRIGHTEN is a
  forced retreat (1 slot back if open) + movement lock, not a skip.
- Two deliberate deviations from the rules doc, per design rulings made
  in playtesting: **melee reach is the 8 adjacent squares** (doc says
  same/adjacent row with no column limit) and **Specials have a 1-round
  cooldown** (doc says no cooldown). The doc should be updated to match.
- Spells/Traps, Talents, EQUIP, and all auras except LEAF
  **Photosynthesis** (+1 HP end of round, the one alpha aura hook) are
  out of scope. GALE/AQUA/BOLT/DAWN cards aren't in the set, so their
  statuses exist in the engine but are mostly unused.
- Card adaptations from the source files (flagged in `src/data/cards.ts`):
  Alpha's conditional lifesteal → plain LIFESTEAL; Granite Armadillo's
  Curl Up → BLOCK 2; Clubber's coin-flip reflect → REFLECT 1; Widowbite
  gets STEALTH (as in the UI mockup) in place of its on-death passive;
  Rhe's Rigid Smash → 5 DMG + SLEEP one target; conditional-buff passives
  are dropped. Working passive surfaces: keywords, basic-attack status
  riders (`onHitStatus`), on-death retaliation (`onDeath`), **on-summon
  effects** (`onSummon` — free, fired through the same handler registry;
  a `spread` param projects a forward corridor toward the enemy — `spread`
  columns to each side, reaching one row for Melee or all the way to the
  enemy battlefield for Ranged, via `forwardAreaTargets`. Flamehound's Fire
  Blast = 3-wide far, Spitfire's Spit Shot = single-lane far, Fenrir's Fury
  Unleashed = 3-wide one row), Pumpkin's Catapult
  (`ignoresHomeRule`), Haunt's Jacked (`drainMax` handler), and Bearocks'
  Hibernation (`statusImmune` — negative statuses fizzle). Not yet:
  on-kill, on-being-hit, start-of-round spawns, token/minion spawning,
  and auras beyond LEAF's. Legendary specials that spawn tokens (Efy,
  Wraith) or move-and-strike (Skelider's charge) are simplified to their
  damage/status core for alpha; the flavor returns with the spawn system.
- **Specials have a one-round cooldown** (alpha balance change from the
  rules doc's no-cooldown wording — stops SLEEP/AOE spam): after firing,
  a card must sit out one full round before firing again.
- Rules interpretations documented in code: resource carryover caps at 10
  *before* the round gain; REFLECT damage returns through the attacker's
  own BLOCK + shield gate (no evasion/crit/reflect chains); a sleeping
  card flips its wake-coin whenever it would act.
