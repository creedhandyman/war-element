// Phase reducers + the intent reducer + the advance() driver.
// All reducers clone the incoming state once and mutate only the clone.

import { getDef } from "../data/cards";
import { VOID_GATE, voidPlayerHeadStart } from "../data/void-tower";
import { DOMINATION_HOLD_ROUNDS, DOMINATION_MAJORITY, POI_GOLD, dominationMap, heldCount, poiRing, resolveHolders, poiAt} from "../data/domination";
import { applyFlow, AQUA_TIDE_EVERY, AQUA_TIDE_MAX, ARC_DISCHARGE_DIVISOR, DUSK_DRAIN, DAWN_SP_CAP, DAWN_STRIKE_DIVISOR, EXOSTONE_DEFAULT, EXOSTONE_SHIELDS, type FlowMode, GALE_SP_CAP, hasArcDischarge, hasElementAura, LEAF_SHIELD_CAP, MISTY_FOG_MISS_PCT } from "./auras";
import {
  applyShove, applyStatus, applyTimedBuff, basicAttack, chargeForward, matchesVsTarget, checkLowHpTransform, defeatCard, directDamage, drainMaxHp, effectiveBasicHits, fireCardSpecial, fireElectrifiedVolley, label, noteDamageFx, onEnemySide, payAttackTrade, pushBack, rowAhead, spellHit, TARGETLESS_HANDLERS, tickDamage, SPECIAL_HANDLERS } from "./combat";
import { getSpell } from "./spells";
import { creditCapture } from "./stats";
import { coin, randInt } from "./rng";
import {
  applyMulligan,
  boardCards,
  cardAt,
  chebyshev,
  drawCards,
  effectiveDmg,
  effectiveSp,
  fieldBonus,
  gainMaxHp,
  hasCaptureWin,
  hasStatus,
  auraShieldBonus,
  effectiveMaxHp,
  healCard,
  homeSlotsHeld,
  isEliminated,
  manhattan,
  spawnTokens,
  summonCard, enemyCards } from "./state";
import {
  basicIsInert,
  canCastSpell,
  canFireSpecial,
  effectiveSpecialCost,
  canFireTalent,
  canMove,
  shoveTarget,
  canSummon,
  canTarget,
  defaultCommandPicks,
  forwardAreaTargets,
  isActionBlocked,
  openHomeSlots,
  RANGED_REACH,
  specialTargets,
  spellCommandTargets,
  talentTargets,
  summonLandingRow,
  validTargets,
  domMap,
  corridorDir,
} from "./rules";
import type {
  EnchantMode,
  CardDef,
  CardInstance,
  Element,
  GameState,
  Intent,
  PlayerId,
  SpellDef,
  StatusKind,
  WallState,
  Pos,
} from "./types";
import {
  HAND_CAP,
  bossHeldHome,
  isMidRow,
  DEFAULT_SPECIAL_COOLDOWN,
  MAX_ROUNDS,
  VOID_TOWER_ROUNDS,
  NEGATIVE_STATUSES,
  OPENING_COST_CAP,
  poolGainForRound,
  POOL_CARRYOVER_CAP,
  enemyOf,
  seatsOf,
  homeRow,
  VOID_BOSS_INCOME,
  OVERRUN_HOLD_ROUNDS,
} from "./types";
import { chooseBattleAction, aiMulligan, aiPrepIntent } from "./ai";

function clone(state: GameState): GameState {
  return structuredClone(state);
}

/** Per-turn magic gain scales in 5-round brackets: rounds 1–5 give +1/turn,
 *  6–10 give +2, 11–15 give +3, and 16+ give +4 — so the endgame ramps fuel for
 *  Specials/spells. (Round 1 grants nothing; each side opens with a pool of 3.) */

// ── intent reducer ──────────────────────────────────────────────────────────

/** Apply one player intent. Throws on illegal intents (UI should pre-check via rules). */
export function applyIntent(state: GameState, intent: Intent): GameState {
  const draft = clone(state);
  switch (intent.type) {
    case "MULLIGAN": {
      if (draft.phase !== "mulligan") throw new Error("Not the mulligan phase");
      applyMulligan(draft, intent.player, intent.returnHandIds);
      return draft;
    }
    case "SUMMON": {
      const check = canSummon(draft, intent.player, intent.handId, intent.col, intent.row);
      if (!check.ok) throw new Error(`Illegal summon: ${check.reason}`);
      const p = draft.players[intent.player];
      const hand = p.hand.find((h) => h.handId === intent.handId)!;
      const def = getDef(hand.defId);
      p.hand = p.hand.filter((h) => h.handId !== intent.handId);
      // The opening placement is free — that is the whole of the head start.
      if (!draft.opening) p.gold -= def.cost;
      // The row is RESOLVED, not assumed: normally the home row, and the nearest
      // open slot up the column when the home row has been taken entirely. See
      // `summonLandingRow` — canSummon approved exactly this square.
      // A shrine names its own square; everything else resolves to a column.
      const landing = intent.row
        ?? summonLandingRow(draft, intent.player, intent.col)
        ?? homeRow(intent.player, draft.boardSize);
      const inst = summonCard(draft, intent.player, hand.defId, {
        row: landing as Pos["row"],
        col: intent.col,
      });
      // ...and it arrives MUTED if its side's network is down (Total Network
      // Control). Applied here rather than only at cast time, which is the whole
      // point of the lock: summoning past it was the old counterplay.
      const lock = p.networkLockUntilRound ?? -1;
      if (lock >= draft.round) {
        applyStatus(draft, inst, "MUTED", lock - draft.round + 1, 0, def.element);
        draft.log.push(`${def.name} boots up with no signal — MUTED.`);
      }
      if (!draft.humans.includes(intent.player)) inst.autoMode = "full";
      // A human's remembered default for this card, if they set one. After the
      // AI line on purpose: an AI-controlled seat is always full-auto and no
      // stored preference should be able to talk it out of that.
      else if (intent.autoMode) inst.autoMode = intent.autoMode;
      if (draft.opening) draft.opening[intent.player] = (draft.opening[intent.player] ?? 0) - 1;
      draft.prep!.consecutivePasses = 0;
      // Named from what LANDED, not from what was played. Both players read this
      // log, so a disguised card that announces its true name here is not
      // disguised at all — the board showed a Butler while the log said
      // "P1 summons Nightfang", which is the only place the trick leaked. Same
      // reasoning the trap line already uses: a hidden thing the opponent can
      // read out of the log is not hidden.
      const shown = getDef(inst.defId);
      draft.log.push(
        `${intent.player} summons ${shown.name} (cost ${def.cost}) into column ${intent.col}.`,
      );
      // Seed Roll (Oak): the acorn rolls forward on landing — advance toward the
      // enemy home, one slot at a time, until something blocks it or the edge.
      if (def.summonAdvance && inst.pos) {
        const dir = intent.player === "P1" ? -1 : 1;
        let rolled = 0;
        while (rolled < def.summonAdvance && inst.pos) {
          const nextRow: number = inst.pos.row + dir;
          if (nextRow < 0 || nextRow >= draft.boardSize) break;
          if (cardAt(draft, nextRow, inst.pos.col) || draft.slots[nextRow][inst.pos.col].capturedBy) break;
          inst.pos = { row: nextRow as Pos["row"], col: inst.pos.col };
          rolled++;
        }
        if (rolled > 0) draft.log.push(`${def.name} rolls forward ${rolled} slot(s) on summon.`);
      }
      // Wild Charge — the un-blockable cousin of the roll above. Wired here as
      // well as at the token-spawn site so a hand-summoned card could carry it;
      // today only the Golden Bull does, and it arrives as a token.
      if (inst.pos) chargeOnArrival(draft, inst);
      // A trap springs on ARRIVAL, however the card arrived. Nightbriar's
      // Predator's Snare marks the slot its prey fell on, and a slot the enemy
      // wants back is exactly the slot they will summon into — so a trap that
      // only answered movement could be walked around by simply placing a body
      // on it instead. Runs AFTER summonAdvance (the card may have rolled off
      // the trapped square) and BEFORE the onSummon passive and the
      // onOppSummon reactions, both of which already guard on the newcomer
      // still existing.
      triggerTrapOnMove(draft, inst, "is summoned onto");
      // …except they did not. Only the onOppSummon loop below ever checked.
      // Everything between here and there is the newcomer's ARRIVAL pipeline —
      // its on-summon Special, its stat scaling, its token spawns, its element
      // aura — and a card the trap just killed is already off the board. It was
      // still attacking, still scaling, still spawning. One flag, read at each
      // step, rather than a wrapping block: the indentation churn would have
      // buried the change.
      const arrived = !!draft.cards[inst.instanceId] && inst.curHp > 0;
      // Elemental Fury (Prism): lands with its Special already charged. OUTSIDE
      // the onSummon block below — Prism has no onSummon, so nesting it there
      // meant the passive never fired at all.
      if (arrived && def.startsWithFreeSpecial) inst.freeSpecial = true;
      // Fog Settlement (Misty): the owner's battlefield fogs over on summon —
      // thinner than a paid Smog, because this one costs nothing to lay.
      if (arrived && def.summonFog) {
        draft.players[inst.owner].foggedRounds = def.summonFog;
        draft.players[inst.owner].foggedPct = MISTY_FOG_MISS_PCT;
      }
      // On-summon passive: fires immediately, free, via the handler registry.
      // `spread` (columns each side) uses the forward-area projection — the
      // blast reaches toward the enemy battlefield as far as the card's range
      // allows and hits the side columns; without it, targets are unscoped.
      if (arrived && def.onSummon) {
        const os = def.onSummon;
        const params = os.params ?? {};
        // Its own Special, free, on arrival — see `castsOwnSpecial`. Before the
        // handler branches below, because it replaces them rather than joining
        // them: a card that casts its Special on landing has said everything it
        // is going to do on landing.
        if (os.castsOwnSpecial) fireCardSpecial(draft, inst);
        if (os.handler && os.targetSide === "ally") {
          // Ally-buff on summon (Smith Reforged / Duster Dust Off).
          applyAllyOnSummon(draft, inst, os.handler, params);
        } else if (os.handler) {
          const targets =
            // Wildfire (Scorch): a ZONE, not an attack — it sets the enemy home
            // row alight from wherever it stands. Sourced here rather than
            // filtered from validTargets, because the Home Slot rule blocks a
            // card in its OWN home row from targeting the enemy's at all, so
            // the normal list comes back empty and the effect never fired.
            Number(params.enemyHomeRow ?? 0) > 0
              ? enemyCards(draft, inst.owner).filter(
                  (e) => e.curHp > 0 && e.pos?.row === homeRow(enemyOf(inst.owner), draft.boardSize),
                )
            // Back-ups (Saltjacks): a LINE down its own column, and the same
            // ZONE argument as Wildfire above — so it is sourced from the board
            // for the same reason, and this is the bug that reasoning was
            // written for and then not applied to.
            //
            // Saltjacks summons into its own home row and shoots down its
            // column. The Home Slot rule blocks a home-row card from targeting
            // the enemy's home row, so validTargets came back empty whenever the
            // foe in that column was standing on its home row — and an empty
            // list means the `picked.length > 0` gate below never calls the
            // handler at all. Not a weaker shot: NO shot, and no log line
            // either. Worst of all in the opening, where every enemy card is on
            // its home row by definition and a cost-1 body is most likely to be
            // played.
            //
            // barrage re-filters by column itself, so this is idempotent — it
            // widens what reaches the handler, it does not change what is hit.
            : Number(params.sameColumn ?? 0) > 0 && inst.pos
              ? enemyCards(draft, inst.owner).filter(
                  (e) => e.curHp > 0 && e.pos?.col === inst.pos!.col,
                )
            : Number(params.spread ?? -1) >= 0
              ? forwardAreaTargets(draft, inst, Number(params.spread), params.forwardDepth != null ? Number(params.forwardDepth) : undefined)
              // No spread → every enemy in normal targeting range. For a melee
              // card that's king's-move reach (the 8 adjacent tiles). `false` =
              // not a basic attack, so a Ranged card's on-summon burst keeps its
              // full-board reach instead of being cut to the queen line.
              // A charging on-summon aims as far as it can travel, for the same
              // reason a charging Special does: the list is measured from the
              // home row it just landed in, and a Melee card standing there can
              // see nothing, so the ability never ran and the charge never
              // happened. ThunderCat's arrival pounce did nothing for exactly
              // this reason.
              : validTargets(
                  draft, inst.instanceId, false,
                  Number(params.chargeFirst ?? 0) > 0 ? Number(params.charge ?? 0) : 0,
                );
          // Dragon's Bane ambush (Drakonbane): a hunter pounces its prey wherever
          // it stands, so this scans the WHOLE board for a bane-worthy enemy and
          // strikes the NEAREST — the same reach DAWN's own Awakening aura uses,
          // and NOT the melee king's-reach `targets` above. Gated on melee
          // adjacency it effectively never fired: Drakonbane lands on its home
          // row and a big enemy is rarely sitting next to it at summon. Still
          // exists only when there IS something worth ambushing (the filter).
          const picked = Number(params.onlyVsTarget ?? 0) > 0
            ? enemyCards(draft, inst.owner)
                .filter((t) => t.curHp > 0 && matchesVsTarget(def, t) && t.pos != null)
                .sort((a, b) => manhattan(inst.pos!, a.pos!) - manhattan(inst.pos!, b.pos!))
          // reachNearest (Sticks' Boon Striker): pounce the NEAREST enemy
          // anywhere, same as the bane path but unfiltered. Gated on melee
          // king's-reach it almost never fired — Sticks lands on its home row
          // and a foe is rarely adjacent, so the sap "did nothing" on summon.
            : Number(params.reachNearest ?? 0) > 0
            ? enemyCards(draft, inst.owner)
                .filter((t) => t.curHp > 0 && t.pos != null)
                .sort((a, b) => manhattan(inst.pos!, a.pos!) - manhattan(inst.pos!, b.pos!))
            : targets;
          // Most on-summon handlers are attacks, so no target means nothing to
          // do. But a few do not aim at anything — `spawn` drops a token beside
          // the summoner — and gating those on `picked.length` meant they
          // silently did NOTHING whenever no enemy was in range. That is the
          // whole of "sometimes Zipp doesn't spawn the drone": summon it on an
          // empty board, or with the enemy line out of reach, and Swarm Deploy
          // never ran. Volta's Rodd had the same hole, and so did Tide's Surf's
          // Up and Plaguecrow/RedRaven's Special lock — both of which print an
          // unconditional effect ("heals all allies", "opponents cannot use
          // their Specials") while being gated on a melee-reach enemy.
          //
          // The list now lives next to the handlers, because that is where the
          // fact belongs and keeping it here is how it went stale twice.
          if (picked.length > 0 || TARGETLESS_HANDLERS.has(os.handler)) {
            const targets = picked;
            const handler = SPECIAL_HANDLERS[os.handler];
            if (!handler) throw new Error(`Unknown onSummon handler: ${os.handler}`);
            draft.log.push(`${def.name}'s on-summon passive triggers!`);
            handler(draft, inst, targets, params);
          }
        }
        // A self-buff status on summon (Frostveil's Icy Mist — STEALTH for N rounds).
        if (os.selfStatus) {
          applyStatus(draft, inst, os.selfStatus, os.selfStatusDuration ?? 1, 0, def.element);
        }
      }
      // Brightest Warrior (Radiance): scale off the strongest opponent on summon.
      if (arrived && def.summonScaleFromEnemy) {
        const cfg = def.summonScaleFromEnemy;
        const topHp = enemyCards(draft, inst.owner).reduce(
          (m, e) => Math.max(m, effectiveMaxHp(draft, e)),
          0,
        );
        const n = Math.floor(topHp / cfg.per);
        if (n > 0) {
          if (cfg.maxHp) inst.curHp += gainMaxHp(inst, n * cfg.maxHp);
          if (cfg.dmg) inst.dmgBonus += n * cfg.dmg;
          draft.log.push(`${def.name} draws power from the strongest foe (+${n * (cfg.maxHp ?? 0)} HP, +${n * (cfg.dmg ?? 0)} DMG).`);
        }
      }
      // Radiant Court (Imperator): scale off the army already standing.
      if (arrived && def.summonScaleFromKin) {
        const cfg = def.summonScaleFromKin;
        const court = boardCards(draft, inst.owner).filter(
          (a) =>
            a.instanceId !== inst.instanceId &&
            a.curHp > 0 &&
            (!cfg.element || getDef(a.defId).element === cfg.element),
        ).length;
        if (court > 0) {
          const hp = cfg.maxHp ? gainMaxHp(inst, court * cfg.maxHp) : 0;
          if (hp) inst.curHp += hp;
          if (cfg.dmg) inst.dmgBonus += court * cfg.dmg;
          draft.log.push(
            `${def.name} rises before ${court} ${cfg.element ?? "ally"}${court > 1 ? "s" : ""}`
            + `${hp ? ` (+${hp} max HP)` : ""}${cfg.dmg ? ` (+${court * cfg.dmg} DMG)` : ""}.`,
          );
        }
      }
      // Token spawns (Trinezer's Reptilian Screech).
      if (arrived && def.summonSpawn) {
        const born = spawnTokens(draft, inst, def.summonSpawn.token, def.summonSpawn.count, def.summonSpawn.adjacentOnly ? 1 : def.summonSpawn.spawnRadius);
        // ...and anything that BOLTS on arrival does it now, from wherever it
        // landed. `spawnTokens` drops a body beside its spawner and returns it;
        // it has no idea the thing it just made intends to leave immediately.
        for (const b of born) chargeOnArrival(draft, b);
      }
      // A permanent element grant already in force covers cards summoned after
      // it resolved — otherwise "for the rest of the game" would quietly mean
      // "for the cards that happened to be out".
      const permOnSummon = draft.players[inst.owner].elementPerm;
      if (permOnSummon && def.element === permOnSummon.element && permOnSummon.sp)
        inst.spBonus += permOnSummon.sp;
      const dmgPerm = draft.players[inst.owner].elementDmgBuff;
      if (dmgPerm && def.element === dmgPerm.element) inst.dmgBonus += dmgPerm.amount;
      if (arrived) applyElementSummonAura(draft, inst);
      // On-opponent-summon reactions: existing enemies zap the newcomer as it
      // enters the battlefield (Cave Guard, Shocker).
      for (const guard of enemyCards(draft, inst.owner)) {
        const gd = getDef(guard.defId);
        if (!gd.onOppSummon || guard.curHp <= 0 || !draft.cards[inst.instanceId]) continue;
        // Drone Sweep (Buzzard): one answer per round, not one per body.
        if (gd.onOppSummon.oncePerRound && guard.oppSummonFiredRound) continue;
        // The flag is spent where the reaction RESOLVES, not here. Set up front,
        // Drone Sweep burned its one answer per round on a summon it could not
        // answer at all — every slot beside the newcomer occupied, so the drone
        // had nowhere to land and the branch fell straight through. The next
        // summon that round, with room beside it, met a Buzzard already spent.
        const spend = () => {
          if (gd.onOppSummon?.oncePerRound) guard.oppSummonFiredRound = true;
        };
        // Burning Bark (Sparky): hop to the closest empty slot adjacent to the
        // newcomer before reacting, chasing fresh arrivals into BURN range.
        if (gd.onOppSummon.chase && inst.pos && guard.pos) {
          let best: { row: number; col: number } | null = null;
          let bestD = Infinity;
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const r = inst.pos.row + dr;
              const c = inst.pos.col + dc;
              if (r < 0 || r >= draft.boardSize || c < 0 || c >= draft.boardSize) continue;
              if (draft.slots[r][c].capturedBy || cardAt(draft, r, c)) continue;
              const d = Math.abs(r - guard.pos.row) + Math.abs(c - guard.pos.col);
              if (d < bestD) { bestD = d; best = { row: r, col: c }; }
            }
          if (best) {
            guard.pos = { row: best.row as Pos["row"], col: best.col };
            draft.log.push(`${gd.name} scurries in beside ${getDef(inst.defId).name}.`);
          }
        }
        // Drone Sweep (Buzzard): rather than moving itself, it launches a drone
        // into the closest empty slot beside the newcomer, and THAT drone makes
        // the strike. Handled before the reach gate below on purpose — the drone
        // is adjacent by construction, so Buzzard's own range is irrelevant.
        const droneId = gd.onOppSummon.spawnToken;
        // A STOCK, not just a rate. `oncePerRound` caps the launches per turn
        // and nothing capped the fleet: one a round over a fifteen-round match
        // is fifteen drones, and the only way one leaves the board is dying. The
        // count is of THIS guard's side, so two Buzzards do not share a ceiling
        // — each keeps its own drone up, which is what a per-card cap means.
        const droneCap = gd.onOppSummon.spawnMaxAlive ?? Infinity;
        // PER CARD: counted off what THIS guard launched, not off the side. Every
        // drone is the same token, so a side-wide count would hand two Buzzards
        // one ceiling between them and make the second one dead weight.
        const droneAlive = (guard.spawnedIds ?? []).filter(
          (id) => draft.cards[id]?.curHp > 0 && draft.cards[id]?.defId === droneId,
        ).length;
        if (droneId && droneAlive >= droneCap) continue;
        if (droneId && inst.pos && draft.cards[inst.instanceId]) {
          let best: { row: number; col: number } | null = null;
          let bestD = Infinity;
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const r = inst.pos.row + dr;
              const c = inst.pos.col + dc;
              if (r < 0 || r >= draft.boardSize || c < 0 || c >= draft.boardSize) continue;
              if (draft.slots[r][c].capturedBy || cardAt(draft, r, c)) continue;
              // Never drop a body onto the enemy's own summoning row.
              if (r === homeRow(inst.owner, draft.boardSize)) continue;
              const d = guard.pos ? Math.abs(r - guard.pos.row) + Math.abs(c - guard.pos.col) : 0;
              if (d < bestD) { bestD = d; best = { row: r, col: c }; }
            }
          if (best) {
            spend();
            const drone = summonCard(draft, guard.owner, droneId, { row: best.row as Pos["row"], col: best.col });
            (guard.spawnedIds ??= []).push(drone.instanceId);
            const pName = gd.passiveNames?.onOppSummon ?? gd.name;
            draft.log.push(`${pName}: ${gd.name} launches a ${getDef(droneId).name} beside ${getDef(inst.defId).name}.`);
            if (gd.onOppSummon.dmg && inst.curHp > 0 && draft.cards[inst.instanceId]) {
              const before = inst.curShields + inst.curHp;
              directDamage(draft, drone, inst, gd.onOppSummon.dmg, false, Boolean(gd.onOppSummon.crit), true);
              const dealt = before - (inst.curShields + inst.curHp);
              draft.log.push(`The ${getDef(droneId).name} strafes ${getDef(inst.defId).name} for ${dealt}.`);
            }
          }
          continue; // the drone made the reaction; the guard itself does nothing more
        }
        // Only reacts to a newcomer it can actually reach (in targeting range)
        // — unless the reaction is an aura rather than a strike, which is not
        // aimed at anything and so has nothing to reach. See `boardWide`.
        if (!gd.onOppSummon.boardWide && !canTarget(draft, guard, inst)) continue;
        spend();
        if (gd.onOppSummon.dmg && inst.curHp > 0) {
          // Log it under the passive's name — the generic "hits for N" line reads
          // like an ordinary attack and gives no hint the summon itself triggered
          // it ("my card spawned with 3 damage and nothing explains why"). Measure
          // what actually landed (shields absorb some), then say who did it.
          const before = inst.curShields + inst.curHp;
          directDamage(draft, guard, inst, gd.onOppSummon.dmg, false, Boolean(gd.onOppSummon.crit), true);
          const dealt = before - (inst.curShields + inst.curHp);
          const pName = gd.passiveNames?.onOppSummon ?? gd.name;
          draft.log.push(
            `${pName}: ${getDef(guard.defId).name} strikes ${getDef(inst.defId).name} for ${dealt} as it enters.`,
          );
        }
        const st = gd.onOppSummon.status;
        if (st && inst.curHp > 0 && draft.cards[inst.instanceId])
          applyStatus(draft, inst, st.kind, st.duration, st.power, gd.element);
      }
      // King of the Wild (Leo): existing cards steel themselves when a foe lands
      // — once per round, and the DMG is a one-round boost (no permanent stack).
      for (const guard of enemyCards(draft, inst.owner)) {
        const b = getDef(guard.defId).onOppSummonSelfBuff;
        if (b && guard.curHp > 0 && !guard.kingWildFiredRound) {
          guard.kingWildFiredRound = true;
          // tempShields is what marks a plate as "for the round" — Cleanup
          // subtracts it. Without it the shields were PERMANENT while the DMG
          // beside them expired, and since kingWildFiredRound re-arms every
          // round, Leo simply accumulated +2 a round for the whole match off a
          // passive that prints "for the round".
          guard.curShields += b.shields;
          guard.tempShields += b.shields;
          guard.dmgBonusRound += b.dmg; // resets at Cleanup
          draft.log.push(`${getDef(guard.defId).name} rises to the challenge (+${b.shields} shields, +${b.dmg} DMG this round).`);
        }
      }
      // A deferred Flow pick (AQUA) whose card just died to an onOppSummon zap
      // would leave pendingFlow pointing at a corpse — the game would then stall
      // waiting on a choice for a card that no longer exists. Clear it.
      if (draft.pendingFlow && !draft.cards[draft.pendingFlow]) draft.pendingFlow = null;
      return draft;
    }
    case "MOVE": {
      const check = canMove(draft, intent.player, intent.instanceId, intent.to);
      if (!check.ok) throw new Error(`Illegal move: ${check.reason}`);
      const card = draft.cards[intent.instanceId];
      const fromRow = card.pos ? card.pos.row : -1;
      // Stomp (Bootlegger) reads BOTH sides of the step, so it fires on the
      // crossing itself rather than every time it shuffles around enemy ground.
      const wasOnEnemySide = onEnemySide(card, draft.boardSize);
      // Trample Through (WarPhant): stepping onto a weaker enemy drives it back
      // a square first, then the mover takes the slot. Resolved from the same
      // helper canMove used to approve it, so the two cannot disagree about
      // which square the victim ends on.
      const shove = shoveTarget(draft, card, intent.to);
      if (shove) {
        draft.log.push(
          `${getDef(card.defId).name} bulls ${getDef(shove.victim.defId).name} back to r${shove.dest.row}c${shove.dest.col}.`,
        );
        applyShove(draft, card, shove); // ...and CRUSHES it, if it crushes
      }
      // Stepping onto your own home row starts it earning — say so immediately
      // rather than leaving the player to notice next Resource phase.
      if (intent.to.row === homeRow(intent.player, draft.boardSize) && fromRow !== intent.to.row)
        card.fxCoin = (card.fxCoin ?? 0) + 1;
      card.pos = { ...intent.to };
      draft.prep!.movedThisTurn = true;
      card.movedThisRound = true; // Swamp Monster: moving gives up the muck
      // Power Grab (General): a move cycles to the next Basic Attack Weapon,
      // once per round. (The doc's per-weapon ⚡ cost is simplified out.)
      {
        const gd = getDef(card.defId);
        if (gd.weaponModes && !card.weaponSwitchedRound) {
          const next = ((card.weaponMode ?? 0) + 1) % gd.weaponModes.length;
          card.weaponMode = next;
          card.weaponSwitchedRound = true;
          draft.log.push(`${gd.name} racks its ${gd.weaponModes[next].name} (${gd.weaponModes[next].dmg}×${gd.weaponModes[next].hits}).`);
        }
      }
      draft.prep!.consecutivePasses = 0;
      draft.log.push(
        `${intent.player} moves ${getDef(card.defId).name} to r${intent.to.row}c${intent.to.col}.`,
      );
      // THE WELL drinks the moment you reach it. It used to pay only at Cleanup,
      // which meant a card that walked onto the crossroads under fire could die
      // before the square it fought for did anything for it — the reward for
      // taking the middle arrived after the round that decided whether you kept
      // it. Now the step itself mends you, and the heal-over-time still runs on
      // top (granted at Cleanup, see doCleanupPhase), so the Well pays twice for
      // one visit: 2 now, and 2 a round for 3 rounds after.
      {
        const wm = domMap(draft);
        if (wm?.well && card.curHp > 0
            && intent.to.row === wm.well.at.row && intent.to.col === wm.well.at.col) {
          const got = healCard(draft, card, wm.well.hp, card);
          if (got > 0) draft.log.push(`${label(draft, card)} drinks deep at the Well (+${got} HP).`);
        }
      }
      triggerTrapOnMove(draft, card); // a hidden mine on the destination square
      triggerWallsOnMove(draft, card, fromRow); // crossing INTO/OVER an enemy Wall's row hurts
      // War Ready (WarPhant): armour plates up as it reaches the contested
      // middle. Crossing-gated like Stomp — shuffling between two mid rows is
      // not a shield farm.
      const ready = getDef(card.defId).onEnterMidRow;
      if (ready && card.curHp > 0 && !isMidRow(fromRow) && isMidRow(card.pos!.row)) {
        card.curShields += ready.shields;
        draft.log.push(`${getDef(card.defId).name} braces for the middle (+${ready.shields} shield).`);
      }
      // Sky Scout (Sightwing): reaching the middle lets the team's basics clip an
      // extra adjacent target for the round.
      if (getDef(card.defId).skyScout && card.curHp > 0 && !isMidRow(fromRow) && isMidRow(card.pos!.row)) {
        draft.players[card.owner].basicSplashRounds = 1;
        draft.log.push(`${getDef(card.defId).name} scouts the field — allies' shots spread this round.`);
      }
      const stomp = getDef(card.defId).onEnterEnemySide;
      if (stomp && !wasOnEnemySide && card.curHp > 0 && onEnemySide(card, draft.boardSize)) {
        // The nearest opponent it can actually reach — a landing that finds
        // nobody simply does nothing.
        const prey = closest(card, enemyCards(draft, card.owner).filter(
          (e) => e.curHp > 0 && canTarget(draft, card, e),
        ));
        if (prey) {
          draft.log.push(`${getDef(card.defId).name} lands hard — ${stomp.dmg} DMG to ${getDef(prey.defId).name}.`);
          card.fxLunge = (card.fxLunge ?? 0) + 1; // telegraph: no battle turn behind it
          directDamage(draft, card, prey, stomp.dmg, Boolean(stomp.pen));
        }
      }
      return draft;
    }
    case "CAST_SPELL": {
      const check = canCastSpell(draft, intent.player, intent.spellId, {
        targetId: intent.targetId,
        row: intent.row,
        col: intent.col, // trap spells target a SLOT, not just a row
        targetIds: intent.targetIds, // Rewire / Full Reroute
        slots: intent.slots,
        mode: intent.mode,
      });
      if (!check.ok) throw new Error(`Illegal spell: ${check.reason}`);
      const p = draft.players[intent.player];
      // Spend an UNSPENT copy — with two of a cheap spell in the book, `find`
      // by id alone re-marked the copy that was already used and the cast came
      // out free.
      const slot = p.spellbook.find((s) => s.defId === intent.spellId && !s.used)!;
      const spell = getSpell(intent.spellId);
      p.magicPool -= spell.cost;
      slot.used = true;
      draft.prep!.consecutivePasses = 0;
      draft.log.push(`${intent.player} casts ${spell.name}.`);
      resolveSpell(draft, intent.player, spell, intent.targetId, intent.row, intent.mode, intent.col, intent.targetIds, intent.slots);
      return draft;
    }
    case "PASS": {
      if (draft.phase !== "prep" || draft.prep?.priority !== intent.player)
        throw new Error("Can't pass now");
      draft.prep.consecutivePasses++;
      draft.log.push(`${intent.player} passes.`);
      // Prep ends when EVERY seat has passed in a row, not when two have. With
      // two seats that is the same number it always was; with four it is the
      // difference between a round ending and a round ending early because the
      // two players sitting opposite each other happened to pass together.
      if (draft.prep.consecutivePasses >= seatsOf(draft).length) {
        if (draft.opening) endDeployment(draft);
        else startBattle(draft);
      } else {
        draft.prep.priority = nextSeat(draft, intent.player);
        // Movement stays locked for the whole of deployment.
        draft.prep.movedThisTurn = !!draft.opening;
      }
      return draft;
    }
    case "SET_AUTO": {
      const card = draft.cards[intent.instanceId];
      if (!card || card.owner !== intent.player) throw new Error("Not your card");
      card.autoMode = intent.mode;
      return draft;
    }
    case "SURRENDER": {
      if (draft.phase === "gameover") return draft;
      draft.win = { winner: enemyOf(intent.player), by: "surrender" };
      draft.phase = "gameover";
      draft.battle = null;
      draft.prep = null;
      draft.log.push(`${intent.player} surrenders — ${enemyOf(intent.player)} wins.`);
      return draft;
    }
    case "FLOW_CHANGE": {
      if (draft.pendingFlow !== intent.instanceId) throw new Error("No pending Flow Change");
      const card = draft.cards[intent.instanceId];
      if (!card || card.owner !== intent.player) throw new Error("Not your card");
      if (draft.pendingFlowAll) {
        // Downpour: one pick, applied to the caster's whole element.
        const el = getDef(card.defId).element;
        const kin = boardCards(draft, card.owner).filter(
          (c) => c.curHp > 0 && getDef(c.defId).element === el,
        );
        for (const c of kin) applyFlow(c, intent.mode as FlowMode);
        draft.pendingFlow = null;
        draft.pendingFlowAll = false;
        draft.log.push(`Downpour re-shapes ${kin.length} ${el} all(y/ies) (${intent.mode}).`);
        openFlowRepick(draft); // hot-seat: the other side may be waiting too
        return draft;
      }
      // The human's SUMMON pick — permanent, matching the AI path above. The
      // Downpour branch a few lines up stays round-scoped on purpose.
      applyFlow(card, intent.mode as FlowMode, true); // the summon pick is PERMANENT
      card.flowMode = intent.mode as FlowMode;        // …and the tide remembers it
      draft.pendingFlow = null;
      draft.log.push(`${getDef(card.defId).name} shifts state (Flow Change).`);
      return draft;
    }
    case "BATTLE_ACTION": {
      if (draft.phase !== "battle" || !draft.battle)
        throw new Error("Not the Battle Phase");
      const activeId = draft.battle.queue[draft.battle.index];
      if (draft.battle.awaitingInput !== activeId || !activeId)
        throw new Error("Not awaiting input");
      const card = draft.cards[activeId];
      if (!card || card.owner !== intent.player) throw new Error("Not your card");
      draft.battle.awaitingInput = null;
      const picks =
        intent.targetIds && intent.targetIds.length > 0
          ? intent.targetIds
          : intent.targetId
            ? [intent.targetId]
            : undefined;
      performBattleAction(draft, activeId, intent.action, picks, intent.mode);
      draft.battle.index++;
      return draft;
    }
  }
}

