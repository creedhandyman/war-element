// War Element — engine types. Pure data, no React.

export type PlayerId = "P1" | "P2";

export type Element =
  | "LEAF"
  | "AQUA"
  | "PYRO"
  | "BORE"
  | "GALE"
  | "BOLT"
  | "DUSK"
  | "DAWN";

export type CardClass =
  | "Assassin"
  | "Warrior"
  | "Tank"
  | "Ranger"
  | "Mage"
  | "Support";

export type AttackType = "Melee" | "Ranged";

export type Keyword =
  | "CRIT"
  | "PEN"
  | "FLYING"
  | "STEALTH"
  | "LIFESTEAL"
  | "REGEN"
  | "BLOCK"
  | "REFLECT"
  | "EVASION"
  | "DRAIN";

/** Prism's four single-use weapon buffs. Each is spent by the next basic
 *  attack the holder makes, and only one can be armed at a time. */
export type EnchantMode = "freezing" | "burning" | "sleeping" | "sharpen";

export type StatusKind =
  | "ROOT"
  | "BLEED"
  | "BURN"
  | "SCALD"
  | "DOT" // generic, element-free
  | "FREEZE"
  | "STUN"
  | "WEAKEN"
  | "PARALYZE"
  | "MUTED"
  | "SLEEP"
  | "FRIGHTEN"
  | "BLIND"
  | "SEAL" // Bluflame (Sarra): cannot be healed while sealed
  /** Electrified (Jolt): inert on its own — it exists to BE a status, so BOLT's
   *  Electrify aura (+1 DMG vs any statused target) picks the marked card up. */
  | "ELECTRIFIED"
  // Buff statuses — a temporary grant of the like-named keyword, ticked down at
  // Cleanup (Dive Bomb → STEALTH, Shadow Charge → EVASION).
  | "STEALTH"
  | "EVASION";

/** Negative statuses — the ones Radiant Ward absorbs and Crowned cleanses.
 *  (STEALTH/EVASION are self-buffs and are excluded.) */
export const NEGATIVE_STATUSES: StatusKind[] = [
  "ROOT", "BLEED", "BURN", "SCALD", "DOT", "FREEZE", "STUN", "WEAKEN",
  "PARALYZE", "MUTED", "SLEEP", "FRIGHTEN", "BLIND", "SEAL", "ELECTRIFIED",
];

export interface StatusEffect {
  kind: StatusKind;
  duration: number; // rounds remaining; ticks down in Cleanup
  power: number; // DOT damage per round / stat delta; 0 when N/A
  source: Element;
}

export interface SpecialDef {
  name: string;
  cost: number; // paid from the MAGIC pool in Battle Phase
  handler: string; // key into the handler registry in combat.ts
  params?: Record<string, number | string>;
  /** "self" = the caster is the only target. Use it for Specials whose handler
   *  ignores `targets` entirely (empower, spawn, burrow); marking those "ally"
   *  makes the UI demand a pick from every ally on the board for an effect that
   *  never touches them. */
  targetSide: "enemy" | "ally" | "self";
  /** This special reaches like a Ranged attack (any slot) even on a Melee
   *  card — for "hit anywhere on the board" specials. */
  ranged?: boolean;
  /** Rounds locked out after firing. Omit for the standard 1-round floor;
   *  a card may print a longer cooldown (2/3/5). */
  cooldown?: number;
  /** Talent mode: the Special is FREE and fires only ONCE per game (no magic
   *  cost, no cooldown, gone after one use). Used when an Epic is demoted to
   *  Rare — its Special becomes a one-shot Talent. Reuses `card.talentUsed`. */
  talent?: boolean;
  text: string; // human-readable card text
}

/** Status a basic attack applies. Optional gating restores the printed
 *  "50% chance", "first time only", or "on the 2nd hit" riders. */
export interface OnHitStatusDef {
  kind: StatusKind;
  duration: number;
  power: number;
  chance?: number; // 0–100; omit = always
  firstHitOnly?: boolean; // only the first basic hit vs a given target each round
  onSecondHit?: boolean; // only from the 2nd+ basic hit vs a target in a round
  /** ADD this power onto an existing same-kind status instead of replacing it
   *  (Thorn's cumulative BLEED — each basic deepens the wound). */
  stack?: boolean;
  stackCap?: number; // ceiling for the stacked power
}

/** Thorns / retaliation when this card is hit by a MELEE attacker. */
export interface OnHitByMeleeDef {
  /** Answer RANGED attackers too (Windsor's Right Through Me, Jolt's
   *  Electrifying). Default false keeps the classic melee-only thorns. */
  anyAttacker?: boolean;
  chance?: number; // 0–100; omit = always
  dmg?: number; // direct damage back to the attacker
  pen?: boolean;
  status?: { kind: StatusKind; duration: number; power: number };
  doubleBurn?: boolean; // Hot Hot (Spitfire): double the attacker's BURN power
  spDrain?: number; // Fountain (Oxin): sap N SP from the melee attacker
}

/** Fires when this card's basic/special attack KILLS an enemy (per kill). */
export interface OnKillDef {
  buffDmg?: number; // permanent +DMG (stacks)
  buffDmgRound?: number; // +DMG for the rest of the round
  buffSp?: number; // permanent +SP
  buffHits?: number; // permanent +1 basic hit (stacks)
  buffMaxHp?: number; // permanent +max HP (Pyrogon)
  healSelf?: number; // heal self N
  gainShields?: number;
  aoeDmg?: number; // deal N to every reachable enemy
  blindInRange?: number; // Star Blaster (Raya): BLIND nearby enemies N rounds
  /** Perpetual Fog (Driftwraith): a kill cloaks it (and same-row same-element
   *  allies) in STEALTH for N rounds. */
  grantStealth?: number;
  /** Powertrip (Voltogon): deal N to every ELECTRIFIED enemy (= carrying any
   *  status, the BOLT proxy), at most once per round. */
  aoeDmgElectrified?: number;
  /** Harvester (Wedded Wraith): every kill raises another token. */
  spawnToken?: { token: string; count: number };
  /** Quadruple Strike (Birch): on a kill, hit the CLOSEST surviving enemy for
   *  dmg×hits (a shield-shredding follow-up, distinct from aoeDmg's spray). */
  nearestVolley?: { dmg: number; hits: number };
  /** Infinite Serpent (Hydrogon): on a kill, snipe the LOWEST-HP surviving
   *  opponent for `lowestHpDmg` — the serpent finishes the weak. */
  lowestHpDmg?: number;
  coinBonusDmg?: number; // coin flip: +this or +this−1 permanent DMG
  reduceSpecialCost?: number; // King Me (Heir): shave N off this card's Special cost per kill
  /** Static Charge (Static): on a kill, extend the named status on every enemy
   *  that already carries it by `rounds` (deepen the crowd-control). */
  extendStatus?: { kind: StatusKind; rounds: number };
  /** Dark Hunting (Darth): a kill lays a trap on the slot where the victim fell.
   *  The next enemy to MOVE onto it takes `dmg`, is ROOTed `rootDuration` rounds,
   *  and the killer LIFESTEALs the HP dealt — the same payload as his Special. */
  setTrap?: { dmg: number; rootDuration: number; lifesteal?: number };
}

/** A basic-attack conditional keyword that only applies vs a target already
 *  carrying `status` (e.g. LIFESTEAL vs ROOTed, CRIT vs PARALYZED). */
export interface VsStatusDef {
  status: StatusKind;
  /** Match ANY status instead of the named one — models "Electrified" (BOLT's
   *  "has a status") triggers, e.g. Zagphu's "vs Electrified OR PARALYZED". */
  anyStatus?: boolean;
  /** Bloodfire (leaf_pyro payoff): match only a target carrying BOTH BLEED and
   *  BURN (see isBloodfire). Amplify-style — the bonus applies while the DOTs
   *  persist; nothing is consumed. Overrides `status`/`anyStatus` matching. */
  bloodfire?: boolean;
  lifesteal?: boolean;
  crit?: boolean;
  bonusDmg?: number; // +DMG per hit
  dmgMult?: number; // multiply per-hit DMG (2 = double vs the status)
  healOnHit?: number; // heal self N when a hit lands on such a target
  pen?: boolean; // basic gains PEN vs such a target (Stingray's Piercing Pulse)
}

