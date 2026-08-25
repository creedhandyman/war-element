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

## Accounts and cloud saves

Every save lives in localStorage (`we_story_v1`, `we_squads_v1`,
`we_custom_decks_v1`, `we_auto_defaults`), which is per-browser and per-device:
installing the PWA on a second phone starts a stranger's game, and clearing site
data ends the first one. `src/net/account.ts` is the way back — email sign-in
plus a save you can move.

**It needs one table.** Run this once in the Supabase SQL editor, or sign-in
works and every save operation fails with "the player_saves table is missing":

```sql
create table if not exists player_saves (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table player_saves enable row level security;
create policy "own save read"   on player_saves for select using (auth.uid() = user_id);
create policy "own save write"  on player_saves for insert with check (auth.uid() = user_id);
create policy "own save update" on player_saves for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**RLS is not optional.** Without those policies the anon key — which ships in
the client bundle, by design — can read every row in the table. Every player's
save would be public, and one of them is the owner's.

No new env vars: it reuses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, so
configuring online play configures this too. It builds its own client rather
than sharing `online.ts`'s, which documents itself as "no DB, no auth" — sharing
one would mean signing in silently changes the key a PvP channel authenticates
with.

Four decisions worth not re-litigating:

- **Link AND code, because which one arrives is not the app's choice.**
  Supabase gates email-template editing behind CUSTOM SMTP, and the built-in
  mailer's default template carries `{{ .ConfirmationURL }}` and no
  `{{ .Token }}` — so on the built-in sender there is no six-digit code in
  existence, whatever the form asks for. `detectSessionInUrl` redeems a link,
  `verifyCode` redeems a code, both are live. **The code is the better flow and
  the one to move to**: a link tapped on a phone opens the default browser,
  which for a home-screen PWA is not the app, so the player ends up signed in
  inside Safari looking at a copy of the game with none of their progress.
  Custom SMTP unlocks it — and also removes the built-in mailer's 2-4
  emails/hour cap, which no real player base survives.
- **Site URL and Redirect URLs must point at the deploy.** They ship as
  `http://localhost:3000` and empty, which is why the first link anyone clicked
  went nowhere. Site URL is now `https://war-element.com`, with BOTH
  `https://war-element.com/**` and `https://war-element.vercel.app/**`
  allow-listed so the old address keeps working. `requestCode` also sends
  `emailRedirectTo: window.location.origin`; an origin that is not allow-listed
  is ignored and Site URL is used instead, so a dev server falls back safely.
- **The half-finished sign-in is PERSISTED, and that is a fix rather than a
  nicety.** Reading the emailed code means leaving the app; the panel is mounted
  as `{accountOpen && <AccountPanel/>}` so closing it destroys `email`/`sent`/
  `code`, and on iOS a backgrounded tab is evicted and the page reloads.
  Players came back to a blank email form with no code box, asked for another
  code, tripped Supabase's ONE-PER-MINUTE send limit, and read the red line at
  the bottom of the modal — below the fold on a phone — as nothing happening.
  Reported as "I get the code, enter it, click sign in and it won't"; the auth
  logs showed every `/verify` that ever reached the server succeeding, with all
  the ERRORs on `/otp`. `pendingSignIn()` / `setPendingSignIn()` /
  `resendWaitMs()` in `account.ts` hold `{email, requestedAt}` in
  `we_signin_pending`, expiring after an hour along with the code they point
  at. A cooldown is surfaced as "your code is already in your inbox", not as an
  error, and Resend counts down instead of silently refusing — mashing it
  invalidates the code the player already has. **When debugging sign-in, read
  Supabase's auth logs first**: `/otp` is requesting a code and `/verify` is
  redeeming one, and which of the two is erroring splits the diagnosis in half.
- **One account per ADDRESS, and nothing reconciles two.** A player who gives
  up on one email and tries another gets a second account with its own separate
  save, silently. That is what "Use a different email" on the code screen is
  defending against; there is no merge, and joining two after the fact means
  restoring one onto a device and re-uploading it under the other.
- **No passwords, ever.** The app never sees, stores or transmits one. There is
  nothing to leak.
