# Void Tower and bosses

Moved out of CLAUDE.md to keep it short. Same text, same rules — read it before working in this area.

## Void Tower (boss framework — data + engine only; NO mode yet)

Spec: `Downloads\War_Element_Void_Tower_Bosses.md`. Its companion mode doc
(`War_Element_Void_Tower.md` — floors, run rules, rewards) WAS NEVER WRITTEN;
it exists nowhere on the machine, so the mode screen/run state/reward loop are
deliberately unbuilt. What shipped is every fight's data and engine, playable
through seven "Void Trial" EVENTS on the Home band and tested headlessly.

**The formula**: Element A gives the TRIBE, Element B the MECHANIC, and the
boss summons its tribe on a 12-Gold budget. The budget is a BUILD-TIME cap on
the boss's OPENING (`src/data/void-tower.ts`, validated in
`void-tower.test.ts`) — not a runtime wallet. The formation opens the fight and
the rest of the P2 deck is tribe reinforcements (`paddedFormation`, filled to
`deckSizeFor(5)` = 30 from the tribe's CHEAP HALF, cycled); the
ordinary AI plays them on the ordinary income; the boss card itself is placed
by `summonCard` outside the economy (`voidBossSeat`, wired in
`startArenaMatch`). Tribe TOKENS are legal summons (story `adds` are tokens by
the same rule); duplicate caps are the full `DUPLICATE_CAP` (rare×3 epic×2
leg×1), unconditionally.

**Bosses are CARDS, flagged `boss: true`** — visible to inspector/lore/art,
refused by every acquisition path: `isBuildable`, `openPack`, `canCraft`, the
Shop missing-list, `StoryCollection`, `deckFor` (so they can NEVER enter the
element CORES or the balance harness), and `escalationPool`. The stat-budget
test skips them; their body answers the floor cap instead (80 + 40/floor, +5
soft band — Xilty is 82 on purpose). A test asserts a boss is acquirable
NOWHERE; keep it green when adding acquisition paths. Art is currently ALIASED
to existing webps via the `art` field — placeholders until boss art lands.

**EVERY BOSS SPECIAL IS ON A CLOCK** — `roundTick.fireSpecialEveryN: 3`: free,
automatic, at Cleanup, and `canFireSpecial` REFUSES the ordinary cast for any
card carrying it, so the clock is the only way it fires. A puzzle needs a threat
you can count; left on the ordinary path the same Special lands whenever the AI
could afford the magic, which is a different fight on every retry. MUTE and the
action-blocking statuses still stop it, which is what keeps silencing a boss a
real answer. Boss specials therefore print NO `cooldown` (dead config beside a
Special you cannot hand-cast) — and the "board-wide mythic nuke prints a
cooldown" rule in passives.test.ts now accepts a clock of 3+ as the stricter
equivalent, rather than exempting boss ids.

**No random percentages** — a puzzle is solved once and then executed
(`chanceProblems` is the rule as code; a test sweeps every boss def). The
deterministic replacements are reusable CardDef fields any card may carry:
- `allyRevive {tribe?, healFraction}` — a defeated tribe ALLY stands back up
  once per card per battle (Rotroot). In `defeatCard`, past every self-revive.
- `firstAttackMisses` — the first basic attack against the card each round
  misses WHOLE; the attempt springs the guard even when alwaysHit/Blazing Sun
  overrides it, so leading with the sure hit is real sequencing (Xilty,
  Nightshrike). Re-arms at Cleanup (`firstGuardUsedRound`).
- `roundTick.shiftLateral` — slide along the OWN home row, wrapping to the
  next open slot, only while standing in it (Skeleeze's kill-column).
- barrage `critAlways` param — skips the CRIT coin only; pair with card-level
  `critPen` for "guaranteed CRIT that pierces" (Piercing Arrow).

**Corrections found auditing the doc's §3 against cards.ts** (also appended to
the doc itself): Forged Tech is mono-PYRO (the Pyro+Bolt marquee boss is
impossible — Overclock uses ARC instead, and as a mythic ARC it carries
Discharge, deliberately); DAWN is the DEEPEST tribal element (Stars 18 /
Suns 22), not the emptiest; Cavernous cannot land on 12 (Wall boss uses AQUA's
Ice); the doc's Xilty list cost 13 (Silkstalker is 4); "Deep Creatures" and a
usable "Bot" tribe don't exist; Wolf spans 3 elements, Avian 4; seven one-card
tribes can never fund a boss.

**THE DECK IS PADDED, and it matters.** The summons used to BE the whole P2
deck, so a boss brought 2-9 cards against the player's 30, emptied its hand in
the opening rounds and stood on a rising gold pool doing nothing — every fight
was won by outlasting an opponent that had already stopped playing. Two
consequences to know about:
- Reinforcements come from the tribe's cheap half, NOT by repeating the
  budgeted list (that would hand Rotroot fifteen cost-7 Zombinations).
- It needed `PlayerState.stackFirst` — hoist THESE cards by name — because
  `stackCheapest` now does the opposite of what the puzzle wants: the formation
  is the expensive half of a deck padded with cost-1 chaff. `scriptedOpening`
  and `createInitialState`'s `stacked` take a number (cheapest N) OR a list of
  ids. Void Trials pass the formation.

**Floor 1's seven puzzles, all authored**: Rotroot (engine), Skeleeze
(kill-column — doc floor 2), Xilty (status lock — doc floor 3), Permafrost
(wall), Overclock (swarm), Nightshrike (glass cannon), Basilisk (attrition).
All seven formations spend exactly 12 and it is pinned by test.

**THE FIGHT'S OWN RULES** (all scoped to a `GameState.voidTower` flag; ordinary
matches, story and arena are untouched, and control tests pin that):
- **Slay the boss to win.** Home slots CANNOT be captured in here, in either
  direction. Under the ordinary rules 36 of 36 fights ended by capture, several
  inside six rounds with the boss untouched at 91% HP — every puzzle is written
  as "kill the source" and not one was ever settled that way.
- **Capture is off as a MECHANIC too, not just as a win.** Removing only the win
  left the boss padlocking all five home slots permanently: the player could
  never summon again, was not losing, and could not continue. A capture that
  cannot win the game must not be permanent.
- **30-round clock** (`VOID_TOWER_ROUNDS`), and running it out is the BOSS's
  win. Without it the boss had no realistic path — player kills ONE card, boss
  must eliminate thirty-one — so "winning" meant outlasting the global 50-round
  limit at 43-48 rounds. That made survival-to-50 the only dial and it barely
  turned: scaling Permafrost's whole body by FIVE moved it 10% → 20%. The clock
  is shown counting down in the round chip and stated on the tower screen.
- **The boss holds its home row for 2 rounds** (`BOSS_HOLD_ROUNDS`). It holds,
  it does not freeze — attacks, Specials and the clock all fire, and it may
  still slide ALONG its own row. One `bossHeldHome` for both ways off the row.
  A TAMED boss is exempt — the hold is your opening against the boss you came
  to fight, not a leash on your own (see the taming section).

**Difficulty, measured** (vs three tuned 5x5 premades on the 24-round clock):
Permafrost 47% · Rotroot 53% · Nightshrike 67% · Basilisk 70% · Overclock 73% ·
Xilty 73% · Skeleeze 77%. Floor 2 and 3 sit above the Floor-1 average, which is
the point of floors. Bodies are PINNED by test (`MEASURED` in void-tower.test.ts)
because the cap is a ceiling, not a target, and only checking the ceiling is how
five of seven quietly ended up 13-78 points under their floor's budget.

**THE BENCH CAP IS WHY THEY MATCH.** `reinforcementPool` is the tribe's cheap
half capped at FOUR. Uncapped it made a boss's bench a function of how many
cards its tribe owns, and that was the single biggest thing separating these
fights: Avian is 20 deep so Nightshrike fielded a curated ten-card GALE toolbox
and won 97% with the player holding 0.1 cards alive, never reaching a boss still
on two thirds of its HP; Zombie is 5 deep so Rotroot fielded three weak bodies
and won 7%. The bosses were never mismatched — their armies were.

An AI-vs-AI harness cannot read a telegraph, bring cleanse, or focus a boss, so
it cannot say whether a puzzle is FAIR — only whether the seven are comparable.
Fairness is on-device.

**OVERRUN — the boss can now WIN the board.** `WinInfo.by` gained `"overrun"`:
in a Void Tower fight, if the boss's side occupies EVERY slot of the player's
home row at Cleanup, the boss wins outright (7z in `doCleanupPhase`). The mode
switches the slot race off entirely — capture disabled, player wins by slaying,
boss by elimination or the round clock — which left the boss no way to win the
board, only to survive it. A brood standing in all of your back line had beaten
you and still had to wait out the clock.

EVERY slot, not a majority, and checked by OCCUPANCY rather than `capturedBy`
because capture is exactly what this mode turns off. It is deliberately
ASYMMETRIC: the player filling the BOSS's home row still wins nothing — slaying
is the player's condition, and a test pins both halves. One pre-existing test
asserted "a boss holding every home slot has not won" and is re-pointed; it still
guards that the ending is an overrun and never a capture.

**THE BODY IS WHAT THE CLOCK IS SPENT ON — the finding that closed the tower
out.** Umbranova and Thunderfangs both sat near 95% and both shrugged off every
systemic change of the session. Breaking their wins down BY TYPE is what
explained them, and it should be the first move on any boss that will not budge:

    Umbranova    94.8%  =  69% overrun + 26% TIMEOUT + 0% elimination
    Thunderfangs 88.5%  =  74% overrun + 15% timeout + 0% elimination

Zero eliminations means the player never killed the thing. That is a BODY
problem, and it is invisible in the aggregate — both bosses' signature mechanics
turned out to be nearly irrelevant to the outcome:
  * Umbranova's Meteor Fall at 6 damage instead of 10 still read 88.5%, and
    removing `pen` entirely changed NOTHING (94.8% either way).
  * Thunderfangs' pack: halving Pack Law's cap moved it 1 point; removing the
    wolves ENTIRELY moved it 4. Wolves are bodies, and bodies are not what a
    24-round clock gets spent on.

Retuned on body alone: Umbranova 128 -> 90 (94.8 -> 72.9, timeouts 26% -> 16%),
Thunderfangs 96 -> 76 (88.5 -> 69.8). Stormform tracks the first form at +20% on
every line and a test pins that relationship, so it followed to 92.

**UMBRANOVA IS BACK UP: body 90 -> 130 (hp 60 -> 100), owner's call.** Re-measured
after the Gates, the reach fix and the overrun rework, it had drifted to the
WEAKEST fight on Floor 4 at 60.4%. HP is the lever on this one and it is steep —
hp 60/80/100/120 reads 60.4 / 77.1 / 82.3 / 86.5 — which is the exact mirror of
the finding above that its DAMAGE moves nothing. Meteor Fall ignores position, so
the player cannot shorten the clock by repositioning; the body is all there is to
chew through. At hp 100 it is now ~12 points clear of the rest of Floor 4
(Cryovex 70.8, Kato 70.8, Kazehaya 67.7) — a deliberate difficulty ordering. If it
should come back into band, 80 is the nearest rung.

THUNDERFANGS' CURVE IS STEEP — leave the number alone: body 72 / 76 / 80 reads
60.4% / 69.8% / 77.1%, so four points of body is worth about eight of win rate.

And its pack now comes on every SECOND kill (`spawnToken.everyNKills`). The owner
asked for a chance-based spawn; Void Tower requires its bosses to roll no dice
(`chanceProblems` pins it, and the doc replaced its own 50% rolls for the same
reason), so this is the deterministic form of "sometimes" — the same
every-so-often feel, and the player can count it.