/** A periodic self-driven effect resolved in Cleanup (end of round). */
export interface RoundTickDef {
  /** Fire this tick ONCE — on the card's first end-of-round after it lands —
   *  instead of every round (Star's Raising Star). Gating on match round 1
   *  would be dead weight: Gold starts at 0, so nothing costing more
   *  than nothing is even on the board that round. */
  firstRoundOnly?: boolean;
  /** Scorched Fury (Magmadon): pay `hp` of its own each Cleanup to run `dmg`
   *  hotter for the NEXT round. Deliberately not RIP's `selfHpCost`, which is
   *  wired to the spawn clock — sharing that field would couple two unrelated
   *  cards' bleed rules. Floors at 1 HP: the passive is an engine, not a
   *  suicide timer. */
  selfBurnForDmg?: { hp: number; dmg: number };
  /** Meltdown (Magmadon): a SUSTAINED Special. Runs only while the card is
   *  channelling, costs `hpCost` every round it continues, and breaks on death,
   *  FREEZE or ROOT — the Special says "until frozen or rooted", so hard control
   *  is the counterplay it is priced against.
   *
   *  Its own field rather than a flag over the whole roundTick: Magmadon's
   *  Scorched Fury lives in that same tick and must keep running whether or not
   *  the Special is lit. Gating the tick wholesale silently switched the passive
   *  off, which is exactly what the first version did. */
  channel?: { hpCost: number; rowAheadDmg: number };
  rootedDmg?: number; // Trapper (Fallow): damage every ROOTed enemy, range-free
  /** Constriction (Python): while adjacent to an opponent, drain N HP from it at
   *  end of round — deal N to the nearest adjacent enemy and heal that much. */
  drainAdjacent?: number;
  /** Overheating (Heatsink Golem): end of round, N DMG to the closest opponent;
   *  DOUBLED when it's the same target as last round (heat builds up). */
  overheatDmg?: number;
  /** Emergency Support (Able) / Rescue Pack (St.Bern): heal every ally whose
   *  curHp is under `underHp` by `amount` at end of round. */
  healWoundedAllies?: { underHp: number; amount: number };
  /** Frosty Bites (Whintey): at end of round, ROOT one opponent whose effective
   *  SP is 0 for this many rounds. */
  rootZeroSp?: number;
  /** Magic Ropes (Ty): each round, lock this many in-range opponents out of
   *  their Specials for the coming round. */
  lockEnemySpecials?: number;
  /** Draining Siphon (Violet): at end of round, DRAIN N max HP from every
   *  opponent within 1 space. */
  drainMaxAdjacent?: number;
  /** Grounded (Season): ROOT the fastest opponent on the board for N rounds. */
  rootFastest?: number;
  /** Nature's Protection (Efy): refresh shields back UP TO N at end of round. */
  refreshShieldsTo?: number;
  /** Poisonous Roots (Ivey): apply this status to every ROOTed opponent each
   *  round (POISON on the rooted). */
  rootedStatus?: { kind: StatusKind; duration: number; power: number };
  /** Overload/Power Grid (Shock): PARALYZE every opponent under `underHp` HP for
   *  `rounds` at end of round. */
  paralyzeLowHp?: { underHp: number; rounds: number };
  /** Twisted Rush (Wailverine): deal N DMG to the enemy directly ahead; if it
   *  dies, Wailverine advances into its slot. Pair with firstRoundOnly. */
  pokeAheadAdvance?: number;
  /** Morning Dew (Sprinu): heal every ally of this element at end of round. */
  roundHealElement?: { element: Element; amount: number };
  aoeDmg?: number; // damage every enemy in range
  aoeStatus?: { kind: StatusKind; duration: number; power: number };
  lowestEnemyStatus?: { kind: StatusKind; duration: number; power: number };
  pokeDmg?: number; // damage the closest single enemy
  randomEnemyDmg?: number; // Walking Tree's fruit — damage ONE random living enemy
  randomEnemyStatus?: { kind: StatusKind; duration: number; power: number }; // Static Cloud — status the SAME random enemy
  pokeStatus?: { kind: StatusKind; duration: number; power: number };
  healAllies?: number; // heal every ally N
  healLowestAlly?: number; // heal the lowest-HP ally N
  healHomeRow?: number; // Blessed Light (Halo): heal allies on the caster's home row N
  healHomeRowElement?: number; // Petalfall (Sakuroot): heal SAME-element allies on the home row N
  allyInRangeShields?: number; // Reflection: grant N shields to allies within range each round
  healSelfToFull?: boolean; // Blub's Liquid Humidity — restore to full max HP
  /** +DMG (and optionally +SP) every Nth round, stacking (Dragon's Blade). */
  buffDmgEveryN?: { n: number; amount: number; sp?: number; hp?: number; maxTicks?: number };
  scaldFrozen?: number; // apply SCALD N to FROZEN enemies (Freezer Burn)
  paralyzeOne?: number; // PARALYZE one un-paralyzed enemy for N rounds
  pushEnemies?: number; // blow every enemy back N slots (Wind Guardian)
  rowAheadDmg?: number; // deal N DMG to enemies in the row directly ahead (Sweeping Flames)
  inRangeDmg?: number; // deal N DMG to EVERY opponent this card can reach (Smog's Black Smoke)
  /** Electrifying (Jolt): apply a status to every opponent this card can REACH
   *  at end of round. Distinct from aoeStatus, which ignores range and marks the
   *  whole enemy board. */
  inRangeStatus?: { kind: StatusKind; duration: number; power: number };
  inRangeDmgPen?: boolean; // make inRangeDmg PENetrate shields (UFO's Radiation)
  selfShields?: number; // gain N shields each round (Heir's Royal Guard)
  selfShieldsMax?: number; // cap the self-shield stack (Bark Shield: max 5)
  pokeParalyzedDmg?: number; // deal N DMG to one PARALYZED enemy in range (Sentry's Volt Turret)
  aoeParalyzedDmg?: number; // deal N DMG to EVERY PARALYZED enemy in range (Lytning's Complete Circuit)
  wardAllies?: boolean; // refresh a status-absorbing barrier on all allies (Solstice's Radiant Ward)
  cleanseAllies?: boolean; // strip all negative statuses from allies (Imperator's Crowned)
  /** Seed Roll (Acorn token): roll forward N rows toward the enemy home each
   *  round, stopping at the first occupied/captured slot or the board edge. */
  advance?: number;
  /** Spawn a token each round (Trinezer's Reptilian Screech). adjacentOnly =
   *  only into an open king's-reach slot; no spawn if none is open. */
  /** Wildfire (Scorch): re-apply a status to every opponent standing in THEIR
   *  home row, each round. The on-summon burst only catches whoever happens to
   *  be there at that instant — and enemies summon INTO that row, so without
   *  this the ground never stays lit and the card reads as doing nothing. */
  enemyHomeRowStatus?: { kind: StatusKind; duration: number; power: number };
  /** Shoksa: damage every ELECTRIFIED opponent in range at end of round. Reads
   *  the literal ELECTRIFIED status (what its own Special applies), NOT the
   *  "carries any status" proxy that onKill.aoeDmgElectrified uses. */
  aoeElectrifiedDmg?: number;
  spawn?: { token: string; count: number; adjacentOnly?: boolean; spawnRadius?: number };
  /** Dead Clock (RIP): the tick costs the ticker HP. Never self-lethal — it
   *  floors at 1, so the clock stalls rather than killing its own owner. */
  selfHpCost?: number;
  /** Horde (RIP): once `spawn` has raised this many bodies in total, fire the
   *  card's Special for free and reset the tally. */
  spawnTriggerAt?: number;
  /** Dead Clock leash (RIP): the clock won't wind — and pays no HP — while this
   *  many of its own tokens are already standing. Without it the only limit was
   *  running out of board, which is how RIP reached 14 husks. Killing one is
   *  what buys the horde its next body. A Horde burst may still overshoot it;
   *  the clock then stays jammed until the count falls back under. */
  spawnMaxAlive?: number;
}

/** A persistent per-card aura (Brood Command, GALE +SP, …): a flat DMG/SP buff
 *  to living allies matching `scope`. `match` names the tribe/class for those
 *  scopes; the `element` scope uses the aura-holder's own element. */
export interface AuraBonusDef {
  scope: "element" | "tribe" | "class" | "all" | "adjacent";
  match?: string;
  dmg?: number;
  sp?: number;
  maxHp?: number; // matching allies gain +N max HP while the holder lives (SeaC)
  pen?: boolean; // matching allies' basic attacks gain PEN (Blood Ruby)
  shields?: number; // matching allies are topped up to base+N shields each round (Pressure)
}

/** A temporary flat DMG/SP modifier with a Cleanup countdown. Positive = a buff
 *  (Golden Courage team +DMG), negative = a debuff (Mighty Winds −SP). */
export interface TimedBuff {
  dmg: number;
  sp: number;
  rounds: number;
}

/** On-death revival (Bearocks Hibernation): the first time this card would be
 *  defeated it instead survives at `heal` HP, optionally sleeping for `sleep`
 *  rounds. Once only. */
export interface OnReviveDef {
  heal: number;
  sleep?: number;
  /** Zombie Husk's Reanimation: instead of a one-time revive, come back with
   *  every base stat (DMG/HP/SP) reduced by `decay`, until a stat would hit 0 —
   *  then it stays dead. Revives at its (now lower) full HP. */
  decay?: number;
  /** Hard ceiling on how many times a decaying revive may fire. Without it the
   *  only limit is the stat floor, which let a 1-cost token soak three lives. */
  maxRevives?: number;
  /** Offspring (Weeds): after the guaranteed first revive, a `secondChance`%
   *  coin flip on the NEXT death grants one more revive. */
  secondChance?: number;
}

/** HP-threshold transformation (Skelider Dismount): the first time this card
 *  drops below `threshold` HP it fires once — deal `dmg`, lose `loseSp` SP, and
 *  (if loseSpecial) can no longer cast its Special. */
export interface OnLowHpDef {
  threshold: number;
  dmg?: number;
  loseSp?: number;
  loseSpecial?: boolean;
  // One-time positive surge when first dropping below threshold (Kraken's
  // From the Deep). Permanent, fires once (guarded by `transformed`).
  buffDmg?: number;
  buffSp?: number;
  gainShields?: number;
}