// ── spells ────────────────────────────────────────────────────────────────────

/** Auto-pick the neediest (lowest HP-ratio) living ally of `element` for a
 *  Spell's support rider. Null if the caster has no such ally. */
/** The ally a support spell lands on when the caster named one. Re-validated
 *  here rather than trusted: the reducer is the authority, and an online
 *  opponent's intent arrives as data. Falls through to `pickSpellAlly` when no
 *  target was named (scripted casts, and the AI's own fallback). */
function namedSpellAlly(
  draft: GameState,
  player: PlayerId,
  element: SpellDef["element"],
  targetId?: string,
): CardInstance | null {
  const named = targetId ? draft.cards[targetId] : undefined;
  if (named && named.owner === player && named.pos && named.curHp > 0 && getDef(named.defId).element === element)
    return named;
  return pickSpellAlly(draft, player, element);
}

function pickSpellAlly(draft: GameState, player: PlayerId, element: SpellDef["element"]): CardInstance | null {
  const allies = boardCards(draft, player).filter(
    (c) => c.curHp > 0 && getDef(c.defId).element === element,
  );
  if (allies.length === 0) return null;
  return allies.slice().sort((a, b) => a.curHp / a.maxHp - b.curHp / b.maxHp)[0];
}

/** Strip up to `n` negative statuses from a card (99 = all). Returns how many. */
function cleanseCard(card: CardInstance, n: number): number {
  let removed = 0;
  card.statuses = card.statuses.filter((s) => {
    if (removed < n && NEGATIVE_STATUSES.includes(s.kind)) { removed++; return false; }
    return true;
  });
  return removed;
}

/** Cleanse every living element ally of the caster (used by damage-kind Judgment). */
function cleanseSpellAllies(draft: GameState, player: PlayerId, element: SpellDef["element"], n: number): void {
  for (const a of boardCards(draft, player))
    if (a.curHp > 0 && getDef(a.defId).element === element) cleanseCard(a, n);
}

/** Resolve a cast Spell's effect. Targeting was already validated by canCastSpell. */
function resolveSpell(
  draft: GameState,
  player: PlayerId,
  spell: SpellDef,
  targetId?: string,
  row?: number,
  mode?: "attack" | "shield",
  col?: number,
  targetIds?: string[],
  slots?: Pos[],
): void {
  if (spell.kind === "wall" && spell.wall && row != null) {
    const wall: WallState = {
      owner: player,
      spellId: spell.id,
      element: spell.element,
      row,
      dmg: spell.wall.dmg,
      status: spell.wall.status,
      push: spell.wall.push,
      stripShields: spell.wall.stripShields,
      allyBuff: spell.wall.allyBuff,
      roundsLeft: spell.wall.rounds,
    };
    draft.walls.push(wall);
    draft.log.push(`${spell.name} rises across row ${row}.`);
    // The wall erupts immediately on the enemies already standing in that row
    // (FLYING cards are above it, same as the movement trigger).
    for (const e of enemyCards(draft, player)) {
      if (!e.pos || e.pos.row !== row || getDef(e.defId).keywords.FLYING) continue;
      applyWall(draft, e, wall);
    }
    return;
  }

  if (spell.kind === "field" && spell.field) {
    // Board-wide terrain: buffs the caster's element allies for a few rounds.
    const { rounds, ...buff } = spell.field;
    // UNSHIFT, not push: every lookup (fieldBonus, fieldStatusExtend,
    // fieldPushBonus) takes the FIRST match, so a cast field has to sit ahead of
    // the standing terrain or paying six magic would do nothing in a region
    // whose terrain already matched your element.
    draft.fields.unshift({ owner: player, spellId: spell.id, element: spell.element, roundsLeft: rounds, ...buff });
    draft.log.push(`${spell.name} blankets the battlefield for ${rounds} rounds.`);
    return;
  }

  // BATTLE COMMANDS (DAWN). Move, then strike, then hand out armour — see the
  // `command` doc in types.ts for why that order is fixed.
  if (spell.command) {
    const c = spell.command;
    // Whoever the caster NAMED, when they named anyone. A capped command is
    // refused without picks (canCastSpell), so in practice this is the manual
    // list; the nearest-first fallback stays for the uncapped orders, which
    // have nothing to name, and as a floor for any path that reaches the
    // reducer without them rather than resolving into a silent no-op.
    const eligible = spellCommandTargets(draft, player, spell);
    const named = (targetIds ?? [])
      .map((id) => eligible.find((a) => a.instanceId === id))
      .filter((a): a is CardInstance => !!a);
    const army = named.length > 0
      ? (c.max != null ? named.slice(0, c.max) : named)
      : defaultCommandPicks(draft, player, spell);
    // Snapshot by id: a strike below can kill a body (REFLECT) or spawn one.
    const ids = army.map((a) => a.instanceId);
    let moved = 0;
    let struck = 0;
    for (const id of ids) {
      const a = draft.cards[id];
      if (!a || a.curHp <= 0 || !a.pos) continue;
      if (c.step) {
        const before = { ...a.pos };
        if (c.step < 0) pushBack(draft, a, -c.step, player);
        else chargeForward(draft, a, c.step);
        if (a.pos && (a.pos.row !== before.row || a.pos.col !== before.col)) moved++;
      }
      if (c.shield) a.curShields += c.shield;
    }
    if (c.strike) {
      for (const id of ids) {
        const a = draft.cards[id];
        if (!a || a.curHp <= 0 || !a.pos) continue;
        const prey = enemyCards(draft, player)
          .filter((e) => e.curHp > 0 && e.pos && canTarget(draft, a, e))
          .sort((x, y) => manhattan(a.pos!, x.pos!) - manhattan(a.pos!, y.pos!))[0];
        if (prey) { basicAttack(draft, a.instanceId, prey.instanceId); struck++; }
      }
    }
    const bits = [
      c.step ? `${moved} moved` : "",
      c.strike ? `${struck} struck` : "",
      c.shield ? `+${c.shield} shield each` : "",
    ].filter(Boolean);
    draft.log.push(`${spell.name}: ${ids.length} answer the order${bits.length ? ` — ${bits.join(", ")}` : ""}.`);
    return;
  }
  if (spell.swapAllies && targetIds && targetIds.length === 2) {
    const a = draft.cards[targetIds[0]];
    const b = draft.cards[targetIds[1]];
    if (a?.pos && b?.pos) {
      const tmp = { ...a.pos };
      a.pos = { ...b.pos };
      b.pos = tmp;
      draft.log.push(`${getDef(a.defId).name} and ${getDef(b.defId).name} swap places.`);
    }
    return;
  }
  if (spell.rerouteCount && targetIds && slots) {
    // Lift them all off the board FIRST, then set them down. Otherwise a card
    // moving into a square its own ally is vacating this same cast would be
    // blocked by a body that is about to leave.
    const movers = targetIds.map((id) => draft.cards[id]).filter((c): c is CardInstance => !!c?.pos);
    for (const m of movers) m.pos = null;
    movers.forEach((m, i) => { m.pos = { ...slots[i] }; });
    draft.log.push(`${player} reroutes ${movers.length} card(s).`);
    return;
  }
  if (spell.reviveAsToken) {
    // ARM it, then fall through so the spell's own damage still resolves — this
    // is a rider on an AoE, not a spell in itself. An early return here meant
    // Wake of the Dead dealt nothing and therefore killed nothing to raise.
    //
    // The baseline is taken BEFORE the damage lands, so kills made by this very
    // cast count toward the harvest, which is what "anything you kill for the
    // rest of this round" has to mean.
    draft.players[player].wakePending = {
      round: draft.round,
      deaths: draft.stats.byPlayer[enemyOf(player)].deaths,
      token: spell.reviveAsToken,
    };
    draft.log.push(`${player} calls on the dead — anything that falls this round answers.`);
  }
  // ABOVE the discount and with no `return`: Recon Ping now carries both, and
  // the discount branch below returns, so a reveal placed after it would never
  // run. Falls through on purpose.
  // Total Network Control: hold the far side down for the duration. The MUTED
  // status above covers everything standing NOW; this covers everything that
  // arrives while the lock lasts.
  if (spell.networkLock) {
    const foe = draft.players[enemyOf(player)];
    foe.networkLockUntilRound = Math.max(
      foe.networkLockUntilRound ?? -1,
      draft.round + spell.networkLock - 1,
    );
    draft.log.push(
      `${player} takes the network down — ${enemyOf(player)} is locked out for ${spell.networkLock} rounds, reinforcements included.`,
    );
  }
  if (spell.revealHand) {
    draft.players[enemyOf(player)].handRevealedUntilRound = draft.round;
    draft.log.push(`${player} pings the network — the opposing hand is exposed this round.`);
    if (!spell.specialDiscountRound) return;
  }
  if (spell.specialDiscountRound) {
    const pl = draft.players[player];
    pl.specialDiscountRound = (pl.specialDiscountRound ?? 0) + spell.specialDiscountRound;
    draft.log.push(`${player}'s Specials cost ${spell.specialDiscountRound} less this round.`);
    if (spell.clearCooldowns) {
      let readied = 0;
      for (const c of boardCards(draft, player))
        if (c.curHp > 0 && c.specialCooldown > 0) { c.specialCooldown = 0; readied++; }
      if (readied > 0) draft.log.push(`${player} overrides ${readied} recharging Special(s) — all ready.`);
    }
    return;
  }
  if (spell.kind === "convert" && spell.gainGold) {
    // The magic was already deducted by the CAST_SPELL intent; this is the
    // other half of the trade. No carryover clamp — that only applies to what
    // survives into the next round, so spending it this round is the point.
    draft.players[player].gold += spell.gainGold;
    draft.log.push(
      `${spell.name} converts ${spell.cost} Magic into ${spell.gainGold} Gold.`,
    );
    return;
  }

  if (spell.kind === "aoe") {
    // Area damage/status: the whole board, one picked row, or the picked row +
    // the one behind it (targeting was validated by canCastSpell).
    const inArea = (e: CardInstance): boolean => {
      if (spell.area === "board") return true;
      if (row == null || !e.pos) return false;
      if (spell.area === "tworows") return e.pos.row === row || e.pos.row === row + 1;
      return e.pos.row === row;
    };
    const targets = enemyCards(draft, player).filter((e) => e.curHp > 0 && inArea(e));
    let drained = 0;
    for (const t of targets) {
      if (spell.dmg) {
        // doubleIf: a target meeting the condition takes 2× (Maelstrom / Tremor / Dawn's Judgment).
        const boosted =
          spell.doubleIf === "noShields" ? t.curShields === 0
          : spell.doubleIf ? hasStatus(t, spell.doubleIf)
          : false;
        spellHit(draft, t, boosted ? spell.dmg * 2 : spell.dmg, Boolean(spell.pen), player);
      }
      const alive = !!draft.cards[t.instanceId] && t.curHp > 0;
      if (alive && spell.status)
        applyStatus(draft, t, spell.status.kind, spell.status.duration, spell.status.power, spell.element);
      // ── Riders the single-target damage tail has always applied and an AREA
      //    spell never could: this branch RETURNS long before that tail, so
      //    every one of these was printed on the card and then did nothing.
      //    Cyclone promised "drop each to 0 SP" and delivered damage only;
      //    Gale Force promised a push and delivered a status only. ──
      if (alive && spell.spDebuff)
        applyTimedBuff(t, 0, -Math.min(spell.spDebuff, effectiveSp(draft, t)), 1);
      if (alive && spell.push) pushBack(draft, t, spell.push, player);
      if (alive && spell.drainMaxHpAll) {
        // NOT the drainMaxHp() helper: that MOVES the max HP onto an attacking
        // card, and an area spell is cast by a player, with no card to move it
        // to. Harvest's text promises only the loss. The 1-max-HP floor is the
        // same one that helper keeps — draining a card out of existence is a
        // different act, and no spell here claims to do it.
        const taken = Math.max(0, Math.min(spell.drainMaxHpAll, t.maxHp - 1));
        if (taken > 0) {
          t.maxHp -= taken;
          t.curHp = Math.min(t.curHp, t.maxHp); // the ceiling drop shrinks its usable pool
          drained += taken;
        }
      }
    }
    draft.log.push(`${spell.name} sweeps ${targets.length} opponent(s)${targets.length ? "" : " — no one in range"}.`);
    if (drained > 0) draft.log.push(`${spell.name} strips ${drained} max HP off the board, permanently.`);
    // ── Ally riders, same story: printed, never run. A cost-10 ultimate that
    //    said it healed the team to full healed nobody. Living element allies
    //    only — a spell does not bolster a corpse. ──
    const kin = () =>
      boardCards(draft, player).filter((c) => c.curHp > 0 && getDef(c.defId).element === spell.element);
    if (spell.allyShieldInArea) {
      // "in those rows" — the SAME area the sweep hit, read off the caster's side.
      const inside = kin().filter(inArea);
      for (const a of inside) a.curShields += spell.allyShieldInArea;
      if (inside.length)
        draft.log.push(
          `${spell.name}: ${inside.length} ${spell.element} ally(s) in the area gain ${spell.allyShieldInArea} shield.`,
        );
    }
    if (spell.allyShield && spell.allAllies) {
      const all = kin();
      for (const a of all) a.curShields += spell.allyShield;
      if (all.length)
        draft.log.push(`${spell.name}: ${all.length} ${spell.element} ally(s) gain ${spell.allyShield} shield.`);
    }
    if (spell.healAlliesFull) {
      let healed = 0;
      for (const a of kin()) healed += healCard(draft, a, effectiveMaxHp(draft, a), player);
      if (healed > 0) draft.log.push(`${spell.name} heals ${spell.element} back to full (+${healed} HP).`);
    }
    if (spell.healAlliesForStatus && spell.status) {
      // "the total BLEED that will be dealt" — power per tick × its duration ×
      // everyone it landed on. healCard clamps at max HP, so a wide board tends
      // to mean "to full" rather than an unbounded number.
      const total = (spell.status.power ?? 0) * spell.status.duration * targets.length;
      let healed = 0;
      if (total > 0) for (const a of kin()) healed += healCard(draft, a, total, player);
      if (healed > 0)
        draft.log.push(`${spell.name} feeds ${spell.element} on ${total} ${spell.status.kind} (+${healed} HP).`);
    }
    // Total Network Control: a permanent discount on the caster's BOLT Specials.
    if (spell.grantElementDmg) {
      // Lands on the CARDS, and is recorded on the player so allies summoned
      // later inherit it too — the spell says "for the rest of the game".
      const n = spell.grantElementDmg;
      const kin = boardCards(draft, player).filter(
        (c) => c.curHp > 0 && getDef(c.defId).element === spell.element,
      );
      for (const c of kin) c.dmgBonus += n;
      draft.players[player].elementDmgBuff = {
        element: spell.element,
        amount: (draft.players[player].elementDmgBuff?.amount ?? 0) + n,
      };
      draft.log.push(
        `${player}'s ${spell.element} allies gain +${n} DMG for the rest of the game (${kin.length} on board).`,
      );
    }
    if (spell.grantElementPerm) {
      const g = spell.grantElementPerm;
      const prev = draft.players[player].elementPerm;
      draft.players[player].elementPerm = {
        element: spell.element,
        sp: (prev?.sp ?? 0) + (g.sp ?? 0),
        shieldPerRound: (prev?.shieldPerRound ?? 0) + (g.shieldPerRound ?? 0),
        healPerRound: (prev?.healPerRound ?? 0) + (g.healPerRound ?? 0),
        drain: prev?.drain || g.drain,
      };
      // The SP half lands on the cards standing now; later arrivals pick it up
      // from the player record when they are summoned.
      if (g.sp) {
        for (const c of boardCards(draft, player))
          if (getDef(c.defId).element === spell.element) c.spBonus += g.sp;
      }
      draft.log.push(`${player}'s ${spell.element} allies are permanently changed.`);
    }
    if (spell.grantBoltDiscount) {
      const p = draft.players[player];
      p.boltDiscount = (p.boltDiscount ?? 0) + spell.grantBoltDiscount;
      draft.log.push(`${player}'s BOLT Specials cost ${spell.grantBoltDiscount} less for the rest of the game (min 1).`);
    }
    return;
  }

  if (spell.kind === "trap") {
    const t = spell.trap;
    if (t && row != null && col != null) {
      draft.traps.push({
        owner: player,
        spellId: spell.id,
        element: spell.element,
        pos: { row, col },
        dmg: t.dmg,
        pen: t.pen,
        status: t.status,
        // The spell's own top-level status is a SECOND payload, not a spare copy
        // of the first — see TrapState.extraStatus.
        extraStatus: spell.status,
        splash: t.splash,
      });
      // Deliberately vague in the shared log: both players read this, and a trap
      // the opponent can locate from the log is not hidden.
      draft.log.push(`${player} sets ${spell.name}.`);
    }
    return;
  }

  if (spell.kind === "heal") {
    // Support spell: heal / shield / +SP / grant a status to a single ally the
    // CASTER aims at, or to EVERY living element ally (allAllies).
    const targets = spell.allAllies
      ? boardCards(draft, player).filter((c) => c.curHp > 0 && getDef(c.defId).element === spell.element)
      : [namedSpellAlly(draft, player, spell.element, targetId)].filter((a): a is CardInstance => a != null);
    if (targets.length === 0) {
      draft.log.push(`${spell.name} fizzles — no ${spell.element} ally.`);
      return;
    }
    const rooted = enemyCards(draft, player).some((c) => hasStatus(c, "ROOT"));
    const healAmt = rooted && spell.allyHealIfRooted ? spell.allyHealIfRooted : spell.allyHeal ?? 0;
    for (const ally of targets) {
      // Cleanse first, then heal — a BURNing card heals at 75% (the PYRO
      // matchup), and a spell that strips the burn shouldn't be taxed by the
      // burn it removes. Matches the `heal` Special handler's ordering.
      if (spell.cleanse) cleanseCard(ally, spell.cleanse);
      if (healAmt > 0) healCard(draft, ally, healAmt, player);
      if (spell.allyShield) ally.curShields += spell.allyShield;
      // Grace's "+1 DMG for the round" — declared on the spell since it was
      // written and read by nothing, so Grace was a plain 5 HP heal.
      if (spell.allyDmgRound) applyTimedBuff(ally, spell.allyDmgRound, 0, 1);
      if (spell.allySp) ally.spBonus += spell.allySp;
      if (spell.allyStatus)
        applyStatus(draft, ally, spell.allyStatus.kind, spell.allyStatus.duration, spell.allyStatus.power, spell.element);
    }
    const who = targets.length === 1 ? label(draft, targets[0]) : `${targets.length} ${spell.element} allies`;
    draft.log.push(`${spell.name} bolsters ${who}.`);
    return;
  }

  if (spell.kind === "choice") {
    // Modal (Chill): SHIELD an auto-picked element ally, or STRIKE an enemy.
    if (mode === "shield") {
      const ally = namedSpellAlly(draft, player, spell.element, targetId);
      if (ally && spell.allyShield) {
        ally.curShields += spell.allyShield;
        draft.log.push(`${spell.name}: ${label(draft, ally)} gains ${spell.allyShield} shield.`);
      } else {
        draft.log.push(`${spell.name} fizzles — no ${spell.element} ally.`);
      }
      return;
    }
    const tgt = targetId ? draft.cards[targetId] : undefined;
    if (tgt) {
      const died = spellHit(draft, tgt, spell.dmg ?? 0, Boolean(spell.pen), player);
      if (!died && draft.cards[tgt.instanceId] && tgt.curHp > 0 && spell.status)
        applyStatus(draft, tgt, spell.status.kind, spell.status.duration, spell.status.power, spell.element);
    }
    return;
  }

  // damage spell
  const target = targetId ? draft.cards[targetId] : undefined;
  if (target) {
    // Read before the hit: Withering Grasp heals "for the damage dealt", and
    // dealt is not the same as swung — BLOCK trims it, and a target on 2 HP
    // absorbs 2 of an 8-damage cut, not 8.
    const hpBefore = target.curHp;
    const died = spellHit(draft, target, spell.dmg ?? 0, Boolean(spell.pen), player);
    const alive = !died && !!draft.cards[target.instanceId] && target.curHp > 0;
    if (alive && spell.status)
      applyStatus(draft, target, spell.status.kind, spell.status.duration, spell.status.power, spell.element);
    if (alive && spell.push) pushBack(draft, target, spell.push, player);
    // Pressure Crush: sap the target's SP for the round (99 = to nothing).
    if (alive && spell.spDebuff)
      applyTimedBuff(target, 0, -Math.min(spell.spDebuff, effectiveSp(draft, target)), 1);
    // Steam Vent: SCALD lands only on a target ALREADY frozen — the card exists
    // to reward having set the freeze up, so it does nothing to a warm target.
    if (alive && spell.statusIfFrozen && hasStatus(target, "FREEZE"))
      applyStatus(draft, target, spell.statusIfFrozen.kind, spell.statusIfFrozen.duration, spell.statusIfFrozen.power, spell.element);
    // Withering Grasp: the damage DEALT is fed straight back to an ally — not
    // the spell's printed number, which is what this used to hand over. It paid
    // the full 8 into an ally when the cut landed for 3, and paid it even when
    // the target was already dying and absorbed almost none of it.
    if (spell.healAllyForDamage) {
      // Clamped at BOTH ends, so overkill is not damage: curHp goes negative on a
      // killing blow, and hpBefore - curHp would have counted the overshoot —
      // an 8-damage cut into a 2 HP body healed the full 8.
      const dealt = Math.max(0, hpBefore) - Math.max(0, target.curHp);
      const ally = dealt > 0 ? pickSpellAlly(draft, player, spell.element) : undefined;
      if (ally) healCard(draft, ally, dealt, player);
    }
    if (alive && spell.drainMaxHp && target.maxHp > 1) {
      const steal = Math.min(spell.drainMaxHp, target.maxHp - 1);
      target.maxHp -= steal;
      target.curHp = Math.min(target.curHp, target.maxHp);
      const ally = pickSpellAlly(draft, player, spell.element);
      if (ally) {
        ally.curHp += gainMaxHp(ally, steal);
        draft.log.push(`${label(draft, ally)} steals ${steal} max HP.`);
      }
    }
  }
  if (spell.allyShield) {
    const ally = pickSpellAlly(draft, player, spell.element);
    if (ally) {
      ally.curShields += spell.allyShield;
      draft.log.push(`${label(draft, ally)} gains ${spell.allyShield} shield.`);
    }
  }
  // Damage-kind cleanse rider (Judgment): tidy up the caster's own element allies.
  // (Support spells cleanse their targets above and return before reaching here.)
  if (spell.cleanse) cleanseSpellAllies(draft, player, spell.element, spell.cleanse);
}

