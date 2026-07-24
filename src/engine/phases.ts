// Phase reducers + the intent reducer + the advance() driver.
// All reducers clone the incoming state once and mutate only the clone.

import { getDef } from "../data/cards";
import { applyFlow, type FlowMode, GALE_SP_CAP, LEAF_SHIELD_CAP } from "./auras";
import { applyStatus, applyTimedBuff, basicAttack, matchesVsTarget, checkLowHpTransform, defeatCard, directDamage, effectiveBasicHits, label, onEnemySide, payAttackTrade, pushBack, spellHit, tickDamage, SPECIAL_HANDLERS } from "./combat";
import { getSpell } from "./spells";
import { creditCapture } from "./stats";
import { coin } from "./rng";
import {
  applyMulligan,
  boardCards,
  cardAt,
  chebyshev,
  drawCards,
  effectiveDmg,
  effectiveSp,
  fieldBonus,
  hasCaptureWin,
  hasStatus,
  auraShieldBonus,
  effectiveMaxHp,
  healCard,
  isEliminated,
  manhattan,
  spawnTokens,
  summonCard,
} from "./state";
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
  forwardAreaTargets,
  isActionBlocked,
  specialTargets,
  talentTargets,
  validTargets,
} from "./rules";
import type {
  CardInstance,
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
  isMidRow,
  MAX_ROUNDS,
  NEGATIVE_STATUSES,
  POOL_CARRYOVER_CAP,
  enemyOf,
  homeRow,
} from "./types";
import { chooseBattleAction, aiMulligan, aiPrepIntent } from "./ai";

function clone(state: GameState): GameState {
  return structuredClone(state);
}

/** Per-turn magic gain scales in 5-round brackets: rounds 1–5 give +1/turn,
 *  6–10 give +2, 11–15 give +3, and 16+ give +4 — so the endgame ramps fuel for
 *  Specials/spells. (Round 1 grants nothing; each side opens with a pool of 3.) */
