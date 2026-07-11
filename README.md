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

- **Mulligan**: click opening-hand cards to send back, confirm, redraw.
- **Prep**: glowing hand cards are affordable — click one, then a glowing
  Home slot to summon (any number per turn). Click a board card, then a
  glowing slot to move (one move per priority turn). **Pass Priority**
  when done; two consecutive passes start the Battle.
- **Battle**: cards act in SP order (15 → 0). When one of yours is up,
  pick **Basic / Special / Skip**, then click glowing targets. Multi-hit
  cards (⚔X×N) and barrage Specials take up to N picks — spread them
  across targets or repeat one to stack; it fires at the cap, or press
  **Fire** early. The badge on each of your tokens cycles its auto mode:
  MANUAL → AUTO (basic only, never spends pool) → FULL (may fire Specials).
- **Win**: wipe the opponent out (board + hand + deck empty) or hold /
  permanently capture all 4 of their Home slots. An invader that survives
  a full round on a Home slot captures it forever.

## Architecture

```
src/engine   pure TypeScript, zero React — types, state, rules (legality),
             combat (damage pipeline + special-handler registry), phases
             (round loop + intent reducer + advance() driver), ai, rng
src/data     the 32 alpha cards as plain data (LEAF/PYRO for P1,
             BORE/DUSK for P2, 16-card decks — each card once per game)
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
  10-card decks — the full rules' visible-deck model returns post-alpha.
- **King of the Hill** mid-row bonuses, Spells/Traps, Talents, EQUIP, and
  all auras except LEAF **Photosynthesis** (+1 HP end of round, the one
  alpha aura hook) are out of scope. GALE/AQUA/BOLT/DAWN cards aren't in
  the set, so their statuses exist in the engine but are unused.
- Card adaptations from the source files (flagged in `src/data/cards.ts`):
  Alpha's conditional lifesteal → plain LIFESTEAL; Granite Armadillo's
  Curl Up → BLOCK 2; Clubber's coin-flip reflect → REFLECT 1; Widowbite
  gets STEALTH (as in the UI mockup) in place of its on-death passive;
  Rhe's Rigid Smash → 5 DMG + SLEEP one target; passives outside the
  alpha surface (on-summon effects, conditional buffs) are dropped.
  Pumpkin's Catapult and Haunt's Jacked are implemented for real
  (`ignoresHomeRule` flag / `drainMax` handler).
- **Specials have a one-round cooldown** (alpha balance change from the
  rules doc's no-cooldown wording — stops SLEEP/AOE spam): after firing,
  a card must sit out one full round before firing again.
- Rules interpretations documented in code: resource carryover caps at 10
  *before* the round gain; REFLECT damage returns through the attacker's
  own BLOCK + shield gate (no evasion/crit/reflect chains); a sleeping
  card flips its wake-coin whenever it would act.