/** A card that MOVED onto an enemy trap sets it off. One square, one time: the
 *  trap is spent whether or not the victim survives.
 *
 *  Runs BEFORE the wall check so a card that walks into a trapped square inside
 *  a walled row takes both, in the order they were laid down. */
function triggerTrapOnMove(draft: GameState, card: CardInstance, arrival = "steps on"): void {
  if (!card.pos) return;
  const i = draft.traps.findIndex(
    (t) => t.owner !== card.owner && t.pos.row === card.pos!.row && t.pos.col === card.pos!.col,
  );
  if (i < 0) return;
  const trap = draft.traps[i];
  draft.traps.splice(i, 1); // spent on trigger, survivor or not
  const name = trap.spellId ? getSpell(trap.spellId).name : (trap.label ?? "a hidden trap");
  draft.log.push(`${label(draft, card)} ${arrival} ${name}!`);
  const victims = [card];
  if (trap.splash) {
    // Inferno Pit: everything of the victim's side packed around the square.
    for (const e of boardCards(draft, card.owner))
      if (e.instanceId !== card.instanceId && e.pos && chebyshev(e.pos, trap.pos) <= 1)
        victims.push(e);
  }
  for (const v of victims) {
    if (!draft.cards[v.instanceId] || v.curHp <= 0) continue;
    const hpBefore = v.curHp;
    if (trap.dmg > 0) spellHit(draft, v, trap.dmg, Boolean(trap.pen), trap.owner);
    for (const st of [trap.status, trap.extraStatus]) {
      if (st && draft.cards[v.instanceId] && v.curHp > 0)
        applyStatus(draft, v, st.kind, st.duration, st.power, trap.element);
    }
    // Dark Hunting LIFESTEAL: the trapper drains the HP the primary victim lost.
    if (trap.lifesteal && trap.sourceId && v.instanceId === card.instanceId) {
      const dealt = Math.max(0, hpBefore - v.curHp);
      const src = draft.cards[trap.sourceId];
      if (src && src.curHp > 0 && dealt > 0) healCard(draft, src, dealt, src);
    }
  }
}

/** A card that MOVED into an enemy Wall's row (row change only) eats it. */
/** Apply one Wall's cross effect to a card: strip shields, deal damage, then
 *  (if it survived) apply the status / push. */
function applyWall(draft: GameState, card: CardInstance, w: WallState): void {
  draft.log.push(`${label(draft, card)} crosses ${getSpell(w.spellId).name}!`);
  if (w.stripShields && card.curShields > 0)
    card.curShields = Math.max(0, card.curShields - w.stripShields);
  const died = spellHit(draft, card, w.dmg, false, w.owner);
  if (died || !draft.cards[card.instanceId] || card.curHp <= 0) return;
  if (w.status)
    applyStatus(draft, card, w.status.kind, w.status.duration, w.status.power, getSpell(w.spellId).element);
  if (w.push) pushBack(draft, card, w.push, w.owner);
}

/** A card that MOVED from `fromRow` to its current row crosses every enemy Wall
 *  whose row lies in that vertical span — so a fast card (reach 2) can't leap
 *  over a wall untouched. FLYING cards soar over walls entirely. */
function triggerWallsOnMove(draft: GameState, card: CardInstance, fromRow: number): void {
  if (!card.pos || getDef(card.defId).keywords.FLYING) return;
  const toRow = card.pos.row;
  for (const w of draft.walls.slice()) {
    if (w.owner === card.owner) continue; // your own wall never hits you
    // crossed if the wall's row is in (fromRow → toRow], i.e. entered or passed.
    const crossed = w.row !== fromRow && (w.row - fromRow) * (w.row - toRow) <= 0;
    if (!crossed) continue;
    applyWall(draft, card, w);
    if (!draft.cards[card.instanceId] || card.curHp <= 0) break;
  }
}

// ── phase transitions ───────────────────────────────────────────────────────

/** DOMINATION: recount every Point, then see whether that has won the match.
 *
 *  Run at the END of a round, once, after everything else has finished moving
 *  and dying — control is a statement about where the board settled, not about
 *  where it was mid-fight.
 *
 *  Returns true when the match is over, so the caller stops. */
function resolveDomination(draft: GameState): boolean {
  const dom = draft.domination;
  const map = dom && dominationMap(dom.mapId);
  if (!dom || !map) return false;

  // Count bodies on each Point's RING. The centre is impassable, so nothing can
  // be standing on it and it needs no special case here.
  const counts = {} as Record<string, { P1: number; P2: number }>;
  for (const poi of map.pois) {
    const tally = { P1: 0, P2: 0, P3: 0, P4: 0 } as Record<PlayerId, number>;
    for (const slot of poiRing(poi)) {
      const occ = cardAt(draft, slot.row, slot.col);
      if (occ && occ.curHp > 0) tally[occ.owner]++;
    }
    counts[poi.id] = tally;
  }
  const before = dom.held;
  dom.held = resolveHolders(map, counts, dom.held);
  for (const poi of map.pois)
    if (dom.held[poi.id] !== before[poi.id] && dom.held[poi.id])
      draft.log.push(`${dom.held[poi.id]} takes ${poi.name}.`);

  // ALL FOUR ends it on the spot — no waiting, no second round to confirm.
  for (const player of seatsOf(draft)) {
    if (heldCount(dom.held, player) === map.pois.length) {
      draft.win = { winner: player, by: "domination" };
      draft.phase = "gameover";
      draft.log.push(`${player} holds every Point — TOTAL DOMINATION!`);
      return true;
    }
  }

  // ...otherwise a MAJORITY has to survive a round. Taking three Points does not
  // win; still holding three after the opponent has had a full turn to break it
  // does. The streak resets the moment the majority slips, so it is a lead that
  // has to be defended rather than a counter that only ever goes up.
  for (const player of seatsOf(draft)) {
    const holds = heldCount(dom.held, player) >= DOMINATION_MAJORITY;
    dom.streak[player] = holds ? dom.streak[player] + 1 : 0;
    if (dom.streak[player] >= DOMINATION_HOLD_ROUNDS) {
      draft.win = { winner: player, by: "domination" };
      draft.phase = "gameover";
      draft.log.push(
        `${player} has held ${heldCount(dom.held, player)} Points for `
        + `${DOMINATION_HOLD_ROUNDS} rounds — the map is theirs!`);
      return true;
    }
    if (holds && dom.streak[player] === 1)
      draft.log.push(`${player} holds the majority — one more round to take it.`);
  }
  return false;
}

/** The seat after `player` in turn order, wrapping. Two seats make this
 *  `enemyOf`; more make it a rotation. */
function nextSeat(state: GameState, player: PlayerId): PlayerId {
  const order = seatsOf(state);
  const i = order.indexOf(player);
  return order[(i + 1) % order.length] ?? player;
}

/** The match hit MAX_ROUNDS. Decide it on progress toward the real win
 *  conditions rather than calling it off: home slots captured first (that IS
 *  the win condition), then cards left standing, then total HP. A null winner
 *  means all three were level — a true draw, and the UI says so. */
function decideOnTime(draft: GameState): void {
  const captured = (p: PlayerId) =>
    draft.slots.flat().filter((s) => s.capturedBy === p).length;
  const standing = (p: PlayerId) => boardCards(draft, p).length;
  const totalHp = (p: PlayerId) => boardCards(draft, p).reduce((n, c) => n + c.curHp, 0);
  // In Domination the Points ARE the win condition, so they are what a timeout
  // is decided on — Home slots cannot even be captured in that mode.
  const points = (p: PlayerId) =>
    draft.domination ? heldCount(draft.domination.held, p) : 0;

  let winner: PlayerId | null = null;
  let reason = "dead level";
  for (const [name, metric] of (draft.domination
    ? [["Points held", points], ["cards still standing", standing], ["total HP", totalHp]]
    : [["home slots captured", captured], ["cards still standing", standing], ["total HP", totalHp]]
  ) as [string, (p: PlayerId) => number][]) {
    const a = metric("P1");
    const b = metric("P2");
    if (a !== b) {
      winner = a > b ? "P1" : "P2";
      reason = `${name} ${Math.max(a, b)}–${Math.min(a, b)}`;
      break;
    }
  }

  draft.win = { winner, by: "timeout" };
  draft.phase = "gameover";
  draft.log.push(
    winner
      ? `Round ${draft.round} — time. ${winner} takes it on ${reason}.`
      : `Round ${draft.round} — time. Dead level: the match is a draw.`,
  );
}

/** §10.6: both sides place their opening board before round one, out of a fixed
 *  budget that does NOT come from the round economy. Implemented as a prep turn
 *  rather than a new phase, so every existing summon rule, intent and piece of
 *  UI keeps working unchanged — the only differences are the budget, the slot
 *  cap, and that nothing may move yet. */
/** Opening deployment is a FREE head start, not a budget: each side leads with
 *  one teammate already on the board and the ordinary game resumes from there.
 *  It was originally a 4-card / 10-gold opening board, which front-loaded far
 *  too much — a whole formation landed before anyone had made a decision. One
 *  card asks the only question worth asking ("who do you lead with?") and leaves
 *  the rest of the match traditional. */
export const OPENING_SLOTS = 1;

/** Can anyone actually place something? A side with no slots, or holding nothing
 *  inside the opening cost ceiling, cannot — and if that is true of BOTH sides
 *  the deployment turn is one where neither player may do anything except pass
 *  it away twice.
 *
 *  Deliberately NOT `canSummon`: that also requires the phase to be "prep" and
 *  the asking player to hold priority, neither of which is true yet when this
 *  runs and only one of which could ever be true of both sides at once. This is
 *  the placement half of the same rules — slots, the cost ceiling, and a home
 *  slot that is free, uncaptured and uncontested (`openHomeSlots`, which is the
 *  same board check canSummon itself runs). */
function anyoneCanDeploy(draft: GameState): boolean {
  for (const player of seatsOf(draft)) {
    if ((draft.opening?.[player] ?? 0) <= 0) continue;
    const affordable = draft.players[player].hand
      .some((h) => getDef(h.defId).cost <= OPENING_COST_CAP);
    if (!affordable) continue;
    if (openHomeSlots(draft, player).length > 0) return true;
  }
  return false;
}

function startDeployment(draft: GameState): void {
  for (const player of seatsOf(draft)) {
    // A summon lands in the home row, which is exactly `boardSize` wide, so a
    // side can never place more than the board can hold.
    draft.opening![player] = Math.min(draft.opening![player] ?? 0, draft.boardSize);
    // The opening hand covers any slot count we grant, so no top-up is needed.
  }
  // Skip the whole phase when there is nothing anyone could do with it. Since
  // the opponent's free placement was removed, that happens whenever the
  // player's opening hand holds nothing at or under the cost ceiling — and a
  // turn whose only legal action is "pass", twice, is a turn worth deleting
  // rather than presenting.
  if (!anyoneCanDeploy(draft)) {
    draft.opening = undefined;
    draft.log.push("— No opening placement available. —");
    startRound(draft);
    return;
  }
  draft.phase = "prep";
  // movedThisTurn starts true and is never reset while `opening` is live, which
  // is what stops either side repositioning before the first round.
  draft.prep = { priority: draft.firstPlayer, consecutivePasses: 0, movedThisTurn: true };
  draft.log.push(
    `— Opening deployment (free): P1 places ${draft.opening!.P1}, P2 places ${draft.opening!.P2}. —`,
  );
}

function endDeployment(draft: GameState): void {
  // Deployment spends no gold, but this stays as a guard: anything that ever
  // seeds gold here would be carried (capped) by the round-1 resource phase and
  // then have the round income added on top of it.
  for (const player of seatsOf(draft)) draft.players[player].gold = 0;
  draft.opening = undefined;
  draft.log.push("— Deployment complete. —");
  startRound(draft);
}

function startRound(draft: GameState): void {
  draft.round++;
  // Wake of the Dead: everything the caster killed during the armed round gets
  // back up on their side. Resolved HERE rather than on death so the count is
  // final — a card that revived (Zombie Husk) and fell again should not pay out
  // twice, and the stats ledger already de-duplicates that for us.
  for (const player of seatsOf(draft)) {
    const pending = draft.players[player].wakePending;
    if (!pending || pending.round >= draft.round) continue;
    // Re-arm while the effect that does the killing is still running, with a
    // FRESH baseline so a body is never harvested twice.
    const left = (pending.roundsLeft ?? 1) - 1;
    draft.players[player].wakePending =
      left > 0
        ? { round: draft.round, deaths: draft.stats.byPlayer[enemyOf(player)].deaths, token: pending.token, roundsLeft: left }
        : undefined;
    const killed = draft.stats.byPlayer[enemyOf(player)].deaths - pending.deaths;
    if (killed <= 0) continue;
    // Spawned around the caster's own home row, like any other token.
    const anchor = boardCards(draft, player)[0];
    if (!anchor) continue;
    const risen = spawnTokens(draft, anchor, pending.token, killed);
    if (risen.length)
      draft.log.push(`${risen.length} of the fallen rise for ${player}.`);
  }
  draft.phase = "draw";
}

function doDrawPhase(draft: GameState): void {
  // Draw 1 each round, with a +2 bonus refuel (draw 3) on rounds 10 and 15.
  const n = draft.round === 10 || draft.round === 15 ? 3 : 1;
  for (const player of seatsOf(draft)) {
    const drawn = drawCards(draft, player, n);
    if (drawn > 0) draft.log.push(`${player} draws ${drawn}.`);
    // A draw cut short by a full hand (not an empty deck) — surface why.
    if (drawn < n && draft.players[player].hand.length >= HAND_CAP)
      draft.log.push(`${player}'s hand is full (${HAND_CAP}) — held the draw.`);
  }
  draft.phase = "resource";
}

/** A round in which literally nothing can happen: an empty board, so nobody has
 *  a card to move or attack with, and nobody can afford to put one down.
 *
 *  This is round 1 of most matches, and it matters more now than it used to.
 *  Income is GOLD_PER_ROUND plus one per home slot held, and an empty board
 *  holds nothing — so a boardless player earns exactly 1 a round rather than the
 *  round number, and a deck whose cheapest card costs 4 sits out four rounds
 *  instead of two. The roll-forward below is what keeps that from being four
 *  rounds of watching nothing happen. In Story Mode, where the deck is whatever
 *  the player has collected rather than a tuned premade, it happens most fights.
 *
 *  Deliberately conservative. A spell that needs no target — a wall, a field, a
 *  trap — IS something to do with an empty board, so an affordable unused one
 *  keeps the round. Skipping a round somebody could have used is much worse than
 *  playing an empty one.
 */
function nothingCanHappen(draft: GameState): boolean {
  if (boardCards(draft).length > 0) return false; // anyone on the board can act
  for (const player of seatsOf(draft)) {
    const p = draft.players[player];
    if (p.hand.some((h) => getDef(h.defId).cost <= p.gold)) return false;
    const targetless = new Set(["wall", "field", "trap", "convert"]);
    if (p.spellbook.some((e) => {
      if (e.used) return false;
      const sp = getSpell(e.defId);
      return sp.cost <= p.magicPool && targetless.has(sp.kind);
    }))
      return false;
  }
  return true;
}

function doResourcePhase(draft: GameState): void {
  // Two independent pools.
  //
  // Two pools, ONE curve, two different reasons to earn.
  //
  // Both now take the same five-round bracket (+1 through +5) so the endgame
  // has fuel. Gold adds one for every home slot you are standing in on top of
  // it, and that bonus is what makes the money positional: the back line funds
  // the front, losing your home row costs you the money to rebuild it, and a
  // card that advances stops paying for itself. The tension runs both ways —
  // parking everything at home is rich, passive, and wins nothing.
  //
  // Gold used to be a FLAT 1 forever while magic climbed, and the two economies
  // pulled apart: by round 12 you could fire Specials freely and barely afford a
  // cheap card every other round, so the board thinned out as the game went long
  // and whoever was ahead on bodies could not be answered. Summoning is what
  // puts pieces back, and it was the one income that never grew.
  //
  // Both pools cap carryover at 10.
  const magicGain = poolGainForRound(draft.round);
  const goldBase = poolGainForRound(draft.round);
  const gains = {} as Record<PlayerId, number>;
  // THE VOID TOWER HEAD START. The boss is placed outside the economy — a
  // 12-cost body standing there on round one, for nothing — while the player is
  // still affording their first card. The player opens with the same gold the
  // boss was handed in body.
  //
  // Paid as round-1 INCOME rather than banked at setup, because gold carries
  // over capped at 10: a 12-gold grant made before the first Resource phase
  // would have two of it quietly shaved off on the way in.
  //
  // Read off the boss actually standing there, so it tracks a recost.
  const headStart = draft.voidTower && draft.round === 1
    ? voidPlayerHeadStart(
        // The boss the player came to FIGHT, not a tamed one they brought with
        // them — `find` takes the first boss-flagged body on the board in either
        // seat, and a tamed ally could be it.
        getDef(boardCards(draft).find((c) => getDef(c.defId).boss && !c.tamed)?.defId ?? "").cost ?? 0)
    : 0;
  for (const player of seatsOf(draft)) {
    const p = draft.players[player];
    // The boss's war chest — see VOID_BOSS_INCOME. Its army is priced as a
    // build-time budget and then charged for again at retail; this is what pays
    // the difference, so the formation actually reaches the board.
    const bossPurse = draft.voidTower && player === "P2" ? VOID_BOSS_INCOME : 0;
    // DOMINATION: the Points pay. A held Point is worth POI_GOLD gold a round —
    // GOLD ONLY — which is what turns holding one from a score into a position:
    // the map funds the army that took it, and losing a Point costs you the
    // income to retake it. It stacks ON TOP of the ordinary flow rather than
    // replacing it (the Home-slot bonus still applies), so the mode is the
    // normal economy plus the objectives.
    const points = draft.domination ? heldCount(draft.domination.held, player) : 0;
    const gain =
      goldBase + homeSlotsHeld(draft, player) + (player === "P1" ? headStart : 0) + bossPurse
      + points * POI_GOLD;
    gains[player] = gain;
    // Show the money being earned, on the card earning it.
    const row = homeRow(player, draft.boardSize);
    for (let col = 0; col < draft.boardSize; col++) {
      const occ = cardAt(draft, row, col);
      if (occ && occ.owner === player) occ.fxCoin = (occ.fxCoin ?? 0) + 1;
    }
    p.gold = Math.min(p.gold, POOL_CARRYOVER_CAP) + gain;
    p.magicPool = Math.min(p.magicPool, POOL_CARRYOVER_CAP) + magicGain;
  }
  // The two sides can now earn different amounts, so the log has to say whose.
  // Every SEAT, not the first two — a four-player round that only reported P1
  // and P2 would leave half the table's income unaccounted for in the log.
  const seats = seatsOf(draft);
  draft.log.push(
    `— Round ${draft.round}: summon `
    + seats.map((p) => `${p} +${gains[p]}`).join(" / ")
    + `, magic +${magicGain}. —`,
  );
  // Roll straight into the next round rather than playing an empty one. The
  // resources are NOT a gift — the round is spent, the clock moves, and the next
  // grant is the one that round would have made anyway. What is skipped is a
  // prep both sides pass and a battle with nothing in the queue.
  if (draft.round < MAX_ROUNDS && nothingCanHappen(draft)) {
    draft.log.push(`Nobody can act — round ${draft.round} passes.`);
    draft.round++;
    doResourcePhase(draft);
    return;
  }
  // Prep initiative ROTATES each round, so nobody keeps the first-mover edge all
  // game. With two seats that is the old alternation exactly — the coin-flip
  // winner on odd rounds, the other on even — and with three or four it walks
  // the seating order instead of bouncing between the first two.
  const order = seatsOf(draft);
  const firstIdx = Math.max(0, order.indexOf(draft.firstPlayer));
  const firstThisRound = order[(firstIdx + (draft.round - 1)) % order.length];
  draft.phase = "prep";
  // Downpour: the tide re-shapes your side every round. Opened HERE, at the top
  // of the round — Flow buffs are round-scoped and wiped in Cleanup, so a
  // re-pick offered at end of round would be erased before it did anything.
  openFlowRepick(draft);
  draft.prep = {
    priority: firstThisRound,
    consecutivePasses: 0,
    movedThisTurn: false,
  };
}