export interface CardDef {
  id: string; // stable unique key, e.g. 'leaf_sumerose'
  /** Art filename stem under /cards (defaults to `id`). Set when the PNG is
   *  named differently from the id (e.g. token/underscore variants). */
  art?: string;
  name: string;
  /** Collector rarity. Cosmetic today (drives a deck-builder badge); no engine
   *  effect. Older alpha cards leave it undefined. */
  rarity?: "mythic" | "legendary" | "epic" | "rare" | "common";
  element: Element;
  cardClass: CardClass;
  attackType: AttackType; // derived from class, stored for clarity
  cost: number; // 1–10
  dmg: number; // base damage per hit
  hits: number; // multi-hit count (1 = single); dmg × hits
  hp: number;
  sp: number; // 0–15 (GALE cap 21 out of alpha scope — no GALE cards)
  shields: number;
  keywords: Partial<Record<Keyword, number | true>>;
  /** Status applied by basic attacks that land at least one hit. */
  onHitStatus?: OnHitStatusDef;
  /** Thorns: retaliate when hit by a melee attacker. */
  onHitByMelee?: OnHitByMeleeDef;
  /** Jelly Shock (Jellyfish): discharge when HIT and still standing — `dmg` to
   *  the attacker plus every enemy adjacent to this card. Unlike thorns it
   *  answers RANGED attackers too, and it splashes rather than hitting one. */
  onHitZap?: {
    dmg: number;
    status?: { kind: StatusKind; duration: number; power: number };
  };
  /** On-kill trigger (this card's attack defeats an enemy). */
  onKill?: OnKillDef;
  /** Conditional basic-attack keyword vs a target carrying a status. */
  vsStatus?: VsStatusDef;
  /** Dragon's Bane (Drakonbane): a bonus keyed on WHAT the target IS rather
   *  than what status it carries — a tribe, or simply a big enough body. The
   *  two conditions are OR'd: either one makes a target "bane-worthy".
   *
   *  `hpAbove` reads CURRENT HP, not max. A wounded giant stops being the thing
   *  a bane hunter is built to kill, which is also what keeps a cost-4 card
   *  from carrying a permanent +2 against the whole top of the curve. */
  vsTarget?: { tribe?: string; hpAbove?: number; bonusDmg?: number };
  /** Swamp Monster (Magalogoon): stealth as a CONDITIONAL passive, not a
   *  standing keyword. The card is hidden ONLY while it has neither moved nor
   *  attacked this round — so it is never "always" stealthed the way the STEALTH
   *  keyword is. Read exclusively through isStealthed(). */
  stealthWhenIdle?: boolean;
  /** Stinger Buzz (Beebot): a one-shot. The round it ATTACKS, it dies at that
   *  round's Cleanup — the sting is spent and the bee is gone. Its on-hit DOT
   *  still lands and still ticks; the corpse just doesn't linger. */
  diesAfterAttacking?: boolean;
  /** Harpoon Hook (Harp) / Sucker Sword (Octoirate): after a landed basic
   *  attack, drag the struck enemy this many slots toward the attacker —
   *  reeling a ranged/backline target into melee range. */
  pullOnAttack?: number;
  /** Tail Drop (Gecko): a once-per-game cheat-death. The first lethal blow
   *  leaves it at 1 HP instead, cloaked in STEALTH and regenerating as the tail
   *  regrows. */
  deathSave?: { stealth?: number; regen?: { power: number; rounds: number } };
  /** Boomer (Firecrack): the second+ basic hit against a given opponent deals
   *  DOUBLE base damage — a delayed detonation on the repeat strike. */
  boomer?: boolean;
  /** Braced Stance (Stormhide Bison): immune to knockback / pull — it plants and
   *  the storms other GALE cards ride wash over it. */
  pushImmune?: boolean;
  /** Flying Arrow (Ollie): also fires at whatever the ally directly in front of
   *  it just struck with a basic attack. */
  flyingArrow?: boolean;
  /** Sky Scout (Syt Bird): entering a Mid row lets allied basics hit +1 adjacent
   *  target for the round. */
  skyScout?: boolean;
  /** Crack Shot (Sling): when this card's CRIT coin lands, the hit also PIERCES —
   *  so the crit can fire against a shielded target and skip the shield. */
  critPen?: boolean;
  /** Overcharge (Volta): basic attacks gain PEN while any allied card whose id is
   *  in this list is alive on the board. */
  penWhileAlly?: string[];
  /** Electro Surge (Surge): a reactive charge. Starts active on summon and is
   *  re-armed by the Special, which also grants +`shield` and +`dmgBoost` DMG
   *  for `boostRounds` rounds. While active the card is status-immune (Surge
   *  Protector); the first time it's hit while active it PARALYZEs the attacker
   *  `paralyze` rounds and deactivates. */
  electroSurge?: { paralyze: number; shield: number; dmgBoost: number; boostRounds: number };
  /** Magic Potion (Hix): a landed basic hurls a random potion at the target —
   *  Poison (DOT 1), Damage (3), or Sleep (FRIGHTEN 2). */
  potionOnHit?: boolean;
  /** High Voltage Sentry (Voltcher) / BlastOff (FireFly): auto-fires this card's
   *  own Special for free on a first hit, on death, and/or on a kill.
   *  `grantFlyingRounds` grants temporary FLYING after an on-kill fire. */
  firePassiveSpecial?: { onFirstHit?: boolean; onDeath?: boolean; onKill?: boolean; grantFlyingRounds?: number };
  /** Jackpot (Striik): a basic CRIT auto-fires the Special free; `critsForBonus`
   *  crits in one round grants +bonusHp / +bonusDmg (once per round). */
  jackpot?: { critsForBonus: number; bonusHp: number; bonusDmg: number };
  /** Iron Ore (Bolder): take half damage (round down) from attackers of these
   *  classes. */
  blockVsClasses?: string[];
  /** Diamond's Edge (Sheish): basic attacks multiply their damage by this vs a
   *  SHIELDED target. */
  bonusVsShield?: number;
  /** Explosive Power (Dynomight): basics deal `mult`× damage vs any listed
   *  cardClass (e.g. Warrior/Tank). Stacks with bonusVsShield. */
  bonusVsClass?: { classes: string[]; mult: number };
  /** Icicle Weapon (Blackice): the card's basic DMG equals its CURRENT shields
   *  (its armour IS its weapon), instead of the printed dmg. */
  weaponFromShields?: boolean;
  /** Shatter (ICYNIN): a landed basic on a FROZEN target shatters the ice —
   *  `shatterFrozen` splash damage to enemies adjacent to it. */
  shatterFrozen?: number;
  /** Bounty (Scully): when an OPPONENT fires a Special, this card answers with a
   *  status on the caster (reactive burn). */
  onEnemySpecial?: { status: { kind: StatusKind; duration: number; power: number } };
  /** Graveyard (Destro): +1 DMG for every allied card that has died this game. */
  graveyardDmg?: boolean;
  /** Gaslighting (Liza): when any ALLY lands a kill, that ally gains +`dmg` DMG
   *  for `rounds` (until end of next round). */
  allyKillBuff?: { dmg: number; rounds: number };
  /** Extra element/class/tribe auras beyond the primary `aura` (Kloud's
   *  Mage+Ranged buff). */
  auras?: AuraBonusDef[];
  /** Extra ELEMENT auras this card carries beyond its own element (SirCrest,
   *  a DAWN mage who also wields PYRO Scorch and AQUA Flow Change). The card
   *  behaves as if it belonged to each listed element for aura purposes — its
   *  basics apply that element's on-hit aura, and it runs that element's
   *  on-summon aura when it lands. */
  elementAuras?: Element[];
  /** Golden Resonance (Lithara): each successful Special use grants +shields and
   *  +DMG (stacking). */
  onSpecialUse?: { shields: number; dmg: number };
  /** Brutal (Brute): a basic CRIT saps N DMG off the target's attacks for the
   *  round. */
  onCritDebuff?: number;
  /** Twin Strike (Ning): landing a CRIT fires a bonus `hits`×`dmg` CRIT strike
   *  at the same target, once per round. */
  onCritBonus?: { dmg: number; hits: number };
  /** Unpredictable (Ender): a SLOWER attacker (lower effective SP) has only a
   *  50% chance to hit — a conditional EVASION. */
  evadeVsSlower?: boolean;
  /** False Head (Thorny Ripper): the FIRST melee attack it takes each round
   *  strikes a decoy and deals no damage. Blanks the whole attack, not just one
   *  hit of it. */
  falseHead?: boolean;
  /** Ride or Die (Omega): Luna grants a permanent +dmg / +hp the moment it
   *  lands. Applied at instance creation so it never misses. */
  summonSelfBuff?: { dmg: number; hp: number };
  /** Lure (Anglerfish): on summon, attackers have `pct`% reduced accuracy against
   *  this card for `rounds` rounds. */
  lure?: { pct: number; rounds: number };
  /** Mega Push (Megair): while below `belowHp` HP, a landed basic also deals
   *  `dmg` to every opponent and pushes them all back `push` spaces. */
  lowHpNova?: { belowHp: number; dmg: number; push: number };
  /** Salvage (VVulture): whenever ANY card dies, gain `salvageOnDeath` max HP. */
  salvageOnDeath?: number;
  /** Blood Moon (Scar): when an opponent dies while this card lives, heal it and
   *  all its allies `deathHealAura` HP. */
  deathHealAura?: number;
  /** Diamond Kingdom (Diam): when an allied card of `element` dies while this
   *  card lives, grant the lowest-HP surviving ally BLOCK `block` for `rounds`. */
  blockOnAllyDeath?: { block: number; rounds: number; element?: string };
  /** Boom (Doom): a time bomb. After `afterRounds` Cleanups it detonates for
   *  `dmg` to every enemy, then dies. Inert until then (0 DMG on purpose). */
  boom?: { afterRounds: number; dmg: number };
  /** Unstable Core (Nitro): a final explosion — however this card dies, it
   *  deals `deathExplosion` to every opponent on the board. Handled in
   *  defeatCard (the ONE chokepoint every death path funnels through), so unlike
   *  onDeath.aoeDmg it also fires on tick / reflect / detonation deaths. */
  deathExplosion?: number;
  /** Acorn Drop (OAK): every landed hit it TAKES sprouts `count` token(s). */
  spawnOnHitTaken?: { token: string; count: number };
  /** Rainstorm (Rain): a landed basic also splashes N DMG to one adjacent enemy. */
  basicSplash?: number;
  /** Life Cycle (Aurora): this card fields Light Orbs — each incoming hit is
   *  absorbed by an orb that bursts its effect at the attacker, and every enemy
   *  death recharges one orb. */
  lightOrbs?: boolean;
  /** Vision Guard (Eagon): when hit, `onHitDeflect`% chance to take HALF damage
   *  and deal half that back to the attacker. */
  onHitDeflect?: number;
  /** King of the Wild (Leo): when an opponent is summoned (once/round), gain
   *  shields + DMG. */
  onOppSummonSelfBuff?: { shields: number; dmg: number };
  /** Power Grab (General): switchable basic-attack weapons. On move (once/round)
   *  it cycles to the next, paying that weapon's `spCost`, changing its basic's
   *  dmg × hits. Index 0 is the starting weapon. */
  weaponModes?: { name: string; dmg: number; hits: number; spCost: number }[];
  /** Raising Star (Star): a landed basic also heals every ally +N HP. */
  basicHealsTeam?: number;
  /** Liquid Serenity (Anos): at end of a round in which it did NOT attack, heal
   *  `heal` and gain `dmg` DMG for the next round. */
  idleBuff?: { heal: number; dmg: number };
  /** Elemental Fury (Prism): lands with its Special already paid for, so the
   *  first Enchantment is free. */
  startsWithFreeSpecial?: boolean;
  /** Prism's Special arms an Enchantment rather than doing anything itself. */
  enchanter?: boolean;
  /** Contagion (Zombination): while THIS card lives, the death of any friendly
   *  Zombie sprays 2 DMG to opponents beside the corpse. It is Zombination's
   *  aura — strictly its effect — so it stops the moment Zombination is gone,
   *  unlike a trait baked into the tribe. */
  contagionAura?: boolean;
  /** Hive Mind (Keeper): living allies of `tribe` soak up to `pct`% of the HP
   *  damage aimed at this card. Applied AFTER the shield gate, so it splits
   *  what would actually have reached HP — and capped by what the swarm can
   *  actually take, since a 3 HP Beebot cannot absorb 20. */
  hiveAbsorb?: { tribe: string; pct: number };
  /** Periodic self effect resolved each Cleanup. */
  roundTick?: RoundTickDef;
  /** On-death revival (Bearocks). */
  onRevive?: OnReviveDef;
  /** Root Growth (OAK): all healing this card receives is multiplied by N. */
  healReceivedMult?: number;
  /** Carnage (Zhunk): when any card of `tribe` dies anywhere, this card gains
   *  the listed permanent stat bumps. */
  onTribeDeath?: { tribe: string; dmg?: number; hp?: number; sp?: number };
  /** HP-threshold transformation (Skelider Dismount). */
  onLowHp?: OnLowHpDef;
  /** Reaction when an ENEMY card is summoned (Rock Goblin's Cave Guard,
   *  DrShock's Shocker): zap the newcomer with damage and/or a status. */
  onOppSummon?: {
    dmg?: number;
    /** The reaction shot can CRIT (Bluejay's Gustarrows). Same coin as any
     *  other CRIT — 50%, and only against an unshielded target. */
    crit?: boolean;
    status?: { kind: StatusKind; duration: number; power: number };
    /** Burning Bark (Sparky): first hop to the closest empty slot adjacent to
     *  the newcomer, then apply the reaction — chasing every fresh arrival. */
    chase?: boolean;
    /** Drone Sweep (Buzzard): instead of moving itself, drop this token into the
     *  closest empty slot beside the newcomer. The DRONE then deals `dmg` (it is
     *  adjacent by construction, so the guard's own reach never gates it). */
    spawnToken?: string;
  };
  /** This card's attacks do NOT wake SLEEPING targets (Sandman's Nightmare —
   *  his hits ignore SLEEP's break-on-hit rule). */
  ignoresSleepWake?: boolean;
  /** Bonus DMG on the FIRST basic attack this card lands against each distinct
   *  opponent (Klipso's Harsh Winds), once per opponent for the game. */
  firstStrikeBonus?: number;
  /** A flat bonus added ONCE to the total after a basic attack resolves (not
   *  per hit), gated on board conditions (Sandman). Lands on the primary target. */
  basicBonus?: {
    midLane?: number; // +N while this card sits in a Mid row
    midLaneFull?: number; // +N when 4+ cards occupy the Mid rows
    vsSleeping?: number; // +N when the primary target is SLEEPING
    flat?: number; // Quartz Hound (Stone): an unconditional extra N added to the volley
  };
  /** Ethereal Trade (Ghastly): every ATTACK — basic AND an offensive Special —
   *  deals +bonusDmg but the attacker pays hpCost HP once per attack (can be
   *  lethal, like a self-damage Special). */
  attackTrade?: { bonusDmg: number; hpCost: number };
  /** On summon, spawn `count` token cards (one-shot). The token's def lives in
   *  CARD_INDEX but never appears in a deck. */
  summonSpawn?: { token: string; count: number; adjacentOnly?: boolean; spawnRadius?: number };
  /** Brightest Warrior (Radiance): on summon, scale up by the strongest foe —
   *  +`dmg` DMG and/or +`maxHp` max HP for each `per` max-HP the highest-HP
   *  opponent on the board has. */
  summonScaleFromEnemy?: { per: number; dmg?: number; maxHp?: number };
  /** A permanent self-buff applied when a basic attack LANDS (once per attack):
   *  Volcanon's Bad Temper and the Rager Twins (+1 DMG on hit). */
  onHitSelfBuff?: { dmg: number };
  /** Regenerative (Squanch): a DEFENSIVE passive. At the end of each round it
   *  gains `shields` armor for every enemy hit it TOOK that round — one hit, one
   *  shield — until it is sitting on `maxShields` total. */
  shieldPerHitTaken?: { shields: number; maxShields?: number };
  /** Liquification (Bahari): heal N HP per landed basic hit (unconditional). */
  healPerHit?: number;
  /** Rager (Twins): while this card is below `hp` HP, its basic attacks deal
   *  `dmgMult`× damage (a rage downside). */
  weakBelowHp?: { hp: number; dmgMult: number };
  /** Scorched Fury's second half (Magmadon): a FLAT bonus once the card drops
   *  below `hp`. The mirror of weakBelowHp — a wounded volcano hits harder, not
   *  softer, which is what makes bleeding itself out a plan rather than a cost. */
  furyBelowHp?: { hp: number; dmg: number };
  /** Incinerate (Sol): consecutive hits on the same target within a round deal
   *  +1 DMG per hit (the ramp climbs with each landed hit). */
  incinerate?: boolean;
  /** Hillside (Hillbilly): when a basic attack lands, grant shields to allies in
   *  the row directly ahead. `firstTimeOnly` = only the first landed attack. */
  onHitAllyBuff?: { shields?: number; firstTimeOnly?: boolean };
  /** High Speed Impact (Hawk): +1 DMG per point of effective SP above 10. */
  highSpeedImpact?: boolean;
  /** Apex Predator (Stormfang): +1 DMG for every `per` SP above `above`. */
  speedDmgTiered?: { above: number; per: number };
  /** Lurk (Liquark): while STEALTHed, gain +`dmg` DMG and +`sp` SP. Attacking
   *  breaks the STEALTH (so the buffs drop); Bloody Waters' kill re-applies it. */
  lurk?: { dmg: number; sp: number };
  /** Volcanic Fury (Valcana): each landed basic grows +`onHitRampUntilSpecial`
   *  DMG, accumulating in `rampDmg` — wiped the moment her Special fires. */
  onHitRampUntilSpecial?: number;
  /** Hot Shot (Clipsey): attacks never miss — ignores the caster's own BLIND
   *  and the target's EVASION (200% accuracy / ignore-evasion). */
  alwaysHit?: boolean;
  /** Shadow (Vaga): can only be attacked by ADJACENT opponents — attackers a row
   *  or more away (incl. ranged) can't reach it. */
  onlyAdjacentAttackers?: boolean;
  /** Trample Through (WarPhant): in PREP it may step INTO an adjacent enemy with
   *  less effective max HP, shoving it one slot further along the same line and
   *  taking the vacated square. Needs the slot beyond the victim to be open and
   *  uncaptured — nothing is crushed against a wall or another body. */
  shoveWeaker?: boolean;
  /** This card rides something. Mounted cards move like a chess king in Prep —
   *  a diagonal costs one step, not two — the same footing FLYING already had.
   *  A mount that is LOST puts its rider back on foot: Skelider's Dismount sets
   *  `transformed`, and the king-move goes with it. */
  mounted?: boolean;
  /** Long Reach (Shadow Horsemen): a MELEE card whose BASIC attack also reaches
   *  up to N along the four straight lines — ahead, behind, and to either side.
   *  Diagonals are NOT extended; those stay at the usual adjacent step, so the
   *  threat range is a cross laid over the king-move square rather than a bigger
   *  box. Enemy bodies in between block it, the same rule ranged shots follow —
   *  a rider reaches PAST its own allies but not through an enemy front line.
   *  Basics only: melee Specials keep their own reach. */
  basicLineReach?: number;
  /** Echolocation (The DEEPEST): the card is BLIND and aims by sound. Its BASIC
   *  attack can only find a target that is either right beside it (king reach,
   *  chebyshev ≤ 1) or that MOVED this round — footsteps it can hear anywhere on
   *  the board. A stationary enemy out of arm's reach is silent and untargetable.
   *  Basics only; a board-wide Special (its Sinkhole quake) is felt through the
   *  ground and ignores this. */
  targetsOnSound?: boolean;
  /** Gate the firstStrikeBonus so it only applies while this card stands on the
   *  enemy battlefield (Vaga's Shadow first-strike). */
  firstStrikeEnemySideOnly?: boolean;
  /** Shadow Haunter (Ravven): its EVASION is CONDITIONAL — live only while the
   *  card stands on the enemy battlefield. On its own ground it dodges nothing,
   *  so the keyword is a raider's reward, not a permanent shield. Read through
   *  `hasEvasion()`, never `keywords.EVASION` directly, or the gate is skipped. */
  evasionEnemySideOnly?: boolean;
  /** Fallow's trapper aura: a landed CRIT pins whatever it hits. */
  critStatus?: { kind: StatusKind; duration: number; power: number };
  /** Brightling Ball (Shine): when an ALLY of this card is killed, it answers
   *  the killer. `oneUse` spends it for the rest of the game. */
  onAllyKilled?: {
    dmg?: number;
    status?: { kind: StatusKind; duration: number; power: number };
    oneUse?: boolean;
    /** Warden's Overwatch: answer at most once per ROUND (not once per game). */
    oncePerRound?: boolean;
  };
  /** Obsidian Claws (Obsidi): SP is replaced by this while the card is
   *  STEALTHed — underground it moves far faster than it does in the open. */
  spWhileStealthed?: number;
  /** Pride Guardian (Monger): the first time each ALLY takes a hit, this card
   *  throws it `shields`. Once per ally, tracked on the ally itself. */
  onAllyHitShield?: number;
  /** Morning Dew (Sprinu): its basic attack may be aimed at an ALLY, healing
   *  them for its DMG instead of striking. Allies become legal basic targets. */
  basicHealsAllies?: boolean;
  /** Gate Keeper (Veil): grant this many shields to SELF on summon (a passive
   *  grant, not a base stat, so it stays off the cost curve). */
  /** Display names for this card's passives, keyed by the def field each one
   *  comes from. The card face prints "Wind Wake — every landed hit shoves…"
   *  instead of an unnamed sentence. Per-CARD, not per-field, because the same
   *  mechanic is named differently on different cards: summonSelfShields is
   *  "War Ready" on WarPhant and "War Mount" on RohoJohn. */
  passiveNames?: Record<string, string>;
  /** Intimidation (Oakgre): while this card lives, every ENEMY within `rows`
   *  rows of it whose own DMG is LOWER than this card's loses `dmg` from its
   *  BASIC attacks. Unlike `aura` — which buffs allies by tribe/class/element —
   *  this reaches across the board and is gated on a live stat comparison, so a
   *  card that grows past the intimidator stops being cowed by it.
   *
   *  Only basics: it is read inside effectiveDmg, and Specials carry their own
   *  printed damage rather than routing through it. */
  intimidate?: { dmg: number; rows: number };
  /** Blinding Star (Supernova): while this card lives, opponents' basic attacks
   *  hit ONE fewer target — their extra/splash target is suppressed. */
  blindingStar?: boolean;
  /** Totem's team aura: while this card lives, its side's basic attacks also
   *  clip ONE extra adjacent target for full basic damage. (The mirror of
   *  Blinding Star; the two cancel out.) */
  splashAura?: boolean;
  /** Equestrian's aura: while it lives, its allies can't be WEAKENed (immune to
   *  stat reduction). */
  statDropImmuneAura?: boolean;
  /** Purelight (Halo): while it lives, its DAWN allies can't be BLINDed, and
   *  their attacks pierce enemy EVASION (light always finds its mark). */
  purelightAura?: boolean;
  summonSelfShields?: number;
  /** Fog Settlement (Misty): on summon, its owner's battlefield gains N rounds
   *  of the fog (see PlayerState.foggedRounds). */
  summonFog?: number;
  /** War Mount (RohoJohn): a mounted Ranger also mauls what it stands beside —
   *  its BASIC gains +N damage against a target inside melee reach. Modelled as
   *  a proximity bonus rather than a literal second attack, which keeps it on
   *  one damage path instead of inventing a dual-attack system. */
  meleeBonusDmg?: number;
  /** Stomp (Bootlegger): fires the moment this card MOVES onto the enemy half
   *  of the board (two-plus rows from its own home), once per crossing. */
  onEnterEnemySide?: { dmg: number; pen?: boolean };
  /** War Ready (WarPhant): shields gained on CROSSING into a Mid row. Read on
   *  both sides of the step like Stomp, so shuffling between two mid rows does
   *  not farm it. */
  onEnterMidRow?: { shields: number };
  /** Seed Roll (OAK): on summon, roll forward this many rows toward the enemy
   *  home, stopping at the first occupied/captured slot or the board edge. */
  summonAdvance?: number;
  /** Wind Wake (Wista): every landed hit shoves the victim back a slot. */
  onHitPush?: number;
  /** Gate Keeper (Veil): the first time this card's shields break to 0, gain
   *  these permanent buffs. */
  onShieldBreak?: { dmg?: number; sp?: number; status?: { kind: StatusKind; duration: number; power: number } };
  /** Rocky Force Field (Rhe): a coin-flip chance (0–100) to dodge a RANGED
   *  attacker's hit entirely. */
  blocksRangedChance?: number;
  /** Hastened Assault (WolfBane): basic attacks CRIT only when this card is
   *  faster (higher effective SP) than the target; `healPerCrit` heals on each
   *  critical hit landed. */
  critIfFaster?: boolean;
  healPerCrit?: number;
  /** Tribe tag (Reptile, Dragon, SeaC, Avian, …) — used by tribe-scoped auras
   *  and tribe payoffs. Free-text; no effect on its own. */
  tribe?: string | string[];
  /** A persistent per-card aura: while this card is alive on the board, it grants
   *  a flat DMG/SP bonus to matching living allies (incl. itself if it matches).
   *  Non-stacking — the single highest matching aura applies, never sums. */
  aura?: AuraBonusDef;
  /** A Talent: a FREE, once-per-game Battle-Phase ability (fired instead of a
   *  basic attack). After it fires the card reverts to passive-only. */
  talent?: { name: string; text: string; handler: string; params?: Record<string, number | string> };
  /** Catapult-style passives: this card may target the enemy Home row from
   *  anywhere (skips the Home Slot Targeting Rule). */
  ignoresHomeRule?: boolean;
  /** Hibernation-style passives: negative statuses never land on this card
   *  (ROOT/BURN/SLEEP/etc. are all refused). */
  statusImmune?: boolean;
  /** Transfusion (Thorn): at Cleanup, this card heals HP equal to the total
   *  BLEED damage dealt to its enemies that round (its own BLEED + any teammate
   *  BLEED). Capped at maxHp; no heal while dead. */
  healsFromBleed?: boolean;
  /** On-death retaliation (Lingering Venom / Bird Bomb): when this card is
   *  killed by an attack, deal dmg back to the killer. Direct damage — no
   *  evasion, no reflect chains. DOT/self-damage deaths have no killer.
   *  `rowAhead` (FireBird Burnout) instead blasts the enemy row directly ahead
   *  of where this card died, regardless of who the killer was. */
  onDeath?: {
    dmg: number;
    pen?: boolean;
    rowAhead?: boolean;
    /** Pop (Florence): as it dies, deal this to EVERY opponent immediately. */
    aoeDmg?: number;
    /** KaBoooom (Canister): on death, deal `dmg` to EVERY card on the board
     *  (both sides) except those of `exceptElement`. */
    boardBlast?: { dmg: number; exceptElement?: string };
    /** Out with a Bang (Taper): on death, apply a status to every opponent in
     *  their far (home) row. */
    farRowStatus?: { kind: StatusKind; duration: number; power: number };
    /** Meteor (Cosmic): as it dies it flags a strike that lands at the END of
     *  the round — `roundEndAoe` DMG to every opponent, fired from Cleanup. */
    roundEndAoe?: number;
    /** Last Waltz (Wedded Wraith): as she falls, every surviving ally of this
     *  tribe takes a permanent +DMG, and enemies in range are FRIGHTENed. */
    allyTribeBuffDmg?: { tribe: string; dmg: number };
    /** WarPhant: the rider survives the mount and keeps fighting. */
    spawnToken?: { token: string; count: number };
    frightenInRange?: number; // rounds of FRIGHTEN on reachable enemies
    /** Contagion (Zombination's zombies): damage to enemies ADJACENT TO THE
     *  SLOT IT FELL ON. Distinct from `dmg`, which retaliates against whoever
     *  landed the kill — a zombie bursting is not a grudge, so it hits whatever
     *  was standing next to it however it died. */
    /** Prism: as it falls it hands its armed Enchantment to an ally. Passes on
     *  whatever was actually loaded, or this mode when nothing was. */
    passEnchant?: EnchantMode;
    /** Lingering Venom (Widowbite): the killer is left carrying a status rather
     *  than just taking a hit back. Applied even when `dmg` is 0. */
    killerStatus?: { kind: StatusKind; duration: number; power: number };
    /** Gate the retaliation on the killer being within the DYING card's own
     *  attack reach, measured from the slot it fell on — a melee card's grudge
     *  can't cross the board, so a sniper picks it off unpunished. */
    inRangeOnly?: boolean;
  };
  /** On-summon passive (Fire Blast / Fury Unleashed): fires the moment the
   *  card lands, through the same handler registry as Specials. Free — not a
   *  Special, so no magic cost, no cooldown, no summon-turn lockout. Targets
   *  obey normal targeting rules; params.rowAhead=1 limits them to the row
   *  directly ahead of where it was summoned. */
  onSummon?: {
    /** Optional — omit for a pure self-status on-summon (IcyNinza's Icy Mist). */
    handler?: string;
    params?: Record<string, number | string>;
    /** Who the on-summon effect hits. Default "enemy". "ally" fires an ally
     *  handler (grantShield/buffSp/heal) on friendly cards in the forward area
     *  (Smith Reforged, Duster Dust Off). */
    targetSide?: "enemy" | "ally";
    /** A buff status the summoned card grants ITSELF (e.g. STEALTH for N rounds). */
    selfStatus?: StatusKind;
    selfStatusDuration?: number;
    /** IcyNinza's Icy Mist: while the self-status (STEALTH) is up, each kill
     *  extends its duration by this many rounds. */
    extendSelfStatusOnKill?: number;
  };
  special?: SpecialDef;
  // future: spells / traps / talents / auras beyond the LEAF alpha aura
}