- **NEWEST-WINS IS THE WRONG RULE** and it is the one that looks safest. A fresh
  install has a *newer* empty save than a two-month campaign in the cloud, so
  "keep the most recent" deletes everything. What is automatic is one-directional
  — an empty side never overwrites a full one — and when both sides hold real
  progress the panel shows both (cards, nodes, shards, squads, when, which
  device) and makes the player choose.
- **Restore replaces, it does not merge.** Keys absent from the incoming bundle
  are REMOVED, so restoring a save with no squads does not leave the previous
  player's squads behind. After a restore the phone looks like the save rather
  than like a mixture of two. `AccountPanel` then reloads the page, because four
  different modules read those keys at boot and re-seeding them by hand is four
  chances to miss one.

`we_music_muted` is deliberately NOT synced: it is a property of the device, and
carrying it would mean muting the game on a phone because it was muted on a
laptop. Progress travels; preferences stay.

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
   other caller ever passes an unrecognized id.
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

Harness above, verbatim. 5,600 matches, n=1,400 per element, ±2.6 at 95%:

```
bolt 57.8 · dawn 56.0 · gale 52.6 · leaf 49.7
bore 48.4 · pyro 45.5 · aqua 45.1 · dusk 44.8     spread 13.0
```

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
  **3:2** (1536×1024); `MAP_RATIO` in StoryMap holds the canvas to it, and the
  edge SVG uses `viewBox="0 0 100 100"` + `preserveAspectRatio="none"` so edges
  and nodes share one coordinate space with no px maths.
  To eyeball placement, render markers onto the art with PIL rather than
  screenshotting — the node ids and edges plot straight from `story.ts`.
  Two CSS rules are load-bearing and were both learned the hard way on a phone:
  `.story-canvas` must be `flex: none` (`.story-body` becomes a COLUMN on
  phones, and a growable canvas stretches to fill the height, overriding
  `aspect-ratio` and scaling the art ~3x tall since it is drawn with
  `background-size: 100% 100%`); and every `.edge` needs
  `vector-effect: non-scaling-stroke`, or the `viewBox="0 0 100 100"` +
  `preserveAspectRatio="none"` combination scales `stroke-width: 2` into a
  ~20px slab. Node/badge sizes are `cqw`-based off `container-type: inline-size`
  on the canvas, so they track the map rather than the viewport — 54px at
  desktop's 1180px cap, ~41px on a phone.
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
  doc's Act II branch, neither privileged). Each carries its own `artRatio`:
  AQUA's painting is 4:3 where LEAF's and PYRO's are 3:2, and forcing one shape
  would crop somebody's map. A region gate is
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
- **24-round clock** (`VOID_TOWER_ROUNDS`), and running it out is the BOSS's
  win. Without it the boss had no realistic path — player kills ONE card, boss
  must eliminate thirty-one — so "winning" meant outlasting the global 50-round
  limit at 43-48 rounds. That made survival-to-50 the only dial and it barely
  turned: scaling Permafrost's whole body by FIVE moved it 10% → 20%. The clock
  is shown counting down in the round chip and stated on the tower screen.
- **The boss holds its home row for 2 rounds** (`BOSS_HOLD_ROUNDS`). It holds,
  it does not freeze — attacks, Specials and the clock all fire, and it may
  still slide ALONG its own row. One `bossHeldHome` for both ways off the row.

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
boss by elimination or the 24-round clock — which left the boss no way to win the
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
  * **A LONGER CLOCK MAKES BOSSES WEAKER, NOT STRONGER.** Running the clock out
    is a BOSS win (`VOID_TOWER_ROUNDS`), so extending it 24 -> 30 just hands the
    player more time to slay: Rotroot 40.6 -> 13.5, Xilty 46.9 -> 10.4, Hoarfell
    30.2 -> 9.4. It reads like "more time to break the wall" and is the opposite.
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

79.2%, with 79% of fights reaching Prowlform and 26% reaching Stormwing. BODY IS
A WEAK LEVER on a chain: 40/40/34, 36/36/30 and 32/32/26 measured 83.3 / 79.2 /
82.3, all inside noise, because three lives means trimming each shell removes only
a fraction of the total. Move the CHAIN if it needs moving, not the numbers.

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

## Earning against the AI

Three pieces, all in `src/data/`:

- **The ladder** (`custom-decks.ts`). Twelve premades in three rungs of four —
  `PremadeDeck.tier` is `easy | mid | hard`. Difficulty is the DECK, because
  `chooseBattleAction` is one rule set with no skill dial. easy is a melee pile
  with a top-heavy curve and no front line or healer; mid has a curve, a wall
  and a healer; hard floods cheap bodies, heals them, and shoots over the top.
  Against the six originals they win 33/50/62% on 4x4 and 21/34/59% on 5x5.
  The six stay UNTIERED — hand-tuned archetypes, not rungs.

  **The two battlefields are DECOUPLED.** A 5x5 build used to be
  `standard.cards ++ LARGE_EXTRAS[id]`, so the formats could never be tuned
  apart. They want different things: synergy weighting — picking cards that set
  up and pay off each other's statuses — measured **+5.5 on 4x4 and -5.9 on
  5x5** over 528 games a cell, both real. A tight ten-round board rewards a
  combo; a wide fourteen-round one rewards having an answer to more things. The
  4x4 hard decks are synergy-built now and the 5x5 ones are not. The cost is
  that a card changed in a 4x4 list no longer carries into its 5x5 twin —
  `premade-decks.test.ts` covers what the derivation used to give for free.

  **Card choice is otherwise spent as a difficulty lever.** Curve, comp, reach,
  cost cap, rarity, melee bias and mono-element have all been swept and hard
  lands 55-62% whatever they say. Two findings worth not repeating: MONO-ELEMENT
  is clearly WORSE (51-54%) because taking 30 of an element's ~39 buildable
  cards forces its weak ones in and gives up the other element's answers; and
  the cohesion metric is ANTI-CORRELATED with quality — the six hand-tuned
  originals score lowest on it (Inferno Blitz and Frostkeep both 0.00) while the
  weakest generated rung scores highest. A rung harder than this needs a knob
  that is not the deck; §10.6's opening allowance is strong (player 2 slots ->
  1 took hard to 82%/90%) but changes how a match starts.

  Two earlier cuts of this got it wrong and both are worth remembering.
  **Tiering on `rarity` inverted the ladder**: types.ts documents rarity as
  cosmetic, no epic in the set costs under 3, so "hard = epic and up" meant the
  top rung had nothing to cast on round one and lost to a rush in four. Then
  **tiering on a theory of good play** (front line, reach, sustain, lots of
  triggers) produced a ladder that measured FLAT at 4x4 and INVERTED at 5x5,
  where the "easy" swarm beat the "mid" comp 65% of the time.

  So it was tuned against a measurement instead: build a rung, play all four
  decks against the six originals, both seats, three seeds, read the win rate.
  What that found, and what future tuning should start from —
  **cheap-and-wide is the strongest thing a deck can do here.** The budget is
  `dmg*hits + hp + shields*2 + sp ≈ 5*cost + 10` and the +10 is FLAT, so a
  1-cost returns 15 stat points per gold and a 9-cost returns 6.1; capture ends
  ~95% of games and rewards having more bodies out. **Reach is second**, and
  the only lever that separates the 4x4 board, where sixteen slots cap what a
  flood is worth. **A front line and a healer help.** **Trigger density does
  NOT** — weighting it made decks measurably worse, because a trigger is paid
  for out of that same budget and the AI banks little of it.

  One structural gotcha: the 18-card build is a slice of the 30, and slicing
  the cost-sorted list wholesale preserved the curve while throwing away the
  comp (one hard deck came out with a single Support at 4x4 and seven at 5x5),
  which is what inverted the small board. Take three of every five out of each
  ROLE, so the 18 is the 30 in miniature on both axes.

