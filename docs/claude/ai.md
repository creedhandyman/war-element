# The AI

Moved out of CLAUDE.md to keep it short. Same text, same rules — read it before working in this area.

## The AI could not fire 38 of its own Specials

`chooseBattleAction` picks a Special through a chain of `sp.handler === "..."`
cases. A chain of named cases is a list that goes stale the moment a handler is
added, and it had — twice. The file's own comment records seven Specials once
falling through every branch and never being cast. An audit found the number had
grown to **41 handlers with no branch at all, against the 22 the chain knew**.

Of those 41:
- **~38 were a real gap** — ordinary cards whose Special the AI would never
  cast. They basic-attacked all game, and their Specials were invisible to every
  balance run ever recorded in this file.
- **3 were not**: `smite`, `polarShift` and `igniter` are CONDITIONAL (an
  ELECTRIFIED target, an HP line, something already burning) and the AI declines
  correctly when the condition is absent. A first cut of the coverage test
  flagged all three, and the test was wrong, not the AI.
- **Bosses were never in scope.** `canFireSpecial` refuses them outright —
  "Fires on its own clock" — because a boss that also cast whenever it could
  afford the magic would be a different fight on every retry. Both Floor-5
  bosses' Specials looked like AI gaps and were not.

THE FIX IS A SHAPE-DRIVEN FALLBACK, not 41 more cases: the last branch reads
who the Special targets and what its params say it does (damages / heals /
shields / self-or-targetless / control) and decides on that. A new handler is
fired by default now and only needs a named case when the generic read is wrong
for it. `ai-special-coverage.test.ts` asserts the OUTCOME — given a board built
to invite it, the AI takes the Special — so the gap cannot silently return.

**AND IT MOVED THE BALANCE LANDSCAPE.** Every number in this file was measured
against an AI that could not fire those Specials. Re-measuring Floor 5
immediately after: Skybreaker **96.9 -> 91.7** and Continental **74.0 -> 94.8**
(n=96). Skybreaker fell because the player side got better; Continental ROSE
twenty points because its own formation is AI-piloted too and gained more from
the fix than the player's cores did. Both now sit above the 80-90 band they were
tuned into. **Treat pre-fix readings as measurements of a different game.**

## The AI weighed a Special on its damage number alone

Found by the pre-beta card audit (every card forced into its own core's opening
hand, 280 AI-vs-AI matches each, outliers re-played on fresh seeds). Three rules
could see a Special or a spell only through its damage:

1. **A strike that matches the basic never fired.** The strike branch took a
   kill the basic could not make, a wide barrage, or strictly more RAW damage
   than the basic. 17 of the 43 strike Specials hit no harder than their own
   card's basic, and they are the ones carrying a SLEEP, a BLIND or a burst the
   rule never read: they fired on 2.4% of the boards they reached, against 21.8%
   for strikes priced above the basic. Valcana, whose Special also hits every
   other opponent for 2, fired 0 times in 171 games.
2. **A card with nothing in basic reach skipped its turn** even when its Special
   (a charge, a longer reach) could land: 45 of 1,071 castable turns across six
   cards. Dandelion has 0 SP, so its charge IS its movement: 18 of 51.
3. **Seven spells were never cast.** `findSpellCast` scored area spells on
   damage (Frost Patch, Downdraft, Sand Trap and Gale Force deal none), read
   Sprout's row heal as a sweep with nobody to hit, and looked for gold or a swap
   in Recon Ping and System Override. A player can cast all seven.

THE FIX IS A PRICE FOR THE RIDER, not more named cases. `statusValue` (ai.ts)
converts a status into HP from what it does to its victim — STUN a whole turn of
the victim's damage; SLEEP, FREEZE, PARALYZE and BLIND half of it; WEAKEN its
25%; a damage-over-time status its own damage; capped at two rounds — and
`strikeRiderValue` adds splash, splash-all, PEN through shields and lifesteal.
The strike branch fires when damage plus rider beats the basic, ADDED to the old
rule rather than replacing it, so nothing that fired before stops and a basic
kill still comes first. The same weights score a status sweep (which must clear
1.5x its cost in value); Sprout is scored on the HP it would mend and the
discounts on the magic they save this round. `rich` reads a Special's EFFECTIVE
cost, so a discount changes what the AI thinks it can afford. The skip fallback
fires only for skill profiles that read magic: `learning` and `steady` still
hoard, which is their handicap.

`ai-riders.test.ts` pairs every case that should fire with the nearest case that
should not. Run against the pre-fix ai.ts, all six "should fire" cases fail and
all seven "should not" cases pass.

## The AI did not farm its home row

Reported from play: "doesn't know how to farm gold properly, it's mostly all
attack". Gold is the round's base (1 a round for rounds 1-5, rising to 5) plus
**+1 for every card standing on your own home row**, carried over capped at 10.
Measured on the shipped AI — 512 sharp duels on the premade shelf, every suit
pairing, seats and decks both ways — it held **0.33 home slots on average
through rounds 1-5** and earned 3.3 gold a round. Two causes:

1. **The opening read as a standoff.** The stall-breaker fires when none of a
   seat's cards can reach anything, and moves regardless of the reserve. On the
   first rounds nothing can reach anything because the board is empty, so every
   seat — Defense and Control included — sprinted its first card across the
   board to take a slot. `OPENING_ROUNDS` (5, the first income bracket) gates it.
2. **The reserve was one slot, and only the ordinary advance honoured it.** The
   pathed press (Spades) and the flanking step (every sharp seat) walked home
   cards off regardless. Now `homeReserve` is every home slot but one for a seat
   that `farms` (steady, sharp) and one for `learning`, and a single `holdsHome`
   answers for all three movers. A capture, the jam release (`homeJammed`) and
   the post-opening stall-breaker still take a held card.

|                         | old AI | new AI |
|-------------------------|--------|--------|
| home slots held, rd 1-5 | 0.33   | 1.40   |
| gold per round          | 3.3    | 4.8    |
| head to head            | 23.2%  | 76.8% (4x4 75.8, 5x5 77.7) |

Parts, each vs its own control: the opening fix alone 65.9%, farming alone
64.9%, the bigger reserve with the sprint left in 59.8% — so the old note that
"higher values measured worse: the AI camped" does not reproduce. No camping:
timeouts 0 of 512; a sharp mirror runs 13.6 -> 18.0 rounds. Every suit gained,
Attack most (14% -> 84% head to head — it was the purest all-attack seat).

**THE SUIT MATRIX TIGHTENED.** The shipped AI's suits spread 27.1 points
(Defense 65.6, Attack 38.5) — nothing like the 4.2 suits.ts records, which
predates several changes. The new AI: 11.5 (Defense 55.2, Control 51.0, Attack
50.0, Hoard 43.8).

**THE DIAL WIDENED.** Learning vs sharp went 22.9% -> 7.0%. Learning itself is
exactly as strong as before (new vs old learning 51.2%, it only lost the
opening sprint); steady gained 16 points and sharp 27. Learning and steady
mirrors time out ~12% of the time on the old AI and the new alike — not this.

**THE TOWER BARELY MOVED** (brood switched, player AI held fixed, 16 seeds a
boss): bare 83.4 -> 85.0%, with a tamed Vulcanyx 53.9 -> 56.9%. Largest single
floors: Floor 2 bare +11 and Floor 3 with an ally +10 (n=64 / 48, borderline).

**Treat balance readings taken before this change as measurements of a
different game** — cards-plus-AI numbers all moved, as with the income fix.