export type AutoMode = "manual" | "basic" | "full";

/** A board coordinate. Plain numbers, not a 0|1|2|3 literal union: the union
 *  pinned the whole game to a 4×4 grid at the TYPE level, so no larger board was
 *  expressible. Bounds are enforced at runtime against `state.boardSize`
 *  (canSummon / canMoveTo / the walkers all range-check), not by the type. */
export interface Pos {
  row: number;
  col: number;
}

export interface CardInstance {
  instanceId: string;
  defId: string;
  owner: PlayerId;
  curHp: number;
  maxHp: number; // can grow/shrink via DRAIN
  curShields: number;
  dmgBonus: number; // permanent DMG modifiers (DRAIN, on-kill buffs)
  dmgBonusRound: number; // DMG buff that resets each Cleanup (on-kill "for the round")
  spBonus: number; // permanent SP modifiers (on-kill buffs, GALE Zephyr)
  spBonusRound: number; // SP buff that resets each Cleanup (AQUA Flow Change Steam)
  hitsBonus: number; // permanent extra basic hits (Fenrir On Kill)
  hitsBonusRound: number; // extra basic hits for the turn (Flow Change Liquid on multi-hit)
  tempShields: number; // shields granted "for the turn" (removed in Cleanup)
  /** Basic hits this card has LANDED on each target this round (keyed by target
   *  instanceId). Powers first-hit-only / on-second-hit riders; reset in Cleanup. */
  struckThisRound: Record<string, number>;
  /** Enemy hits this card has TAKEN this round — every attack that connected,
   *  including one fully soaked by shields. Powers Squanch's Regenerative, which
   *  cashes it in at Cleanup; reset there too. */
  hitsTakenThisRound: number;
  /** Nightfall (DUSK field): its EVASION covers only the FIRST hit taken each
   *  round, so the cover is spent on the first attempt — landed or dodged — and
   *  cleared again in Cleanup. */
  fieldEvasionUsed?: boolean;
  /** An ambush loaded into the NEXT basic attack (Obsidi's Dirt Driller): it
   *  overrides both DMG and hit count for that one attack, then clears. */
  loadedStrike?: { dmg: number; hits: number };
  /** An armed Enchantment (Prism). Spent by the next BASIC attack this card
   *  makes, whoever is holding it — Prism can hand one on as it dies. */
  enchant?: EnchantMode;
  /** A status riding the next `attacks` basic attacks (SSeerr's Flaming
   *  Slasher). Decremented once per attack that lands, not per hit. */
  loadedOnHit?: { kind: StatusKind; duration: number; power: number; attacks: number };
  /** Sea Terror (Siren): while transformed into another card, the defId to
   *  revert to when this form dies. Set on transform, cleared on revert. */
  transformedFrom?: string;
  /** King of the Wild (Leo): its once-per-round on-opp-summon buff has fired. */
  kingWildFiredRound?: boolean;
  /** Zephyr (GALE): the one-time +1 DMG for crossing SP 15 has been granted. */
  zephyrBoosted?: boolean;
  /** Life Cycle (Aurora): the queue of Light Orbs. Each incoming hit is absorbed
   *  by the front orb, which then bursts its effect and disappears. */
  orbs?: string[];
  /** Aurora's rotation index for the orb an enemy death recharges. */
  orbCycle?: number;
  /** Per-round guard for a `oncePerRound` onAllyKilled (Warden's Overwatch). */
  allyKilledFiredRound?: boolean;
  /** Per-round guard for Twin Strike (Ning's onCritBonus). */
  twinStrikeFiredRound?: boolean;
  /** Per-round guard for False Head (Thorny Ripper) — the decoy soaks one melee
   *  attack per round. */
  falseHeadUsedRound?: boolean;
  /** One-shot guard for a `oneUse` onAllyKilled (Shine's Brightling Ball). */
  allyKilledFired: boolean;
  /** Dead Clock (RIP): bodies raised so far, counted toward spawnTriggerAt. */
  spawnTally?: number;
  /** One-shot guard for a `firstRoundOnly` roundTick (Star's Raising Star). */
  roundTickFired?: boolean;
  /** Set once this card has been shielded by a Pride Guardian, so the guard
   *  spends itself once per ALLY rather than once per hit. */
  guardedByPride?: boolean;
  /** Every opponent this card has landed a basic attack on (instanceIds).
   *  Persistent — powers first-strike-per-opponent bonuses (Klipso Harsh Winds). */
  struckEver: string[];
  /** Timed DMG/SP modifiers (team buffs, −SP debuffs); tick down each Cleanup. */
  buffs: TimedBuff[];
  /** On-revive guard (Bearocks) — set once it has revived, so it can't again. */
  revived: boolean;
  /** Weeds Offspring: the coin-flip SECOND revive has been rolled (win or lose),
   *  so it never rolls again. */
  secondReviveUsed?: boolean;
  /** Gecko Tail Drop: the once-per-game cheat-death has fired. */
  deathSaveUsed?: boolean;
  /** Electro Surge (Surge): whether the reactive charge is currently armed. */
  electroSurgeActive?: boolean;
  /** BlastOff (FireFly): rounds of granted temporary FLIGHT remaining. */
  flyingRoundsLeft?: number;
  /** Power Grab (General): index of the current weapon; whether it already
   *  switched this round. */
  weaponMode?: number;
  weaponSwitchedRound?: boolean;
  /** High Voltage Sentry (Voltcher): its free first-hit Special has fired. */
  autoSpecialFired?: boolean;
  /** Jackpot (Striik): basic crits landed so far this round. */
  critsThisRound?: number;
  /** HP lost this round (Bolder's Vengeance reflects it). Reset at Cleanup. */
  dmgTakenThisRound?: number;
  /** Diagnosis / Red Shift / Magic Ropes: rounds this card cannot fire Specials.
   *  Ticked down at Cleanup. */
  specialLockedRounds?: number;
  /** A granted heal-over-time (Tail Drop's regrow): heals `regenPower` at each
   *  Cleanup until `regenRoundsLeft` reaches 0. */
  regenRoundsLeft?: number;
  regenPower?: number;
  /** A granted, timed BLOCK X (Diam's Diamallize / Diamond Kingdom): while
   *  `blockRoundsLeft` > 0 this card reduces every incoming hit by `blockPower`,
   *  stacking with its own BLOCK keyword. Counts down each Cleanup. */
  blockRoundsLeft?: number;
  blockPower?: number;
  /** Volcanic Fury (Valcana): DMG accumulated from on-hit ramp, reset on Special. */
  rampDmg?: number;
  /** Magnetic Shield (Gemaga): a granted, timed REFLECT — while `reflectRoundsLeft`
   *  > 0 this card reflects `reflectPower` back at attackers. Counts down at Cleanup. */
  reflectRoundsLeft?: number;
  reflectPower?: number;
  /** Boom (Doom): Cleanups survived so far; detonates once it reaches the def's
   *  `boom.afterRounds`. */
  boomTimer?: number;
  /** Mind Bubble Channeling (Anos): each Cleanup while `channelBuffRounds` > 0,
   *  gain `channelBuffDmg` DMG, heal `channelBuffHeal`, and self-cleanse. */
  channelBuffRounds?: number;
  channelBuffDmg?: number;
  channelBuffHeal?: number;
  /** Overheating (Heatsink Golem): the target its coils discharged into last
   *  round — a repeat is what doubles the burst. */
  lastOverheatTargetId?: string;
  /** Boomer (Firecrack): opponents this card has already struck at least once —
   *  a second strike vs the same target detonates for double. */
  boomerStruck?: string[];
  /** Shell Tuck (Tide): while tucked in, this card's OWN basic attacks miss
   *  `attackMissPct`% of the time, for `attackMissRounds` more rounds. */
  attackMissPct?: number;
  attackMissRounds?: number;
  /** Lure (Anglerfish): INCOMING attacks miss `incomingMissPct`% of the time for
   *  `incomingMissRounds` more rounds — a flat accuracy debuff on its attackers. */
  incomingMissPct?: number;
  incomingMissRounds?: number;
  /** Mark of Hoax: while marked, EVERY basic attack against this card is a
   *  guaranteed CRIT. `hoaxMarkedBy` is the marking Hoax's id — when this card
   *  dies, that Hoax banks a guaranteed dodge. Persistent (no timer). */
  hoaxMarked?: boolean;
  hoaxMarkedBy?: string;
  /** Blur (Hoax): banked one-shot auto-dodges — the next `guaranteedDodge`
   *  incoming attacks miss outright (earned when a marked target falls). */
  guaranteedDodge?: number;
  /** How many times a `decay` reviver (Zombie Husk) has come back — drives the
   *  −1-per-death stat decay. */
  reviveDecay?: number;
  /** A flat one-shot penalty to this card's NEXT basic attack's damage (Sticks'
   *  Boon Striker — statusless). Consumed and cleared after that attack. */
  nextAttackDmgDebuff?: number;
  /** HP-threshold transform guard (Skelider) — set once Dismount has fired;
   *  blocks the Special thereafter. */
  transformed: boolean;
  /** A Talent fires once per game; set true after it's used. */
  talentUsed: boolean;
  /** The next Special use is free (no magic, no cooldown) — Volcanon's Eruption
   *  On Kill grants this for the following round. Consumed when the Special fires. */
  freeSpecial: boolean;
  /** Meltdown is running (Magmadon). Set when the Special is cast, cleared on
   *  FREEZE / ROOT / death. */
  channelOn?: boolean;
  /** Turret Mode (GigaVolt): rounds of end-of-round electrified volleys left,
   *  and the damage each fires. Set by the Special. */
  turretRoundsLeft?: number;
  turretDmg?: number;
  /** One-shot guard for a firstTimeOnly onHitAllyBuff (Hillbilly's Hillside). */
  onHitBuffFired: boolean;
  /** How many times a capped `buffDmgEveryN` ramp has fired (Storm's Supercell
   *  stops after `maxTicks` rounds). Absent = never ramped. */
  rampTicks?: number;
  /** One-shot guard for Gate Keeper's shield-break buff (Veil). */
  shieldBroken: boolean;
  /** Per-round guard for Powertrip's once-per-round on-kill AoE (Voltogon).
   *  Reset each Cleanup. */
  onKillAoeFiredRound: boolean;
  /** Permanent reduction to this card's Special magic cost (Heir's King Me:
   *  each kill shaves 1 off Crowned). Floored at 0 when the cost is paid. */
  specialCostReduction: number;
  /** One-time guard for an onLowHp trigger (Kraken's From the Deep surge,
   *  Skelider's Dismount) — fires once when the card first drops below its
   *  threshold. Kept separate from `transformed` so a positive surge doesn't
   *  cost the card its Special. */
  onLowHpFired: boolean;
  /** UI-only transient combat counters — bumped when a hit on this card is
   *  dodged/missed (fxMiss) or crits (fxCrit). The renderer floats "MISS"/"CRIT"
   *  over the token when the count rises. No gameplay effect. */
  fxMiss?: number;
  fxCrit?: number;
  /** Bumped when this card lands an OUT-OF-TURN strike that has no attack
   *  animation of its own — currently DAWN's Awakening, which fires the instant
   *  the card is summoned. The renderer plays a quick lunge so the damage isn't
   *  unexplained. */
  fxLunge?: number;
  /** Bumped when this card is struck by a DYING card's parting shot (DUSK's
   *  Midnight Shade). The source is already off the board by then and cannot be
   *  animated, so the telegraph has to live on the card taking the hit. */
  fxRecoil?: number;
  /** Extra basic hits queued for the NEXT basic attack (Dart Frog's loaded
   *  darts). Consumed the next time this card basic-attacks. */
  loadedHits: number;
  /** Active statuses. DIFFERENT kinds coexist (a card can be ROOTed and
   *  BURNing); re-applying the SAME kind refreshes it instead of stacking —
   *  same-kind stacking only when a card explicitly states it (future flag). */
  statuses: StatusEffect[];
  summonedThisRound: boolean; // summon-turn Special lockout
  /** Specials have a one-round cooldown: firing sets 2, Cleanup ticks it down,
   *  and the Special is blocked while > 0 (so: skip one full round between uses). */
  specialCooldown: number;
  attackedThisRound: boolean; // STEALTH break tracking; reset each Cleanup
  /** Swamp Monster (Magalogoon): moving breaks its STEALTH as surely as
   *  attacking does. Per-CARD, unlike prep.movedThisTurn which is the
   *  one-move-per-turn budget for the whole side. Reset each Cleanup. */
  movedThisRound?: boolean;
  autoMode: AutoMode;
  pos: Pos | null; // null only transiently (never for a living board card)
}