**HOARFELL CRUSHES — `trampleDmg`, and the gait shoves too.** The juggernaut was
the weakest fight on Floor 3 at 30.2%, because the Fortress Gates do not merely
slow it, they switch it off: its momentum ramp needs UNOBSTRUCTED advance and
`chargeForward` simply stopped at the first body, so Avalanche never built once
in a whole fight.

Two changes, in order of how much they mattered:
  * `chargeForward` now SHOVES for a TRAMPLE card, using the same `shoveTarget`
    the Prep move uses, so the gait and the move cannot disagree. Worth almost
    nothing on its own — 30.2% -> 31.3% — because shoving a gate aside merely
    REARRANGES the wall: the gate lives, the line still stands, and the round was
    spent moving furniture.
  * `trampleDmg` (per CARD, not a property of TRAMPLE) makes the shove HURT.
    Hoarfell crushes for 12, through shields, because masonry is not armour to a
    juggernaut. 30.2% -> **50.0%**, level with Vulcanyx (51.0) and Xilty (46.9).
    Swept: 8 gives 32.3, 16 gives 47.9 — 12 is the efficient point because it
    breaks a 20 HP gate in exactly two steps and anything past that is wasted.

Both shove sites go through one `applyShove` helper so the damage cannot drift
between them. WarPhant, Bearocks, Oakgre, Bison and Burnout are untouched —
measured, Vulcanyx and Umbranova did not move.

**SKELEEZE AIMS, AND NIGHTSHRIKE CAME BACK DOWN.** Two follow-ups to the wall
pass, both from on-device reports.

Swiftshooter was `shiftLateral` — a blind one-slot shuffle that wrapped to the
next OPEN square. It now uses Helion's `aimLateral` (toward the column holding
the most of the player's cards) at TWO slots a round, TRADING places with
anything in the way, so a screen parked in front of the archer relocates the
problem rather than solving it. New `aimLateralSteps` (default 1) and
`aimLateralSwap` on the shared gait, so Helion is untouched. 32.3% -> 42.7%.
NOTE `aimLateral` honours BOSS_HOLD_ROUNDS and `shiftLateral` does not, so
Skeleeze now holds its home row for the opening like everything else.

NIGHTSHRIKE 77.1% -> 61.5% (shields 12 -> 6, Death From Above 12x3 -> 9x2, body
108 -> 96). Worth reading as a cautionary tale about tuning mid-flight: this card
was the tower's EASIEST fight at 45.5%, was given shields and a bigger dive to
fix that, and then the war chest, the reach fix and the Fortress Gates all landed
on top — leaving it the hardest thing on Floor 1, ahead of Smolder's 60.4 and
double Permafrost's. The buff was correct when measured and wrong by the time the
session ended. RE-MEASURE EARLIER TUNING AFTER ANY SYSTEMIC CHANGE.

**RE-TUNING THE SLOW BOSSES AGAINST THE WALL — what worked and what did not.**
The Gates cost the single-swing bosses everything, because SHIELDS BLOCK PER HIT:
Smolder's 10 landed for ZERO against 10 shields, Permafrost's 14 for 4, and
Xilty's 14x2 lost ten twice, while Helion and Skeleeze — whose Specials already
declared `pen` — barely noticed. The split was never about how strong a boss is,
only about whether it had a way through masonry.

