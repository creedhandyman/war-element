/** In-app rules book — the "How to play" reference reachable from the main menu.
 *  Content tracks How_To_Play_ingame.docx, with every number checked against the
 *  engine before it shipped (magic ramp, pool carryover, deck + spellbook caps,
 *  capture lockout): objective, deck, resources, the round loop, combat,
 *  shields, speed/movement, elements, statuses, keywords and wins. */
import {
  ELEMENT_AURA, ELEMENT_MATCHUP, MAX_ROUNDS, OPENING_COST_CAP, OVERRUN_HOLD_ROUNDS, SP_SLOW_MAX,
  VOID_TOWER_ROUNDS,
} from "../engine";
import { OPENING_CHEAP_COST, OPENING_CHEAP_MIN, SP_MID_MAX } from "../engine/state";
import { DOMINATION_7X7, POI_GOLD } from "../data/domination";
import { EL_COLOR, ELEMENTS } from "./shared";

/** The Well's numbers, off the map that places it — the 7x7 is the only board
 *  with one. Read rather than typed for the same reason as every other figure
 *  in this book: a retuned heal must not leave the rules describing the old. */
const WELL = DOMINATION_7X7.well;

/** Fixed display order for the element lists below. */
/** "LEAF" → "Leaf" — the rules book reads as prose, not as engine constants. */
const title = (el: string) => el.charAt(0) + el.slice(1).toLowerCase();