export interface HandCard {
  handId: string; // unique per dealt copy
  defId: string;
}

// ── Spells ───────────────────────────────────────────────────────────────────
// A Spell is not a Champion: no stats, no board slot, can't be attacked. It's a
// one-time Prep-Phase effect paid from the magic pool, once per game. (Canon
// rules put Spells in the same deck as Champions; for now each player carries a
// separate spellbook derived from their deck's elements — see spells.ts.)

// "choice" = a modal spell the caster resolves one of two ways at cast time
// (Chill: an attack on a foe, or a shield on an ally). It reuses the damage
// fields (dmg/status) for the attack mode and allyShield for the shield mode;
// the CAST_SPELL intent's `mode` picks which.
// "field" = a Cost-6 board-wide terrain buff (the mirror of a Wall): no target,
// empowers the caster's SAME-element allies for a few rounds. See FieldState.
// "trap" = a Cost-2/8 hidden mine on a single EMPTY slot. Unlike a wall (a
// whole row, visible, expiring) a trap is one square, concealed from the
// opponent, and waits indefinitely until an enemy MOVES onto it.
export type SpellKind =
  | "damage" | "heal" | "wall" | "aoe" | "choice" | "field" | "convert" | "trap";

/** A hidden mine on ONE slot, laid by a trap spell. Occupies no space and does
 *  not block movement or line of sight — it simply waits. Triggers when an
 *  ENEMY card MOVES onto its square (ranged attacks and adjacency do nothing),
 *  then is spent.
 *
 *  Distinct from a Wall in three ways: a single square rather than a row, no
 *  expiry, and CONCEALED — the UI shows it to its owner only, so walking into
 *  one is a real mistake rather than a visible toll. */