function startBattle(draft: GameState): void {
  draft.phase = "battle";
  draft.prep = null;
  // Electrify auras (Jolt, Velvolt Knight): raise the field as battle BEGINS —
  // so it's live for THIS battle, including cards just summoned in Prep, with no
  // one-round warm-up. (Was an end-of-round tick, which lagged a round: the
  // status was applied only after the battle it was meant to help.)
  for (const card of boardCards(draft)) {
    const st = getDef(card.defId).roundTick?.inRangeStatus;
    if (card.curHp <= 0 || !st) continue;
    const el = getDef(card.defId).element;
    const marked = enemyCards(draft, card.owner).filter((e) => e.curHp > 0 && canTarget(draft, card, e));
    for (const e of marked) applyStatus(draft, e, st.kind, st.duration, st.power, el);
    if (marked.length) draft.log.push(`${label(draft, card)} arcs — ${marked.length} opponent(s) ${st.kind}.`);
  }
  // Speed queue: all cards SP 15→0, ties broken by seeded coin flip.
  //
  // SCENERY IS NOT IN IT. A piece that can never take a turn is skipped here
  // rather than queued and then refused — five Fortress Gates were putting five
  // "CAN'T ACT" rows into every queue, every round, in the one display whose job
  // is to tell the player what is about to happen and in what order.
  const units = boardCards(draft)
    .filter((c) => !getDef(c.defId).noBattleTurn)
    .map((c) => ({
      id: c.instanceId,
      sp: effectiveSp(draft, c),
    }));
  units.sort((a, b) => b.sp - a.sp);
  // coin-flip adjacent ties (repeated passes = a fair-enough shuffle per tie group)
  for (let i = 0; i < units.length - 1; i++) {
    if (units[i].sp === units[i + 1].sp && coin(draft)) {
      [units[i], units[i + 1]] = [units[i + 1], units[i]];
    }
  }
  draft.battle = { queue: units.map((u) => u.id), index: 0, awaitingInput: null };
  draft.log.push(`Battle! Queue: ${units.length} card(s).`);
}

/**
 * Resolve one card's battle action. `picks` is an ordered target selection:
 * a single entry takes the full volley / legacy auto-spread; multiple entries
 * assign one hit (or one barrage strike) per entry, repeats stack.
 */
function performBattleAction(
  draft: GameState,
  instanceId: string,
  action: "basic" | "special" | "skip" | "talent",
  picks?: string[],
  mode?: EnchantMode,
): void {
  const card = draft.cards[instanceId];
  if (!card) return;
  if (action === "skip") {
    draft.log.push(`${label(draft, card)} waits.`);
    return;
  }
  if (action === "talent") {
    const check = canFireTalent(draft, instanceId);
    if (!check.ok) throw new Error(`Can't use Talent: ${check.reason}`);
    const t = getDef(card.defId).talent!;
    card.talentUsed = true;
    card.attackedThisRound = true; // the Talent is this turn's action
    draft.log.push(`${label(draft, card)} uses ${t.name}!`);
    if (t.handler === "loadHits") {
      card.loadedHits += Number(t.params?.hits ?? 0);
      draft.log.push(`${label(draft, card)} loads its darts — next basic fires as ${getDef(card.defId).hits + card.loadedHits}.`);
    } else if (t.handler === "empower") {
      // Self-buff Talent (Stormquill's Glide Rush). Routed through the SHARED handler
      // rather than re-doing the maths here — the old inline copy silently
      // ignored `buffRounds`, so a talent asking for a TEMPORARY buff quietly
      // granted a permanent one. Passes no targets: empower only reads the
      // caster, and talentTargets would be empty for a self-buff anyway.
      SPECIAL_HANDLERS.empower(draft, card, [], t.params ?? {});
    } else {
      // Everything else runs through the shared registry, exactly as a Special
      // does. Before this, a Talent naming any other handler was marked used and
      // then did NOTHING — silently, with no error to notice.
      const handler = SPECIAL_HANDLERS[t.handler];
      if (!handler) throw new Error(`Unknown talent handler: ${t.handler}`);
      const valid = talentTargets(draft, instanceId);
      const chosen = picks?.[0] ? valid.find((v) => v.instanceId === picks[0]) : undefined;
      // Chosen target first, then the rest — multi-target talents spread over
      // whatever else is in range, same ordering the Special path uses.
      const targets = chosen
        ? [chosen, ...valid.filter((v) => v.instanceId !== chosen.instanceId)]
        : valid;
      handler(draft, card, targets, t.params ?? {});
    }
    // A self-status rider, same as Specials get in the branch below — without
    // this a Talent could name selfStatus and be silently ignored.
    const tSelfSt = t.params?.selfStatus;
    if (typeof tSelfSt === "string" && tSelfSt && card.curHp > 0)
      applyStatus(draft, card, tSelfSt as StatusKind, Number(t.params?.selfStatusDuration ?? 1), 0, getDef(card.defId).element);
    return;
  }
  if (action === "special") {
    const check = canFireSpecial(draft, instanceId);
    if (!check.ok) throw new Error(`Can't fire Special: ${check.reason}`);
    const def = getDef(card.defId);
    const special = def.special!;
    const valid = specialTargets(draft, instanceId);
    let targets: typeof valid;
    // AN AIMED CORRIDOR fires ONE way — the way the caster pointed it.
    //
    // `specialTargets` offers every victim in all four corridors on a Domination
    // board so the caster can aim anywhere; firing that whole list is not a
    // corridor, it is a nova down four lanes at once. The FIRST pick names the
    // direction and the lane is rebuilt down it.
    //
    // Keyed on picks[0] and NOT on "exactly one pick arrived", which is how this
    // was written and why it did nothing for the human player: `targets: 99`
    // makes every corridor Special read as a fixed-area AoE in the UI, so the
    // board sent the entire four-way list and sailed past a narrowing that only
    // triggered on a single target. A rule the engine enforces only when it is
    // handed the shape it likes is not a rule, it is a convention — and the AI
    // was the only caller keeping it.
    const fdp = Number(special.params?.forwardDepth ?? 0);
    const aim =
      picks && picks.length > 0 && fdp > 0 && domMap(draft) && card.pos
        ? valid.find((t) => t.instanceId === picks[0])
        : undefined;
    if (aim?.pos && card.pos) {
      const lane = forwardAreaTargets(
        draft, card, Number(special.params?.spread ?? 0), fdp,
        corridorDir(card.pos, aim.pos));
      targets = lane.some((t) => t.instanceId === aim.instanceId)
        ? [aim, ...lane.filter((t) => t.instanceId !== aim.instanceId)]
        : [aim];
    } else if (picks && picks.length > 1) {
      // Explicit multi-selection: one strike per entry, in order.
      const maxPicks = Number(special.params?.targets ?? 1);
      if (picks.length > maxPicks)
        throw new Error(`Too many targets (max ${maxPicks})`);
      targets = picks.map((id) => {
        const t = valid.find((v) => v.instanceId === id);
        if (!t) throw new Error("Illegal Special target");
        return t;
      });
    } else if (picks && picks.length === 1) {
      // Single pick: chosen first, then auto-spread over the rest (AI path).
      const chosen = valid.find((t) => t.instanceId === picks[0]);
      if (!chosen) throw new Error("Illegal Special target");
      targets = [chosen, ...valid.filter((t) => t.instanceId !== picks[0])];
    } else {
      targets = valid;
    }
    // A Talent Special (a demoted Epic's one-shot) is free and consumed forever.
    // A free Special (Volcanon's On-Kill recast) skips the magic cost AND the
    // cooldown, so it's usable the very next round; otherwise pay + recharge.
    const wasFree = card.freeSpecial;
    card.freeSpecial = false; // consume the grant (a fresh kill re-grants it below)
    // Counted for every cast however it was paid for, so a `maxStacks` limit
    // can't be dodged by a free or talent-granted one.
    card.specialCasts += 1;
    if (special.talent) {
      card.talentUsed = true; // once per game — no cost, no cooldown
    } else if (!wasFree) {
      draft.players[card.owner].magicPool -= effectiveSpecialCost(draft, card, special.cost);
      // 1-round floor; a printed longer cooldown overrides (+1 because the
      // current round's Cleanup ticks it once).
      // Rounds a Special must sit out. The +1 is because this same round's
      // Cleanup ticks it down once, so a value of N leaves it unavailable for
      // exactly N rounds after the cast.
      //
      // The DEFAULT is 2. It was 1, which let 160 of the game's 172 Specials
      // fire every other round — cheap ones effectively every turn the magic
      // allowed, which is what made Specials the default action rather than a
      // decision. The twelve cards that declare their own cooldown (3, and
      // Leo's 5) are unaffected.
      card.specialCooldown = (special.cooldown ?? DEFAULT_SPECIAL_COOLDOWN) + 1;
    }
    card.attackedThisRound = true; // STEALTH breaks on any attack
    // Horde (RIP): a MANUALLY fired Special can cost HP as well as magic. This
    // lives on the manual path ON PURPOSE — the Dead Clock's free auto-fire
    // invokes the handler directly and never reaches here, so the clock's payout
    // stays free while pressing the button yourself is paid for in flesh.
    // canFireSpecial refuses a lethal cost unless the Special opts into
    // `selfHpLethal` (RIP's Horde does). The HP is paid HERE, before the
    // handler, but the DEATH is settled after it — a suicide cast has to raise
    // its bodies first, because spawnTokens places them around the spawner and
    // a removed card has no position left to place them around.
    const selfHpCost = Number(special.params?.selfHpCost ?? 0);
    if (selfHpCost > 0) {
      card.curHp -= selfHpCost;
      draft.log.push(`${label(draft, card)} tears off ${selfHpCost} HP to force ${special.name}.`);
    }
    draft.log.push(`${label(draft, card)} fires ${special.name}!`);
    const handler = SPECIAL_HANDLERS[special.handler];
    if (!handler) throw new Error(`Unknown special handler: ${special.handler}`);
    const enemiesBefore = enemyCards(draft, card.owner).length;
    // Volcanic Fury (Valcana): firing the Special vents the accumulated ramp.
    if (getDef(card.defId).onHitRampUntilSpecial && (card.rampDmg ?? 0) > 0) {
      draft.log.push(`${label(draft, card)}'s Volcanic Fury vents (ramp reset).`);
      card.rampDmg = 0;
    }
    handler(draft, card, targets, special.params ?? {});
    // Bounty (Scallywag): an enemy card that reacts to the caster's Special answers
    // with a status on the caster (reactive burn).
    if (draft.cards[card.instanceId] && card.curHp > 0) {
      for (const r of enemyCards(draft, card.owner)) {
        const oes = getDef(r.defId).onEnemySpecial;
        if (r.curHp > 0 && oes) {
          const st = oes.status;
          applyStatus(draft, card, st.kind, st.duration, st.power, getDef(r.defId).element);
          draft.log.push(`${label(draft, r)} answers the Special — ${st.kind} on ${label(draft, card)}.`);
        }
      }
    }
    // Golden Resonance (Lithara): each successful Special use hardens + sharpens.
    const osu = getDef(card.defId).onSpecialUse;
    if (osu && draft.cards[card.instanceId] && card.curHp > 0) {
      card.curShields += osu.shields ?? 0;
      card.dmgBonus += osu.dmg ?? 0;
      if (osu.shields || osu.dmg)
        draft.log.push(`${label(draft, card)} resonates (+${osu.shields ?? 0} shields, +${osu.dmg ?? 0} DMG).`);
      // Super Charger (Burnout): the same trigger, paid in SPEED and rented
      // rather than owned — the chassis over-revs after a cast and settles
      // again. Through applyTimedBuff so it ticks down with every other
      // temporary stat change instead of needing a counter of its own.
      if (osu.sp) {
        applyTimedBuff(card, 0, osu.sp, osu.spRounds ?? 1);
        draft.log.push(`${label(draft, card)} over-revs — +${osu.sp} SP for ${osu.spRounds ?? 1} round(s).`);
      }
    }
    // On Kill → grant a free recast next round (Volcanon's Eruption). Detect a
    // kill by the enemy board shrinking across the handler.
    if (
      special.params?.freeRecastOnKill &&
      draft.cards[card.instanceId] &&
      card.curHp > 0 &&
      enemyCards(draft, card.owner).length < enemiesBefore
    )
      card.freeSpecial = true;
    // Self-buff status on cast (Dive Bomb → STEALTH, Shadow Charge → EVASION,
    // Drilling Quake → re-STEALTH) — for any handler, once per Special.
    const selfSt = special.params?.selfStatus;
    if (typeof selfSt === "string" && selfSt && draft.cards[card.instanceId] && card.curHp > 0)
      applyStatus(draft, card, selfSt as StatusKind, Number(special.params?.selfStatusDuration ?? 1), 0, def.element);
    // Prism's Enchantment: the whole Special is arming a charge. The mode comes
    // from the intent (the player picked it in the modal), defaulting to Sharpen
    // so a headless or scripted cast still does something coherent.
    if (def.enchanter && draft.cards[card.instanceId] && card.curHp > 0) {
      card.enchant = mode ?? "sharpen";
      draft.log.push(`${label(draft, card)} enchants its weapon — ${card.enchant}.`);
      // Cast AND strike: if a foe is in reach, swing right away so the enchant
      // isn't a wasted turn — the basic spends the charge. Otherwise the charge
      // is stored for a future basic. Auto-picks the lowest-HP reachable enemy;
      // the caster chose the enchant mode, not a target.
      const reach = validTargets(draft, card.instanceId);
      if (reach.length > 0) {
        const tgt = reach.slice().sort((a, b) => a.curHp - b.curHp)[0];
        draft.log.push(`${label(draft, card)} strikes at once with its enchanted weapon.`);
        basicAttack(draft, card.instanceId, tgt.instanceId);
      }
    }
    // Meltdown: light the channel. From here the roundTick keeps the attack
    // going every Cleanup until it is broken or paid out.
    if (Number(special.params?.startsChannel ?? 0) > 0 && draft.cards[card.instanceId] && card.curHp > 0) {
      // The opening eruption, free of the per-round HP toll (the cast already
      // paid magic for it), then the channel takes over from next Cleanup.
      const ch = def.roundTick?.channel;
      if (ch) {
        const hit = eruptInRange(draft, card, channelDmg(draft, card, ch.inRangeDmg));
        draft.log.push(`${label(draft, card)} erupts — ${hit} caught in range.`);
      }
      card.channelOn = true;
      draft.log.push(`${label(draft, card)} goes critical — the meltdown continues each round.`);
    }
    // Toxic Eruption: arm the raise-the-dead harvest. Rides on the Special's
    // params rather than a handler so the DOT and the harvest stay independent —
    // the kills it collects are made by the poison over the following rounds,
    // not by the cast itself.
    const raise = special.params?.reviveAsToken;
    if (typeof raise === "string" && raise) {
      draft.players[card.owner].wakePending = {
        round: draft.round,
        deaths: draft.stats.byPlayer[enemyOf(card.owner)].deaths,
        token: raise,
        roundsLeft: Number(special.params?.reviveRounds ?? 1),
      };
      draft.log.push(`${label(draft, card)} seeds the rot — what dies now rises for ${card.owner}.`);
    }
    // Ethereal Trade self-cost on an offensive Special (Phantom Gouge).
    if (special.targetSide !== "ally") payAttackTrade(draft, card);
    // ...and only NOW does a card that paid a lethal HP cost fall. Its effect has
    // fully resolved by this point, which is what makes the trade worth making.
    if (selfHpCost > 0 && draft.cards[card.instanceId] && card.curHp <= 0)
      defeatCard(draft, card, `${special.name} self-cost`);
    return;
  }
  // basic attack — the assignable-hit ceiling includes on-kill / Flow / mid-row
  // hit bonuses, not just the printed count.
  const maxHits = effectiveBasicHits(card);
  const valid = validTargets(draft, instanceId);
  const chosen =
    picks && picks.length > 0 ? picks : valid[0] ? [valid[0].instanceId] : [];
  if (chosen.length === 0) throw new Error("Illegal basic-attack target");
  if (chosen.length > maxHits)
    throw new Error(`Too many targets (this card has ${maxHits} hit(s))`);
  for (const id of chosen) {
    if (!valid.some((t) => t.instanceId === id))
      throw new Error("Illegal basic-attack target");
  }
  basicAttack(draft, instanceId, chosen.length === 1 ? chosen[0] : chosen);
  payAttackTrade(draft, card); // Ethereal Trade self-cost, once per basic attack
}

/**
 * Advance the battle by one queue entry (the next card that is dead/blocked/
 * auto/AI). Returns true if it consumed an entry, false if input is needed
 * or the battle is over.
 */
function stepBattle(draft: GameState): boolean {
  const battle = draft.battle!;
  if (battle.index >= battle.queue.length) {
    doCleanupPhase(draft);
    return true;
  }
  // Re-read speed for everyone who has NOT acted yet. A status applied during
  // this same battle phase changes it — ROOT and FREEZE both drive
  // `effectiveSp` to 0 — and a card that has just been pinned should act last
  // rather than keep the slot it was handed before it was pinned. Evera's
  // Grounded exists to do exactly that and previously did nothing to the order
  // of the round it was cast in.
  //
  // Three properties make this safe to do every step:
  //  - only the tail from `index` on is touched, so nothing that has already
  //    acted can be pulled back in, and nobody is dropped;
  //  - the sort is STABLE, so equal speeds keep the coin-flip order the queue
  //    was built with rather than churning every step;
  //  - it is skipped while `awaitingInput` is set, so the card the player is
  //    currently choosing an action for can never be swapped out from under
  //    them mid-decision.
  if (!battle.awaitingInput && battle.index < battle.queue.length - 1) {
    const spOf = (cid: string) => {
      const c = draft.cards[cid];
      return c && c.curHp > 0 && c.pos ? effectiveSp(draft, c) : -1;
    };
    const tail = battle.queue.slice(battle.index);
    tail.sort((x, y) => spOf(y) - spOf(x));
    battle.queue = [...battle.queue.slice(0, battle.index), ...tail];
  }
  const id = battle.queue[battle.index];
  const card = draft.cards[id];
  if (!card || !card.pos) {
    battle.index++; // died before its turn
    return true;
  }

  // SLEEP is a full skip — only being hit wakes the sleeper (combat.ts).
  if (isActionBlocked(card)) {
    const blocker = card.statuses.find((s) => s.kind === "STUN" || s.kind === "SLEEP");
    draft.log.push(`${label(draft, card)} can't act (${blocker?.kind}).`);
    battle.index++;
    return true;
  }

  // An inert basic (0 DMG, no on-hit effect) doesn't count as an action — a
  // turret like UFO would otherwise stop the round to ask where to aim an
  // attack that cannot do anything.
  const canBasic = !basicIsInert(draft, card) && validTargets(draft, id).length > 0;
  const canSpec = canFireSpecial(draft, id).ok;
  const canTal = canFireTalent(draft, id).ok;
  if (!canBasic && !canSpec && !canTal) {
    draft.log.push(`${label(draft, card)} has no valid action.`);
    battle.index++;
    return true;
  }

  if (!draft.humans.includes(card.owner)) {
    // AI-controlled card.
    const choice = chooseBattleAction(draft, id);
    // A multi-hit basic spreads instead of overkilling one target (see
    // distributeBasicHits); every other action keeps its single chosen target.
    const picks =
      choice.action === "basic" && effectiveBasicHits(card) > 1
        ? distributeBasicHits(draft, card, validTargets(draft, id))
        : choice.targetId
          ? [choice.targetId]
          : undefined;
    performBattleAction(draft, id, choice.action, picks);
    battle.index++;
    return true;
  }

  // Human-controlled card — respects its auto mode:
  if (card.autoMode === "manual") {
    battle.awaitingInput = id;
    return false;
  }
  if (card.autoMode === "full" && canSpec) {
    // Full auto may fire Specials and spend pool: fire if it can kill,
    // otherwise basic attack (mirrors the AI's restraint).
    const choice = chooseBattleAction(draft, id);
    const picks =
      choice.action === "basic" && effectiveBasicHits(card) > 1
        ? distributeBasicHits(draft, card, validTargets(draft, id))
        : choice.targetId
          ? [choice.targetId]
          : undefined;
    performBattleAction(draft, id, choice.action, picks);
    battle.index++;
    return true;
  }
  if (canBasic) {
    // Auto-basic: lowest-HP reachable target it can kill, else lowest HP — and a
    // multi-hit volley spreads its surplus onto fresh targets instead of overkill.
    const targets = validTargets(draft, id);
    performBattleAction(draft, id, "basic", distributeBasicHits(draft, card, targets));
  } else if (canSpec && getDef(card.defId).special?.targetSide === "self") {
    // A card on basic-auto with nothing in reach would otherwise SKIP forever —
    // and for Oakgre that is a trap, because Uprooted (+3 SP) is the only thing
    // that ever unpins a melee card printed at SP 0. It can't reach anyone, so
    // it can't attack; it never fires the buff, so it never moves.
    // Narrow on purpose: a SELF-targeted Special takes no targeting decision
    // away from the player, so firing it for them costs them nothing.
    performBattleAction(draft, id, "special");
  } else {
    // NOTHING TO SWING AT, BUT SOMETHING TO DO — so ask, do not skip.
    //
    // We only reach here when the card has no basic target, and the gate above
    // has already established it has SOME legal action: an off-cooldown Special
    // it can pay for with valid targets, or a Talent. Auto mode used to skip
    // the turn outright, which threw that action away without ever offering it.
    //
    // Sarachnid is the case that surfaced it. Silk Chase is swung by her
    // SPIDERS, so it is legal whenever they can reach somebody — but she is a
    // melee card, and parked one square back she has no target of her own. On
    // auto she logged "Sarachnid waits" every round with a board full of
    // spiders sitting on the enemy line. Anything whose Special reaches further
    // than its own attack has the same shape.
    //
    // Handing it to the player rather than auto-firing is the deliberate half:
    // these are aimed at the board and cost magic, so the choice of target —
    // and of whether to spend at all — stays theirs. Skip is still one tap away
    // on the wheel; what changes is that it is now a decision instead of a
    // default. Auto mode means "attack for me", never "throw the turn away".
    battle.awaitingInput = id;
    return false;
  }
  battle.index++;
  return true;
}

export function pickBasicTarget(
  draft: GameState,
  attacker: CardInstance,
  targets: CardInstance[],
): CardInstance {
  const volley = effectiveDmg(draft, attacker) * effectiveBasicHits(attacker);
  const killable = targets.filter((t) => {
    const tDef = getDef(t.defId);
    const shieldSoak = tDef.keywords.PEN ? 0 : t.curShields; // rough estimate
    return volley - shieldSoak >= t.curHp;
  });
  const pool = killable.length > 0 ? killable : targets;
  // DOMINATION: a body standing on a Point is worth more than one that is not,
  // because killing it takes a number off that ring — and the ring count IS the
  // score. Two bodies of equal health are not equal targets when one of them is
  // the reason you do not hold Point C.
  //
  // Layered UNDER "kill it if you can", not over it: the killable pool is
  // chosen first and this only orders within it. A corpse holds no ground, so a
  // kill anywhere still beats chip damage on an objective.
  return pool.reduce((best, t) => {
    const bw = pointWorth(draft, attacker, best);
    const tw = pointWorth(draft, attacker, t);
    if (tw !== bw) return tw > bw ? t : best;
    return t.curHp < best.curHp ? t : best;
  }, pool[0]);
}