- **Three MODES, not three overlapping selections** (`arenaGame` in App.tsx —
  `casual` / `streak` / `gauntlet`). Exactly one owns the lobby, the opponent
  seat, and the settlement, and switching away PARKS the others rather than
  scoring them. **Streak and Gauntlet are CHALLENGES**, and `startGate` is what
  makes that word mean something: the opponent chair is dealt in both (no
  `onChange` — Casual is where picking your own fight lives), neither will start
  "a normal match" (gauntlet mode with no run armed refuses, rather than quietly
  fighting a deck you picked), the battlefield is locked to a live run's board,
  and your squad must be the format's exact size. That last one is enforced
  NOWHERE ELSE — the engine never checked deck length — so a 30-card 5x5 squad
  would otherwise walk into a 4x4 gauntlet with twelve extra cards of depth.
  Casual warns instead of blocking; a sandbox is what it is for. Difficulty in
  gauntlet mode is its own control (`runTierPick`) — it used to be read off
  whichever deck sat in the opponent chair, which stopped working the moment
  that chair was dealt rather than chosen. This is load-bearing, not cosmetic: `settleArena` used to
  advance — and on a loss END — any live Gauntlet run, guarded only by
  `runOver`, so one casual match destroyed a run it was never part of. The
  caller now states `gauntletSeat`, and the ladder is likewise gated on streak
  mode (a Gauntlet seat was scoring on two ladders at once). If you add a fourth
  kind of AI match, it is a mode, and it says which settlements it belongs to.

- **The matchmaker** — the OPPONENT row in the Arena, shown in STREAK mode.
  Pick a rung, it rolls a deck from it, and re-rolling the same rung avoids the
  deck already seated. The old "OR PICK" manual rung row is gone: it let you
  hand yourself any difficulty and then climb on it, and it was dead weight
  besides — an off-rung match already scored nothing. Streak also deals the NEXT opponent the moment a match
  ends, off the rung you are on *after* it, excluding the deck you just beat —
  and the win screen shows what is queued (name, elements, rung, pay) with
  Fight and Leave as equals. Rematch stands down while a dealt opponent waits:
  it runs the same two decks back, which is the one thing a streak may not do.

- **The Gauntlet** (`gauntlet.ts`). Four dealt opponents from one rung, order
  fixed at the start, 10/18/30 shards on completion, one loss ends it. The four
  anti-farm properties are in that file's header; the important one for future
  work is that the run lives in the SAVE, not React state, so it cannot be
  re-rolled by leaving. `settleArena` is a pure function on purpose — the money
  path should be testable without playing four matches. **A win against a deck
  the player BUILT pays nothing**, which is what closed the original farm.
  It is not tamper-proof and the header says so; the claim is only that the
  honest path is no longer the slow one. A run now SURVIVES you playing other
  modes — leaving is a supported thing to do, and the mode strip shows a dot
  when one is waiting.

- **Online pays 10 for a win and 5 for a loss** (`onlineMatchShards`), the only
  mode that pays a loser, because a human opponent is not infinite the way the
  AI seat is. A CONCEDE pays zero, or the best rate in the game is two people
  surrendering to each other. Online settles on its own short path and touches
  neither the ladder nor a run — it used to fall through the arena's, where
  `won` was hardcoded to P1 and so paid a losing GUEST (who sits in P2).

Story teams carry their own spellbook (`Loadout.spells`, resolved by
`bookForLoadout`). Absent or empty keeps meaning "use the hero's shelf" —
every pre-existing team is that case — and the offer in the builder is gated
on what the hero has actually unlocked, because spells are earned by walking a
region.

### Squads

- **It is a SQUAD, on screen, everywhere.** The same saved object used to be a
  deck, a squad, a team, an army and a loadout depending on which screen you
  stood on — a tile marked "Deck builder" reading "No team saved" opening a
  modal titled "Squad Builder". `Squad` is also the only type (`squads.ts`,
  `we_squads_v1`); `CustomDeck` and `Loadout` are aliases. **"Deck" now means
  exactly one thing in user-facing copy: the pile you draw from once the match
  starts.** If you add a string, pick the right one of those two.

- **Both editors can do both verbs.** `DeckBuilder` was the only surface that
  could ADD a card and had no fill; `StoryPrep` had a fill and could not touch a
  single card. So the builder has **Auto-fill** (tops up, never replaces, and
  fills from the FILTERED pool — narrow to GALE Rangers and it builds GALE
  Rangers) and prep's chips are tappable to drop with an Add beside them. The
  builder's spell fill must NOT go through `autoDeck`: that reads `getDef`,
  which knows cards and throws on a spell id, and the two are both `string[]`.

- **The picked squad is always on screen in the builder**, not one of four
  panels behind a pill. The desktop default used to be Composition — the
  default state of the squad builder was one where you could not see the squad.

