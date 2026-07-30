/** In-app rules book — the "How to play" reference reachable from the main menu.
 *  Content tracks How_To_Play_ingame.docx, with every number checked against the
 *  engine before it shipped (magic ramp, pool carryover, deck + spellbook caps,
 *  capture lockout): objective, deck, resources, the round loop, combat,
 *  shields, speed/movement, elements, statuses, keywords and wins. */
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
            <p>Command an elemental army on a 4×4 (or 5×5) grid. Win two ways:</p>
            <ul className="rules-defs">
              <li>
                <b>Elimination</b> — leave the opponent with no cards on the board,
                in hand, or in their deck.
              </li>
              <li>
                <b>Slot capture</b> — an invader that survives a full round standing
                on an enemy Home slot captures it <i>permanently</i>. A captured slot
                is locked out for its owner and shows a <b>🔒 padlock</b>: nothing can
                be summoned onto it or moved through it, and it can never be taken
                back. Capture all four and you win.
              </li>
            </ul>
          </section>

          <section>
            <h3>🃏 Your deck</h3>
            <ul className="rules-defs">
              <li><b>4×4 Standard</b> — 18 cards, up to <b>5</b> spells.</li>
              <li><b>5×5 Large</b> — 28 cards, up to <b>8</b> spells.</li>
              <li>
                Every card is <b>unique</b> — no duplicates. Build in the Deck Builder,
                then pick your deck before the match.
              </li>
            </ul>
          </section>

          <section>
            <h3>💠 Resources</h3>
            <p>
              <b>GOLD</b> (your summon pool) pays to <b>summon</b> cards — you gain the
              round number in Gold each round (round 1 → +1, round 2 → +2…), up to +10.
              A card's cost is the number in its top corner.
            </p>
            <p>
              <b>MAGIC</b> pays for <b>Specials</b> and <b>Spells</b>. It speeds up as
              the game goes on:
            </p>
            <ul className="rules-defs">
              <li><b>Rounds 1–5</b> — +1 Magic per round</li>
              <li><b>Rounds 6–10</b> — +2</li>
              <li><b>Rounds 11–15</b> — +3</li>
              <li><b>Rounds 16+</b> — +4</li>
            </ul>
            <p>
              Unspent Gold and Magic carry over, but each pool only banks up to
              <b> 10</b> between rounds — sitting on a huge reserve doesn't work.
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
                <b>Prep</b>: glowing hand cards are affordable — click one, then a
                glowing Home slot to summon (any number per turn). Click a board card,
                then a glowing slot to move (one move per priority turn). Cast Spells
                here too. <b>Pass Priority</b> when done — two passes in a row start
                the battle.
              </li>
              <li>
                <b>Battle</b>: cards act in <b>SP order</b> (fastest first, 15 → 0;
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
                <b>Melee</b> hits adjacent slots; <b>Ranged</b> reaches farther and
                Specials reach the whole board.
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
                whose shields are already at 0.
              </li>
              <li>
                Gain shields from Bore's Exostone (+2 on summon), Leaf's Photosynthesis,
                and many card abilities — they don't refill on their own.
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
                <b>CAN'T ACT</b> — this card can do nothing this turn: either a status
                is stopping it (STUN, SLEEP, a failed PARALYZE roll) or it has no legal
                action — nothing in range and no Special it can afford. It stays in the
                queue and passes.
              </li>
            </ul>
            <ul className="rules-defs">
              <li>
                <b>Who acts first</b> — in battle every card takes its turn in
                <b> SP order, fastest first</b> (the queue counts down 15 → 0). Exact
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
                <b>Speed sets your stride</b> — SP 1–5 move 1 slot, SP 6–10 move 2, and
                SP 11+ (plus FLYING or mounted cards) move 2 <i>and cut corners like a
                chess king</i> — a diagonal counts as one step. PARALYZE caps a card to
                a single step; ROOT and FREEZE stop it dead.
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
            <ul className="rules-els">
              <li><b>Leaf</b> — Photosynthesis: heal + bank shields each round.</li>
              <li><b>Pyro</b> — Scorch: basics apply stacking BURN.</li>
              <li>
                <b>Aqua</b> — Flow Change: on summon, pick a 3-round boost —
                <b> Liquid</b> (+2 DMG), <b>Frozen</b> (+3 shields), or <b>Vapor</b> (+4 SP).
              </li>
              <li><b>Dawn</b> — Awakening: on summon, strike the nearest enemy.</li>
              <li><b>Gale</b> — Zephyr: gains SP each round.</li>
              <li><b>Bolt</b> — Electrify: basics leave a status; +DMG vs statused foes.</li>
              <li><b>Dusk</b> — Midnight Shade: on death, hits back at the killer.</li>
              <li><b>Bore</b> — Exostone: enters play with +2 shields.</li>
            </ul>
          </section>

          <section>
            <h3>🔥 Statuses — damage over time</h3>
            <p>DOTs tick at the end of every round until they wear off.</p>
            <ul className="rules-defs">
              <li><b>BURN</b> — burns HP each round <i>through shields</i>, and melts a shield every tick. Stacks up to 5 (Pyro's Scorch).</li>
              <li><b>BLEED</b> — loses HP each round; stacks (Leaf).</li>
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
              <li><b>PARALYZE</b> — 50% chance to skip its turn, rolled each turn (Bolt).</li>
              <li><b>FREEZE</b> — SP drops to 0 <i>and</i> its damage is halved.</li>
              <li><b>ROOT</b> — SP drops to 0: it can't move and acts last.</li>
              <li><b>MUTED</b> — can't fire its Special.</li>
              <li><b>FRIGHTEN</b> — a fear effect that throws off its positioning.</li>
            </ul>
          </section>

          <section>
            <h3>📉 Statuses — debuffs & marks</h3>
            <ul className="rules-defs">
              <li><b>WEAKEN</b> — deals 25% less damage.</li>
              <li><b>BLIND</b> — its basic attacks have a ~50% chance to miss.</li>
              <li><b>SEAL</b> — cannot be healed while sealed.</li>
              <li><b>ELECTRIFIED</b> — harmless on its own, but Bolt cards deal +2 DMG to <i>any</i> statused foe.</li>
              <li><b>STEALTH / EVASION</b> — also appear as timed <i>buffs</i>: temporary untargetability or dodge.</li>
            </ul>
          </section>

          <section>
            <h3>🏷 Keywords</h3>
            <p>Printed on the card; always on unless a status suppresses them.</p>
            <ul className="rules-defs">
              <li><b>CRIT</b> — a basic has a ~50% chance to <i>double</i> its damage (the target must be unshielded).</li>
              <li><b>PEN</b> — attacks pierce shields and hit HP directly.</li>
              <li><b>BLOCK N</b> — every incoming hit is reduced by N — before shields, and even against PEN.</li>
              <li><b>REFLECT N</b> — returns N damage to whoever attacks it.</li>
              <li><b>EVASION</b> — ~50% chance to dodge each incoming hit.</li>
              <li><b>FLYING</b> — dodges melee entirely (unless the attacker also flies, or a status grounds it).</li>
              <li><b>STEALTH</b> — untargetable until it makes its first attack of the round.</li>
              <li><b>LIFESTEAL</b> — basic attacks heal it for the damage dealt.</li>
              <li><b>DRAIN</b> — LIFESTEAL, and it also steals 1 max HP from the target as it feeds (Dusk).</li>
              <li><b>REGEN N</b> — heals N HP at the end of each round.</li>
            </ul>
          </section>

          <section>
            <h3>🏔 Board tips</h3>
            <ul>
              <li>
                <b>🔒 Locked slots</b>: a hatched, padlocked square is a <b>captured Home
                slot</b>. Park an invader on an enemy Home slot and keep it alive for a
                full round to capture that slot <i>permanently</i> — nothing can be
                summoned onto or moved through it again, and it can never be won back.
                Take all of an opponent's Home slots and you win outright.
              </li>
              <li><b>King of the Hill</b>: a card standing in a middle row deals +1 DMG.</li>
              <li>
                <b>Full-lane bonus</b>: hold <i>all four slots</i> of a middle lane and
                your <b>entire board</b> gains +1 DMG — and there are two middle lanes
                to seize, so a locked-down centre can stack +2 across your army.
              </li>
              <li>Spells are one-shot effects from your spellbook — cast in Prep.</li>
              <li>Tap any card to inspect its full stats, Special, and passives.</li>
              <li><b>Bonus draw</b> — +2 extra cards on rounds 10 and 15.</li>
            </ul>
          </section>

          <section>
            <h3>▶️ A turn, step by step</h3>
            <ol className="rules-steps">
              <li>
                <b>Round starts.</b> You gain Gold equal to the round number, gain
                Magic (see the table above), and draw a card — with a +2 bonus draw
                on rounds 10 and 15.
              </li>
              <li>
                <b>Prep — you have priority.</b> Spend Gold to summon a Ranger onto a
                glowing Home slot, then move your Tank up into a middle lane (+1 DMG
                for the hill). Cast a Spell if you like. <b>Pass Priority.</b>
              </li>
              <li>
                <b>The AI preps</b>, then passes. Two passes in a row → the Battle begins.
              </li>
              <li>
                <b>Battle — fastest first.</b> Cards act in SP order (15 → 0). Your
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
              an invader on their Home slots and holding for a full round.
            </p>
          </section>
        </div>

        <button className="lockin rules-done" onClick={props.onClose}>Got it</button>
      </div>
    </div>
  );
}
