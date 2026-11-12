# Measuring balance

Moved out of CLAUDE.md to keep it short. Same text, same rules — read it before working in this area.

## Measuring balance

There's no committed balance harness — build a disposable one, read it, delete
it. Convention: name it `src/engine/__tests__/zzz-*.test.ts` so it sorts last
and is obviously temporary, and **delete it before committing**.

**Copy the canonical harness from "Pin the harness" below rather than writing
one.** It passes `humans: []`, so `advance()` alone runs the match and there is
no P1 input to answer. This used to prescribe the `ai.test.ts` loop instead —
`needsP1Input(s) ? driveP1(s) : advance(s)` with `humans: ["P1"]` — which is
still the right shape for testing the AI, but is the wrong one for measuring
BALANCE: `driveP1` hardcodes `mode: "water"` on a FLOW_CHANGE where the engine
calls `aiFlowChoice`, so the two seats play differently and every element is
seated as P1 half the time. It measures about a point wider.

Three traps that have all burned real time:

1. **`deckById()` silently falls back to `DECKS[0]`** for any id it doesn't
   recognize — including the solo-element core ids (`"leaf"`, `"pyro"`, …),
   which live in `CORES`, not `DECKS`. A harness passing core ids therefore
   runs leaf_pyro-vs-leaf_pyro every match and reports a meaningless flat 50%
   across the board. **Pass `CORES[i].cards` (the string array) directly.**
   The fallback itself is still in the code — a latent bug worth fixing if any
   other caller ever passes an unrecognized id. On the balance harness it at
   least announces itself as a flat 50%; on any OTHER measurement it does not.
   A playability sweep written this way reported a perfectly plausible "34.4% of
   early prep turns have nothing to play" that was really one matchup repeated
   1,120 times. Same fix, and the reason to apply it everywhere and not just
   here: a wrong number that looks wrong costs an hour, a wrong number that
   looks right gets written down.
2. **`state.win` is `{ winner, by }`, not a player string.** `end.win === "P1"`
   is always false and every element reports 0%.
3. **The spell argument is not optional.** `undefined` derives a book from the
   deck's elements; `[]` is "chose none" and hands every element an empty one.
   Both are legal and they differ by seventeen points of spread — see the table
   below. `smoke-matches.test.ts` passes `[]`, so copying from there silently
   measures a spell-less game.

A full 8-core round-robin, both seats, 14 seeds = 784 matches ≈ 40s; the
canonical 50-seed run is 5,600 matches and takes about six minutes.

### Two metrics that look convincing and are not

Both of these produced a confident, wrong "this card is overpowered" list, and
both cost a full round of nerfs before being caught. Do not trust either one
on its own.