export function RulesBook(props: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={props.onClose}>
      <div className="modal rules-book" onClick={(e) => e.stopPropagation()}>
        <div className="rules-head">
          <h2>How to Play</h2>
          <button className="cd-x" title="Close" onClick={props.onClose}>✕</button>
        </div>

        <div className="rules-body">
          <section>
            <h3>🎯 The goal</h3>
            <p>Command an elemental army on a 4×4 (or 5×5) grid. Win three ways:</p>
            <ul className="rules-defs">
              <li>
                <b>Elimination</b> — leave the opponent with no cards on the board,
                in hand, or in their deck.
              </li>
              <li>
                {/* Checked at EVERY Cleanup on bare occupancy (phases.ts), so an
                    invader that stepped on in this round's Prep and lived through
                    the battle captures that same Cleanup — "a full round" read as
                    a round of waiting it does not need. */}
                <b>Slot capture</b> — an invader still standing on an enemy Home slot
                at a round's Cleanup captures it <i>permanently</i> — even one that only
                stepped on during that round's Prep. A captured slot is locked out for
                its owner and shows a <b>🔒 padlock</b>: nothing can be summoned onto it
                and no move can end on it (cards may still pass through), and it can
                never be taken back. Capture every one of an opponent's Home slots —
                four on the standard board, five on the large one — and you win.
              </li>
              <li>
                <b>The clock</b> — a match still running after round{" "}
                <b>{MAX_ROUNDS}</b>'s Cleanup is decided there: most Home slots captured,
                then most cards still standing, then most total HP. On the 7×7 it is
                Points held, then cards, then HP — and a seat already eliminated is out
                of the running. Level on all three and it is a <b>draw</b>.
              </li>
            </ul>
            <p>
              With three or four seats it is <b>last seat standing</b> — emptying one
              opponent does not end it, and conceding empties only your own seat while the
              others fight on. A mutual wipe is a draw.
            </p>
            <p>
              Two modes change these rules outright. <b>Domination</b> (the 7×7) has no
              Home row to capture — see below. In the <b>Void Tower</b>, Home-slot capture
              is switched off entirely: you win the moment no untamed boss is left
              standing, and the boss wins by wiping you out, by standing on every slot
              of your Home row — the boss itself among them — at {OVERRUN_HOLD_ROUNDS}{" "}
              Cleanups in a row, or by outlasting its own {VOID_TOWER_ROUNDS}-round clock.
            </p>
          </section>

          <section>
            <h3>🃏 Your squad</h3>
            <ul className="rules-defs">
              <li><b>4×4 Standard</b> — 18 cards, up to <b>5</b> spells.</li>
              <li><b>5×5 Large</b> — 30 cards, up to <b>8</b> spells.</li>
              <li><b>7×7 Domination</b> — builds as the Large squad (30 cards, 8 spells), and it is the only board that seats more than two players.</li>
              <li>
                Every card is <b>unique</b> — no duplicates. Build one in the Squad
                Builder, then pick it before the match. (The <b>deck</b> is what that
                squad becomes once the match starts — the pile you draw from.)
              </li>
            </ul>
          </section>

          <section>
            <h3>💠 Resources</h3>
            <p>
              <b>GOLD</b> (your summon pool) pays to <b>summon</b> cards. Each round you
              gain <b>the same ramp Magic uses below (+1 rising to +5), plus 1 for every
              Home slot you are standing in</b> — so your
              back line funds your front, and being pushed off your own Home row costs you
              the money to rebuild it. A card that advances out of Home stops paying, which
              is the trade. A card's cost is the number in its top corner.
            </p>
            <p>
              <b>MAGIC</b> pays for <b>Specials</b> and <b>Spells</b>. It speeds up as
              the game goes on:
            </p>
            <ul className="rules-defs">
              <li><b>Rounds 1–5</b> — +1 Magic per round</li>
              <li><b>Rounds 6–10</b> — +2</li>
              <li><b>Rounds 11–15</b> — +3</li>
              <li><b>Rounds 16–20</b> — +4</li>
              <li><b>Rounds 21+</b> — +5</li>
            </ul>
            <p>
              Unspent Gold and Magic carry over, but each pool only banks up to
              <b> 10</b> between rounds — sitting on a huge reserve doesn't work.
            </p>
            <p>
              <b>In Domination the Home-slot bonus does not exist</b> — the 7×7 has no
              Home row. Each <b>Point</b> you hold pays <b>{POI_GOLD}</b> Gold a round
              instead, on top of the same ramp, so the map itself is the income.
            </p>
          </section>

          <section>
            <h3>🔁 The round loop</h3>
            <ul>
              <li>
                <b>Mulligan</b> (first round): click opening-hand cards to send back,
                confirm, and redraw.
              </li>
              <li>
                {/* The campaign's first battle is the ONLY match that deals an
                    opening placement (App passes `opening` there alone), and only
                    to the player — story.ts PLAYER_DEPLOY / ENEMY_DEPLOY. */}
                <b>Deployment</b>: in the campaign's first battle only, you place one
                card <b> free</b> — no Gold spent — onto a Home slot before round one;
                the opponent gets no free placement. Cost {OPENING_COST_CAP} or less only,
                so the head start is a body rather than a bomb. Every other match starts
                straight on the Gold ramp.
              </li>
              <li>
                <b>Prep</b>: glowing hand cards are affordable — click one, then a
                glowing Home slot to summon (any number per turn). Click a board card,
                then a glowing slot to move (one move per priority turn). Cast Spells
                here too. <b>Pass Priority</b> when done — once every seat has passed in
                a row, the battle starts.
              </li>
              <li>
                <b>Battle</b>: cards act in <b>SP order</b> (fastest first, 21 → 0;
                ties broken by a seeded coin). When one of yours is up, choose
                <b> Basic / Special / Skip</b>, then click glowing targets.
              </li>
              <li>
                <b>Cleanup</b>: damage-over-time ticks, statuses count down, end-of-round
                passives fire, captures are checked, and the next round begins.
              </li>
            </ul>
          </section>

          <section>
            <h3>⚔️ Combat</h3>
            <ul>
              <li>
                Stats read <b>⚔ DMG</b> (×N hits if multi-hit) · <b>♥ HP</b> ·
                <b> 🛡 shields</b> · <b>SP</b> (speed). Shields soak damage before HP;
                <b> PEN</b> ignores shields.
              </li>
              <li>
                <b>Melee</b> hits the eight adjacent slots. A <b>Ranged</b> basic reaches
                <b> 2</b> slots, and <b>3</b> once it has left its own Home row — not the
                whole board. On a straight line (row, column or true diagonal) a single
                enemy body <b>screens</b> the shot; knight-shaped shots have no line to
                block. Allies never get in the way.
              </li>
              <li>
                {/* A ranged card's Special skips every reach branch in canTarget
                    (those are basic-only), so it has no range cap and no body can
                    screen it; the Home rule and STEALTH still run for it. */}
                <b>A ranged card's Special reaches the whole board</b> — no range cap, and
                no body screens it — though the Home rule and STEALTH still apply. A{" "}
                <b>melee</b> card's Special only reaches its own adjacent squares unless
                the Special itself says otherwise.
              </li>
              <li>
                <b>The Home rule</b> — while you are standing on your <i>own</i> Home
                row you cannot attack anything standing on <i>theirs</i>, basic or
                Special. Step off your line and it lifts. This is why a back-line shooter
                can read "no valid action" with enemies plainly in front of it.
              </li>
              <li>
                <b>Specials recharge</b> — firing one puts it on cooldown, usually 2
                rounds. A card that was <b>summoned this round</b> can basic-attack in the
                battle but cannot fire its Special until the next one.
              </li>
              <li>
                Multi-hit and barrage Specials take several target picks — spread them
                or repeat one to stack. It fires at the cap, or press <b>Fire</b> early.
              </li>
              <li>
                The badge on each of your cards cycles its auto mode:
                <b> MANUAL → AUTO</b> (basics only, never spends Magic) <b>→ FULL</b>
                (may fire Specials).
              </li>
            </ul>
          </section>

          <section>
            <h3>🛡 Shields</h3>
            <ul className="rules-defs">
              <li>
                <b>Armour, not a second health bar</b> — a card's shield value is
                subtracted from <i>every</i> incoming hit; only the overflow reaches HP.
                4 shields fully soaks any single hit of 4 or less.
              </li>
              <li>
                <b>They erode as they work</b> — each hit that lands also chips the
                shield down: a small hit strips 1, a big one (10+) strips 2, a huge one
                (21+) strips 3. So shields blunt attackers but wear away over a fight.
                <i> Bore</i> is the exception — its Exostone never loses more than 1 to
                a single hit, however heavy.
              </li>
              <li>
                <b>Piercing & blocking</b> — <b>PEN</b> ignores shields entirely, hitting
                HP direct (and never strips them). <b>BLOCK</b> is separate: a flat
                reduction applied <i>before</i> shields, even against PEN.
              </li>
              <li>
                <b>BURN melts them</b> — a burning card also loses shields every tick, on
                top of the damage.
              </li>
              <li>
                <b>CRIT needs bare skin</b> — a basic can only critically hit a target
                whose shields are already at 0. A card printing <b>Crack Shot</b> is
                the exception: its crit fires through armour and pierces it.
              </li>
              <li>
                Gain shields from Bore's Exostone (on summon, and again off every
                plate it breaks), Leaf's Photosynthesis, and many card abilities —
                they don't refill on their own.
              </li>
              <li>
                <b>Looted plates have limits</b> — a Bore card can take at most{" "}
                <b>2</b> shields off opponents per round, however many plates its
                attacks break, and can stack at most <b>10</b> looted shields above
                the armour it was printed with. Shields from Specials, spells and
                ally auras are not looted and are not capped.
              </li>
            </ul>
          </section>

          <section>
            <h3>⚡ Speed queue & movement</h3>
            <p>
              The right-hand rail lists every card in the order it will act this
              round, fastest SP first. The tag on each row tells you what happens:
            </p>
            <ul className="rules-defs">
              <li><b>YOU</b> — your card; you'll choose its action.</li>
              <li><b>AI</b> — the opponent's card.</li>
              <li>
                {/* No PARALYZE here: the tag is worked out before the turn, the
                    PARALYZE coin is rolled at the swing, and a paralysed card can
                    still fire its Special anyway. */}
                <b>CAN'T ACT</b> — this card can do nothing this turn: either a status
                is stopping it (STUN or SLEEP) or it has no legal action — nothing in
                range and no Special it can afford. It stays in the queue and passes.
              </li>
            </ul>
            <ul className="rules-defs">
              <li>
                <b>Who acts first</b> — in battle every card takes its turn in
                <b> SP order, fastest first</b> (the queue counts down 21 → 0). Exact
                SP ties are broken by a seeded coin flip.
              </li>
              <li>
                <b>SP shifts mid-match</b> — Gale's Zephyr adds SP each round, Vapor
                grants +4, while FREEZE and ROOT drop SP to 0, so those cards act
                <i> last</i> and can't move at all.
              </li>
              <li>
                <b>Move once per turn</b> — in Prep you may move a single board card
                each priority turn onto a glowing slot.
              </li>
              <li>
                {/* Reach is SP's alone (`moveReach`). FLYING and a mount buy the
                    king-step, not a longer stride — an SP 4 flier still moves one
                    slot, it just may take it diagonally. */}
                <b>Speed sets your stride</b> — SP 1–{SP_SLOW_MAX} move 1 slot, SP{" "}
                {SP_SLOW_MAX + 1}–{SP_MID_MAX} move 2, and SP {SP_MID_MAX + 1}+ move 2{" "}
                <i>and cut corners like a chess king</i> — a diagonal counts as one step.
                FLYING and mounted cards cut corners too, at whatever stride their SP
                gives them. PARALYZE caps a card to a single step; ROOT and FREEZE stop
                it dead.
              </li>
              <li>
                <b>Bodies hold the way</b> — an enemy standing between the two ends of a
                two-step move blocks it. FLYING cards and the SP {SP_MID_MAX + 1}+ tier
                slip past anyway, which is the second thing that tier buys. Allies never
                block, and a captured slot can be <i>passed through</i> — you just can't
                stop on it.
              </li>
              <li>
                <b>What stops a move outright</b> — STUN, SLEEP and FRIGHTEN refuse it
                before reach is even counted, and an emplaced card never moves at all.
              </li>
              <li>
                <b>No teleporting home</b> — a card can't jump straight from your Home
                row to the enemy's in one move. Push up the middle to threaten a
                Home-slot capture.
              </li>
            </ul>
          </section>

          <section>
            <h3>🌈 Elements & auras</h3>
            <p>Every card carries its element's passive aura:</p>
            {/* Rendered from ELEMENT_AURA rather than retyped. That table is the
                source of truth the card inspector already reads, and the list
                here had drifted from it — describing a flat "+2 shields" for
                Exostone and no round-tick at all for Awakening. */}
            <ul className="rules-els">
              {ELEMENTS.map((el) => (
                <li key={el}>
                  <b style={{ color: EL_COLOR[el] }}>{title(el)}</b> — {ELEMENT_AURA[el].name}: {ELEMENT_AURA[el].desc}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>⚔️ Elemental matchups</h3>
            <p>
              On top of its own aura, an element answers particular others. These
              apply automatically — there is nothing to activate.
            </p>
            <ul className="rules-els">
              {ELEMENTS.filter((el) => ELEMENT_MATCHUP[el]).map((el) => (
                <li key={el}>
                  <b style={{ color: EL_COLOR[el] }}>{title(el)}</b> — {ELEMENT_MATCHUP[el]!.name}: {ELEMENT_MATCHUP[el]!.desc}
                </li>
              ))}
            </ul>
            <p>
              <i>Bolt</i> has no matchup bonus — Electrify already answers anything
              carrying a status, whoever put it there.
            </p>
          </section>

          <section>
            <h3>🔥 Statuses — damage over time</h3>
            <p>
              DOTs tick at the end of every round until they wear off, and <b>every one
              of them ignores shields</b> — armour soaks attacks, never poison.
              Re-applying one keeps the <i>better</i> of the two, power and duration
              judged separately, so a fresh application can never shorten or weaken
              what is already running.
            </p>
            <ul className="rules-defs">
              <li><b>BURN</b> — burns HP each round, and melts <b>2</b> shields every tick. Stacks up to 5 (Pyro's Scorch).</li>
              <li><b>BLEED</b> — loses HP each round. Re-applying keeps the stronger, like every DOT here; it stacks only where a card says it does (Leaf).</li>
              <li><b>SCALD</b> — scalding damage each round.</li>
              <li><b>DOT / Poison</b> — generic damage each round.</li>
            </ul>
          </section>

          <section>
            <h3>🥶 Statuses — control</h3>
            <p>These stop a card acting, slow it, or pin it in place.</p>
            <ul className="rules-defs">
              <li><b>STUN</b> — skips its whole turn.</li>
              <li><b>SLEEP</b> — skips its turn until any hit wakes it.</li>
              <li><b>PARALYZE</b> — 50% chance its <i>basic attack</i> fizzles, rolled each time (Bolt). It does not cost the turn: a paralysed card still fires its Special normally, and it still moves — capped to a single step.</li>
              <li><b>FREEZE</b> — SP drops to 0 <i>and</i> its <b>basic</b> damage is halved. Specials print their own number and are unaffected.</li>
              <li><b>ROOT</b> — SP drops to 0: it can't move and acts last.</li>
              <li><b>MUTED</b> — can't fire its Special.</li>
              <li><b>FRIGHTEN</b> — the card is shoved a slot back toward its own Home row the moment it lands (if that slot is open), and then cannot move at all while it lasts. It is how you repel an invader off your line without killing it.</li>
            </ul>
          </section>

          <section>
            <h3>📉 Statuses — debuffs & marks</h3>
            <ul className="rules-defs">
              <li><b>WEAKEN</b> — <b>basic</b> damage down 25%, and it <i>stacks</i>: each new application compounds (25% / 44% / 58%) up to three deep rather than just refreshing the timer. Specials print their own number and shrug it off.</li>
              <li><b>BLIND</b> — its basic attacks have a ~50% chance to miss.</li>
              <li><b>SEAL</b> — cannot be healed while sealed.</li>
              <li><b>ELECTRIFIED</b> — harmless on its own, but Bolt cards deal +1 DMG to <i>any</i> statused foe.</li>
              <li><b>STEALTH / EVASION</b> — also appear as timed <i>buffs</i>: temporary untargetability or dodge.</li>
            </ul>
          </section>

          <section>
            <h3>🏷 Keywords</h3>
            <p>
              Mostly printed on the card — but auras, timed buffs and Specials
              <i>grant</i> these too, and a granted one works exactly like a printed one.
            </p>
            <ul className="rules-defs">
              <li><b>CRIT</b> — each hit has a ~50% chance to <i>double</i> its damage. The coin is rolled per hit, so a multi-hit basic rolls once for each. The target must be unshielded — and a <b>piercing</b> attack never crits at all, so PEN and CRIT on the same swing cancel.</li>
              <li><b>PEN</b> — attacks pierce shields and hit HP directly (and never strip them).</li>
              <li><b>BLOCK N</b> — every incoming hit is reduced by N — before shields, and even against PEN.</li>
              <li><b>REFLECT N</b> — returns N to the attacker <i>per hit landed</i>, so a four-hit volley bounces 4×N. A hit your shields fully soaked still bounces. The whole sum is paid back once at the end of the volley, runs through the attacker's own BLOCK and shields, and can kill it mid-attack — which stops the rest of the volley.</li>
              <li><b>EVASION</b> — ~50% chance to dodge each incoming hit.</li>
              <li><b>FLYING</b> — dodges melee entirely (unless the attacker also flies, or a status grounds it — ROOT, FREEZE, STUN, SLEEP or PARALYZE). It also ignores the ground: no enemy body blocks its path, and it soars over walls instead of setting them off.</li>
              <li><b>TRAMPLE</b> — in Prep it may step onto an <i>adjacent enemy with less max HP</i> and take the slot, in any direction. The victim is driven a slot straight back, or shoved aside into a free square beside it when the slot behind is blocked; a card that crushes also deals its trample damage <i>through shields</i> on the way past. An enemy with nowhere to be driven, or one that cannot be pushed at all, cannot be trampled.</li>
              <li><b>STEALTH</b> — untargetable until it makes its first attack of the round. The cloak breaks on the <i>attempt</i>, so a basic that misses still uncovers it. Some cards and fields can see through it for their whole side.</li>
              <li><b>LIFESTEAL</b> — basic attacks heal it for the damage dealt.</li>
              <li><b>DRAIN</b> — steals 1 max HP from the target and adds it to its own, but heals for only <i>half</i> the damage dealt, rounded down — so a 1-damage drain heals nothing. A card carrying LIFESTEAL as well heals at the full rate (Dusk).</li>
              <li><b>REGEN N</b> — heals N HP at the end of each round.</li>
            </ul>
          </section>

          <section>
            <h3>🏳 Domination (7×7)</h3>
            <p>
              A different game on a bigger board, and the only one that seats three or
              four players. There is no Home row here — nothing to capture and nothing to
              defend — so the map replaces it entirely.
            </p>
            <ul className="rules-defs">
              <li>
                <b>Four Points</b> — Fire Citadel, Volcanic Bastion, Ashen Port and
                Dragon's Lair. You hold a Point by having more live bodies on its ring
                than anyone else — a <i>tie</i> changes nothing, so whoever held it keeps
                it until someone breaks the deadlock. Each one pays <b>{POI_GOLD}</b> Gold a round.
                Its letter sits on the closed middle square, with the <b>suit</b> of
                whoever holds it above it.
              </li>
              <li>
                <b>In Streak and Gauntlet</b> — pick the <b>7×7 Domination</b> battlefield
                in Settings and the fight moves here. Sometimes one or two more decks from the same rung
                share the table. A win pays <b>double</b>, and every opponent past the
                first adds half again.
              </li>
              <li>
                <b>Winning</b> — hold <b>all four</b> and the match ends on the spot. Or
                hold <b>three</b> at the end of <b>three rounds running</b>: taking three
                does not win, still having three after the table has had its turn to
                break you does. Lose the majority for one round and the count restarts.
              </li>
              <li>
                <b>Deploying</b> — with no Home row you summon onto the four
                <b> shrines</b> on the road cross, which belong to nobody: first there
                holds one. You may also summon onto the ring of any Point you
                <i> currently</i> hold, so ground taken is ground you can land on — and a
                Point that flips takes its landing squares with it.
              </li>
              <li>
                {/* The cross's centre stopped being closed when it became the Well
                    (data/domination.ts). A citadel is masonry both ways: rules.ts
                    refuses a walk through one (`terrainBlocksPath`, fliers exempt)
                    and a shot across one (`rangedCanSee`). */}
                <b>The terrain</b> — a Point's citadel is solid: nothing can stand on it,
                only FLYING cards pass over it (everything else goes round), and it
                stops any ranged basic attack that would cross it, so the squares behind
                a citadel are cover.{WELL && (
                  <>
                    {" "}The centre of the cross is the <b>Well</b>: stepping onto it
                    mends <b>{WELL.hp}</b> HP at once, and a card standing there at
                    Cleanup heals <b>{WELL.hp}</b> a round for <b>{WELL.rounds}</b> rounds —
                    which keeps running after it steps off.
                  </>
                )} The roads themselves are faster: a move that runs along a lane gets
                one extra step.
              </li>
            </ul>
          </section>

          <section>
            <h3>🏔 Board tips</h3>
            <ul>
              <li>
                <b>🔒 Locked slots</b>: a hatched, padlocked square is a <b>captured Home
                slot</b>. Park an invader on an enemy Home slot and keep it alive to that
                round's Cleanup to capture the slot <i>permanently</i> — nothing can be
                summoned onto it or end a move on it again (cards may still pass through),
                and it can never be won back. Take all of an opponent's Home slots and you
                win outright.
              </li>
              {/* The hill is `isMidRow` — rows 1 and 2, counted from P2's Home row
                  as row 0, at BOTH board sizes. On the 4x4 that is both middle rows;
                  on the 5x5 it leaves out row 3, the one in front of P1's Home, so it
                  is named by number here rather than as "a middle row". */}
              <li><b>King of the Hill</b>: a card standing on a hill row deals +1 DMG —
                or lands one <i>extra hit</i> instead, if it is a heavy multi-hit card.
                The hill is <b>rows 1 and 2</b>, counted from P2's Home row as row 0 (the
                top row when you play the AI): both middle rows on the 4×4, but on the
                5×5 the middle row and the one on P2's side of it — the row in front of
                P1's Home is not part of it.</li>
              <li>
                <b>Full-lane bonus</b>: hold <i>every slot</i> of a hill row — four on
                the standard board, five on the large one — and
                your <b>entire board</b> gains +1 DMG — and there are two hill rows
                to seize, so a locked-down centre can stack +2 across your army.
              </li>
              <li>Spells are one-shot effects from your spellbook — cast in Prep.</li>
              <li>Tap any card to inspect its full stats, Special, and passives.</li>
              <li><b>Bonus draw</b> — +2 extra cards every <b>fifth</b> round (5, 10, 15…).</li>
            </ul>
          </section>

          <section>
            <h3>💡 Good to know</h3>
            {/* Five rules the engine enforces that nothing else on this page said,
                each checked against the line that enforces it: canAoeRow,
                canSpellHitEnemy and canPlaceWallRow (rules.ts) and the spell-splash
                filter in phases.ts; the home-defence
                reach in canTarget; the status countdown in doCleanupPhase, which
                runs over every status including the ones landed this round; the
                coin in createInitialState and the rotation in doResourcePhase; and
                seedOpeningCurve (state.ts), which the mulligan re-runs. */}
            <ul className="rules-defs">
              <li>
                <b>Their Home row is out of a spell's aim</b> — no spell can be aimed at a
                card or a row there, a spell's splash stops short of it, and no wall can
                be laid on it. Only board-wide sweeps and traps still reach it.
              </li>
              <li>
                <b>Home defence</b> — a ranged card standing on its own Home row can shoot
                any enemy on that same row, however far along it; a nearer enemy in the
                row still screens a farther one.
              </li>
              <li>
                <b>Statuses tick the round they land</b> — every status counts down at that
                round's Cleanup, so a 1-round STUN on a card that has already acted this
                round wears off without costing it anything.
              </li>
              <li>
                <b>Who preps first</b> is a coin flip at the start of the match, and then
                it rotates every round.
              </li>
              <li>
                <b>Your opening hand</b> — and a mulligan redraw — always holds at least{" "}
                {OPENING_CHEAP_MIN} cards costing {OPENING_CHEAP_COST} or less, as long as
                your deck has them.
              </li>
            </ul>
          </section>

          <section>
            <h3>▶️ A turn, step by step</h3>
            <ol className="rules-steps">
              <li>
                {/* Gold is the ramp, not a flat 1 — `poolGainForRound` plus the
                    Home slots stood on (or the Points held, on the 7x7). */}
                <b>Round starts.</b> You gain Gold on the same ramp Magic uses (+1 rising
                to +5), plus 1 for every Home slot you are standing in — or{" "}
                {POI_GOLD} per Point you hold, on the 7×7 — gain Magic (see the table
                above), and draw a card — with a +2 bonus
                draw every fifth round. A draw that would take you over the hand
                cap of <b>7</b> is held, not queued, so a refuel with a full hand
                is partly lost.
              </li>
              <li>
                <b>Prep — you have priority.</b> Spend Gold to summon a Ranger onto a
                glowing Home slot, then move your Tank up into a middle lane (+1 DMG
                for the hill). Cast a Spell if you like. <b>Pass Priority.</b>
              </li>
              <li>
                <b>The AI preps</b>, then passes. Every seat has now passed in a row → the
                Battle begins.
              </li>
              <li>
                <b>Battle — fastest first.</b> Cards act in SP order (21 → 0). Your
                SP-11 Ranger acts early: choose <b>Basic</b>, click a glowing enemy, it
                fires. Later your Tank (SP 5) comes up — choose <b>Special</b> to spend
                Magic on a barrage, spreading picks across two foes, then <b>Fire</b>.
              </li>
              <li>
                <b>Cleanup.</b> BURN/BLEED tick, statuses count down, end-of-round auras
                heal, and Home-slot captures are checked. Then the next round begins.
              </li>
            </ol>
            <p>
              Win the long game by wiping the opponent out, or the short game by parking
              invaders on their Home slots and keeping them alive to Cleanup.
            </p>
          </section>
        </div>

        <button className="lockin rules-done" onClick={props.onClose}>Got it</button>
      </div>
    </div>
  );
}