export interface TrapState {
  owner: PlayerId;
  /** Set for trap SPELLS (names/logs via getSpell). On-kill traps laid by a
   *  card (Darth) leave this empty and carry `label` instead. */
  spellId?: string;
  /** Display name when there's no spell behind the trap (Darth's Dark Hunting). */
  label?: string;
  element: Element;
  pos: Pos;
  dmg: number;
  pen?: boolean;
  status?: { kind: StatusKind; duration: number; power: number };
  /** Inferno Pit: the payload also hits opponents adjacent to the victim. */
  splash?: boolean;
  /** Dark Hunting: heal `sourceId` by the HP the primary victim loses when the
   *  trap springs (LIFESTEAL), mirroring Darth's Special. */
  lifesteal?: number;
  sourceId?: string;
}

/** A row-level "wall" laid down by a Cost-4 spell. Occupies no slot; triggers
 *  only when an ENEMY card MOVES into its row (ranged attacks pass through). */
/** A buff granted to the wall owner's SAME-element allies while they stand in
 *  the wall's row (stacks additively with the card's own keywords). */
export interface WallAllyBuff {
  block?: number; // +BLOCK (Stone Wall)
  evasion?: boolean; // EVASION (Veil of Shadows)
  dmgReduction?: number; // flat −N incoming, unnamed (Radiant Barrier)
}

export interface WallState {
  owner: PlayerId;
  spellId: string;
  element: Element;
  row: number;
  dmg: number;
  status?: { kind: StatusKind; duration: number; power: number };
  push?: number;
  stripShields?: number; // strip N shields on entry, before the dmg (Stone Wall)
  allyBuff?: WallAllyBuff;
  roundsLeft: number;
}

