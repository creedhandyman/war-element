# War Element — Notes for Claude

If you're a fresh Claude session opening this repo, read this first. It's the
handoff doc, not user-facing copy — the README is the player-facing one.

**This project is independent of `creed-app`.** Different repo, different
remote, different owner-facing product. Nothing here touches creed-app's
deploy path, and creed-app's conventions (its `.bb`/`.cd` CSS classes, its
Supabase/db helpers, its CLAUDE.md) do **not** apply here. If you were sent
here from a creed-app session, drop those assumptions.

## What this is

A TCG × chess card game. Draw → resource → turn-based prep → speed-queue
battle → win by **elimination** or **slot capture**. One local human (P1,
bottom) vs. a rule-based AI (P2, top).

Vite 6 + React 19 + TypeScript. Repo at `C:\Users\IlIKingPin\war-element`,
remote `github.com/creedhandyman/war-element`. Supabase is a dependency but
the game itself is local-first; the engine has no network calls.

**Deploy**: `.github/workflows/deploy.yml` auto-deploys `main` to Vercel
production. **The workflow runs `npm test` as a gate** — a failing test blocks
the deploy. Card art is in Git LFS (~837MB) and the workflow caches it, so
don't casually re-add large binaries.

**Live at `https://war-element.com`** (also `war-element.vercel.app`; DNS at
Namecheap — apex `A @ -> 216.150.1.1`, plus `CNAME www ->
48a2dd5c95e65538.vercel-dns-016.com.` which Vercel 308s to the apex). The apex
is canonical: a redirect hop between Supabase's origin and the app's is one
more thing to go wrong in a sign-in link, so `www` redirects and nothing is
served from it. The four `*.mail` / `_dmarc` / `resend._domainkey` records on
that zone are Resend's — **do not touch them**, they are what makes sign-in
email deliverable.

## Layout

```
src/
  engine/          Pure TypeScript. No React imports anywhere in here.
    types.ts       CardDef / CardInstance / GameState / StatusKind. The contract.
    cards.ts       → actually lives in src/data/, see below
    state.ts       createInitialState, boardCards, healCard, effectiveDmg/Sp/MaxHp
    phases.ts      The phase machine: mulligan → prep → battle → CLEANUP. Big.
    combat.ts      resolveHit / basicAttack + the SPECIAL_HANDLERS registry. Biggest.
    rules.ts       Legality: canTarget, canMove, legalMoves, validTargets
    auras.ts       ELEMENT_AURA — the per-element passive every card of it carries
    matchups.ts    ELEMENT_MATCHUP — the cross-element rules (see below)
    spells.ts      Spellbook + spell defs + spellCapForBoard
    ai.ts          aiMulligan / aiPrepIntent / chooseBattleAction
    rng.ts         Seeded RNG — coin/chance/pctChance/randInt/shuffle
    stats.ts       Post-match credit tracking
    __tests__/     29 files, ~850 tests. `npm test` runs them headless.
  data/
    cards.ts       THE card database. ~9k lines, 312 cards + 16 tokens. Edit surgically.
  ui/              React. App/Board/Slot/Hand/CardDetail/DeckBuilder/…
public/cards/      <id>.webp per card (Git LFS)
```