/** What killing this card is worth in Points, to `attacker`'s side.
 *
 *  2 — it is standing on a ring its own side HOLDS: killing it can flip the
 *      Point, which is the whole game.
 *  1 — it is on a ring nobody has taken from us yet: killing it denies a
 *      contest before it starts.
 *  0 — it is not on a Point, or this is not Domination.
 */
function pointWorth(draft: GameState, attacker: CardInstance, target: CardInstance): number {
  const dom = draft.domination;
  const map = dom && dominationMap(dom.mapId);
  if (!map || !target.pos) return 0;
  const poi = poiAt(map, target.pos.row, target.pos.col);
  if (!poi) return 0;
  const holder = dom!.held[poi.id];
  if (holder === attacker.owner) return 0;   // our own Point; the body on it is incidental
  return holder === target.owner ? 2 : 1;
}

/** Spread a MULTI-HIT basic across targets instead of dumping every hit on one.
 *  resolveHit stops the instant a target dies (combat.ts), so a 4×3 volley aimed
 *  at a 2-HP card lands ONE hit and simply LOSES the other three — they don't
 *  carry to the next enemy. This walks the hits, sending each to the best live
 *  target (one this hit can finish, else the lowest-HP), simulating shields/HP so
 *  the surplus flows onto fresh bodies. Returns one id per hit; basicAttack
 *  merges consecutive repeats into a single gated volley. Single-hit basics and
 *  lone targets fall back to the normal one-pick behavior, unchanged. */
export function distributeBasicHits(
  draft: GameState,
  attacker: CardInstance,
  targets: CardInstance[],
): string[] {
  const hits = effectiveBasicHits(attacker);
  if (hits <= 1 || targets.length <= 1)
    return [pickBasicTarget(draft, attacker, targets).instanceId];
  const d = effectiveDmg(draft, attacker);
  const pen = Boolean(getDef(attacker.defId).keywords.PEN);
  const sim = targets.map((t) => ({ id: t.instanceId, hp: t.curHp, sh: pen ? 0 : t.curShields }));
  const out: string[] = [];
  for (let h = 0; h < hits; h++) {
    const live = sim.filter((s) => s.hp > 0);
    // Nothing left to kill in reach → keep the surplus on the lowest-HP body (a
    // single target so it stays one volley; there's no better use for them).
    if (live.length === 0) {
      out.push(sim.reduce((a, b) => (b.hp < a.hp ? b : a), sim[0]).id);
      continue;
    }
    // Prefer a target THIS hit can finish (the lowest such); else the lowest-HP
    // live target so we chip the thing closest to dying.
    const finishers = live.filter((s) => s.hp <= Math.max(0, d - s.sh));
    const src = finishers.length ? finishers : live;
    const pick = src.reduce((a, b) => (b.hp < a.hp ? b : a), src[0]);
    out.push(pick.id);
    const toHp = Math.max(0, d - pick.sh);
    if (pick.sh > 0) pick.sh -= 1;
    pick.hp -= toHp;
  }
  return out;
}

/** Ally-facing on-summon passives (Smith Reforged: shields to the row ahead;
 *  Duster Dust Off: +SP to self and a nearby ally). */
function applyAllyOnSummon(
  draft: GameState,
  caster: CardInstance,
  handler: string,
  params: Record<string, number | string>,
): void {
  const amount = Number(params.amount ?? 0);
  if (amount <= 0 || !caster.pos) return;
  const dir = caster.owner === "P1" ? -1 : 1;
  const aheadRow = caster.pos.row + dir;
  const allies = boardCards(draft, caster.owner).filter((c) => c.instanceId !== caster.instanceId);

  if (handler === "empowerElement") {
    // Trial by Fire (Magmadon): every ally of the caster's OWN element pays 1 HP
    // for a round of +DMG. A tithe, not a gift — and it never takes an ally's
    // last point, so it cannot kill the team it is meant to lift.
    const el = getDef(caster.defId).element;
    const hpCost = Number(params.hpCost ?? 0);
    const kin = allies.filter((c) => c.curHp > 0 && getDef(c.defId).element === el && c.curHp > hpCost);
    for (const a of kin) {
      if (hpCost > 0) a.curHp -= hpCost;
      applyTimedBuff(a, amount, 0, Number(params.rounds ?? 1));
    }
    if (kin.length)
      draft.log.push(
        `${getDef(caster.defId).name} tempers ${kin.length} ${el} ally(ies) — ${hpCost} HP each for +${amount} DMG.`,
      );
    return;
  }
  if (handler === "grantShield") {
    // `nearby` and the +DMG rider are read HERE as well as in the real
    // grantShield handler, because an ally-side on-summon never reaches that
    // handler — this path is a second, thinner implementation of the same
    // ability. It knew only `amount`, so Smith's Reforged ("plate every NEARBY
    // ally, itself included, and stoke them for +1 DMG") shielded the row ahead
    // instead of the ring around it, never shielded Smith, and never granted the
    // DMG at all. Delegating to the real handler instead would have been tidier
    // and wrong: it takes a target list this path has none of, so PolarBear —
    // the only other card here, and one with no `nearby` — would have ended up
    // shielding only itself.
    const nearby = Number(params.nearby ?? 0) > 0;
    const targets = nearby && caster.pos
      ? boardCards(draft, caster.owner).filter(
          (c) => c.curHp > 0 && c.pos && chebyshev(caster.pos!, c.pos) <= 1,
        )
      : allies.filter((c) => c.pos?.row === aheadRow);
    const buffDmg = Number(params.buffDmg ?? 0);
    const buffRounds = Number(params.buffRounds ?? 1);
    for (const t of targets) {
      t.curShields += amount;
      if (buffDmg > 0) applyTimedBuff(t, buffDmg, 0, buffRounds);
    }
    if (targets.length > 0)
      draft.log.push(
        `${getDef(caster.defId).name} reinforces ${targets.length} ally(ies) (+${amount} shields` +
          `${buffDmg > 0 ? `, +${buffDmg} DMG for ${buffRounds}r` : ""}).`,
      );
  } else if (handler === "buffSp") {
    // `rounds` turns the grant TEMPORARY (Whirlwolf's Hastening Breeze is "for
    // the round"); otherwise it's a permanent spBonus as before.
    const rounds = Number(params.rounds ?? 0);
    const grant = (c: CardInstance) => {
      if (rounds > 0) applyTimedBuff(c, 0, amount, rounds);
      else c.spBonus += amount;
    };
    grant(caster);
    if (params.allAllies) {
      // Hastening Breeze (Whirlwolf): the whole team gains speed.
      for (const a of allies) grant(a);
      draft.log.push(`${getDef(caster.defId).name} kicks up speed (+${amount} SP to all allies${rounds ? ` for ${rounds}r` : ""}).`);
    } else {
      // Self + the nearest ally.
      const near = closest(caster, allies);
      if (near) grant(near);
      draft.log.push(`${getDef(caster.defId).name} kicks up speed (+${amount} SP self${near ? " + ally" : ""}).`);
    }
  }
}

/** AI's Flow Change pick: tanks/support shore up, fast strikers gain speed,
 *  everyone else takes damage. */
function aiFlowChoice(cardClass: string): FlowMode {
  if (cardClass === "Tank" || cardClass === "Support") return "ice";
  if (cardClass === "Assassin" || cardClass === "Ranger") return "steam";
  return "water";
}

/**
 * Downpour's per-round Flow re-pick. AI sides resolve instantly; a human side
 * gets the normal Flow prompt, flagged to apply to its whole element.
 *
 * Only ONE prompt can be open at a time (pendingFlow is a single slot), so this
 * stops at the first human that needs one and is called again once that choice
 * resolves — which matters in hot-seat, where both sides can hold a Downpour.
 */
export function openFlowRepick(draft: GameState): void {
  if (draft.pendingFlow) return; // a prompt is already up
  for (const p of seatsOf(draft)) {
    const field = draft.fields.find((f) => f.owner === p && f.flowRepick);
    // One offer per player per round. This function is called again after a
    // choice resolves (to catch the other side in hot-seat), and without the
    // marker it would just re-prompt whoever had only now answered.
    if (!field || field.repickRound === draft.round) continue;
    const kin = boardCards(draft, p).filter(
      (c) => c.curHp > 0 && getDef(c.defId).element === field.element,
    );
    if (kin.length === 0) continue;
    if (!draft.humans.includes(p)) {
      for (const c of kin) applyFlow(c, aiFlowChoice(getDef(c.defId).cardClass));
      field.repickRound = draft.round;
      draft.log.push(`${p}'s Downpour re-shapes ${kin.length} ${field.element} all(y/ies).`);
      continue;
    }
    field.repickRound = draft.round;
    draft.pendingFlow = kin[0].instanceId;
    draft.pendingFlowAll = true;
    return; // one prompt at a time
  }
}

/** Element auras that fire the moment a card is summoned. Runs the card's own
 *  element aura plus any it borrows via `elementAuras` (SirCrest's AQUA Flow
 *  Change on top of his DAWN Awakening). */
function applyElementSummonAura(draft: GameState, inst: CardInstance): void {
  const def = getDef(inst.defId);
  const seen = new Set<Element>();
  for (const el of [def.element, ...(def.elementAuras ?? [])]) {
    if (seen.has(el)) continue;
    seen.add(el);
    applyOneElementSummonAura(draft, inst, def, el);
  }
}

function applyOneElementSummonAura(draft: GameState, inst: CardInstance, def: CardDef, el: Element): void {
  switch (el) {
    case "BORE": { // Exostone — arrival plating, scaled by rarity.
      const plate = EXOSTONE_SHIELDS[def.rarity ?? ""] ?? EXOSTONE_DEFAULT;
      inst.curShields += plate;
      draft.log.push(`${def.name} hardens (Exostone +${plate} shield${plate > 1 ? "s" : ""}).`);
      break;
    }
    case "AQUA": { // Flow Change — a 1-turn choice.
      if (draft.humans.includes(inst.owner)) {
        // Human chooses via the UI; gate until they pick.
        draft.pendingFlow = inst.instanceId;
      } else {
        const aiMode = aiFlowChoice(def.cardClass);
        applyFlow(inst, aiMode, true); // the summon pick is PERMANENT
        inst.flowMode = aiMode;       // …and the tide remembers it
      }
      break;
    }
    case "DAWN": { // Awakening — strike the nearest enemy as it lands.
      // Full DMG, not half. DAWN measured lowest in the game on damage dealt
      // (56 a match against a field of 85-95), and this is the aura that was
      // already pointed at that number. See DAWN_STRIKE_DIVISOR for why the
      // gold-discount routes were measured and abandoned.
      const dmg = Math.floor(def.dmg / DAWN_STRIKE_DIVISOR);
      if (dmg > 0) {
        const foe = closest(inst, enemyCards(draft, inst.owner).filter((c) => c.curHp > 0));
        if (foe) {
          draft.log.push(`${def.name} awakens — ${dmg} DMG to ${getDef(foe.defId).name}.`);
          // Telegraph it: this strike lands the moment the card is placed, with
          // no battle turn behind it, so without a lunge the target just loses
          // HP for no visible reason.
          inst.fxLunge = (inst.fxLunge ?? 0) + 1;
          directDamage(draft, inst, foe, dmg, false);
        }
      }
      break;
    }
  }
}

/** Meltdown's blast: `dmg` to every living opponent in the row directly ahead.
 *  Shared by the Special that lights the channel and by each round the channel
 *  sustains it, so the opening eruption and the ones that follow are the same
 *  effect rather than two implementations that can drift apart. */
function eruptRowAhead(draft: GameState, card: CardInstance, dmg: number): number {
  if (!card.pos || dmg <= 0) return 0;
  const ahead = card.pos.row + (card.owner === "P1" ? -1 : 1);
  const caught = enemyCards(draft, card.owner).filter((e) => e.curHp > 0 && e.pos?.row === ahead);
  for (const e of caught) tickDamage(draft, card, e, dmg, false);
  return caught.length;
}

/** Everything `card` can actually reach, hit for `dmg`. The reach is canTarget's
 *  — the same one roundTick.inRangeDmg uses — so a Melee eruption catches what
 *  is packed around it and a Ranged one carries. Returns how many were caught. */
function eruptInRange(draft: GameState, card: CardInstance, dmg: number): number {
  if (!card.pos || dmg <= 0) return 0;
  const caught = enemyCards(draft, card.owner).filter(
    (e) => e.curHp > 0 && canTarget(draft, card, e),
  );
  for (const e of caught) tickDamage(draft, card, e, dmg, false);
  return caught.length;
}

/** Meltdown's blast strength (Magmadon). Scorched Fury's whole premise is that
 *  the volcano gets angrier the longer it burns — and the eruption is the thing
 *  it is angry WITH. A flat 5 meant every point of self-inflicted bleed bought
 *  a bigger BASIC attack only, while the channel those points are spent
 *  sustaining stayed exactly as hot as the round it was lit. The blast now
 *  carries whatever the card's damage has gained over its printed number: the
 *  round buff, the below-10 fury, an ally's aura, all of it.
 *
 *  Floored at the printed base, so WEAKEN shrinks the swing and not the
 *  mountain — and read fresh each Cleanup rather than banked at cast time,
 *  which is what makes bleeding itself down a plan rather than a cost. */
function channelDmg(draft: GameState, card: CardInstance, base: number): number {
  return base + Math.max(0, effectiveDmg(draft, card) - getDef(card.defId).dmg);
}

/** Resolve every card's periodic (end-of-round) self-driven passive. Runs in
 *  Cleanup after DOT/REGEN and status-duration ticks. */
/** Tribe membership, accepting the multi-tribe form. Local to the pack tick —
 *  `inTribe` in void-tower.ts takes a def id and this takes a live card. */
function inTribeOf(card: CardInstance, tribe: string): boolean {
  const tr = getDef(card.defId).tribe;
  return Array.isArray(tr) ? tr.includes(tribe) : tr === tribe;
}

/** WILD CHARGE: it arrives already running.
 *
 *  Straight up its own column toward the enemy home row, trampling every
 *  ENEMY in the lane for `dmg` PEN and carrying on past. Where it ENDS is the
 *  furthest OPEN square it reached — a body it trampled is still standing on
 *  its own slot, so the bull cannot stop there, but it can stop beyond it, and
 *  it can stop ON it if the trample killed the occupant outright.
 *
 *  It halts for its own side. A stampede that flattened the line it was called
 *  to help would be a drawback wearing a charge's name. */
export function chargeOnArrival(draft: GameState, card: CardInstance): void {
  const charge = getDef(card.defId).summonCharge;
  if (!charge || !card.pos) return;
  const dir = card.owner === "P1" ? -1 : 1;
  const col = card.pos.col;
  let row: number = card.pos.row;
  let landed: number = card.pos.row;
  let trampled = 0;
  for (;;) {
    const next = row + dir;
    if (next < 0 || next >= draft.boardSize) break;
    if (draft.slots[next][col].capturedBy) break;
    const occupant = cardAt(draft, next, col);
    if (occupant) {
      if (occupant.owner === card.owner) break; // it will not run down its own
      directDamage(draft, card, occupant, charge.dmg, true); // PEN — hooves
      trampled++;
      // If that killed it the square is free and the bull may stop there;
      // otherwise it passes over and keeps looking for somewhere to stand.
      if (!cardAt(draft, next, col)) landed = next;
      row = next;
      if (card.curHp <= 0 || !draft.cards[card.instanceId]) return; // died to REFLECT
      continue;
    }
    row = next;
    landed = next;
  }
  if (landed !== card.pos.row) card.pos = { row: landed as Pos["row"], col: col as Pos["col"] };
  if (trampled > 0)
    draft.log.push(`${label(draft, card)} stampedes through ${trampled} opponent(s) (${charge.dmg} PEN each).`);
  else if (landed !== card.pos.row)
    draft.log.push(`${label(draft, card)} bolts for the far side.`);
}
/** Is the enemy still behind a wall?
 *
 *  Two kinds count, because a player can have either: the Void Tower's free
 *  Fortress Gates (real token CARDS seated in the row before their home) and
 *  any spell WALL they raised themselves. A siege engine that walked around
 *  the second kind would be answering the wrong question.
 *
 *  Deliberately not "any card in the way" — that is every fight ever. It is
 *  specifically masonry, which is the thing that falls and lets the giant move.
 */
function enemyWallsStanding(state: GameState, mover: PlayerId): boolean {
  const foe = enemyOf(mover);
  if (state.walls.some((w) => w.owner === foe)) return true;
  return boardCards(state, foe).some((c) => c.curHp > 0 && c.defId === VOID_GATE);
}