function magicGainForRound(round: number): number {
  return Math.min(4, Math.ceil(round / 5));
}

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
      const check = canSummon(draft, intent.player, intent.handId, intent.col);
      if (!check.ok) throw new Error(`Illegal summon: ${check.reason}`);
      const p = draft.players[intent.player];
      const hand = p.hand.find((h) => h.handId === intent.handId)!;
      const def = getDef(hand.defId);
      p.hand = p.hand.filter((h) => h.handId !== intent.handId);
      p.gold -= def.cost;
      const inst = summonCard(draft, intent.player, hand.defId, {
        row: homeRow(intent.player, draft.boardSize),
        col: intent.col,
      });
      if (!draft.humans.includes(intent.player)) inst.autoMode = "full";
      draft.prep!.consecutivePasses = 0;
      draft.log.push(
        `${intent.player} summons ${def.name} (cost ${def.cost}) into column ${intent.col}.`,
      );
      // On-summon passive: fires immediately, free, via the handler registry.
      // `spread` (columns each side) uses the forward-area projection — the
      // blast reaches toward the enemy battlefield as far as the card's range
      // allows and hits the side columns; without it, targets are unscoped.
      if (def.onSummon) {
        const os = def.onSummon;
        const params = os.params ?? {};
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
              ? boardCards(draft, enemyOf(inst.owner)).filter(
                  (e) => e.curHp > 0 && e.pos?.row === homeRow(enemyOf(inst.owner), draft.boardSize),
                )
            : Number(params.spread ?? -1) >= 0
              ? forwardAreaTargets(draft, inst, Number(params.spread), params.forwardDepth != null ? Number(params.forwardDepth) : undefined)
              // No spread → every enemy in normal targeting range. For a melee
              // card that's king's-move reach (the 8 adjacent tiles). `false` =
              // not a basic attack, so a Ranged card's on-summon burst keeps its
              // full-board reach instead of being cut to the queen line.
              : validTargets(draft, inst.instanceId, false);
          // Dragon's Bane ambush: the on-summon shot only exists when there is
          // something worth ambushing. Without this filter it would fire at
          // whatever happened to be nearest.
          const picked = Number(params.onlyVsTarget ?? 0) > 0
            ? targets.filter((t) => matchesVsTarget(def, t))
            : targets;
          if (picked.length > 0) {
            const targets = picked;
            const handler = SPECIAL_HANDLERS[os.handler];
            if (!handler) throw new Error(`Unknown onSummon handler: ${os.handler}`);
            draft.log.push(`${def.name}'s on-summon passive triggers!`);
            handler(draft, inst, targets, params);
          }
        }
        // A self-buff status on summon (IcyNinza's Icy Mist — STEALTH for N rounds).
        if (os.selfStatus) {
          applyStatus(draft, inst, os.selfStatus, os.selfStatusDuration ?? 1, 0, def.element);
        }
      }
      // Brightest Warrior (Radiance): scale off the strongest opponent on summon.
      if (def.summonScaleFromEnemy) {
        const cfg = def.summonScaleFromEnemy;
        const topHp = boardCards(draft, enemyOf(inst.owner)).reduce(
          (m, e) => Math.max(m, effectiveMaxHp(draft, e)),
          0,
        );
        const n = Math.floor(topHp / cfg.per);
        if (n > 0) {
          if (cfg.maxHp) { inst.maxHp += n * cfg.maxHp; inst.curHp += n * cfg.maxHp; }
          if (cfg.dmg) inst.dmgBonus += n * cfg.dmg;
          draft.log.push(`${def.name} draws power from the strongest foe (+${n * (cfg.maxHp ?? 0)} HP, +${n * (cfg.dmg ?? 0)} DMG).`);
        }
      }
      // Token spawns (Trinezer's Reptilian Screech).
      if (def.summonSpawn)
        spawnTokens(draft, inst, def.summonSpawn.token, def.summonSpawn.count, def.summonSpawn.adjacentOnly ? 1 : def.summonSpawn.spawnRadius);
      // A permanent element grant already in force covers cards summoned after
      // it resolved — otherwise "for the rest of the game" would quietly mean
      // "for the cards that happened to be out".
      const permOnSummon = draft.players[inst.owner].elementPerm;
      if (permOnSummon && def.element === permOnSummon.element && permOnSummon.sp)
        inst.spBonus += permOnSummon.sp;
      const dmgPerm = draft.players[inst.owner].elementDmgBuff;
      if (dmgPerm && def.element === dmgPerm.element) inst.dmgBonus += dmgPerm.amount;
      applyElementSummonAura(draft, inst);
      // On-opponent-summon reactions: existing enemies zap the newcomer as it
      // enters the battlefield (Cave Guard, Shocker).
      for (const guard of boardCards(draft, enemyOf(inst.owner))) {
        const gd = getDef(guard.defId);
        if (!gd.onOppSummon || guard.curHp <= 0 || !draft.cards[inst.instanceId]) continue;
        // Only reacts to a newcomer it can actually reach (in targeting range).
        if (!canTarget(draft, guard, inst)) continue;
        if (gd.onOppSummon.dmg && inst.curHp > 0)
          directDamage(draft, guard, inst, gd.onOppSummon.dmg, false, Boolean(gd.onOppSummon.crit));
        const st = gd.onOppSummon.status;
        if (st && inst.curHp > 0 && draft.cards[inst.instanceId])
          applyStatus(draft, inst, st.kind, st.duration, st.power, gd.element);
      }
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
        shove.victim.pos = { ...shove.dest };
        draft.log.push(
          `${getDef(card.defId).name} bulls ${getDef(shove.victim.defId).name} back to r${shove.dest.row}c${shove.dest.col}.`,
        );
      }
      card.pos = { ...intent.to };
      draft.prep!.movedThisTurn = true;
      draft.prep!.consecutivePasses = 0;
      draft.log.push(
        `${intent.player} moves ${getDef(card.defId).name} to r${intent.to.row}c${intent.to.col}.`,
      );
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
      const stomp = getDef(card.defId).onEnterEnemySide;
      if (stomp && !wasOnEnemySide && card.curHp > 0 && onEnemySide(card, draft.boardSize)) {
        // The nearest opponent it can actually reach — a landing that finds
        // nobody simply does nothing.
        const prey = closest(card, boardCards(draft, enemyOf(card.owner)).filter(
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
      const slot = p.spellbook.find((s) => s.defId === intent.spellId)!;
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
      if (draft.prep.consecutivePasses >= 2) {
        startBattle(draft);
      } else {
        draft.prep.priority = enemyOf(intent.player);
        draft.prep.movedThisTurn = false;
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
      applyFlow(card, intent.mode as FlowMode, true);
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
      performBattleAction(draft, activeId, intent.action, picks);
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
    for (const e of boardCards(draft, enemyOf(player))) {
      if (!e.pos || e.pos.row !== row || getDef(e.defId).keywords.FLYING) continue;
      applyWall(draft, e, wall);
    }
    return;
  }

  if (spell.kind === "field" && spell.field) {
    // Board-wide terrain: buffs the caster's element allies for a few rounds.
    const { rounds, ...buff } = spell.field;
    draft.fields.push({ owner: player, spellId: spell.id, element: spell.element, roundsLeft: rounds, ...buff });
    draft.log.push(`${spell.name} blankets the battlefield for ${rounds} rounds.`);
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
  if (spell.specialDiscountRound) {
    const pl = draft.players[player];
    pl.specialDiscountRound = (pl.specialDiscountRound ?? 0) + spell.specialDiscountRound;
    draft.log.push(`${player}'s Specials cost ${spell.specialDiscountRound} less this round.`);
    return;
  }
  if (spell.revealHand) {
    // Pure information: the opposing hand is legible for the rest of this round.
    // Nothing on the board changes, which is the point of the card.
    draft.players[enemyOf(player)].handRevealedUntilRound = draft.round;
    draft.log.push(`${player} pings the network — the opposing hand is exposed this round.`);
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
    const targets = boardCards(draft, enemyOf(player)).filter((e) => e.curHp > 0 && inArea(e));
    for (const t of targets) {
      if (spell.dmg) {
        // doubleIf: a target meeting the condition takes 2× (Maelstrom / Tremor / Dawn's Judgment).
        const boosted =
          spell.doubleIf === "noShields" ? t.curShields === 0
          : spell.doubleIf ? hasStatus(t, spell.doubleIf)
          : false;
        spellHit(draft, t, boosted ? spell.dmg * 2 : spell.dmg, Boolean(spell.pen), player);
      }
      if (draft.cards[t.instanceId] && t.curHp > 0 && spell.status)
        applyStatus(draft, t, spell.status.kind, spell.status.duration, spell.status.power, spell.element);
    }
    draft.log.push(`${spell.name} sweeps ${targets.length} opponent(s)${targets.length ? "" : " — no one in range"}.`);
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
    const rooted = boardCards(draft, enemyOf(player)).some((c) => hasStatus(c, "ROOT"));
    const healAmt = rooted && spell.allyHealIfRooted ? spell.allyHealIfRooted : spell.allyHeal ?? 0;
    for (const ally of targets) {
      if (healAmt > 0) healCard(draft, ally, healAmt, player);
      if (spell.allyShield) ally.curShields += spell.allyShield;
      if (spell.allySp) ally.spBonus += spell.allySp;
      if (spell.allyStatus)
        applyStatus(draft, ally, spell.allyStatus.kind, spell.allyStatus.duration, spell.allyStatus.power, spell.element);
      if (spell.cleanse) cleanseCard(ally, spell.cleanse);
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
    // Withering Grasp: the damage dealt is fed straight back to an ally.
    if (spell.healAllyForDamage && spell.dmg) {
      const ally = pickSpellAlly(draft, player, spell.element);
      if (ally) healCard(draft, ally, spell.dmg, player);
    }
    if (alive && spell.drainMaxHp && target.maxHp > 1) {
      const steal = Math.min(spell.drainMaxHp, target.maxHp - 1);
      target.maxHp -= steal;
      target.curHp = Math.min(target.curHp, target.maxHp);
      const ally = pickSpellAlly(draft, player, spell.element);
      if (ally) {
        ally.maxHp += steal;
        ally.curHp += steal;
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
function triggerTrapOnMove(draft: GameState, card: CardInstance): void {
  if (!card.pos) return;
  const i = draft.traps.findIndex(
    (t) => t.owner !== card.owner && t.pos.row === card.pos!.row && t.pos.col === card.pos!.col,
  );
  if (i < 0) return;
  const trap = draft.traps[i];
  draft.traps.splice(i, 1); // spent on trigger, survivor or not
  const name = getSpell(trap.spellId).name;
  draft.log.push(`${label(draft, card)} steps on ${name}!`);
  const victims = [card];
  if (trap.splash) {
    // Inferno Pit: everything of the victim's side packed around the square.
    for (const e of boardCards(draft, card.owner))
      if (e.instanceId !== card.instanceId && e.pos && chebyshev(e.pos, trap.pos) <= 1)
        victims.push(e);
  }
  for (const v of victims) {
    if (!draft.cards[v.instanceId] || v.curHp <= 0) continue;
    if (trap.dmg > 0) spellHit(draft, v, trap.dmg, Boolean(trap.pen), trap.owner);
    if (trap.status && draft.cards[v.instanceId] && v.curHp > 0)
      applyStatus(draft, v, trap.status.kind, trap.status.duration, trap.status.power, trap.element);
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

/** The match hit MAX_ROUNDS. Decide it on progress toward the real win
 *  conditions rather than calling it off: home slots captured first (that IS
 *  the win condition), then cards left standing, then total HP. A null winner
 *  means all three were level — a true draw, and the UI says so. */
function decideOnTime(draft: GameState): void {
  const captured = (p: PlayerId) =>
    draft.slots.flat().filter((s) => s.capturedBy === p).length;
  const standing = (p: PlayerId) => boardCards(draft, p).length;
  const totalHp = (p: PlayerId) => boardCards(draft, p).reduce((n, c) => n + c.curHp, 0);

  let winner: PlayerId | null = null;
  let reason = "dead level";
  for (const [name, metric] of [
    ["home slots captured", captured],
    ["cards still standing", standing],
    ["total HP", totalHp],
  ] as [string, (p: PlayerId) => number][]) {
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

function startRound(draft: GameState): void {
  draft.round++;
  // Wake of the Dead: everything the caster killed during the armed round gets
  // back up on their side. Resolved HERE rather than on death so the count is
  // final — a card that revived (Zombie Husk) and fell again should not pay out
  // twice, and the stats ledger already de-duplicates that for us.
  for (const player of ["P1", "P2"] as PlayerId[]) {
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
  for (const player of ["P1", "P2"] as PlayerId[]) {
    const drawn = drawCards(draft, player, n);
    if (drawn > 0) draft.log.push(`${player} draws ${drawn}.`);
    // A draw cut short by a full hand (not an empty deck) — surface why.
    if (drawn < n && draft.players[player].hand.length >= HAND_CAP)
      draft.log.push(`${player}'s hand is full (${HAND_CAP}) — held the draw.`);
  }
  draft.phase = "resource";
}

function doResourcePhase(draft: GameState): void {
  // Two independent pools: summon = round # each round; magic starts at 0 and
  // drips every round (including round 1) in 5-round brackets (+1 through rounds
  // 1–5, +2 through 6–10, +3 through 11–15, +4 from 16 on) so the endgame has
  // fuel for Specials/spells. Both cap unspent carryover at 10.
  const gain = Math.min(draft.round, 10);
  const magicGain = magicGainForRound(draft.round);
  for (const player of ["P1", "P2"] as PlayerId[]) {
    const p = draft.players[player];
    p.gold = Math.min(p.gold, POOL_CARRYOVER_CAP) + gain;
    p.magicPool = Math.min(p.magicPool, POOL_CARRYOVER_CAP) + magicGain;
  }
  draft.log.push(`— Round ${draft.round}: summon +${gain}, magic +${magicGain}. —`);
  // Prep initiative alternates each round: the coin-flip winner preps first on
  // odd rounds, the opponent on even ones — so neither side keeps the first-mover
  // edge all game.
  const firstThisRound =
    draft.round % 2 === 1 ? draft.firstPlayer : enemyOf(draft.firstPlayer);
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
  // Speed queue: all cards SP 15→0, ties broken by seeded coin flip.
  const units = boardCards(draft).map((c) => ({
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
      // Self-buff Talent (Hawk's Glide Rush). Routed through the SHARED handler
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
    if (picks && picks.length > 1) {
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
    if (special.talent) {
      card.talentUsed = true; // once per game — no cost, no cooldown
    } else if (!wasFree) {
      draft.players[card.owner].magicPool -= effectiveSpecialCost(draft, card, special.cost);
      // 1-round floor; a printed longer cooldown overrides (+1 because the
      // current round's Cleanup ticks it once).
      card.specialCooldown = (special.cooldown ?? 1) + 1;
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
    const enemiesBefore = boardCards(draft, enemyOf(card.owner)).length;
    handler(draft, card, targets, special.params ?? {});
    // On Kill → grant a free recast next round (Volcanon's Eruption). Detect a
    // kill by the enemy board shrinking across the handler.
    if (
      special.params?.freeRecastOnKill &&
      draft.cards[card.instanceId] &&
      card.curHp > 0 &&
      boardCards(draft, enemyOf(card.owner)).length < enemiesBefore
    )
      card.freeSpecial = true;
    // Self-buff status on cast (Dive Bomb → STEALTH, Shadow Charge → EVASION,
    // Drilling Quake → re-STEALTH) — for any handler, once per Special.
    const selfSt = special.params?.selfStatus;
    if (typeof selfSt === "string" && selfSt && draft.cards[card.instanceId] && card.curHp > 0)
      applyStatus(draft, card, selfSt as StatusKind, Number(special.params?.selfStatusDuration ?? 1), 0, def.element);
    // Meltdown: light the channel. From here the roundTick keeps the attack
    // going every Cleanup until it is broken or paid out.
    if (Number(special.params?.startsChannel ?? 0) > 0 && draft.cards[card.instanceId] && card.curHp > 0) {
      // The opening eruption, free of the per-round HP toll (the cast already
      // paid magic for it), then the channel takes over from next Cleanup.
      const ch = def.roundTick?.channel;
      if (ch) {
        const hit = eruptRowAhead(draft, card, ch.rowAheadDmg);
        draft.log.push(`${label(draft, card)} erupts — ${hit} caught in the row ahead.`);
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
    performBattleAction(draft, id, choice.action, choice.targetId ? [choice.targetId] : undefined);
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
    performBattleAction(draft, id, choice.action, choice.targetId ? [choice.targetId] : undefined);
    battle.index++;
    return true;
  }
  if (canBasic) {
    // Auto-basic: attack the lowest-HP reachable target it can kill, else lowest HP.
    const targets = validTargets(draft, id);
    const pick = pickBasicTarget(draft, card, targets);
    performBattleAction(draft, id, "basic", [pick.instanceId]);
  } else {
    performBattleAction(draft, id, "skip");
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
  return pool.reduce((best, t) => (t.curHp < best.curHp ? t : best), pool[0]);
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
    // Allies in the row directly ahead of the caster.
    const targets = allies.filter((c) => c.pos?.row === aheadRow);
    for (const t of targets) t.curShields += amount;
    if (targets.length > 0)
      draft.log.push(`${getDef(caster.defId).name} reinforces ${targets.length} ally(ies) (+${amount} shields).`);
  } else if (handler === "buffSp") {
    caster.spBonus += amount;
    if (params.allAllies) {
      // Hastening Breeze (Whirlwolf): the whole team gains speed.
      for (const a of allies) a.spBonus += amount;
      draft.log.push(`${getDef(caster.defId).name} kicks up speed (+${amount} SP to all allies).`);
    } else {
      // Self + the nearest ally.
      const near = closest(caster, allies);
      if (near) near.spBonus += amount;
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
  for (const p of ["P1", "P2"] as PlayerId[]) {
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

/** Element auras that fire the moment a card is summoned. */
function applyElementSummonAura(draft: GameState, inst: CardInstance): void {
  const def = getDef(inst.defId);
  switch (def.element) {
    case "BORE": // Exostone — enters play with +2 shields.
      inst.curShields += 2;
      draft.log.push(`${def.name} hardens (Exostone +2 shields).`);
      break;
    case "AQUA": { // Flow Change — a 1-turn choice.
      if (draft.humans.includes(inst.owner)) {
        // Human chooses via the UI; gate until they pick.
        draft.pendingFlow = inst.instanceId;
      } else {
        applyFlow(inst, aiFlowChoice(def.cardClass), true); // summon pick persists
      }
      break;
    }
    case "DAWN": { // Awakening — strike the nearest enemy for half its DMG.
      const dmg = Math.floor(def.dmg / 2);
      if (dmg > 0) {
        const foe = closest(inst, boardCards(draft, enemyOf(inst.owner)).filter((c) => c.curHp > 0));
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
  const caught = boardCards(draft, enemyOf(card.owner)).filter((e) => e.curHp > 0 && e.pos?.row === ahead);
  for (const e of caught) tickDamage(draft, card, e, dmg, false);
  return caught.length;
}

/** Resolve every card's periodic (end-of-round) self-driven passive. Runs in
 *  Cleanup after DOT/REGEN and status-duration ticks. */
function doRoundTicks(draft: GameState): void {
  for (const card of boardCards(draft)) {
    if (card.curHp <= 0) continue;
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
    const enemies = () => boardCards(draft, enemyOf(card.owner)).filter((c) => c.curHp > 0);
    const allies = () => boardCards(draft, card.owner).filter((c) => c.curHp > 0);

    if (rt.buffDmgEveryN && draft.round % rt.buffDmgEveryN.n === 0) {
      card.dmgBonus += rt.buffDmgEveryN.amount;
      if (rt.buffDmgEveryN.sp) card.spBonus += rt.buffDmgEveryN.sp; // Dragon's Blade
      draft.log.push(`${label(draft, card)} sharpens (+${rt.buffDmgEveryN.amount} DMG${rt.buffDmgEveryN.sp ? ` +${rt.buffDmgEveryN.sp} SP` : ""}).`);
    }
    if (rt.aoeDmg) {
      for (const e of enemies()) tickDamage(draft, card, e, rt.aoeDmg, false);
      draft.log.push(`${label(draft, card)} sweeps the field (${rt.aoeDmg} DMG to all enemies).`);
    }
    if (rt.aoeStatus) {
      for (const e of enemies()) applyStatus(draft, e, rt.aoeStatus.kind, rt.aoeStatus.duration, rt.aoeStatus.power, el);
    }
    if (rt.inRangeStatus) {
      // Electrifying: the current arcs to whatever is close enough to touch.
      const marked = enemies().filter((e) => canTarget(draft, card, e));
      for (const e of marked)
        applyStatus(draft, e, rt.inRangeStatus.kind, rt.inRangeStatus.duration, rt.inRangeStatus.power, el);
      if (marked.length)
        draft.log.push(`${label(draft, card)} arcs — ${marked.length} opponent(s) ${rt.inRangeStatus.kind}.`);
    }
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
    if (rt.aoeElectrifiedDmg) {
      // Shoksa: the literal ELECTRIFIED status, which its own Special applies —
      // deliberately NOT the "carries any status" proxy Voltogon uses, so the
      // card combos with itself rather than with every DOT on the board.
      const zapped = enemies().filter((e) => hasStatus(e, "ELECTRIFIED") && canTarget(draft, card, e));
      for (const e of zapped) tickDamage(draft, card, e, rt.aoeElectrifiedDmg, false);
      if (zapped.length)
        draft.log.push(`${label(draft, card)} discharges into ${zapped.length} Electrified opponent(s).`);
    }
    if (rt.pushEnemies) {
      for (const e of enemies()) pushBack(draft, e, rt.pushEnemies, card.owner);
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
        eruptRowAhead(draft, card, rt.channel.rowAheadDmg);
        draft.log.push(`${label(draft, card)} erupts again (−${rt.channel.hpCost} HP).`);
      }
    }
    if (rt.rowAheadDmg && card.pos) {
      // Sweeping Flames: burn whatever stands in the row directly ahead.
      const ahead = card.owner === "P1" ? card.pos.row - 1 : card.pos.row + 1;
      for (const e of enemies()) if (e.pos && e.pos.row === ahead) tickDamage(draft, card, e, rt.rowAheadDmg, false);
    }
    if (rt.inRangeDmg) {
      // Black Smoke / Radiation: hit every opponent this card can reach (UFO's
      // radiation PENetrates shields).
      const hit = enemies().filter((e) => canTarget(draft, card, e));
      for (const e of hit) tickDamage(draft, card, e, rt.inRangeDmg, !!rt.inRangeDmgPen);
      if (hit.length) draft.log.push(`${label(draft, card)} hits ${hit.length === 1 ? "an enemy" : `${hit.length} enemies`} in range (${rt.inRangeDmg} DMG${rt.inRangeDmgPen ? " PEN" : ""}).`);
    }
    if (rt.selfShields) {
      // Royal Guard: replenish the guardian's shields each round.
      card.curShields += rt.selfShields;
      draft.log.push(`${label(draft, card)} raises its guard (+${rt.selfShields} shields).`);
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
    if (rt.aoeParalyzedDmg) {
      // Complete Circuit: current flows through every PARALYZED enemy in range.
      for (const e of enemies()) if (hasStatus(e, "PARALYZE") && canTarget(draft, card, e))
        tickDamage(draft, card, e, rt.aoeParalyzedDmg, false);
    }
    if (rt.spawn && !rt.selfHpCost) {
      // Reptilian Screech: spawn a token into an open king's-reach slot.
      // Guarded on selfHpCost: a spawn that charges HP (RIP's Dead Clock) is
      // handled by its own block above, tally and Horde trigger included.
      // Without the guard BOTH blocks ran and the clock raised two a round.
      spawnTokens(draft, card, rt.spawn.token, rt.spawn.count, rt.spawn.adjacentOnly ? 1 : rt.spawn.spawnRadius);
    }
    if (rt.pokeDmg || rt.pokeStatus) {
      const t = closest(card, enemies());
      if (t) {
        if (rt.pokeDmg) tickDamage(draft, card, t, rt.pokeDmg, false);
        if (rt.pokeStatus && draft.cards[t.instanceId] && t.curHp > 0)
          applyStatus(draft, t, rt.pokeStatus.kind, rt.pokeStatus.duration, rt.pokeStatus.power, el);
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
    if (rt.wardAllies) {
      // Radiant Ward: raise a single team-wide barrier (absorbs one status/round).
      draft.players[card.owner].statusWard = true;
    }
    if (rt.cleanseAllies) {
      // Crowned: wash the negative statuses off every ally.
      for (const a of allies())
        a.statuses = a.statuses.filter((s) => !NEGATIVE_STATUSES.includes(s.kind));
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
  const bleedDealtBy: Record<PlayerId, number> = { P1: 0, P2: 0 };
  for (const card of boardCards(draft)) {
    for (const s of card.statuses) {
      if (s.kind === "BLEED" || s.kind === "BURN" || s.kind === "SCALD" || s.kind === "DOT") {
        // Accelerator (Scorch): BURN on an enemy hits double while the side that
        // lit it is accelerating. Attributed from the VICTIM's side, the same
        // inference Lushfield uses — nobody burns their own cards.
        const boosted =
          s.kind === "BURN" && (draft.players[enemyOf(card.owner)].burnBoostRounds ?? 0) > 0;
        const dot = boosted ? s.power * 2 : s.power;
        card.curHp -= dot;
        if (s.kind === "BLEED") bleedDealtBy[enemyOf(card.owner)] += s.power;
        draft.log.push(`${label(draft, card)} takes ${dot} ${s.kind} damage${boosted ? " (accelerated)" : ""}.`);
        if (s.kind === "BURN" && card.curShields > 0) {
          card.curShields--;
          draft.log.push(`${label(draft, card)}'s shields melt (−1).`);
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

  // 2. REGEN heals, then the end-of-round element auras.
  for (const card of boardCards(draft)) {
    const def = getDef(card.defId);
    const regen = Number(def.keywords.REGEN ?? 0);
    if (regen > 0 && healCard(draft, card, regen, card) > 0) {
      draft.log.push(`${label(draft, card)} regenerates ${regen}.`);
    }
    // Photosynthesis (LEAF): +2 HP each round — and when there is nothing to
    // heal, the growth hardens into armour instead (+1 shield, capped).
    // It was +1 HP and NOTHING at full health, so the game's only defensive
    // aura paid out exactly when you were already losing and was dead weight
    // the rest of the time. LEAF measured worst on BOTH axes despite mid-pack
    // printed stats, which is what pointed at the aura rather than the cards.
    if (def.element === "LEAF") {
      healCard(draft, card, 2, card);
      // The bark thickens where it was struck: a LEAF card that TOOK a hit this
      // round banks +1 shield, capped. Read before step 4b clears the counter.
      //
      // This trigger replaced "when at full health", which measured almost
      // nothing: in the seat where LEAF actually needed help it was under fire
      // every round, so it always took the heal branch and never reached full
      // health to bank anything. The armour paid out only when it was already
      // winning the exchange. Now it pays when it is losing one.
      if (card.hitsTakenThisRound > 0 && card.curShields < LEAF_SHIELD_CAP) {
        card.curShields += 1;
        draft.log.push(`${label(draft, card)}'s bark thickens where it was struck (+1 shield).`);
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
    // Zephyr (GALE): +1 SP each round, total capped at 21.
    if (def.element === "GALE" && def.sp + card.spBonus < GALE_SP_CAP) card.spBonus += 1;
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
    // Shield auras (The DEEPEST's Pressure): top up to printed + aura shields.
    const shieldBonus = auraShieldBonus(draft, card);
    if (shieldBonus > 0) card.curShields = Math.max(card.curShields, def.shields + shieldBonus);
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
  for (const p of ["P1", "P2"] as PlayerId[]) {
    const left = draft.players[p].burnBoostRounds ?? 0;
    if (left > 0) draft.players[p].burnBoostRounds = left - 1;
  }
  for (const f of draft.fields) f.roundsLeft--;
  for (const f of draft.fields.filter((f) => f.roundsLeft <= 0))
    draft.log.push(`${getSpell(f.spellId).name} fades from the battlefield.`);
  draft.fields = draft.fields.filter((f) => f.roundsLeft > 0);

  // 4. Clear round flags (STEALTH re-engages; summon lockout ends;
  //    special cooldowns tick down; per-round DMG buffs + hit tracking reset).
  // System Override lasts THIS round only — cleared with the other round-scoped
  // state so it cannot leak into the next.
  draft.players.P1.specialDiscountRound = 0;
  draft.players.P2.specialDiscountRound = 0;
  for (const card of boardCards(draft)) {
    card.summonedThisRound = false;
    card.attackedThisRound = false;
    card.onKillAoeFiredRound = false; // Powertrip re-arms each round
    card.dmgBonusRound = 0;
    card.spBonusRound = 0;
    card.hitsBonusRound = 0;
    card.struckThisRound = {};
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
  for (const player of ["P1", "P2"] as PlayerId[]) {
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

  // 6. Win conditions — capture takes precedence if both trigger.
  for (const player of ["P1", "P2"] as PlayerId[]) {
    if (hasCaptureWin(draft, player)) {
      draft.win = { winner: player, by: "capture" };
      draft.phase = "gameover";
      draft.log.push(`${player} WINS by capture!`);
      return;
    }
  }
  for (const player of ["P1", "P2"] as PlayerId[]) {
    if (isEliminated(draft, enemyOf(player))) {
      draft.win = { winner: player, by: "elimination" };
      draft.phase = "gameover";
      draft.log.push(`${player} WINS by elimination!`);
      return;
    }
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
    for (const p of ["P1", "P2"] as PlayerId[])
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
      for (const p of ["P1", "P2"] as PlayerId[]) {
        if (!draft.humans.includes(p) && !draft.players[p].mulliganDone) {
          applyMulligan(draft, p, aiMulligan(draft));
        }
      }
      if (draft.players.P1.mulliganDone && draft.players.P2.mulliganDone) {
        startRound(draft);
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
      // AI priority turn: one intent per advance() call.
      const intent = aiPrepIntent(draft);
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