WORKED:
  * **A boss's damage PIERCES a gate's shields** (`resolveHit`: `aDef.boss &&
    tDef.guardsHomeRow`). Put it on the BASIC path first and that missed the half
    that mattered — Hoarfell's Aurora Break hits three gates for 10 each and was
    doing zero to every one of them. At the damage layer it covers Specials too:
    Hoarfell 12.5 -> 30.2, Cryovex 53.1 -> 75.0, Nightshrike 51.0 -> 77.1.
  * **The gate is NOT pushImmune.** It was, on the reasoning that a fortress does
    not budge — and that deleted Hoarfell's whole identity, since TRAMPLE was
    refused AND its momentum ramp needs unobstructed advance, so Avalanche never
    built once. A keyword the wall ANSWERS is fine; a keyword the wall DELETES is
    not. A juggernaut now shoves a gate aside and opens a lane without the wall
    falling.
  * **Straight damage on the three stragglers**: Permafrost 14/70 -> 22/90 (body
    161, under Floor 1's 170 cap), Skeleeze 12/105 -> 30/110, Helion 8/70 -> 14/90.

DID NOT WORK — do not retry:
  * **A LONGER CLOCK MAKES BOSSES WEAKER, NOT STRONGER** — and the tower now
    RUNS AT 30 anyway, at the owner's call, with the cost known and accepted.
    Running the clock out is a BOSS win (`VOID_TOWER_ROUNDS`), so every round
    added is a round the player gets to keep swinging. Measured twice, years
    apart in this file's terms, and it points the same way both times. See
    "THE CLOCK IS 30" below for the current numbers. Left in this list because
    the INSTINCT it corrects is still wrong: it reads like "more time to break
    the wall" and it is the opposite.
  * **Speed did not save Permafrost.** Advancing every round instead of every
    second measured WORSE (11.5 -> 9.4). Its kit has no answer to masonry at all —
    Whiteout only fires on targets at 6 HP or less, so a 20 HP gate is invisible
    to it — and arriving sooner with nothing to say changes nothing.

Tower with the wall, after the pass: Rotroot 40.6 · Permafrost 34.4 · Smolder
60.4 · Nightshrike 77.1 · Skeleeze 32.3 · Overclock 64.6 · Basilisk 34.4 · Helion
51.0 · Xilty 46.9 · Hoarfell 30.2 · Thunderfangs 88.5 · Vulcanyx 51.0 · Umbranova
94.8 · Cryovex 75.0. Still player-favoured on the lower floors and Umbranova is
still untouched by any of it (its damage ignores position, so a wall is nothing to
it) — the next pass, if wanted, is the remaining low end.

**THE FORTRESS GATES — a five-wide wall the player starts every Void fight
behind.** One `void_fortress_gate_tok` per column in the row DIRECTLY IN FRONT of
the player's home row (`voidGateSeats`), placed free at setup. 20 HP behind 10
shields, SP 0, `pushImmune` (Hoarfell's TRAMPLE would otherwise shove a fortress
aside), and it costs the player nothing.

Two flags carry it, both new:
  * `guardsHomeRow` — while a gate stands, enemies cannot TARGET the home square
    directly behind it. Enforced in `canTarget`, deliberately, not in pathing:
    `pathBlocker` lets fliers over by design and says nothing about who may be
    SHOT, so a flying or ranged boss would simply reach over the wall. canTarget
    is the one door every attack, Special and spell passes through. Per COLUMN,
    so breaking one gate opens exactly that lane — a single gate screening the
    whole ROW instead measured Permafrost 77.1% -> 27.1%, a fight switched off
    rather than a wall to break.
  * `noKillReward` — killing a gate fires NO on-kill rider and does not advance
    `killCount`. Every boss here grows on kills (Vulcanyx +3 DMG and 10 HP,
    Thunderfangs a wolf plus a tick toward Stormform, Cryovex a crystal), so a
    wall that paid out on the way down would be a free meal parked in reach.

**IT LARGELY REVERSES THE TOWER — the bosses need re-tuning against it.** Before
-> after: Permafrost 77.1 -> 6.3 · Hoarfell 85.4 -> 12.5 · Skeleeze 67.7 -> 20.8 ·
Helion 68.8 -> 29.2 · Basilisk 68.8 -> 33.3 · Xilty 81.3 -> 35.4 · Rotroot
71.9 -> 36.5 · Smolder 75.0 -> 50.0 · Nightshrike 92.7 -> 51.0 · Vulcanyx
87.5 -> 52.1 · Cryovex ~98 -> 53.1 · Overclock 82.3 -> 58.3 · Thunderfangs
97.9 -> 81.3 · Umbranova 96.9 -> 96.9. Slow bosses suffer most — five gates at
20/10 is a lot of material against a 24-round clock, and Permafrost spends the
fight chewing masonry.

IT ALSO KILLED THE OVERRUN PROBLEM: overrun's share of wins fell to 0-3% for most
of the roster (from 80-93% on the worst offenders), because the boss can no longer
walk into an undefended home row. Umbranova is the lone holdout at 96.9% — its
damage ignores position entirely, so a wall means nothing to it.

## BOSS TAMING — the tower's first loop that points BACKWARD

Clear a floor and every boss on it turns **ENRAGED** (`bossEnraged`, derived from
`eventsDone` like all tower progression — no stored flag that can disagree).
Beat one while it is enraged and it fights **for you** in your next 3 battles at
**`TAME_SCALE` of everything** (0.7 — it was 0.5). The reward for finishing a floor is a reason to return
to it, and what you earn there is spent upstairs.

Owner's calls, settled up front: the tamed boss is **pre-placed free** on your
centre home slot (a 12-cost mythic is never affordable in a 24-round fight, so
one you had to buy is one you would never field); **one per fight**; enraged
means **buffed stats**, not just a label; a use is spent on **entering**, win or
lose (paying at settle would make it farmable by conceding at round one).

**One boss has its own scale: Thunderfangs is tamed at FULL strength**
(`VoidBoss.tameScale`, read only through `tameScaleFor`; owner, 2026-09-27: "not
to the same level of, say, a Vulcanyx"). Its boss strength is borrowed from a
pack (Pack Law) that does not change sides with it, and its printed body is Floor
3's smallest by design, so at 0.7 it was the weakest ally on its floor. Measured
as the player's ally across the four Floor 4 fights (8 premades x 12 seeds each,
384 fights, both sides AI, set up like `startArenaMatch`): win 4.7% at 0.7, 5.7%
at 0.85, 9.4% at 1.0, against Vulcanyx 7.6% at 0.7 (Xilty 43.8, Hoarfell 13.5,
no ally 0.0); ally damage 132 -> 203 against Vulcanyx's 213. Bringing two Spark
Wind Wolves along instead measured 4.4%: they die at once. The board (App), the
preview (`tamedStats`) and the copy (BossDetail, the tower footer) all read
`tameScaleFor`; the boss FIGHT is untouched.

## TOWER DIFFICULTY TARGETS (owner's, and the tower is NOT there yet)

Boss win %. Floors 1-2 judged BARE; floors 3-4 judged WITH A TAMED ALLY,
because those floors are meant to expect one.

| floor | target | now | verdict |
| --- | --- | --- | --- |
| 1 | 50 | 41.9 | close — Permafrost 20.8 and Smolder 37.5 drag it |
| 2 | 60 | 46.6 | short — Basilisk 24.0 and Skeleeze 39.6 drag it |
| 3 (ally) | 60-70 | 37.5 | short — only Vulcanyx (62.5) is in band |
| 4 (ally) | 80-90 | 66.9 | short — only Kazehaya (81.3) is in band |

Body caps were raised to allow this at all (`FLOOR1_BODY_CAP` 170 -> 300,
`BODY_CAP_PER_FLOOR` 60 -> 90): the targets need x1.85-2.4 on most bosses and
the old ceilings forbade it.

**WHY IT DOES NOT CONVERGE BY BUFFING BODIES, and read this before the next
pass.** Two structural problems, both measured:

1. **THE FLOORS ARE COUPLED, and it bit twice.** A floor's tamed ally is the
   biggest boss on the floor BELOW, so buffing floor N buffs floor N+1's ally.
   Buffing Floor 2 this pass took Thunderfangs' ally case from 67.7 DOWN to
   35.4 — its ally (Helion) got 1.7x bigger. Any floor-by-floor pass fights
   itself; the tower has to be tuned bottom-up in one go, re-measuring above.
2. **~~SEVERAL BOSSES ARE SATURATED ON BODY~~ — FIXED, and the diagnosis was
   half wrong.** The three flat bosses were not missing a mechanic; their
   SPECIALS HAD NEVER BEEN SCALED. Three body retunes moved hp/dmg/shields and
   left `special.params.dmg` alone, so Umbranova reached 336 HP and a 41 basic
   while Meteor Fall still hit the whole board for **7**, and Hoarfell swung 40
   behind a 10-damage Special. More body meant more rounds of a Special that
   could not matter — which is exactly what "saturated" looked like.

   | boss | fix | ally, before -> after |
   | --- | --- | --- |
   | Xilty | `statusNova` -> `barrage` (dmg 15) + `vsStatus` ROOT +20 | 42.7 -> **61.5** |
   | Hoarfell | `roundTick.inRangeDmg` 17, Special 10 -> 17 | 10.4 -> **47.9** |
   | Umbranova | Special 7 -> 12 | 57.3 -> **89.6** |

   Xilty was the clearest case: `statusNova` deals NO DAMAGE AT ALL, so it
   locked the board every three rounds with no way to cash the lock in. A +20
   payoff on its basics moved it 1 point, because a melee spider advancing one
   slot a round never reaches what it webbed. Making the web itself bite moved
   it 19.

   **CHECK `special.params.dmg` WHENEVER YOU SCALE A BODY.** Nothing scales it
   for you, and a boss whose Special has fallen behind reads exactly like a boss
   that needs a new mechanic.

2b. **The old note, kept because the shape still recurs:** Xilty's ally case moves +21.9 on
   the first quarter-multiplier then +3.1 on the next. Hoarfell's `overrun`
   count is 16/15/15 across a 50% buff — dead flat, it converts stats into
   survival and never into kills. Umbranova the same (42.7 -> 43.8 across
   x1.25 -> x1.5). For these, more body buys a longer stalemate, not a harder
   fight; they need KIT changes — a kill path or clock pressure.

**THE CLOCK IS 30 ROUNDS** (`VOID_TOWER_ROUNDS`, was 24) — owner's call, and it
is the single biggest lever on tower difficulty because TIMEOUT is how most of
these bosses win. Boss win %, n=96, measured before and after:

| | bare 24 | bare 30 | ally 24 | ally 30 |
| --- | --- | --- | --- | --- |
| Xilty | 78.1 | 40.6 | 46.9 | 20.8 |
| Hoarfell | 68.8 | 39.6 | 18.8 | 7.3 |
| Thunderfangs | 92.7 | 86.5 | 54.2 | 49.0 |
| Vulcanyx | 69.8 | 57.3 | 47.9 | 38.5 |
| **Floor 3 avg** | **77.4** | **56.0** | **42.0** | **28.9** |
| Umbranova | 92.7 | 90.6 | 32.3 | 28.1 |
| Cryovex | 97.9 | 90.6 | 44.8 | 27.1 |
| Kazehaya | 96.9 | 82.3 | 45.8 | 26.0 |
| Kato | 84.4 | 76.0 | 51.0 | 28.1 |
| **Floor 4 avg** | **93.0** | **84.9** | **43.5** | **27.3** |

Floor 3 lost 21 points bare; Floor 4 lost 8. The floors that were tuned to the
24-round clock are all now easier than the numbers recorded against them, and
Xilty and Hoarfell (40 / 39.6 bare) have fallen out of band entirely. Re-tune
against THIS table, not the ones above it.

**FLOOR 3/4 AFTER ANTI-AIR — measured at the OLD 24-round clock, kept for the
anti-air delta rather than as current difficulty:**

| | bare | with ally |
| --- | --- | --- |
| Xilty | 78.1 | 46.9 |
| Hoarfell | 68.8 | 18.8 |
| Thunderfangs | 92.7 | 54.2 |
| Vulcanyx | 69.8 | 47.9 |
| **Floor 3 avg** | **77.4** | **42.0** |
| Umbranova | 92.7 | 32.3 |
| Cryovex | 97.9 | 44.8 |
| Kazehaya | 89.6 | 11.5 |
| Kato | 84.4 | 51.0 |
| **Floor 4 avg** | **91.2** | **34.9** |

**Anti-air itself is worth 0-5 points** on most bosses (toggled on/off in one
pass), which is what 25 fliers across 8 core decks should buy. The exceptions
are where the fliers live: against the GALE core Kazehaya went 42 -> 83 bare and
Thunderfangs 67 -> 92. Kazehaya gains most because its whole kit is hauling
things into its sword and fliers were simply exempt from it.

**THE LEAF BARK CHANGE COST KAZEHAYA 35 POINTS — isolated, not guessed, then
FIXED ON ITS OWN CARD.** Its ally case read 34.4 before that batch and 11.5
after, which anti-air (+5) came nowhere near explaining. Re-running with ONLY
the old `printed + 3` ceiling restored put it back to 46.9 while every other
boss moved 0-2. Kazehaya is the tower's most LEAF-dependent fight — a LEAF boss
printing 14 shields, fielding Warden (4) and two Sakuroot (4) — so a flat cap of
3 lands on it and essentially nothing else.

Repaired with **HEARTWOOD** (`shieldPerHitTaken`, 1 per blow, ceiling 9) rather
than by reverting the element rule: the rule was right and this card depended on
it. Ceiling 9 not 14, because a FULL rebuild over-corrects — the curve is steep
at the top and worth keeping:

    none 11.5 · cap 4 19.8 · cap 6 26.0 · cap 8 36.5 · **cap 9 45.8** · cap 10 49.0 · cap 14 62.5

Kazehaya now reads **45.8% with an ally** (Umbranova 32.3, Cryovex 44.8, Kato
51.0) and 96.9% bare. GENERAL LESSON: an element-wide rule change can land almost
entirely on one card. Check the element's own boss before shipping one.

**EVERY BOSS ANSWERS FLYING (`antiAir`), and the audit method is the lesson.**
FLYING is immunity to melee and the tower is mostly melee. Reading the defs said
six bosses were stuck; TESTING said **eleven**. The five the field audit let
through were the ones whose Specials apply a grounding status — they could not
land ROOT or FREEZE on a flier because they could not TARGET one, so the answer
needed the answer. Audit reach by firing the thing, not by reading what it says.

`antiAir` is a Special param that lifts ONLY the FLYING dodge. `ranged` would
also have worked and is the wrong tool: `asRanged` skips the whole melee block,
so it discards the Special's printed `reach` and turns "within 2 spaces" back
into the board-wide nova that was already fixed once. A test now fires every
boss at a flier, so this cannot regress.

**LEAF bark is a FLAT cap of 3, not printed + 3.** The old ceiling handed an
armoured LEAF card three shields ON TOP of its print every round it was struck,
so it ended rounds harder to kill than it started. Stated cost, pinned by test:
a card printing MORE than 3 (Thorn, Trinezer, Elderroot, Warden, Dandelion,
Sakuroot) is pulled down to the line by damage and held there — it does not get
its last points back. That is the trade the old rule existed to avoid, in the
other direction.

**Token spawns search NEAREST RING OUTWARD.** `spawnTokens` searched ring 1 and
then fell back to a whole-board row sweep ordered most-forward-first, so the
moment the adjacent square was taken the token deployed to the furthest forward
slot on the board — a card standing in front of the spawner sent its own spawn
to the other end of the battlefield. The ring loop now runs to the board's
width and the fallback is gone.

**ENRAGE IS 1.5** (was 1.25) — half again on every line including the Special,
since it runs through the same `statScale`. The Floor 3/4 numbers below were
measured at 1.25 and are NOT re-measured for this; the enraged fight is a
separate, harder version of each.

**LAST HOWL (Thunderfangs).** `transformOnDefeat` gained `hpPct` and `burst`.
Kill Thunderfangs before it has earned Stormform through kills and it takes the
form ANYWAY — 70% of that body, plus PARALYZE 2 on everything within 2 squares,
timed for the round your board is stacked around it. The rider lives only on the
FIRST form, so killing it as Stormform is final and earning the form spends the
second life rather than stacking with it; both are asserted.

**CANCEL IS A ✕ IN THE BAR, not "Clear" in the ⋯ menu.** The action always
existed — it was filed with Auto and Surrender as "something you do once or
twice a match", which targeting disproved: arm an attack, change your mind, and
the way out was two taps into a menu you had no reason to think held it, while
the hints told you to press a button you could not see. It renders only when
there is something to cancel, and it is 44x44 in portrait — the same target as
the ⋯ that used to hide it. NOTE the desktop `.controls` is a stretch COLUMN, so
it needs its own height or it collapses (it first shipped 38x16).

**The mute button matches the ✕ it sits beside** — both 28x28. It was 30x30 at
15px against 28x28 at 13px, and an emoji carries more visual weight than a glyph
at the same size, so it read as the more important of the two.

**FLOORS 3 AND 4 RE-TUNED FOR THE TAMED PLAYER (per-boss body/DMG/shield
multipliers: Xilty/Hoarfell/Thunderfangs x1.6, Vulcanyx x1.2, Umbranova x1.4,
Cryovex x1.35, Kazehaya x1.2, Kato x1.3 — the chain shells follow the first
form).** Boss win %, n=96, ally = the biggest body on the floor below:

| | bare before | bare after | ally before | ally after |
| --- | --- | --- | --- | --- |
| Floor 3 avg | 48 | **74** | 13 | **36** |
| Floor 4 avg | 87 | **91** | 34 | **40** |

**THE FLOORS ARE COUPLED, and this is the thing to know before touching either.**
The tamed ally a Floor-4 challenger brings is a FLOOR-3 boss, so buffing Floor 3
buffs Floor 4's ally too and the two changes partly cancel: Floor 4's ally case
moved only 34 -> 40 despite a 1.2-1.4x buff, and the harness's ally pick even
switched from Vulcanyx to Hoarfell mid-pass because the buff made Hoarfell the
bigger body. Never tune a floor's difficulty without re-measuring the floor
ABOVE it.

**Bare Floor 4 is now brutal** — 91% average, Cryovex 96.9% (3.1% player win).
That makes the top floor effectively ally-required, which is a defensible reading
of the taming loop but IS a decision: if it should be beatable bare, Cryovex's
1.35 is the first number to walk back. Hoarfell is the other outlier, the other
way: its curve is nearly flat to body (4.2 -> 14.6 across a 50% buff), so it sits
at 15.6% with an ally where its floormates are 38-48. It needs a KIT lever, not
more meat.

**WHAT A TAMED BOSS IS ACTUALLY WORTH — measured, and it is a lot.** The balance
harness had never brought one (every Floor-4 number ever taken is a BARE fight),
so this was a new measurement, not a re-run. Player win %, 8 cores x 12 seeds,
ally = a tamed Vulcanyx on the centre home slot:

| boss | bare | ally 0.5 | ally 0.7 |
| --- | --- | --- | --- |
| Umbranova | 14.6 | 60.4 | **74.0** |
| Kazehaya  | 13.5 | 36.5 | **60.4** |
| Cryovex   |  8.3 | 58.3 | **71.9** |
| Kato      | 16.7 | 43.8 | **56.3** |

A tamed boss at 0.7 takes Floor 4 from ~13% to ~66% — a 50-point swing, three
times. That is a power spike you SPEND, which is the design, but it does mean
the floor is soft while you hold a charge. Ally survival also jumps with the
scale (0.5: 20-43%, 0.7: 40-74%), so the two compound. If it wants reining in,
the levers in order of bluntness are uses (3 -> 2), scale, and making the ally
cost gold rather than arrive free. Note the ally here is a Floor-3 boss — the
strongest thing a Floor-4 challenger could hold — so these are the CEILING of
what taming does, not its average.

**The bare column drifted a little from the pinned numbers** (Cryovex 86.5 ->
91.7 boss-win, Kato 85.4 -> 83.3). One core deck changed since: DAWN now runs
Lassos, which brings a Golden Bull. Plausible mechanism for it costing the
player against Cryovex specifically — the bull charges in alone and dies, and
Crystal Bloom pays Cryovex a Blackice Crystal for every kill — but that is a
hypothesis, not a measured cause; it is inside n=96 noise either way.

**No string hard-codes the number.** Every UI line that quotes it reads `TAME_SCALE`;
the first version wrote "half strength" into three separate strings, which a
re-tune would have left describing a card the game no longer fielded.

**`statScale` is why this needed a new field rather than a stacked WEAKEN.** The
instance model has no printed base stats — DMG and SP are deltas layered on the
def at read time — and, more importantly, **WEAKEN and FREEZE do not reduce
Special damage at all**: a Special's number is hardcoded on the def and never
passes through `effectiveDmg`. A half-strength body built on the WEAKEN pattern
would swing for half and then cast at full. So `statScale` is a multiplier read
in three places: `effectiveDmg`, `effectiveSp`, and `resolveHit` (for
`kind !== "basic"` — basics arrive pre-scaled from `effectiveDmg`, so scaling
them again would quarter them). HP/shields are absolute, so `scaleInstance`
rewrites those once at placement. ENRAGE uses the same field pointed the other
way.

**THREE RULES SCANNED THE BOARD FOR A BOSS ON EITHER SIDE, and all three broke
on a player-side one.** The worst made the fight *unwinnable*: slay-to-win fires
when no boss-flagged body is left standing, so your own loaner kept the floor
from ever being yours. Also the home-row overrun check and the Void Tower
deployment head start (`find` takes the first boss in either seat). All three now
skip a `tamed` instance — grep `c.tamed` in phases.ts. **Any future rule that
looks for "the boss" must decide which side it means.**

**A FOURTH, THE OPENING HOLD, HELD YOUR OWN BOSS** (fixed 2026-09-26).
`bossHeldHome` asked only `def.boss`, so for rounds 1-2 a tamed ally refused
your moves ("The boss has not moved from its home row yet") and its gaits stood
still. It now exempts `card.tamed`. **WALL-PIERCING IS KEPT FOR A TAMED BOSS, on
purpose** (owner's call, same day): `aDef.boss && tDef.guardsHomeRow` in
combat.ts pierces the shields of the ENEMY's walls too — Kheiringer's Lava
Fortress Gates, Spindle's Sentinel Eyes — about 28 vs 16 a hit for Umbranova,
and it pre-empts Vulcanyx's plate-tearing on those. Don't "fix" it. Measured the
same day: the enemy AI never reads `boss`; replaying ~170k steps with a tamed
ally's flag off changed no enemy decision. (Method, scratch-only: `advance()`
the same state twice, flag on and off — the RNG cursor lives in `GameState`, so
the two agree unless the flag matters.)

**Taming is NOT ownership.** It never enters `collection`; the test asserting a
boss can be acquired nowhere still holds and must keep holding.

**Save:** `StorySave.tamed?: Record<string, number>` (boss id -> battles left).
`loadStory` is a hand-written whitelist — a new field is invisible until listed
there — and it clamps to `MAX_TAME_USES`, a local constant mirroring `TAME_USES`
because void-tower imports story and the dependency only runs one way. A test
round-trips a 9999-use save and asserts the clamp lands on `TAME_USES`, so the
two cannot drift.

**THE REVEAL.** Winning an enraged fight routes the player to the tower with
that boss's page open on a TAMED panel (`towerOpenOn` in App -> `openOnMount` on
VoidTower -> `justTamed` on BossDetail, consumed once so a later visit shows the
ordinary page). The win screen holds a GameState and cannot know which boss the
match was against, so the hand-off is recorded at settle — the only place that
knows both that the match was won and what it was against.

