# Cards and spells

Moved out of CLAUDE.md to keep it short. Same text, same rules — read it before working in this area.

## The card text was lying in four places — and how they got there

A text audit found the game telling the player things the engine does not do.
All four were one-to-three-line fixes; the interesting part is the SHAPE, since
each will recur:

1. **FREEZE said "takes half damage dealt"** — the engine halves what the frozen
   card DEALS (`effectiveDmg`, state.ts:703). The one status text a player might
   have been pleased to see was describing a drawback as a benefit. The rules
   book had it right: TWO SURFACES DISAGREEING, with the wrong one on the panel
   you read mid-fight.
2. **PARALYZE quoted a dead threshold** — "no effect on SP 7 and under" against
   `SP_SLOW_MAX = 5`. A hardcoded number that drifted when the constant moved.
   It reads the constant now.
3. **Four keywords rendered as silent chips** — `describeSharedPassives` stopped
   at TRAMPLE, so FLYING (31 printings, the most-used keyword in the game), CRIT
   (14), PEN and STEALTH had no rule on the card at all.
4. **Six rules-book numbers had drifted**: the 5x5 deck (28 vs 30 — following
   the book built an illegal deck), gold income (printed flat, actually ramps
   1→5 on Magic's bracket), the Magic table (stopped at +4 of 5), the SP range
   (15 vs `GALE_SP_CAP = 21`), and two "all four" phrasings that are board-size
   driven (five on the large board).

**THE GUARD HAD TO BE RE-ARMED IN THE SAME COMMIT AS (3).**
`card-text.test.ts` flagged hidden mechanics with
`describePassives(d).length <= 1` — a count over ALL lines that assumed exactly
one shared line. Every keyword added to the shared list raises that floor, so
adding FLYING text alone would have silently excused 31 cards from the check
forever. It asks `describeOwnPassives(d).length === 0` now — what the card says
about ITSELF — which cannot drift as the shared list grows. **A test that counts
lines is a test that a new line disarms.**

**AND A NEAR-MISS WORTH KEEPING.** The book's "Full-lane bonus: hold all four
slots" looked fabricated — the only `midLaneFull` in the codebase is one card's
`basicBonus` (cards.ts:655). The core rule is REAL, at state.ts:715-723, and
only the count was wrong. Reading the engine before rewriting is the only reason
that commit corrected a number instead of deleting a working mechanic.

HOW TO PLAY now opens from the in-match `⋯` menu and from Home. It previously
had ONE entry point in the whole app (the Arena lobby) while the onboarding card
on Home promised "you can still read How to play any time".

## Spells — copies are legal now, and everything treated a book as a SET

A spellbook used to hold **one of anything, always** — `spellbookFromIds` deduped
through a `Set`. Copies are allowed by COST TIER (`SPELL_COPY_CAPS` /
`spellCopyCap` in `spells.ts`): **cost 6–10 → 1, cost 3–5 → 2, cost 1–2 →
unlimited**, all still bounded by the book itself (5 on 4×4, 8 on 5×5). The tier
is a ceiling per spell, not per book.

**Relaxing the builder was the small half.** Five places downstream identified a
spell by `find(s => s.defId === id)` or stored one in a `Set`, and every one of
them broke silently on the second copy:

- `rules.ts canCastSpell` — found the FIRST slot and read its `used`, so casting
  copy #1 refused copy #2 with "Already cast this game". The copies were in the
  book, in the tray, unspent, and unreachable. Now: *are ALL copies spent*.
- `phases.ts CAST_SPELL` — the same `find` on the spend side re-marked the
  already-used slot, so the second cast consumed nothing and was repeatable.
  Now: `find(… && !s.used)`.
- `story.ts` save load — `[...new Set(l.spells)]` threw the player's second copy
  away every time the save was reopened. Now counts to `spellCopyCap`.
- `SpellTray.tsx` — duplicate React `key`, and `armed` matched on id so BOTH
  copies lit up for one cast. Only the copy that will be spent wears the state.
- `App.tsx` opponent cast-flash — diffed a `Set` of used ids, so the opponent's
  second cast of a duplicated spell changed nothing and never flashed. Counted
  now.

THE LESSON: `defId` stopped being a primary key for a slot. Anything that
answers "which slot is this spell" has to answer "which COPY", and the four
downstream bugs were all one grep (`spellbook.*find\|new Set(.*spell`) away.

The builder tile CYCLES rather than toggles — tap adds a copy, tapping past the
spell's own cap clears it — and the corner mark carries the count (`×2`) so a
book with two of something can be read back.

## Spells — the "written but never read" bug class

**RECON PING DID NOTHING FOR ITS ENTIRE LIFE.** It set
`players[foe].handRevealedUntilRound` and NOTHING anywhere in the app read that
field — not the UI, not the engine — while the card's own comment claimed "the
reveal is information only, the UI reads it". A Cost-2 spell whose headline
effect was a number no one looked at. `Board.tsx` reads it now (the opposing fan
turns face up for the round, art and all, with "HAND EXPOSED" replacing "deck
hidden").

**AUDITED ALL 80 SPELLS FOR THE SAME SHAPE. Nothing else is dead.** Three levels,
because the cheap check is not sufficient:
  1. every spell produces a real state change when cast — all 80 pass;
  2. every spell-effect FIELD has a consumer — 31 distinct fields, none
     write-only. Five `field:` keys looked dead to a string-key grep
     (burnPersists, enemyMissChance, extendStatus, flowRepick, kinds) and all
     five are read by PROPERTY ACCESS instead, so grep counts alone lie;
  3. no `PlayerState` field is write-only, which is the exact shape of the bug.
     `handRevealedUntilRound` was the only one.

THE FIRST CHECK IS THE FLOOR, NOT THE CEILING, and the pinned test says so:
Recon Ping would have PASSED it before the fix, because it did change state (it
set the field) while doing nothing observable. Catching that class needs level 2
or 3.

Writing the harness is most of the work: a spell that appears dead is usually the
harness. Element-gated heals and commands refuse without a WOUNDED SAME-ELEMENT
ally ("No BORE ally to heal"), enemies must sit outside their home row for the
Home-Slot rule, wall/aoe spells need a bare `row`, and swap/reroute need
`targetIds` + empty `slots`. Eleven spells looked broken for those reasons alone.

**TOTAL NETWORK CONTROL** was a different fault — it worked and was trivially
bypassed. It sprayed MUTED once, so the answer to a Cost-10 ultimate was to
summon a fresh card. It is a LOCK on the player now
(`networkLockUntilRound`, 3 rounds), applied AT THE SUMMON SITE as well as at
cast, so reinforcements arrive muted too.

## Heroes are gone; suits stay

Heroes — one per suit (Warlord/Muster, Sentinel/Hold the Line, Mage/Arcane
Focus, Scholar/Requisition), a free once-per-game power chosen per deck in the
builder — were REMOVED in September 2026. The case, from replaying 160 AI-vs-AI
matches with heroes off and on (same seeds, decks and dealt suits): the power
fired in 94% of seat-games, yet seats that used it won 51% both ways (26 games
flipped to a win, 25 to a loss); first-player win rate 43% vs 44%; 11.8 vs 12.2
rounds. A rule, a button and a builder choice that did not change who wins.

What went: `heroes.ts`, `GameState.heroes`, `PlayerState.heroPowerUsed` and
`freeSummon`, the `HERO_POWER` intent, the AI's `aiHeroPower`, `canChannel`
(Arcane Focus was its only user), the spellbook's hero chip, the Deck Builder's
hero panel, and the per-deck `suit` pin with its online relay. Old saves' pins
are dropped on load (`clean` in squads.ts, the loader in custom-decks.ts).

What STAYS: suits. `dealSuits` deals one per seat every match; `SUIT_STYLES` /
`styleOf` decide how an AI seat plays — in the same replay the dealt style moved
results more than the powers did; the glyph and colour are the seat's identity on
the board and the versus screen. `pinSuit` is kept for tests and balance runs.
Don't bring back a per-deck suit pin without a reason for a player to want one:
it only ever existed to choose a hero. (The campaign's `save.hero` and
`heroBookFor` are the player's campaign character — unrelated, untouched.)