function doRoundTicks(draft: GameState): void {
  for (const card of boardCards(draft)) {
    if (card.curHp <= 0) continue;
    // Boom (Doom): wind the fuse; on the final tick, level the enemy board.
    const boomDef = getDef(card.defId).boom;
    if (boomDef) {
      card.boomTimer = (card.boomTimer ?? 0) + 1;
      if (card.boomTimer >= boomDef.afterRounds) {
        const foes = enemyCards(draft, card.owner).filter((c) => c.curHp > 0);
        for (const e of foes) tickDamage(draft, card, e, boomDef.dmg, false);
        draft.log.push(`${label(draft, card)} goes BOOM — ${boomDef.dmg} DMG to all enemies!`);
        defeatCard(draft, card, "detonation");
        continue;
      }
    }
    // DEEP FREEZE's clock. ABOVE the `if (!rt) continue` below, deliberately:
    // this has to run for EVERY card, and while it sat under that guard it only
    // counted for cards that happened to carry a roundTick — so an ordinary body
    // could be frozen for ten rounds and Cryovex would never notice. Caught by
    // its own test.
    //
    // Counting up while held and forgetting the instant it lifts is what makes
    // cleanse the answer: breaking the freeze RESETS the ramp rather than
    // pausing it.
    if (hasStatus(card, "FREEZE")) card.frozenRounds = (card.frozenRounds ?? 0) + 1;
    else if (card.frozenRounds) card.frozenRounds = 0;

    const rt = getDef(card.defId).roundTick;
    if (!rt) continue;
    // firstRoundOnly: fires on the card's first Cleanup after landing, then
    // never again. Can't lean on summonedThisRound — step 4 clears it just
    // before this runs — so the spent state lives on the instance.
    if (rt.firstRoundOnly) {
      if (card.roundTickFired) continue;
      card.roundTickFired = true;
    }
    const el = getDef(card.defId).element;
    const enemies = () => enemyCards(draft, card.owner).filter((c) => c.curHp > 0);
    const allies = () => boardCards(draft, card.owner).filter((c) => c.curHp > 0);

    // Seed Roll (Acorn): trundle forward toward the enemy home each round, one
    // open slot at a time — the same walk as Oak's on-summon roll, per round.
    //
    // A boss holds still for the opening (BOSS_HOLD_ROUNDS) — the same gate the
    // Prep move reads, so the two ways off the home row cannot disagree about
    // when it is allowed to leave.
    // A SIEGE ENGINE WAITS FOR THE WALL. Gates the forward gaits only: the
    // lateral aim below still runs, so the thing tracks its target along its
    // own line while the wall stands and then walks the moment it falls.
    // TWO INDEPENDENT HOLDS on the forward gaits, and a card may carry both —
    // Continental does. It walks when the LATER of them is satisfied: not
    // before its round, and not while the enemy still has a wall up.
    const wallsUp = rt.advanceWhenWallsDown === true && enemyWallsStanding(draft, card.owner);
    const tooEarly = rt.advanceFromRound != null && draft.round < rt.advanceFromRound;
    const held = wallsUp || tooEarly;
    // `rollHeld`: a boulder loosed during THIS Cleanup must not also roll
    // during it, or it lands in the row in front of the giant and is already
    // past it before the player ever sees it there — which would make the
    // card's own text a lie. On the instance because step 4 clears
    // `summonedThisRound` just before these ticks run; see `roundTickFired`.
    if (rt.advanceTrample && card.rollHeld) card.rollHeld = false;
    else if (rt.advanceTrample && card.pos && !held
        && !bossHeldHome(draft, getDef(card.defId))) {
      // THROUGH, not up to. `chargeForward` shoves a TRAMPLE card past a
      // blocker and `applyShove` deals its CRUSH damage — the same pair the
      // Prep move and Hoarfell's gait use, so a boulder cannot roll by a
      // different rule than everything else that rolls.
      chargeForward(draft, card, rt.advanceTrample);
    }
    if (rt.advance && card.pos && !held && !bossHeldHome(draft, getDef(card.defId))) {
      const dir = card.owner === "P1" ? -1 : 1;
      let rolled = 0;
      while (rolled < rt.advance && card.pos) {
        const nextRow: number = card.pos.row + dir;
        if (nextRow < 0 || nextRow >= draft.boardSize) break;
        if (cardAt(draft, nextRow, card.pos.col) || draft.slots[nextRow][card.pos.col].capturedBy) break;
        card.pos = { row: nextRow as Pos["row"], col: card.pos.col };
        rolled++;
      }
      // NAME THE GAIT. `advance` is Acorn's Seed Roll, and every card sharing
      // it narrated "rolls forward" — so three bosses moved, and read, like a
      // LEAF sapling trundling up the board. Reported as exactly that: "I
      // didn't ask for most of them to be given seed roll". A card that names
      // its roundTick gets its own line.
      if (rolled > 0) {
        const gait = getDef(card.defId).passiveNames?.roundTick;
        draft.log.push(gait
          ? `${label(draft, card)} — ${gait}: ${rolled} slot(s) forward.`
          : `${label(draft, card)} rolls forward ${rolled} slot(s).`);
      }
    }

    // THE BOSS CLOCK: the Special fires itself, free, on the beat. Placed
    // FIRST among the ticks so a boss that is about to slide or advance casts
    // from where the player last saw it — the telegraph is the position you
    // read on your turn, not the one it moves to afterwards.
    //
    // `fireCardSpecial` rather than calling the handler raw: it picks targets
    // by `targetSide` (Overclock's spawn is self-targeted, Permafrost's is
    // board-wide) and carries the re-entrancy guard. Blocked by MUTE and the
    // action-stopping statuses, deliberately — silencing a boss is one of the
    // answers these puzzles are built to reward.
    if (rt.fireSpecialEveryN && card.curHp > 0 && getDef(card.defId).special
        && draft.round % rt.fireSpecialEveryN === 0
        && !hasStatus(card, "MUTED") && !isActionBlocked(card)) {
      draft.log.push(`${label(draft, card)} — ${getDef(card.defId).special!.name} comes round again.`);
      fireCardSpecial(draft, card);
    }

    // THE PACK: strength borrowed from whoever is still standing. Recomputed
    // from scratch each round rather than added to, so it FALLS as the escorts
    // die — which is the tell the whole fight is built on.
    if (rt.packDmg) {
      const pack = boardCards(draft, card.owner).filter(
        (a) => a.curHp > 0 && a.instanceId !== card.instanceId && inTribeOf(a, rt.packDmg!.tribe),
      ).length;
      const had = card.packBonus ?? 0;
      const now = Math.min(rt.packDmg.max, pack * rt.packDmg.per);
      if (now !== had) {
        card.dmgBonus += now - had;   // hand back exactly what was last given
        card.packBonus = now;
        draft.log.push(now > had
          ? `${label(draft, card)} runs with the pack (+${now} DMG, ${pack} at its side).`
          : `${label(draft, card)} is thinning out (+${now} DMG, ${pack} left).`);
      }
    }

    // SIEGE AIM: traverse the home row toward the busiest column. The Special
    // fires down the column the boss is STANDING in, so this is the telegraph —
    // the player watches the lane being chosen and has the rounds it spends
    // walking to answer. One step a round, deliberately: a gun that snapped to
    // its target would be the same effect with none of the reading.
    if (rt.aimLateral && card.pos && !bossHeldHome(draft, getDef(card.defId))) {
      const home = homeRow(card.owner, draft.boardSize);
      if (card.pos.row === home) {
        // TWO QUESTIONS, one gait. "count" looks for the crowd (Helion,
        // Skeleeze); "topDmg" looks for the single biggest hitter, which is the
        // right question for a siege engine — it is not hunting a group, it is
        // walking at the thing that will hurt it.
        const byTopDmg = rt.aimLateralBy === "topDmg";
        const counts = new Array<number>(draft.boardSize).fill(0);
        for (const e of enemyCards(draft, card.owner)) {
          if (e.curHp <= 0 || !e.pos) continue;
          // count: bodies in the column. topDmg: the biggest hitter IN it, so
          // three weak cards never outweigh the one thing worth walking at.
          counts[e.pos.col] = byTopDmg
            ? Math.max(counts[e.pos.col], effectiveDmg(draft, e))
            : counts[e.pos.col] + 1;
        }
        // Lowest column wins a tie — a telegraph broken at random is a lie.
        let want = -1, most = 0;
        for (let c = 0; c < counts.length; c++)
          if (counts[c] > most) { most = counts[c]; want = c; }
        // One column by default (Helion's Traverse); Skeleeze covers two and
        // TRADES places with whatever is in the way rather than stopping.
        // Recomputed per step off the SAME `want`, so a two-step slide is one
        // decision carried out twice rather than two changes of mind.
        const steps = Math.max(1, rt.aimLateralSteps ?? 1);
        for (let n = 0; n < steps; n++) {
          if (want < 0 || want === card.pos.col) break;
          const col: number = card.pos.col + (want > card.pos.col ? 1 : -1);
          if (draft.slots[home][col].capturedBy) break; // nothing rests on a captured slot
          const sitting = cardAt(draft, home, col);
          if (sitting) {
            // A captured slot cannot take the victim either, so the trade is off.
            if (!rt.aimLateralSwap || draft.slots[home][card.pos.col].capturedBy) break;
            const from = { ...card.pos };
            card.pos = { row: home as Pos["row"], col: col as Pos["col"] };
            sitting.pos = { row: from.row as Pos["row"], col: from.col as Pos["col"] };
            draft.log.push(
              `${label(draft, card)} shoulders past ${getDef(sitting.defId).name} — they trade places.`,
            );
          } else {
            card.pos = { row: home as Pos["row"], col: col as Pos["col"] };
            draft.log.push(`${label(draft, card)} traverses — the lane is column ${want}.`);
          }
        }
      }
    }

    // PACK HUNTER (escortAdvance): step forward only with the pack up. Counts
    // allies LEVEL WITH OR AHEAD of it, so escorts trailing behind do not give
    // permission — the boss waits for them rather than the other way round.
    if (rt.escortAdvance && card.pos && !bossHeldHome(draft, getDef(card.defId))) {
      const dir = card.owner === "P1" ? -1 : 1;
      const up = boardCards(draft, card.owner).filter(
        (a) => a.curHp > 0 && a !== card && a.pos
          && (dir > 0 ? a.pos.row >= card.pos!.row : a.pos.row <= card.pos!.row),
      ).length;
      const gait = getDef(card.defId).passiveNames?.roundTick;
      if (up >= rt.escortAdvance.need) {
        const row = card.pos.row + dir;
        if (row >= 0 && row < draft.boardSize && !cardAt(draft, row, card.pos.col)
            && !draft.slots[row][card.pos.col].capturedBy) {
          card.pos = { row: row as Pos["row"], col: card.pos.col };
          draft.log.push(`${label(draft, card)} — ${gait ?? "the pack"} moves up together.`);
        }
      } else {
        draft.log.push(`${label(draft, card)} holds — ${gait ?? "it"} waits for the pack.`);
      }
    }

    // SKITTISH (kite): hurt, it gives ground rather than trading.
    if (rt.kite && card.pos && !bossHeldHome(draft, getDef(card.defId))) {
      const maxHp = effectiveMaxHp(draft, card) || 1;
      if ((100 * card.curHp) / maxHp < rt.kite.belowPct) {
        const back = card.pos.row + (card.owner === "P1" ? 1 : -1);
        if (back >= 0 && back < draft.boardSize && !cardAt(draft, back, card.pos.col)
            && !draft.slots[back][card.pos.col].capturedBy) {
          card.pos = { row: back as Pos["row"], col: card.pos.col };
          draft.log.push(`${label(draft, card)} breaks off and gives ground.`);
        }
      }
    }

    // ALOOF (avoidLateral): the mirror of Traverse — slide toward the EMPTIEST
    // column instead of the busiest. Same tie rule (lowest column wins), same
    // home-row-only restriction, for the same reason: a telegraph broken at
    // random is a lie.
    if (rt.avoidLateral && card.pos && !bossHeldHome(draft, getDef(card.defId))) {
      const home = homeRow(card.owner, draft.boardSize);
      if (card.pos.row === home) {
        const counts = new Array<number>(draft.boardSize).fill(0);
        for (const e of enemyCards(draft, card.owner))
          if (e.curHp > 0 && e.pos) counts[e.pos.col] += 1;
        let want = -1, fewest = Infinity;
        for (let c = 0; c < counts.length; c++)
          if (counts[c] < fewest) { fewest = counts[c]; want = c; }
        if (want >= 0 && want !== card.pos.col) {
          const col = card.pos.col + (want > card.pos.col ? 1 : -1);
          if (!cardAt(draft, home, col) && !draft.slots[home][col].capturedBy) {
            card.pos = { row: home as Pos["row"], col: col as Pos["col"] };
            draft.log.push(`${label(draft, card)} drifts clear — column ${col}.`);
          }
        }
      }
    }

    // JUGGERNAUT: it advances, and the run builds. Stopped is stopped — the
    // bonus goes back to nothing rather than decaying, because "block it once"
    // has to be worth doing.
    if (rt.momentum && card.pos && !bossHeldHome(draft, getDef(card.defId))) {
      const from = card.pos.row;
      chargeForward(draft, card, 1);
      const rolled = card.pos != null && card.pos.row !== from;
      const had = card.momentumDmg ?? 0;
      const now = rolled ? Math.min(rt.momentum.max, had + rt.momentum.per) : 0;
      if (now !== had) {
        card.dmgBonus += now - had;   // take back exactly what the run put on
        card.momentumDmg = now;
        draft.log.push(rolled
          ? `${label(draft, card)} gathers speed (+${now} DMG while it runs).`
          : `${label(draft, card)} is stopped dead — the charge is spent.`);
      }
    }

    // PROWL: forward, forward, back, hold — and then round again.
    //
    // The pattern is the point. A boss that walks straight at you is read once
    // and never again; one that paces is read every round, which is the tension
    // the owner spotted when the AI was shuffling Basilisk about by accident.
    // But it is a CYCLE and not a coin: a Void Tower fight is a puzzle and a
    // puzzle cannot be solved against randomness, so two beats of watching tell
    // you where it will be on the fourth.
    //
    // Held by BOSS_HOLD_ROUNDS like every other boss movement, so the opening
    // is still yours. Blocked squares simply cost it that beat — it does not
    // get a second attempt, because a pattern with retries is not a pattern.
    if (rt.prowl && card.pos && !bossHeldHome(draft, getDef(card.defId))) {
      const beat = (card.prowlStep ?? 0) % 4;
      card.prowlStep = (card.prowlStep ?? 0) + 1;
      const dir = card.owner === "P1" ? -1 : 1;
      const step = beat <= 1 ? dir : beat === 2 ? -dir : 0;
      if (step !== 0) {
        const row = card.pos.row + step;
        if (row >= 0 && row < draft.boardSize
            && !cardAt(draft, row, card.pos.col)
            && !draft.slots[row][card.pos.col].capturedBy) {
          card.pos = { row: row as Pos["row"], col: card.pos.col };
          draft.log.push(`${label(draft, card)} ${step === dir ? "stalks closer" : "coils back"}.`);
        }
      } else {
        draft.log.push(`${label(draft, card)} goes still.`);
      }
    }

    // Shamble: the slow half of `advance` — one slot every few rounds.
    if (rt.advanceEveryN && card.pos && draft.round % rt.advanceEveryN === 0
        && !bossHeldHome(draft, getDef(card.defId))) {
      chargeForward(draft, card, 1);
    }

    // Swiftshooter (shiftLateral): slide along the OWN home row, wrapping to
    // the next OPEN slot. Only while actually standing in the home row — a
    // card dragged off its rail stops sliding, which is itself an answer the
    // player can force. Deterministic: the kill-column telegraphs itself.
    if (rt.shiftLateral && card.pos) {
      const home = homeRow(card.owner, draft.boardSize);
      if (card.pos.row === home) {
        for (let step = 1; step < draft.boardSize; step++) {
          const col = (card.pos.col + rt.shiftLateral * step) % draft.boardSize;
          if (!cardAt(draft, home, col) && !draft.slots[home][col].capturedBy) {
            card.pos = { row: home as Pos["row"], col: col as Pos["col"] };
            draft.log.push(`${label(draft, card)} shifts along its row.`);
            break;
          }
        }
      }
    }

    if (rt.buffDmgEveryN && draft.round % rt.buffDmgEveryN.n === 0
        && (!rt.buffDmgEveryN.maxTicks || (card.rampTicks ?? 0) < rt.buffDmgEveryN.maxTicks)) {
      const bn = rt.buffDmgEveryN;
      card.dmgBonus += bn.amount;
      if (bn.sp) card.spBonus += bn.sp; // Dragon's Blade
      if (bn.hp) card.curHp += gainMaxHp(card, bn.hp); // Supercell's +HP ramp
      if (bn.maxTicks) card.rampTicks = (card.rampTicks ?? 0) + 1;
      const parts = [bn.amount ? `+${bn.amount} DMG` : "", bn.sp ? `+${bn.sp} SP` : "", bn.hp ? `+${bn.hp} HP` : ""].filter(Boolean);
      draft.log.push(`${label(draft, card)} sharpens (${parts.join(" ")}).`);
    }
    if (rt.aoeDmg) {
      for (const e of enemies()) tickDamage(draft, card, e, rt.aoeDmg, false);
      draft.log.push(`${label(draft, card)} sweeps the field (${rt.aoeDmg} DMG to all enemies).`);
    }
    if (rt.aoeStatus) {
      for (const e of enemies()) applyStatus(draft, e, rt.aoeStatus.kind, rt.aoeStatus.duration, rt.aoeStatus.power, el);
    }
    // NOTE: inRangeStatus (electrify auras) is applied at the START of battle
    // now (see startBattle), not here — so the field is live for the current
    // battle instead of lagging a round.
    if (rt.scaldFrozen) {
      for (const e of enemies()) if (hasStatus(e, "FREEZE")) applyStatus(draft, e, "SCALD", 1, rt.scaldFrozen, el);
    }
    if (rt.lowestEnemyStatus) {
      const t = lowestHp(enemies());
      if (t) applyStatus(draft, t, rt.lowestEnemyStatus.kind, rt.lowestEnemyStatus.duration, rt.lowestEnemyStatus.power, el);
    }
    if (rt.paralyzeOne) {
      const t = enemies().find((e) => !hasStatus(e, "PARALYZE"));
      if (t) applyStatus(draft, t, "PARALYZE", rt.paralyzeOne, 0, el);
    }
    if (rt.spawn && rt.selfHpCost) {
      // Dead Clock (RIP): a body every round, paid for in its own flesh. Floors
      // at 1 HP — the clock stalls rather than killing the thing winding it.
      // The leash is the real brake: while `spawnMaxAlive` of its tokens stand,
      // the clock jams and pays nothing, so the horde holds at a size the
      // opponent can fight through instead of eating the board. Clearing a husk
      // is what earns the next one.
      const penned =
        rt.spawnMaxAlive != null &&
        boardCards(draft, card.owner).filter((c) => c.defId === rt.spawn!.token).length >=
          rt.spawnMaxAlive;
      if (penned) {
        draft.log.push(`${label(draft, card)}'s Dead Clock jams — the horde is already at full strength.`);
      } else if (card.curHp > rt.selfHpCost) {
        card.curHp -= rt.selfHpCost;
        const before = boardCards(draft, card.owner).length;
        spawnTokens(draft, card, rt.spawn.token, rt.spawn.count, rt.spawn.adjacentOnly ? 1 : rt.spawn.spawnRadius);
        const raised = boardCards(draft, card.owner).length - before;
        card.spawnTally = (card.spawnTally ?? 0) + raised;
        if (raised > 0)
          draft.log.push(`${label(draft, card)} winds the Dead Clock (−${rt.selfHpCost} HP, ${raised} raised).`);
        // Horde: once the clock has raised enough, the Special fires free and
        // the tally resets, so it's a repeating cycle rather than a one-off.
        const def = getDef(card.defId);
        if (rt.spawnTriggerAt && def.special && (card.spawnTally ?? 0) >= rt.spawnTriggerAt) {
          card.spawnTally = 0;
          const handler = SPECIAL_HANDLERS[def.special.handler];
          if (handler) {
            draft.log.push(`${label(draft, card)}'s horde answers!`);
            handler(draft, card, [], def.special.params ?? {});
          }
        }
      }
    }
    if (rt.enemyHomeRowStatus) {
      // The ground itself is burning: everything standing on the enemy's home
      // row catches, including whatever they just summoned into it. Range is
      // irrelevant — it's a zone, not a shot, so canTarget is not consulted.
      const st = rt.enemyHomeRowStatus;
      const row = homeRow(enemyOf(card.owner), draft.boardSize);
      const caught = enemies().filter((e) => e.pos?.row === row);
      for (const e of caught) applyStatus(draft, e, st.kind, st.duration, st.power, el);
      if (caught.length)
        draft.log.push(`${label(draft, card)}'s wildfire still burns — ${caught.length} caught in it.`);
    }
    // Turret Mode (GigaVolt): keep firing electrified volleys for the armed rounds.
    if ((card.turretRoundsLeft ?? 0) > 0) {
      fireElectrifiedVolley(draft, card, card.turretDmg ?? 3);
      card.turretRoundsLeft = (card.turretRoundsLeft ?? 0) - 1;
    }
    if (rt.aoeElectrifiedDmg) {
      // Dynamo: the literal ELECTRIFIED status, which its own Special applies —
      // deliberately NOT the "carries any status" proxy Voltogon uses, so the
      // card combos with itself rather than with every DOT on the board.
      const zapped = enemies().filter((e) => hasStatus(e, "ELECTRIFIED") && canTarget(draft, card, e));
      for (const e of zapped) tickDamage(draft, card, e, rt.aoeElectrifiedDmg, false);
      if (zapped.length)
        draft.log.push(`${label(draft, card)} discharges into ${zapped.length} Electrified opponent(s).`);
    }
    // The wake can run on a BEAT rather than every round — see
    // `pushEnemiesEveryN`. Round 0 is pre-match, so `round > 0` keeps a
    // two-beat off the round before the first one.
    if (rt.pushEnemies
        && (!rt.pushEnemiesEveryN
            || (draft.round > 0 && draft.round % rt.pushEnemiesEveryN === 0))) {
      for (const e of enemies()) pushBack(draft, e, rt.pushEnemies, card.owner);
    }
    // THE STORM AURA. A timed −SP on every opponent, re-applied each round, so
    // it lapses on its own the round the holder stops ticking rather than
    // needing to be unwound on death. Clamped to what the target actually has:
    // driving SP negative would bank several rounds of penalty a cleanse could
    // not reach, and SP is already this game's tempo currency.
    if (rt.slowEnemies) {
      let slowed = 0;
      for (const e of enemies()) {
        const drop = Math.min(rt.slowEnemies, effectiveSp(draft, e));
        if (drop <= 0) continue;
        applyTimedBuff(e, 0, -drop, 1);
        slowed++;
      }
      if (slowed)
        draft.log.push(`${label(draft, card)}'s storm drags on ${slowed} opponent(s) (−${rt.slowEnemies} SP).`);
    }
    // HIGH-SPEED CYCLONE. Every opponent is carried one step CLOCKWISE around
    // the holder, to the diagonal that continues the turn. Rotation rather than
    // a shove: distance is preserved and the formation is not, which is the
    // thing a player rebuilds with their one move a turn.
    //
    // Resolved against a snapshot of the occupied slots and applied only where
    // the destination is on the board and empty, so two cards can never be
    // spun onto the same square and nothing is displaced into a wall.
    if (rt.cycloneSpin && card.pos) {
      const eye = card.pos;
      const taken = new Set(
        boardCards(draft).filter((c) => c.pos).map((c) => `${c.pos!.row},${c.pos!.col}`),
      );
      let spun = 0;
      for (const e of enemies()) {
        if (!e.pos || getDef(e.defId).pushImmune) continue;
        // THE CLOCKWISE STEP, derived rather than tabulated. The radius from
        // the eye is (dr, dc); rotating it a quarter turn clockwise gives the
        // tangent (dc, -dr), and the diagonal that best follows that tangent is
        // its component signs. Where a component is zero the card sits square
        // on an axis and the tangent says nothing about that axis — fill it by
        // stepping INWARD on the axis it is offset along, which is what keeps
        // the turn on the same ring instead of flinging it outward:
        //
        //   N(-1,0) -> E(0,1) -> S(1,0) -> W(0,-1) -> N   (distance preserved)
        //
        // Deterministic in every branch. `chanceProblems` fails the build on a
        // boss that rolls dice, and a tie broken at random would be one.
        const dr = Math.sign(e.pos.row - eye.row);
        const dc = Math.sign(e.pos.col - eye.col);
        if (dr === 0 && dc === 0) continue;       // standing on the eye: nothing to turn about
        const mr = dc !== 0 ? dc : -dr;
        const mc = dr !== 0 ? -dr : -dc;
        const nr = e.pos.row + mr;
        const nc = e.pos.col + mc;
        if (nr === e.pos.row && nc === e.pos.col) continue;
        if (nr < 0 || nr >= draft.boardSize || nc < 0 || nc >= draft.boardSize) continue;
        const key = `${nr},${nc}`;
        if (taken.has(key)) continue;
        taken.delete(`${e.pos.row},${e.pos.col}`);
        taken.add(key);
        e.pos = { row: nr, col: nc };
        spun++;
      }
      if (spun) draft.log.push(`${label(draft, card)}'s cyclone spins ${spun} opponent(s) off their line.`);
    }
    // A PRODUCTION LINE. Continental's boulders: one every `n` rounds, dropped
    // in the row directly in front of it and left to roll. `spawnMaxAlive` is
    // what keeps it from burying the board — without a ceiling a repeating
    // spawn is not a threat, it is a wall the player cannot get through.
    if (rt.spawnEveryN && card.pos && draft.round > 0
        && draft.round % rt.spawnEveryN.n === 0) {
      const { token, spawnMaxAlive = 3 } = rt.spawnEveryN;
      const alive = boardCards(draft, card.owner)
        .filter((c) => c.curHp > 0 && c.defId === token).length;
      if (alive < spawnMaxAlive) {
        const dir = card.owner === "P1" ? -1 : 1;
        const ahead = card.pos.row + dir;
        if (ahead >= 0 && ahead < draft.boardSize) {
          // The COLUMN is the seeded RNG's, which is deterministic per match —
          // a replay replays. Only open squares are offered, so a full row
          // simply produces nothing this round rather than throwing.
          const open: number[] = [];
          for (let c = 0; c < draft.boardSize; c++)
            if (!cardAt(draft, ahead, c) && !draft.slots[ahead][c].capturedBy) open.push(c);
          if (open.length) {
            const col = open[randInt(draft, open.length)];
            const born = summonCard(draft, card.owner, token, { row: ahead, col } as never);
            // It arrives this round and rolls from the NEXT, so the row it is
            // printed as arriving in is the row it is actually seen in.
            born.rollHeld = true;
            draft.log.push(`${label(draft, card)} looses a ${getDef(token).name}.`);
          }
        }
      }
    }
    // A BODY ON A CLOCK. The round-6 hurricane: announced by the fight's own
    // pace rather than by a cast, so it is the one thing in the match a player
    // can plan around exactly.
    if (rt.spawnOnRound && card.pos && draft.round >= rt.spawnOnRound.round) {
      const { token, minRow, spawnMaxAlive = 1 } = rt.spawnOnRound;
      const alive = boardCards(draft, card.owner).filter((c) => c.curHp > 0 && c.defId === token).length;
      if (alive < spawnMaxAlive) {
        const born = spawnTokens(draft, card, token, 1);
        // `minRow` is counted FORWARD from the holder's own home row, so the
        // storm forms out over the field instead of behind the boss that called
        // it. Rows run 0..boardSize-1 with home at one end, so "forward" is
        // whichever direction leads away from home.
        const home = homeRow(card.owner, draft.boardSize);
        const forward = home === 0 ? 1 : -1;
        for (const b of born) {
          if (minRow == null || !b.pos) continue;
          const want = home + forward * minRow;
          const far = forward > 0 ? b.pos.row >= want : b.pos.row <= want;
          if (far) continue;
          // Nudge it out to the first open slot at or beyond the line. If none
          // is free it stays where it landed — a hurricane in the wrong row is
          // better than no hurricane.
          const open = (r: number, c: number) =>
            r >= 0 && r < draft.boardSize && c >= 0 && c < draft.boardSize
            && !boardCards(draft).some((x) => x.pos?.row === r && x.pos.col === c);
          let placed = false;
          for (let r = want; r >= 0 && r < draft.boardSize && !placed; r += forward)
            for (let c = 0; c < draft.boardSize && !placed; c++)
              if (open(r, c)) { b.pos = { row: r, col: c }; placed = true; }
        }
        if (born.length)
          draft.log.push(`${label(draft, card)} calls the storm down — ${getDef(token).name} forms.`);
      }
    }
    // Scorched Fury: bleed 1, run 2 hotter next round. Floors at 1 HP so the
    // engine stalls rather than killing its own owner.
    if (rt.selfBurnForDmg) {
      const { hp, dmg } = rt.selfBurnForDmg;
      if (card.curHp > hp) {
        card.curHp -= hp;
        applyTimedBuff(card, dmg, 0, 1);
        draft.log.push(`${label(draft, card)} stokes itself (−${hp} HP, +${dmg} DMG next round).`);
      }
    }
    // Meltdown's sustained blast. Scoped to its own block so the rest of the
    // tick (Scorched Fury) runs regardless of whether the Special is lit.
    if (rt.channel && card.channelOn) {
      if (hasStatus(card, "FREEZE") || hasStatus(card, "ROOT")) {
        card.channelOn = false;
        draft.log.push(`${label(draft, card)}'s meltdown is smothered.`);
      } else if (card.curHp <= rt.channel.hpCost) {
        // Can't afford the round: it stops channelling rather than dying to its
        // own Special.
        card.channelOn = false;
        draft.log.push(`${label(draft, card)} burns out — the meltdown ends.`);
      } else {
        card.curHp -= rt.channel.hpCost;
        eruptInRange(draft, card, channelDmg(draft, card, rt.channel.inRangeDmg));
        draft.log.push(`${label(draft, card)} erupts again (−${rt.channel.hpCost} HP).`);
      }
    }
    if (rt.rowAheadDmg) {
      // Sweeping Flames: burn whatever stands in the row directly ahead. Through
      // the shared helper — this used to re-implement it inline, and now that the
      // Meltdown channel has moved to in-range reach it is the only caller left.
      eruptRowAhead(draft, card, rt.rowAheadDmg);
    }
    if (rt.inRangeDmg) {
      // Black Smoke / Radiation: hit every opponent this card can reach (UFO's
      // radiation PENetrates shields).
      const hit = enemies().filter((e) => canTarget(draft, card, e));
      for (const e of hit) tickDamage(draft, card, e, rt.inRangeDmg, !!rt.inRangeDmgPen);
      if (hit.length) draft.log.push(`${label(draft, card)} hits ${hit.length === 1 ? "an enemy" : `${hit.length} enemies`} in range (${rt.inRangeDmg} DMG${rt.inRangeDmgPen ? " PEN" : ""}).`);
    }
    if (rt.selfShields) {
      // Royal Guard: replenish the guardian's shields each round. Bark Shield
      // caps the stack at `selfShieldsMax`.
      const cap = rt.selfShieldsMax ?? Infinity;
      if (card.curShields < cap) {
        card.curShields = Math.min(cap, card.curShields + rt.selfShields);
        draft.log.push(`${label(draft, card)} raises its guard (+${rt.selfShields} shields).`);
      }
    }
    if (rt.pokeParalyzedDmg) {
      // Volt Turret: zap one PARALYZED enemy the turret can reach.
      const t = closest(card, enemies().filter((e) => hasStatus(e, "PARALYZE") && canTarget(draft, card, e)));
      if (t) tickDamage(draft, card, t, rt.pokeParalyzedDmg, false);
    }
    if (rt.roundHealElement) {
      // Morning Dew: the dew settles on its own kind only.
      const { element, amount } = rt.roundHealElement;
      let touched = 0;
      for (const a of allies()) if (getDef(a.defId).element === element && healCard(draft, a, amount, card) > 0) touched++;
      if (touched) draft.log.push(`${label(draft, card)}'s dew settles on ${touched} ${element} ally(ies) (+${amount} HP).`);
    }
    if (rt.rootedDmg) {
      // Trapper (Fallow): the snares bite at the end of every round. Anything
      // held in place takes the hit wherever it is — a trap doesn't need range.
      const caught = enemies().filter((e) => hasStatus(e, "ROOT"));
      for (const e of caught) tickDamage(draft, card, e, rt.rootedDmg, false);
      if (caught.length)
        draft.log.push(`${label(draft, card)}'s traps bite ${caught.length} snared foe(s) for ${rt.rootedDmg}.`);
    }
    if (rt.drainAdjacent) {
      // Constriction (Python): squeeze the nearest adjacent opponent — deal N and
      // heal that much. A LIFESTEAL that doesn't wait on a basic attack.
      const near = enemies().filter((e) => e.pos && card.pos && chebyshev(e.pos, card.pos) <= 1);
      const prey = closest(card, near);
      if (prey) {
        tickDamage(draft, card, prey, rt.drainAdjacent, false);
        const h = healCard(draft, card, rt.drainAdjacent, card);
        draft.log.push(`${label(draft, card)} constricts ${label(draft, prey)} (${rt.drainAdjacent} DMG, +${h} HP).`);
      }
    }
    if (rt.paralyzeLowHp) {
      // Power Grid (Blackout): the weak are locked down.
      for (const e of enemies()) if (e.curHp <= rt.paralyzeLowHp.underHp)
        applyStatus(draft, e, "PARALYZE", rt.paralyzeLowHp.rounds, 0, getDef(card.defId).element);
    }
    if (rt.rootFastest) {
      // Grounded (Evera): pin the fastest opponent on the board.
      const foes = enemies();
      const fastest = foes.reduce<CardInstance | null>((b, e) => (!b || effectiveSp(draft, e) > effectiveSp(draft, b) ? e : b), null);
      if (fastest) {
        applyStatus(draft, fastest, "ROOT", rt.rootFastest, 0, getDef(card.defId).element);
        draft.log.push(`${label(draft, card)} grounds ${label(draft, fastest)} (ROOT ${rt.rootFastest}r).`);
      }
    }
    if (rt.refreshShieldsTo != null && card.curShields < rt.refreshShieldsTo) {
      // Nature's Protection (Sylvane): top the bark armour back up.
      card.curShields = rt.refreshShieldsTo;
      draft.log.push(`${label(draft, card)} regrows its bark (${rt.refreshShieldsTo} shields).`);
    }
    if (rt.rootedStatus) {
      // Poisonous Roots (Ivey): the rooted rot where they stand.
      const rs = rt.rootedStatus;
      for (const e of enemies()) if (hasStatus(e, "ROOT")) applyStatus(draft, e, rs.kind, rs.duration, rs.power, getDef(card.defId).element);
    }
    if (rt.rootZeroSp) {
      // Frosty Bites (Hibernal): the winter cold seizes a spent, motionless foe.
      const stuck = enemies().find(
        (e) => e.curHp > 0 && effectiveSp(draft, e) <= 0 && !hasStatus(e, "ROOT"),
      );
      if (stuck) {
        applyStatus(draft, stuck, "ROOT", rt.rootZeroSp, 0, getDef(card.defId).element);
        draft.log.push(`${label(draft, card)}'s frost roots ${label(draft, stuck)} (${rt.rootZeroSp}r).`);
      }
    }
    if (rt.drainMaxAdjacent) {
      // Draining Siphon (Violet): bleed max HP from every adjacent opponent.
      const near = enemies().filter((e) => e.curHp > 0 && e.pos && card.pos && chebyshev(e.pos, card.pos) <= 1);
      let total = 0;
      for (const e of near) total += drainMaxHp(draft, card, e, rt.drainMaxAdjacent);
      if (total > 0) draft.log.push(`${label(draft, card)}'s siphon drains ${total} max HP from ${near.length} foe(s).`);
    }
    if (rt.lockEnemySpecials) {
      // Magic Ropes (Tether): wrap up N reachable opponents — their Specials are
      // disabled for the coming round. (doRoundTicks runs after the lock tick-
      // down, so a value of 1 survives to next round.)
      const roped = enemies().filter((e) => e.curHp > 0 && canTarget(draft, card, e)).slice(0, rt.lockEnemySpecials);
      for (const e of roped) e.specialLockedRounds = Math.max(e.specialLockedRounds ?? 0, 1);
      if (roped.length) draft.log.push(`${label(draft, card)}'s Magic Ropes bind ${roped.length} opponent(s).`);
    }
    if (rt.aoeParalyzedDmg) {
      // Complete Circuit: current flows through every PARALYZED enemy in range.
      for (const e of enemies()) if (hasStatus(e, "PARALYZE") && canTarget(draft, card, e))
        tickDamage(draft, card, e, rt.aoeParalyzedDmg, false);
    }
    if (rt.spawn && !rt.selfHpCost) {
      // Reptilian Screech / Hive Command (Keeper): spawn a token into an open
      // king's-reach slot each round. Guarded on selfHpCost: a spawn that charges
      // HP (RIP's Dead Clock) is handled by its own block above, tally and Horde
      // trigger included. Without the guard BOTH blocks ran and the clock raised
      // two a round. `spawnMaxAlive` caps the standing count so the trickle can't
      // flood the board (Keeper's bees, which otherwise never stop).
      const atCap =
        rt.spawnMaxAlive != null &&
        boardCards(draft, card.owner).filter((c) => c.defId === rt.spawn!.token).length >= rt.spawnMaxAlive;
      if (!atCap)
        spawnTokens(draft, card, rt.spawn.token, rt.spawn.count, rt.spawn.adjacentOnly ? 1 : rt.spawn.spawnRadius);
    }
    if (rt.overheatDmg) {
      // Overheating (Heatsink Golem): discharge into the closest opponent — and
      // DOUBLE it when the coils hit the same target as last round.
      const t = closest(card, enemies());
      if (t) {
        const repeat = card.lastOverheatTargetId === t.instanceId;
        const dmg = repeat ? rt.overheatDmg * 2 : rt.overheatDmg;
        tickDamage(draft, card, t, dmg, false);
        card.lastOverheatTargetId = t.instanceId;
        draft.log.push(`${label(draft, card)}'s coils discharge ${dmg}${repeat ? " (built-up heat)" : ""} into ${label(draft, t)}.`);
      }
    }
    if (rt.pokeAheadAdvance && card.pos) {
      // Twisted Rush (Wailverine): gore the enemy directly ahead; step into its
      // slot if it falls.
      const row = card.pos.row + (card.owner === "P1" ? -1 : 1);
      const ahead = enemies().find((e) => e.curHp > 0 && e.pos?.row === row && e.pos?.col === card.pos!.col);
      if (ahead) {
        const slot = { ...ahead.pos! };
        const died = tickDamage(draft, card, ahead, rt.pokeAheadAdvance, false);
        draft.log.push(`${label(draft, card)} gores ahead for ${rt.pokeAheadAdvance}.`);
        if (died && card.curHp > 0 && !cardAt(draft, slot.row, slot.col)) {
          card.pos = { row: slot.row as Pos["row"], col: slot.col };
          draft.log.push(`${label(draft, card)} surges into the empty slot.`);
        }
      }
    }
    if (rt.pokeDmg || rt.pokeStatus) {
      const t = closest(card, enemies());
      if (t) {
        if (rt.pokeDmg) tickDamage(draft, card, t, rt.pokeDmg, false);
        if (rt.pokeStatus && draft.cards[t.instanceId] && t.curHp > 0)
          applyStatus(draft, t, rt.pokeStatus.kind, rt.pokeStatus.duration, rt.pokeStatus.power, el);
      }
    }
    // Elephlora's fruit / Static Cloud's bolt: hit ONE random living opponent
    // — optional damage and an optional status, both landing on the same target.
    if (rt.randomEnemyDmg || rt.randomEnemyStatus) {
      const foes = enemies();
      if (foes.length) {
        const t = foes[randInt(draft, foes.length)];
        if (rt.randomEnemyDmg) tickDamage(draft, card, t, rt.randomEnemyDmg, false);
        if (rt.randomEnemyStatus && draft.cards[t.instanceId] && t.curHp > 0)
          applyStatus(draft, t, rt.randomEnemyStatus.kind, rt.randomEnemyStatus.duration, rt.randomEnemyStatus.power, el);
        const bits = [rt.randomEnemyDmg && `${rt.randomEnemyDmg} DMG`, rt.randomEnemyStatus && rt.randomEnemyStatus.kind].filter(Boolean).join(" + ");
        draft.log.push(`${label(draft, card)} strikes ${label(draft, t)} (${bits}).`);
      }
    }
    if (rt.healAllies) {
      for (const a of allies()) healCard(draft, a, rt.healAllies, card);
      draft.log.push(`${label(draft, card)} restores allies (+${rt.healAllies} HP).`);
    }
    if (rt.healLowestAlly) {
      const a = lowestHp(allies().filter((c) => c.curHp < effectiveMaxHp(draft, c)));
      if (a) healCard(draft, a, rt.healLowestAlly, card);
    }
    // Blessed Light (Halo): heal allies standing on the caster's home row.
    if (rt.healHomeRow) {
      const home = homeRow(card.owner, draft.boardSize);
      let touched = 0;
      for (const a of allies()) if (a.pos?.row === home && healCard(draft, a, rt.healHomeRow, card) > 0) touched++;
      if (touched) draft.log.push(`${label(draft, card)}'s Blessed Light warms ${touched} home-row ally(ies) (+${rt.healHomeRow} HP).`);
    }
    // Reflection: plate up allies standing within its range each round.
    if (rt.allyInRangeShields && card.pos) {
      const reach = getDef(card.defId).attackType === "Ranged" ? RANGED_REACH : 1;
      let touched = 0;
      for (const a of allies()) {
        if (a.instanceId === card.instanceId || !a.pos) continue;
        if (chebyshev(card.pos, a.pos) <= reach) { a.curShields += rt.allyInRangeShields; touched++; }
      }
      if (touched) draft.log.push(`${label(draft, card)} shields ${touched} nearby ally(ies) (+${rt.allyInRangeShields}).`);
    }
    // Dreamweaver (Dreamcatcher): spend the round on the biggest threat it can
    // actually reach, rather than on whatever happens to be nearly dead.
    if (rt.topDmgInRangeStatus && card.pos) {
      const reachable = enemies().filter((e) => e.pos && canTarget(draft, card, e));
      const top = reachable.reduce<CardInstance | null>(
        (best, e) => (!best || effectiveDmg(draft, e) > effectiveDmg(draft, best) ? e : best),
        null,
      );
      if (top) {
        const s = rt.topDmgInRangeStatus;
        applyStatus(draft, top, s.kind, s.duration, s.power, el);
        draft.log.push(`${label(draft, card)} weaves ${s.kind} onto ${label(draft, top)} — the strongest thing in reach.`);
      }
    }
    // Snare Garden (Snapmaw): the roots themselves are the weapon. Every ROOTed
    // opponent bleeds — from any source, not only this card's own root.
    //
    // Duration 1, deliberately: the cleanup tick immediately below expires it,
    // and next round re-applies it if the target is still held. So it never
    // stacks, never carries, and a target that breaks free stops bleeding at
    // once — the garden is the damage, not the wound.
    if (rt.rootedBleed) {
      let caught = 0;
      for (const e of enemyCards(draft, card.owner)) {
        if (e.curHp <= 0 || !hasStatus(e, "ROOT")) continue;
        applyStatus(draft, e, "BLEED", 1, rt.rootedBleed, el);
        caught++;
      }
      if (caught)
        draft.log.push(
          `${label(draft, card)}'s Snare Garden bleeds ${caught} rooted opponent(s) for ${rt.rootedBleed}.`,
        );
    }
    // Butler's Service: mend the allies standing with it, each round.
    if (rt.healAlliesInRange && card.pos) {
      const reach = getDef(card.defId).attackType === "Ranged" ? RANGED_REACH : 1;
      let touched = 0;
      for (const a of allies()) {
        if (a.instanceId === card.instanceId || !a.pos) continue;
        if (chebyshev(card.pos, a.pos) <= reach && healCard(draft, a, rt.healAlliesInRange, card) > 0) touched++;
      }
      if (touched)
        draft.log.push(
          `${label(draft, card)} attends ${touched} nearby ally(ies) (+${rt.healAlliesInRange} HP).`,
        );
    }
    // Petalfall (Sakuroot): heal SAME-element allies standing on the home row.
    if (rt.healHomeRowElement) {
      const home = homeRow(card.owner, draft.boardSize);
      let touched = 0;
      for (const a of allies())
        if (a.pos?.row === home && getDef(a.defId).element === el && healCard(draft, a, rt.healHomeRowElement, card) > 0) touched++;
      if (touched) draft.log.push(`${label(draft, card)}'s Petalfall soothes ${touched} ${el} home-row ally(ies) (+${rt.healHomeRowElement} HP).`);
    }
    // Liquid Humidity (Dewling): drink itself back to full each round.
    if (rt.healSelfToFull) {
      const healed = healCard(draft, card, effectiveMaxHp(draft, card), card);
      if (healed > 0) draft.log.push(`${label(draft, card)} rehydrates to full (+${healed} HP).`);
    }
    if (rt.healWoundedAllies) {
      // Emergency Support (Vigil) / Rescue Pack (St. Bernard): mend any ally that's
      // dropped under the threshold.
      const { underHp, amount } = rt.healWoundedAllies;
      const hurt = allies().filter((c) => c.curHp > 0 && c.curHp < underHp);
      for (const a of hurt) healCard(draft, a, amount, card);
      if (hurt.length) draft.log.push(`${label(draft, card)} rushes aid to ${hurt.length} wounded ally(ies) (+${amount} HP).`);
    }
    if (rt.wardAllies) {
      // Radiant Ward: raise a single team-wide barrier (absorbs one status/round).
      draft.players[card.owner].statusWard = true;
    }
    if (rt.cleanseAllies) {
      // Crowned: wash the negative statuses off every ally.
      //
      // It SAYS SO now. This fired every round and printed nothing, which is
      // indistinguishable from not firing — and the statuses it removes are
      // exactly the ones a player is watching for (BLIND, FREEZE, PARALYZE:
      // "why did my card miss / not act"). Every other cleanse in the game
      // announces itself; this one washed a board clean in silence.
      let washed = 0;
      for (const a of allies()) {
        const before = a.statuses.length;
        a.statuses = a.statuses.filter((s) => !NEGATIVE_STATUSES.includes(s.kind));
        washed += before - a.statuses.length;
      }
      if (washed > 0)
        draft.log.push(
          `${label(draft, card)} — Crowned washes ${washed} negative effect${washed > 1 ? "s" : ""} off the army.`,
        );
    }
  }
}