`tamedStats(def)` feeds that panel. It is the PRINTED card halved, not the board
number, and the difference is real: an element aura (GALE's Zephyr, +DMG off SP)
lands BEFORE the halving, so a tamed Nightshrike swings 8 where its printed 15
halves to 7. The test asserted equality first and caught exactly that, so the
guarantee is now one-directional — **the preview never over-promises** — with a
second test to stop `tamedStats` degenerating into "return the printed numbers".

**UI:** `BossDetail.tsx` — the tower tile now OPENS a boss page (locked ones
included; lore and tips are most worth reading about a fight you cannot reach
yet) with large art, lore, the authored `puzzle` line, derived facts, the
Special and its beat, `describeOwnPassives`, and the tamed-boss picker. Note
`.modal.bd-modal`, not `.bd-modal`: the base `.modal` declares its own 26px
padding and is declared LATER in styles.css, so at equal specificity it wins.

**GATES ARE SCENERY (`noBattleTurn`) — they are not in the speed queue.** Five
Fortress Gates were adding five "CAN'T ACT" rows to the queue every round of a
24-round fight, in the one panel whose whole job is saying what happens next and
in what order. The flag is DECLARED per-def rather than derived from "0 DMG with
no Special", because those are different statements: a 0-damage card that can
still be stunned or buffed into relevance belongs in the queue showing why it
cannot act — that is information; a gate belongs there the way a rock does.

**The scenery list is exactly two, and it is pinned by test:** the Fortress Gates
and Cryovex's Blackice Crystals (three alive at once, each one queuing to swing
for the 1 damage the effective-damage floor hands any 0-DMG card, on a card whose
own def says it does no damage at all — and both things it really does, Creeping
Rime and Shatter, happen at Cleanup and on death). What was deliberately left OUT
matters as much: Overclock's static wisps and Static Cloud are 0-DMG too, but
BOLT's Electrify turns a 0-damage basic into a real one against anything statused
and they drift forward on a roundTick — hazards that act, not masonry. Note
`basicIsInert` is NOT the right predicate for this: a damage floor gives every
0-DMG card an effective 1, so even the gate reads as non-inert.

Note it needed fixing in TWO places. `startBattle` builds the locked queue, but
`SpeedQueue.tsx` builds its OWN list off the board for the pre-battle preview —
so fixing only the engine left the gates showing all the way through prep and
clearing only once battle locked, i.e. exactly the half of the round the player
reads that panel in. If you add another queue-visibility rule, check both.

**THE BLAST ZONE STANDS DOWN WHILE THE PLAYER IS AIMING.** It is a warning about
the boss's turn; the moment the player is picking their OWN targets it stops
being background information and competes for the same tiles — a square can be
both "about to be hit" and "one I may hit", and two rings on one tile is not two
pieces of information, it is neither. Gated on `legalTargetIds.length > 0` in
Board.tsx, so it is scoped to TARGET picking and stays lit during a summon,
which is exactly what the player is deciding against. Verified live: arming a
spell on a firing round took blast 5 -> 0 / targets 0 -> 9, and cancelling
restored it.