1. **Win-rate-when-played is CORRELATIONAL.** Aggregating `state.stats.byCard`
   and asking "when this card reached the board, how often did its side win?"
   ranks engine pieces and 6-drops at the top — because they only *land* in
   games that were already going well. It flagged Sling at +28.9 over its
   element; ablation later showed Sling contributes **+0.0**. The tell that
   something was wrong: two real mechanical nerfs (Beebot's damage fell exactly
   25%, Aurora's orbs were cut and then capped) moved the win rates by nothing,
   and Aurora's came back byte-identical over 1,120 matches.

2. **Ablation needs a CONTROL GROUP.** Cutting a card and re-measuring its
   element is causal, but a smaller deck draws its best cards more often, so
   *every* removal looks like an improvement. Measured on BOLT: Shock −2.1,
   General −2.4, Velvolt Knight −2.4, Zagphu −5.4, Keeper −6.5. Read against
   that ~−3 baseline, Keeper is unremarkable; read alone, it looks like the
   worst card in the game. Always ablate 3–4 same-element peers alongside the
   suspect and compare the SPREAD.

Sampling error is the other trap: one 336-match ablation run carries roughly
±5 points at 95%, so a 3-point gap is noise. Scale seeds up before believing a
small difference, and quote n.

The honest summary of that whole exercise: **no card was found to be measurably
overpowered.** The real finds were design flaws that measurement never
surfaced — Aurora's unbounded orb recharge and Keeper's Hive Mind absorbing to
the death. Both were fixed on reasoning, not on a win-rate delta.

### Pin the harness before you trust a number

**The single most expensive lesson in this file.** Every reading below was
recorded in prose — "solo cores, both boards, both seat orders, 50 seeds" — and
that is not enough to reproduce one. Three choices go unstated in that sentence
and each one moves the answer more than any card change ever has:

| choice | options | measured spread at HEAD |
| --- | --- | --- |
| spellbooks | `undefined` (derived from the deck's elements) | **10.9** |
| | `[]` (none — what `smoke-matches.test.ts` passes) | **27.9** |
| `humans` | `[]` — the AI plays both seats | **10.9** |
| | `["P1"]` + `driveP1` — the loop this file used to prescribe | **11.4** |
| seeds | unrecorded; any 50 | unknown |

Seventeen points of spread ride on the spellbook argument alone. Two readings
that disagree on it are not two measurements of the same thing, and comparing
them produces confident nonsense — which is exactly what happened: a "LEAF
dropped 4.5 points" investigation that ended in LEAF never having moved.

So: **quote the harness with the number, or the number is a rumour.** The
canonical one is below. Copy it verbatim rather than writing a fresh one.

```ts
// src/engine/__tests__/zzz-bal.test.ts — delete before committing
const wins: Record<string, number> = {}, games: Record<string, number> = {};
for (const c of CORES) { wins[c.id] = 0; games[c.id] = 0; }
for (let i = 0; i < CORES.length; i++)
  for (let j = 0; j < CORES.length; j++) {
    if (i === j) continue;                       // both seat orders come from i!==j
    for (const board of [4, 5]) for (let k = 0; k < 50; k++) {
      let s = createInitialState(k * 31 + 7, CORES[i].cards, CORES[j].cards,
        [], undefined, undefined, board);        // humans [] · spells undefined
      let st = 0;
      while (s.phase !== "gameover" && st < 8000) { s = advance(s); st++; }
      games[CORES[i].id]++; games[CORES[j].id]++;
      if (s.win?.winner === "P1") wins[CORES[i].id]++;
      else if (s.win?.winner === "P2") wins[CORES[j].id]++;
    }
  }
```

`humans: []` rather than `["P1"]` + `driveP1`, and the reason is not just speed.
`driveP1` answers a FLOW_CHANGE with a hardcoded `mode: "water"` where the
internal path calls `aiFlowChoice` and picks by card class — so under that loop
P1 and P2 play differently, and the round-robin seats every element as P1 half
the time. `humans: []` runs one code path on both sides. It is also ~2x faster,
which matters at 5,600 matches.

### Where balance stands

Harness above, verbatim. 5,600 matches, n=1,400 per element, ±2.6 at 95%, read
at `54b95b4` (the AI rider fix) and before Misty went to 5 HP:

```
dawn 55.0 · bolt 53.7 · dusk 53.2 · bore 52.0
aqua 49.2 · gale 48.6 · leaf 46.6 · pyro 41.7     spread 13.3
```

**The AI rider fix did not move the table.** On the same HEAD with the pre-fix
`ai.ts` swapped in, the harness read `dawn 55.2 · bolt 53.8 · dusk 52.9 · bore
50.4 · gale 49.6 · aqua 49.2 · leaf 46.8 · pyro 42.1`, **spread 13.1**. Every
element moved less than the ±2.6 band (BORE the most, +1.6): firing more
Specials and casting seven more spells helped both seats about equally, which is
what a whole-game AI rule should do. The swap cost nothing on the shared
worktree — copy the old module into `__tests__` with its imports re-pointed,
`vi.mock("../ai", …)` it, and the engine's own `advance` plays the old AI while
the real file never changes. Assert inside the runner that the mock took.

The table this replaced (`dawn 56.1 · bore 54.3 · bolt 54.2 · dusk 53.1 / aqua
50.3 · gale 46.0 · leaf 43.0 · pyro 43.0`, spread 13.1) was read before the card
changes that have landed since. Against the pre-fix reading at this HEAD, BORE
fell 3.9 and LEAF and GALE rose 3.8 and 3.6 over that stretch: card work, not
the AI.

Misty's HP 7 -> 5 is newer than both readings. It is one cost-1 card, measured
on its own confirmation seeds (see its entry in cards.ts), and not re-read on
this table.

Read immediately before the opening-hand guarantee went in, the same harness
on the same HEAD said `dawn 57.6 · bolt 56.7 · dusk 53.6 · aqua 50.6 / gale
47.0 · bore 46.9 · pyro 46.7 · leaf 40.8`, **spread 16.9** — so guaranteeing
two 1-drops in the opening hand (`seedOpeningCurve`, state.ts) tightened the
field by 3.8 while moving one element beyond ±2.6: BORE, +7.4, from 46.9 to
54.3. That is the deck suffering most from a slow opening getting its opening
back, and it is the second time BORE has turned out to be the element a
whole-game rule moves. See the note below about ELEMENT-WIDE levers — an
opening rule is one.

The 16.9 that reading replaced is itself well above the 12.2 recorded further
down, and none of that drift was the guarantee: it accumulated across the Super
Squad tribe, the Storm recost, foils and the spell changes, none of which were
re-measured against this harness at the time. **Re-read the table after a batch
of card work, not only after a rule change.** LEAF is the standing casualty —
44.2 then, 43.0 now, still bottom.

**12.2 WAS THE BEST SPREAD RECORDED HERE, and one change bought 7.7 of it.**
Before that, the same harness on the same HEAD read:

```
bolt 58.2 · dawn 58.0 · dusk 54.4 · aqua 53.6
gale 46.7 · leaf 46.5 · pyro 44.3 · bore 38.4     spread 19.9
```

The difference is Exostone's offensive half coming back — a BORE card gains
+1 shield whenever its attack breaks one off an opponent. It had been removed
in `58ef9d5` for exactly the right reason at the time: BORE was 60.1%, four
clear of second in a 15.8-point field. The roster has moved a long way since
and the condition inverted completely — BORE was last at 38.4, twenty behind
BOLT — so the same lever was worth pulling back the other way. It lands at
47.9, mid-pack, rather than back on top.

Read that against everything else tried the same day, which is the more
useful lesson: four new TRIBE auras across 29 cards (Mountain Kin, Sandstorm,
and two on Dark Wind), plus a free half-power legendary body, moved the table
by **0.0 to 0.3 points**. Every holder and its beneficiaries were confirmed
present in the relevant cores, so the harness could see them. One element-wide
rule moved BORE 9.5. The standing note in this file — that the levers which
have ever moved a number here are auras and element-wide rules — should be
read with the emphasis on ELEMENT-WIDE.

**AND THE 7x7 IS NOW MEASURED TOO**, because it is a different game and it was
never being read. n=700 per element, ±3.7. A 7x7 is only DOMINATION if the mode
is stamped on — `s.domination = newDomination(DOMINATION_7X7)`, exactly what
App.tsx does — and without that line the harness measures an oversized duel:

```
bore 62.0 · dawn 61.6 · dusk 53.7 · gale 50.4
pyro 47.9 · bolt 45.7 · aqua 45.3 · leaf 33.4     spread 28.6
```

100% of those 2,800 games ended BY DOMINATION; not one ended by elimination.
The two boards disagree violently and that is the mode working: BORE swings
+22.1 from last in the duel to first here (slow plated bodies are ideal ring
holders and hopeless in a race), BOLT and AQUA each drop ~10.

**THE FORTY-CARD PASS COST 8.5 POINTS OF SPREAD AND IT WAS PAID BACK.** The set
went 320 → 360 and the duel spread went 13.0 → 21.5, with DAWN running away at
61.0/68.7. Restoring it took ONE constant — `DAWN_STRIKE_PCT` 100 → 75 — which
brought duel 21.5 → 16.3 and domination 36.3 → 28.6. Pooled across both boards
the field is now `dawn 56.5 · dusk 54.5 · bolt 52.7 · aqua 51.6 · gale 49.3 ·
bore 47.3 · pyro 44.3 · leaf 43.9`, spread 12.6.

DAWN still leads POOLED at 56.5, which is the identity below. It reads 4th in
the duel at 53.9, but the top four span 2.3 points against a ±2.6 band — that
is a cluster, not an ordering, and no single run can rank it.

**TWO CARD-LEVEL FINDINGS THAT MEASURED AS NOTHING**, both worth keeping because
they are the cheap thing to reach for:

- `dawn_ballista` is a real outlier — 9.98 damage-per-gold against a 2.30 field
  median, and forcing it into DAWN's opening is worth +9.2 over its own cost
  band at 6.2σ. Its `attackEveryOtherRound` clock was also genuinely broken:
  Awakening paid its full printed 8 OUTSIDE the reload gate and then let it
  swing again next round. Repairing that moved the ELEMENT by 0.1 (61.0 → 61.1
  duel, 68.6 → 68.7 domination). **One card in a 45-card pool is drawn too
  rarely to move an element however broken it is on its own terms.**
- `dawn_sunspot` is the opposite and is still open: its Corona Flare → Blind
  Spot loop fires 0.03 times per summon (2 CRITs in 336 matches — the AI almost
  never casts it), and forcing it into the opening COSTS dawn 6.7 points. It is
  11.1 under its cost band. A dead card, not an overpowered one.

### LEAF on the 7x7 is a MODE problem, not an element problem

LEAF is fine in the duel (49.1) and last by twelve points on the 7x7 (33.4),
holding the highest average HP in the game (15.67) and the highest printed
damage (6.53). **There is no leaf-side dial.** A 7x7 ends in 8.9 rounds against
the duel's 13.3, so every LEAF lever converts at ~0.55x there — the whole
Photosynthesis aura is worth +19.6 on board 4 and +10.7 on the 7x7 for
near-identical output. An ARRIVAL half was built and measured on the theory that
paying per-card instead of per-round would escape that ratio (LEAF summons 1.18
bodies a round on the 7x7 against 0.83 in the duel); it does not — see the
rejected `LEAF_ROOTING_SHIELDS` note in auras.ts, which measures +9.6 on the
board LEAF is already correct on for +6.3 on the one it is losing.

What the 7x7 actually measures, and the reason a card fix cannot reach it:
**68.3% of matches end on the instant all-four win**, the winner holds 3.68/4
Points at that moment, 23.8% of those Points have no body of theirs on the ring,
and **52.3% of them the loser never stood on once all match.** `resolveHolders`
never releases a Point whose ring is empty, so control taken once is kept for
free. The single metric that tracks 7x7 win rate is Point ACQUISITIONS per
match — not combat, not bodies, not economy. Balancing cards against this board
is balancing them against a footrace against an uncontested clock.

Two untested candidates, in order of surgicality, **both of which change the
mode for all eight elements and neither of which is validated**: (1) in
`resolveHolders`, when `best === 0` set the Point to `null` instead of leaving
it with its last holder — one line, kills the uncontested-Point effect at
source, but contradicts the "CONTROL IS STICKY" design note; (2) drop the
instant all-four win at phases.ts:1284 so four Points must also survive
`DOMINATION_HOLD_ROUNDS`. Re-measure the full eight-element table after either;
do not assume it helps LEAF, whose deficit is in acquisitions (2.27 against the
field's 2.6).

Also ruled out, with numbers: LEAF's mobility (its bodies reach a ring in 0.13
rounds — 32 of 49 slots ARE ring slots, and every shrine is one step from two
rings), and the AI (it has a dedicated ~200-line Domination block; three policy
rewrites moved LEAF less than +2.9 and reordered nothing).

The reading this replaced, same harness, before the 40-card pass: `bolt 57.8 ·
dawn 56.0 · gale 52.6 · leaf 49.7 · bore 48.4 · pyro 45.5 · aqua 45.1 · dusk
44.8`, spread 13.0.

Measured after permanent Flow Change, Polar King back to 6, Havoc ranged at
85%, Surge's stored shot and Kobra's recost. Previous reading, same harness:
`dawn 57.2 · bolt 57.1 · gale 52.5 · leaf 50.4 · bore 48.8 · pyro 45.9 · dusk
45.6 · aqua 42.4`, spread 14.8.

**±2.6 IS THE BAND ON ONE READING, NOT ON A DIFFERENCE.** Two independent
readings each carrying ±2.6 give a difference carrying ~±3.7 (√2 wider). The
seeds are identical run to run, so the comparison is PAIRED and the true figure
is somewhere below that — but it is not ±2.6, and treating it as such promotes
noise to a finding. Only AQUA's +2.7 comes near either threshold; every other
element moved less than 1.3.

**AQUA came off the floor: 42.4 → 45.1**, the largest move in the table and the
one the changes were aimed at (permanent Flow Change, Polar King a gold
cheaper). It had been drifting down for three readings (44.1 → 42.5 → 42.4) and
sat 3.2 points clear of the field in last place; it is now inside a three-way
bottom cluster spanning 0.7 (dusk 44.8 · aqua 45.1 · pyro 45.5) that no single
run can rank. Directionally right and the biggest mover, but +2.7 against the
caveat above is suggestive, not settled — confirm on the next reading before
treating AQUA as fixed.

**DUSK is nominally the new floor at 44.8** — do not act on that. It moved −0.8,
which is nothing; it is last because AQUA rose, not because DUSK fell. A
round-robin sums to 50, so one element rising necessarily pushes the rest down,
and five of the other seven drifted down between 0.4 and 1.2 for exactly that
reason. There is no DUSK finding here.

**BOLT did not measurably rise from Havoc going ranged and Surge's stored
shot** — 57.1 → 57.8, well inside noise. That risk was flagged before the
measurement and did not materialise; the accuracy cost (Havoc misses 15% of its
basics) appears to have paid for the reach. BOLT is now nominally above DAWN
(57.8 vs 56.0), which matters only because **DAWN leads BY CHOICE** (see below)
— both moves are individually inside noise, so the swap may be an artifact of a
single run rather than a real change of order.

The spread narrowed 14.8 → 13.0. That is the cleanest signal in the run because
it aggregates across all eight elements rather than resting on one.

**DAWN leads BY CHOICE.** It is the campaign's final region and the owner wants
it to read as the final boss — a knock-down was implemented (a relative +5 SP
cap that stopped the statues short of the king-move tier) and rejected before
it measured. Do not "fix" DAWN's number without asking; its cap sits at 12
purely as a turn-order trim, and the commit for it records why that value is a
flavour dial, not a lever (the king-move line is 10, so 12 and 14 grant the
same tier).

**How it got here from 10.9**, most recent first, each measured at the time:

- The AQUA pass (permanent Flow Change + Polar King back to 6) alongside Havoc
  ranged / Surge's shot / Kobra's recost: AQUA +2.7, spread 14.8 → 13.0. The
  only element to move more than 1.3, and the smallest spread on record since
  the AI income fix re-priced the table.
- ARC's Discharge tribe passive: BOLT +2.0.
- GALE hands back its Tailwind lift (6→5→6, +4.7 each way) and Scorch persists
  a round: GALE −3.3, PYRO +3.0, and DAWN inherited the crown — a round-robin
  sums to 50, so pulling one element down promotes the next.
- **The AI income fix re-priced the whole table** (10.9 → 14.9): holding home
  slots for income suits elements that sit and shoot, so GALE/DAWN rose and
  PYRO/BORE fell. This is the biggest single mover in the file's history that
  was not a card change, and the reason older numbers cannot be compared
  across it: every figure here was always cards-PLUS-AI, and the AI got
  better. Isolated: the summon-unjam half was +1.3 (noise); the income half
  carried the rest.

### The standing balance problem: LEAF cannot outrun GALE

Measured UNDER THE PRE-INCOME AI and not yet re-measured since — the fix that
re-priced the table may have moved this matchup too, so re-run the row before
acting on it. As of that measurement it was one matchup rather than a weak
element. LEAF's row:

```
bore 55.5 · aqua 55.5 · dusk 51.0 · pyro 44.0 · dawn 44.0 · bolt 38.5 · gale 25.5
```

**25.5% into GALE, thirteen points below its next-worst.** It measured 28.5% at
`b517a30` too, so it predates every recent change. Of 200 LEAF-v-GALE matches
GALE takes 147 by CAPTURE and 2 by timeout, average 11.3 rounds — nobody is
killing anybody, it is a footrace. GALE averages SP 9.3 with zero immobile
cards; LEAF averages 6.6 and is **the only element carrying cards that cannot
move at all** (Oakgre 55 HP, Oak, Dandelion, Elephlora, all reach 0, plus ten
more at reach 1). In a race for home slots that is not a matchup.

The lever is mobility — LEAF's own SP, or something that slows GALE — not more
wall. A tempting fix that measured NOTHING: GALE swapping SP-sap for shoves
looked like the perfect counter to walls that can never walk back, and removing
the shove moved the matchup 25.5% -> 25.5%, exactly zero.

DAWN +6.5 in one pass, sixth to third — the largest single-element move recorded
here, bigger than DUSK's +4.3 or BORE's −4.3. It follows the four BATTLE
COMMANDS and, just as importantly, the AI branch that lets it cast them: they
were dead to the AI on arrival (findSpellCast dispatches on `kind`, and a command
carries a kind only for the tray's colour), so the spells sat unused in its book
every match until that shipped. **A spell the AI cannot reach is worth nothing in
any measurement taken with the AI** — and every number in this file is taken with
the AI. That is a class of bug, not a one-off.

CAUTION ON ATTRIBUTION: twenty commits separate this from the 11.1 pass, and one
of them — derived spellbooks filling to 8 on the large board instead of 5 —
changed the resource EVERY element spends, on half the matches. It is a plausible
confound for all of the movement above, including the 2.4 that came off both
leaders. Do not treat any single figure here as isolated; A/B a suspect before
acting on it.

Before that, Exostone stopped wearing the plate it breaks, which is what
collapsed the top:

```
before  bore 60.1 · bolt 56.1 · leaf 50.4 · aqua 49.9 · pyro 48.8 · gale 45.3 · dusk 45.1 · dawn 44.3   spread 15.8
after   bolt 56.6 · bore 55.8 · leaf 50.7 · aqua 50.3 · pyro 49.5 · dawn 45.9 · dusk 45.6 · gale 45.5   spread 11.1
```

**BORE −4.3, everyone else +0.2 to +0.7** — the exact mirror of the DUSK lift
below, and the same signature: one element moves, the other seven drift the
other way by a fraction each. DAWN's +1.6 is the one figure above that drift,
and Flash Squad + the Sphere remodel landed in the same window, so some of it is
probably theirs — but +1.2 over the drift at ±2.6 is suggestive, not proven.
Do not bank it without an A/B.

Before that, Midnight Shade's death recoil went to FULL damage, measured
against an otherwise identical tree:

```
half recoil   bore 60.2 · bolt 56.3 · leaf 51.1 · aqua 50.7 · pyro 50.1 · gale 46.0 · dawn 44.7 · dusk 40.8   spread 19.4
full recoil   bore 60.1 · bolt 56.1 · leaf 50.4 · aqua 49.9 · pyro 48.8 · gale 45.3 · dusk 45.1 · dawn 44.3   spread 15.8
```

**DUSK +4.3, and every other element down between 0.1 and 1.3** — which is what
a genuine single-element lift looks like: the seven others each lose a little
win rate against the one that gained, and nothing else moves. It took DUSK from
last (40.8) to sixth.

Two cautions from the same pass:

- **GALE got three buffs in that window (Angale, Rayfen, Alluring Aura) plus
  WEAKEN stacking, and measured 0.7 DOWN.** Read against the −0.1 to −1.3 the
  other non-DUSK elements all drifted, that is indistinguishable from having
  changed nothing at all. Card-level buffs to a mid-tier element are not a
  balance lever at this resolution; the levers that have ever moved a number
  here are auras and element-wide rules.
- **The DAWN tribe split measured +0.1** against a controlled A/B (see below).

Further back: the cost-3 epic migration cost about 2.4 points of spread, and
the tuned field before it was 17.0:

```
bolt 59.7 · bore 56.8 · aqua 51.1 · leaf 48.8 · pyro 48.5 · gale 47.2 · dawn 45.2 · dusk 42.7   spread 17.0
```

**Every element is now inside seventeen points**, the tightest this has ever
measured — it was 18.3 at the oldest recorded pass and 30.4 before these two
fixes. Six of the eight sit between 45 and 57. Two reworks got it there, and
the history is worth keeping because both were auras that were not paying:

```
before both   bolt 62.9 · bore 59.1 · aqua 54.6 · pyro 53.4 · leaf 52.8 · dusk 46.1 · dawn 38.6 · gale 32.5   spread 30.4
after GALE    bolt 60.7 · bore 56.9 · aqua 52.1 · pyro 50.3 · leaf 49.9 · gale 48.8 · dusk 44.1 · dawn 37.3   spread 23.4
after DAWN    bolt 59.7 · bore 56.8 · aqua 51.1 · leaf 48.8 · pyro 48.5 · gale 47.2 · dawn 45.2 · dusk 42.7   spread 17.0
```

DUSK (42.7) is now the lowest, and only 2.5 points under DAWN. **Do not chase
DAWN to exactly 50** — at this spread, lifting anyone further just makes the
next element the outlier.

Per board, and near-identical — this is not a board-size artifact:

```
4x4   bore 61.4 · bolt 58.7 · aqua 55.7 · pyro 55.6 · leaf 52.6 · dusk 46.0 · dawn 38.1 · gale 31.9
5x5   bolt 67.0 · bore 56.9 · aqua 53.6 · leaf 53.0 · pyro 51.1 · dusk 46.1 · dawn 39.1 · gale 33.1
```

BOLT is the one element that cares which board it is on (58.7 -> 67.0).

**Diagnostics, per match, combined.** Measure these, not just the rate — a win
rate says an element is losing, not why. (This table predates both reworks; the
shape of the argument is what matters, not the exact figures.)

```
el     win%  rounds  alive  gold  caps  deaths   dmg  shielded
BOLT   62.9    12.2   4.39   6.7  3.56    6.30    91        14
BORE   59.1    13.4   3.92   6.2  3.49    4.17    94        57
AQUA   54.6    13.1   3.43   6.4  3.35    5.69    93        29
PYRO   53.4    13.3   3.02   5.6  3.26    6.08    87         6
LEAF   52.8    14.5   4.03   7.5  3.17    5.56    85        38
DUSK   46.1    15.6   3.70   7.0  2.91   13.11    95         7
DAWN   38.6    10.8   2.45   4.5  2.90    3.95    56        13
GALE   32.5    11.6   1.77   4.7  2.56    5.65    53         3
```

**99% of matches end by CAPTURE. Elimination is 0%.** The game is a race for
Home slots and nothing else; any change should be read against that first.

#### Anti-healing measures as nothing — a worked example of not reading it

SEAL (the "cannot be healed" status) was added to FOUR DUSK Specials in one
pass — Death's Approach, Moon Frenzy, Phantom Gouge, and Mark of Hoax, the last
of them permanent and one of them board-wide. Measured against an otherwise
identical tree, DUSK moved **-0.1** and the spread did not change at all.

It is the sentence above, unread. SEAL is checked at healCard, so it only ever
bites in an ATTRITION race — and there is no attrition race. Denying an opponent
their healing does not slow them toward a Home slot, which is the only thing
that decides a game. The prediction was available before the work was done, from
a line already in this file, and was not applied until the numbers came back.

Generalise it: an effect that only changes how long cards SURVIVE is close to
free in this game, and an effect that changes where they STAND is not. That is
the same shape as the two other lessons here — gold is not a tuning knob, and
card buffs to a mid-tier element measure ~0 — while WEAKEN, pushes, ROOT and
the DAWN battle commands all moved numbers because they touch the race.

None of which makes the SEALs wrong to have: they read well on the cards and
cost nothing. They are simply not a balance lever, and should not be reached for
as one.

### The opening hand is dealt playable, and the draft has a floor under it

A 45-card core holds exactly six 1-drops, so a four-card opening misses them
entirely **54.4%** of the time and holds fewer than two **91.9%** of the time.
Across 1,120 headless core-vs-core matches that came out as **34.4% of every
prep turn in rounds 1–5 having nothing the seat could legally summon** — and
not for want of a slot: the board is nearly empty then and the diagnosis was
"can't afford" on all of them. `poolGainForRound` pays 1 a round through round
5. More than half of all matches opened with a hand you sit and look at.

`seedOpeningCurve` (state.ts) swaps two cheap cards up into the opening window
at **both** shuffle sites — `createInitialState` and `applyMulligan`, because a
guarantee a mulligan undoes is not one. It reorders, never adds or removes.
Openings short of two 1-drops go 91.9% → 0.0% and early dead turns 34.4% →
21.0%. Three things are load-bearing and each was measured, not reasoned:

- **Two, not one.** Each point buys exactly one guaranteed round and the round
  after dips, because the cheap cards were spent. At one, round 2 comes back
  *below* the baseline (60% → 53% of turns with a play) — the 1-drop went down
  on round 1. At three, three of your four cards are dealt for you.
- **It displaces the LAST card in the window, not the priciest.** Taking the
  bomb is the intuitive fix; the harness read spread 18.7 against 13.1 for it.
- **`stackFirst` opts out.** This runs after `restackByCost` and went straight
  over the top of a Void Tower boss's scripted formation — a seeded run dealt
  two of three named cards and swapped the Mythic out for a 1-drop.

**It applies to BOTH seats.** Human-only would be a hidden difficulty setting
and would quietly corrupt the harness, which plays AI against AI.

The draft needed its own fix, because the guarantee cannot help a deck with
nothing cheap in it: **17.5% of drafted decks held fewer than two 1-drops and
2.5% held none**, one of them `1,1,3,3,3,3,5,5,5,5,5,6,7,7,8,8,9,10`.
`TARGET_CURVE` buckets 1 and 2 together and that is what hid it — the two are
not interchangeable when gold pays 1 a round until round 6. `CHEAP_TARGET` /
`CHEAP_OFFERS` (draft.ts) hold a seat for a cheap card in **two of three**
offers while the drafter is behind, and `rollGroups` favours banners that can
actually field one. Two, not three, so one group is always left alone and a
greedy pick stays possible. Short decks 17.5% → **0.3%**, empty ones → **0.0%**,
and the 1-2 bucket 31.2% → **35.7%** against its own 36% target.

Reweighting alone does not work and it is worth knowing why: multiplying the
curve pull by four moved short decks 17.5% → 16.3%. The BANNER decides what is
on offer long before the weights do, and no weighting finds a 1-drop inside a
Dragon warband. It took a held seat plus a banner bias.

### The cost curve, and the cost-3 migration

```
1:45  2:45  3:59  4:49  5:41  6:27  7:20  8:9  9:9  10:8
```

Cost 3 held **80 of 312 cards (26%)** — 42 Rare and 38 Epic, LEAF alone with
sixteen against three 4s and one 5. Thirty-seven of the 38 Epics were moved up,
25 to cost 4 and 12 to cost 5.

That over-corrected: cost 4 became the new pile at 65. Sixteen of those 25 were
then returned to 3 — the LIGHTEST by offence (`dmg x hits`), since a low-damage
body is what a cheap card is for — restoring their original lines exactly.
Cost 3 finished at 59 (19%) and cost 4 at 49 (16%).

Note there are NO thin cards above cost 3 to demote instead: every cost-4 and
cost-5 card is an Epic with a Special. "Weak enough to be cheap" is not a
property the pool has up there.

`leaf_sakuroot` stayed at 3 and must: `OPENING_COST_CAP` is 3, and Sakuroot is
both STARTER_DECK and the card LEAF's opening battle is built around. The other
two region-opening Epics (`aqua_blackice`, `dusk_spectra`) are rewards rather
than placements, so they moved safely.

Moving a card changes its BUDGET (`5*cost + 10`), so every one needed +5 or
+10 points of stats. Two rules, both worth reusing:

- **SP stays frozen.** Distributing pro-rata across all stats pushed FireBird
  to 16 SP and Silkstalker to 17 — off-character outside GALE, and bad value:
  SP is the weakest stat in the game, so a cost-5 card that spent 16 of its 35
  on speed is worse than the 3-cost it replaced. Growth goes to offence and HP.
- **Multi-hit offence caps at +2 DMG.** A +1 DMG is worth `hits`, so Strawman
  would have gone 5x2 -> 8x2, i.e. 16 burst at cost 5.

**What it cost: spread went 17.0 -> 19.4, and returning the sixteen did not
reclaim it** — GALE and DAWN each came back ~1.3, BORE gave up 1.8, and it
netted out. What finally did was halving Electrify's rider (19.4 -> 16.1), so
the points came back from a different direction than they were lost.

The direction was not what was predicted: BOLT and BORE GAINED from the
migration, because stronger cards help the elements that were already best.
Damage fell across the board (BOLT 92 -> 86, GALE 78 -> 69) since dearer cards
mean fewer of them on the board.

Play both seats. A mirror match measured from the P2 seat reads ~41%, so a
one-sided round-robin bakes a first-player edge into whichever element sat in
P1. (Sanity check on this run: P1-only came out bolt 62.7 · bore 60.6 · pyro
54.4 · leaf 51.4 · aqua 51.0 · dusk 47.1 · dawn 37.4 · gale 30.6 — same
ordering, so the result is not a seat artifact.)

The previous measure was `dusk 56.1 · bolt 55.1 · aqua 53.1 · pyro 51.0 · dawn
50.5 · gale 49.0 · bore 47.4 · leaf 37.8`, spread 18.3.

**LEAF is fixed.** It was the standing problem for four passes (stat top-ups →
roots → mid-range cost cuts → matchups) that moved it 34.2 → 37.8, about a
point each. It now sits mid-field at 54.8. The likely cause is the
Photosynthesis rework rather than any of those passes: the bark trigger moved
from "when at full health" to **+1 shield per hit taken**, ceilinged at
PRINTED shields + 3 rather than at a flat total. The old version paid out only
when LEAF was already winning the exchange, and locked every LEAF card
printing 3+ shields out of half its own aura. Worth remembering as the general
lesson — the element's problem was an aura that never fired, and four rounds
of stat tuning never found it.

**DAWN (37.3) is now the floor**, alone, ~23 points under BOLT.

**GALE — SOLVED, and the reasoning generalises.** It sat bottom at 32.5 with
the lowest damage (53 against a field of 85-95) and the fewest cards standing
(1.77). The cause was structural rather than any one card: the stat budget
counts SP against HP and damage, and GALE spent **31.6% of its power on SP**,
the most of any element (BORE 21.8%), for a stat that bought nothing but turn
order. It was paying full price for a dead stat — which is exactly why it was
simultaneously the weakest attacker (5.4 dmg×hits) and the flimsiest body
(0.33 shields, against BORE's 2.64).

The fix was not to hand GALE stats it had not paid for, but to make what it
bought worth something. Zephyr gained two halves, both keyed to SP so they
scale with precisely the over-spent stat: **Tailwind** (+1 DMG per 6 SP, cap
+3) and **Slipstream** (dodge 5% per 3 SP above 6, cap 20%). Result: 48.8,
mid-field, still the fragile lower-damage element it is meant to be (78 dmg
and 2.77 alive against the leaders' 92 and 4.27).

Tailwind deliberately SKIPS Stormquill and Tempest — they already convert SP
to damage through High Speed Impact, and stacking would re-buff the only two
cards that never needed it.

**The generalisable lesson**: check what an element is SPENDING its budget on
before touching its cards. Both fixes that have worked — LEAF's Photosynthesis
and GALE's Zephyr — were auras that were not paying, not stat lines that were
too low. Auras sit outside the `5*cost+10` budget, so they are the only lever
that can add power without breaking `state.test.ts`.

**DAWN — SOLVED, and the route there is the useful part.** 37.3 -> 45.2, damage
56 -> 62, alive 2.38 -> 2.74. Awakening's on-summon strike went from HALF the
card's DMG to its full DMG. That is all it took, and it is on-theme: the light
arriving is the card's attack, so it should hit like one.

**GOLD IS NOT A TUNING KNOB IN THIS GAME.** Three discount shapes were measured
against DAWN before the strike, and every one is worth 40+ points where 13 was
needed:

```
-1 Gold, every card        37.3 -> 82.8    (spread 23.4 -> 44.8)
-1 Gold, cost 5 and up     37.3 -> 34.9    WORSE than doing nothing
-1 Gold, cost 3 and below  37.3 -> 78.5
```

Three things fall out, all of which generalise:

- One Gold off a summon moves an element ~45 points. GALE's entire Zephyr
  rework — damage AND dodge, across 39 cards — moved it 16. Gold is roughly an
  order of magnitude more powerful than stats here, so **stat-shaped auras are
  the tuning instrument and Gold is not.**
- Nearly all of that value is at the CHEAP end: twelve cheap cards bought 41 of
  the 45. Cheap-and-wide is the strategy, and Gold is what buys it.
- Discounting the HEAVY end is actively HARMFUL. `aiPrepIntent` summons the
  highest-cost affordable card, so cheapening big cards only brings them into
  reach sooner and spends on one body where two would have gone down.

A caveat on that last point, and on DAWN's number generally: it is tuned
against the AI's greedy buy rule, which a human would not fall for as readily.
DAWN is the element where that assumption does the most work — worth a
play-test on device before trusting 45.2 completely.

**Awakening's strike takes the elemental matchup like a real attack** — 5
printed DMG lands as 6 into DUSK (x1.25, floored) and a flat 9 into LEAF. It
also reads PRINTED DMG rather than dmg x hits, so re-statting a card from 2x2
to 1x4 silently doubles it. Both are pinned by tests.

Two other things the diagnostics turned up, neither yet acted on:

- **DUSK dies 13.11 times a match**, two to three times anyone else (next is
  BOLT at 6.30), and still deals the most damage in the game (95). It trades
  bodies extremely well and loses the race anyway at 46.1. That is the
  disposable-body identity working as designed and not quite paying.
- **BORE absorbs 57 damage a match on shields**, four times the field, with
  the fewest deaths (4.17). Exostone's rarity-tiered plating is carrying it.

Matchup grid (row in P1, both boards). GALE beats nobody; DAWN's best is a
coin flip against GALE:

```
        LEAF  PYRO  AQUA  DAWN  GALE  BOLT  DUSK  BORE
LEAF       —    56    60    62    51    43    67    52
PYRO      56     —    54    62    80    36    62    60
AQUA      53    56     —    70    77    44    63    43
DAWN      42    43    35     —    50    32    50    32
GALE      45    27    21    50     —    22    29    32
BOLT      72    73    56    71    72     —    69    46
DUSK      37    59    52    52    69    39     —    47
BORE      47    49    63    76    72    63    70     —
```

**Stormquill's cap is not the cause of GALE's number.** Ablated directly:
as-shipped (cap 5, talent +2 SP) 35.0%, pre-nerf (uncapped, +3 SP) 35.2%,
cap 10 + 3 SP 35.2% — 0.2 points across 560 matches each. The cap removed an
unbounded scaling loop at zero measurable cost, which is the ideal shape for a
nerf, but do not expect reverting it to buy GALE anything.

Premade-deck (not solo-core) numbers are stale — they predate the Warthog /
Rollo / Zombination / Doom changes and everything since.

### Who dodges, and why — read from the hit loop, not the log

"DUSK dodges too much" (owner, 2026-09) was checked by counting the per-hit
dodge branches of `resolveHit` (combat.ts) directly: a worktree-only probe
after the two `break`s at the loop top (an attempt) and beside every
`result.dodgedHits++` (labelled by the log line that follows it), then the
canonical harness above, 20 seeds (2,240 matches). Share of NON-reflect basics
that whiffed, by the TARGET's element:

```
before  dusk 21.6 · gale 15.1 · dawn 6.9 · aqua 6.2 · leaf 4.6 · bore 3.8 · pyro 1.8 · bolt 0.9
after   dusk 18.3 · gale 15.1 · dawn 6.8 · aqua 6.2 · leaf 4.5 · bore 3.7 · pyro 1.8 · bolt 0.9
```

Half of DUSK's was **Midnight Shade** (11.0 of 21.6), and the shade sat at its
25% ceiling on 35.5% of every swing at a DUSK card. The stack shared ONE window
that each fresh death pushed forward, so shadows from cards lost rounds ago kept
counting for as long as one more fell — and a DUSK deck loses a cheap body nearly
every round. Each death now keeps its own round (`PlayerState.shadeUntil`, one
entry per shadow): one death a round is two live shadows, 10%, never a ramp to
25%. After: shade 7.9 of 18.3, ceiling on 10.5% of swings, DUSK 55.2 -> 53.2
win (n=560, inside ±4.1). The rest of DUSK's dodge is what the cards print:
Nightfall 3.6, innate EVASION 2.5 (Duet, Hoax; Ravven and Silkstalker on the
enemy side), Veil 1.9, granted EVASION 1.6, Ender 0.5.

Two text-vs-engine gaps found on the way: Spectra's Opaque Realm cloaked the
whole row behind it ("the ally directly behind it") — now that one square —
and Nightfall promised a sure dodge where the engine rolls the EVASION coin, so
the text now says 50%. GALE's 15.1 is its identity (Slipstream 7.1, innate 4.2,
Untouchable vs BORE 3.5) and was not touched.
