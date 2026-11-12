# Traps found the hard way

Moved out of CLAUDE.md to keep it short. Same text, same rules — read it before working in this area.

## Traps found the hard way

- **A source-level test that slices App.tsx to `"\n  }\n"` is vacuous on a
  Windows checkout.** A fresh worktree checks files out with CRLF, the search
  finds nothing, `slice(at, -1)` runs to the end of the file, and every
  `toContain` after it passes against the whole of App.tsx. Normalise first:
  `readFileSync(...).replace(/\r\n/g, "\n")`. `arena-flow.test.ts` does, and a
  mutation run proved its slices bite.

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