`src/data/cards.ts` is the file you'll touch most. It is enormous — **never
rewrite it, only make targeted edits.** For bulk stat changes across several
cards, an id-anchored Python pass is safer than a dozen hand edits (find the
card's `id: "..."`, slice to the next `\n  {\n`, regex within that block only).

## Commands

```
npm run dev     # Vite on 5173 by default
npm test        # vitest run — the whole suite, ~6s
npm run build   # tsc --noEmit && vite build
```

Preview via the launch.json entry named `war-element`, which pins
**port 5199** (`--port 5199 --strictPort`). A bare `npm run dev` does NOT pass
that flag and lands on 5173 — the two disagree, so know which one you started.

## The rules that keep the card set coherent

**Stat budget.** `dmg*hits + hp + shields*2 + sp ≈ 5*cost + 10`, tolerance ±2.
Enforced by `state.test.ts`. A card outside the band needs an entry in that
file's `exceptions` Set **with a comment naming the ability that pays for the
deviation**. Don't add exceptions to silence the test — if you can't name the
payoff, the stats are wrong.

Note the `+10` constant: cheaper cards are inherently more efficient per gold
(a cost-3 gets 25 points for 3, a cost-5 gets 35 for 5). Rebasing a card down
a cost tier and retrimming to the new budget is therefore a real buff to
tempo/deployment even though the card gets numerically smaller. That's the
lever used on LEAF's mid-range.

**Rarity.** A *repeatable* Special requires epic-or-above. A Rare gets a
**Talent** instead — `special: { talent: true, … }`, which is free but fires
once per game (`card.talentUsed`).

**Art.** Every card and token needs `public/cards/<id-or-art-field>.webp`, and
`art.test.ts` fails the build if one is missing. Convert supplied PNGs with
PIL (`Image.open(p).convert("RGB").save(q, "WEBP", quality=88)`) then delete
the source PNG. Watch for filename/id mismatches (`bolt_static_cloud.png` vs
id `bolt_staticcloud`).

**Card text.** `card-text.test.ts` enforces that every ability field is
described somewhere in `CardDetail.tsx`'s describers — add a new `CardDef`
field and that test will tell you it's undescribed. It also guards against
empty passive labels (`"On a kill: ."`), which is how several describer gaps
were originally found.

## Tanks (and Warriors) — BULWARK, the class rule (`rules.ts` `tankScreens`)

**Warriors carry it too since 2026-09-30** (owner: "give warriors the block
too"; who carries it = `holdsTheLine`). Measured on the 8 element cores,
no element moved more than 1.6 points (spread 38.1 -> 36.4).

Owner, 2026-09-29: "buff the tanks" / "Tanks should be better at blocking and
preventing people from shooting over them". Before this the Tank class had NO
rule at all — only its HP-heavy stat split — and swapping every Tank out of the
builder's pair squads for the best same-cost card of another class WON +5.8
points on 4x4 (19/26 better), +3.5 on 5x5.

The rule, inside `rangedCanSee` so every sight check inherits it (ranged
basics, Long Reach lances, giants' swings beyond a step, The Deepest): an
enemy Tank stops a shot two or more steps long when the line of fire crosses
its square at ANY angle (`lineCrosses`, centre to centre, corners excluded —
an ordinary body still only screens straight lines), or when the target stands
NEXT TO the Tank AND the Tank stands in front of it (nearer the shooter —
owner, 2026-09-30: cover from beside/behind made targeting read as random).
That restriction cost most of the buff: re-measured at 761298df the
Tanks-out delta is +3.5 with no Bulwark and +2.8 with the front-only rule
(the numbers below are the original any-neighbour version). The Tank itself stays targetable. Ranged SPECIALS stay unscreened.
Not carried by bosses (Tower tuning untouched) nor by `guardsHomeRow` gates,
whose one-column screen is the point of breaking a gate.

Measured (28 pair squads vs the 35 premades, both seats, seeds k*53+1009):
Tanks-out delta 4x4 +5.8 → -0.9 (11/26), 5x5 +3.5 → -3.1 (10/28). Variants
tried: line-only +3.9, wider king-path corridor +3.7, guard + Specials -2.1
(overshoots). Canonical 8-core run, off → on: LEAF +5.7, DAWN +2.3, the rest
within noise (±2.6). Text: `TANK_BULWARK_TEXT` (card-text) + the rules book.

## Element systems

Two separate layers, don't confuse them:

- **`auras.ts` — ELEMENT_AURA**: the passive every card of that element
  carries (LEAF Photosynthesis, PYRO Scorch, BOLT Electrify…). The table is
  display copy; the effects live at hook sites, mostly the Cleanup loop in
  `phases.ts`.
- **`matchups.ts` — ELEMENT_MATCHUP**: how elements answer *each other*.
  Hooks at four sites — `resolveHit` (the DAWN↔DUSK ±25% swing, GALE's 20%
  dodge vs BORE, LEAF's water-fed heal), `applyStatus` (AQUA/BORE/GALE status
  resistances), `healCard` (a BURNing card heals at 75%).

Two design invariants there, both deliberate and both commented in the file:
**resistances, never immunities** (an immunity deletes an entire aura in one
matchup rather than answering it), and the damage bonus is **floored, not
rounded** (`Math.round(2 * 1.25) === 3` is a 50% swing that a 3-hit volley
then compounds).

`ELEMENT_MATCHUP` is deliberately `Partial<Record<Element, …>>` — BOLT has no
entry, because its aura already answers status-carriers and it measured top of
the ladder.

**Not yet done:** the matchup table isn't surfaced in the card inspector the
way `ELEMENT_AURA` is. Players feel these rules without being told them.

## Working style

- **Commits land directly on `main`.** No PRs. Push triggers the deploy.
- **Verify before committing**: `npx tsc --noEmit`, then `npm test`, then
  `npx vite build`. All three, in that order.
- **Don't blind-update a failing test to match new output.** When a balance
  change breaks assertions, check the actual card elements/stats involved and
  confirm the new number is *right*. Doing this is how the DAWN↔DUSK rounding
  bug and the heal-before-cleanse ordering bug were both caught — the tests
  were correct and the implementation wasn't.
- **Don't run destructive git** (force-push, `reset --hard`) without an
  explicit ask.
- Commit messages: explain *why* the numbers moved and quote the measurement
  when there is one.

## Open threads

- Element balance: see "Where balance stands". Deliberately NOT restated here —
  this entry carried `spread 16.1 … the tightest measured` long after the same
  file recorded 7.7 and then 10.2, because a number copied to two places only
  gets updated in one. The open question is the bottom of the table (leaf, dusk)
  and specifically LEAF-vs-GALE at 25.5%, which is a mobility problem rather
  than a weak element — the section below has the evidence and the dead end
  already tried.
- `ELEMENT_MATCHUP` has no UI surface.
- `deckById`'s silent fallback (see Measuring balance).
- Spell curve expansion — the big queued feature. Today's `spells.ts` has the
  cost-1 spell per element + the 8 cost-4 Walls + some Fields; the spec covers
  a full 1–10 curve per element (80 spells) plus **Trap** (hidden, fires when
  an opponent moves onto the slot) and **Field** sub-types. Spec lives in
  `Spells_All_Elements.md` + `PYRO_Spells_Prototype.md` (Downloads).
- Card ability source-of-truth is
  `Desktop\Everything\war element\*_Cards.docx` + `War_Element_Rules.docx` —
  the full printed abilities, which the alpha `cards.ts` simplified. Extract
  with `unzip -p X.docx word/document.xml`.

## Reference docs (read on demand, not loaded by default)

The detail that used to live in this file. The rules in them still bind:
read the matching doc BEFORE working in that area, and add new notes for
an area to its doc, not to this file. Keep this file to what every session
needs.

- **`docs/claude/traps.md`** — READ BEFORE ANY UI / CSS / layout / save-format / test-writing work. Bugs already paid for once: vacuous source-slicing tests, silent CSS failures, stacking contexts, flex sizing, building a save by spreading the old one, squad vs deck limits, auto modes.
  Sections: Traps found the hard way.
- **`docs/claude/balance.md`** — before changing card stats, element balance, or running/reading a balance measurement. Holds the method, the current standings ("Where balance stands") and the dead ends already tried.
  Sections: Measuring balance.
- **`docs/claude/ai.md`** — before touching `engine/ai.ts` or anything about how the AI picks Specials, targets or rows.
  Sections: The AI could not fire 38 of its own Specials · The AI weighed a Special on its damage number alone · The AI did not farm its home row.
- **`docs/claude/cards.md`** — before editing card text/describers, spells or spellbooks, a card that moves itself (`driftEachRound`), or anything that used to involve heroes.
  Sections: A card that moves itself — `driftEachRound` (Wind-Driven) · The card text was lying in four places — and how they got there · Spells — copies are legal now, and everything treated a book as a SET · Spells — the "written but never read" bug class · Heroes are gone; suits stay.
- **`docs/claude/modes.md`** — before working on Domination, the Arena ladder/screens, Streak or Gauntlet.
  Sections: Domination — the third and fourth seats are the player's to choose · Arena ladder — four three-element decks, one per rung · The Arena is two levels — `ui/arena-nav.ts`, `ui/ArenaScreens.tsx` · Domination in Streak and Gauntlet — `data/dom-ladder.ts`.
- **`docs/claude/story.md`** — before working on Story Mode, lore (BOLT's red eyes / ARC), campaign nodes, formations, opening deployment, the story save, or repo size / git gc / LFS cleanup (the "Repo size" section is filed here together with the campaign notes that followed it).
  Sections: BOLT's red eyes — the thread the art wrote by itself · Story Mode · Repo size.
- **`docs/claude/tower.md`** — before working on the Void Tower, any boss, boss taming, Floor 5, or tower difficulty. Holds the owner's difficulty targets and Floor 5's two standing rules.
  Sections: Void Tower (boss framework — data + engine only; NO mode yet) · BOSS TAMING — the tower's first loop that points BACKWARD · TOWER DIFFICULTY TARGETS (owner's, and the tower is NOT there yet) · The boss panel's ✕ was under the mute button, and three bugs deep · FLOOR 5's TWO STANDING RULES — the giants, and three elements · FLOOR 5 — Continental, the one you cannot out-damage · Floor 5 came into band on two bug fixes, not on a nerf · FLOOR 5 — Skybreaker, the boss whose Special is its movement.
- **`docs/claude/tutorial.md`** — before touching onboarding, the scripted first/second battles, struggle tips or the Training Ground.
  Sections: The tutorial had the wrong half — `Onboarding.tsx` · The first battle on rails — `ui/tutorial.ts`, `ui/TutorialRail.tsx` · The second scripted battle — `ui/tutorial-magic.ts` · After the first battle: no lectures, one-line tips when stuck — `ui/struggle.ts` · Training Ground — `ui/training.ts`, `ui/LessonCoach.tsx`, `ui/TrainingGround.tsx`.
- **`docs/claude/ui.md`** — before UI work on the match screen, phone layout, back button, Card Gallery, the squad builder (`DeckBuilder.tsx`, one builder / one pool), sound / win moment / turn cue, big-board rendering performance, or bundle size.
  Sections: Game feel — sound, the win moment, the turn cue (2026-10-13) · A big board lags on the GPU, not the engine — what repaints every frame · The bundle — what is in it, and what is NOT in the first chunk · Card Gallery — the screen that shows what the other grids hide · The UI after the mobile redesign · The phone's back button — `ui/back-stack.ts` · One builder, one pool — what you build with is what you battle with.
- **`docs/claude/art.md`** — before adding or converting card art or thumbnails.
  Sections: Card art — the convention is HEIGHT 1000, not a fixed 750x1000 · Art is drawn from a SMALL COPY — `tools/make-thumbs.py`.
- **`docs/claude/economy.md`** — before changing essence, foil rerolls, packs, earnings against the AI, achievements or the daily login reward.
  Sections: Foil rerolls — what spare essence buys (owner's call, 2026-10-01) · Pack element lean (owner's call, 2026-10-01) · Earning against the AI · Achievements and the daily login reward — `data/achievements.ts`, `data/daily.ts`.
- **`docs/claude/online.md`** — before touching accounts, cloud saves, sign-in, play-event telemetry, rejoining an online match, replays or match history.
  Sections: Accounts and cloud saves · Anonymous play events — `net/telemetry.ts`, `public.play_events` · Rejoining an online match — `net/resume.ts` + the `sync` handshake · Replays and match history — `engine/replay.ts`, `ui/replay-recorder.ts`, `data/match-history.ts`.