function lowestHp(cards: CardInstance[]): CardInstance | null {
  return cards.reduce<CardInstance | null>((best, c) => (!best || c.curHp < best.curHp ? c : best), null);
}

function closest(from: CardInstance, cards: CardInstance[]): CardInstance | null {
  if (!from.pos) return cards[0] ?? null;
  const fp = from.pos;
  return cards.reduce<CardInstance | null>(
    (best, c) => (c.pos && (!best || manhattan(fp, c.pos) < manhattan(fp, best.pos!)) ? c : best),
    null,
  );
}

function doCleanupPhase(draft: GameState): void {
  draft.phase = "cleanup";
  draft.battle = null;

  // 1. DOT — bypasses shields, straight to HP, no shield stripped…
  //    with one exception: BURN also strips 1 shield per tick (PYRO's shred).
  //    Different DOT kinds coexist and each ticks (BLEED + BURN both hurt).
  //    BLEED damage is tallied per dealer side so Thorn's Transfusion can heal
  //    from the total BLEED its enemies took (its own BLEED + any teammate's).
  const bleedDealtBy: Record<PlayerId, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
  for (const card of boardCards(draft)) {
    // The board list is a snapshot taken once, and a card in it can die BEFORE
    // its turn in the loop comes round — killed by an earlier card's on-death
    // payload (Canister's KaBoooom, Nitro's Unstable Core, contagion). Ticking a
    // corpse's DOT would call defeatCard on it a second time, and defeatCard has
    // no re-entry guard: the whole on-death payload fires again and the death is
    // counted twice. doRoundTicks already guards exactly this way.
    if (!draft.cards[card.instanceId] || card.pos === null || card.curHp <= 0) continue;
    for (const s of card.statuses) {
      if (s.kind === "BLEED" || s.kind === "BURN" || s.kind === "SCALD" || s.kind === "DOT") {
        // Accelerator (Scorch): BURN on an enemy hits double while the side that
        // lit it is accelerating. Attributed from the VICTIM's side, the same
        // inference Lushfield uses — nobody burns their own cards.
        const boosted =
          s.kind === "BURN" && (draft.players[enemyOf(card.owner)].burnBoostRounds ?? 0) > 0;
        const dot = boosted ? s.power * 2 : s.power;
        card.curHp -= dot;
        noteDamageFx(card, dot);
        if (s.kind === "BLEED") bleedDealtBy[enemyOf(card.owner)] += s.power;
        draft.log.push(`${label(draft, card)} takes ${dot} ${s.kind} damage${boosted ? " (accelerated)" : ""}.`);
        if (s.kind === "BURN" && card.curShields > 0) {
          card.curShields = Math.max(0, card.curShields - 2); // PYRO shred: melts 2 shields/tick
          draft.log.push(`${label(draft, card)}'s shields melt (−2).`);
        }
        if (card.curHp <= 0) {
          if (defeatCard(draft, card, s.kind)) break; // removed; no further ticks
        } else {
          checkLowHpTransform(draft, card); // Skelider Dismount can trigger on DOT
        }
      }
    }
  }

  // 1b. Transfusion (Thorn): heal for the BLEED its side dealt this round.
  for (const card of boardCards(draft)) {
    const drained = bleedDealtBy[card.owner];
    if (drained > 0 && getDef(card.defId).healsFromBleed) {
      const healed = healCard(draft, card, drained, card);
      if (healed > 0) draft.log.push(`${label(draft, card)} drains ${healed} HP from BLEED.`);
    }
  }

  // 1c. Meteor (Cosmic): pending round-end strikes land now — dmg to every
  // opponent of the owner. Fire those due this round, then drop them.
  for (const pl of seatsOf(draft)) {
    const pend = draft.players[pl].pendingMeteors;
    if (!pend?.length) continue;
    const due = pend.filter((m) => m.round <= draft.round);
    draft.players[pl].pendingMeteors = pend.filter((m) => m.round > draft.round);
    for (const m of due) {
      const foes = enemyCards(draft, pl).filter((c) => c.curHp > 0);
      for (const e of foes) tickDamage(draft, m.source, e, m.dmg, false);
      if (foes.length) draft.log.push(`A meteor crashes down — ${m.dmg} DMG to ${foes.length} opponent(s).`);
    }
    // Orbital Shot (Zenith): delayed single-target arrows land on their due round.
    const arrows = draft.players[pl].pendingArrows;
    if (arrows?.length) {
      const dueArrows = arrows.filter((a) => a.round <= draft.round);
      draft.players[pl].pendingArrows = arrows.filter((a) => a.round > draft.round);
      for (const a of dueArrows) {
        const t = draft.cards[a.targetId];
        if (t && t.curHp > 0) {
          tickDamage(draft, a.source, t, a.dmg, false);
          draft.log.push(`An orbital arrow falls — ${a.dmg} DMG to ${label(draft, t)}.`);
        }
      }
    }
  }

  // Spiraling Root Coil follow-up (Evera): scheduled far-row ROOTs count down
  // and fire on their due Cleanup. Its own loop so a card with roots but no
  // meteors isn't skipped by the meteor guard above.
  for (const pl of seatsOf(draft)) {
    const roots = draft.players[pl].pendingFarRoots;
    if (!roots?.length) continue;
    for (const r of roots) r.roundsLeft -= 1;
    const dueRoots = roots.filter((r) => r.roundsLeft <= 0);
    draft.players[pl].pendingFarRoots = roots.filter((r) => r.roundsLeft > 0);
    for (const r of dueRoots) {
      if (!r.source.pos || r.source.curHp <= 0) continue;
      const far = rowAhead(pl, rowAhead(pl, r.source.pos.row));
      const targets = enemyCards(draft, pl).filter((e) => e.curHp > 0 && e.pos?.row === far).slice(0, r.count);
      for (const e of targets) applyStatus(draft, e, "ROOT", r.duration, 0, getDef(r.source.defId).element);
      if (targets.length) draft.log.push(`The creeping roots snare ${targets.length} in the far row.`);
    }
  }

  // 2. REGEN heals, then the end-of-round element auras.
  for (const card of boardCards(draft)) {
    const def = getDef(card.defId);
    // Innate REGEN plus any GRANTED, timed heal-over-time (Gecko's Tail Drop
    // regrow), which ticks its own countdown down.
    let regen = Number(def.keywords.REGEN ?? 0);
    // THE WELL (Domination): standing on the crossroads grants a heal-over-time.
    // Granted BEFORE the tick below, so a card is mended the same round it
    // arrives rather than a round later — and refreshed every round it stays,
    // so holding the square is what keeps it topped up.
    //
    // The heal KEEPS RUNNING after the card steps off, which is what makes the
    // Well worth a detour instead of worth camping on.
    const wellMap = draft.domination ? dominationMap(draft.domination.mapId) : undefined;
    if (wellMap?.well && card.pos && card.curHp > 0
        && card.pos.row === wellMap.well.at.row && card.pos.col === wellMap.well.at.col) {
      card.regenPower = Math.max(card.regenPower ?? 0, wellMap.well.hp);
      card.regenRoundsLeft = Math.max(card.regenRoundsLeft ?? 0, wellMap.well.rounds);
      draft.log.push(`${label(draft, card)} drinks from the Well (+${wellMap.well.hp} HP for ${wellMap.well.rounds} rounds).`);
    }
    if ((card.regenRoundsLeft ?? 0) > 0) {
      regen += card.regenPower ?? 0;
      card.regenRoundsLeft = (card.regenRoundsLeft ?? 0) - 1;
    }
    if (regen > 0 && healCard(draft, card, regen, card) > 0) {
      draft.log.push(`${label(draft, card)} regenerates ${regen}.`);
    }
    // Shell Tuck's shaky aim wears off.
    if ((card.attackMissRounds ?? 0) > 0) card.attackMissRounds = (card.attackMissRounds ?? 0) - 1;
    // Adamantize / Diamond Kingdom's granted BLOCK fades.
    if ((card.blockRoundsLeft ?? 0) > 0) card.blockRoundsLeft = (card.blockRoundsLeft ?? 0) - 1;
    // Magnetic Shield's granted REFLECT fades.
    if ((card.reflectRoundsLeft ?? 0) > 0) card.reflectRoundsLeft = (card.reflectRoundsLeft ?? 0) - 1;
    // Anglerfish's Lure fades.
    if ((card.incomingMissRounds ?? 0) > 0) card.incomingMissRounds = (card.incomingMissRounds ?? 0) - 1;
    // A special-lockout (Diagnosis / Red Shift / Magic Ropes) wears off.
    if ((card.specialLockedRounds ?? 0) > 0) card.specialLockedRounds = (card.specialLockedRounds ?? 0) - 1;
    // BlastOff's temporary flight fades.
    if ((card.flyingRoundsLeft ?? 0) > 0) card.flyingRoundsLeft = (card.flyingRoundsLeft ?? 0) - 1;
    // Mind Bubble Channeling (Serenos): pay out this round's tick.
    if ((card.channelBuffRounds ?? 0) > 0) {
      if (card.channelBuffDmg) card.dmgBonus += card.channelBuffDmg;
      if (card.channelBuffHeal) healCard(draft, card, card.channelBuffHeal, card);
      card.statuses = card.statuses.filter((s) => !NEGATIVE_STATUSES.includes(s.kind)); // full self-CLEANSE
      card.channelBuffRounds = (card.channelBuffRounds ?? 0) - 1;
      draft.log.push(`${label(draft, card)}'s bubble mends it (+${card.channelBuffDmg ?? 0} DMG, +${card.channelBuffHeal ?? 0} HP).`);
    }
    // Liquid Serenity (Serenos): reward a round spent NOT attacking.
    const idle = getDef(card.defId).idleBuff;
    if (idle && !card.attackedThisRound && card.curHp > 0) {
      healCard(draft, card, idle.heal, card);
      applyTimedBuff(card, idle.dmg, 0, 1);
      draft.log.push(`${label(draft, card)} rests in serenity (+${idle.heal} HP, +${idle.dmg} DMG next round).`);
    }
    // Photosynthesis (LEAF): +2 HP each round — and when there is nothing to
    // heal, the growth hardens into armour instead (+1 shield, capped).
    // Awakening (DAWN): the light burns one affliction off every DAWN card each
    // round — ONE status, oldest first, so a stack of debuffs is peeled rather
    // than wiped. Runs before the duration tick below, so the cleansed status is
    // gone for good rather than merely shortened.
    // `hasElementAura`, not `def.element ===`, at every aura gate — a card that
    // BORROWS an element (SirCrest) carries its aura, the inspector prints that
    // it does, and the summon and on-hit hooks already honoured it. These
    // end-of-round ones did not, so a borrower would have been advertising an
    // aura that never fired. No card borrows DAWN/LEAF/GALE today, so this
    // changes nothing now and stops being a trap the moment one does.
    if (hasElementAura(def, "DAWN")) {
      const i = card.statuses.findIndex((st) => NEGATIVE_STATUSES.includes(st.kind));
      if (i >= 0) {
        const [gone] = card.statuses.splice(i, 1);
        draft.log.push(`${label(draft, card)} burns off ${gone.kind} in the dawn light.`);
      }
      // First Light: the day gets on with it — +1 SP each round, to a low cap.
      //
      // Measured: DAWN ends matches with MORE cards standing than its opponent
      // (3.31 vs 3.05) on even gold, and still loses. It is not being beaten off
      // the board, it is losing the race to it — 99.5% of games end by capture,
      // and DAWN is the most EXPENSIVE element in the game (avg cost 4.1) and
      // the second slowest (avg SP 6.9). It buys bodies that hold ground they
      // cannot then advance from. This converts that surviving board into tempo.
      //
      // Deliberately weaker than GALE's Zephyr (+2 a round to SP 21, plus a
      // one-time +1 DMG at 15): speed is GALE's identity, and this is a nudge
      // off the floor rather than a second speed element.
      const curSp = def.sp + card.spBonus;
      if (curSp < DAWN_SP_CAP) card.spBonus += Math.min(1, DAWN_SP_CAP - curSp);
    }
    // Discharge (ARC): at the end of every round, an ARC card sheds a quarter
    // of its CURRENT basic-attack damage (bonuses included, floored) to every
    // opponent within its own reach. Through tickDamage, so a Discharge kill
    // still fires the card's onKill, exactly as Radiation and Black Smoke do.
    // Guarded on curHp/pos because an earlier card's discharge this same loop
    // can have killed this one.
    //
    // THE BIG ONES ONLY — mythic and legendary. It shipped as a whole-tribe
    // passive across all fourteen ARC cards, and that was too wide in two ways:
    // it made every rank-and-file battery a source of free chip damage (nine
    // epics shedding 1 a round each, for nothing), and it is most of why BOLT
    // sits at the top of the table. Three carriers now — Arc, GigaVolt and Jack
    // Arc — which reads better besides: a dynamo hums, a battery does not.
    {
      // `hasArcDischarge` rather than an inline rarity check — the inspector
      // needs the same answer, and when this rule lived in two places the two
      // disagreed for four commits.
      if (hasArcDischarge(def) && card.curHp > 0 && card.pos) {
        const zap = Math.floor((effectiveDmg(draft, card) * effectiveBasicHits(card)) / ARC_DISCHARGE_DIVISOR);
        if (zap > 0) {
          const reach = def.attackType === "Melee" ? 1 : RANGED_REACH;
          const caught = enemyCards(draft, card.owner).filter(
            (e) => e.curHp > 0 && e.pos && chebyshev(card.pos!, e.pos) <= reach,
          );
          for (const e of caught) tickDamage(draft, card, e, zap, false);
          if (caught.length)
            draft.log.push(`${label(draft, card)} discharges — ${zap} DMG to ${caught.length} in reach.`);
        }
      }
    }
    if (hasElementAura(def, "LEAF")) {
      // Photosynthesis feeds on what the roots hold: +2 base, and +1 more for
      // every ROOTed opponent. It ties LEAF's two halves together — the element
      // that puts the most ROOT on the board now gets paid for doing it, so the
      // control half and the sustain half stop being separate cards' problems.
      // Naturally bounded by the board (there are only so many enemies to root),
      // so no cap is needed beyond that.
      const rooted = enemyCards(draft, card.owner)
        .filter((e) => e.curHp > 0 && hasStatus(e, "ROOT")).length;
      healCard(draft, card, 2 + rooted, card);
      if (rooted > 0)
        draft.log.push(`${label(draft, card)} drinks deep — ${rooted} rooted (+${rooted} HP).`);
      // The bark thickens where it was struck: a LEAF card that TOOK a hit this
      // round banks +1 shield, capped. Read before step 4b clears the counter.
      //
      // This trigger replaced "when at full health", which measured almost
      // nothing: in the seat where LEAF actually needed help it was under fire
      // every round, so it always took the heal branch and never reached full
      // health to bank anything. The armour paid out only when it was already
      // winning the exchange. Now it pays when it is losing one.
      // ONE SHIELD PER HIT, not one per round. It used to bank a flat +1 no
      // matter how hard the round went, so a LEAF card hit three times was
      // armoured exactly as well as one grazed once — which read as the aura
      // being broken. Scales like Squanch's Regenerative below, which is the
      // same idea and always did count hits.
      //
      // A FLAT CEILING, not printed-plus-cap. It was `def.shields +
      // LEAF_SHIELD_CAP`, which handed an armoured LEAF card three shields ON
      // TOP of what it prints every round it was struck — so it ended rounds
      // harder to kill than it started, which is a stall engine rather than a
      // comeback. Bark regrows to a fixed line and stops there.
      const barkCeiling = LEAF_SHIELD_CAP;
      if (card.hitsTakenThisRound > 0 && card.curShields < barkCeiling) {
        const grown = Math.min(barkCeiling - card.curShields, card.hitsTakenThisRound);
        card.curShields += grown;
        draft.log.push(`${label(draft, card)}'s bark thickens where it was struck (+${grown} shield${grown > 1 ? "s" : ""}).`);
      }
    }
    // The Cost-10 permanent engines (Mountain's Fall, Eternal Dawn, Tsunami,
    // Heart of the Forest). Read from the OWNER's record, so a card summoned
    // after the spell resolved is covered too.
    const perm = draft.players[card.owner].elementPerm;
    if (perm && def.element === perm.element) {
      if (perm.shieldPerRound) card.curShields += perm.shieldPerRound;
      if (perm.healPerRound) healCard(draft, card, perm.healPerRound, card);
    }
    // CREEPING DARK (DUSK): a DUSK card in contact with an enemy drains a little
    // life out of it each round, and keeps it. See DUSK_DRAIN for why the
    // element needed something that works while it is winning.
    //
    // The victim is chosen by LOWEST HP, ties broken by instance id — this runs
    // on every DUSK card every round and a random pick would make the same
    // board play differently on a re-run. Lowest-HP is also the choice a player
    // would make: the drain is worth most when it finishes something.
    if (hasElementAura(def, "DUSK") && card.pos && card.curHp > 0) {
      const touching = enemyCards(draft, card.owner)
        .filter((e) => e.curHp > 0 && e.pos && chebyshev(card.pos!, e.pos) === 1)
        .sort((a, b) => a.curHp - b.curHp || a.instanceId.localeCompare(b.instanceId));
      const victim = touching[0];
      if (victim) {
        const drained = Math.min(DUSK_DRAIN, victim.curHp);
        victim.curHp -= drained;
        noteDamageFx(victim, drained);
        healCard(draft, card, drained, card);
        draft.log.push(`${label(draft, card)} drinks from the dark (${drained} from ${label(draft, victim)}).`);
        if (victim.curHp <= 0) defeatCard(draft, victim, "Creeping Dark", card);
      }
    }

    // THE TIDE (AQUA): the Flow chosen at summon deepens every few rounds, a
    // smaller helping each time, only so many times. See AQUA_TIDE_EVERY for
    // why the element needed an engine at all.
    //
    // Keyed off the ROUND rather than a per-card timer, so a whole AQUA board
    // surges together and the player can count the next one — a tide, not four
    // independent egg timers. A card summoned late simply catches the tides
    // that are left, which is the cost of arriving late.
    if (hasElementAura(def, "AQUA") && card.flowMode
        && draft.round % AQUA_TIDE_EVERY === 0
        && (card.tideTicks ?? 0) < AQUA_TIDE_MAX) {
      card.tideTicks = (card.tideTicks ?? 0) + 1;
      // HALF a Flow, near enough: the summon pick is +2 DMG / +3 shields /
      // +4 SP, and these are the smaller echoes of it. Flat +1 DMG rather than
      // Liquid's +1 hit, because `applyFlow` guards multi-hit cards against a
      // per-hit blowout and an echo has no business reopening that.
      if (card.flowMode === "water") card.dmgBonus += 1;
      else if (card.flowMode === "ice") card.curShields += 1;
      else card.spBonus += 2;
      draft.log.push(`${label(draft, card)} — the tide comes in (${card.tideTicks}/${AQUA_TIDE_MAX}).`);
    }

    // Zephyr (GALE): +2 SP each round (total capped at 21). The first time its
    // speed pushes past 15, a one-time +1 DMG (not a per-round ramp).
    if (hasElementAura(def, "GALE")) {
      const curSp = def.sp + card.spBonus;
      if (curSp < GALE_SP_CAP) card.spBonus += Math.min(2, GALE_SP_CAP - curSp);
      if (!card.zephyrBoosted && def.sp + card.spBonus > 15) {
        card.dmgBonus += 1;
        card.zephyrBoosted = true;
      }
    }
    // Field per-round buffs: REGEN (Lushfield/Blazing Sun), shields (Downpour).
    const fRegen = fieldBonus(draft, card, "regen");
    if (fRegen > 0 && healCard(draft, card, fRegen, card) > 0)
      draft.log.push(`${label(draft, card)} draws +${fRegen} HP from the field.`);
    const fShield = fieldBonus(draft, card, "shield");
    if (fShield > 0) card.curShields += fShield;
    // Regenerative (Squanch): bark back over every hit it soaked this round —
    // one hit, one shield — until it's sitting on the cap.
    const sph = def.shieldPerHitTaken;
    if (sph && card.hitsTakenThisRound > 0) {
      const cap = sph.maxShields ?? Infinity;
      const grown = Math.min(cap - card.curShields, card.hitsTakenThisRound * sph.shields);
      if (grown > 0) {
        card.curShields += grown;
        draft.log.push(`${label(draft, card)} regrows bark (+${grown} shield${grown > 1 ? "s" : ""}).`);
      }
    }
    // Shield auras (The Deepest's Pressure): regenerate the aura's shields each
    // round, +bonus per turn up to printed + aura shields. Was an instant refill
    // to that ceiling (Math.max), so a card that lost several shields regained
    // them all in one round — reads as "gains 2+ per turn". Now it trickles the
    // aura value (e.g. +1) per round, which is both what the number promises and
    // a fair rein on BORE's shield sustain.
    const shieldBonus = auraShieldBonus(draft, card);
    if (shieldBonus > 0)
      card.curShields = Math.min(def.shields + shieldBonus, card.curShields + shieldBonus);
    // Clamp HP to effective max — in case a maxHP aura (SeaC) just dropped.
    card.curHp = Math.min(card.curHp, effectiveMaxHp(draft, card));
  }

  // 3. Status durations tick down; expired statuses removed. Heatwave (PYRO
  //    field) freezes BURN on its owner's ENEMIES — their BURN never ticks while
  //    the field is up, so it keeps burning until the field lifts.
  for (const card of boardCards(draft)) {
    // Heatwave (PYRO field) freezes BURN on its owner's ENEMIES — their BURN
    // never ticks while the field is up, so it keeps burning until it lifts.
    const burnFrozen = draft.fields.some((f) => f.burnPersists && f.owner === enemyOf(card.owner));
    for (const s of card.statuses) {
      if (burnFrozen && s.kind === "BURN") continue;
      s.duration--;
    }
    card.statuses = card.statuses.filter((s) => s.duration > 0);
  }

  // 3b. Walls decay a round; expired ones lift.
  for (const w of draft.walls) w.roundsLeft--;
  const fallen = draft.walls.filter((w) => w.roundsLeft <= 0);
  for (const w of fallen) draft.log.push(`${getSpell(w.spellId).name} fades from row ${w.row}.`);
  draft.walls = draft.walls.filter((w) => w.roundsLeft > 0);

  // 3c. Fields decay a round; expired ones lift.
  for (const p of seatsOf(draft)) {
    const left = draft.players[p].burnBoostRounds ?? 0;
    if (left > 0) draft.players[p].burnBoostRounds = left - 1;
    const fog = draft.players[p].foggedRounds ?? 0;
    if (fog > 0) draft.players[p].foggedRounds = fog - 1;
    const splash = draft.players[p].basicSplashRounds ?? 0;
    if (splash > 0) draft.players[p].basicSplashRounds = splash - 1;
    // Midnight Shade: the shadows lift once their round is past. An absolute
    // round, not a countdown, because every fresh DUSK death refreshes the whole
    // stack's window rather than each corpse carrying its own timer.
    const shadeUntil = draft.players[p].shadeUntilRound;
    if (shadeUntil !== undefined && draft.round >= shadeUntil) {
      draft.players[p].shadeStacks = 0;
      draft.players[p].shadeUntilRound = undefined;
    }
  }
  // Standing terrain never ticks down — it is the battlefield, not a spell.
  for (const f of draft.fields) if (!f.permanent) f.roundsLeft--;
  for (const f of draft.fields.filter((f) => f.roundsLeft <= 0))
    draft.log.push(`${getSpell(f.spellId).name} fades from the battlefield.`);
  draft.fields = draft.fields.filter((f) => f.roundsLeft > 0);

  // 3c. Kamikaze (Beebot's Stinger Buzz): anything that dies the round it acts
  //      goes now — while attackedThisRound is still set, since step 4 below
  //      clears it. Its on-hit DOT was already applied and stays on the target.
  for (const card of boardCards(draft)) {
    if (getDef(card.defId).diesAfterAttacking && card.attackedThisRound && card.curHp > 0)
      defeatCard(draft, card, "spent its sting");
  }

  // 4. Clear round flags (STEALTH re-engages; summon lockout ends;
  //    special cooldowns tick down; per-round DMG buffs + hit tracking reset).
  // System Override lasts THIS round only — cleared with the other round-scoped
  // state so it cannot leak into the next.
  draft.players.P1.specialDiscountRound = 0;
  draft.players.P2.specialDiscountRound = 0;
  for (const card of boardCards(draft)) {
    card.summonedThisRound = false;
    card.attackedThisRound = false;
    card.movedThisRound = false;
    card.critsThisRound = 0; // Jackpot (Highroller) counts crits per round
    card.dmgTakenThisRound = 0; // Vengeance (Bolder) reflects only this round's damage
    card.weaponSwitchedRound = false; // Power Grab (General): one switch per round
    card.kingWildFiredRound = false; // King of the Wild (Leo): one buff per round
    card.allyKilledFiredRound = false; // Overwatch (Hartwood): one answer per round
    card.twinStrikeFiredRound = false; // Twin Strike (Twinbolt): one bonus volley per round
    card.oppSummonFiredRound = false;  // Drone Sweep (Buzzard): one answer per round
    card.hitSpawnFiredRound = false;   // Acorn Drop (Oak): one sprout per round
    card.onKillAoeFiredRound = false; // Powertrip re-arms each round
    card.dmgBonusRound = 0;
    card.spBonusRound = 0;
    card.hitsBonusRound = 0;
    card.struckThisRound = {};
    card.firstGuardUsedRound = false; // First Guard re-arms each round
    card.hitsTakenThisRound = 0; // Regenerative already cashed these in above
    card.fieldEvasionUsed = false; // Nightfall's cover returns next round
    // Timed DMG/SP buffs & debuffs tick down; expired ones drop off.
    for (const b of card.buffs) b.rounds--;
    card.buffs = card.buffs.filter((b) => b.rounds > 0);
    // Temporary shields ("for the turn", e.g. Flow Change Frozen) expire.
    if (card.tempShields > 0) {
      card.curShields = Math.max(0, card.curShields - card.tempShields);
      card.tempShields = 0;
    }
    if (card.specialCooldown > 0) card.specialCooldown--;
  }

  // 4b. Periodic self-driven passives (Sandstorm, Icy Swoop, Volt Turret,
  //     Fall's Emergence, War Maiden, …) resolve here, after statuses ticked.
  doRoundTicks(draft);

  // 5. Capture by survival: an enemy card still standing on a home slot at
  //    Cleanup captures it permanently.
  //
  //    NOT IN A VOID TOWER FIGHT, and this half is as load-bearing as turning
  //    off the capture WIN below. Taking the win condition away while leaving
  //    the mechanic running produced the worst state in the game: the boss
  //    walked its brood onto all five of the player's home slots and locked
  //    them permanently, so the player could never summon again — "Home row
  //    full", a hand they cannot play, and no win condition left to end it.
  //    Not losing; unable to continue, for thirty more rounds until the clock
  //    ran out. A capture that cannot win the game has no business being
  //    permanent.
  //
  //    Bodies can still STAND on a home row and block the slot they occupy —
  //    that is ordinary board presence and killing the invader frees it again.
  //    What is gone is the permanent lock, in both directions: the player
  //    cannot padlock the boss's summoning row either, because the fight is
  //    supposed to be decided by reaching the boss, not by walling it in.
  // ...and DOMINATION has no Home row to capture. Leaving this on there did
  // real damage rather than nothing: the end rows are part of two Points, so a
  // capture PERMANENTLY locked ring squares that the objective is counted on —
  // nobody can stand on a captured slot ever again, so a Point could be quietly
  // whittled down to something neither side can contest.
  if (!draft.voidTower && !draft.domination) for (const player of seatsOf(draft)) {
    const row = homeRow(player, draft.boardSize);
    for (let col = 0; col < draft.boardSize; col++) {
      if (draft.slots[row][col].capturedBy) continue;
      const occ = cardAt(draft, row, col);
      if (occ && occ.owner !== player) {
        draft.slots[row][col].capturedBy = occ.owner;
        creditCapture(draft.stats, occ);
        draft.log.push(
          `${label(draft, occ)} survives on ${player}'s home slot ${col} — permanently captured!`,
        );
      }
    }
  }

  // 6a. A VOID TOWER fight is decided by the BOSS, and only by the boss.
  //
  //     Every one of these puzzles is stated as "kill the source" — ignore the
  //     brood and reach Rotroot, clear the kill-column and reach Skeleeze. Under
  //     the ordinary rules not one of them was ever settled that way: measured
  //     across seven bosses and three decks, 36 fights out of 36 ended by
  //     CAPTURE, several inside six rounds with the boss untouched at 91% HP.
  //     The fight was a race to five home slots that the boss won on sheer body
  //     count, and the puzzle it was named for never came up. That is also why
  //     tuning the bosses did nothing: their damage, their locks and their
  //     spawns were not what decided anything.
  //
  //     So the slot race is off here and the boss IS the win condition. Kill it
  //     and you have solved the floor, whatever else is standing; the brood is
  //     the obstacle it was always described as rather than a second, faster
  //     way to lose. The boss still wins the ordinary way, by elimination —
  //     it does not need a shortcut, it needs you to have to come to it.
  //     Detected by ABSENCE, not by `curHp <= 0`: `defeatCard` deletes the
  //     instance outright, so a dead boss is not a zero-HP body still standing
  //     there to be found. The boss always seats as P2 (`voidBossSeat`, and a
  //     test pins it), so its absence is P1's win.
  //     A TAMED boss on the player's side does not count. It is boss-flagged
  //     and standing on the board, so without this exclusion the fight could
  //     never be won: you kill the thing you came for, your own loaner is still
  //     a boss, and the check says the floor is not yours.
  if (draft.voidTower
      && !boardCards(draft).some((c) => getDef(c.defId).boss && !c.tamed)) {
    draft.win = { winner: "P1", by: "slain" };
    draft.phase = "gameover";
    draft.log.push("The boss is slain — the floor is yours!");
    return;
  }

  // 6a. DOMINATION is scored on the Points and nothing else. It runs first
  //     because holding all four should end the match before any other rule
  //     gets a say, and it switches Home-row capture off below the way Void
  //     Tower does.
  if (resolveDomination(draft)) return;

  // 6. Win conditions — capture takes precedence if both trigger.
  for (const player of seatsOf(draft)) {
    if (!draft.voidTower && !draft.domination && hasCaptureWin(draft, player)) {
      draft.win = { winner: player, by: "capture" };
      draft.phase = "gameover";
      draft.log.push(`${player} WINS by capture!`);
      return;
    }
  }
  for (const player of seatsOf(draft)) {
    if (isEliminated(draft, enemyOf(player))) {
      draft.win = { winner: player, by: "elimination" };
      draft.phase = "gameover";
      draft.log.push(`${player} WINS by elimination!`);
      return;
    }
  }

  // 7z. OVERRUN: the boss holds every slot of the player's home row.
  //
  //      Void Tower turns the slot race off entirely — capture is disabled, the
  //      player wins by slaying and the boss by elimination or by running the
  //      clock out — which left the boss with no way to WIN the board, only to
  //      survive it. A brood that has physically taken your whole back line has
  //      beaten you, and should not have to wait out the clock to be told so.
  //
  //      Every slot, not a majority, AND THE BOSS ITSELF AMONG THEM. Checked by
  //      OCCUPANCY rather than by `capturedBy`, because capture is exactly the
  //      mechanic this mode switches off.
  //
  //      The boss requirement is the whole reason this rule is survivable.
  //      Without it the condition was won by CHAFF and took the mode over: four
  //      bosses closed 84-90% of their wins by standing in the back line,
  //      Overclock 90% of its fights on drones alone, and Nightshrike went from
  //      60.4% to 96.9% — the fight that had just been tuned to be fair became
  //      the hardest on the tower. A two-round hold barely dented it, because by
  //      the time a side holds all five slots the player has nothing left to
  //      spare to break one.
  //
  //      The cause was structural: capture is DISABLED in here, so enemies
  //      parked in the player's home row is an ordinary mid-game state. Attaching
  //      a loss to it turned the mode's default board into a defeat. Requiring
  //      the boss puts the thing you came to kill inside your own reach to do it,
  //      and it cannot be delivered by a drone.
  if (draft.voidTower) {
    const home = homeRow("P1", draft.boardSize);
    let held = 0;
    let bossInRow = false;
    for (let col = 0; col < draft.boardSize; col++) {
      const sitting = cardAt(draft, home, col);
      if (sitting && sitting.owner === "P2" && sitting.curHp > 0) {
        held++;
        // A tamed boss is yours; it cannot be part of an overrun OF you. (The
        // owner check above already scopes this to P2, so this is belt and
        // braces for a mirror — but the rule reads as "an enemy boss", so it
        // should say so.)
        if (getDef(sitting.defId).boss && !sitting.tamed) bossInRow = true;
      }
    }
    if (held === draft.boardSize && bossInRow) {
      draft.overrunHeld = (draft.overrunHeld ?? 0) + 1;
      if (draft.overrunHeld >= OVERRUN_HOLD_ROUNDS) {
        draft.win = { winner: "P2", by: "overrun" };
        draft.phase = "gameover";
        draft.log.push("Your home row is gone — the brood is standing in all of it.");
        return;
      }
      // The warning round. Said out loud, because a last-ditch loss you could
      // not see coming is just a rug pull.
      draft.log.push(
        "Your home row is overrun — break it before the end of the next round or the floor is lost.",
      );
    } else {
      draft.overrunHeld = 0;
    }
  }


  // 7a. A VOID TOWER fight runs on its own, much shorter clock, and running it
  //     out is how the BOSS wins. Not `decideOnTime`: that scores the board on
  //     slots, bodies and HP, and in here the only question that matters is
  //     whether the thing is dead. It is not. The floor keeps you.
  if (draft.voidTower && draft.round >= VOID_TOWER_ROUNDS) {
    draft.win = { winner: "P2", by: "timeout" };
    draft.phase = "gameover";
    draft.log.push("The floor holds — the boss outlasted you.");
    return;
  }

  // 7. Time limit. Nothing else in the engine bounds a match, so this is what
  //    stops a frozen board running forever.
  if (draft.round >= MAX_ROUNDS) {
    decideOnTime(draft);
    return;
  }

  startRound(draft);
}