/** A Cost-6 Field's buffs, granted to the caster's SAME-element allies while
 *  it's up. Per-round (applied at Cleanup): `regen` heals, `shield` adds armor.
 *  Passive-while-up (read live by the effective-stat / combat helpers):
 *  `sp`, `dmgBonus`, `block`, `reflect`. */
export interface FieldBuff {
  regen?: number;
  shield?: number;
  sp?: number;
  dmgBonus?: number;
  block?: number;
  reflect?: number;
  evasion?: boolean;      // element allies gain EVASION while up (Nightfall)
  specialDiscount?: number; // BOLT Specials cost −N while up (Power Grid), floors at 1
  electrify?: number;       // +N extra Electrify DMG vs statused foes (Power Grid)
  /** Dense Fog (AQUA): the only field that debuffs the OPPONENT rather than
   *  buffing its owner — every attack by the field owner's ENEMIES rolls to
   *  miss, the same coin the BLIND check uses. */
  enemyMissChance?: boolean;
  /** Downpour: at the start of every round the owner re-picks a Flow Change and
   *  it lands on ALL their element allies, not just a newly-summoned one. */
  flowRepick?: boolean;
  /** Blazing Sun: the field owner's element allies cannot miss — negates BLIND,
   *  the target's EVASION, and any other roll-to-hit. */
  neverMiss?: boolean;
  /** Blazing Sun: the field owner's element allies can see and target STEALTH
   *  cards, which are otherwise untargetable until they attack. */
  seeStealth?: boolean;
  /** Lushfield: statuses of these kinds, applied by the field owner's side,
   *  land with +`rounds` extra duration. Declared as data rather than hardcoded
   *  to BLEED/ROOT so another element's field can reuse the mechanic. */
  extendStatus?: { kinds: StatusKind[]; rounds: number };
  /** Nightfall: every DRAIN instance steals +N extra max HP. Element-matched
   *  like the other bonuses, so only DUSK cards under a DUSK field get it. */
  drainBonus?: number;
  /** Jetstream: every knockback the field OWNER causes travels +N further.
   *  Owner-scoped, not element-matched — the text reads "all knockback / push
   *  effects", and a push can come from a spell or a wall with no card behind
   *  it at all. */
  push?: number;
  /** Heatwave: BURN the field owner inflicted on its ENEMIES stops expiring
   *  while the field is up (their BURN durations don't tick down). */
  burnPersists?: boolean;
}

/** A live board-wide Field (the mirror of a WallState). No slot/row; buffs the
 *  owner's element allies for `roundsLeft` rounds, then lifts at Cleanup. */
export interface FieldState extends FieldBuff {
  owner: PlayerId;
  spellId: string;
  element: Element;
  roundsLeft: number;
  /** Downpour: the round its Flow re-pick was last offered. Without this the
   *  re-entrant check that catches a SECOND player in hot-seat immediately
   *  re-opens the prompt for the player who just answered — forever. */
  repickRound?: number;
}

export interface SpellDef {
  id: string;
  name: string;
  element: Element;
  cost: number;
  kind: SpellKind;
  text: string;
  /** Field spells (kind "field"): the board-wide buff + how long it lasts. */
  field?: FieldBuff & { rounds: number };
  /** Conversion spells (kind "convert"): the magic paid as `cost` comes back as
   *  N Gold. No target — it just moves value between the two resources. */
  gainGold?: number;
  // ── damage spells (need an enemy target) ──
  dmg?: number;
  pen?: boolean;
  status?: { kind: StatusKind; duration: number; power: number }; // onto the enemy target
  push?: number; // push the enemy target back N (if open)
  /** AoE spells (kind "aoe"): which opponents the dmg/status hits. "board" = all
   *  (no pick); "row" = a picked row; "tworows" = the picked row + the one behind. */
  area?: "row" | "board" | "tworows";
  /** AoE double-damage rider: a target meeting this condition takes 2× the dmg
   *  (Maelstrom vs FREEZE, Dawn's Judgment vs BLIND, Tremor vs "noShields"). */
  doubleIf?: StatusKind | "noShields";
  /** Total Network Control: permanently discount the caster's BOLT Specials by N
   *  (min 1) for the rest of the game — applied after the AoE resolves. */
  grantBoltDiscount?: number;
  /** Volcanic Eruption: permanently grant every SAME-element ally +N DMG for the
   *  rest of the game, applied after the AoE resolves. Unlike the BOLT discount
   *  this lands on the CARDS, so it also covers allies summoned later. */
  grantElementDmg?: number;
  /** The Cost-10 ultimates: a PERMANENT, element-wide grant for the rest of the
   *  game. Recorded on the player so allies summoned later inherit it too —
   *  "for the rest of the game" has to mean the game, not the board as it stood.
   *  The per-round halves (shield/heal) are paid out at Cleanup. */
  grantElementPerm?: {
    sp?: number;
    shieldPerRound?: number;
    healPerRound?: number;
    /** Endless Night: DUSK allies gain the DRAIN keyword if they lack it. */
    drain?: boolean;
  };
  /** Sap N SP from every target for the round (99 = drop it to nothing).
   *  Round-scoped, so it wears off at Cleanup like Flow Change's boosts. */
  spDebuff?: number;
  /** Steam Vent: this status lands INSTEAD of the plain damage, and only when
   *  the target is already FROZEN — cold and heat refusing to cancel out. */
  statusIfFrozen?: { kind: StatusKind; duration: number; power: number };
  /** Withering Grasp: heal an element ally for the HP damage this spell dealt. */
  healAllyForDamage?: boolean;
  /** Bloodroot Surge: heal every element ally for the TOTAL DOT this spell just
   *  queued up across the enemy board (power x duration x targets). */
  healAlliesForStatus?: boolean;
  /** Heart of the Forest: restore every element ally to full HP. */
  healAlliesFull?: boolean;
  /** Glacial Wave / Landslide: element allies standing INSIDE the AoE's area
   *  gain shields — the area is the same one the enemies were hit in. */
  allyShieldInArea?: number;
  /** Harvest: DRAIN N max HP from every target, spread across the caster's
   *  surviving element allies. */
  drainMaxHpAll?: number;
  /** Grace: +N DMG to the healed ally for the round. */
  allyDmgRound?: number;
  /** System Override: every Special the caster fires costs N less this round. */
  specialDiscountRound?: number;
  /** Rewire: swap the board positions of two of the caster's own cards. */
  swapAllies?: boolean;
  /** Full Reroute: freely relocate up to N of the caster's cards to open slots,
   *  ignoring their SP movement tier for this cast. */
  rerouteCount?: number;
  /** Wake of the Dead: opponents killed for the REST OF THIS ROUND come back at
   *  the start of the next one as this token, under the caster's control. */
  reviveAsToken?: string;
  /** Recon Ping: reveal the opponent's hand for the rest of this round. */
  revealHand?: boolean;
  /** Trap spells: the payload delivered when an enemy steps on the square. */
  trap?: { dmg: number; pen?: boolean; status?: { kind: StatusKind; duration: number; power: number }; splash?: boolean };
  /** Cleanse rider: remove up to N negative statuses from each of the caster's
   *  element allies (99 = all). Runs on support spells and on Judgment. */
  cleanse?: number;
  // ── ally rider / support (auto-picked ally of the spell's element) ──
  allyShield?: number;
  allyHeal?: number;
  allyHealIfRooted?: number; // heal this instead when any opponent is ROOTed
  allySp?: number; // grant the ally +N SP (Tailwind)
  allyStatus?: { kind: StatusKind; duration: number; power: number }; // e.g. EVASION (Shadow Step)
  /** Apply the ally rider(s) to EVERY living ally of the spell's element instead
   *  of a single auto-picked one (Fortify, team heals). */
  allAllies?: boolean;
  drainMaxHp?: number; // steal N max HP from the enemy target → an ally
  // ── wall spells (need a target row) ──
  wall?: {
    dmg: number;
    status?: { kind: StatusKind; duration: number; power: number };
    push?: number;
    stripShields?: number;
    ownHomeOnly?: boolean;
    allyBuff?: WallAllyBuff;
    rounds: number;
  };
}

/** One entry in a player's spellbook — castable once per game. */
export interface SpellSlot {
  defId: string;
  used: boolean;
}

export interface PlayerState {
  deck: string[]; // defIds, top of deck = index 0
  hand: HandCard[];
  /** Spells available to this player this game (each castable once). */
  spellbook: SpellSlot[];
  /** GOLD — the summoning resource. Gains = round # each round (cap 10
   *  carryover). Pays for
   *  summoning Champions only. */
  gold: number;
  /** Magic pool: starts at 3, +1 per round from round 2 (cap 10 carryover).
   *  Pays for Specials (and, post-alpha, Spells). Never drains the summon
   *  pool and vice-versa. */
  magicPool: number;
  mulliganDone: boolean;
  /** Running tally of this player's cards that have died — feeds Destro's
   *  graveyard-scaling (its DMG grows with the fallen). */
  deaths?: number;
  /** Accelerator (Scorch): rounds remaining in which BURN this player inflicted
   *  on its ENEMIES deals double. Ticked down in Cleanup. */
  burnBoostRounds?: number;
  /** Fog Settlement (Misty): rounds left of a board-wide −50% accuracy on
   *  attacks aimed at THIS player's cards. Flat coin, not a status — uncleansed.
   *  Decrements each Cleanup. */
  foggedRounds?: number;
  /** Sky Scout (Syt Bird): rounds left in which this player's single-target
   *  basics also clip one enemy adjacent to their target. Ticked in Cleanup. */
  basicSplashRounds?: number;
  /** Orbital Shot (Raya): delayed single-target strikes that land on a later
   *  round's Cleanup. */
  pendingArrows?: { round: number; dmg: number; targetId: string; source: CardInstance }[];
  /** Radiant Ward (Solstice): a single team-wide barrier that absorbs the first
   *  negative status to hit any ally this round. Refreshed each round it's up. */
  statusWard?: boolean;
  /** Total Network Control (BOLT ultimate): a permanent −N to this player's BOLT
   *  Specials (min 1), applied to current AND future BOLT cards for the game. */
  boltDiscount?: number;
  /** System Override: EVERY Special this player casts costs N less, for THIS
   *  round only (boltDiscount is the permanent, BOLT-only version). Cleared at
   *  Cleanup. */
  specialDiscountRound?: number;
  /** Recon Ping: the round through which this player's hand is visible to the
   *  opponent. Information, not board state — the UI reads it. */
  handRevealedUntilRound?: number;
  /** Wake of the Dead, armed. `deaths` is the opponent's death count at the
   *  moment of casting, so only kills made AFTER it resolves are harvested —
   *  the spell says "killed this round", not "killed so far". */
  /** An armed "anything that dies becomes mine" harvest. `roundsLeft` lets it
   *  span several rounds (Toxic Eruption's DOT kills over 3) rather than only
   *  the round it was cast — each Start of Round it banks what died, re-arms
   *  with a fresh baseline, and counts down. */
  wakePending?: { round: number; deaths: number; token: string; roundsLeft?: number };
  /** Meteor (Cosmic): pending round-end strikes armed by a death this round.
   *  Each fires at the Cleanup of its `round`, hitting the owner's opponents.
   *  `source` is the (now-removed) caster, kept only for damage crediting. */
  pendingMeteors?: { round: number; dmg: number; source: CardInstance }[];
  /** Spiraling Root Coil (Season): a next-round ROOT scheduled on the far row.
   *  `roundsLeft` counts down each Cleanup; at 0 it roots up to `count` opponents
   *  in the source's far row for `duration`. */
  pendingFarRoots?: { roundsLeft: number; source: CardInstance; count: number; duration: number }[];
  /** Volcanic Eruption: permanent +DMG for this player's cards of that element. */
  elementDmgBuff?: { element: Element; amount: number };
  /** The Cost-10 ultimates' lasting engines, keyed by element. Read at Cleanup
   *  (shield/heal), on summon (sp), and by the DRAIN keyword check. */
  elementPerm?: {
    element: Element;
    sp?: number;
    shieldPerRound?: number;
    healPerRound?: number;
    drain?: boolean;
  };
}