**THE TELEGRAPH IS VIOLET, NOT RED — and that is load-bearing.** The boss blast
zone shipped in `--threat`, the same red the player's own attack targeting uses,
and on a live board the two are indistinguishable: "squares I am about to hit"
and "squares about to hit me" are opposite meanings wearing one colour. There is
now a `--blast` token (#b45cff) used by `.slot.blast` and `.boss-clock.now`.
Violet is the tower's own hue and is about as far from both the red targeting and
the green legal-move ring as the wheel allows. Note the visible colour on a tile
is carried by the inset box-shadow and the hatch, NOT by `border-color` — every
state rule on `.slot` sets `border-color` and they all resolve to the same
neutral, so don't rely on the border to distinguish a state.

**STORMWING (Kato's third shell) ACTUALLY SHOOTS NOW, and its strafe is a swath.**
Two findings worth keeping:

- `attackType: "Ranged"` alone bought it almost nothing. A ranged basic is capped
  at reach 2 from the row it was summoned in and 3 once it advances off it, and
  this shell's `aimLateral` gait slides along its own home row and NEVER advances.
  Measured, the jet reached rows 1-2 and nothing beyond — one row more than the
  melee cat it grew out of. It now carries `ignoresHomeRule`, which drops the
  reach cap and the sight screen both.
- **Thunderhead's damage was unraisable.** dmg 10 and dmg 40 measured the SAME
  68.8% with a byte-identical win breakdown, because a one-column `sameColumn`
  strafe on a Floor-4 board is usually over an empty column. A number that keeps
  missing cannot be raised into relevance. The fix was width: a new
  `columnSpread` barrage param (0 = the old single column, so every other caller
  is untouched) makes it three columns wide, and the damage went 10 -> 16 on top.
  `specialTargets` mirrors the param, which is what keeps the red zone honest.

Honest caveat: NONE of it measures. Every variant swept (spread 1/2 x dmg
10/14/18, ranged on/off) landed in 68.8-70.8%, inside noise, because the jet is
only reached in 46% of fights and the outcome is set before it arrives. This is
a FEEL change, which is exactly what the Cryovex note says to do on Floor 4.

**FLOOR 4 IS NOW LEVEL, all four inside 1.1 points** — Umbranova 85.4 ·
Kazehaya 85.4 · Cryovex 86.5 · Kato 85.4. Every one of them was raised to that
line deliberately, so treat a boss drifting off it as a regression.

**HOW EACH ONE GOT THERE IS THE USEFUL PART — the lever differs by SHAPE:**

| boss | what moved it | what did NOT |
| --- | --- | --- |
| Umbranova | HP 60->100, then ranged basics | damage (6 vs 10 read the same) |
| Kazehaya  | Special reach 2->3 (+14.6 pts alone) | body was the small half |
| Cryovex   | Special reach 2->3, then dmg 7->12 | +HP overshot to 95.8% |
| Kato      | +6 basic DMG per shell | body: a HARD ceiling at 82.3% |

Two rules fall out of it, and both are cheap to check before you tune anything:

1. **On a nova, reach beats damage.** Kazehaya and Cryovex both jumped ~10-15
   points on radius alone. Kato's jet as a one-column strafe could not be raised
   at all — 10 damage and 40 damage read an identical 68.8%. Ask what a Special
   can REACH before raising what it hits for.
2. **Read the win TYPES before adding body.** Kato capped at 82.3% across +40,
   +55 and +70 HP and across two shield levels — the same number four different
   ways — because 72-75 of its 96 wins were already TIMEOUTS. More body buys
   more timeouts. A boss that is running out the clock needs to kill faster, not
   live longer.

**UMBRANOVA SHOOTS NOW TOO** (`ignoresHomeRule`, 82.3 -> 85.4). Same hole Stormwing
had, and worse here for being on-theme: a ranged basic caps at reach 2 from the
row it was summoned in and `avoidLateral` never advances, so the boss whose whole
lesson is "position buys nothing" could not reach past row 2 with its own attack.
That was the one place on the card where position bought everything.

**REACH IS THE LEVER ON A NOVA; DAMAGE IS NOT.** The single most useful finding of
this pass, from two bosses measured the same way in the same sweep:

- Kato's Stormwing — a one-column `sameColumn` strafe — could not be raised into
  relevance at ALL. dmg 10 and dmg 40 read the same 68.8%.
- Kazehaya's Cutting Wind — a `reach` nova — went 67.7% -> 82.3% on the Special
  alone (8 dmg/reach 2/haul 1 -> 15/reach 3/haul 2), with the body untouched.

The difference is how much board the shape covers. On a 5x5, reach 3 catches most
of what the player owns; one column catches whatever happens to be standing in it,
which by Floor 4 is usually nothing. Before raising a boss Special's damage, check
whether its SHAPE can hit anything first.

**KAZEHAYA — Floor 4's FOURTH boss, the duellist.** LEAF tribe / GALE mechanic,
tribe Grove (Warden + Galeon + 2 Sakuroot + the two new retinue tokens, 36 exact).

It is the tower's one THRESHOLD boss. Gale Riposte (`onHeavyHit`, a new reusable
CardDef field) trips on any SINGLE attack over 15 and answers by WEAKENing and
throwing back everything within 2 — no damage, just ground. The gate reads the
WHOLE swing, HP damage plus what the shields ate, so stacking shields onto the
carrier cannot switch its own passive off. 15 is also its printed DMG: the number
you have to stay under is on the card twice. The answer is small, frequent hits,
which is the exact inverse of Cryovex one seat over.

Staying at range is not the other answer, because Cutting Wind (`pullToCaster`)
DRAGS everything it hits into contact and ROOTs it there. Its gait is
`aimLateral` — it squares up and never advances, so the Special is the only thing
that closes distance, and it closes it the wrong way for you.

Two TOKENS were added with it and are the point of the formation, not filler:
**Leafwind Forest Guardian** (`leaf_leafwind_guardian_tok`, 4g, `pullOnAttack`)
hooks what it hits one slot closer — doing the samurai's job twice a round
against a Special that only fires every three — and **Whirlwind Forest Warrior**
(`gale_whirlwind_warrior_tok`, 3g, `onHitPush`) shoves one slot away. Pointed
opposite ways deliberately: between them a player's line stops being a line.

Measured 85.4% after the Special raise + hp 80 (see the Floor-4 note above). Its win
TYPE is the odd one out — 61 timeouts to 4 overruns where the rest win by
clearing the board — and that is `aimLateral` behaving correctly. Don't "fix" it.

**KATO — Floor 4's THIRD boss, and the tower's first CHAIN.** BORE tribe / BOLT
mechanic, tribe Cavernous (the whole four-card tribe: Deepest + Coreborer +
Venomarch + Obsidian x2 + a Zipp, 36 exact — Cavernous costs 5/6/9/10 and could
not fund a floor below this one).

Kill it and it gets back up as something else, at full HP, with different rules:

    Kato (war machine)  TRAMPLE      -> lost when the shell breaks
    Kato, Prowlform     dodges       -> lost when THAT shell breaks
    Kato, Stormwing     FLYING       -> the end of the chain; this one dies

New `transformOnDefeat: { into }` on CardDef, hooked at the TOP of `defeatCard`,
ABOVE the Siren `transformedFrom` revert — the two answer the same moment in
opposite directions (that one sends a disguise BACK, this carries a chain
FORWARD) and a card doing both would bounce between forms instead of advancing.
It deliberately never sets `transformedFrom`, which is what keeps them apart.
Every form is `boss: true` so slay-to-win cannot fire until the last is gone, and
the middle forms carry no VOID_BOSSES entry (the roster test knows that shape).

THE DODGE IS `firstAttackMisses`, NOT EVASION. `chanceProblems` fails the build on
EVASION by name — bosses here roll no dice — and the doc replaced its own 55%
EVASION with exactly this. Same idea, made countable.

**EACH SHELL FIGHTS WITH ITS OWN HANDLER** — machine `battleCharge` (ploughs the
lane), cat `strike` (springs and takes the square), jet `barrage` (strafes a
column, then `selfMirror` banks it to the opposite slot so the column it emptied
is never the one it is standing in). All three were `barrage` first, which made
the chain one move resized three times AND broke the cat outright:
`takeSpotOnKill` and `chargeLateral` are STRIKE-only params that a barrage never
reads, so the pounce never took its square.

67.7%, with 42% of fights reaching Stormwing. BODY IS A WEAK LEVER on a chain:
40/40/34, 36/36/30 and 32/32/26 measured 83.3 / 79.2 / 82.3, all inside noise,
because three lives means trimming each shell removes only a fraction of the
total. THE KIT IS THE LEVER — giving each form its own handler moved the fight
79.2% -> 67.7% and doubled how often the chain runs its full length (26% -> 42%)
without changing a single number.

It is also the floor's answer to a real complaint about its shape: Umbranova
ignores position and Cryovex freezes you in place, so both are in their way
immune to where you stand. Kato is a POSITIONAL fight three times over, and the
position that solves one form is the wrong one for the next.

**CRYOVEX — Floor 4's SECOND boss** (AQUA tribe / DUSK mechanic, tribe Dragon).
The ice flight: Hydrogon (AQUA's aura dragon, +4 SP to Vapor) + Glacius + Phrost
+ Sapphire + Coilblade + SkullDrake + Arctik, 36 exact. Pyrogon STAYS with
Umbranova — the fire aura dragon belongs to the fire boss.

DEEP FREEZE (`vsFrozenRamp: {per, max}`) is the new mechanic: +4 DMG for every
round a target has been held FROZEN, to +16, read off a per-instance
`frozenRounds` that Cleanup keeps. The counter RESETS the moment the freeze
lifts, so cleanse is the fight rather than a tax — the inverse of Xilty's lock one
floor down, where the answer was to bank a round and play through it. Verified
ramping 13 -> 17 -> 21 -> 25.
  * `frozenRounds` MUST be counted above `if (!rt) continue` in doRoundTicks. It
    was written below it first, so it only ticked for cards that happened to
    carry a roundTick — an ordinary body could be frozen ten rounds and Cryovex
    would never notice. Its own test caught that.
  * CRYSTAL BLOOM: every kill grows a **Blackice Crystal** token (max 3 alive) —
    0 DMG, SP 0, FREEZEs the closest opponent each round, and `onDeath.
    inRangeStatus` (new, the generic form of `frightenInRange`) bursts it into
    another FREEZE on everything beside it. Killing the crystals is itself what
    starts the next freeze.

**NOTHING TUNES A FLOOR-4 BOSS IN THIS HARNESS.** Swept across the whole design
space — formations of 7/5/4/3 bodies, Absolute Zero freezing for 2 or 1, Hoarbite
on and off, crystals inert, and NO FREEZE ANYWHERE — every variant measured
97.9-100% with 79-85% of wins by overrun. Umbranova is the same shape at 96.9%.
On Floor 4 the AI cannot hold a board, so the fight ends in the back line whatever
the boss does. Size these cards against each OTHER (Cryovex 131 body vs
Umbranova 128) and judge their feel on-device; the win rate is not measuring them.

**THE HOME-ROW SOFTLOCK (`summonLandingRow`) — and why overrun looked broken.**
Summoning is column-addressed with the row IMPLIED to be your home row, so a side
whose home row is entirely enemy-held could not play a card at all. An ordinary
match hides this completely: holding every enemy home slot IS the capture win, so
the state ends the game the moment it happens. Void Tower turns capture off, so
it persisted — measured at the instant an overrun fired, the player held **6.92
cards in hand and 23.79 in deck, with 0.00 open home slots and 0% of them
playable.** Thirty-one cards and no legal move for the rest of the fight.

So overrun was never misfiring; it was ending a game that had already become
unplayable. The fix is the LOCKOUT. `summonLandingRow` resolves a summon's row
instead of assuming it: the home row normally, else the nearest open square up
that column. Two limits, both load-bearing:

  * it opens ONLY when the row is blocked by things you cannot clear — enemy
    bodies and captured slots. A row packed with your OWN cards is not a lockout
    (move one forward), so the hatch stays shut and ordinary tempo is untouched.
    A test failure is what forced that distinction.
  * reinforcements land FORWARD, toward whatever took the back line. An escape
    hatch, not a free redeploy.

No intent change was needed — summons stay column-addressed. Effect on the tower
(overrun's SHARE of wins in brackets): Nightshrike 96.9 -> 92.7 (85% -> 80%) ·
Overclock 86.5 -> 82.3 (82 -> 78) · Permafrost 78.1 -> 77.1 (35 -> 24) · Hoarfell
85.4 (57 -> 52) · Rotroot 70.8 -> 71.9 (9 -> 4). Thunderfangs (97.9) and Umbranova
(96.9) did NOT move: against those two the player's board is genuinely wiped, so
the hatch places a card forward and it dies. Their remaining problem is that they
field more bodies than the player can answer, which is a strength question about
those two cards rather than anything to do with this rule.

**OVERRUN EXISTS TO STOP SPELL-CARRIED, BOARDLESS RUNS — and it works.** The
owner's reason, which is not visible from the win rates: a player with a full
spellbook can stall an empty board and snipe the boss, which makes a run far too
easy. Void Tower gives the BOSS no spells (`buildVoidEncounter` passes `[]`) and
the player a full derived book — 8 on the 5x5 — so the asymmetry is real.

Measured, at the moment each fight ended (n=624 across the roster):

    boss won BY OVERRUN      P1 had 0.06 cards on board — EMPTY 95% of the time
    boss won any other way   P1 had 4.44
    player won               P1 had 7.81 — empty only 7%

So overrun is not taking board-based fights off the player. It is ending games
where the player has nothing left but a spellbook, which is precisely its target.
A first read of the win rates alone concluded the opposite ("it converted a third
of player wins into losses") and recommended dropping the rule — WRONG, and worth
recording as a lesson: a win-rate delta says nothing about WHICH fights moved.
Ask what the board looked like when the game ended.

Win rates with the rule live (hold=2, boss required in the row): F1 Nightshrike
96.9 · Rotroot 79.2 · Permafrost 77.1 · Smolder 71.9 · F2 Overclock 85.4 ·
Skeleeze 68.8 · Basilisk 68.8 · Helion 68.8 · F3 Thunderfangs 96.9 · Hoarfell
84.4 · Xilty 82.3 · Vulcanyx 69.8 · F4 Umbranova 96.9. The high ones are fights
the player finished with an empty board.

**AUTO-FIRED SPECIALS NOW OBEY THEIR OWN REACH — the single biggest correction
in the mode.** `fireCardSpecialInner` handed the handler EVERY living enemy on
the board and never ran the targeting rules. The auto-fire path is the only one a
boss ever uses (the Special fires on `fireSpecialEveryN`, and canFireSpecial
refuses a manual boss cast), so `reach` did nothing at all. Measured before the
fix — a card FOUR squares away versus one adjacent:

    Hoarfell 9 / 9 · Thunderfangs 9 / 9 · Smolder 8 / 8 · Rotroot 7 / 7 · Vulcanyx 11 / 11

Every "to every opponent within 2 spaces" on the tower was a board-wide nova
wearing a radius in its text. Enemy targets now come through
`validSpecialTargets`, the same door a manual cast uses, so the two agree and the
telegraph is honest; Specials that really are board-wide say so themselves
(Permafrost's Whiteout declares `ranged`, Umbranova's Meteor Fall is `smite`).

IT ALSO RETRACTS TWO EARLIER ENTRIES. Web Trap's "missing reach" was never what
made it weak — reach did nothing on that path — so its +3.2 came from the ROOT
rider added alongside. And Fissure's `ranged: true` measuring exactly 0.0 was not
noise: it was a no-op, because `sameColumn` had always filtered the whole board
correctly. The measurement was saying so and it was read as noise.

Cost, measured (before -> after): Basilisk 68.8 -> 54.2 · Smolder 81.3 -> 69.8 ·
Helion 68.8 -> 58.3 · Rotroot 79.2 -> 70.8 · Hoarfell 84.4 -> 79.2. The melee-nova
bosses paid for it; Nightshrike, Thunderfangs, Umbranova and Overclock did not
move at all, because their wins never came from the Special (see overrun).

**Two follow-ups it forced.** HELION needed `ignoreHomeRule` on Solar Lance: it is
EMPLACED in its own home row, and the Home-Slot rule lets a defender's home slot
be targeted only from a MID row or from inside it — so a siege engine measured 0
damage to the back line and 22 to the mid row, and you beat it by parking
everything at the back. 58.3 -> 67.7 with the exemption. HOARFELL went 66 -> 90 HP
(body 111 -> 135, 79.2 -> 85.4): the juggernaut spends its rounds walking, and
those rounds now threaten nothing at range.

**A GROWTH TRANSFORM MUST NOT HEAL.** `SPECIAL_HANDLERS.transform` takes the new
form's FRESH body (full HP, full shields, stat mods wiped), which is correct for a
Special that turns into something else and badly wrong for a second form earned
mid-fight. Thunderfangs whittled to 4 of 50 came back as 60 of 60 the instant it
landed its fifth kill — "it never dies, it just comes back", from the device.
`registerKill` now carries the wound across and grants only the INCREASE (+10 max
and +10 current at +20% of a 50 HP body, so 4/50 -> 14/60; a healthy one still
ends healthy). Fixed at the CALL SITE, not in the handler, because the handler is
shared with cards whose transformation is meant to be a new body. Any future
`transformAtKills` card inherits the fix.

**THUNDERFANGS HAS A SECOND FORM, AND A PACK THAT REPLENISHES.** Raise the Pack
(`onKill.spawnToken`, capped at 3 alive) puts a **Spark Wind Wolf** token on the
board with every kill — Wolf tribe, so it feeds Pack Law, and it ELECTRIFIES what
it bites so Storm Teeth (+4 vs afflicted) lands harder. At **5 kills** it becomes
`boss_thunderfangs_2`, "Thunderfangs, Stormform", +20% on every line
(10/50/14/6 -> 12/60/17/7) via the new `transformAtKills` field and a per-instance
`killCount`. Second forms are boss cards with NO VOID_BOSSES entry — reachable
only by transforming — and the roster test knows about that shape now.

IT READS 100% AND ITS STATS CANNOT FIX THAT. Stormform is reached in ~32% of
fights, and **97% of its wins are overruns**. Swept: Pack Law max 12 -> 8 -> 6 and
HP 50 -> 44 -> 38 all still measure 99-100%. That is the general lesson for this
mode — for a boss that fields MANY BODIES (Thunderfangs' wolves, Overclock's
drones), overrun is close to automatic and the boss's own line is nearly
irrelevant to the outcome. Tune the RULE, not the card. And remember the harness
plays the player's side with the AI: overrun only fires on an empty board, so a
human who keeps one is not in this measurement at all.

**CAUTION on the boss-in-the-row clause.** It was added to stop drone chaff
delivering the win, and it does (Helion 20% -> 0% overrun, Overclock 90.6 ->
85.4) — but a SPAWNER swamping an empty board is exactly the case the rule is
FOR, so this clause works against its own purpose on Overclock. Revisit it before
adding more conditions.

**Floor 2 took +25% HP** (owner's call after playing it): Basilisk 44->55,
Overclock 40->45. Skeleeze and Helion excepted by explicit instruction. The floor
reads Skeleeze 69.8, Helion 68.8, Basilisk 67.7 — and **Overclock 91.7%, which
is OVERRUN and not the HP.** Measured: 40, 45 and 50 HP all read 91.7% to the
decimal, and 91% of its wins come by overrun. Production Run floods the board
with drones, the drones walk into the player's home row, and the fight ends
there with the boss barely involved. A SPAWNER converts the overrun rule into a
near-automatic win, which is worth knowing before tuning anyone's stat line
against it — and worth deciding about, since the mode's premise is that you win
by slaying the boss.

**EVERY BOSS MOVES LIKE ITSELF — and `roundTick.advance` IS Acorn's SEED ROLL.**
Reported from the device: "why do all the bosses still mostly have the same
movement pattern? I didn't ask for most of them to be given seed roll." Audited,
and dead right: nine of thirteen ran one of three behaviours — plain `advance`
(Xilty, Vulcanyx, Thunderfangs), `shiftLateral` (Skeleeze, Nightshrike), or
nothing at all (Permafrost, Overclock, Umbranova, Smolder). Only four had a
bespoke gait. `advance` is literally Acorn's ability and logged its line, so
three bosses moved AND read like a LEAF sapling trundling up the board.

Three new gaits, and a rule: a card that names its `roundTick` gets its own log
line instead of "rolls forward".

  escortAdvance {need}  Thunderfangs — steps only with N allies level or ahead.
                        The boss whose whole design is "dangerous with the pack
                        up" was charging alone. Counts allies AHEAD, so trailing
                        escorts do not give permission.
  kite {belowPct}       Nightshrike — gives ground below 50% HP.
  avoidLateral          Umbranova — drifts to the EMPTIEST column, the mirror of
                        Helion's aimLateral. Its damage ignores position, so
                        closing buys nothing and distance costs nothing.

Permafrost took `advanceEveryN: 4` (Glacial Creep, slower than Rotroot's
shamble). Only Overclock (a production line) and Smolder (a TREE) stand still
now, and a test names them so a third cannot join by accident; another pins that
no gait owns more than 3 of the roster and at least 7 are distinct.

GAITS ARE CHARACTER, NOT POWER — measured: Thunderfangs 94.8 → 94.8, Umbranova
96.9 → 95.8, Xilty 81.3 → 81.3 (unchanged, the control), Nightshrike 65.2 →
60.4. The exception was Permafrost, 82.3 → 89.6, which made a FLOOR 1 boss
harder than anything on Floor 3; body trimmed 169 → 133 to bring it to 77.1%
rather than give the gait back.

**A TOWER WIN RATE IS AN AVERAGE OVER EIGHT VERY DIFFERENT FIGHTS — read it
with that in mind.** Every number in this section is the boss's win rate across
the 8 CORES. Broken out per deck, Nightshrike's 42% is:

    Skyrend 100 · Trinezer 86 · Pyrogon 64 · Elecdroid 43 · Imperator 21 ·
    The Deepest 14 · Kraken 7 · Shadow Horsemen 0

That is not a 42% fight, it is four near-certain losses and four near-certain
wins depending on what you brought — and it is PRE-EXISTING, measured with a
no-keyword control, not caused by any recent change. Before concluding a boss is
"balanced" at some aggregate, break it out per core: an even average can hide a
deck that cannot win and a deck that cannot lose. Nightshrike carries FLYING
again (owner's call, Aug 2026) — worth +3.5 points and it does NOT create the
spread; Skyrend was already 100% and Shadow Horsemen already 0% without it.

**THE BOSS'S ARMY WAS PRICED TWICE — `VOID_BOSS_INCOME`.** Reported from the
device: bosses "come down and just get killed" and "at the end it still has a
lot of its army left that was never used". Instrumented, and the AI was
innocent — it passed up a legal summon **0%** of the time. The economy was the
problem. A formation is costed as a BUILD-TIME budget (12/20/28/36 by floor) and
the doc says so outright — "a build-time cap on the formation's OPENING, not a
runtime wallet" — but Void Tower passes NO opening deployment, so the boss then
bought that same army at retail on `min(5, ceil(round/5))`, about 70 gold across
a whole fight. Umbranova fields 10/9/7/5/5 on that. The free-placement path would
not have helped either: `OPENING_COST_CAP` is 3.

The boss's seat now earns +2 a round in a Void Tower fight (P1 keeps its separate
round-1 `VOID_PLAYER_HEAD_START`). Measured, before → after:

    end of Prep holding cards it cannot afford:  Thunderfangs 65% → 32% ·
    Umbranova 60% → 30% · Vulcanyx 34% → 21% · Rotroot 24% → 12%
    bodies on board:  Thunderfangs 5.8 → 9.3 · Umbranova 7.7 → 10.5
    BOSS OUT AHEAD OF ITS WHOLE ARMY:  Thunderfangs 21% → 3% · Umbranova 16% → 7%

That last row is the report answered without touching movement at all: the boss
stopped walking down alone because its escorts could finally keep up. Win rates
(vs 8 CORES, n=96): Rotroot 65.6→81.3 · Permafrost 58.3→82.3 · Smolder 61.5→70.8
· Skeleeze 64.6→67.7 · Overclock 67.7→74.0 · Basilisk 63.5→60.4 · Helion
72.9→74.0 · Xilty 72.9→81.3 · Hoarfell 72.9→79.2 · **Thunderfangs 74.0→94.8** ·
Vulcanyx 68.8→74.0 · **Umbranova 87.5→96.9**. Nightshrike did NOT move (41.7 →
40.6) — whatever ails the tower's easiest fight is unrelated to gold.

**Thunderfangs' +20.8 is the one to watch**: Pack Law scales its damage with
living escorts to +12, and its 96-point body was tuned when the pack never fully
arrived. Fixing the economy re-armed the exact trap its card comment warns about.
Umbranova is the same shape. Both are candidates for a trim if they play unfair
— and remember the harness OVERSTATES a boss, because it plays the human's side
with the AI. Fairness is on-device; this number is a comparability check.

**Floor 3 gained VULCANYX** (BORE tribe / PYRO mechanic, tribe Mountain Beasts
— the two stone dinosaurs; formation is PYRO's two 8-gold Volcanic legendaries,
Infernus Rex + Magmadon, over four of them, 28 exact). THE APEX: `onKill` is +3
DMG and 10 HP back, permanently, so chump-blocking — the reflex that beats a
juggernaut — is the worst play against it. Deliberately the inverse of Hoarfell
one slot over. It is the HEAVIEST body on the tower (200) and needs to be: every
other boss borrows threat for free (Thunderfangs from the pack, Hoarfell from
momentum) while Vulcanyx borrows from KILLS, which an opponent can decline to
pay. Measured over eight bodies, 60/14 → 39.6% and 144/28 → 68.8%; the curve
flattens above that (132→144 bought 1.1 points), so more meat is NOT the lever
if it needs to be harder — give it a kit that fires without cooperation. Its art
is aliased to `pyro_infernus_rex` pending the real render.

**`holdsPosition` (EMPLACED)** — a new CardDef flag: nothing may MOVE the card,
its `roundTick` gait is the whole of its movement. Enforced in `canMove`, which
the gaits bypass (they assign `pos` directly). Helion is why it exists: a Ranged
siege engine whose Special fires down the column it STANDS in, with a card
comment promising "it barely moves" — but `findClosingMove` marches every card
it owns at the enemy home row, and a siege engine standing INSIDE that row has
no lane in front of it, so Solar Lance fired into empty space every three rounds
for the rest of the fight. Reported from the device as "it just gets here and
doesn't do much else". Helion reads 72.9% emplaced. **If a boss's kit implies a
position, give it this flag** — the per-boss movement personalities in
`roundTick` are meant to BE its movement, and the generic mover overrides them.

**A FLOOR-SCALED BENCH TIER WAS TRIED AND REVERTED — do not re-attempt it
blind.** The idea was sound and the request was reasonable: higher floors should
reinforce with better cards, not the same cost-1 chaff a Floor-1 boss throws.
Implemented as a cost band per floor (`benchFloorCost` / `benchCeilCost`), it
measured (vs the 8 CORES, 12 seeds, n=96 each; control in brackets):

    Skeleeze 64.6 [64.6] · Overclock 85.4 [67.7] · Basilisk 71.9 [63.5] ·
    Helion 84.4 [77.1] · Xilty 92.7 [78.1] · Hoarfell 85.4 [72.9] ·
    Thunderfangs 74.0 [74.0] · Umbranova 87.5 [87.5]

Floor 1 was untouched by construction. Three findings, all of which cost a
measurement pass and are worth not re-buying:

1. **Boss HP alone is a nearly dead lever — SHIELDS are the live one.** Xilty
   drops 72→40 HP with shields held at 27 and moves 92.7→87.5; Helion's first
   10 HP move it 0.0. But move HP *and* shields together and Xilty runs
   81.3 → 63.5 → 53.1 → 40.6 (72/27 → 60/20 → 50/14 → 42/10). Shields block
   per HIT, so on a board of many small attacks they are worth far more than
   their 2-points-per-shield budget price, and a boss's armour is the first
   thing to reach for when it needs to come down. Sweep BOTH or the reading
   is a lie — that mistake was made here and reported before it was caught.
2. **Bench SIZE is a dead lever too.** Three seats instead of four moved Xilty
   0.0 and Overclock 0.0.
3. **A blanket formula cannot work here**, because every tribe has its own cost
   curve and one band lands somewhere different on each. A "chaff slot" (three
   tiered seats + one warm body) fixed Hoarfell (74.0) and Helion (75.0), did
   nothing at all for Xilty (92.7 — which also disproved the tidy story that one
   cost-1 token was carrying the whole swing), and took Skeleeze to **35.4**,
   because the Skeleton tribe is cheap already so the slot cost it a real body.

If it is worth another attempt, do it as **explicit per-boss bench lists**
(`VoidBoss.bench?: string[]`) measured one boss at a time — not a formula over
thirteen tribes. The bench is the highest-leverage knob in the mode and it is
chaotic; that is the actual lesson.

**The tower SCREEN shipped** (`src/ui/VoidTower.tsx`, Tower nav tab): floors
rendered top-down, all progression DERIVED from `StorySave.eventsDone` so it
can never disagree with the save. Each boss is a portrait ART TILE — the tile
itself is the fight button, with a corner badge reading FIGHT / CLEARED /
LOCKED. Grid min is 140px, measured: a 375px phone leaves the grid 321px, so
158px fell to one 321x401 tile per row.

**Still open** (blocked on the unwritten mode doc): run state / run-loss stakes
(`App.tsx:673` already promises "Void Tower owns run-loss stakes"), the reward
loop beyond the trials' first-clear pack, floors 2-10 content, board modifiers,
the rule-breaking floor 10.

## The boss panel's ✕ was under the mute button, and three bugs deep

Reported as "the mute button is bigger than the x button in the boss menu".
It was not a size problem — the ✕ is 32x32 and the mute is 28x28. Measuring
the live DOM found three faults stacked on each other:

1. **`.modal.bd-modal` had no `position: relative`**, so `.bd-close`'s
   `position: absolute` escaped to `.bd-overlay` (fixed, inset 0) and pinned
   itself to the VIEWPORT's top-left at 10,10 — directly under the fixed music
   toggle at 6,6. The boxes overlapped by 24px and the mute wins the stack
   (`--z-nav` 350 vs the panel's 3), so the ✕ was *behind the speaker icon*.
   That is the whole of the report: the mute looked bigger because it was on
   top of the thing it was being compared to.
2. **`.bd-overlay { align-items: flex-start }` had never applied.** The base
   `.overlay` sets `place-items: center`, a SHORTHAND that writes
   `align-items`, and it is declared later at equal specificity — so it won.
   The panel was vertically centred, its top edge sat at -20 on a short
   screen, and the ✕ pinned to it rendered clipped at y=-9. Same trap the
   comment above `.modal.bd-modal` already documents for padding; the overlay
   half was missed. Qualified to `.overlay.bd-overlay` now.
3. **Moving the ✕ into the panel would have stranded the player.** The panel
   scrolls (815px of content in a 421px box) and — unlike the card panel,
   whose `.cd-x` has the same shape — this overlay has NO backdrop-click
   dismiss, so an absolutely-placed ✕ scrolls away and leaves no exit. It sits
   in a zero-height `position: sticky` rail (`.bd-closebar`) instead.

Moving the ✕ to the right then collided with `.bd-state` (the ENRAGED /
CLEARED badge), which owned that corner — pushed to `right: 50px`. It cannot
go to the LEFT edge instead: on a phone the panel is 96vw, so its left corner
is back under the music toggle.

VERIFIED IN A BROWSER at 800x450 and 375x812, at the top, middle and bottom of
the scroll range: ✕ on screen at every position, and zero overlap between ✕,
state badge, mute and the hero title. **Reading the CSS would not have found
any of this** — every one of the three needed the computed box.

## FLOOR 5's TWO STANDING RULES — the giants, and three elements

Floor 5 is not just "floor 4 but bigger". Two rules apply to every boss on it:

**1. THE GIANTS REACH THE WHOLE BOARD.** `CardDef.fullBoardBasic` widens a
BASIC attack's reach to `state.boardSize` — the same widening the home-defence
branch in `canTarget` already performs, so there is one idea of "the whole
board" in the targeting code rather than two.

Deliberately REACH ONLY, and the neighbour is why: `ignoresHomeRule`
(Catapult's) does more — it also skips the sight screen AND the enemy-home rule,
so a card carrying it lobs over everything. A giant is tall, not omniscient:
- an enemy body on the straight line **still blocks the shot**, which is what
  keeps the player's free wall of Fortress Gates meaningful on the one floor
  where every boss outranges it;
- the enemy **home row is still protected**. If Floor 5 is ever meant to shoot
  the back line from the back line, that is `ignoresHomeRule` and a separate
  call. Both are pinned by test so neither can drift into being an accident.

**2. THREE ELEMENTS ARE LEGAL FROM FLOOR 5.** `VoidBoss.thirdElement`, gated by
`THIRD_ELEMENT_FROM_FLOOR = 5` and enforced by `elementProblems` — a floor-1
boss with three elements is a BUILD FAILURE, not a review note. `bossElementSet`
is the single definition of "this boss's elements"; the summon pool, the
formation legality check and the UI chips all read it, so they cannot disagree
about what a boss is. On the CARD the third element is `elementAuras`, so the
boss genuinely runs those elements' auras rather than being described as them.

**BOTH RULES ARE EXPENSIVE, MEASURED.** Applying them to Skybreaker moved it
**85.4% -> 95.8%** against a tamed ally on the same harness (n=96) — the two
rules are worth more than a third of its body. Win type moved too: overrun
87->67, timeout 9->25, because a boss that shoots across the board without
advancing wins more fights on the clock. Budget for this when authoring the
rest of Floor 5: a giant needs LESS body than a Floor-4 boss, not more.

## FLOOR 5 — Continental, the one you cannot out-damage

`boss_continental` (50 DMG / 400 HP / **50 shields** / SP 1 = **551** body,
against Floor 5's 660 cap — the heaviest on the tower) + `bore_rolling_boulder_tok`
(0/50/10, SP 0). BORE tribe, LEAF mechanic, both auras via `elementAuras`.
Owner-specified lines.

THE DESIGN: shields block **per hit**, so the many-small-blows answer that beats
Kazehaya two floors down is the WORST answer here — the fight inverts one the
player has already solved. And it comes to you on a delay: `advanceWhenWallsDown`
parks it on its home row while any Fortress Gate stands, sliding along that row
to line up on whatever hits hardest, and it starts walking the round the last
wall falls. **The wall is not just cover, it is the clock**, and the boulders
are what spend it.

Five new pieces, all small:
- `roundTick.aimLateralBy: "count" | "topDmg"` — the default slides toward the
  biggest CROWD (Helion, Skeleeze); "topDmg" slides toward the biggest HITTER,
  which is the question a siege engine actually asks. The card-text describer
  branches on it too — printing the crowd sentence on Continental was the card
  face stating the wrong rule.
- `roundTick.advanceWhenWallsDown` — gates the forward gaits ONLY. The lateral
  aim still runs, so it spends the wait lining up on you rather than idling.
  `enemyWallsStanding` counts both spell walls and VOID_GATE token cards.
- `roundTick.advanceTrample` — rolls THROUGH via `chargeForward` rather than
  stopping like `advance` does.
- `roundTick.spawnEveryN` — a production line (every 2 rounds), `spawnMaxAlive`
  bounded, column from the seeded RNG.
- `CardDef.tramplesAnything` — **the important one**. `shoveTarget` only lets a
  trample shove a LIGHTER body, so a 50-HP boulder would stop dead at nearly
  every real card and "35 DMG to anything trampled" would have been an ability
  that never fired — this repo's own "written but never read" bug class. It
  lifts the weight comparison and nothing else; `pushImmune` still refuses.

`CardInstance.rollHeld` exists because Cleanup step 4 clears `summonedThisRound`
just BEFORE the round ticks run (the trap already documented beside
`roundTickFired`), so "was this born a moment ago" cannot be asked of that flag.
Without it a boulder lands in the row in front of the giant and is already past
it before the player sees it there.

`fullBoardBasic` had to learn MELEE. Continental is a melee giant, and a rule
that only widened ranged cards would have been a rule about half the floor. The
melee branch has no sight rule of its own (it never reaches past the next
square), so the screen is stated explicitly for giants — otherwise the giant
rule would silently delete the player's Gates.

MEASURED: **99.0% bare, 75.0% with a tamed ally** (n=96, same harness as
Skybreaker). Body is not what decides a Floor-5 fight — this carries 551 points
against Skybreaker's 366 and does not beat it. SP 1 makes it act last in every
queue, and the wall gate parks it behind five gates for most of the clock.

**A ROUND GATE ON TOP OF THE WALL GATE BUYS A GUARANTEE, NOT A NUMBER.**
Continental also holds home until round 15 (`advanceFromRound`, which COMPOSES
with `advanceWhenWallsDown` — the later hold wins). Measured: 75.0 -> 74.0%,
nothing. In a real fight the player starts behind five Fortress Gates and those
rarely all fall before round 15, so the wall gate was already doing this. What
the round gate buys is that a player who clears the wall fast can no longer pull
the giant out early.

**FLOOR 5 AS SHIPPED: Skybreaker 84.9%, Continental 85.8% (n=768, ±2.5) —
both mid-band.** Everything below this line predates the AI fix, which re-based
every number in it; treat the figures as history and the LESSONS as current.
The two that got the floor into band are in "Floor 5 came into band on two bug
fixes" further down. Previously (n=192):
Skybreaker hit 88.0 on a seven-round clock; the clock was restored to the house
three at the owner's call and the tuning moved to the Special's damage, which
does not work — see below.

**ALMOST NOTHING ON SKYBREAKER'S SPECIAL IS LOAD-BEARING** (all n=192): its
damage (25 -> 95.8, ZERO -> 97.4), its PARALYZE (2r/1r/0r -> 95.8/95.3/95.3),
the TELEPORT itself (swap off, hurricane intact -> 97.4), the SP tax, the splash
number and scope, the formation, and a cap on hurricanes raised — all noise.
What IS load-bearing is the **hurricane as a body**: swap it for a 1-cost wolf
and the fight reads 87.0%. Every lever that ever moved this boss traces to that.

**AND A MEASUREMENT LESSON.** An earlier reading called the teleport the whole
boss on the strength of a "NO-SWAP -> 87.0%" run. That run pointed the Special
AND the round-6 clock at a wolf, so it did not isolate the swap — it deleted the
hurricane. Isolating properly (`maxSwaps: 0`, hurricane intact) reads 97.4%.
**An ablation has to change exactly one thing**, and this file already says so
about control groups; it now says it about single-variable isolation too.

**PREVIOUSLY IN BAND AT: Skybreaker 88.0, Continental 89.6 (n=192).** Both reached
WITHOUT touching a boss's HP, which was the constraint — and just as well for
Continental, which HP could not have fixed: a sweep read 400 -> 74.0, 450 ->
76.0, 500 -> 77.1, 550 -> 80.2, and 550 is a 701 body, over the floor's 660 cap.

What actually moved each one:
- **Continental +13.5** — its Special now leaves a boulder in the square of
  anything it kills. Every kill becomes a permanent rolling body.
- **Skybreaker +18.7 then -7.8** — the hurricane going back to a RANGED Mage,
  then the boss's clock moving 3 -> 7. The range change is about SURVIVAL, not
  damage: a ranged token lives where a melee one walks forward and dies, and
  this boss's mobility dies with it.
- **Everything else read as noise**: the SP tax, the splash number and scope,
  where the round-6 hurricane forms, whether the formation starts with one
  (the Special just calls one when there is none), and the Special's own
  cadence at 3/4 (95.8/95.8) before it broke at 5.

**THE 3-ROUND BOSS CLOCK IS A FLAT THREE, WITH NO EXCEPTIONS.** Skybreaker
briefly held a named exception at seven; it was restored to the house three at
the owner's call and `void-tower.test.ts` asserts every boss is on 3. (This
paragraph said the opposite for a while — the code and the test were right and
the prose was stale. Read `fireSpecialEveryN` before quoting this file on it.)

**PREVIOUSLY, FLAT AT ~74-77.** It got there from the OTHER end: making the
Thundering Hurricane melee at 75 HP moved Skybreaker 95.8 -> 75.0 in one edit
(see below). A little under Floor 4's 80-90 band, and internally consistent,
which the earlier 75.0-95.8 spread was not.

## Floor 5 came into band on two bug fixes, not on a nerf

Asked to put both Floor-5 bosses in the 80-90 band. They read **92.7** and
**95.3** (n=192). They now read **84.9** and **85.8** (n=768, ±2.5), and almost
all of that came from making two named mechanics actually run.

**Harness, so the numbers are reproducible:** 8 CORES x N seeds, 5x5,
`humans: []`, spells from `buildVoidEncounter`, `s.voidTower = true`, gates on
`voidGateSeats`, boss seated at `voidBossSeat` outside the economy, ally =
Umbranova at `TAME_SCALE` in the player's centre home slot — i.e. App.tsx's real
Void Trial setup (App.tsx:1200-1258). The number is the BOSS's win rate. Four
independent processes returned byte-identical controls, so comparisons are paired.

**SKYBREAKER: Gathering Storm never once fired.** `fireSpecialEveryN` is 3 and
the storm gathers on 6, so Eye of the Storm's call-a-hurricane face ran on round
THREE and the round-6 tick never found an empty field. Instrumented: `spawnOnRound`
fired **0 times in 48 fights** while the handler ran **327**. A named passive that
never ran, a card text promising a round it did not keep, and a boss holding its
legs three rounds early. Gating the Special on the boss's own gathering round
took it **92.7 -> 83.9** and player kills from 14 to 31 of 192.

**CONTINENTAL: Rockfall's cap bound one of two taps.** The round tick honoured
`spawnMaxAlive`; the Special's on-kill rider checked nothing, so rocks poured in
over the top of the ceiling — which is why moving that cap 3 -> 1 had measured
-1.0. The rider has its own `maxAlive` now.

**THREE THINGS THAT LOOK LIKE BUGS AND MUST NOT BE "FIXED".**

1. **Continental's holds are dead and should stay dead.** `advance`,
   `advanceFromRound: 15`, `advanceWhenWallsDown` and `aimLateral` are all
   inert — the generic mover marches the giant down the board regardless (the
   Helion bug). Deleting `advance` outright changes the fight by **0.0**. But
   adding `holdsPosition` to fix it measures **Continental 96.9 and Skybreaker
   99.5**: a giant with `fullBoardBasic` that never leaves its back row cannot
   be reached while it shoots the whole board. Walking down is what gets these
   two killed. **The bug is load-bearing.**
2. **The hurricane's HP reads backwards.** LOWERING it makes Skybreaker
   STRONGER (85 -> 45 reads 97.4, 85 -> 30 reads 97.9, control 92.7), because
   killing the token fires the call face and the fresh one re-runs its
   on-summon barrage. A fragile token is MORE barrages.
3. **The barrage's `reach: 2` and `statusDuration: 2` are not read at all.**
   `reach` is not a barrage param, and `statusKind`/`statusDuration` are only
   read under `farRowStatus`, which the hurricane does not set — so its printed
   radius is a board-wide volley and its PARALYZE never lands. Both measured
   byte-identical to control. This is the SAME defect this file already records
   for Specials ("every 'within 2 spaces' on the tower was a board-wide nova
   wearing a radius in its text"); the fix landed on the Special path and never
   reached `onSummon`. **Still open** — left alone because wiring it changes
   every card using onSummon barrage, and the floor is in band without it.

**WHAT DOES NOT TUNE CONTINENTAL, measured at n=192 against a paired control:**
its shields (50 -> 25: **0.0**), its second element (**0.0**), its own advance
(**0.0**), `advanceFromRound` 15 -> 22 (**0.0**), `aimLateral` (**+0.5**), its
Special's damage (35 -> 20: **+1.1**, i.e. slightly stronger), `tramplesAnything`
(**+0.5**), and its printed DMG (50 -> 38: **-1.0**). **The boulders win by BODY,
not damage** — crush set to ZERO still read 90.6 — because they win by filling
the player's home row for the overrun. So the COUNT is the tuning and the crush
is cheap (35 -> 12).

**THE SHAPE IS STILL BAD, and the aggregate hides it.** Per core, as shipped:

    Skybreaker  gale 100 · bore 97.9 · pyro 95.8 · leaf 81.3 · bolt 80.2 ·
                dusk 79.2 · aqua 72.9 · dawn 71.9
    Continental leaf 100 · bolt 100 · bore 100 · aqua 97.9 · dusk 81.3 ·
                dawn 75 · gale 51

Four of the eight cores essentially cannot beat Continental. That is the same
warning this file already gives about Nightshrike's 42%, and NO lever found in
this pass fixes it: every one that lowered the aggregate did so by improving the
decks that already had a chance. If the floor is to be fixed properly it is a
matchup problem, not a number problem. Remember too that this harness OVERSTATES
a boss — it plays the player's side with the AI, which cannot read a telegraph.

**A SWEEP BUG WORTH NOT REPEATING.** One variant labelled "special dmg 20" was
written as `special: undefined`, which DELETES the Special rather than re-costing
it; it measured 77.1 and would have been read as "the Special's damage is worth
18 points" if the label had been trusted. Labels are not evidence — the patch is.

## FLOOR 5 — Skybreaker, the boss whose Special is its movement

`boss_skybreaker` (3x16 DMG / 298 HP / 20 SP = **366** body against Floor 5's
660 cap) + `gale_thundering_hurricane_tok` (20/100/15). Owner-specified line.
GALE tribe, BOLT mechanic; the third element (AQUA) rides on the basics as
SCALD rather than via `elementAuras`, which would have handed it two unmeasured
element auras for what is a flavour note.

**Floor 5 exists because that boss entry does** — `voidFloors()` is derived from
`VOID_BOSSES`, so there was no constant to bump.

THE DESIGN: it has **no gait at all** — no `advance`, `aimLateral`, anything. It
sits on its home row and shoots. `stormCall` is one Special with two faces: no
hurricane up, call one; hurricane up, **trade places with it**, re-break its
Wind Wake, and blast reach-1 around where it LANDS for 25 + PARALYZE 2. So the
token is the boss's legs, and killing it strands the boss at the back while
leaving it hands the boss a blink into your line. Both answers cost something.

Mostly built from machinery that already existed — `onHitPush` is literally
already named "Wind Wake" (Zephyra), `pushEnemies` is Wind Guardian's,
`pullToCaster` is Kazehaya's rope, SCALD/PARALYZE are stock statuses. FOUR new
pieces:
- `roundTick.slowEnemies` — an ENEMY-facing SP tax. `AuraBonusDef` only buffs
  the holder's own side, so this is a per-round `applyTimedBuff`, clamped to the
  target's current SP (a negative pool banks rounds no cleanse can reach).
- `roundTick.cycloneSpin` — rotation, not a shove. The step is DERIVED from the
  clockwise tangent `(dc, -dr)`; where a component is zero, fill it by stepping
  inward on the offset axis, which is what preserves the ring:
  `N->E->S->W->N` at constant distance. Deterministic in every branch —
  `chanceProblems` fails the build on a boss that rolls dice, and a random
  tie-break would be one. **Pinned by test, because a derivation is what gets
  subtly wrong.**
- `roundTick.spawnOnRound` — a body on a clock (round 6), `spawnMaxAlive`-bounded.
- `SPECIAL_HANDLERS.stormCall` + `TARGETLESS_HANDLERS`.

THE TELEGRAPH lights the squares around the **hurricane**, not the boss —
because that is where the boss will be standing. Lighting its current slot would
point at the one square the blast is guaranteed to leave.

FOUR REGISTRIES caught it on the way in, each a real integration point:
`MEASURED` (bodies), the still-boss list in the gait test, `TELEGRAPHED_HANDLERS`,
and `CODE_IDS` in deck-code.ts (APPEND-ONLY). Adding a boss means all four.

**THE HURRICANE'S ATTACK IS NEARLY IRRELEVANT — measured.** Giving it splash
(`basicSplash: 10` + `splashAll`) and +10 HP moved the fight 75.0 -> 74.0%,
i.e. nothing, inside noise at n=96. A null result worth keeping: the cause is
the token's OWN Wind Wake, which shoves the board away every Cleanup, so its
basic seldom lands and nothing scaling the basic can matter much. Its value is
POSITIONAL (a slot for Skybreaker to teleport into) and ON ARRIVAL (the pull,
15 damage, a 2-round hold). **If the hurricane is ever meant to be an offensive
threat, the lever is Wind Wake — not the attack numbers.**

**AND THEN IT WAS.** Wind Wake on a two-beat (`pushEnemiesEveryN: 2`) read
74.0 -> 77.1%. +3.1 is MORE than splash was worth and is still, by this file's
own standard, inside noise at n=96 — "a 3-point gap is noise". Do not bank it
without more seeds. It is kept because the card now plays the way it reads: a
melee body whose passive shoved every round could never use its own attack, and
three edits to that attack moved the fight by a point between them.

**THE TOKEN IS THE BOSS'S LEGS, and that makes it the biggest lever on the
fight.** Skybreaker has no gait and reaches the board only by trading places
with the hurricane. Making that token MELEE at 75 HP (from Ranged at 100) moved
the fight **95.8% -> 75.0%** in a single edit — larger than both Floor-5 rules
put together were worth in the other direction. Cut the legs and the boss stops
arriving. Note also that a melee hurricane's own Wind Wake shoves away the
bodies its basic needs to reach; that is knowingly kept, because the token is a
ground-holder and a teleport anchor rather than a damage dealer.

MEASURED, n=96 (8 cores x 12 seeds, 5x5, `humans: []`, encounter spells, gates
seated, `voidTower` on): **100% bare, 85.4% with a tamed ally** (Umbranova at
TAME_SCALE), 87 overrun / 9 timeout — it wins by taking the board. In the SAME
run against the SAME ally the Floor-4 bosses read Kato 26.0 / Cryovex 4.2 /
Kazehaya 0.0, so Floor 5 is decisively a step up. Those Floor-4 figures are NOT
comparable to the taming table above (that used a Floor-3 ally); only the
relative reading inside the one run is meaningful. And an AI sweep cannot read a
telegraph, so all of these overstate a boss against a human who can.