- **The campaign builder's cap and board follow the PREPPED NODE** when prep is
  open (`builderCap` / `builderBoard` in App.tsx), and the region's maximum
  otherwise. Those were quietly different numbers, and the region-max answer
  painted a 20-card squad legal that the 12-cap node in front of you then
  rejected. The cap line names the fight so the shifting ceiling reads as
  intent. Related: `buildSize` is `useState(props.boardSize)` and the builder is
  mounted all session, so it needs the prop-sync effect — without it the board
  freezes at the first render of the APP.

## Traps found the hard way

- **A rule that names board rows by NUMBER is probably wrong on one of the two
  board sizes.** The Home Slot rule's "is the attacker in a mid row" test was
  written `row === 1 || row === 2`. That is every row between the home rows on
  a 4x4 and only two of the three on a 5x5, where row 3 sits between mid and
  P1's home row 4. So on every 5x5 board in the game — story landmarks and
  thrones, the 5x5 arena, the elite gauntlet, Void Tower — a card in row 3
  could not attack into the home row it was standing directly in front of, and
  reported "has no valid action" with a target under its nose. It was
  ASYMMETRIC and only ever helped the player: the mirrored shot (P1 in row 1
  into P2's home row 0) always worked, because row 1 is "mid". `spellReaches‐
  EnemyHome` had the identical hole. Both now derive from `state.boardSize`:
  the rule is "you cannot reach into the enemy home row from inside your own".
  Regression tests live in `targeting.test.ts` with a `bigPrepState()` helper —
  **anything row-shaped wants a test at BOTH board sizes.**

  `isMidRow` itself is deliberately NOT the same function and was left alone.
  It answers the King of the Hill question, and its own comment records that
  excluding row 3 on the 5x5 is an open design call; widening it would silently
  re-tune every hill bonus at once. Same words, two different questions.

- **A NEW top-level class name must be grepped against the JSX before it is
  written.** This session shipped the same collision twice in two commits, in
  both directions. `.home-purse.ess` picked up the global 9px `.ess` GLYPH and
  turned the pill into a diamond; then a bare `.home {}` for the new Home screen
  silently captured `<section className="squad-strip home">` — the Story map's
  home-ground panel — and reflowed it into a 430px full-height gradient column
  with 74px of dead space under it, on every conquered region. Neither `tsc`,
  `vite build` nor 1391 tests can see either one, and the second was written
  the same day as the first entry warning about it. `grep -rn 'className=.*home'`
  costs two seconds; a screen-name class (`.home`, `.card`, `.row`, `.panel`)
  is a name somebody else already used. Prefix screen roots: `.home-screen`.

- **A `useMemo` added below an early return is a rules-of-hooks bug, and
  nothing in this repo will tell you.** There is no ESLint here. StorySquad
  returns early for home-ground regions, and a memo appended at the natural
  place — next to the code that uses it — rendered 5 hooks on one branch and 6
  on the other. It only stayed latent because StoryMap unmounts the component
  on a region switch; the day `save.cleared` gains the Throne while it is
  mounted, React throws and the map white-screens. Hooks go above every
  conditional return, including the ones you did not write.

- **When a test replaces a stricter one, diff the ASSERTIONS, not the intent.**
  The rarity-model ladder test asserted `easy < mid`, `mid < hard`, and a
  minimum spread. Its strategy-based replacement asserted mid-vs-easy and
  hard-vs-easy — and never hard-vs-mid, on any axis. The top two rungs could
  invert with the suite green, which is the exact failure the ladder banner
  records happening twice already; swapping four same-element cards in one hard
  deck reproduced it. Every ADJACENT pair, or the chain is not pinned.

- **A BEM-style modifier that collides with a global utility class is not a
  modifier — it is that utility, applied to the wrong element.** The stylesheet
  has single-purpose glyph classes (`.shard`, `.ess`: 9px, `clip-path`-ed to a
  diamond), and Home's currency pills were written as `.home-purse.ess`. There
  is no `.home-purse` in `.ess`'s selector, so the rule matched on the class
  ALONE and turned the whole 38px pill into a 9px diamond with the number
  clipped out of it. `tsc` and the tests cannot see this and the pill still
  *renders* — it just renders as something else. Two tells worth knowing: the
  element measured far smaller than its own padding could allow (20px against
  an 18px+9px+4px floor), and `innerHTML` showed the number present while the
  screenshot showed nothing. Prefix the modifiers (`.p-shard`, `.p-ess`) rather
  than raising specificity, which only hides the collision.

- **`:first-of-type` counts TAG type, not class.** `.home-purse:first-of-type`
  was meant to put `margin-left: auto` on the first pill; the avatar and the
  name are also `<span>`s, so the first `<span>` is the avatar, no `.home-purse`
  was ever the first of its type, and the rule matched nothing at all. It fails
  open — no error, no visual clue except that the thing did not move. Put the
  margin on a class you actually control.

- **CSS fails SILENTLY, and nothing else in the toolchain reads it.** An
  unbalanced comment or brace makes the browser skip to the next recoverable
  point, so a rule stops existing while `tsc`, `vite build` and every engine
  test stay green. This bit twice in one session — once killing the whole sheet
  (every custom property resolved empty), once disabling two rules and leaving
  a popover clipped off screen. `src/engine/__tests__/styles.test.ts` now parses
  the file and fails on it. That guard must read from DISK: `import "…css?raw"`
  returns an EMPTY STRING under Vitest, and every check that asserts absence
  then passes against nothing.

- **When scanning CSS, skip COMMENTS BEFORE STRINGS.** The comments here are
  English prose full of apostrophes; a strings-first scanner reads "the bar's
  height" as a quote and miscounts every brace after it. Two separate scripts
  made this mistake.

- **Audit the COLUMN, not the component you just added.** The Gauntlet panel
  measured perfectly on its own and pushed the versus card into the Start
  button, because a `flex: 1 1 auto` box whose children carry `min-height`
  gets squeezed under its own content and overflows onto its neighbours
  instead of scrolling. Checking the thing you added is not checking the thing
  you changed. Paste this into the console after any layout work — it walks a
  container, reports overlapping siblings and unreachable controls, and takes
  about a second per screen:

  ```js
  window.__audit = (rootSel, childSel) => {
    const root = document.querySelector(rootSel);
    if (!root) return { screen: rootSel, err: "absent" };
    const R = (e) => { const b = e.getBoundingClientRect();
      return { y: Math.round(b.y), bottom: Math.round(b.bottom) }; };
    const boxes = [...root.querySelectorAll(childSel)]
      .filter((e) => e.getBoundingClientRect().height > 0)
      .map((e) => ({ c: (e.className || "").toString().split(" ")[0], ...R(e) }))
      .sort((a, b) => a.y - b.y);
    const overlap = [];
    for (let i = 1; i < boxes.length; i++)
      if (boxes[i].y < boxes[i - 1].bottom - 1) overlap.push([boxes[i - 1].c, boxes[i].c]);
    const unreachable = [];
    root.querySelectorAll("button:not(:disabled), input, select").forEach((e) => {
      const b = e.getBoundingClientRect();
      if (b.height < 4 || b.width < 4) return;
      const cx = Math.round(b.x + b.width / 2), cy = Math.round(b.y + b.height / 2);
      if (cy < 0 || cy > innerHeight || cx < 0 || cx > innerWidth) return; // scrolled out, not broken
      const t = document.elementFromPoint(cx, cy);
      if (!t || !(e.contains(t) || t.contains(e)))
        unreachable.push({ t: (e.innerText || e.tagName).slice(0, 22),
                           hitBy: t && (t.className || t.tagName).toString().slice(0, 24) });
    });
    return { screen: rootSel, overlap, unreachable,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  };
  ```

  Two expected non-findings, so they are not chased twice: a control behind a
  modal (the ⋯ under the mulligan overlay) reports `hitBy: "overlay"` and is
  correct, and anything scrolled out of view is skipped rather than flagged —
  the builder's element filters are a horizontal scroller by design.

- **Presence is not reachability.** A synthetic `.click()` fires the handler
  whatever is painted on top, so it cannot see a covered control. Use
  `document.elementFromPoint` at the element's centre. Every layout bug in the
  redesign — the nav under overlays, the deck button under the nav, Skip below
  the fold, the mute button — was invisible to inspection and obvious to a hit
  test.

- **The Browser pane does not composite frames.** A CSS transition parks at
  `currentTime: 0` and reports its START value forever, so an animated box
  measures wrong. Disable transitions before measuring:
  `*{transition:none!important;animation:none!important}`.

- **A `flex: 1` grid CRUSHES its auto rows, and `align-content: start` does not
  stop it.** `flex: 1` hands the grid a definite height; Chrome then divides
  that height across the `auto` rows as if they were `1fr`. Eight 174px cards
  in a 612px scroller came out 62.5px each with their art clipped to nothing —
  and `scrollHeight === clientHeight`, so the scroller looked correct too. It
  is not the `<button>`: a plain `<div>` probe collapses identically. Any grid
  that is a flex item and meant to scroll needs `grid-auto-rows: max-content`.

- **A child's z-index cannot escape its parent's stacking context.** The deck
  sheet sits at `--z-modal` (500) and the bottom nav at `--z-nav` (350), and
  the nav still painted over the sheet — because the sheet was rendered inside
  `.overlay`, which is itself a stacking context at `--z-overlay` (300), so its
  500 only ranked among the overlay's own children. "Build a new deck" was
  visible and unclickable. Anything that must clear the nav has to be a sibling
  of the overlay, not a descendant; a React fragment creates no stacking
  context, so moving the JSX out of the `.overlay` div is enough.

- **Build a new save by SPREADING the old one, never by listing fields.** This
  is the worst bug the project has had. `applyClear` wrote its result as
  `{ cleared, collection, pity, deck, blight }` — five fields, no spread — so
  beating any story node silently deleted everything else on the save: the hero
  (name, shards, essence, foils, chosen spells), every saved team, `lastTeamId`,
  and the per-region decks and squads. It compounded, because `awardEssence`
  ran next and `save.hero ?? newHero()` minted a fresh hero into the hole. The
  reported symptom was "my shards are not saving".
  Diagnose this class by round-tripping the DATA layer first: save/load
  preserved shards perfectly in every case, which ruled out persistence and
  pointed at a mutation. The regression test asserts on the KEY SET of the
  input, not a list of names, so a field added later is covered without anyone
  remembering. A sweep found no other instance — `saveCustomDeck` sets all four
  of `CustomDeck`'s fields and `phases.clone` uses `structuredClone`.

- **A row in the phone's flow column must reserve its height, or the board
  moves.** Below 760px the match screen is one flex column — ribbon, board,
  speed strip, log, hand, bar — so anything that changes height moves
  everything under it. Two did, and both read to the player as "the screen goes
  up and down": the PHASE RIBBON loses the priority chip when the battle phase
  starts and shrank 35px -> 25px every round, and the HAND was rendered only
  while `activeCard === null`, so it unmounted and remounted between every
  activation. Both are pinned now — the ribbon to a fixed height, the hand to a
  fixed height and always rendered, with visibility left to CSS. Measure this
  by sampling the column every 50ms across a round and counting DISTINCT tops;
  a stable layout gives one value per element.

- **A class shared across two states must RESET what the other state set.**
  This shipped four times in one area — the battle log and the speed queue —
  before it got written down, and every instance looked like a different bug:

    `flex-direction: row` on a `display: block` did nothing, so the phone
    speed queue stayed a 192px vertical stack inside a 26px clamp and read as
    missing.
    `flex-direction` + `overflow` on a `display: none` did nothing, so the
    log drawer opened to a title, a close button and no log.
    `flex: 1` on the strip's title made the label fill the WIDTH; the same
    declaration in the drawer's column filled the HEIGHT and shoved the log
    into the bottom 216px of an 1848px panel.
    `background: rgba(…, .5)` is right for a thin strip on the page and wrong
    for a drawer over the board — the log was being read through the
    battlefield.

  The shape is always the same: state A sets a property, state B changes the
  box's orientation or role but only overrides the properties someone
  remembered. Diff the two states rather than reading the rules:

  ```js
  const props = ["display","position","flex","flexDirection","alignItems","gap",
    "padding","height","width","overflow","backgroundColor","backgroundImage","borderRadius"];
  const snap = (e) => Object.fromEntries(props.map((p) => [p, getComputedStyle(e)[p]]));
  const before = snap(el);            // …toggle the state…
  const after = snap(el);
  console.table(Object.fromEntries(
    props.filter((p) => before[p] === after[p]).map((p) => [p, before[p]])));  // CARRIED OVER
  ```

  What carried over is the answer — read that list and ask of each line
  "is this still right in the new state?" `background` was on it three fixes
  running before anyone looked.

- **`MatchLayout.tsx` is the match screen's shell** — `.wrap` and its modifier
  classes, the music toggle, the battle-log rail, the two edge tabs and the
  Spells sheet. Everything with a rule in it arrives as a SLOT (`ribbon`,
  `logEntries`, `board`, `rightCol`, `spellSheet`, `bottom`, `children`),
  already rendered by App. It holds no state: the drawer, the rail and the
  track are App's, passed in with their setters. Slots are React fragments, so
  the DOM under `.wrap` is unchanged — `.wrap.pre-match > .phase-ribbon` and
  friends are direct-child selectors and still match. Migration step 7 of the
  redesign; the reducer refactor it unblocks has not been started.

- **The squad limit is not a deck limit, and clamping one by the other is a
  silent cap.** `squadCapFor` counts only what you carry from ELSEWHERE — a
  region's own element travels free and is already in the pool. `App.tsx`'s
  `storyBuilderCap` used to clamp deck size by it, so the builder tracked the
  SQUAD ladder (12/14/16/18/20/22/24) while the player watched the DECK ladder
  and saw it stop moving. `capForNode` had already dropped the same clamp and
  left a comment saying why; the builder call site was missed. It derives from
  `capForNode` across the region's nodes now, so the number is the biggest
  fight the region can actually ask for.

- **Flex line-breaking uses HYPOTHETICAL sizes and happens before shrinking.**
  An item that could shrink to fit still gets pushed to its own line, because
  the browser decides the line from the item's unshrunk size. `flex: 0 1 auto`
  plus `min-width: 0` is not enough — the fix is a `max-width` that caps the
  hypothetical size. This is why the story header stacked three rows on a phone
  when its two lower boxes fit one, 1px apart.


- **Board size and deck size are welded together by format, and the format is
  an EXACT size.** In the Arena a 4x4 deck is eighteen cards and a 5x5 deck is
  thirty — no more, no less. `DECK_LIMITS` still has `min`/`max`/`target` but
  all three hold the same number; prefer `deckSizeFor(board)`. They used to be
  ranges (12-20, 20-30), which let two decks in one format differ by eight
  cards, and the shorter one just drew its best card more often. `STANDARD_CAP`
  / `BIG_BOARD_CAP` in `story.ts` are the same two numbers, so a finished
  campaign deck is a legal Arena deck. Changing either is a FORMAT change and
  the six premades are built to it exactly (18 base + 12 `LARGE_EXTRAS` = 30).
  `capForNode` clamps the ladder PER NODE by that node's board, so a region
  mixing 4x4 skirmishes with 5x5 set pieces is fine — each fight lands in its
  own format. Campaign ladder: 12 / 15 / 18 / 24 / 30.

- **Auto modes are `manual | basic | full`, and only `full` fires Specials.** A
  card on `basic` with nothing in reach used to SKIP, forever. For Oakgre that
  was fatal rather than annoying: it is printed at **SP 0**, and Uprooted (+3 SP)
  is the only thing that ever unpins it — so it could not reach anyone, never
  fired the buff, and never moved for the whole game. `basic` now fires a
  Special when the turn would otherwise be wasted entirely AND the Special is
  `targetSide: "self"` (no targeting decision taken from the player). `manual`
  still prompts. Regression test: `self-buff-auto.test.ts`.
  A permanent, stacking Special can opt into a lifetime cast limit with
  `params.maxStacks` (Oakgre's Uprooted is 3). `card.specialCasts` counts every
  cast however it was paid for, so a free or talent-granted one can't dodge the
  limit, and `canFireSpecial` refuses past it. Without a cap, a card parked out
  of reach just grows every round for the rest of the game.
  When testing an auto-mode policy, the side under test must be in `humans` —
  an AI-driven side runs `chooseBattleAction` instead and fires the Special
  anyway, so the test would pass without the fix.

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
- **Opening deployment (§10.6)** — **STORY-ONLY.** Each side leads with **one
  free teammate** before round one, then the ordinary game resumes; a Throne
  leads with two. It shipped as a 4-card / 10-gold opening board and was scaled
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
