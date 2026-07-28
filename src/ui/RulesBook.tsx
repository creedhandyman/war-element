/** In-app rules book — the "How to play" reference reachable from the main menu.
 *  Content mirrors the game's own mechanics (README "How to play" + the engine
 *  rules): objective, resources, the round loop, combat, statuses and wins. */
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
            <p>
              Command an elemental army on a 4×4 (or 5×5) grid. Win by either
              <b> elimination</b> — leave the opponent with no cards on the board,
              in hand, or in their deck — or by <b>slot capture</b>: an invader that
              survives a full round standing on one of the enemy's four Home slots
              captures it forever. Hold all their Home slots and you win.
            </p>
          </section>

          <section>
            <h3>💠 Resources</h3>
            <p>
              <b>Gold</b> pays to <b>summon</b> cards — you gain the round number in
              Gold each round (round 1 → +1, round 2 → +2…). <b>Magic</b> pays for
              <b> Specials</b> and <b>Spells</b>. A card's cost is the number in its
              top corner.
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
            <h3>🌈 Elements & auras</h3>
            <p>Every card carries its element's passive aura:</p>
            <ul className="rules-els">
              <li><b>Leaf</b> — Photosynthesis: heal + bank shields each round.</li>
              <li><b>Pyro</b> — Scorch: basics apply stacking BURN.</li>
              <li><b>Aqua</b> — Flow Change: on summon, pick a 3-round boost.</li>
              <li><b>Dawn</b> — Awakening: on summon, strike the nearest enemy.</li>
              <li><b>Gale</b> — Zephyr: gains SP each round.</li>
              <li><b>Bolt</b> — Electrify: basics leave a status; +DMG vs statused foes.</li>
              <li><b>Dusk</b> — Midnight Shade: on death, hits back at the killer.</li>
              <li><b>Bore</b> — Exostone: enters play with +2 shields.</li>
            </ul>
          </section>

          <section>
            <h3>🔥 Statuses</h3>
            <p>
              <b>DOTs</b> (BURN / BLEED / SCALD) tick damage each round.
              <b> Control</b> — FREEZE, STUN, PARALYZE, ROOT, SLEEP, MUTED, BLIND,
              WEAKEN — locks a card down, saps its stats, or makes it miss.
              <b> Keywords</b> like CRIT, EVASION, FLYING, LIFESTEAL, BLOCK and REGEN
              are printed on the card.
            </p>
          </section>

          <section>
            <h3>🏔 Board tips</h3>
            <ul>
              <li><b>King of the Hill</b>: a card in a middle row gets +1 DMG.</li>
              <li>Spells are one-shot effects from your spellbook — cast in Prep.</li>
              <li>Tap any card to inspect its full stats, Special, and passives.</li>
            </ul>
          </section>
        </div>

        <button className="lockin rules-done" onClick={props.onClose}>Got it</button>
      </div>
    </div>
  );
}