export type Phase =
  | "mulligan"
  | "draw"
  | "resource"
  | "prep"
  | "battle"
  | "cleanup"
  | "gameover";

export interface PrepState {
  priority: PlayerId;
  consecutivePasses: number;
  movedThisTurn: boolean; // move ≤1 card per priority turn
}

export interface BattleState {
  queue: string[]; // instanceIds ordered SP 15→0, ties coin-flipped
  index: number; // next card to act
  /** Set when a P1 manual card is up and has at least one legal action. */
  awaitingInput: string | null; // instanceId
}

export interface SlotState {
  capturedBy: PlayerId | null; // permanent capture — no summons in/out, ever
}

export interface WinInfo {
  /** null only on a timeout that nothing could separate — a genuine draw. */
  winner: PlayerId | null;
  by: "capture" | "elimination" | "surrender" | "timeout";
}

/** Post-match analytics, accumulated live in the reducer. `dmg` is HP damage
 *  dealt to enemies; `heal` is HP restored (self-sustain + support); `captures`
 *  are enemy Home slots locked; `kills` are enemy cards defeated. */
export interface CardStat {
  defId: string;
  name: string;
  owner: PlayerId;
  /** Offence: HP damage dealt to enemies. */
  dmg: number;
  /** Support: HP restored to others AND to itself — credited to the HEALER.
   *  See `healRecv` for the other half; conflating the two made a card that
   *  got healed look like the one doing the healing. */
  heal: number;
  captures: number;
  kills: number;
  /** Defence: HP damage this card absorbed. A tank's whole contribution was
   *  invisible in the report before this. */
  taken: number;
  /** Damage its SHIELDS ate before any of it reached HP. `taken` counts HP loss
   *  only, so without this an armour card looks like it barely defended — the
   *  damage it stopped never appeared anywhere. Shield-based elements (BORE,
   *  AQUA) are unmeasurable on `taken` alone. */
  shielded: number;
  /** HP restored TO this card, by anyone (including itself). */
  healRecv: number;
  /** Negative statuses landed on this card — how hard it got locked down. */
  debuffs: number;
  /** Times it was put down (a reviving card can do this more than once). */
  deaths: number;
}
export interface SideStat {
  dmg: number;
  heal: number;
  captures: number;
  kills: number;
  taken: number;
  shielded: number;
  healRecv: number;
  debuffs: number;
  deaths: number;
}
export interface MatchStats {
  /** Per source card, keyed by instanceId (survives the card's death). */
  byCard: Record<string, CardStat>;
  /** Per-side totals — includes spell/player-level contributions with no card. */
  byPlayer: Record<PlayerId, SideStat>;
}

export interface GameState {
  rngState: number; // seeded RNG cursor — all randomness flows through this
  round: number;
  phase: Phase;
  /** Which players are human-controlled. ["P1"] = vs-AI (default); ["P1","P2"]
   *  = local hot-seat 2-player. The driver only auto-runs AI for players NOT
   *  in this list. */
  humans: PlayerId[];
  firstPlayer: PlayerId; // coin-flip winner; preps first on ODD rounds (initiative alternates)
  players: Record<PlayerId, PlayerState>;
  /** All living board cards, keyed by instanceId. Board layout derived from pos. */
  cards: Record<string, CardInstance>;
  /** Width AND height of the square battlefield for THIS match. Lives on the
   *  state rather than as a module constant so more than one board size can
   *  exist at once (4×4 standard, 5×5 mode). `slots` is always boardSize². */
  boardSize: number;
  /** Slot metadata, [row][col]. `boardSize` × `boardSize`. */
  slots: SlotState[][];
  prep: PrepState | null;
  battle: BattleState | null;
  /** Active row-level Walls (Cost-4 spells). Empty until a wall is cast. */
  walls: WallState[];
  traps: TrapState[];
  /** Active board-wide Fields (Cost-6 spells). Empty until a field is cast. */
  fields: FieldState[];
  /** A human just summoned an AQUA card and must pick its Flow Change buff
   *  (instanceId). AI summons resolve immediately, so this only gates humans. */
  pendingFlow: string | null;
  /** Downpour re-pick: the pending choice applies to EVERY element ally of
   *  pendingFlow's owner, not just that card. pendingFlow still names one of
   *  them so the existing prompt has something to render. */
  pendingFlowAll?: boolean;
  win: WinInfo | null;
  log: string[];
  nextId: number; // instance/hand id counter
  stats: MatchStats; // post-match analytics (damage/heal/captures/kills)
}

export type Intent =
  | { type: "MULLIGAN"; player: PlayerId; returnHandIds: string[] }
  | { type: "SUMMON"; player: PlayerId; handId: string; col: number }
  | { type: "MOVE"; player: PlayerId; instanceId: string; to: Pos }
  | {
      type: "CAST_SPELL";
      player: PlayerId;
      spellId: string;
      targetId?: string;
      row?: number;
      col?: number;
      mode?: "attack" | "shield";
      /** Rewire / Full Reroute: the caster's own cards being moved. */
      targetIds?: string[];
      /** Full Reroute: where each of `targetIds` is going, index-matched. */
      slots?: Pos[];
    }
  | { type: "PASS"; player: PlayerId }
  | { type: "SET_AUTO"; player: PlayerId; instanceId: string; mode: AutoMode }
  | { type: "SURRENDER"; player: PlayerId }
  | { type: "FLOW_CHANGE"; player: PlayerId; instanceId: string; mode: "water" | "ice" | "steam" }
  | {
      type: "BATTLE_ACTION";
      player: PlayerId;
      action: "basic" | "special" | "skip" | "talent";
      /** Prism's Enchantment: which of the four buffs the caster picked. */
      mode?: EnchantMode;
      /** Single target: the full volley lands on it. */
      targetId?: string;
      /** Multi-selection: one hit/strike per entry, in order; repeat an id to
       *  stack ("up to N targets, or stacked on fewer"). */
      targetIds?: string[];
    };

export const OPENING_HAND = 4;
/** Max hand size — draws that would exceed this are skipped (the cards stay on
 *  top of the deck, not burned). Bonus-draw rounds (10/15) partially fizzle when
 *  you're near the cap; that's the intended cost of a hand limit. */
export const HAND_CAP = 7;
export const POOL_CARRYOVER_CAP = 10;
/** DEFAULT board size for a new match. The live value is `state.boardSize` —
 *  read that, not this, anywhere a GameState is in scope. This constant only
 *  seeds a new game and serves as the fallback for the handful of pure helpers
 *  that take an explicit size. */
export const BOARD_SIZE = 4;
/** Minimum printed hit count for the "gain +1 HIT instead of +1 DMG" rule
 *  (King-of-the-Hill mid row, Flow Change Liquid). Cards below this get the flat
 *  +DMG; only heavy multi-hit cards (4+) trade it for an extra hit. */
export const MULTI_HIT_BONUS_MIN = 4;
/** Which half of the King-of-the-Hill mid-row bonus a card takes: `true` = +1
 *  HIT (worth its DMG), `false` = +1 DMG (worth its hit count).
 *
 *  The +1 HIT branch exists so a heavy shredder doesn't balloon — Clipsey at
 *  1×7 would become 2×7 = 14 on a flat +1 DMG. But for a 1-damage card that
 *  branch is worth only +1, which made a 4th printed hit an actual DOWNGRADE:
 *  1×4 delivered 5 in a mid row while 1×3 delivered 6, so the card printing
 *  MORE raw damage hit for less. Low-damage cards up to 5 hits therefore keep
 *  the DMG branch; 6+ hits stay on the HIT branch, where ballooning is the real
 *  risk.
 *
 *  Both call sites (effectiveDmg, effectiveBasicHits) MUST read this one
 *  function — they are exact complements, and a card that satisfied both (or
 *  neither) would get a double bonus (or none). */
export function hillGivesHit(dmg: number, hits: number): boolean {
  return hits >= MULTI_HIT_BONUS_MIN && !(dmg === 1 && hits <= 5);
}
/** Hard ceiling on match length. Without one a match can run forever: two sides
 *  whose survivors can't reach each other, with per-round chip damage exactly
 *  offset by healing, sit frozen indefinitely. At the ceiling the match is
 *  decided on progress instead (see decideOnTime). */
export const MAX_ROUNDS = 50;

/** The back row a player summons into and defends. P2 is always row 0; P1 is
 *  the far edge, which depends on how big the board is — hence the required
 *  `boardSize`. It has NO default on purpose: a silent fallback to 4 would put
 *  P1's home in the middle of a 5×5 and leave the last row dead, which is
 *  exactly the bug this replaced. Pass `state.boardSize`. */
export function homeRow(player: PlayerId, boardSize: number): number {
  return player === "P1" ? boardSize - 1 : 0;
}

/** The contested middle — where King of the Hill pays out (+1 DMG or +1 HIT,
 *  and +1 ranged reach).
 *
 *  Rows 1 and 2 at BOTH board sizes. On a 5×5 that deliberately leaves row 3
 *  out: whether the large board's middle is rows 1–3 or just row 2 is an open
 *  design call, and widening it here would silently re-tune every hill bonus at
 *  once. This is the single definition — change it here and every consumer
 *  follows. */
export function isMidRow(row: number): boolean {
  return row === 1 || row === 2;
}

export function enemyOf(player: PlayerId): PlayerId {
  return player === "P1" ? "P2" : "P1";
}