// ── driver ──────────────────────────────────────────────────────────────────

/**
 * Which human player must act right now, or null when the driver can advance
 * (an AI is up, or a non-interactive phase is pending). Generalizes the old
 * P1-only check to support hot-seat 2-player.
 */
export function needsInput(state: GameState): PlayerId | null {
  const humans = state.humans ?? ["P1"];
  if (state.phase === "gameover") return null;
  if (state.phase === "mulligan") {
    for (const p of seatsOf(state))
      if (humans.includes(p) && !state.players[p].mulliganDone) return p;
    return null;
  }
  if (state.phase === "prep") {
    const pr = state.prep?.priority;
    return pr && humans.includes(pr) ? pr : null;
  }
  if (state.phase === "battle") {
    const a = state.battle?.awaitingInput;
    if (!a) return null;
    const owner = state.cards[a]?.owner;
    return owner && humans.includes(owner) ? owner : null;
  }
  return null;
}

/** Does the game currently need a human's input? (true = the driver must wait) */
export function needsP1Input(state: GameState): boolean {
  return needsInput(state) !== null;
}

/**
 * Advance one atomic step: resolve a non-interactive phase, one AI prep
 * intent, or one battle-queue entry. Returns the same reference when the
 * game is waiting on P1 (idempotent) — callers loop or setTimeout on it.
 */
export function advance(state: GameState): GameState {
  if (state.phase === "gameover") return state;
  if (needsP1Input(state)) return state;
  const draft = clone(state);

  switch (draft.phase) {
    case "mulligan": {
      // Auto-mulligan every AI (non-human) player that hasn't gone yet.
      for (const p of seatsOf(draft)) {
        if (!draft.humans.includes(p) && !draft.players[p].mulliganDone) {
          applyMulligan(draft, p, aiMulligan(draft, p));
        }
      }
      if (draft.players.P1.mulliganDone && draft.players.P2.mulliganDone) {
        if (draft.opening) startDeployment(draft);
        else startRound(draft);
      }
      return draft;
    }
    case "draw":
      doDrawPhase(draft);
      return draft;
    case "resource":
      doResourcePhase(draft);
      return draft;
    case "prep": {
      // AI priority turn: one intent per advance() call. Drive whichever player
      // holds priority — normally P2, but a fully-AI game (humans=[]) also drives
      // P1 here, so read the player from prep rather than defaulting to P2.
      const intent = aiPrepIntent(draft, draft.prep?.priority ?? "P2");
      return applyIntent(draft, intent);
    }
    case "battle": {
      stepBattle(draft);
      return draft;
    }
    case "cleanup":
      // cleanup runs synchronously at the end of stepBattle; nothing to do
      return draft;
    default:
      return draft;
  }
}

/** Run advance() until P1 input is needed or the game ends. For tests/headless. */
export function advanceUntilInput(state: GameState, maxSteps = 10_000): GameState {
  let cur = state;
  for (let i = 0; i < maxSteps; i++) {
    if (cur.phase === "gameover" || needsP1Input(cur)) return cur;
    cur = advance(cur);
  }
  throw new Error("advanceUntilInput: exceeded step budget (engine stuck?)");
}
