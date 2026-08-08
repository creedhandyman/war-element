# War Element — Card & Spell Roster

Every card, every ability, every spell. **Generated — do not hand-edit:** run `npm run roster` after any change to `src/data/cards.ts` or `src/engine/spells.ts`. `roster.test.ts` fails if this file drifts from the data.

Ability text comes from `describePassives`, the same function the in-game card inspector uses, so this document and the game cannot disagree about what a card does.

**Lore** — 51 of 409 written. Prose lives in `src/data/lore/<element>.ts`, keyed by id; anything still to write reads _(none yet)_ below, so this document doubles as the progress tracker for the lore pass.

**Totals** — 312 draftable cards · 17 tokens · 80 spells · 8 elements.

## Contents

- [LEAF](#leaf) — 39 cards, 2 tokens, 10 spells · lore 51/51 ✓
- [PYRO](#pyro) — 39 cards, 0 tokens, 10 spells · lore 0/49
- [AQUA](#aqua) — 39 cards, 1 token, 10 spells · lore 0/50
- [DAWN](#dawn) — 39 cards, 2 tokens, 10 spells · lore 0/51
- [GALE](#gale) — 39 cards, 3 tokens, 10 spells · lore 0/52
- [BOLT](#bolt) — 39 cards, 3 tokens, 10 spells · lore 0/52
- [DUSK](#dusk) — 39 cards, 6 tokens, 10 spells · lore 0/55
- [BORE](#bore) — 39 cards, 0 tokens, 10 spells · lore 0/49

---

## LEAF

**Element aura · Photosynthesis** — End of round, LEAF cards heal +2 HP — plus 1 more for every ROOTed opponent — and gain +1 shield per hit they took that round, up to 3 above their printed shields.

39 cards · 2 tokens · 10 spells

### LEAF — cards

<!-- mythic -->

#### Trinezer · `leaf_trinezer`

Mythic · Warrior · Melee · Cost 9

- **Stats** — DMG 12 · HP 23 · Shields 3 · SP 15 · Budget 56 vs 55 (+1)
- **Tribe** — Reptile
- **Special · Jungle Culling** (4◆) — Deal 11 DMG (PEN) to a target (aim the lowest-HP). On a kill: gain STEALTH until end of next round, and Culling the Weak gives EVERY ally +1 DMG permanently.
- **Passives**
  - Aura — Reptile allies gain +1 DMG / +1 SP.
  - Its Special reaches any slot on the board.
  - On summon: brings 3 Reptilians onto the board.
- **Found at** — Four Seasons Mega Forest · Jungle Throne
- **Lore** — The Cycle asked him to keep the balance. It never asked him to enjoy it less. He arrives with the brood already fed.

#### Oakgre · `leaf_oakgre`

Mythic · Tank · Melee · Cost 10

- **Stats** — DMG 7 · HP 55 · Shields 0 · SP 0 · Budget 62 vs 60 (+2)
- **Special · Uprooted** (5◆) — Lose 9 HP. Permanently gain +2 DMG and +3 SP — it can move for the rest of the game. Three casts maximum.
- **Passives**
  - Intimidation — Aura: opponents within one row whose DMG is lower than this card's CURRENT DMG lose 1 DMG from their basic attacks.
- **Found at** — Four Seasons Mega Forest · The Spirit Tree Rises
- **Lore** — Older than the tribes sheltering beneath him. He has torn free of the soil three times in a thousand years, and never once put a root back.

<!-- legendary -->

#### Elderroot · `leaf_elderroot`

Legendary · Support · Melee · Cost 6

- **Stats** — DMG 5 · HP 20 · Shields 5 · SP 6 · Budget 41 vs 40 (+1)
- **Special · Grove's Embrace** (4◆) — Heal all allies 7 HP and cleanse their negative statuses.
- **Passives**
  - Basic attacks entangle — Basic hits apply ROOT for 2 rounds.
  - Aura — LEAF allies gain +3 max HP.
- **Found at** — Four Seasons Mega Forest · Heart of Nature: Outer Roots
- **Lore** — The outer roots reach every grave beneath the Spirit Tree. What they draw up, he gives back to the living.

#### Evera · `leaf_season`

Legendary · Support · Ranged · Cost 6

- **Stats** — DMG 4 ×2 · HP 23 · Shields 0 · SP 7 · Budget 38 vs 40 (-2)
- **Special · Spiraling Root Coil** (4◆) — ROOT up to 4 opponents in the adjacent row for 3 rounds. Next round, ROOT up to 4 in the far row for 2 rounds.
- **Passives**
  - Each round: heal every LEAF ally 4 HP · ROOT the fastest opponent for 2 rounds.
  - Its Special reaches any slot on the board.
- **Found at** — Four Seasons Mega Forest · Heart of Nature: Outer Roots
- **Lore** — Spring's mercy, Summer's patience, Autumn's ending, Winter's stillness. She does not choose between them — she is the sentence they finish.

#### Sylvane · `leaf_efy`

Legendary · Warrior · Melee · Cost 6

- **Stats** — DMG 6 · HP 20 · Shields 2 · SP 11 · Budget 41 vs 40 (+1)
- **Special · Emergence** (3◆) — Spawn an Elephlora in an adjacent slot and heal all allies 4; each round the tree marches forward, hits an opponent for 3, and heals an ally 3.
- **Passives**
  - Each round: refresh shields back up to 2.
  - Aura — LEAF allies gain +1 shields.
- **Found at** — Four Seasons Mega Forest · Heart of Nature: The Spirit Tree
- **Lore** — Bark closes over the wound before the blade has finished leaving it. She teaches this to anyone standing in her shade.

#### Thorn · `leaf_thorn`

Legendary · Assassin · Melee · Cost 6

- **Stats** — DMG 8 · HP 18 · Shields 3 · SP 9 · Budget 41 vs 40 (+1)
- **Special · Blood on the Petals** (4◆) — Sweep up to 2 opponents in range for 7 DMG (PEN) each and stack BLEED 3 (basics keep deepening it).
- **Passives**
  - Barbed Basics — Basic hits apply BLEED (1) for 2 rounds.
  - Transfusion — When hit by melee: retaliate — BLEED.
  - Each round, heals HP equal to the total BLEED damage its enemies take.
- **Found at** — Four Seasons Mega Forest · Heart of Nature: Outer Roots
- **Lore** — Autumn's honest lesson: the ending feeds the beginning. She simply insists on being the one to open it.

#### Fallow · `leaf_fallow`

Legendary · Ranger · Ranged · Cost 7

- **Stats** — DMG 9 · HP 23 · Shields 1 · SP 12 · Budget 46 vs 45 (+1)
- **Keywords** — CRIT
- **Special · Hunting Season** (4◆) — Deal 3 DMG CRIT to 4 opponents. Auto-hits — ignores BLIND and EVASION.
- **Passives**
  - Aura — while it's on the board, every CRIT YOUR SIDE lands applies ROOT for 2 rounds.
  - Trapper — end of round: deals 1 DMG to every ROOTed opponent, anywhere on the board.
- **Found at** — Four Seasons Mega Forest · Heart of Nature: The Spirit Tree
- **Lore** — Blindfold him. Salt the trail. Wait in the dark. The Winter Tribe has a word for people who try this: found.

#### Hartwood · `leaf_warden`

Legendary · Tank · Melee · Cost 7

- **Stats** — DMG 9 · HP 24 · Shields 4 · SP 5 · Budget 46 vs 45 (+1)
- **Special · Justice** (2◆) — Deal 2×4 DMG (PEN) to all opponents in range and drain from them.
- **Passives**
  - Overwatch: when an ally is killed, answers the killer with 7 DMG (once per round).
- **Found at** — Four Seasons Mega Forest · Heart of Nature: The Spirit Tree
- **Lore** — Nothing falls in the Mega Forest without being counted. He keeps the count, and he collects from the one who opened it.

#### Nightshade · `leaf_nightshade`

Legendary · Mage · Ranged · Cost 7

- **Stats** — DMG 6 ×3 · HP 19 · Shields 0 · SP 9 · Budget 46 vs 45 (+1)
- **Keywords** — CRIT
- **Special · Night Bloom** (3◆) — Apply POISON 3 (DOT) to all opponents for 3 rounds.
- **Passives**
  - Each round: apply DOT 3 to every ROOTed opponent.
  - Its Special reaches any slot on the board.
- **Found at** — Four Seasons Mega Forest · The Rot Line
- **Lore** — The Rot Line grows what the other three seasons agreed not to name. She tends it anyway, and the Autumn Tribe looks elsewhere.

<!-- epic -->

#### Alpha · `leaf_alpha`

Epic · Warrior · Melee · Cost 3

- **Stats** — DMG 2 ×4 · HP 11 · Shields 0 · SP 7 · Budget 26 vs 25 (+1)
- **Special · Takedown** (3◆) — Tackle an opponent for 6 DMG and ROOT them for 3 rounds.
- **Passives**
  - Gnashing Bite — Vs ROOT targets, basics gain LIFESTEAL.
- **Found at** — Four Seasons Mega Forest · Summer's Embrace Grove
- **Lore** — Once per hunt the pack picks a throat and puts it on the ground. Everything after that is bookkeeping.

#### Autumnal · `leaf_fallona`

Epic · Mage · Ranged · Cost 3

- **Stats** — DMG 2 ×5 · HP 9 · Shields 0 · SP 7 · Budget 26 vs 25 (+1)
- **Special · Leaf Storm** (2◆) — Deal (1 + Fall's Emergence) DMG × 3 to every opponent in range.
- **Passives**
  - Every 3 rounds: permanently gains +1 DMG (stacking).
- **Found at** — Four Seasons Mega Forest · Bloomwardens' Ring
- **Lore** — She does not need this round. She has been counting since the first one.

#### Bark · `leaf_bark_bushmen`

Epic · Ranger · Ranged · Cost 3

- **Stats** — DMG 3 ×2 · HP 7 · Shields 2 · SP 9 · Budget 26 vs 25 (+1)
- **Special · Night Spear** (1◆) — Deal 8 DMG, piercing shields, ROOT the target for 3 rounds, and MUTE it for 1 round.
- **Passives**
  - Gains +1 shield at the end of each round.
  - Its Special reaches any slot on the board.
- **Found at** — Four Seasons Mega Forest · The Rot Line
- **Lore** — Every round he stands still, the forest adds another layer. Wait long enough and you are shooting at a tree.

#### Citra · `leaf_citra`

Epic · Mage · Ranged · Cost 3

- **Stats** — DMG 4 ×2 · HP 11 · Shields 1 · SP 5 · Budget 26 vs 25 (+1)
- **Keywords** — PEN
- **Special · Acidic Bloom** (3◆) — Apply BLEED 2 for 4 rounds to up to 4 opponents.
- **Passives**
  - Acidic Leaf Blaze — Basic hits apply BLEED (2) for 2 rounds.
- **Found at** — Four Seasons Mega Forest · Winter Village Sentinels
- **Lore** — The rot is not an accident of the bloom. The bloom was always the delivery.

#### Dandelion · `leaf_dande`

Epic · Warrior · Melee · Cost 3

- **Stats** — DMG 4 · HP 16 · Shields 3 · SP 0 · Budget 26 vs 25 (+1)
- **Keywords** — REGEN 3
- **Special · Razor Guard** (3◆) — Move forward one space, then deal 3 DMG and apply BLEED 1 (2 rounds) to opponents in range.
- **Passives**
  - REGEN 3: heals 3 HP at the end of each round.
  - Bramble — When hit by melee: retaliate — 1 DMG + DOT.
  - Every 1 rounds: permanently gains +2 HP (stacking).
- **Found at** — Four Seasons Mega Forest · Summer's Embrace Grove
- **Lore** — Cut it down and it comes back taller. Spring Tribe children are taught to weed carefully; this is why.

#### Hibernal · `leaf_whintey`

Epic · Support · Ranged · Cost 3

- **Stats** — DMG 6 · HP 12 · Shields 0 · SP 8 · Budget 26 vs 25 (+1)
- **Special · Winter's Bundle** (2◆) — ROOT every already-ROOTed opponent for 2 additional rounds.
- **Passives**
  - Each round: ROOT an opponent with 0 SP for 2 rounds.
  - Its Special reaches any slot on the board.
- **Found at** — Four Seasons Mega Forest · Winter's Reach Treeline
- **Lore** — Winter does not kill what it holds. It simply keeps holding, and lets the season do the rest.

#### Lumberjack · `leaf_lumberjack`

Epic · Tank · Melee · Cost 3

- **Stats** — DMG 5 · HP 15 · Shields 0 · SP 6 · Budget 26 vs 25 (+1)
- **Special · Timberer** (2◆) — Fell a tree straight down your own column: 6 DMG (PEN) to every opponent in the 3 slots ahead, reaching into their summoning row. ROOT them all for 2 rounds and gain 3 shield.
- **Passives** — none beyond the LEAF aura
- **Found at** — Four Seasons Mega Forest · Winter's Reach Treeline
- **Lore** — He does not fell trees toward himself. The gap opens away from him, all the way to whatever was standing behind them.

#### Sakuroot · `leaf_sakuroot`

Epic · Tank · Melee · Cost 3

- **Stats** — DMG 4 · HP 11 · Shields 4 · SP 3 · Budget 26 vs 25 (+1)
- **Keywords** — LIFESTEAL
- **Special · Petal Storm** (3◆) — Deal 3 DMG to all opponents in the row directly ahead and ROOT them for 3 rounds.
- **Passives**
  - LIFESTEAL: basic attacks heal it for the damage dealt.
  - Petalfall — Each round: heal same-element home-row allies 2 HP.
  - Deep Roots — immune to knockback, push, and pull effects — planted where it stands.
- **Found at** — Four Seasons Mega Forest · Winter's Reach Treeline
- **Lore** — The cherry grove does not retreat and cannot be pushed. Petals fall on the wounded whether or not anyone asked.

#### Splint · `leaf_splint`

Epic · Assassin · Melee · Cost 3

- **Stats** — DMG 6 · HP 11 · Shields 0 · SP 9 · Budget 26 vs 25 (+1)
- **Special · Leafy Cloak** (2◆) — Gain STEALTH for 3 rounds and REGEN 3 for 3 rounds.
- **Passives**
  - Jungle Whisper — Basic hits apply BLEED (1) for 2 rounds.
  - Jungle Whisper — On a kill: STEALTH for 1 round.
  - On summon: deal 5 DMG to one enemy.
- **Found at** — Four Seasons Mega Forest · Bloomwardens' Ring
- **Lore** — The underbrush closes behind him a little more slowly each time. He has decided that is a fair price.

#### Vernal · `leaf_sprinu`

Epic · Support · Ranged · Cost 3

- **Stats** — DMG 5 · HP 13 · Shields 0 · SP 8 · Budget 26 vs 25 (+1)
- **Special · Root Spring** (2◆) — Deal 2 DMG and ROOT for 2 rounds, then heal LEAF allies 4 HP.
- **Passives**
  - Each round: heal every LEAF ally 1 HP.
  - Its basic attack can be aimed at a wounded ally to heal them for its DMG instead of striking.
- **Found at** — Four Seasons Mega Forest · Evergreen Plains
- **Lore** — The same water that drowns a root can raise one. Spring Tribe doctrine, delivered at range.

#### Estival · `leaf_sumerose`

Epic · Assassin · Melee · Cost 4

- **Stats** — DMG 8 · HP 13 · Shields 1 · SP 8 · Budget 31 vs 30 (+1)
- **Keywords** — LIFESTEAL
- **Special · Siphoning Slash** (3◆) — Deal 10 DMG (PEN), lifesteal it, and apply BLEED 3 for 2 rounds.
- **Passives**
  - LIFESTEAL: basic attacks heal it for the damage dealt.
  - Basic hits apply BLEED (1) for 2 rounds.
- **Found at** — Four Seasons Mega Forest · Winter Village Sentinels
- **Lore** — The Autumn Tribe calls it pruning. The pruned have rarely agreed.

#### Nightbriar · `leaf_darth`

Epic · Ranger · Ranged · Cost 4

- **Stats** — DMG 7 · HP 13 · Shields 1 · SP 9 · Budget 31 vs 30 (+1)
- **Keywords** — CRIT, STEALTH
- **Special · Dark Hunting** (3◆) — Deal 7 DMG, ROOT the target for 2 rounds, and LIFESTEAL the damage dealt.
- **Passives**
  - Predator's Snare — On a kill: lays a trap where the victim fell — the next enemy to step on it takes 3 DMG, ROOT 2 and is LIFESTEALED.
- **Found at** — Four Seasons Mega Forest · The Rot Line
- **Lore** — He does not aim at where you are. He aims at the ground you will be standing on after he is finished.

#### Rubyscale · `leaf_rubyo`

Epic · Warrior · Melee · Cost 4

- **Stats** — DMG 4 · HP 11 · Shields 2 · SP 7 · Budget 26 vs 30 (-4)
- **Tribe** — Dragon
- **Special · Dragon's Dance** (3◆) — Deal 1, then 2, then 4 DMG (split across up to 3 targets) and gain +3 SP. While Greegon lives, also deal 8 to an opponent.
- **Passives**
  - On summon: brings 1 Greegon onto the board.
- **Found at** — Four Seasons Mega Forest · Winter Village Sentinels
- **Lore** — Small, red, and never arriving alone. The old lizard behind him is the part you should have been watching.

#### Squanch · `leaf_squanch`

Epic · Tank · Melee · Cost 4

- **Stats** — DMG 6 · HP 21 · Shields 0 · SP 4 · Budget 31 vs 30 (+1)
- **Special · Bushwhacker** (2◆) — Deal 6 DMG and ROOT every opponent adjacent to Squanch for 3 rounds.
- **Passives**
  - Regenerative: at the end of each round, grows +1 shield for every enemy hit it took that round (max 5).
- **Found at** — Four Seasons Mega Forest · Summer's Embrace Grove
- **Lore** — Hit it and it thickens. Hit it twice and you have spent two rounds making it harder to hit.

<!-- rare -->

#### Birch · `leaf_birch`

Rare · Warrior · Melee · Cost 1

- **Stats** — DMG 5 · HP 7 · Shields 0 · SP 4 · Budget 16 vs 15 (+1)
- **Special** — none
- **Passives**
  - Quadruple Strike — On a kill: 1×4 to the closest opponent.
- **Found at** — Four Seasons Mega Forest · Cherry Grove Path
- **Lore** — One clean fall opens the canopy. Four more strikes come through the gap.

#### Nettle · `leaf_nettle`

Rare · Mage · Ranged · Cost 1

- **Stats** — DMG 2 ×3 · HP 4 · Shields 0 · SP 6 · Budget 16 vs 15 (+1)
- **Special** — none
- **Passives**
  - Basic hits apply BLEED (1) for 2 rounds.
  - Bloodletting — Vs a BLOODFIRE target (bleeding AND burning), basics gain LIFESTEAL · +1 DMG.
- **Found at** — Four Seasons Mega Forest · Spring Village Outskirts
- **Lore** — A child's injury, repeated at range. It finds the ones already bleeding and burning, and finishes the errand.

#### Stickers · `leaf_stickers`

Rare · Assassin · Melee · Cost 1

- **Stats** — DMG 2 ×4 · HP 3 · Shields 0 · SP 5 · Budget 16 vs 15 (+1)
- **Special** — none
- **Passives**
  - Sticky — Basic hits apply BLEED (1) for 2 rounds.
- **Found at** — Four Seasons Mega Forest · Bloomwardens' Ring
- **Lore** — It picks one target and simply refuses to be anywhere else.

#### StickViper · `leaf_stickviper`

Rare · Ranger · Ranged · Cost 1

- **Stats** — DMG 3 · HP 5 · Shields 0 · SP 9 · Budget 17 vs 15 (+2)
- **Tribe** — Reptile
- **Special** — none
- **Passives**
  - Basic hits apply BLEED (2) for 2 rounds.
- **Found at** — Four Seasons Mega Forest · Jungle Wilds
- **Lore** — You will not notice the branch that bit you until the branch has stopped mattering.

#### Weeds · `leaf_weeds`

Rare · Support · Ranged · Cost 1

- **Stats** — DMG 3 · HP 9 · Shields 0 · SP 4 · Budget 16 vs 15 (+1)
- **Special** — none
- **Passives**
  - Offspring — Revives when defeated at 5 HP, with a 50% chance to revive a second time.
- **Found at** — Four Seasons Mega Forest · Spring Village Outskirts
- **Lore** — Pull it, burn it, salt the ground it grew in. Next season, ask the ground how that went.

#### Cactus · `leaf_cactus`

Rare · Warrior · Melee · Cost 2

- **Stats** — DMG 4 · HP 12 · Shields 0 · SP 6 · Budget 22 vs 20 (+2)
- **Special** — none
- **Passives**
  - Needles — When hit by melee: retaliate — 2 DMG + BLEED.
- **Found at** — Four Seasons Mega Forest · Jungle Wilds
- **Lore** — It asks nothing of you — only that you not touch it. It asks with needles.

#### Frond · `leaf_leaf`

Rare · Mage · Ranged · Cost 2

- **Stats** — DMG 4 ×2 · HP 4 · Shields 0 · SP 9 · Budget 21 vs 20 (+1)
- **Special** — none
- **Passives**
  - Basic hits apply BLEED (1) for 2 rounds.
- **Found at** — Four Seasons Mega Forest · Cherry Grove Path
- **Lore** — A single leaf, edge-on, at speed. The Mega Forest has more of these than it has anything else.

#### Oak · `leaf_oak`

Rare · Tank · Melee · Cost 2

- **Stats** — DMG 2 · HP 19 · Shields 0 · SP 0 · Budget 21 vs 20 (+1)
- **Special** — none
- **Passives**
  - Taproot — Basic hits apply ROOT for 2 rounds.
  - Talent (free · once per game) — Reroot: Once per game: uproot and advance up to 2 slots toward the enemy home.
  - Acorn Drop: the first hit it takes each round sprouts 1 Acorn.
  - Root Growth: all healing it receives is multiplied 2×.
- **Found at** — Four Seasons Mega Forest · Evergreen Plains
- **Lore** — It cannot hurt you and it will not move — except once, when it decides the forest needs it further forward.

#### Python · `leaf_python`

Rare · Tank · Melee · Cost 2

- **Stats** — DMG 2 · HP 17 · Shields 0 · SP 2 · Budget 21 vs 20 (+1)
- **Special** — none
- **Passives**
  - Coil Hold — Basic hits apply ROOT for 2 rounds.
  - Constriction — Each round: drain 2 HP from an adjacent opponent.
- **Found at** — Four Seasons Mega Forest · Evergreen Plains
- **Lore** — It does not strike. It arrives beside you, and then there is simply less of you each round.

#### Sticks · `leaf_sticks`

Rare · Assassin · Melee · Cost 2

- **Stats** — DMG 8 · HP 3 · Shields 0 · SP 10 · Budget 21 vs 20 (+1)
- **Special** — none
- **Passives**
  - On summon: deal 7 DMG to one enemy and sap their next attack by 2.
- **Found at** — Four Seasons Mega Forest · Evergreen Plains
- **Lore** — Three grams of dry wood, moving very fast, at exactly the wrong moment.

#### Dart Frog · `leaf_dartfrog`

Rare · Ranger · Ranged · Cost 3

- **Stats** — DMG 6 · HP 10 · Shields 0 · SP 10 · Budget 26 vs 25 (+1)
- **Special** — none
- **Passives**
  - Darts — Basic hits apply BLEED (1) for 2 rounds.
  - Talent (free · once per game) — Bleed Out: Skip this attack to load your darts — your next basic attack fires as 3 darts.
- **Found at** — Four Seasons Mega Forest · Rustling Woods
- **Lore** — Bright colors are not decoration in the Mega Forest. They are a courtesy.

#### Elephlora · `leaf_walking_tree`

Rare · Support · Ranged · Cost 3

- **Stats** — DMG 3 · HP 23 · Shields 0 · SP 0 · Budget 26 vs 25 (+1)
- **Special** — none
- **Passives**
  - Undergrowth — Basic hits apply ROOT for 2 rounds.
  - Moving Forest — Each round: 3 DMG to a random opponent · heal the most wounded ally 3 HP.
  - Moving Forest — Seed Roll: rolls 1 slot forward toward the enemy home at the end of each round (until blocked).
  - Root Growth: all healing it receives is multiplied 2×.
- **Found at** — Four Seasons Mega Forest · Rustling Woods
- **Lore** — It was not there yesterday. It will be closer tomorrow, and the wounded behind it will be standing.

#### Gecko · `leaf_gecko`

Rare · Assassin · Melee · Cost 3

- **Stats** — DMG 7 · HP 10 · Shields 0 · SP 9 · Budget 26 vs 25 (+1)
- **Tribe** — Reptile
- **Special** — none
- **Passives**
  - Venomous Bite — Basic hits apply BLEED (1) for 2 rounds.
  - Tail Drop: the first lethal hit leaves it at 1 HP with STEALTH 1 round and REGEN 2 for 2 rounds. Once per game.
- **Found at** — Four Seasons Mega Forest · Jungle Wilds
- **Lore** — It leaves the tail. It has never once needed the tail.

#### Greegon · `leaf_greegon`

Rare · Tank · Melee · Cost 3

- **Stats** — DMG 5 · HP 15 · Shields 0 · SP 6 · Budget 26 vs 25 (+1)
- **Keywords** — REGEN 2
- **Special** — none
- **Passives**
  - REGEN 2: heals 2 HP at the end of each round.
  - Bramble — Basic hits apply BLEED (1) for 2 rounds.
- **Found at** — Four Seasons Mega Forest · Spring Village Outskirts
- **Lore** — The canopy closes over its wounds every evening, whether anyone asked it to or not.

#### Guardian · `leaf_guardian`

Rare · Warrior · Melee · Cost 3

- **Stats** — DMG 5 · HP 13 · Shields 2 · SP 5 · Budget 27 vs 25 (+2)
- **Special** — none
- **Passives**
  - On a kill: +2 DMG.
  - On summon: deal 3 DMG to enemies in the area ahead.
- **Found at** — Four Seasons Mega Forest · Cherry Grove Path
- **Lore** — It arrives already swinging, and every kill teaches it to swing harder.

#### Hunter · `leaf_hunter`

Rare · Ranger · Ranged · Cost 3

- **Stats** — DMG 5 · HP 13 · Shields 0 · SP 8 · Budget 26 vs 25 (+1)
- **Special** — none
- **Passives**
  - Trapper — Basic hits 50% chance to apply ROOT for 2 rounds.
  - On summon: deal 4 DMG to one enemy.
  - Trapper — On death, deals 4 damage back to its killer.
- **Found at** — Four Seasons Mega Forest · Rustling Woods
- **Lore** — He sets a trap on arrival, another when he lands a hit, and one last one on his way down. Autumn Tribe thoroughness.

### LEAF — tokens

Not draftable: these arrive on the board from another card's ability, so their lore answers to whatever summons them.

#### Acorn · `leaf_acorn_tok`

Rare · Warrior · Melee · Cost 1

- **Stats** — DMG 2 · HP 3 · Shields 0 · SP 3 · Budget 8 vs 15 (-7)
- **Special** — none
- **Passives**
  - Seed Roll: rolls 1 slot forward toward the enemy home at the end of each round (until blocked).
- **Summoned by** — nothing (orphan token)
- **Lore** — Dropped, not planted. It rolls toward the enemy because nothing in the grove told it to stop.

#### Reptilian · `leaf_reptilian_tok`

Rare · Assassin · Melee · Cost 1

- **Stats** — DMG 3 · HP 5 · Shields 0 · SP 7 · Budget 15 vs 15 (on)
- **Tribe** — Reptile
- **Special** — none
- **Passives**
  - Conspiracy — On a kill: +2 DMG · +2 SP · +2 max HP.
- **Summoned by** — Trinezer
- **Lore** — One is a nuisance. A dozen is a plan. Trinezer never sends just one.

### LEAF — spells

#### Sprout · `leaf_sprout`

Heal · Cost 1✦

- **Text** — Heal a LEAF ally 3 HP (5 if any opponent is ROOTed).
- **Lore** — The smallest possible amount of growth, applied exactly where the wound is. It is usually enough.

#### Thorn Patch · `leaf_thorn_patch`

Area · Cost 2✦ · area: row

- **Text** — Apply BLEED 1 for 2 rounds to every opponent in a chosen row.
- **Lore** — Nothing here will kill you. It only makes certain the round after this one costs you something.

#### Snare · `leaf_snare`

Trap · Cost 3✦

- **Text** — Hide a trap on an empty slot. The first opponent to MOVE onto it is ROOTed for 3 rounds and takes BLEED 2 for 2 rounds.
- **Lore** — The forest does not chase. It waits on the ground you were always going to walk across.

#### Bramble Wall · `leaf_bramble_wall`

Wall · Cost 4✦

- **Text** — Thorned vines across a row for 3 rounds. A card that MOVES in takes 2 DMG and is ROOTed 1 round. Ranged attacks and FLYING cards pass over.
- **Lore** — Three rounds of thorn. Fly over it, shoot across it — but do not try to walk it.

#### Grove's Blessing · `leaf_groves_blessing`

Heal · Cost 5✦

- **Text** — Heal all LEAF allies 5 HP and cleanse one negative status from each.
- **Lore** — Whatever the enemy spent this round undoing, the grove quietly puts back.

#### Lushfield · `leaf_lushfield`

Field · Cost 6✦ · 3 rounds

- **Text** — Field (3 rounds): your LEAF allies REGEN 2 HP each round, and every BLEED and ROOT you apply lasts 1 round longer.
- **Lore** — Everything grows longer here — the healing, the bleeding, and the roots holding you still for both.

#### Withering Grasp · `leaf_withering_grasp`

Damage · Cost 7✦

- **Text** — Deal 8 DMG (PEN) to a target and apply BLEED 3 for 3 rounds. Heal a LEAF ally for the damage dealt.
- **Lore** — Nothing the forest takes is wasted. It is simply moved to whoever needed it more.

#### Overgrowth · `leaf_overgrowth`

Trap · Cost 8✦

- **Text** — Hide a trap on an empty slot. The first opponent to MOVE onto it — and every opponent beside it — is ROOTed for 2 rounds and takes BLEED 1 for 2 rounds.
- **Lore** — One wrong step, and the whole patch closes — on you and on whoever was standing beside you.

#### Bloodroot Surge · `leaf_bloodroot_surge`

Area · Cost 9✦ · area: board

- **Text** — Apply BLEED 3 for 3 rounds to every opponent, and heal all LEAF allies for the total BLEED that will be dealt.
- **Lore** — Every drop the field is about to spill has already been promised to something with roots.

#### Heart of the Forest · `leaf_heart_of_the_forest`

Area · Cost 10✦ · area: board

- **Text** — Heal all LEAF allies to full HP and ROOT every opponent for 2 rounds. For the rest of the game, LEAF allies heal 1 extra HP each round.
- **Lore** — The Spirit Tree does not intervene often. When it does, the Cycle simply resumes from the beginning — for one side only.

---

## PYRO

**Element aura · Scorch** — Basic attacks apply BURN, stacking up to BURN 5 on the same target.

39 cards · 0 tokens · 10 spells

### PYRO — cards

<!-- mythic -->

#### Nitro · `pyro_nitro`

Mythic · Mage · Ranged · Cost 9

- **Stats** — DMG 8 ×2 · HP 20 · Shields 2 · SP 15 · Budget 55 vs 55 (on)
- **Tribe** — Forged Tech
- **Special · Volatile Formula** (5◆) — Deal 13 DMG to all opponents in range — 30% chance to deal double.
- **Passives**
  - Unstable Core — On death: a final explosion — 10 DMG to every opponent on the board.
  - Its Special reaches any slot on the board.
- **Found at** — Pyro · The Forge Core
- **Lore** — _(none yet)_

#### Pyrogon · `pyro_pyrogon`

Mythic · Warrior · Melee · Cost 10

- **Stats** — DMG 15 · HP 39 · Shields 0 · SP 8 · Budget 62 vs 60 (+2)
- **Tribe** — Dragon, Volcanic
- **Special · Flame Engulf** (4◆) — Deal 7 DMG + BURN 2 to the 3 opponents directly ahead and the row behind them (2 rows deep). 3-round cooldown.
- **Passives**
  - On a kill: +1 DMG · +7 max HP.
  - On summon: deal 7 DMG to enemies in the area ahead and apply BURN 3 for 3 rounds.
- **Found at** — Pyro · Firespine Peaks: Dragon's Lair
- **Lore** — _(none yet)_

<!-- legendary -->

#### Aftermath · `pyro_aftermath`

Legendary · Support · Ranged · Cost 6

- **Stats** — DMG 3 · HP 29 · Shields 0 · SP 8 · Budget 40 vs 40 (on)
- **Special · Smog** (4◆) — Blanket your side in smoke for 2 rounds — attacks on your cards may miss.
- **Passives**
  - On summon: deal 5 DMG to all enemies in range.
- **Found at** — Pyro · Sunfall Watch
- **Lore** — _(none yet)_

#### Dynomight · `pyro_dynomight`

Legendary · Ranger · Ranged · Cost 6

- **Stats** — DMG 9 · HP 20 · Shields 0 · SP 11 · Budget 40 vs 40 (on)
- **Tribe** — Forged Tech
- **Special · Grand Finally** (4◆) — Deal 6 DMG to opponents in the adjacent row and 4 DMG to the rest. Dynomight loses 2 HP.
- **Passives**
  - Explosive Power: basic attacks deal 2× damage against Warrior / Tank targets.
  - Explosive Power — Diamond's Edge: basic attacks deal 2× damage against a shielded target.
  - Its Special reaches any slot on the board.
- **Found at** — Pyro · Sunfall Watch
- **Lore** — _(none yet)_

#### Sol · `pyro_sol`

Legendary · Mage · Ranged · Cost 6

- **Stats** — DMG 3 ×2 · HP 19 · Shields 2 · SP 11 · Budget 40 vs 40 (on)
- **Special · Pyro Ball Barrage** (3◆) — Deal 3 DMG up to 4 times to one opponent — Incinerate ramps each hit.
- **Passives**
  - Incinerate: consecutive hits on the same target within a round deal +1 DMG each.
- **Found at** — Pyro · Sunfall Watch
- **Lore** — _(none yet)_

#### Magmaw · `pyro_magmaw`

Legendary · Warrior · Melee · Cost 7

- **Stats** — DMG 10 · HP 17 · Shields 5 · SP 8 · Budget 45 vs 45 (on)
- **Special · Molten Rampage** (4◆) — Strike one opponent up to 4× for 4 DMG; on a kill the rest chain to a new enemy at +3 DMG each.
- **Passives**
  - Feeds on the slain — On a kill: +2 DMG.
- **Found at** — Pyro · Ember Fortress: Inner Keep
- **Lore** — _(none yet)_

#### Volcanon · `pyro_volcanon`

Legendary · Assassin · Ranged · Cost 7

- **Stats** — DMG 13 · HP 19 · Shields 0 · SP 8 · Budget 40 vs 45 (-5)
- **Tribe** — Volcanic
- **Keywords** — FLYING
- **Special · Eruption** (3◆) — Deal 2 DMG × 5 hits to one opponent at range (shreds shields). Costs 2 HP; +1 DMG per use (Bad Temper, max +5); On Kill, recast free next round.
- **Passives**
  - Bad Temper: permanently gains +1 DMG each time a basic attack lands.
  - On Kill, its Special recasts free next round (ignores cost & cooldown).
  - Its Special reaches any slot on the board.
- **Found at** — Pyro · Sunfall Watch
- **Lore** — _(none yet)_

#### Infernus Rex · `pyro_infernus_rex`

Legendary · Warrior · Melee · Cost 8

- **Stats** — DMG 9 · HP 32 · Shields 3 · SP 7 · Budget 54 vs 50 (+4)
- **Tribe** — Volcanic
- **Special · Volcanic Charge** (4◆) — Move up to 3 spaces forward and deal 12 DMG to the first opponent hit.
- **Passives**
  - Eruption — On a kill: +2 DMG · 3 to all enemies.
  - Burning Roar — Bad Temper: permanently gains +1 DMG each time a basic attack lands.
  - On summon: apply BURN 2 for 3 rounds to all enemies in range.
- **Found at** — Pyro · Ember Fortress: Inner Keep
- **Lore** — _(none yet)_

#### Magmadon · `pyro_magmadon`

Legendary · Tank · Melee · Cost 8

- **Stats** — DMG 7 · HP 38 · Shields 0 · SP 5 · Budget 50 vs 50 (on)
- **Tribe** — Volcanic
- **Special · Meltdown** (4◆) — Deal 5 DMG to the row directly ahead, then keep erupting every round for 2 HP a round — until Magmadon dies, or is FROZEN or ROOTED.
- **Passives**
  - Scorched Fury — Each round: burn 1 of its own HP to hit +2 harder next round.
  - On summon: every PYRO ally pays 1 HP for +2 DMG for 1 round.
  - Scorched Fury — Below 10 HP it attacks for +2 DMG.
- **Found at** — Pyro · Ember Fortress: Inner Keep
- **Lore** — _(none yet)_

<!-- epic -->

#### FireBird · `pyro_firebird`

Epic · Assassin · Melee · Cost 3

- **Stats** — DMG 6 · HP 8 · Shields 0 · SP 11 · Budget 25 vs 25 (on)
- **Special · Flame Charge** (1◆) — Deal 8 DMG and apply BURN 2 for 2 rounds. FireBird loses 3 HP.
- **Passives**
  - Burnout — On death, blasts the enemy row ahead for 4.
- **Found at** — Pyro · Pyro City Gates
- **Lore** — _(none yet)_

#### Liza · `pyro_liza`

Epic · Support · Ranged · Cost 3

- **Stats** — DMG 2 ×2 · HP 11 · Shields 1 · SP 8 · Budget 25 vs 25 (on)
- **Special · Igniter** (1◆) — Double the damage and remaining duration of one DOT on an opponent.
- **Passives**
  - Gaslighting: when an ally lands a kill, that ally gains +1 DMG for 2 round(s).
  - Its Special reaches any slot on the board.
- **Found at** — Pyro · Pyro City Gates
- **Lore** — _(none yet)_

#### Scallywag · `pyro_scully`

Epic · Mage · Ranged · Cost 3

- **Stats** — DMG 6 · HP 13 · Shields 0 · SP 6 · Budget 25 vs 25 (on)
- **Special · Powder Keg** (2◆) — Bomb the enemy row ahead for 2 DMG and BURN 2.
- **Passives**
  - Bounty Hunter — Basic hits apply BURN (2) for 2 rounds.
  - Bounty: when an opponent fires a Special, they take BURN 2 for 2 round(s).
  - Its Special reaches any slot on the board.
- **Found at** — Pyro · Pyro City Gates
- **Lore** — _(none yet)_

#### Scorch · `pyro_scorch`

Epic · Support · Ranged · Cost 3

- **Stats** — DMG 3 · HP 8 · Shields 3 · SP 8 · Budget 25 vs 25 (on)
- **Special · Accelerator** (3◆) — For 2 rounds: every BURN on an opponent deals double, and PYRO allies gain +1 SP.
- **Passives**
  - On summon: apply BURN 1 for 3 rounds to every opponent in their Home row.
  - The enemy Home row stays alight: each round it applies BURN 1 for 3 rounds to everything standing there.
- **Found at** — Pyro · Ember Fortress Drill Yard
- **Lore** — _(none yet)_

#### Woof · `pyro_woof`

Epic · Warrior · Melee · Cost 3

- **Stats** — DMG 4 · HP 13 · Shields 0 · SP 8 · Budget 25 vs 25 (on)
- **Tribe** — Wolf
- **Special · Heat Crunch** (1◆) — Your next 3 basic attacks apply BURN 2 for 3 rounds.
- **Passives**
  - Flame Eater — Vs BURN targets, basics gain heal 3.
- **Found at** — Pyro · Ember Fortress Drill Yard
- **Lore** — _(none yet)_

#### Emberclaw · `pyro_sseerr`

Epic · Assassin · Melee · Cost 4

- **Stats** — DMG 4 ×2 · HP 9 · Shields 1 · SP 11 · Budget 30 vs 30 (on)
- **Tribe** — Dragon
- **Keywords** — EVASION
- **Special · Flaming Slasher** (2◆) — Strike an opponent. That hit and your next basic attack apply BURN 4 for 2 rounds.
- **Passives**
  - EVASION: ~50% chance to dodge each incoming hit.
  - Every 2 rounds: permanently gains +1 DMG, +1 SP (stacking).
  - On summon: deal 3 DMG to enemies in the area ahead.
- **Found at** — Pyro · Forgotten Ruins
- **Lore** — _(none yet)_

#### Fenix · `pyro_fenix`

Epic · Ranger · Ranged · Cost 4

- **Stats** — DMG 9 · HP 10 · Shields 0 · SP 11 · Budget 30 vs 30 (on)
- **Special · Phoenix Blast** (2◆) — Deal 8 DMG and apply BURN 2 (2r) to the target and its neighbors.
- **Passives**
  - Burning Ashes — Revives when defeated at 1 HP once.
- **Found at** — Pyro · Forgotten Ruins
- **Lore** — _(none yet)_

#### Sarra · `pyro_sarra`

Epic · Mage · Ranged · Cost 4

- **Stats** — DMG 4 ×2 · HP 14 · Shields 1 · SP 8 · Budget 32 vs 30 (+2)
- **Special · Bluflame Slashing** (3◆) — Apply BURN 3 for 2 rounds to opponents in the row directly ahead, and Bluflame them (cannot be healed).
- **Passives** — none beyond the PYRO aura
- **Found at** — Pyro · Forgotten Ruins
- **Lore** — _(none yet)_

#### Tiki · `pyro_tiki`

Epic · Tank · Melee · Cost 4

- **Stats** — DMG 2 ×2 · HP 18 · Shields 2 · SP 4 · Budget 30 vs 30 (on)
- **Special · Axe Spin** (3◆) — Apply BURN 1 for 2 rounds to every opponent in range.
- **Passives**
  - End of round: deals 1 DMG to opponents in the row directly ahead.
  - Its Special reaches any slot on the board.
- **Found at** — Pyro · Ember Fortress Drill Yard
- **Lore** — _(none yet)_

#### Fenrir · `pyro_fenrir`

Epic · Warrior · Melee · Cost 5

- **Stats** — DMG 4 ×2 · HP 17 · Shields 0 · SP 10 · Budget 35 vs 35 (on)
- **Tribe** — Dragon, Wolf, Volcanic
- **Keywords** — FLYING
- **Special · Inferno Pounce** (3◆) — Deal 8 DMG and splash BURN 3 (2 rounds) to the target and its neighbours.
- **Passives**
  - Scorch — Basic hits apply BURN (1) for 2 rounds.
  - On a kill: +1 hit.
  - On summon: deal 4 DMG to enemies in the area ahead.
- **Found at** — Pyro · Firespine Foothills
- **Lore** — _(none yet)_

#### FireFly · `pyro_firefly`

Epic · Ranger · Ranged · Cost 5

- **Stats** — DMG 2 ×4 · HP 13 · Shields 1 · SP 12 · Budget 35 vs 35 (on)
- **Special · Flying Flame Strike** (2◆) — Deal 1 DMG to up to 8 RANDOM opponents and move up to 3 spaces.
- **Passives**
  - BlastOff — Auto-fires its Special for free on a kill, then gains FLYING for 2 rounds.
  - Its Special reaches any slot on the board.
- **Found at** — Pyro · Firespine Foothills
- **Lore** — _(none yet)_

#### Twins · `pyro_twins`

Epic · Tank · Melee · Cost 5

- **Stats** — DMG 2 ×2 · HP 29 · Shields 0 · SP 2 · Budget 35 vs 35 (on)
- **Special · Double Trouble** (2◆) — Deal 2×2 DMG to an opponent and gain +6 HP.
- **Passives**
  - Rager Twins — Bad Temper: permanently gains +1 DMG each time a basic attack lands.
  - Below 12 HP its basic attacks are weakened to half damage.
- **Found at** — Pyro · Firespine Foothills
- **Lore** — _(none yet)_

<!-- rare -->

#### Canister · `pyro_canister`

Rare · Support · Ranged · Cost 1

- **Stats** — DMG 0 · HP 15 · Shields 0 · SP 0 · Budget 15 vs 15 (on)
- **Tribe** — Forged Tech
- **Special** — none
- **Passives**
  - Talent (free · once per game) — Rollout: Once per game: deal 2 DMG, then roll through to the first open slot toward the enemy home.
  - KaBoooom — On death, explodes for 6 DMG to every card on the board except PYRO.
- **Found at** — Pyro · Sunfall Coast; Aqua · The Reef Wall (overflow)
- **Lore** — _(none yet)_

#### Florence · `pyro_florence`

Rare · Ranger · Ranged · Cost 1

- **Stats** — DMG 2 ×2 · HP 4 · Shields 0 · SP 7 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - Pop — On death, bursts for 1 DMG to every opponent.
- **Found at** — Pyro · Ashfall Approach
- **Lore** — _(none yet)_

#### Grill · `pyro_bbq`

Rare · Tank · Melee · Cost 1

- **Stats** — DMG 2 · HP 12 · Shields 0 · SP 1 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - Every 1 rounds: permanently gains +1 DMG (stacking).
- **Found at** — Pyro · Cinder Road
- **Lore** — _(none yet)_

#### Ingit · `pyro_ingit`

Rare · Warrior · Melee · Cost 1

- **Stats** — DMG 1 · HP 8 · Shields 2 · SP 4 · Budget 17 vs 15 (+2)
- **Special** — none
- **Passives**
  - Hot Hot — When hit by melee: retaliate — .
  - Hot Hot: when hit by melee, doubles the BURN already on the attacker.
- **Found at** — Pyro · Cinder Road
- **Lore** — _(none yet)_

#### Smog · `pyro_smog_card`

Rare · Support · Ranged · Cost 1

- **Stats** — DMG 0 · HP 15 · Shields 0 · SP 0 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - Creeping Cloud — On a kill: +1 SP.
  - End of round: deals 1 DMG to every opponent in range.
- **Found at** — Pyro · Dessaer District: Forge of Fire
- **Lore** — _(none yet)_

#### Sparky · `pyro_sparky`

Rare · Assassin · Melee · Cost 1

- **Stats** — DMG 4 · HP 4 · Shields 0 · SP 7 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - Burning Bark — When an enemy is summoned, hops to the closest empty adjacent slot and hits it with BURN.
- **Found at** — Pyro · Ashfall Approach
- **Lore** — _(none yet)_

#### Staph · `pyro_staph`

Rare · Mage · Ranged · Cost 1

- **Stats** — DMG 3 · HP 5 · Shields 0 · SP 7 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - On summon: apply BURN for 2 rounds to one enemy.
- **Found at** — Pyro · Ashfall Approach; Four Seasons Mega Forest · The Rot Line (overflow)
- **Lore** — _(none yet)_

#### BaBoom · `pyro_baboom`

Rare · Warrior · Melee · Cost 2

- **Stats** — DMG 2 ×2 · HP 10 · Shields 1 · SP 6 · Budget 22 vs 20 (+2)
- **Tribe** — Forged Tech
- **Special** — none
- **Passives**
  - On summon: deal 2 DMG to all enemies in range and push them back 1.
- **Found at** — Pyro · Cinder Road
- **Lore** — _(none yet)_

#### Firecrack · `pyro_firecrack`

Rare · Assassin · Melee · Cost 2

- **Stats** — DMG 5 · HP 4 · Shields 0 · SP 11 · Budget 20 vs 20 (on)
- **Special** — none
- **Passives**
  - Bloodfire Detonator — Vs a BLOODFIRE target (bleeding AND burning), basics gain ×2 DMG.
- **Found at** — Pyro · Sunfall Coast
- **Lore** — _(none yet)_

#### Flamehound · `pyro_flamehound`

Rare · Ranger · Ranged · Cost 2

- **Stats** — DMG 6 · HP 6 · Shields 0 · SP 8 · Budget 20 vs 20 (on)
- **Special** — none
- **Passives**
  - On summon: deal 3 DMG to enemies in the area ahead.
- **Found at** — Pyro · Sunfall Coast
- **Lore** — _(none yet)_

#### Heatsink Golem · `pyro_heatsink_golem`

Rare · Tank · Melee · Cost 2

- **Stats** — DMG 2 · HP 15 · Shields 0 · SP 3 · Budget 20 vs 20 (on)
- **Special** — none
- **Passives**
  - Bloodember — Basic hits apply BLEED (2) for 2 rounds.
- **Found at** — Pyro · Dessaer District: Forge of Fire
- **Lore** — _(none yet)_

#### Taper · `pyro_taper`

Rare · Mage · Ranged · Cost 2

- **Stats** — DMG 5 · HP 8 · Shields 0 · SP 7 · Budget 20 vs 20 (on)
- **Special** — none
- **Passives**
  - Out with a Bang — On death, applies BURN 1 to opponents in their far row for 1 round.
- **Found at** — Pyro · Cinder Road
- **Lore** — _(none yet)_

#### Ash Boar · `pyro_ash_boar`

Rare · Warrior · Melee · Cost 3

- **Stats** — DMG 7 · HP 10 · Shields 0 · SP 8 · Budget 25 vs 25 (on)
- **Special** — none
- **Passives**
  - On summon: deal 4 DMG to 8 enemies.
- **Found at** — Pyro · The Slagfields
- **Lore** — _(none yet)_

#### Dyna · `pyro_dyna`

Rare · Ranger · Ranged · Cost 3

- **Stats** — DMG 5 · HP 11 · Shields 0 · SP 9 · Budget 25 vs 25 (on)
- **Tribe** — Forged Tech
- **Special** — none
- **Passives**
  - Talent (free · once per game) — Demolition Charge: Once per game, free: deal 4 DMG plus half the target's current HP.
- **Found at** — Pyro · Dessaer District: Forge of Fire
- **Lore** — _(none yet)_

#### Ember Scorpion · `pyro_ember_scorpion`

Rare · Assassin · Melee · Cost 3

- **Stats** — DMG 9 · HP 8 · Shields 0 · SP 8 · Budget 25 vs 25 (on)
- **Special** — none
- **Passives**
  - Basic hits apply BURN (2) for 2 rounds.
- **Found at** — Pyro · The Slagfields
- **Lore** — _(none yet)_

#### Slag Tortoise · `pyro_slag_tortoise`

Rare · Tank · Melee · Cost 3

- **Stats** — DMG 2 · HP 15 · Shields 4 · SP 0 · Budget 25 vs 25 (on)
- **Keywords** — BLOCK
- **Special** — none
- **Passives**
  - BLOCK 1: every incoming hit is reduced by 1 — before shields, and even against PEN.
- **Found at** — Pyro · The Slagfields
- **Lore** — _(none yet)_

#### Spitfire · `pyro_spitfire`

Rare · Ranger · Ranged · Cost 3

- **Stats** — DMG 3 ×2 · HP 11 · Shields 0 · SP 8 · Budget 25 vs 25 (on)
- **Tribe** — Forged Tech
- **Special** — none
- **Passives**
  - On summon: deal 3 DMG to 3 enemies.
- **Found at** — Pyro · Dessaer District: Forge of Fire
- **Lore** — _(none yet)_

#### Wick · `pyro_wick`

Rare · Mage · Ranged · Cost 3

- **Stats** — DMG 3 · HP 12 · Shields 0 · SP 9 · Budget 24 vs 25 (-1)
- **Special** — none
- **Passives**
  - Wax Bomb — Basic hits apply DOT (5) for 1 round.
  - Talent (free · once per game) — 5 Wicked Frag: Once per game, free: deal 5 DMG to a target and 3 DMG to all other opponents.
- **Found at** — Pyro · The Slagfields
- **Lore** — _(none yet)_

### PYRO — spells

#### Spark · `pyro_spark`

Damage · Cost 1✦

- **Text** — Deal 3 DMG to a target and apply BURN 1 for 1 round.
- **Lore** — _(none yet)_

#### Ember Trap · `pyro_ember_trap`

Trap · Cost 2✦

- **Text** — Hide a trap on an empty slot. The first opponent to MOVE onto it takes 5 DMG and BURN 2 for 2 rounds.
- **Lore** — _(none yet)_

#### Flare Push · `pyro_flare_push`

Damage · Cost 3✦

- **Text** — Deal 4 DMG (PEN) to a target and push it back 1 space (if open).
- **Lore** — _(none yet)_

#### Firewall · `pyro_firewall`

Wall · Cost 4✦

- **Text** — Set a row ablaze for 3 rounds. A card that MOVES into it takes 3 DMG and BURN 1. Ranged attacks and FLYING cards pass over.
- **Lore** — _(none yet)_

#### Ashfall · `pyro_ashfall`

Area · Cost 5✦ · area: board

- **Text** — Deal 3 DMG to every opponent and BURN 2 each for 2 rounds.
- **Lore** — _(none yet)_

#### Heatwave · `pyro_heatwave`

Field · Cost 6✦ · 3 rounds

- **Text** — Field (3 rounds): your PYRO allies gain +1 DMG, and BURN you inflict never expires — your opponents' BURN stops ticking down.
- **Lore** — _(none yet)_

#### Meltdown · `pyro_meltdown`

Damage · Cost 7✦

- **Text** — Deal 10 DMG (PEN — ignores shields entirely) to a target and BURN 4 for 3 rounds.
- **Lore** — _(none yet)_

#### Inferno Pit · `pyro_inferno_pit`

Trap · Cost 8✦

- **Text** — Hide a trap on an empty slot. The first opponent to MOVE onto it — and every opponent beside it — takes 8 DMG and BURN 4 for 3 rounds.
- **Lore** — _(none yet)_

#### Cataclysm · `pyro_cataclysm`

Area · Cost 9✦ · area: board

- **Text** — Deal 8 DMG to every opponent — 16 to anything already BURNing.
- **Lore** — _(none yet)_

#### Volcanic Eruption · `pyro_volcanic_eruption`

Area · Cost 10✦ · area: board

- **Text** — Deal 15 DMG to every opponent and BURN 5 each for 3 rounds. For the rest of the game, your PYRO allies permanently gain +2 DMG.
- **Lore** — _(none yet)_

---

## AQUA

**Element aura · Flow Change** — On summon, choose a boost for 3 rounds: Liquid +2 DMG · Frozen +3 shields · Vapor +4 SP.

39 cards · 1 token · 10 spells

### AQUA — cards

<!-- mythic -->

#### Hydrogon · `aqua_hydrogon`

Mythic · Assassin · Melee · Cost 9

- **Stats** — DMG 13 · HP 31 · Shields 0 · SP 11 · Budget 55 vs 55 (on)
- **Tribe** — Dragon, Vapor
- **Special · Vapor Beam** (4◆) — Deal 18 DMG to a target and splash SCALD 6 (DOT, 2 rounds) to adjacent opponents.
- **Passives**
  - Infinite Serpent — On a kill: +1 DMG · +1 SP · 3 DMG to the lowest-HP opponent.
  - Its Special reaches any slot on the board.
- **Found at** — Aqua · Atlantis: Heart of the Ocean
- **Lore** — _(none yet)_

#### Kraken · `aqua_kraken`

Mythic · Warrior · Melee · Cost 10

- **Stats** — DMG 4 ×3 · HP 42 · Shields 0 · SP 6 · Budget 60 vs 60 (on)
- **Tribe** — SeaC
- **Special · Black Wave Crash** (4◆) — Lose 5 HP. Deal 8 DMG to all opponents and BLIND them 2 rounds (water in their eyes). 3-round cooldown.
- **Passives**
  - Aura — SeaC allies gain +4 max HP.
  - From the Deep — Below 17 HP: +3 DMG · +3 SP · +3 shields.
- **Found at** — Aqua · The Deep
- **Lore** — _(none yet)_

<!-- legendary -->

#### Cloudburst · `aqua_rain`

Legendary · Ranger · Ranged · Cost 6

- **Stats** — DMG 10 · HP 19 · Shields 0 · SP 11 · Budget 40 vs 40 (on)
- **Tribe** — Liquid
- **Special · Scoped 50GAL** (3◆) — Your next basic attack fires 3 shots and can aim across up to 3 opponents.
- **Passives**
  - Rainstorm: basic attacks splash 1 DMG to every opponent adjacent to the target.
  - Downpour — Aura: while it lives, allied basic attacks splash 1 DMG to every opponent adjacent to their target.
- **Found at** — Aqua · Atlantis Outer Ring
- **Lore** — _(none yet)_

#### Driftwraith · `aqua_driftwraith`

Legendary · Assassin · Melee · Cost 6

- **Stats** — DMG 9 · HP 14 · Shields 3 · SP 11 · Budget 40 vs 40 (on)
- **Tribe** — Deep Creatures, SeaC
- **Keywords** — STEALTH
- **Special · Boneyard Ambush** (3◆) — Break stealth to deal 14 DMG (PEN) to an opponent.
- **Passives**
  - Perpetual Fog — On a kill: STEALTH for 1 round.
- **Found at** — Aqua · Atlantis Outer Ring
- **Lore** — _(none yet)_

#### Phrost · `aqua_phrost`

Legendary · Support · Ranged · Cost 6

- **Stats** — DMG 8 · HP 16 · Shields 2 · SP 12 · Budget 40 vs 40 (on)
- **Tribe** — Dragon, Ice
- **Special · Icicle Freeze** (4◆) — Deal 4 DMG × 2 and FREEZE up to 2 opponents for 2 rounds.
- **Passives**
  - Each round: SCALD 3 on every FROZEN opponent.
- **Found at** — Aqua · Ice Castle: Guardians of Ice
- **Lore** — _(none yet)_

#### Polar King · `aqua_polarking`

Legendary · Tank · Melee · Cost 6

- **Stats** — DMG 6 · HP 22 · Shields 4 · SP 4 · Budget 40 vs 40 (on)
- **Tribe** — Ice Kingdom
- **Special · Polar Shift** (4◆) — FREEZE up to 3 opponents anywhere for 2 rounds.
- **Passives**
  - King of Ice — When hit by melee (50%): retaliate — FREEZE.
  - Its Special reaches any slot on the board.
- **Found at** — Aqua · Ice Castle: Guardians of Ice
- **Lore** — _(none yet)_

#### Glacius · `aqua_glacius`

Legendary · Mage · Ranged · Cost 7

- **Stats** — DMG 3 ×2 · HP 25 · Shields 3 · SP 8 · Budget 45 vs 45 (on)
- **Special · Deep Freeze** (4◆) — Deal 4 DMG and FREEZE up to 3 opponents for 2 rounds.
- **Passives**
  - Each round: SCALD 2 on every FROZEN opponent.
- **Found at** — Aqua · Ice Castle: Guardians of Ice
- **Lore** — _(none yet)_

#### Magalogoon · `aqua_magalogoon`

Legendary · Warrior · Melee · Cost 7

- **Stats** — DMG 8 · HP 33 · Shields 0 · SP 4 · Budget 45 vs 45 (on)
- **Tribe** — SeaC
- **Special · Bog Ambush** (3◆) — Drag an opponent from up to two rows away into this row, deal 10 DMG, and mire them — 4 SP, permanently.
- **Passives**
  - Swamp Monster — Buried in the muck: hidden and untargetable each round it neither moves nor attacks — doing either gives it up until the next round it stays still.
  - Its Special reaches any slot on the board.
- **Found at** — Aqua · Atlantis Outer Ring
- **Lore** — _(none yet)_

#### Siren · `aqua_siren`

Legendary · Mage · Ranged · Cost 7

- **Stats** — DMG 2 ×4 · HP 17 · Shields 1 · SP 13 · Budget 40 vs 45 (-5)
- **Tribe** — SeaC
- **Special · Sea Terror** (4◆) — Transform into Krakler (9/8/SP8), applying SCALD 3 + FREEZE. When Krakler dies, revert to Siren at full HP.
- **Passives**
  - Siren Song — When hit (melee or ranged): retaliate — FREEZE.
- **Found at** — Aqua · Atlantis Outer Ring
- **Lore** — _(none yet)_

<!-- epic -->

#### Bahari · `aqua_bahari`

Epic · Mage · Ranged · Cost 3

- **Stats** — DMG 2 ×2 · HP 12 · Shields 0 · SP 9 · Budget 25 vs 25 (on)
- **Tribe** — Liquid
- **Special · Tsunami** (4◆) — Deal 6 DMG to all opponents and −3 SP for the round. 3-round cooldown.
- **Passives**
  - Liquification: heals 1 HP for every basic hit it lands.
- **Found at** — Aqua · Mists of Despair
- **Lore** — _(none yet)_

#### Blackice · `aqua_blackice`

Epic · Tank · Melee · Cost 3

- **Stats** — DMG 2 · HP 16 · Shields 2 · SP 3 · Budget 25 vs 25 (on)
- **Tribe** — Ice
- **Special · Avalanche** (3◆) — Deal 3 DMG to opponents in the row directly ahead.
- **Passives**
  - Icicle Weapon: its basic attack damage equals its current shield count.
  - Icicle Shields — On summon, raises a 3-shield barrier.
- **Found at** — Aqua · Mists of Despair
- **Lore** — _(none yet)_

#### Coilblade · `aqua_icynin`

Epic · Assassin · Melee · Cost 3

- **Stats** — DMG 4 · HP 10 · Shields 0 · SP 11 · Budget 25 vs 25 (on)
- **Tribe** — Ice, Dragon
- **Keywords** — CRIT
- **Special · Icy Storm** (3◆) — Deal 3 DMG to 2 opponents, then gain STEALTH for 2 rounds.
- **Passives**
  - Frozen Serpent — Basic hits 50% chance to apply FREEZE for 1 round.
  - Shatter: a basic that lands on a FROZEN target splashes 3 to every enemy adjacent to it.
- **Found at** — Aqua · Northern Ice Floes
- **Lore** — _(none yet)_

#### Octoirate · `aqua_octoirate`

Epic · Ranger · Ranged · Cost 3

- **Stats** — DMG 4 · HP 14 · Shields 0 · SP 9 · Budget 27 vs 25 (+2)
- **Tribe** — SeaC, Liquid
- **Special · Wave Crash** (2◆) — Deal 4 DMG to the 3 opponents directly ahead.
- **Passives**
  - On a kill: +3 max HP.
  - Sucker Sword: a landed basic drags the struck enemy 1 slot toward it.
- **Found at** — Aqua · Mists of Despair
- **Lore** — _(none yet)_

#### Owlette · `aqua_owlette`

Epic · Support · Ranged · Cost 3

- **Stats** — DMG 5 · HP 12 · Shields 0 · SP 8 · Budget 25 vs 25 (on)
- **Tribe** — Avian, Ice
- **Keywords** — FLYING
- **Special · Owl Hail** (3◆) — Deal 4 DMG and FREEZE up to 3 opponents for 1 round.
- **Passives**
  - Each round: FREEZE the weakest opponent for 1 round.
- **Found at** — Aqua · Northern Ice Floes
- **Lore** — _(none yet)_

#### Cryo · `aqua_cryo`

Epic · Ranger · Ranged · Cost 4

- **Stats** — DMG 5 · HP 15 · Shields 3 · SP 5 · Budget 31 vs 30 (+1)
- **Tribe** — Ice
- **Special · Mega Icicle** (2◆) — Throw an icicle dealing 5 DMG to a 2×2 area; a FROZEN target's FREEZE is doubled.
- **Passives**
  - Cold Snap — Vs FREEZE targets, basics gain +2 DMG.
  - Its Special reaches any slot on the board.
- **Found at** — Aqua · Ice Castle Outer Ward
- **Lore** — _(none yet)_

#### Liquark · `aqua_liquark`

Epic · Warrior · Melee · Cost 4

- **Stats** — DMG 6 · HP 18 · Shields 0 · SP 6 · Budget 30 vs 30 (on)
- **Tribe** — SeaC
- **Special · Bloody Waters** (2◆) — Deal 4 DMG to the lowest-HP opponent. On a kill: heal +5 HP and re-enter Lurk (STEALTH).
- **Passives**
  - Lurk: while hidden in STEALTH, +4 DMG and +4 SP. Attacking breaks STEALTH (Lurk ends); Bloody Waters' kill re-enters it.
  - On summon: gain STEALTH for 99 rounds.
  - Its Special reaches any slot on the board.
- **Found at** — Aqua · The Steamvent Trench
- **Lore** — _(none yet)_

#### PolarBear · `aqua_polarbear`

Epic · Tank · Melee · Cost 4

- **Stats** — DMG 5 · HP 22 · Shields 0 · SP 4 · Budget 31 vs 30 (+1)
- **Tribe** — Ice
- **Special · Ice Crash Claw** (2◆) — Two claws: 3 DMG each, FREEZE 2 rounds each. Spend both on one opponent to freeze it for 4.
- **Passives**
  - On summon: give nearby allies +1 shield.
- **Found at** — Aqua · Northern Ice Floes
- **Lore** — _(none yet)_

#### Serenos · `aqua_anos`

Epic · Mage · Ranged · Cost 4

- **Stats** — DMG 6 · HP 16 · Shields 0 · SP 8 · Budget 30 vs 30 (on)
- **Tribe** — Liquid
- **Special · Mind Bubble Channeling** (2◆) — For 2 rounds, each round end: +1 DMG, heal +4, and fully cleanse yourself.
- **Passives**
  - Liquid Serenity: on a round it doesn't attack, heals +8 and gains +1 DMG next round.
- **Found at** — Aqua · Ice Castle Outer Ward
- **Lore** — _(none yet)_

#### BlackBeard · `aqua_blackbeard`

Epic · Warrior · Ranged · Cost 5

- **Stats** — DMG 5 · HP 19 · Shields 1 · SP 7 · Budget 33 vs 35 (-2)
- **Tribe** — SeaC
- **Special · Vapor Shark Cannon** (4◆) — Deal 5 DMG and apply SCALD 2 (2r) to up to 3 opponents anywhere.
- **Passives**
  - Scalding Shot — Basic hits apply SCALD (1) for 2 rounds.
  - King of the Seas — On a kill: +2/1 DMG.
  - Its Special reaches any slot on the board.
- **Found at** — Aqua · The Steamvent Trench
- **Lore** — _(none yet)_

#### Ice Wall · `aqua_icewall`

Epic · Tank · Ranged · Cost 5

- **Stats** — DMG 3 · HP 20 · Shields 4 · SP 4 · Budget 35 vs 35 (on)
- **Keywords** — BLOCK 2
- **Special · Rapid Shot** (3◆) — Fire 3 shots split among targets in range. Each hit has a 40% chance to FREEZE for 2 rounds.
- **Passives**
  - BLOCK 2: every incoming hit is reduced by 2 — before shields, and even against PEN.
  - Frostbite — Basic hits 50% chance to apply FREEZE for 2 rounds.
  - Its Special reaches any slot on the board.
- **Found at** — Aqua · Ice Castle Outer Ward
- **Lore** — _(none yet)_

#### Sapphire · `aqua_sapphire`

Epic · Assassin · Melee · Cost 5

- **Stats** — DMG 3 ×2 · HP 15 · Shields 2 · SP 10 · Budget 35 vs 35 (on)
- **Tribe** — Dragon, Vapor
- **Special · Geyser Gash** (3◆) — Deal 3 DMG and apply SCALD 3 (2r) to up to 2 opponents.
- **Passives**
  - Vaporizer — On a kill: +1 DMG · +1 SP.
- **Found at** — Aqua · The Steamvent Trench
- **Lore** — _(none yet)_

#### Vaporem · `aqua_vaporem`

Epic · Support · Ranged · Cost 5

- **Stats** — DMG 2 ×5 · HP 17 · Shields 0 · SP 8 · Budget 35 vs 35 (on)
- **Tribe** — Vapor
- **Special · Drowning Mist** (2◆) — Deal 1 DMG × 5 to every opponent in range (shreds shields).
- **Passives**
  - Misty Haze — Basic hits apply BLIND for 1 round.
- **Found at** — Aqua · The Steamvent Trench
- **Lore** — _(none yet)_

<!-- rare -->

#### Anglerfish · `aqua_anglerfish`

Rare · Mage · Ranged · Cost 1

- **Stats** — DMG 3 · HP 6 · Shields 0 · SP 5 · Budget 14 vs 15 (-1)
- **Special** — none
- **Passives**
  - Lure: on summon, attackers have −25% accuracy against it for 1 round.
- **Found at** — Aqua · Coral Isles Shallows
- **Lore** — _(none yet)_

#### Dewling · `aqua_blub`

Rare · Warrior · Melee · Cost 1

- **Stats** — DMG 2 · HP 6 · Shields 0 · SP 7 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - Liquid Humidity — Each round: restore itself to full HP.
- **Found at** — Aqua · Coral Isles Shallows
- **Lore** — _(none yet)_

#### Misty · `aqua_misty`

Rare · Support · Ranged · Cost 1

- **Stats** — DMG 2 · HP 7 · Shields 0 · SP 6 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - Fog Settlement — On summon, fog rolls over your battlefield for 1 round — every enemy basic aimed at your cards has a 50% chance to whiff (flat, no status).
- **Found at** — Aqua · Leafward Crossing; Four Seasons Mega Forest · Rustling Woods (overflow)
- **Lore** — _(none yet)_

#### Piranha · `aqua_piranha`

Rare · Assassin · Melee · Cost 1

- **Stats** — DMG 2 ×2 · HP 3 · Shields 0 · SP 8 · Budget 15 vs 15 (on)
- **Tribe** — SeaC
- **Special** — none
- **Passives**
  - On summon: deal 2×1 DMG to 8 enemies and apply BLEED 2 for 2 rounds.
- **Found at** — Aqua · Leafward Crossing
- **Lore** — _(none yet)_

#### Saltjacks · `aqua_buccaneers`

Rare · Ranger · Ranged · Cost 1

- **Stats** — DMG 2 ×2 · HP 3 · Shields 0 · SP 8 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - On summon: deal 2 DMG to all enemies in range.
- **Found at** — Aqua · Leafward Crossing; Pyro · Sunfall Coast (overflow)
- **Lore** — _(none yet)_

#### SubCool · `aqua_subcool`

Rare · Mage · Ranged · Cost 1

- **Stats** — DMG 4 · HP 5 · Shields 0 · SP 7 · Budget 16 vs 15 (+1)
- **Special** — none
- **Passives**
  - Too Cool — Basic hits 50% chance to apply FREEZE for 1 round.
- **Found at** — Aqua · Coral Isles Shallows
- **Lore** — _(none yet)_

#### Arctik · `aqua_arctik`

Rare · Mage · Ranged · Cost 2

- **Stats** — DMG 4 · HP 7 · Shields 0 · SP 9 · Budget 20 vs 20 (on)
- **Special** — none
- **Passives**
  - Freeze Tag — Basic hits 25% chance to apply FREEZE for 1 round.
- **Found at** — Aqua · Aqua Village Docks
- **Lore** — _(none yet)_

#### Bootlegger · `aqua_bootlegger`

Rare · Warrior · Melee · Cost 2

- **Stats** — DMG 4 · HP 10 · Shields 0 · SP 7 · Budget 21 vs 20 (+1)
- **Special** — none
- **Passives**
  - Running Profits — On a kill: +2 max HP.
  - Stomp — On moving onto enemy ground: deal 3 DMG to an opponent in range.
- **Found at** — Aqua · Aqua Village Docks
- **Lore** — _(none yet)_

#### Bullet Shrimp · `aqua_bulletshrimp`

Rare · Assassin · Melee · Cost 2

- **Stats** — DMG 12 · HP 1 · Shields 0 · SP 7 · Budget 20 vs 20 (on)
- **Tribe** — SeaC
- **Special** — none
- **Passives**
  - Basic hits apply FREEZE for 1 round.
- **Found at** — Aqua · Corsair Lanes
- **Lore** — _(none yet)_

#### Frostveil · `aqua_icyninza`

Rare · Ranger · Ranged · Cost 2

- **Stats** — DMG 4 · HP 8 · Shields 0 · SP 8 · Budget 20 vs 20 (on)
- **Keywords** — CRIT
- **Special** — none
- **Passives**
  - On summon: deal 3 DMG to one enemy (can crit).
- **Found at** — Aqua · Corsair Lanes
- **Lore** — _(none yet)_

#### Harp · `aqua_harp`

Rare · Support · Ranged · Cost 2

- **Stats** — DMG 6 · HP 9 · Shields 0 · SP 5 · Budget 20 vs 20 (on)
- **Special** — none
- **Passives**
  - Harpoon Hook: a landed basic drags the struck enemy 1 slot toward it.
- **Found at** — Aqua · Aqua Village Docks
- **Lore** — _(none yet)_

#### Kinguin · `aqua_kinguin`

Rare · Tank · Melee · Cost 2

- **Stats** — DMG 3 · HP 8 · Shields 2 · SP 4 · Budget 19 vs 20 (-1)
- **Special** — none
- **Passives**
  - On summon: brings 2 Guins onto the board, right beside it.
- **Found at** — Aqua · Aqua Village Docks
- **Lore** — _(none yet)_

#### Coral Golem · `aqua_coralgolem`

Rare · Tank · Melee · Cost 3

- **Stats** — DMG 2 · HP 14 · Shields 4 · SP 1 · Budget 25 vs 25 (on)
- **Special** — none
- **Passives**
  - Coral Spurs — When hit by melee: retaliate — 2 DMG.
  - Gains +1 shield at the end of each round.
- **Found at** — Aqua · The Reef Wall
- **Lore** — _(none yet)_

#### Krakler · `aqua_krakler`

Rare · Assassin · Melee · Cost 3

- **Stats** — DMG 9 · HP 8 · Shields 0 · SP 8 · Budget 25 vs 25 (on)
- **Tribe** — Kraken, SeaC
- **Special** — none
- **Passives**
  - On summon: apply SCALD 3 for 2 rounds + FREEZE for 2 rounds to one enemy.
- **Found at** — Aqua · Corsair Lanes
- **Lore** — _(none yet)_

#### Siphon · `aqua_siphon`

Rare · Support · Ranged · Cost 3

- **Stats** — DMG 4 · HP 10 · Shields 2 · SP 7 · Budget 25 vs 25 (on)
- **Tribe** — Liquid
- **Special** — none
- **Passives**
  - Talent (free · once per game) — Cyclone: Once per game, free: hit all opponents in the adjacent row and CLEANSE all allies.
- **Found at** — Aqua · The Reef Wall
- **Lore** — _(none yet)_

#### Spinefin · `aqua_spinefin`

Rare · Ranger · Ranged · Cost 3

- **Stats** — DMG 6 · HP 12 · Shields 0 · SP 7 · Budget 25 vs 25 (on)
- **Tribe** — SeaC
- **Special** — none
- **Passives**
  - Venom Spines — Basic hits apply SCALD (2) for 2 rounds.
- **Found at** — Aqua · Corsair Lanes
- **Lore** — _(none yet)_

#### Tide · `aqua_tide`

Rare · Warrior · Melee · Cost 3

- **Stats** — DMG 4 · HP 13 · Shields 3 · SP 2 · Budget 25 vs 25 (on)
- **Tribe** — SeaC
- **Special** — none
- **Passives**
  - Talent (free · once per game) — Shell Tuck: Once per game, free: gain 6 shields, but Tide's basic attacks miss 50% of the time for 2 rounds.
  - On summon: a wave deals 2 DMG to the enemy row ahead and heals all allies 2 HP.
- **Found at** — Aqua · The Reef Wall
- **Lore** — _(none yet)_

### AQUA — tokens

Not draftable: these arrive on the board from another card's ability, so their lore answers to whatever summons them.

#### Guin · `aqua_guin_tok`

Rare · Warrior · Melee · Cost 1

- **Stats** — DMG 2 · HP 3 · Shields 0 · SP 5 · Budget 10 vs 15 (-5)
- **Special** — none
- **Passives** — none beyond the AQUA aura
- **Summoned by** — Kinguin
- **Lore** — _(none yet)_

### AQUA — spells

#### Chill · `aqua_chill`

Choice · Cost 1✦

- **Text** — Choose — strike a foe for 3 DMG + FREEZE 1, or shield an AQUA ally +2.
- **Lore** — _(none yet)_

#### Frost Patch · `aqua_frost_patch`

Area · Cost 2✦ · area: row

- **Text** — FREEZE every opponent in a chosen row for 1 round.
- **Lore** — _(none yet)_

#### Steam Vent · `aqua_steam_vent`

Damage · Cost 3✦

- **Text** — Deal 4 DMG to a target, and apply SCALD 2 for 2 rounds if it is FROZEN.
- **Lore** — _(none yet)_

#### Ice Wall · `aqua_ice_wall`

Wall · Cost 4✦

- **Text** — A wall of ice across a row for 3 rounds. A card that MOVES in takes 2 DMG and is FROZEN 1 round. Ranged attacks and FLYING cards pass over.
- **Lore** — _(none yet)_

#### Dense Fog · `aqua_dense_fog`

Field · Cost 5✦ · 3 rounds

- **Text** — Field (3 rounds): a fog rolls in — every opponent attack has a chance to miss.
- **Lore** — _(none yet)_

#### Downpour · `aqua_downpour`

Field · Cost 6✦ · 3 rounds

- **Text** — Field (3 rounds): your AQUA allies gain +2 shield each round, and you re-pick Flow Change for all of them every round.
- **Lore** — _(none yet)_

#### Pressure Crush · `aqua_pressure_crush`

Damage · Cost 7✦

- **Text** — Deal 10 DMG (PEN — ignores shields entirely) to a target and drop its SP to 0 for the round.
- **Lore** — _(none yet)_

#### Glacial Wave · `aqua_glacial_wave`

Area · Cost 8✦ · area: tworows

- **Text** — FREEZE every opponent across two adjacent rows for 2 rounds, and give AQUA allies in those rows +2 shield.
- **Lore** — _(none yet)_

#### Maelstrom · `aqua_maelstrom`

Area · Cost 9✦ · area: board

- **Text** — Deal 8 DMG to every opponent — double (16) to any that are FROZEN.
- **Lore** — _(none yet)_

#### Tsunami · `aqua_tsunami`

Area · Cost 10✦ · area: board

- **Text** — Deal 15 DMG to every opponent and FREEZE them for 2 rounds. For the rest of the game, AQUA allies gain +2 shield at the start of each round.
- **Lore** — _(none yet)_

---

## DAWN

**Element aura · Awakening** — On summon, strikes the nearest enemy for half its DMG. End of round, burns one negative status off itself and gains +1 SP (caps at SP 14).

39 cards · 2 tokens · 10 spells

### DAWN — cards

<!-- mythic -->

#### Equestrian · `dawn_equestrian`

Mythic · Warrior · Melee · Cost 9

- **Stats** — DMG 12 · HP 23 · Shields 4 · SP 12 · Budget 55 vs 55 (on)
- **Special · Solar Horse Power** (4◆) — Charge straight ahead, dealing 15 DMG to opponents in the column and pushing the leader to the farthest slot.
- **Passives**
  - Ride or Die: enters play with +0 DMG and +24 HP.
  - Solar Sovereign — Aura: while it lives, allies are immune to stat reduction (WEAKEN).
- **Found at** — Dawn · Sun's Army Fronts
- **Lore** — _(none yet)_

#### Supernova · `dawn_supernova`

Mythic · Mage · Ranged · Cost 9

- **Stats** — DMG 7 ×2 · HP 32 · Shields 0 · SP 9 · Budget 55 vs 55 (on)
- **Tribe** — Dragon
- **Keywords** — FLYING
- **Special · Gamma Ray Burst** (4◆) — Deal 14 DMG to a target and 14 DMG to every opponent adjacent to it. Supernova loses 5 HP.
- **Passives**
  - Blinding Star (Aura): while it lives, opponents' basic attacks hit one fewer target (their splash is suppressed).
  - On summon: deal 2 DMG to all enemies in range.
  - Its Special reaches any slot on the board.
- **Found at** — Dawn · Stars Army Flakes
- **Lore** — _(none yet)_

#### Imperator · `dawn_imperator`

Mythic · Tank · Melee · Cost 10

- **Stats** — DMG 10 · HP 26 · Shields 10 · SP 4 · Budget 60 vs 60 (on)
- **Special · Strike of Dawn** (5◆) — Spawn Heir (10/10/2🛡/SP10), then command the charge — every ally immediately fires a basic attack. Crowned: cleanses allies each round. 3-round cooldown.
- **Passives**
  - Crowned: cleanses all negative statuses from allies each round.
- **Found at** — Dawn · Dawn Castle
- **Lore** — _(none yet)_

<!-- legendary -->

#### Aurora · `dawn_aurora`

Legendary · Mage · Ranged · Cost 6

- **Stats** — DMG 5 ×2 · HP 14 · Shields 3 · SP 10 · Budget 40 vs 40 (on)
- **Special · Light Orb Creation** (3◆) — Conjure 3 Light Orbs — blue (3 DMG + BLIND 2), green (2 DMG + heal weakest ally 7), red (POISON 2). Each absorbs one incoming hit, then bursts at the attacker.
- **Passives**
  - Life Cycle: each incoming hit is absorbed by a Light Orb that bursts at the attacker, then disappears. Every opponent death recharges one orb.
- **Found at** — Dawn · Castle Grounds
- **Lore** — _(none yet)_

#### Heir · `dawn_heir_tok`

Legendary · Assassin · Melee · Cost 6

- **Stats** — DMG 10 · HP 10 · Shields 2 · SP 10 · Budget 34 vs 40 (-6)
- **Special · Crowned** (3◆) — Gain +5 DMG, +5 HP, +5 SP permanently. 3-round cooldown, three times in all.
- **Passives**
  - King Me — On a kill: permanently shaves 1 off its own Crowned cost, stacking (King Me).
  - Gains +1 shield at the end of each round.
- **Found at** — Dawn · Castle Grounds
- **Lore** — _(none yet)_

#### Kosmos · `dawn_kosmos`

Legendary · Ranger · Ranged · Cost 6

- **Stats** — DMG 2 ×4 · HP 18 · Shields 2 · SP 10 · Budget 40 vs 40 (on)
- **Special · Flashing Barrage** (3◆) — Deal 2 DMG × 3 and BLIND every opponent in range for 1 round.
- **Passives**
  - Each round: 2 DMG to the closest opponent · BLIND the closest opponent for 1 round.
- **Found at** — Dawn · Castle Grounds
- **Lore** — _(none yet)_

#### Leo · `dawn_leo`

Legendary · Warrior · Melee · Cost 7

- **Stats** — DMG 7 · HP 25 · Shields 2 · SP 7 · Budget 43 vs 45 (-2)
- **Special · Golden Guardian** (3◆) — Gain +5 HP every round for 7 rounds.
- **Passives**
  - King of the Wild: once per round, when an opponent is summoned, gain +2 shields and +1 DMG for the round.
- **Found at** — Dawn · The Golden Court
- **Lore** — _(none yet)_

#### Reveille · `dawn_aurelion`

Legendary · Support · Ranged · Cost 7

- **Stats** — DMG 5 · HP 21 · Shields 5 · SP 9 · Budget 45 vs 45 (on)
- **Special · Dawn's Rally** (4◆) — Heal all allies 3 HP and grant them +2 DMG and +2 speed for 2 rounds.
- **Passives**
  - Radiant Ward: each round, allies get a barrier that absorbs the next negative status.
- **Found at** — Dawn · Castle Grounds
- **Lore** — _(none yet)_

#### Sunbanner · `dawn_commander`

Legendary · Tank · Melee · Cost 7

- **Stats** — DMG 6 · HP 17 · Shields 7 · SP 7 · Budget 44 vs 45 (-1)
- **Special · Flash Squad** (2◆) — Command allies in the row directly ahead to each use their basic attack.
- **Passives**
  - Aura — all allies gain +1 shields.
- **Found at** — Dawn · The Golden Court
- **Lore** — _(none yet)_

#### Empyrean · `dawn_dawn`

Legendary · Support · Ranged · Cost 8

- **Stats** — DMG 3 ×3 · HP 19 · Shields 5 · SP 12 · Budget 50 vs 50 (on)
- **Keywords** — FLYING
- **Special · Golden Courage** (3◆) — Heal every ally 5 HP, CLEANSE them, and give the team +1 DMG for 2 rounds.
- **Passives**
  - Each round: heal every ally 3 HP.
- **Found at** — Dawn · The Golden Court
- **Lore** — _(none yet)_

<!-- epic -->

#### Amble · `dawn_amble`

Epic · Support · Ranged · Cost 3

- **Stats** — DMG 4 · HP 10 · Shields 2 · SP 7 · Budget 25 vs 25 (on)
- **Keywords** — FLYING
- **Special · Battle Maiden** (2◆) — Heal up to 3 allies 4 HP and give them +1 DMG for the round.
- **Passives**
  - Each round: heal the most wounded ally 4 HP.
- **Found at** — Dawn · Sunrise Muster
- **Lore** — _(none yet)_

#### Gilden · `dawn_golde`

Epic · Warrior · Melee · Cost 3

- **Stats** — DMG 4 · HP 13 · Shields 2 · SP 5 · Budget 26 vs 25 (+1)
- **Special · War Cry** (1◆) — Gain 2 shields, then give the team +1 DMG for 2 rounds.
- **Passives**
  - Relentless — When hit by melee: retaliate — 2 DMG.
- **Found at** — Dawn · Sunrise Muster
- **Lore** — _(none yet)_

#### Lazor · `dawn_lazor`

Epic · Assassin · Melee · Cost 3

- **Stats** — DMG 5 · HP 10 · Shields 0 · SP 8 · Budget 23 vs 25 (-2)
- **Special · Flash Ray Strike** (2◆) — Deal 7 DMG to one opponent.
- **Passives**
  - On a kill: +2 DMG.
  - Flashing Final — On death, deals 7 damage back to its killer.
- **Found at** — Dawn · Sunrise Muster
- **Lore** — _(none yet)_

#### Star · `dawn_star`

Epic · Mage · Ranged · Cost 3

- **Stats** — DMG 2 ×2 · HP 10 · Shields 2 · SP 7 · Budget 25 vs 25 (on)
- **Keywords** — FLYING
- **Special · Star Shower** (2◆) — Deal 4 DMG and BLIND every opponent in range.
- **Passives**
  - Once, at the end of the round it lands: BLIND every opponent for 1 round.
  - Raising Star: a landed basic attack also heals every ally +1 HP.
- **Found at** — Dawn · Sunrise Muster
- **Lore** — _(none yet)_

#### Ariel · `dawn_ariel`

Epic · Assassin · Melee · Cost 4

- **Stats** — DMG 7 · HP 11 · Shields 2 · SP 7 · Budget 29 vs 30 (-1)
- **Special · 100,000°** (2◆) — Your next basic attack deals +14 DMG.
- **Passives**
  - On summon: deal 7 DMG to one enemy.
  - Last Light — On death, deals 3 damage back to its killer.
- **Found at** — Dawn · The Blazing Road
- **Lore** — _(none yet)_

#### Radiance · `dawn_radiance`

Epic · Warrior · Melee · Cost 4

- **Stats** — DMG 5 · HP 17 · Shields 2 · SP 4 · Budget 30 vs 30 (on)
- **Special · SunSword Blasting Strike** (2◆) — Lose 1 HP to deal 11 DMG to any target.
- **Passives**
  - Its Special reaches any slot on the board.
  - Brightest Warrior: on summon, gains +1 DMG and +1 max HP for every 7 max HP the toughest opponent has.
- **Found at** — Dawn · The Blazing Road
- **Lore** — _(none yet)_

#### Solara · `dawn_solara`

Epic · Support · Ranged · Cost 4

- **Stats** — DMG 8 · HP 11 · Shields 1 · SP 11 · Budget 32 vs 30 (+2)
- **Special · Blinding Sunrise** (3◆) — BLIND all opponents for the round and summon a Radiant Guardian.
- **Passives**
  - Morning Glow — Each round: heal every ally 1 HP.
  - Its Special reaches any slot on the board.
  - On summon: brings 1 Radiant Guardian onto the board.
- **Found at** — Dawn · The Solar Bastion
- **Lore** — _(none yet)_

#### Solstice · `dawn_solstice`

Epic · Support · Ranged · Cost 4

- **Stats** — DMG 5 · HP 14 · Shields 2 · SP 7 · Budget 30 vs 30 (on)
- **Special · Daybreak** (2◆) — Heal every ally 5 HP and give them +2 SP for the round.
- **Passives**
  - Radiant Ward: each round, allies get a barrier that absorbs the next negative status.
- **Found at** — Dawn · The Solar Bastion
- **Lore** — _(none yet)_

#### Tether · `dawn_ty`

Epic · Mage · Ranged · Cost 4

- **Stats** — DMG 6 · HP 12 · Shields 2 · SP 7 · Budget 29 vs 30 (-1)
- **Special · Lacing Knots** (3◆) — Deal 8 DMG to all opponents bound by Magic Ropes (locked Specials) this round.
- **Passives**
  - Magic Ropes — Each round: bind 2 opponents — their Specials are disabled next round.
  - Its Special reaches any slot on the board.
- **Found at** — Dawn · The Blazing Road
- **Lore** — _(none yet)_

#### Veil · `dawn_veil`

Epic · Tank · Melee · Cost 4

- **Stats** — DMG 3 · HP 20 · Shields 3 · SP 2 · Budget 31 vs 30 (+1)
- **Special · Light Shield** (1◆) — Give an ally +3 shields.
- **Passives**
  - On summon, raises a 8-shield barrier; when it breaks, gains +1 DMG / +2 SP permanently.
- **Found at** — Dawn · The Solar Bastion
- **Lore** — _(none yet)_

#### Zenith · `dawn_raya`

Epic · Ranger · Ranged · Cost 4

- **Stats** — DMG 7 · HP 10 · Shields 2 · SP 7 · Budget 28 vs 30 (-2)
- **Special · Orbital Shot** (2◆) — Choose a target; an arrow falls at the start of next round dealing 14 DMG to it.
- **Passives**
  - Star Blaster — On a kill: BLIND nearby opponents for 1 round.
  - Its Special reaches any slot on the board.
- **Found at** — Dawn · The Blazing Road
- **Lore** — _(none yet)_

#### Drakonbane · `dawn_drakonbane`

Epic · Assassin · Melee · Cost 5

- **Stats** — DMG 9 · HP 15 · Shields 3 · SP 5 · Budget 35 vs 35 (on)
- **Special · Sunlight Strike** (2◆) — Deal 14 DMG to a Dragon (or anything above 25 HP), 10 DMG otherwise. On Kill: gain 2 shield.
- **Passives**
  - Dragon's Bane — Basic attacks deal +2 DMG against Dragons and anything above 25 HP.
  - On summon: deal 7 DMG to the nearest Dragon or a foe above 25 HP on the board.
- **Found at** — Dawn · High Noon
- **Lore** — _(none yet)_

#### Eclipse · `dawn_clipsey`

Epic · Ranger · Ranged · Cost 5

- **Stats** — DMG 1 ×7 · HP 12 · Shields 1 · SP 14 · Budget 35 vs 35 (on)
- **Special · High Noon Revolver** (3◆) — Deal 1 DMG × 7 to every opponent in range (shreds shields).
- **Passives**
  - Hot Shot — On a kill: +1 DMG (round).
  - Hot Shot: its attacks never miss — ignores its own BLIND and the target's EVASION.
- **Found at** — Dawn · High Noon
- **Lore** — _(none yet)_

#### Halo · `dawn_halo`

Epic · Support · Ranged · Cost 5

- **Stats** — DMG 3 · HP 18 · Shields 2 · SP 10 · Budget 35 vs 35 (on)
- **Special · Mending Horn** (3◆) — Heal an ally +8 HP and CLEANSE them (remove negative statuses and stat changes).
- **Passives**
  - Blessed Light — Each round: heal home-row allies 1 HP.
  - Purelight (Aura): while it lives, DAWN allies are immune to BLIND and their attacks pierce enemy EVASION.
- **Found at** — Dawn · High Noon
- **Lore** — _(none yet)_

#### SirCrest · `dawn_sircrest`

Epic · Mage · Ranged · Cost 5

- **Stats** — DMG 3 ×2 · HP 17 · Shields 2 · SP 7 · Budget 34 vs 35 (-1)
- **Special · Burning Waterfall** (3◆) — Apply BURN 2 and SCALD 2 to all opponents in range.
- **Passives**
  - PYRO aura — Scorch: Basic attacks apply BURN, stacking up to BURN 5 on the same target.
  - AQUA aura — Flow Change: On summon, choose a boost for 3 rounds: Liquid +2 DMG · Frozen +3 shields · Vapor +4 SP.
  - Its Special reaches any slot on the board.
- **Found at** — Dawn · High Noon
- **Lore** — _(none yet)_

#### WarPhant · `dawn_warphant`

Epic · Tank · Melee · Cost 5

- **Stats** — DMG 5 · HP 29 · Shields 0 · SP 1 · Budget 35 vs 35 (on)
- **Special · Battle Charge** (3◆) — Charge up to 4 spaces forward: 10 DMG to the first opponent in your column and shove it back, plus 7 DMG to any opponents touching behind it.
- **Passives**
  - Trample Through: in Prep it can step onto an adjacent opponent with less max HP, shoving it back a slot and taking the square (needs the slot behind it open).
  - Mounted: moves like a chess king — a diagonal step costs 1, not 2 (lost if it dismounts).
  - War Ready — On summon, raises a 4-shield barrier.
  - Last Rider — On death, raises 1 WarRider.
  - War Ready — On moving into a Mid row: gain +2 shield.
  - Its Special reaches any slot on the board.
- **Found at** — Dawn · The Solar Bastion
- **Lore** — _(none yet)_

<!-- rare -->

#### Beam · `dawn_beam`

Rare · Ranger · Ranged · Cost 1

- **Stats** — DMG 1 ×3 · HP 5 · Shields 0 · SP 7 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - On summon: deal 3 DMG to one enemy and apply BLIND for 2 rounds.
- **Found at** — Dawn · The Arctic Veil
- **Lore** — _(none yet)_

#### Flash · `dawn_flash`

Rare · Assassin · Melee · Cost 1

- **Stats** — DMG 3 · HP 2 · Shields 0 · SP 10 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - Basic hits apply BLIND for 1 round.
- **Found at** — Dawn · The Arctic Veil
- **Lore** — _(none yet)_

#### Outrider · `dawn_roy`

Rare · Warrior · Melee · Cost 1

- **Stats** — DMG 2 · HP 8 · Shields 1 · SP 3 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - Frontline Scout — On moving into a Mid row: gain +2 shield.
- **Found at** — Dawn · First Light Camp
- **Lore** — _(none yet)_

#### Sparkle · `dawn_sparkle`

Rare · Mage · Ranged · Cost 1

- **Stats** — DMG 2 ×2 · HP 2 · Shields 0 · SP 9 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - Fickle Wand — Basic hits 25% chance to apply BLIND for 1 round.
- **Found at** — Dawn · First Light Camp
- **Lore** — _(none yet)_

#### Vigil · `dawn_able`

Rare · Support · Ranged · Cost 1

- **Stats** — DMG 1 · HP 12 · Shields 0 · SP 2 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - Emergency Support — Each round: heal allies under 4 HP by +2.
  - Its basic attack can be aimed at a wounded ally to heal them for its DMG instead of striking.
- **Found at** — Dawn · The Arctic Veil
- **Lore** — _(none yet)_

#### Glimmer · `dawn_glime`

Rare · Warrior · Melee · Cost 2

- **Stats** — DMG 3 · HP 10 · Shields 1 · SP 5 · Budget 20 vs 20 (on)
- **Special** — none
- **Passives**
  - On summon, raises a 2-shield barrier; when it breaks, gains +1 DMG / +1 SP permanently.
- **Found at** — Dawn · First Light Camp
- **Lore** — _(none yet)_

#### Reflection · `dawn_reflection`

Rare · Tank · Melee · Cost 2

- **Stats** — DMG 2 · HP 12 · Shields 2 · SP 3 · Budget 21 vs 20 (+1)
- **Keywords** — REFLECT
- **Special** — none
- **Passives**
  - REFLECT 1: returns 1 DMG to attackers.
  - End of round: grants +3 shields to every ally within range.
- **Found at** — Dawn · Mirrorfield
- **Lore** — _(none yet)_

#### Shine · `dawn_shine`

Rare · Mage · Ranged · Cost 2

- **Stats** — DMG 1 ×3 · HP 11 · Shields 0 · SP 6 · Budget 20 vs 20 (on)
- **Special** — none
- **Passives**
  - Brightling Ball: when an ally is killed, answers the killer with 4 DMG + BLIND 3r (once per game).
- **Found at** — Dawn · Mirrorfield
- **Lore** — _(none yet)_

#### Sphere · `dawn_sphere`

Rare · Mage · Ranged · Cost 2

- **Stats** — DMG 4 · HP 7 · Shields 0 · SP 9 · Budget 20 vs 20 (on)
- **Keywords** — PEN
- **Special** — none
- **Passives**
  - On summon, raises a 2-shield barrier.
- **Found at** — Dawn · Mirrorfield
- **Lore** — _(none yet)_

#### St. Bernard · `dawn_stbern`

Rare · Support · Ranged · Cost 2

- **Stats** — DMG 3 · HP 12 · Shields 0 · SP 6 · Budget 21 vs 20 (+1)
- **Special** — none
- **Passives**
  - Rescue Pack — Each round: heal allies under 2 HP by +4.
  - Its basic attack can be aimed at a wounded ally to heal them for its DMG instead of striking.
- **Found at** — Dawn · Golden Farmlands
- **Lore** — _(none yet)_

#### GoldenEagle · `dawn_goldeneagle`

Rare · Ranger · Ranged · Cost 3

- **Stats** — DMG 1 ×5 · HP 6 · Shields 1 · SP 12 · Budget 25 vs 25 (on)
- **Keywords** — FLYING
- **Special** — none
- **Passives**
  - Every 3 rounds: permanently gains +1 DMG (stacking).
  - Talent (free · once per game) — Shimmering Featherrows: Deal 3 DMG to 3 opponents, then gain STEALTH for 2 rounds.
- **Found at** — Dawn · Golden Farmlands
- **Lore** — _(none yet)_

#### Musk Ox · `dawn_musk_ox`

Rare · Warrior · Melee · Cost 3

- **Stats** — DMG 5 · HP 18 · Shields 0 · SP 2 · Budget 25 vs 25 (on)
- **Keywords** — BLOCK
- **Special** — none
- **Passives**
  - BLOCK 1: every incoming hit is reduced by 1 — before shields, and even against PEN.
- **Found at** — Dawn · Golden Farmlands
- **Lore** — _(none yet)_

#### Oxin · `dawn_oxin`

Rare · Tank · Melee · Cost 3

- **Stats** — DMG 2 · HP 19 · Shields 1 · SP 2 · Budget 25 vs 25 (on)
- **Keywords** — BLOCK
- **Special** — none
- **Passives**
  - BLOCK 1: every incoming hit is reduced by 1 — before shields, and even against PEN.
  - Fountain — When hit by melee: retaliate — −1 SP.
  - Braced Stance — immune to knockback, push, and pull effects — planted where it stands.
- **Found at** — Dawn · Golden Farmlands
- **Lore** — _(none yet)_

### DAWN — tokens

Not draftable: these arrive on the board from another card's ability, so their lore answers to whatever summons them.

#### WarRider · `dawn_warrider_tok`

Epic · Warrior · Melee · Cost 2

- **Stats** — DMG 5 · HP 7 · Shields 0 · SP 7 · Budget 19 vs 20 (-1)
- **Special** — none
- **Passives** — none beyond the DAWN aura
- **Summoned by** — nothing (orphan token)
- **Lore** — _(none yet)_

#### Radiant Guardian · `dawn_radiant_guardian`

Epic · Warrior · Melee · Cost 3

- **Stats** — DMG 3 · HP 14 · Shields 3 · SP 4 · Budget 27 vs 25 (+2)
- **Keywords** — BLOCK
- **Special** — none
- **Passives**
  - BLOCK 1: every incoming hit is reduced by 1 — before shields, and even against PEN.
- **Summoned by** — Solara
- **Lore** — _(none yet)_

### DAWN — spells

#### Sunbeam · `dawn_sunbeam`

Damage · Cost 1✦

- **Text** — Deal 3 DMG to a target and BLIND them for 1 round.
- **Lore** — _(none yet)_

#### Cleansing Light · `dawn_cleansing_light`

Heal · Cost 2✦

- **Text** — CLEANSE all DAWN allies — remove up to 2 negative statuses each.
- **Lore** — _(none yet)_

#### Grace · `dawn_grace`

Heal · Cost 3✦

- **Text** — Heal a DAWN ally 5 HP and give it +1 DMG for the round.
- **Lore** — _(none yet)_

#### Radiant Barrier · `dawn_radiant_barrier`

Wall · Cost 4✦

- **Text** — A wall of light across a row for 3 rounds. A card that MOVES in takes 2 DMG and is BLINDed 1 round. DAWN allies in the row take 1 less DMG from all attacks. Ranged attacks and FLYING cards pass over.
- **Lore** — _(none yet)_

#### Dawn's Grace · `dawn_dawns_grace`

Heal · Cost 5✦

- **Text** — Heal all DAWN allies 5 HP and cleanse one negative status from each.
- **Lore** — _(none yet)_

#### Blazing Sun · `dawn_blazing_sun`

Field · Cost 6✦ · 3 rounds

- **Text** — Field (3 rounds): your DAWN allies heal 2 HP each round, cannot miss, and can see and target STEALTH cards.
- **Lore** — _(none yet)_

#### Judgment · `dawn_judgment`

Damage · Cost 7✦

- **Text** — Deal 10 DMG (PEN) to a target and cleanse one status from each DAWN ally.
- **Lore** — _(none yet)_

#### Solar Flare · `dawn_solar_flare`

Area · Cost 8✦ · area: tworows

- **Text** — BLIND every opponent across two adjacent rows for 2 rounds.
- **Lore** — _(none yet)_

#### Dawn's Judgment · `dawn_dawns_judgment`

Area · Cost 9✦ · area: board

- **Text** — Deal 8 DMG to every opponent — double (16) to any that are BLINDed.
- **Lore** — _(none yet)_

#### Eternal Dawn · `dawn_eternal_dawn`

Area · Cost 10✦ · area: board

- **Text** — Deal 15 DMG to every opponent and BLIND them for 2 rounds. For the rest of the game, DAWN allies heal 2 extra HP at the end of each round.
- **Lore** — _(none yet)_

---

## GALE

**Element aura · Zephyr** — End of round, +2 SP (caps at SP 21); the first time it passes SP 15, a one-time +1 DMG.

39 cards · 3 tokens · 10 spells

### GALE — cards

<!-- mythic -->

#### Stormfang · `gale_stormfang`

Mythic · Warrior · Melee · Cost 9

- **Stats** — DMG 11 · HP 27 · Shields 0 · SP 17 · Budget 55 vs 55 (on)
- **Tribe** — Wolf
- **Special · Whirling Missile** (5◆) — Dash into the target's row, then deal 14 DMG to it and 7 DMG to opponents adjacent to it.
- **Passives**
  - Aura — Wolf allies gain +1 DMG / +1 SP.
  - Apex Predator: +1 DMG for every 2 SP above 15.
- **Found at** — Gale · Wolfrun Hollow
- **Lore** — _(none yet)_

#### Skyrend · `gale_griffith`

Mythic · Ranger · Ranged · Cost 10

- **Stats** — DMG 17 · HP 29 · Shields 0 · SP 17 · Budget 63 vs 60 (+3)
- **Tribe** — Avian
- **Keywords** — FLYING
- **Special · Dive Bomb** (5◆) — Dive up to 3 spaces in any direction onto your target, deal 24 DMG (+5 splash) and WEAKEN it for 2 rounds, taking 25% recoil, then vanish into STEALTH until next round. 3-round cooldown.
- **Passives**
  - On a kill: +2 SP.
  - Aura — GALE allies gain +1 SP.
- **Found at** — Gale · Tempest Peaks
- **Lore** — _(none yet)_

<!-- legendary -->

#### Eagon · `gale_eagon`

Legendary · Warrior · Melee · Cost 6

- **Stats** — DMG 7 · HP 22 · Shields 0 · SP 11 · Budget 40 vs 40 (on)
- **Tribe** — Dragon, Avian
- **Special · Dark Wind Wave** (3◆) — Deal 5 DMG to opponents in the far row, pushing them toward the near row.
- **Passives**
  - Vision Guard: 50% chance when hit to take half damage and deal that much back to the attacker.
  - Its Special reaches any slot on the board.
- **Found at** — Gale · Stormwatch Cliffs: The Totem
- **Lore** — _(none yet)_

#### Tempest · `gale_tempest`

Legendary · Assassin · Melee · Cost 6

- **Stats** — DMG 6 · HP 16 · Shields 2 · SP 14 · Budget 40 vs 40 (on)
- **Keywords** — EVASION
- **Special · Cyclone Strike** (3◆) — Charge up to 3 slots and strike one opponent for 8 DMG (PEN).
- **Passives**
  - EVASION: ~50% chance to dodge each incoming hit.
  - High Speed Impact: +1 DMG for every point of SP above 10.
  - Its Special reaches any slot on the board.
- **Found at** — Gale · Stormwatch Cliffs: The Totem
- **Lore** — _(none yet)_

#### Totem · `gale_totem`

Legendary · Support · Ranged · Cost 6

- **Stats** — DMG 6 · HP 23 · Shields 0 · SP 11 · Budget 40 vs 40 (on)
- **Tribe** — Avian, Wolf
- **Keywords** — FLYING
- **Special · Rampage** (2◆) — Gain 1 basic attack hit for 3 rounds.
- **Passives**
  - Totem Spirit — Aura: while it lives, allied basic attacks cannot miss — and they can target through STEALTH and into the enemy Home row from anywhere.
  - On summon: brings 1 Totem Pole onto the board.
- **Found at** — Gale · Stormwatch Cliffs: The Totem
- **Lore** — _(none yet)_

#### Bluejay · `gale_bluejay`

Legendary · Ranger · Ranged · Cost 7

- **Stats** — DMG 5 ×2 · HP 24 · Shields 1 · SP 9 · Budget 45 vs 45 (on)
- **Tribe** — Avian
- **Special · Twin Wind Strikes** (4◆) — Two 7-DMG strikes — split across two opponents, or both onto one. Each saps 5 SP and WEAKENs for 2 rounds, so a double hit stacks to 14 DMG and −10 SP.
- **Passives**
  - Gustarrows — When an enemy is summoned within range, hits it with 2 DMG.
- **Found at** — Gale · The Eye of the Storm
- **Lore** — _(none yet)_

#### Galeon · `gale_galeon`

Legendary · Tank · Melee · Cost 7

- **Stats** — DMG 4 ×2 · HP 27 · Shields 2 · SP 6 · Budget 45 vs 45 (on)
- **Tribe** — Avian
- **Special · Mighty Winds** (3◆) — Push every opponent back 2, WEAKEN them (2r), and −8 SP for the round.
- **Passives**
  - Each round: push every opponent back 1 slot.
  - Its Special reaches any slot on the board.
- **Found at** — Gale · The Eye of the Storm
- **Lore** — _(none yet)_

#### Klipso · `gale_klipso`

Legendary · Assassin · Melee · Cost 7

- **Stats** — DMG 9 · HP 19 · Shields 1 · SP 13 · Budget 43 vs 45 (-2)
- **Keywords** — EVASION
- **Special · Tranq Feather Blade** (2◆) — Deal 10 DMG (PEN) and STUN the target for 2 rounds.
- **Passives**
  - EVASION: ~50% chance to dodge each incoming hit.
  - Harsh Winds — +4 DMG on the first strike against each opponent.
- **Found at** — Gale · The Eye of the Storm
- **Lore** — _(none yet)_

#### Kloud · `gale_kloud`

Legendary · Mage · Ranged · Cost 7

- **Stats** — DMG 6 ×2 · HP 23 · Shields 0 · SP 10 · Budget 45 vs 45 (on)
- **Special · Twisted Rage** (5◆) — Chain 4 → 6 → 8 → 10 DMG across adjacent opponents.
- **Passives**
  - Storm Surge — Each round: 2 DMG to the closest opponent.
  - Aura — Mage allies gain +1 DMG.
  - Aura — Ranger allies gain +1 DMG.
  - Its Special reaches any slot on the board.
- **Found at** — Gale · The Eye of the Storm
- **Lore** — _(none yet)_

<!-- epic -->

#### Angale · `gale_angale`

Epic · Mage · Ranged · Cost 3

- **Stats** — DMG 4 · HP 12 · Shields 0 · SP 9 · Budget 25 vs 25 (on)
- **Tribe** — Avian
- **Keywords** — FLYING
- **Special · Purple Wind Surge** (2◆) — Deal 1 DMG × 4, WEAKEN, and −2 SP to up to 3 opponents for 2 rounds.
- **Passives**
  - Alluring Aura — When hit by melee: retaliate — WEAKEN.
- **Found at** — Gale · Skyforge Aerie
- **Lore** — _(none yet)_

#### Hornrush · `gale_buf`

Epic · Warrior · Melee · Cost 3

- **Stats** — DMG 2 ×2 · HP 18 · Shields 0 · SP 3 · Budget 25 vs 25 (on)
- **Tribe** — Avian
- **Keywords** — BLOCK, REGEN
- **Special · Horn Toss** (2◆) — Deal 4 DMG and STUN up to 2 opponents for 2 rounds.
- **Passives**
  - REGEN 1: heals 1 HP at the end of each round.
  - BLOCK 1: every incoming hit is reduced by 1 — before shields, and even against PEN.
- **Found at** — Gale · Skyforge Aerie
- **Lore** — _(none yet)_

#### Squall · `gale_vaga`

Epic · Assassin · Melee · Cost 3

- **Stats** — DMG 5 · HP 8 · Shields 0 · SP 12 · Budget 25 vs 25 (on)
- **Special · Extinguisher** (1◆) — Deal 8 DMG (PEN) to a foe under 9 HP — an execute finisher.
- **Passives**
  - Shadow: can only be attacked by adjacent opponents — ranged shots from afar miss.
  - On the enemy battlefield: +1 DMG on the first strike against each opponent.
- **Found at** — Gale · Gale Village
- **Lore** — _(none yet)_

#### Sway · `gale_sway`

Epic · Ranger · Ranged · Cost 3

- **Stats** — DMG 4 · HP 9 · Shields 0 · SP 11 · Budget 24 vs 25 (-1)
- **Special · Birds of Prey** (3◆) — Spawn 3 attacking Ollies — each also fires at whatever the ally in front of it strikes.
- **Passives**
  - On summon: brings 1 Ollie onto the board.
- **Found at** — Gale · Skyforge Aerie
- **Lore** — _(none yet)_

#### Dreadgaze · `gale_guan`

Epic · Tank · Melee · Cost 4

- **Stats** — DMG 3 · HP 21 · Shields 0 · SP 6 · Budget 30 vs 30 (on)
- **Special · Vision of Fear** (3◆) — WEAKEN every opponent in range for 2 rounds; gain +5 max HP.
- **Passives**
  - On summon: apply WEAKEN for 2 rounds to enemies in the area ahead.
  - Its Special reaches any slot on the board.
- **Found at** — Gale · The Shrike Line
- **Lore** — _(none yet)_

#### Fanwing · `gale_fano`

Epic · Support · Ranged · Cost 4

- **Stats** — DMG 5 · HP 12 · Shields 2 · SP 9 · Budget 30 vs 30 (on)
- **Special · Feather Fan** (1◆) — Give every slower teammate Fanwing's SP value for 1 round.
- **Passives**
  - Blade Breaker — Basic hits 50% chance to apply WEAKEN for 1 round.
- **Found at** — Gale · Gale Village
- **Lore** — _(none yet)_

#### Mesala · `gale_masala`

Epic · Ranger · Ranged · Cost 4

- **Stats** — DMG 3 ×2 · HP 12 · Shields 0 · SP 10 · Budget 28 vs 30 (-2)
- **Tribe** — Avian
- **Keywords** — FLYING
- **Special · Razor Wind Talon** (3◆) — Deal 3 DMG and DOT 1 (2 rounds) to opponents in the far (home) row.
- **Passives**
  - Raptor Assault — Each round: raise 1 Raptor.
  - It won't raise another while 1 of its bodies still stand — clear one before it breeds again.
  - Its Special reaches any slot on the board.
- **Found at** — Gale · The Shrike Line
- **Lore** — _(none yet)_

#### Rayfen · `gale_rayfen`

Epic · Mage · Ranged · Cost 4

- **Stats** — DMG 2 ×2 · HP 16 · Shields 0 · SP 10 · Budget 30 vs 30 (on)
- **Keywords** — CRIT
- **Special · Ambush** (2◆) — Deal 5 DMG (PEN) to 2 opponents anywhere on the board.
- **Passives**
  - Its Special reaches any slot on the board.
  - Wind Warp — Moves to any open slot on the board, at any distance — but still cannot cross from its own Home row to the enemy's in one move.
- **Found at** — Gale · The Shrike Line
- **Lore** — _(none yet)_

#### Vulture · `gale_vvulture`

Epic · Tank · Melee · Cost 4

- **Stats** — DMG 3 · HP 17 · Shields 2 · SP 7 · Budget 31 vs 30 (+1)
- **Tribe** — Avian
- **Keywords** — FLYING
- **Special · Roosting Wing Shield** (2◆) — Gain 5 shields and heal +5 HP.
- **Passives**
  - Carrion Feast — On a kill: +1 DMG.
  - Salvage: whenever any card dies, gain +2 max HP.
- **Found at** — Gale · Northern Wind Villages
- **Lore** — _(none yet)_

#### Omega · `gale_omega`

Epic · Assassin · Melee · Cost 5

- **Stats** — DMG 7 · HP 13 · Shields 1 · SP 12 · Budget 34 vs 35 (-1)
- **Tribe** — Wolf
- **Special · Search and Destroy** (2◆) — Move up to 3 spaces into the enemy battlefield and deal 10 DMG to an opponent in range.
- **Passives**
  - Ride or Die — On a kill: +2 max HP.
  - Ride or Die: enters play with +3 DMG and +8 HP.
- **Found at** — Gale · Stormwall Approach
- **Lore** — _(none yet)_

#### WolfBane · `gale_wolfbane`

Epic · Warrior · Melee · Cost 5

- **Stats** — DMG 9 · HP 17 · Shields 0 · SP 9 · Budget 35 vs 35 (on)
- **Special · Whirlwind Slasher** (3◆) — Deal 5 DMG to every opponent and −2 SP for the round.
- **Passives**
  - Hastened Assault: basic attacks CRIT while faster than the target, healing +3 HP per crit.
  - Its Special reaches any slot on the board.
- **Found at** — Gale · Stormwall Approach
- **Lore** — _(none yet)_

#### Zephyra · `gale_wista`

Epic · Support · Ranged · Cost 5

- **Stats** — DMG 4 ×2 · HP 15 · Shields 1 · SP 10 · Budget 35 vs 35 (on)
- **Tribe** — Avian
- **Keywords** — FLYING
- **Special · Blue Wind Spiral** (3◆) — Deal 4 DMG that ricochets between opponents standing within 1 space of each other (up to 4 landings). Wind Wake shoves each one hit.
- **Passives**
  - Wind Wake — Every landed hit shoves the victim back 1 slot (if open).
- **Found at** — Gale · Stormwall Approach
- **Lore** — _(none yet)_

<!-- rare -->

#### Gastly · `gale_gastly`

Rare · Warrior · Melee · Cost 1

- **Stats** — DMG 2 · HP 8 · Shields 0 · SP 5 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - On summon: gain STEALTH for 1 round.
- **Found at** — Gale · Windward Steps
- **Lore** — _(none yet)_

#### Hawko · `gale_hawko`

Rare · Ranger · Ranged · Cost 1

- **Stats** — DMG 2 · HP 3 · Shields 0 · SP 10 · Budget 15 vs 15 (on)
- **Keywords** — FLYING
- **Special** — none
- **Passives**
  - Aerial Dominance — When an enemy is summoned within range, hits it with 1 DMG.
- **Found at** — Gale · The Raptor Roosts
- **Lore** — _(none yet)_

#### Sightwing · `gale_syt_bird`

Rare · Support · Ranged · Cost 1

- **Stats** — DMG 2 · HP 2 · Shields 0 · SP 11 · Budget 15 vs 15 (on)
- **Keywords** — FLYING
- **Special** — none
- **Passives**
  - Sky Scout: when it enters a Mid row, allies' basic attacks hit +1 adjacent target for the round.
- **Found at** — Gale · Amberleaf Groves
- **Lore** — _(none yet)_

#### Sirocco · `gale_sirocco`

Rare · Tank · Melee · Cost 1

- **Stats** — DMG 3 · HP 10 · Shields 0 · SP 2 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - Windfist — Every landed hit blows the target all the way back to its own Home row (as far as open slots allow).
- **Found at** — Gale · Windward Steps
- **Lore** — _(none yet)_

#### Skyforce · `gale_skyforce`

Rare · Mage · Ranged · Cost 1

- **Stats** — DMG 1 ×3 · HP 4 · Shields 0 · SP 8 · Budget 15 vs 15 (on)
- **Keywords** — FLYING
- **Special** — none
- **Passives**
  - On summon: deal 1 DMG to all enemies in range.
- **Found at** — Gale · Amberleaf Groves
- **Lore** — _(none yet)_

#### Swillow · `gale_swillow`

Rare · Assassin · Ranged · Cost 1

- **Stats** — DMG 4 · HP 3 · Shields 0 · SP 8 · Budget 15 vs 15 (on)
- **Keywords** — FLYING
- **Special** — none
- **Passives**
  - On summon: deal 4 DMG to one enemy.
- **Found at** — Gale · Amberleaf Groves
- **Lore** — _(none yet)_

#### Breeze · `gale_breeze`

Rare · Support · Ranged · Cost 2

- **Stats** — DMG 2 · HP 8 · Shields 0 · SP 10 · Budget 20 vs 20 (on)
- **Keywords** — FLYING
- **Special** — none
- **Passives**
  - Dust Gust — Basic hits 30% chance to apply BLIND for 1 round.
- **Found at** — Gale · The Rolling Flats
- **Lore** — _(none yet)_

#### Duster · `gale_duster`

Rare · Assassin · Melee · Cost 2

- **Stats** — DMG 4 · HP 8 · Shields 0 · SP 8 · Budget 20 vs 20 (on)
- **Special** — none
- **Passives**
  - On summon: give nearby allies +2 SP.
- **Found at** — Gale · The Rolling Flats
- **Lore** — _(none yet)_

#### Megair · `gale_megair`

Rare · Mage · Ranged · Cost 2

- **Stats** — DMG 3 ×2 · HP 5 · Shields 0 · SP 8 · Budget 19 vs 20 (-1)
- **Special** — none
- **Passives**
  - Mega Push: while below 3 HP, a landed basic also deals 3 to every opponent and pushes them back 2.
- **Found at** — Gale · Windward Steps
- **Lore** — _(none yet)_

#### Stormhide Bison · `gale_stormhide_bison`

Rare · Tank · Melee · Cost 2

- **Stats** — DMG 2 · HP 16 · Shields 0 · SP 1 · Budget 19 vs 20 (-1)
- **Keywords** — BLOCK
- **Special** — none
- **Passives**
  - BLOCK 1: every incoming hit is reduced by 1 — before shields, and even against PEN.
  - Braced Stance — immune to knockback, push, and pull effects — planted where it stands.
- **Found at** — Gale · Northern Wind Villages
- **Lore** — _(none yet)_

#### Toxhawk · `gale_toxhawk`

Rare · Ranger · Ranged · Cost 2

- **Stats** — DMG 3 · HP 6 · Shields 0 · SP 13 · Budget 22 vs 20 (+2)
- **Keywords** — FLYING
- **Special** — none
- **Passives**
  - Basic hits apply DOT (1) for 2 rounds.
- **Found at** — Gale · The Raptor Roosts
- **Lore** — _(none yet)_

#### Tumbleweed · `gale_tumbleweed`

Rare · Warrior · Melee · Cost 2

- **Stats** — DMG 4 · HP 9 · Shields 0 · SP 7 · Budget 20 vs 20 (on)
- **Keywords** — EVASION
- **Special** — none
- **Passives**
  - EVASION: ~50% chance to dodge each incoming hit.
  - Talent (free · once per game) — Roll Through: Once per game: deal 5 DMG, then roll through to the first open slot toward the enemy home.
- **Found at** — Gale · The Rolling Flats
- **Lore** — _(none yet)_

#### Luna · `gale_luna`

Rare · Assassin · Melee · Cost 3

- **Stats** — DMG 4 · HP 8 · Shields 0 · SP 13 · Budget 25 vs 25 (on)
- **Tribe** — Wolf
- **Special** — none
- **Passives**
  - Omega Restore — On a kill: heal 4 HP.
- **Found at** — Gale · Dark Wind Township
- **Lore** — _(none yet)_

#### Spindrift · `gale_klouy`

Rare · Mage · Ranged · Cost 3

- **Stats** — DMG 2 ×2 · HP 10 · Shields 1 · SP 9 · Budget 25 vs 25 (on)
- **Special** — none
- **Passives**
  - Twister — Basic hits 2nd hit: apply STUN for 2 rounds.
  - Talent (free · once per game) — Spiraling Windrow: Once per game, free: deal 5 DMG bouncing between opponents within 1 space of each other.
- **Found at** — Gale · Gale Village
- **Lore** — _(none yet)_

#### Stormquill · `gale_hawk`

Rare · Ranger · Ranged · Cost 3

- **Stats** — DMG 8 · HP 10 · Shields 0 · SP 7 · Budget 25 vs 25 (on)
- **Special** — none
- **Passives**
  - Talent (free · once per game) — Glide Rush: Gain +3 SP and EVASION for 2 rounds.
  - High Speed Impact: +1 DMG for every point of SP above 10.
- **Found at** — Gale · The Raptor Roosts
- **Lore** — _(none yet)_

#### Wailverine · `gale_wailverine`

Rare · Warrior · Melee · Cost 3

- **Stats** — DMG 5 · HP 16 · Shields 0 · SP 4 · Budget 25 vs 25 (on)
- **Special** — none
- **Passives**
  - Twisted Rush — Once, at the end of the round it lands: gore the enemy directly ahead for 6 (advance into its slot on a kill).
- **Found at** — Gale · Dark Wind Township
- **Lore** — _(none yet)_

#### Whirlwolf · `gale_whirlwolf`

Rare · Support · Ranged · Cost 3

- **Stats** — DMG 3 · HP 14 · Shields 0 · SP 8 · Budget 25 vs 25 (on)
- **Tribe** — Avian, Wolf
- **Keywords** — FLYING
- **Special** — none
- **Passives**
  - Talent (free · once per game) — Wave Pounce: Once per game, free: deal 2 DMG to all opponents and drop their SP by 3 for the round.
  - On summon: give nearby allies +5 SP.
- **Found at** — Gale · Northern Wind Villages
- **Lore** — _(none yet)_

#### Windsor · `gale_windsor`

Rare · Tank · Melee · Cost 3

- **Stats** — DMG 3 · HP 13 · Shields 0 · SP 9 · Budget 25 vs 25 (on)
- **Special** — none
- **Passives**
  - Right Through Me — When hit (melee or ranged): retaliate — WEAKEN.
- **Found at** — Gale · Dark Wind Township
- **Lore** — _(none yet)_

### GALE — tokens

Not draftable: these arrive on the board from another card's ability, so their lore answers to whatever summons them.

#### Totem Pole · `gale_totem_pole`

Legendary · Support · Ranged · Cost 3

- **Stats** — DMG 2 · HP 12 · Shields 2 · SP 0 · Budget 18 vs 25 (-7)
- **Special** — none
- **Passives**
  - End of round: deals 2 DMG to opponents in the row directly ahead.
- **Summoned by** — Totem
- **Lore** — _(none yet)_

#### Ollie · `gale_ollie`

Rare · Ranger · Ranged · Cost 1

- **Stats** — DMG 2 · HP 2 · Shields 0 · SP 11 · Budget 15 vs 15 (on)
- **Keywords** — FLYING
- **Special** — none
- **Passives**
  - Flying Arrow: also attacks whatever the ally directly in front of it strikes with a basic attack.
- **Summoned by** — Sway
- **Lore** — _(none yet)_

#### Raptor · `gale_toxhawk_tok`

Rare · Ranger · Ranged · Cost 2

- **Stats** — DMG 3 · HP 3 · Shields 0 · SP 13 · Budget 19 vs 20 (-1)
- **Tribe** — Avian
- **Keywords** — FLYING
- **Special** — none
- **Passives**
  - Toxic Talons — Basic hits apply DOT (1) for 2 rounds.
- **Summoned by** — nothing (orphan token)
- **Lore** — _(none yet)_

### GALE — spells

#### Gust · `gale_gust`

Damage · Cost 1✦

- **Text** — Deal 3 DMG to a target and push them back 1 space.
- **Lore** — _(none yet)_

#### Downdraft · `gale_downdraft`

Area · Cost 2✦ · area: row

- **Text** — WEAKEN every opponent in a chosen row for 2 rounds.
- **Lore** — _(none yet)_

#### Tailwind · `gale_tailwind`

Heal · Cost 3✦

- **Text** — Give a GALE ally +5 SP (jumps it up the Speed queue).
- **Lore** — _(none yet)_

#### Squall Line · `gale_squall_line`

Wall · Cost 4✦

- **Text** — Violent wind across a row for 3 rounds. A card that MOVES in takes 2 DMG and is pushed back 1. Ranged attacks and FLYING cards pass over.
- **Lore** — _(none yet)_

#### Storm Front · `gale_storm_front`

Area · Cost 5✦ · area: board

- **Text** — Deal 3 DMG to every opponent and sap 3 SP from each for the round.
- **Lore** — _(none yet)_

#### Jetstream · `gale_jetstream`

Field · Cost 6✦ · 3 rounds

- **Text** — Field (3 rounds): your GALE allies gain +3 SP, and every push you cause travels 1 space further.
- **Lore** — _(none yet)_

#### Vortex Strike · `gale_vortex_strike`

Damage · Cost 7✦

- **Text** — Deal 10 DMG (PEN) to a target and STUN them for 1 round.
- **Lore** — _(none yet)_

#### Gale Force · `gale_gale_force`

Area · Cost 8✦ · area: tworows

- **Text** — WEAKEN every opponent across two adjacent rows for 2 rounds and push each back 1 space.
- **Lore** — _(none yet)_

#### Cyclone · `gale_cyclone`

Area · Cost 9✦ · area: board

- **Text** — Deal 8 DMG to every opponent and drop each to 0 SP for the round.
- **Lore** — _(none yet)_

#### Tempest · `gale_tempest`

Area · Cost 10✦ · area: board

- **Text** — Deal 15 DMG to every opponent and drop each to 0 SP for the round. For the rest of the game, GALE allies permanently gain +2 SP.
- **Lore** — _(none yet)_

---

## BOLT

**Element aura · Electrify** — Basic attacks leave the target ELECTRIFIED, and BOLT cards deal +2 DMG to any opponent carrying a status.

39 cards · 3 tokens · 10 spells

### BOLT — cards

<!-- mythic -->

#### Velvolt Knight · `bolt_velvolt_knight`

Mythic · Mage · Ranged · Cost 9

- **Stats** — DMG 9 ×2 · HP 20 · Shields 2 · SP 13 · Budget 55 vs 55 (on)
- **Special · Ultra Power Gauntlets** (4◆) — Gain +2 DMG and FLYING for 3 rounds; basic attacks also hit +1 adjacent target.
- **Passives**
  - When battle begins: applies ELECTRIFIED for 1 round(s) to every opponent in range.
  - Gains +1 shield at the end of each round.
  - Electro Knight — The first time its shields are broken, it PARALYZEs the attacker for 2 rounds.
- **Found at** — Bolt City · The Grid Vault
- **Lore** — _(none yet)_

#### Elecdroid · `bolt_elecdroid`

Mythic · Assassin · Melee · Cost 10

- **Stats** — DMG 15 · HP 27 · Shields 7 · SP 10 · Budget 66 vs 60 (+6)
- **Special · Light Slasher** (5◆) — 5·5·5·10 combo on a target; on a kill, chain to the next enemy with +5 to the rest of the combo. 3-round cooldown.
- **Passives**
  - Hyper Power Surge — On a kill: +5 DMG (round) · +5 SP.
- **Found at** — Bolt City · City Power Core
- **Lore** — _(none yet)_

<!-- legendary -->

#### Blackout · `bolt_shock`

Legendary · Mage · Ranged · Cost 6

- **Stats** — DMG 2 ×5 · HP 19 · Shields 0 · SP 11 · Budget 40 vs 40 (on)
- **Special · Fryer** (4◆) — Deal 4 DMG to all opponents and MUTE them for 1 round; PARALYZED opponents take +1 DMG.
- **Passives**
  - Overcharge — On a kill: +1 DMG (round).
  - Each round: PARALYZE every opponent at or under 4 HP for 1 round.
  - On summon: deal 5 DMG to one enemy (can crit).
  - Its Special reaches any slot on the board.
- **Found at** — Bolt City · The Hive Array
- **Lore** — _(none yet)_

#### Jack Arc · `bolt_jack_arc`

Legendary · Support · Ranged · Cost 6

- **Stats** — DMG 2 ×3 · HP 16 · Shields 3 · SP 12 · Budget 40 vs 40 (on)
- **Tribe** — ARC
- **Special · StunGun** (3◆) — Blast 3 targets for 4 DMG and PARALYZE them for 3 rounds.
- **Passives**
  - Static Electricity — Each round: PARALYZE one opponent for 2 rounds.
  - Aura — ARC allies gain +2 SP.
  - Its Special reaches any slot on the board.
- **Found at** — Bolt City · The Hive Array
- **Lore** — _(none yet)_

#### Keeper · `bolt_keeper`

Legendary · Ranger · Ranged · Cost 6

- **Stats** — DMG 7 · HP 21 · Shields 1 · SP 10 · Budget 40 vs 40 (on)
- **Special · Storm Swarm** (3◆) — Raise one Beebot per opponent carrying a status, then every Beebot on the board stings.
- **Passives**
  - Hive Command — Each round: raise 1 Beebot.
  - Aura — Bot allies gain +3 DMG.
  - Hive Mind — Living Bot allies soak up to 50% of the damage aimed at this card, as far as their own HP stretches.
  - It won't raise another while 5 of its bodies still stand — clear one before it breeds again.
  - On summon: brings 2 Beebots onto the board.
- **Found at** — Bolt City · The Hive Array
- **Lore** — _(none yet)_

#### Voltedge · `bolt_zoez`

Legendary · Assassin · Melee · Cost 6

- **Stats** — DMG 7 · HP 19 · Shields 0 · SP 14 · Budget 40 vs 40 (on)
- **Special · Razr Lightning Bladerang** (2◆) — Hurl the bladerang for 7 DMG to a target and apply a 7-DOT for 1 round.
- **Passives**
  - Striking Defense — When hit by melee: retaliate — 3 DMG.
  - Striking Defense: immune to Ranged attacks.
- **Found at** — Bolt City · The Hive Array
- **Lore** — _(none yet)_

#### GigaVolt · `bolt_gigavolt`

Legendary · Tank · Ranged · Cost 7

- **Stats** — DMG 0 · HP 35 · Shields 5 · SP 0 · Budget 45 vs 45 (on)
- **Tribe** — ARC
- **Special · Turret Mode** (5◆) — ELECTRIFY all opponents, then deal 3 DMG to every Electrified opponent now and at the end of each round for 3 rounds.
- **Passives**
  - Power Up — On a kill: +2 shields.
  - Every 1 rounds: permanently gains +1 DMG, +1 SP (stacking).
  - Aura — BOLT allies gain +1 DMG.
- **Found at** — Bolt City · Stormcaller's Spire
- **Lore** — _(none yet)_

#### Stormcaller · `bolt_stormcaller`

Legendary · Mage · Ranged · Cost 7

- **Stats** — DMG 2 ×2 · HP 25 · Shields 2 · SP 12 · Budget 45 vs 45 (on)
- **Special · Chain Paralysis** (4◆) — PARALYZE up to 3 opponents for 2 rounds.
- **Passives**
  - End of round: deals 2 DMG to every PARALYZED opponent in range.
- **Found at** — Bolt City · Stormcaller's Spire
- **Lore** — _(none yet)_

#### Voltogon · `bolt_voltogon`

Legendary · Warrior · Melee · Cost 8

- **Stats** — DMG 7 · HP 29 · Shields 2 · SP 10 · Budget 50 vs 50 (on)
- **Tribe** — Dragon
- **Special · Gigavolt Strike** (4◆) — Deal 11 DMG and heal self 11 HP.
- **Passives**
  - Powertrip — On a kill: 5 to all electrified (statused) enemies, once/round.
- **Found at** — Bolt City · Stormcaller's Spire
- **Lore** — _(none yet)_

<!-- epic -->

#### Lytning · `bolt_lytning`

Epic · Mage · Ranged · Cost 3

- **Stats** — DMG 3 ×2 · HP 11 · Shields 0 · SP 8 · Budget 25 vs 25 (on)
- **Special · Whip Strike** (3◆) — Deal 3 DMG and PARALYZE every opponent in range for 2 rounds.
- **Passives**
  - End of round: deals 2 DMG to every PARALYZED opponent in range.
- **Found at** — Bolt City · Breaker Yard
- **Lore** — _(none yet)_

#### Ricochet · `bolt_zagphu`

Epic · Warrior · Melee · Cost 3

- **Stats** — DMG 5 · HP 12 · Shields 0 · SP 8 · Budget 25 vs 25 (on)
- **Special · Static Toss** (2◆) — Deal 8 DMG and PARALYZE the target for 3 rounds.
- **Passives**
  - Precision Strike — Vs any target carrying a status, basics gain CRIT · heal 4.
- **Found at** — Bolt City · Breaker Yard
- **Lore** — _(none yet)_

#### Static · `bolt_static`

Epic · Support · Ranged · Cost 3

- **Stats** — DMG 4 · HP 10 · Shields 2 · SP 7 · Budget 25 vs 25 (on)
- **Tribe** — ARC
- **Special · Discharge** (2◆) — Deal 1 DMG × 3 and PARALYZE every opponent in range for 2 rounds.
- **Passives**
  - Static Charge — On a kill: extends PARALYZE on every enemy by 1 round.
- **Found at** — Bolt City · Arc Industries Yards
- **Lore** — _(none yet)_

#### Storm · `bolt_storm`

Epic · Assassin · Melee · Cost 3

- **Stats** — DMG 3 · HP 14 · Shields 0 · SP 9 · Budget 26 vs 25 (+1)
- **Special · Thunder Strike** (1◆) — Deal 5 DMG to every ELECTRIFIED opponent.
- **Passives**
  - Every 1 rounds: permanently gains +1 DMG, +1 SP, +2 HP (stacking).
  - Its Special reaches any slot on the board.
- **Found at** — Bolt City · Breaker Yard
- **Lore** — _(none yet)_

#### Webster · `bolt_webster`

Epic · Ranger · Ranged · Cost 3

- **Stats** — DMG 2 ×2 · HP 8 · Shields 2 · SP 8 · Budget 24 vs 25 (-1)
- **Tribe** — ARC
- **Special · Web Shock** (2◆) — Deal 3 DMG and PARALYZE up to 3 opponents for 2 rounds.
- **Passives**
  - Electro Wrap — Basic hits 2nd hit: apply MUTED for 1 round.
- **Found at** — Bolt City · Arc Industries Yards
- **Lore** — _(none yet)_

#### Dynamo · `bolt_shoksa`

Epic · Support · Ranged · Cost 4

- **Stats** — DMG 6 · HP 12 · Shields 0 · SP 12 · Budget 30 vs 30 (on)
- **Special · Static Pressure Overload** (2◆) — PARALYZE lasts 1 round longer on every already-PARALYZED opponent; everyone else is marked ELECTRIFIED for the round.
- **Passives**
  - On summon: fires its Special — already-PARALYZED opponents are held 1 round longer, everyone else is marked ELECTRIFIED.
  - Static Discharge — End of round: deals 2 DMG to every ELECTRIFIED opponent in range.
- **Found at** — Bolt City · Overload Junction
- **Lore** — _(none yet)_

#### Highroller · `bolt_striik`

Epic · Mage · Ranged · Cost 4

- **Stats** — DMG 4 · HP 14 · Shields 1 · SP 10 · Budget 30 vs 30 (on)
- **Keywords** — CRIT
- **Special · Purple Strikes** (2◆) — Deal 2 CRIT damage to the 4 closest opponents and mark them Electrified permanently.
- **Passives**
  - Jackpot: a basic CRIT fires its Special for free; 3 crits in one round grant +7 HP and +2 DMG.
  - Its Special reaches any slot on the board.
- **Found at** — Bolt City · Overload Junction
- **Lore** — _(none yet)_

#### Sentry · `bolt_sentry`

Epic · Ranger · Ranged · Cost 4

- **Stats** — DMG 5 · HP 15 · Shields 3 · SP 5 · Budget 31 vs 30 (+1)
- **Tribe** — ARC
- **Special · Static Blaster** (2◆) — Deal 5 DMG to every PARALYZED opponent in range.
- **Passives**
  - End of round: deals 5 DMG to a PARALYZED opponent in range.
- **Found at** — Bolt City · Arc Industries Yards
- **Lore** — _(none yet)_

#### Surge · `bolt_surge`

Epic · Tank · Melee · Cost 4

- **Stats** — DMG 7 · HP 10 · Shields 5 · SP 5 · Budget 32 vs 30 (+2)
- **Tribe** — ARC
- **Special · Electro Surge** (1◆) — Re-arm Electro Surge: +1 shield and +5 DMG for 2 rounds. While armed: status-immune, and the next hit PARALYZEs the attacker 3 rounds.
- **Passives**
  - Every 1 rounds: permanently gains +2 SP (stacking).
  - Electro Surge: armed on summon. While armed it's immune to status; the next hit it takes PARALYZEs the attacker 3 rounds and deactivates.
- **Found at** — Bolt City · The Forge Grid
- **Lore** — _(none yet)_

#### ThunderCat · `bolt_thundercat`

Epic · Assassin · Melee · Cost 4

- **Stats** — DMG 4 ×2 · HP 11 · Shields 0 · SP 11 · Budget 30 vs 30 (on)
- **Special · Claw Surge** (2◆) — Pounce up to 2 spaces in any direction onto your target and deal 8 DMG.
- **Passives**
  - Basic hits apply DOT (1) for 2 rounds.
  - On summon: deal 4 DMG to enemies in the area ahead (can crit).
  - Its Special reaches any slot on the board.
- **Found at** — Bolt City · Overload Junction
- **Lore** — _(none yet)_

#### Voltcher · `bolt_voltcher`

Epic · Warrior · Melee · Cost 4

- **Stats** — DMG 4 · HP 13 · Shields 3 · SP 7 · Budget 30 vs 30 (on)
- **Tribe** — ARC
- **Keywords** — FLYING
- **Special · Thunderbird** (2◆) — Deal 3 DMG to opponents in the near or far row.
- **Passives**
  - High Voltage Sentry — Auto-fires its Special for free the first time it hits, when it dies.
  - Its Special reaches any slot on the board.
- **Found at** — Bolt City · The Forge Grid
- **Lore** — _(none yet)_

#### General · `bolt_general`

Epic · Ranger · Ranged · Cost 5

- **Stats** — DMG 6 · HP 16 · Shields 2 · SP 9 · Budget 35 vs 35 (on)
- **Tribe** — ARC
- **Special · Spraying Thunder** (3◆) — Attack every opponent in the row directly ahead using the current Basic Attack Weapon.
- **Passives**
  - Power Grab: on move (once/round), cycle its Basic Attack Weapon — Standard 6×1, AKVolt Shot 5×2, ARC88 2×4, ThunderRPG 10×1.
  - Its Special reaches any slot on the board.
- **Found at** — Bolt City · Forsaken Heights
- **Lore** — _(none yet)_

#### Kore · `bolt_kore`

Epic · Tank · Melee · Cost 5

- **Stats** — DMG 5 · HP 18 · Shields 3 · SP 6 · Budget 35 vs 35 (on)
- **Tribe** — ARC
- **Special · Core Overload** (3◆) — Deal 8 DMG to all opponents in range and PARALYZE each for 1 round.
- **Passives**
  - Gains +1 shield at the end of each round.
  - Meltdown — On death, raises 1 Static Wisp.
- **Found at** — Bolt City · The Forge Grid
- **Lore** — _(none yet)_

#### Thunder · `bolt_thunder`

Epic · Mage · Ranged · Cost 5

- **Stats** — DMG 4 ×2 · HP 16 · Shields 0 · SP 11 · Budget 35 vs 35 (on)
- **Special · Arcing Strike** (2◆) — Deal 7 DMG to a target and 3 DMG to each adjacent opponent.
- **Passives**
  - On summon: deal 3 DMG to all enemies in range.
- **Found at** — Bolt City · Forsaken Heights
- **Lore** — _(none yet)_

#### Volta · `bolt_volta`

Epic · Support · Ranged · Cost 5

- **Stats** — DMG 4 · HP 19 · Shields 3 · SP 6 · Budget 35 vs 35 (on)
- **Tribe** — ARC
- **Special · Grid Deployment** (3◆) — Deploy a Rodd (0/7/4🛡 · Conduction, Arc) into an open slot beside it, or the nearest free one if it is boxed in.
- **Passives**
  - Overcharge: its basic attacks gain PEN while an allied Rodd is on the board.
  - On summon: deploy a Rodd.
- **Found at** — Bolt City · Forsaken Heights
- **Lore** — _(none yet)_

<!-- rare -->

#### Junker · `bolt_junker`

Rare · Tank · Melee · Cost 1

- **Stats** — DMG 2 · HP 11 · Shields 1 · SP 1 · Budget 16 vs 15 (+1)
- **Special** — none
- **Passives**
  - Stop Sign — When hit by melee: retaliate — 2 DMG.
- **Found at** — Bolt City · Scrapyard Verge
- **Lore** — _(none yet)_

#### Rodd · `bolt_rodd`

Rare · Support · Ranged · Cost 1

- **Stats** — DMG 0 · HP 7 · Shields 4 · SP 0 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - Arc — Each round: 2 DMG to the closest opponent.
  - Aura — adjacent BOLT allies gain +1 DMG.
- **Found at** — Bolt City · Drone Field
- **Lore** — _(none yet)_

#### Stingray · `bolt_stingray`

Rare · Ranger · Ranged · Cost 1

- **Stats** — DMG 2 ×2 · HP 4 · Shields 1 · SP 7 · Budget 17 vs 15 (+2)
- **Special** — none
- **Passives**
  - Piercing Pulse — Vs ELECTRIFIED targets, basics gain PEN.
- **Found at** — Bolt City · Drone Field
- **Lore** — _(none yet)_

#### Twintail · `bolt_twotales`

Rare · Warrior · Melee · Cost 1

- **Stats** — DMG 2 ×2 · HP 5 · Shields 1 · SP 5 · Budget 16 vs 15 (+1)
- **Special** — none
- **Passives**
  - Buzz Whip — Basic hits 50% chance to apply PARALYZE for 2 rounds.
- **Found at** — Bolt City · Scrapyard Verge
- **Lore** — _(none yet)_

#### Zap · `bolt_zap`

Rare · Assassin · Melee · Cost 1

- **Stats** — DMG 5 · HP 2 · Shields 0 · SP 10 · Budget 17 vs 15 (+2)
- **Special** — none
- **Passives**
  - On summon: deal 5 DMG to one enemy.
- **Found at** — Bolt City · Scrapyard Verge
- **Lore** — _(none yet)_

#### Zipp · `bolt_zipp`

Rare · Mage · Ranged · Cost 1

- **Stats** — DMG 3 · HP 3 · Shields 1 · SP 8 · Budget 16 vs 15 (+1)
- **Tribe** — ARC
- **Special** — none
- **Passives**
  - On summon: deploy a Drone.
- **Found at** — Bolt City · Drone Field
- **Lore** — _(none yet)_

#### DrShock · `bolt_drshock`

Rare · Mage · Ranged · Cost 2

- **Stats** — DMG 3 · HP 8 · Shields 0 · SP 8 · Budget 19 vs 20 (-1)
- **Special** — none
- **Passives**
  - Shocker — When an enemy is summoned within range, hits it with ELECTRIFIED.
- **Found at** — Bolt City · Substation Row
- **Lore** — _(none yet)_

#### Electricel · `bolt_electricel`

Rare · Assassin · Melee · Cost 2

- **Stats** — DMG 5 · HP 5 · Shields 0 · SP 10 · Budget 20 vs 20 (on)
- **Special** — none
- **Passives**
  - On summon: apply PARALYZE for 2 rounds to one enemy.
- **Found at** — Bolt City · Substation Row
- **Lore** — _(none yet)_

#### Jolt · `bolt_jolt`

Rare · Tank · Melee · Cost 2

- **Stats** — DMG 2 · HP 8 · Shields 3 · SP 3 · Budget 19 vs 20 (-1)
- **Special** — none
- **Passives**
  - When hit (melee or ranged): retaliate — ELECTRIFIED.
  - When battle begins: applies ELECTRIFIED for 2 round(s) to every opponent in range.
- **Found at** — Bolt City · Substation Row
- **Lore** — _(none yet)_

#### Scrapper · `bolt_scrapper`

Rare · Warrior · Melee · Cost 2

- **Stats** — DMG 5 · HP 9 · Shields 1 · SP 5 · Budget 21 vs 20 (+1)
- **Special** — none
- **Passives**
  - Jolt Fist — Basic hits 40% chance to apply PARALYZE for 1 round.
  - Salvage Plating — On a kill: +2 shields.
- **Found at** — Bolt City · The Static Flats
- **Lore** — _(none yet)_

#### Static Cloud · `bolt_staticcloud`

Rare · Support · Ranged · Cost 2

- **Stats** — DMG 0 · HP 20 · Shields 0 · SP 0 · Budget 20 vs 20 (on)
- **Tribe** — ARC
- **Special** — none
- **Passives**
  - Rolling Static — Each round: 4 DMG to a random opponent · PARALYZE a random opponent for 2 rounds.
  - Rolling Static — Seed Roll: rolls 1 slot forward toward the enemy home at the end of each round (until blocked).
- **Found at** — Bolt City · The Static Flats
- **Lore** — _(none yet)_

#### Twinbolt · `bolt_ning`

Rare · Ranger · Ranged · Cost 2

- **Stats** — DMG 3 · HP 8 · Shields 0 · SP 9 · Budget 20 vs 20 (on)
- **Keywords** — CRIT
- **Special** — none
- **Passives**
  - Twin Strike: on a CRIT, chain a bonus 2×1 CRIT strike at the same target — once per round.
- **Found at** — Bolt City · The Static Flats
- **Lore** — _(none yet)_

#### Buzz · `bolt_buzz`

Rare · Tank · Melee · Cost 3

- **Stats** — DMG 3 · HP 13 · Shields 1 · SP 7 · Budget 25 vs 25 (on)
- **Special** — none
- **Passives**
  - Talent (free · once per game) — Electro Surge: Once per game: re-arm Electro Surge — +1 shield and +5 DMG for 2 rounds. While armed: status-immune, and the next hit PARALYZEs the attacker 3 rounds.
  - Electro Surge: armed on summon. While armed it's immune to status; the next hit it takes PARALYZEs the attacker 3 rounds and deactivates.
- **Found at** — Bolt City · Conduit Marsh
- **Lore** — _(none yet)_

#### Buzzard · `bolt_buzzard`

Rare · Ranger · Ranged · Cost 3

- **Stats** — DMG 4 · HP 14 · Shields 0 · SP 7 · Budget 25 vs 25 (on)
- **Special** — none
- **Passives**
  - Drone Sweep — When an enemy is summoned, spawns a Drone in the closest empty adjacent slot and hits it with 1 DMG.
- **Found at** — Bolt City · Conduit Marsh
- **Lore** — _(none yet)_

#### Jellyfish · `bolt_jellyfish`

Rare · Mage · Ranged · Cost 3

- **Stats** — DMG 5 · HP 15 · Shields 0 · SP 5 · Budget 25 vs 25 (on)
- **Special** — none
- **Passives**
  - Talent (free · once per game) — Storm Conduit: Deal 6 DMG and PARALYZE the target for 3 rounds.
  - Jelly Shock: when it's hit and survives, discharges 2 DMG into the attacker — melee or ranged — and every enemy standing next to it.
- **Found at** — Bolt City · Conduit Marsh
- **Lore** — _(none yet)_

### BOLT — tokens

Not draftable: these arrive on the board from another card's ability, so their lore answers to whatever summons them.

#### Beebot · `bolt_beebot`

Rare · Assassin · Ranged · Cost 1

- **Stats** — DMG 2 · HP 3 · Shields 1 · SP 8 · Budget 15 vs 15 (on)
- **Tribe** — Bot
- **Special** — none
- **Passives**
  - Stinger Buzz — Basic hits apply DOT (2) for 2 rounds.
  - Stinger Buzz — A one-shot: it dies at the end of any round it attacks.
- **Summoned by** — Keeper
- **Lore** — _(none yet)_

#### Drone · `bolt_drone_tok`

Rare · Ranger · Ranged · Cost 1

- **Stats** — DMG 1 · HP 1 · Shields 1 · SP 8 · Budget 12 vs 15 (-3)
- **Tribe** — ARC
- **Keywords** — FLYING
- **Special** — none
- **Passives** — none beyond the BOLT aura
- **Summoned by** — nothing (orphan token)
- **Lore** — _(none yet)_

#### Static Wisp · `bolt_static_wisp_tok`

Rare · Support · Ranged · Cost 1

- **Stats** — DMG 0 · HP 10 · Shields 0 · SP 0 · Budget 10 vs 15 (-5)
- **Tribe** — ARC
- **Special** — none
- **Passives**
  - Fading Static — Each round: 2 DMG to a random opponent · PARALYZE a random opponent for 1 round.
  - Fading Static — Seed Roll: rolls 1 slot forward toward the enemy home at the end of each round (until blocked).
- **Summoned by** — nothing (orphan token)
- **Lore** — _(none yet)_

### BOLT — spells

#### Zap · `bolt_zap`

Damage · Cost 1✦

- **Text** — Deal 3 DMG to a target and PARALYZE them for 2 rounds.
- **Lore** — _(none yet)_

#### Recon Ping · `bolt_recon_ping`

Convert · Cost 2✦

- **Text** — Reveal the opponent's hand for the rest of this round, and your Specials cost 1 less this round (minimum 1).
- **Lore** — _(none yet)_

#### Rewire · `bolt_rewire`

Convert · Cost 3✦

- **Text** — Instantly swap the board positions of two of your own cards.
- **Lore** — _(none yet)_

#### Overload Field · `bolt_overload_field`

Wall · Cost 4✦

- **Text** — Charge a row with current for 3 rounds. A card that MOVES in takes 2 DMG and is PARALYZED 2 rounds. Ranged attacks and FLYING cards pass over.
- **Lore** — _(none yet)_

#### Power Rebate · `bolt_power_rebate`

Convert · Cost 5✦

- **Text** — Spend 5 Magic to gain 6 Gold.
- **Lore** — _(none yet)_

#### Power Grid · `bolt_power_grid`

Field · Cost 6✦ · 3 rounds

- **Text** — Field (3 rounds): your BOLT Specials cost 1 less (min 1), and Electrify hits statused foes for +3 (instead of +2).
- **Lore** — _(none yet)_

#### Lightning Storm · `bolt_lightning_storm`

Area · Cost 7✦ · area: board

- **Text** — Deal 8 DMG to every opponent and PARALYZE each for 2 rounds.
- **Lore** — _(none yet)_

#### Full Reroute · `bolt_full_reroute`

Convert · Cost 8✦

- **Text** — Instantly move any 2 of your cards to open slots anywhere on the board, ignoring their SP movement limit.
- **Lore** — _(none yet)_

#### System Override · `bolt_system_override`

Convert · Cost 9✦

- **Text** — All of your Specials cost 3 less this round (minimum 1), and every ally's Special comes off cooldown.
- **Lore** — _(none yet)_

#### Total Network Control · `bolt_total_network_control`

Area · Cost 10✦ · area: board

- **Text** — MUTE every opponent for 2 rounds. Then, for the rest of the game, your BOLT Specials cost 1 less (min 1).
- **Lore** — _(none yet)_

---

## DUSK

**Element aura · Midnight Shade** — On death, deals a third of its DMG back to the killer.

39 cards · 6 tokens · 10 spells

### DUSK — cards

<!-- mythic -->

#### SkullKing · `dusk_skullking`

Mythic · Tank · Melee · Cost 9

- **Stats** — DMG 11 · HP 32 · Shields 0 · SP 9 · Budget 52 vs 55 (-3)
- **Tribe** — Skeleton
- **Special · King's SkullDrake** (4◆) — Apply DOT 3 (3 rounds) to opponents in the row directly ahead and raise an attacking Risen Drake.
- **Passives**
  - Dead Siege — Each round: raise 2 Skeletons.
  - Aura — Skeleton allies gain +2 DMG / +1 shields.
  - It won't raise another while 6 of its bodies still stand — clear one before it breeds again.
  - Its Special reaches any slot on the board.
  - On summon: brings 2 Skeletons onto the board.
- **Found at** — Dusk · The Bone Throne
- **Lore** — _(none yet)_

#### Shadow Horsemen · `dusk_shadowhorsemen`

Mythic · Assassin · Melee · Cost 10

- **Stats** — DMG 16 · HP 35 · Shields 0 · SP 13 · Budget 64 vs 60 (+4)
- **Special · Shadow Charge** (5◆) — Ride up to 4 spaces in any direction toward your target, dealing 5 DMG (PEN) to every opponent you pass. Then hit it for 19 DMG (PEN) + 9 DOT and gain EVASION for a round. 3-round cooldown.
- **Passives**
  - Aura — DUSK allies gain PEN on basics.
  - Mounted: moves like a chess king — a diagonal step costs 1, not 2 (lost if it dismounts).
  - Long Reach — Basic attacks reach up to 2 slots straight ahead, behind, or to either side (not diagonally). An enemy in the lane blocks it.
  - Its Special reaches any slot on the board.
- **Found at** — Dusk · The Long Night
- **Lore** — _(none yet)_

<!-- legendary -->

#### Ravven · `dusk_ravven`

Legendary · Ranger · Ranged · Cost 6

- **Stats** — DMG 4 ×2 · HP 17 · Shields 2 · SP 11 · Budget 40 vs 40 (on)
- **Tribe** — Dark, Avian
- **Keywords** — FLYING, EVASION
- **Special · Night Stalk** (3◆) — Gain +3 DMG for 3 rounds.
- **Passives**
  - EVASION: ~50% chance to dodge each incoming hit.
  - Shadow Haunter: its EVASION is live only while it stands on the opponent's battlefield.
- **Found at** — Dusk · Death Island: The Landing
- **Lore** — _(none yet)_

#### Vesper · `dusk_scar`

Legendary · Support · Ranged · Cost 6

- **Stats** — DMG 6 · HP 23 · Shields 0 · SP 11 · Budget 40 vs 40 (on)
- **Tribe** — Vamp
- **Keywords** — FLYING, DRAIN
- **Special · Moon Frenzy** (3◆) — Attack all opponents for 3 DMG and DRAIN from each.
- **Passives**
  - DRAIN: basic attacks heal it for the damage dealt AND steal 1 max HP from the target — it grows as it feeds (DUSK lifesteal).
  - Blood Moon: when an opponent dies, heal it and all allies +1 HP.
  - Its Special reaches any slot on the board.
- **Found at** — Dusk · Death Island: The Landing
- **Lore** — _(none yet)_

#### Destro · `dusk_destro`

Legendary · Mage · Ranged · Cost 7

- **Stats** — DMG 4 ×3 · HP 16 · Shields 3 · SP 11 · Budget 45 vs 45 (on)
- **Tribe** — Ghost
- **Special · Flaming Chains** (5◆) — DRAIN 2 max HP from all opponents and WEAKEN them for 2 rounds.
- **Passives**
  - Ghost Return — Revives when defeated at 8 HP once.
  - White Shadow — On summon, raises a 3-shield barrier.
  - Its Special reaches any slot on the board.
- **Found at** — Dusk · Death Island: The Barrows
- **Lore** — _(none yet)_

#### Hoax · `dusk_hoax`

Legendary · Assassin · Melee · Cost 7

- **Stats** — DMG 8 · HP 22 · Shields 0 · SP 15 · Budget 45 vs 45 (on)
- **Tribe** — ScareKrow
- **Keywords** — CRIT, EVASION
- **Special · Mark of Hoax** (4◆) — Mark an opponent — every basic attack against them is a guaranteed CRIT. When a marked target dies, Blur banks a one-time auto-dodge.
- **Passives**
  - EVASION: ~50% chance to dodge each incoming hit.
  - Its Special reaches any slot on the board.
- **Found at** — Dusk · Death Island: The Landing
- **Lore** — _(none yet)_

#### Zombination · `dusk_zombination`

Legendary · Tank · Melee · Cost 7

- **Stats** — DMG 7 · HP 34 · Shields 0 · SP 3 · Budget 44 vs 45 (-1)
- **Tribe** — Zombie
- **Special · Toxic Eruption** (3◆) — Deal 4 DOT for 3 rounds to every opponent in range. Anything that dies while it runs rises as your Zombie.
- **Passives**
  - Mass Grave — whenever any Zombie dies, gains +1 HP permanently.
  - Contagion — Aura: while this card lives, every one of your Zombies that dies deals 2 DMG to each opponent beside it.
- **Found at** — Dusk · Death Island: The Landing
- **Lore** — _(none yet)_

#### Nightfang · `dusk_nightfang`

Legendary · Assassin · Melee · Cost 8

- **Stats** — DMG 11 · HP 25 · Shields 0 · SP 11 · Budget 47 vs 50 (-3)
- **Keywords** — LIFESTEAL
- **Special · Soul Slash** (4◆) — Delete 15 max HP from an opponent — destroying it outright if it has 15 or less — then slip into STEALTH until you next attack.
- **Passives**
  - LIFESTEAL: basic attacks heal it for the damage dealt.
- **Found at** — Dusk · Death Island: The Barrows
- **Lore** — _(none yet)_

#### Skelider · `dusk_skelider`

Legendary · Warrior · Melee · Cost 8

- **Stats** — DMG 5 · HP 26 · Shields 2 · SP 10 · Budget 45 vs 50 (-5)
- **Tribe** — Skeleton
- **Special · Piercing Charge** (4◆) — Ride up to 4 slots in any direction toward your target and deal 15 DMG (PEN) to it.
- **Passives**
  - Dismount — Below 10 HP: deal 5 · −5 SP · loses its Special.
  - Mounted: moves like a chess king — a diagonal step costs 1, not 2 (lost if it dismounts).
  - Its Special reaches any slot on the board.
- **Found at** — Dusk · Death Island: The Barrows
- **Lore** — _(none yet)_

<!-- epic -->

#### Silkstalker · `dusk_silkstalker`

Epic · Assassin · Melee · Cost 3

- **Stats** — DMG 3 ×2 · HP 7 · Shields 0 · SP 12 · Budget 25 vs 25 (on)
- **Tribe** — Spider
- **Keywords** — EVASION
- **Special · Web Snare** (1◆) — Deal 7 DMG and BLIND the target (−50% accuracy) for 2 rounds.
- **Passives**
  - EVASION: ~50% chance to dodge each incoming hit.
  - Shadow Haunter: its EVASION is live only while it stands on the opponent's battlefield.
- **Found at** — Dusk · Forsaken Heights
- **Lore** — _(none yet)_

#### Spectra · `dusk_spectra`

Epic · Tank · Melee · Cost 3

- **Stats** — DMG 2 · HP 13 · Shields 0 · SP 10 · Budget 25 vs 25 (on)
- **Tribe** — Ghost
- **Special · Opaque Realm** (2◆) — Give Spectra and the ally directly behind it EVASION for 2 rounds.
- **Passives**
  - Strength Sap — When hit by melee: retaliate — WEAKEN.
- **Found at** — Dusk · Forsaken Heights
- **Lore** — _(none yet)_

#### Strawman · `dusk_skrow`

Epic · Ranger · Ranged · Cost 3

- **Stats** — DMG 5 ×2 · HP 8 · Shields 0 · SP 7 · Budget 25 vs 25 (on)
- **Tribe** — ScareKrow
- **Special · Murder** (3◆) — Create 3 Crows near it.
- **Passives**
  - Goodnight — On death, raises 2 Crows.
- **Found at** — Dusk · Forsaken Heights
- **Lore** — _(none yet)_

#### Ghastly Groom · `dusk_ghastly`

Epic · Mage · Ranged · Cost 4

- **Stats** — DMG 7 · HP 19 · Shields 0 · SP 4 · Budget 30 vs 30 (on)
- **Tribe** — Ghost, Skeleton
- **Special · Phantom Gouge** (2◆) — Deal 5 DMG (PEN) to up to 2 opponents in range.
- **Passives**
  - Ethereal Trade — Every attack (basic & Special) deals +3 DMG, but costs 2 HP.
- **Found at** — Dusk · The Haunting Ground
- **Lore** — _(none yet)_

#### Haunt · `dusk_haunt`

Epic · Support · Ranged · Cost 4

- **Stats** — DMG 5 · HP 13 · Shields 0 · SP 10 · Budget 28 vs 30 (-2)
- **Tribe** — Ghost, ScareKrow
- **Special · Jacked** (2◆) — Permanently drain 5 max HP from the target. Gain +3 shields.
- **Passives**
  - Frightening — Basic hits first hit: apply FRIGHTEN for 1 round.
- **Found at** — Dusk · The Haunting Ground
- **Lore** — _(none yet)_

#### Plaguecrow · `dusk_plaguecrow`

Epic · Ranger · Ranged · Cost 4

- **Stats** — DMG 4 ×2 · HP 11 · Shields 0 · SP 11 · Budget 30 vs 30 (on)
- **Tribe** — Skeleton
- **Keywords** — CRIT, PEN
- **Special · Miasma Burst** (2◆) — Deal 4 DMG (CRIT, PEN) to all opponents in range.
- **Passives**
  - On summon: opponents cannot use their Specials this round.
  - Plague — On death, raises 1 RedRaven.
  - Its Special reaches any slot on the board.
- **Found at** — Dusk · The Haunting Ground
- **Lore** — _(none yet)_

#### Reaper · `dusk_reaper`

Epic · Assassin · Melee · Cost 4

- **Stats** — DMG 7 · HP 11 · Shields 0 · SP 11 · Budget 29 vs 30 (-1)
- **Tribe** — Skeleton
- **Special · Death's Approach** (2◆) — Hurl the scythe — 7 DMG (PEN) to any opponent, anywhere.
- **Passives**
  - Soul Reaper — On a kill: +1 DMG · heal 7 HP.
  - Its Special reaches any slot on the board.
- **Found at** — Dusk · Bonefield Muster
- **Lore** — _(none yet)_

#### Sarachnid · `dusk_sarachnid`

Epic · Warrior · Melee · Cost 4

- **Stats** — DMG 4 · HP 16 · Shields 0 · SP 10 · Budget 30 vs 30 (on)
- **Tribe** — Spider
- **Special · Silk Chase** (2◆) — Every allied Spider attacks; each opponent hit is FRIGHTENed 1 round and Sarachnid heals 2 HP per hit. Every opponent killed nests another Spider.
- **Passives**
  - Nesting — Each round: raise 1 Spider.
  - It won't raise another while 4 of its bodies still stand — clear one before it breeds again.
  - On summon: brings 1 Spider onto the board.
- **Found at** — Dusk · Bonefield Muster
- **Lore** — _(none yet)_

#### Brute · `dusk_brute`

Epic · Warrior · Melee · Cost 5

- **Stats** — DMG 4 · HP 22 · Shields 2 · SP 5 · Budget 35 vs 35 (on)
- **Tribe** — Skeleton
- **Keywords** — CRIT
- **Special · Sweep** (3◆) — Attack every opponent in the row directly ahead; gain +2 shields per kill.
- **Passives**
  - Brutal: a basic CRIT saps 1 DMG off the target's own attacks for the round.
  - Its Special reaches any slot on the board.
- **Found at** — Dusk · Bonefield Muster
- **Lore** — _(none yet)_

#### Ender · `dusk_ender`

Epic · Ranger · Ranged · Cost 5

- **Stats** — DMG 8 · HP 16 · Shields 0 · SP 11 · Budget 35 vs 35 (on)
- **Tribe** — Skeleton, ScareKrow
- **Special · Dark Warp** (2◆) — Swap places with any opponent and deal 8 DMG to it.
- **Passives**
  - Unpredictable: a slower attacker (lower SP) has only a 50% chance to hit it.
  - Its Special reaches any slot on the board.
- **Found at** — Dusk · The Veil Gate
- **Lore** — _(none yet)_

#### RIP · `dusk_rip`

Epic · Tank · Melee · Cost 5

- **Stats** — DMG 0 · HP 33 · Shields 0 · SP 0 · Budget 33 vs 35 (-2)
- **Tribe** — Zombie
- **Special · Horde** (0◆) — Tear off 6 HP to spawn 2 Zombie Husks within 2 spaces — RIP may spend its last. Fires FREE on its own whenever the Dead Clock has raised 4.
- **Passives**
  - Dead Clock — Each round: raise 1 Zombie Husk.
  - Dead Clock — Each round it pays 3 of its own HP to do so (never lethal).
  - Dead Clock — Every 4 raised, Horde fires free.
  - Dead Clock — It won't raise another while 4 of its bodies still stand — clear one before it breeds again.
  - On summon: brings 1 Zombie Husk onto the board, within 2 spaces of it.
- **Found at** — Dusk · The Veil Gate
- **Lore** — _(none yet)_

#### Violet · `dusk_violet`

Epic · Support · Ranged · Cost 5

- **Stats** — DMG 2 ×3 · HP 13 · Shields 2 · SP 12 · Budget 35 vs 35 (on)
- **Tribe** — Vamp
- **Keywords** — DRAIN
- **Special · Bloody Exchange** (3◆) — DRAIN 2 max HP from all other cards on the battlefield and add the total to Violet's max HP.
- **Passives**
  - DRAIN: basic attacks heal it for the damage dealt AND steal 1 max HP from the target — it grows as it feeds (DUSK lifesteal).
  - Draining Siphon — Each round: DRAIN 3 max HP from every adjacent opponent.
- **Found at** — Dusk · The Veil Gate
- **Lore** — _(none yet)_

#### Wedded Wraith · `dusk_wedded_wraith`

Epic · Mage · Ranged · Cost 5

- **Stats** — DMG 4 ×2 · HP 12 · Shields 1 · SP 11 · Budget 33 vs 35 (-2)
- **Tribe** — Ghost
- **Special · Shadow Summon** (3◆) — Spawn 3 Specters (3 DMG / 1 HP / SP 7). 3-round cooldown.
- **Passives**
  - Harvester — On a kill: raises 1 Specter.
  - Last Waltz — On death, FRIGHTENs nearby enemies for 1 round · gives surviving Ghosts +2 DMG permanently.
- **Found at** — Dusk · The Veil Gate
- **Lore** — _(none yet)_

<!-- rare -->

#### Crow · `dusk_crow`

Rare · Assassin · Melee · Cost 1

- **Stats** — DMG 2 · HP 2 · Shields 0 · SP 11 · Budget 15 vs 15 (on)
- **Tribe** — Dark
- **Keywords** — FLYING
- **Special** — none
- **Passives**
  - Bird Bomb — On death, deals 5 damage back to its killer if the killer is within its reach.
- **Found at** — Dusk · The Blighted Verge
- **Lore** — _(none yet)_

#### Pumpkin · `dusk_pumpkin`

Rare · Ranger · Ranged · Cost 1

- **Stats** — DMG 2 · HP 8 · Shields 0 · SP 5 · Budget 15 vs 15 (on)
- **Tribe** — Dark
- **Special** — none
- **Passives**
  - Catapult — Can target the enemy Home row from anywhere.
- **Found at** — Dusk · The Blighted Verge
- **Lore** — _(none yet)_

#### Spider · `dusk_spider`

Rare · Assassin · Melee · Cost 1

- **Stats** — DMG 2 · HP 3 · Shields 1 · SP 9 · Budget 16 vs 15 (+1)
- **Tribe** — Spider
- **Special** — none
- **Passives**
  - Venom Bite — Basic hits apply DOT (2) for 1 round.
  - On summon: apply FRIGHTEN for 1 round to one enemy.
- **Found at** — Dusk · Widow's Hollow
- **Lore** — _(none yet)_

#### Vamp · `dusk_vamp`

Rare · Warrior · Melee · Cost 1

- **Stats** — DMG 1 ×2 · HP 6 · Shields 0 · SP 7 · Budget 15 vs 15 (on)
- **Tribe** — Vamp
- **Keywords** — DRAIN
- **Special** — none
- **Passives**
  - DRAIN: basic attacks heal it for the damage dealt AND steal 1 max HP from the target — it grows as it feeds (DUSK lifesteal).
- **Found at** — Dusk · Widow's Hollow
- **Lore** — _(none yet)_

#### Zombie Husk · `dusk_zombie_husk`

Rare · Tank · Melee · Cost 1

- **Stats** — DMG 2 · HP 8 · Shields 0 · SP 5 · Budget 15 vs 15 (on)
- **Tribe** — Zombie
- **Special** — none
- **Passives**
  - Reanimation — On death, raises 1 Zombie.
- **Found at** — Dusk · Potter's Field
- **Lore** — _(none yet)_

#### Doom · `dusk_doom`

Rare · Support · Melee · Cost 2

- **Stats** — DMG 3 · HP 13 · Shields 2 · SP 0 · Budget 20 vs 20 (on)
- **Tribe** — Dark
- **Special** — none
- **Passives**
  - Boom: a time bomb — after 4 rounds it detonates for 8 DMG to every enemy, then dies.
- **Found at** — Dusk · The Blighted Verge
- **Lore** — _(none yet)_

#### Gravekeeper · `dusk_gravekeeper`

Rare · Tank · Melee · Cost 2

- **Stats** — DMG 2 · HP 14 · Shields 0 · SP 4 · Budget 20 vs 20 (on)
- **Tribe** — Dark
- **Special** — none
- **Passives**
  - Grave Harvest — Salvage: whenever any card dies, gain +2 max HP.
- **Found at** — Dusk · Scarecrow Rows
- **Lore** — _(none yet)_

#### Harrow · `dusk_harve`

Rare · Mage · Ranged · Cost 2

- **Stats** — DMG 4 · HP 6 · Shields 0 · SP 10 · Budget 20 vs 20 (on)
- **Tribe** — Ghost
- **Special** — none
- **Passives**
  - On summon: brings 1 Specter onto the board.
- **Found at** — Dusk · The Weeping Chapel
- **Lore** — _(none yet)_

#### Jackl · `dusk_jackl`

Rare · Ranger · Ranged · Cost 2

- **Stats** — DMG 2 ×2 · HP 8 · Shields 0 · SP 9 · Budget 21 vs 20 (+1)
- **Tribe** — ScareKrow
- **Special** — none
- **Passives**
  - Arrow of Darkness — On a kill: 2×1 to the closest opponent.
- **Found at** — Dusk · Scarecrow Rows
- **Lore** — _(none yet)_

#### Skeleton Knight · `dusk_skeleton_knight`

Rare · Warrior · Melee · Cost 2

- **Stats** — DMG 4 · HP 8 · Shields 0 · SP 8 · Budget 20 vs 20 (on)
- **Tribe** — Skeleton
- **Special** — none
- **Passives**
  - On summon, raises a 3-shield barrier.
- **Found at** — Dusk · Potter's Field
- **Lore** — _(none yet)_

#### Gool · `dusk_gool`

Rare · Support · Ranged · Cost 3

- **Stats** — DMG 4 · HP 13 · Shields 0 · SP 8 · Budget 25 vs 25 (on)
- **Tribe** — Ghost
- **Special** — none
- **Passives**
  - Spook — Basic hits first hit: apply FRIGHTEN for 2 rounds.
- **Found at** — Dusk · The Weeping Chapel
- **Lore** — _(none yet)_

#### Hexvial · `dusk_hix`

Rare · Mage · Ranged · Cost 3

- **Stats** — DMG 5 · HP 13 · Shields 0 · SP 7 · Budget 25 vs 25 (on)
- **Tribe** — Dark
- **Special** — none
- **Passives**
  - Magic Potion: a landed basic hurls a random potion — poison (DOT 1), 3 damage, or FRIGHTEN 2.
  - Magic Potion — On death, blasts the enemy row ahead for 3.
- **Found at** — Dusk · Scarecrow Rows
- **Lore** — _(none yet)_

#### Scarlett · `dusk_scarlett`

Rare · Support · Ranged · Cost 3

- **Stats** — DMG 2 ×2 · HP 10 · Shields 0 · SP 11 · Budget 25 vs 25 (on)
- **Tribe** — Vamp
- **Keywords** — DRAIN
- **Special** — none
- **Passives**
  - DRAIN: basic attacks heal it for the damage dealt AND steal 1 max HP from the target — it grows as it feeds (DUSK lifesteal).
  - Talent (free · once per game) — Bat Swarm: Once per game, free: deal 2 DMG to all opponents and DRAIN 1 max HP from each.
- **Found at** — Dusk · Widow's Hollow
- **Lore** — _(none yet)_

#### SkullDrake · `dusk_skulldrake`

Rare · Ranger · Ranged · Cost 3

- **Stats** — DMG 7 · HP 10 · Shields 0 · SP 8 · Budget 25 vs 25 (on)
- **Tribe** — Dragon, Skeleton
- **Special** — none
- **Passives**
  - On summon: apply DOT 2 for 3 rounds to enemies in the area ahead.
- **Found at** — Dusk · Scarecrow Rows
- **Lore** — _(none yet)_

#### Soul Wisp · `dusk_soul_wisp`

Rare · Support · Ranged · Cost 3

- **Stats** — DMG 2 · HP 10 · Shields 0 · SP 13 · Budget 25 vs 25 (on)
- **Tribe** — Ghost
- **Special** — none
- **Passives**
  - Wandering Light — Each round: heal every DUSK ally 2 HP.
  - Its basic attack can be aimed at a wounded ally to heal them for its DMG instead of striking.
- **Found at** — Dusk · The Weeping Chapel
- **Lore** — _(none yet)_

#### Widowbite · `dusk_widowbite`

Rare · Assassin · Melee · Cost 3

- **Stats** — DMG 7 · HP 11 · Shields 0 · SP 7 · Budget 25 vs 25 (on)
- **Tribe** — Spider
- **Special** — none
- **Passives**
  - Lingering Venom — On death, leaves its killer with DOT 5 for 3 rounds if the killer is within its reach.
- **Found at** — Dusk · Widow's Hollow
- **Lore** — _(none yet)_

#### Zhunk · `dusk_zhunk`

Rare · Tank · Melee · Cost 3

- **Stats** — DMG 4 · HP 17 · Shields 0 · SP 2 · Budget 23 vs 25 (-2)
- **Tribe** — Zombie
- **Special** — none
- **Passives**
  - Carnage — whenever any Zombie dies, gains +1 DMG / +1 HP permanently.
- **Found at** — Dusk · Potter's Field
- **Lore** — _(none yet)_

### DUSK — tokens

Not draftable: these arrive on the board from another card's ability, so their lore answers to whatever summons them.

#### Specter · `dusk_specter_tok`

Epic · Assassin · Melee · Cost 1

- **Stats** — DMG 3 · HP 1 · Shields 0 · SP 7 · Budget 11 vs 15 (-4)
- **Tribe** — Ghost
- **Special** — none
- **Passives** — none beyond the DUSK aura
- **Summoned by** — Harrow, Wedded Wraith
- **Lore** — _(none yet)_

#### RedRaven · `dusk_redreven`

Epic · Ranger · Ranged · Cost 4

- **Stats** — DMG 6 · HP 9 · Shields 0 · SP 9 · Budget 24 vs 30 (-6)
- **Tribe** — Dark
- **Special** — none
- **Passives**
  - On summon: opponents cannot use their Specials this round.
- **Summoned by** — nothing (orphan token)
- **Lore** — _(none yet)_

#### Risen Drake · `dusk_skulldrake_tok`

Epic · Warrior · Melee · Cost 4

- **Stats** — DMG 11 · HP 10 · Shields 0 · SP 9 · Budget 30 vs 30 (on)
- **Tribe** — Skeleton
- **Special** — none
- **Passives** — none beyond the DUSK aura
- **Summoned by** — nothing (orphan token)
- **Lore** — _(none yet)_

#### Risen · `dusk_risen_tok`

Rare · Tank · Melee · Cost 1

- **Stats** — DMG 3 · HP 3 · Shields 0 · SP 4 · Budget 10 vs 15 (-5)
- **Tribe** — Dark
- **Special** — none
- **Passives** — none beyond the DUSK aura
- **Summoned by** — nothing (orphan token)
- **Lore** — _(none yet)_

#### Zombie · `dusk_zombie_tok`

Rare · Tank · Melee · Cost 1

- **Stats** — DMG 3 · HP 3 · Shields 0 · SP 4 · Budget 10 vs 15 (-5)
- **Tribe** — Zombie
- **Special** — none
- **Passives** — none beyond the DUSK aura
- **Summoned by** — nothing (orphan token)
- **Lore** — _(none yet)_

#### Skeleton · `dusk_skeleton_tok`

Rare · Warrior · Melee · Cost 2

- **Stats** — DMG 3 · HP 2 · Shields 0 · SP 6 · Budget 11 vs 20 (-9)
- **Tribe** — Skeleton
- **Special** — none
- **Passives** — none beyond the DUSK aura
- **Summoned by** — SkullKing
- **Lore** — _(none yet)_

### DUSK — spells

#### Chill Touch · `dusk_chill_touch`

Damage · Cost 1✦

- **Text** — Deal 3 DMG to a target and DRAIN 1 max HP to a DUSK ally.
- **Lore** — _(none yet)_

#### Bone Snare · `dusk_bone_snare`

Trap · Cost 2✦

- **Text** — Hide a trap on an empty slot. The first opponent to MOVE onto it takes 4 DMG and is FRIGHTENed for 2 rounds.
- **Lore** — _(none yet)_

#### Shadow Step · `dusk_shadow_step`

Heal · Cost 3✦

- **Text** — Cloak a DUSK ally in EVASION for 1 round.
- **Lore** — _(none yet)_

#### Veil of Shadows · `dusk_veil_of_shadows`

Wall · Cost 4✦

- **Text** — Cloak a row in darkness for 3 rounds. A card that MOVES in takes 2 DMG and is FRIGHTENed 1 round. DUSK allies in the row gain EVASION. Ranged attacks and FLYING cards pass over.
- **Lore** — _(none yet)_

#### Wake of the Dead · `dusk_wake_of_the_dead`

Area · Cost 5✦ · area: board

- **Text** — Deal 3 DMG to every opponent. Anything you kill for the rest of this round rises next round as a Risen (3 DMG / 3 HP / SP 4) under your control.
- **Lore** — _(none yet)_

#### Nightfall · `dusk_nightfall`

Field · Cost 6✦ · 3 rounds

- **Text** — Field (3 rounds): your DUSK allies dodge the FIRST hit they take each round, deal +1 DMG, and every DRAIN steals 1 extra max HP.
- **Lore** — _(none yet)_

#### Phantom Spikes · `dusk_phantom_spikes`

Damage · Cost 7✦

- **Text** — Deal 10 DMG (PEN) to a target and DRAIN 3 max HP to a DUSK ally.
- **Lore** — _(none yet)_

#### Grave Pit · `dusk_grave_pit`

Trap · Cost 8✦

- **Text** — Hide a trap on an empty slot. The first opponent to MOVE onto it takes 12 DMG (PEN), and every opponent beside it is FRIGHTENed for 1 round.
- **Lore** — _(none yet)_

#### Harvest · `dusk_harvest`

Area · Cost 9✦ · area: board

- **Text** — Deal 8 DMG to every opponent and DRAIN 2 max HP from each, permanently.
- **Lore** — _(none yet)_

#### Endless Night · `dusk_endless_night`

Area · Cost 10✦ · area: board

- **Text** — Deal 15 DMG to every opponent and FRIGHTEN them for 2 rounds. For the rest of the game, DUSK allies gain DRAIN on their basic attacks.
- **Lore** — _(none yet)_

---

## BORE

**Element aura · Exostone** — Enters play with shields by rarity — Rare 2, Epic 2, Legendary 3, Mythic 4. Never loses more than 1 shield to a single hit however heavy, and gains +1 shield whenever its attack breaks one off an opponent.

39 cards · 0 tokens · 10 spells

### BORE — cards

<!-- mythic -->

#### The Coreborer · `bore_the_coreborer`

Mythic · Tank · Melee · Cost 9

- **Stats** — DMG 8 · HP 30 · Shields 6 · SP 5 · Budget 55 vs 55 (on)
- **Tribe** — Cavernous
- **Keywords** — BLOCK, REFLECT
- **Special · Core Drill** (5◆) — Burrow through the column directly ahead, dealing 12 DMG (PEN) to every opponent in it.
- **Passives**
  - BLOCK 1: every incoming hit is reduced by 1 — before shields, and even against PEN.
  - REFLECT 1: returns 1 DMG to attackers.
  - Its Special reaches any slot on the board.
- **Found at** — Bore · Corebore Shaft
- **Lore** — _(none yet)_

#### The Deepest · `bore_deepest`

Mythic · Support · Ranged · Cost 10

- **Stats** — DMG 9 · HP 39 · Shields 8 · SP 3 · Budget 67 vs 60 (+7)
- **Tribe** — Cavernous
- **Special · Drilling Quake** (5◆) — Tear off 5 HP to sinkhole all opponents in range for 3 DMG — DOT 3, −5 SP, −50% accuracy for 3 rounds — then slip into STEALTH. 3-round cooldown.
- **Passives**
  - Aura — BORE allies gain +1 shields.
  - Echolocation — Blind — it aims by sound. Its basic attack can only hit an enemy in king reach (right beside it) or one that MOVED this round; a stationary far enemy is silent and can't be targeted. Its board-wide Special is felt through the ground and ignores this.
  - Its Special reaches any slot on the board.
- **Found at** — Bore · The Deepest Dark
- **Lore** — _(none yet)_

<!-- legendary -->

#### Adamant · `bore_diam`

Legendary · Support · Ranged · Cost 6

- **Stats** — DMG 8 · HP 9 · Shields 6 · SP 11 · Budget 40 vs 40 (on)
- **Special · Adamantize** (4◆) — Harden allies' armor — each ally gains BLOCK 2 for 2 rounds.
- **Passives**
  - Aura — BORE allies gain +1 shields.
  - Diamond Kingdom — when a BORE ally falls, the lowest-HP survivor gains BLOCK 2 for 1 round(s).
- **Found at** — Bore · The Gem Vault
- **Lore** — _(none yet)_

#### Dunewraith · `bore_sandman`

Legendary · Mage · Ranged · Cost 6

- **Stats** — DMG 2 ×5 · HP 14 · Shields 1 · SP 9 · Budget 35 vs 40 (-5)
- **Special · Nightmare** (4◆) — SLEEP up to 2 opponents for 2 rounds.
- **Passives**
  - Vs SLEEP targets, basics gain ×2 DMG.
  - Each round: 1 DMG to every opponent.
  - Nightmare — Its attacks don't wake SLEEPING targets.
  - Basic attacks deal bonus damage (once): +2 in a mid row · +3 if the mid lane is crowded.
- **Found at** — Bore · The Gem Vault
- **Lore** — _(none yet)_

#### Prism · `bore_prism`

Legendary · Assassin · Melee · Cost 6

- **Stats** — DMG 7 · HP 14 · Shields 4 · SP 11 · Budget 40 vs 40 (on)
- **Special · Enchantment** (1◆) — Enchant your weapon — Freezing (−5 SP), Burning (2 DOT), Sleeping (SLEEP 1), or Sharpen (+5 DMG) — then strike at once if an opponent is in range, otherwise store the charge for your next basic.
- **Passives**
  - Elemental Fury — Arrives with its Special already charged — the first cast is free.
  - Elemental Fury — On death, hands its armed Enchantment to the ally with the highest DMG.
- **Found at** — Bore · The Gem Vault
- **Lore** — _(none yet)_

#### Venomarch · `bore_score`

Legendary · Ranger · Ranged · Cost 6

- **Stats** — DMG 2 ×3 · HP 12 · Shields 5 · SP 12 · Budget 40 vs 40 (on)
- **Tribe** — Cavernous
- **Special · Toxic Contagion** (3◆) — SLEEP a target and apply POISON 3 (DOT) for 2 rounds. If it dies while poisoned, it bursts for 3 DMG to every adjacent card.
- **Passives**
  - Toxic Contagion — Basic hits apply DOT (2) for 2 rounds.
  - Sand Trap — When hit by melee: retaliate — SLEEP.
  - Sand Trap — On death, leaves its killer with DOT 3 for 2 rounds.
  - Its Special reaches any slot on the board.
- **Found at** — Bore · The Gem Vault
- **Lore** — _(none yet)_

#### Bastion · `bore_bastion`

Legendary · Tank · Ranged · Cost 8

- **Stats** — DMG 5 · HP 31 · Shields 6 · SP 2 · Budget 50 vs 50 (on)
- **Special · Boulder Barrage** (5◆) — Hurl boulders — 6 DMG and WEAKEN (2r) to up to 3 opponents anywhere on the board.
- **Passives**
  - Gains +2 shield at the end of each round.
  - The first time its shields are broken, it gains +3 DMG / +2 SP permanently.
  - Its Special reaches any slot on the board.
- **Found at** — Bore · The Unbroken Wall
- **Lore** — _(none yet)_

#### Bearocks · `bore_bearocks`

Legendary · Tank · Melee · Cost 8

- **Stats** — DMG 10 · HP 30 · Shields 2 · SP 3 · Budget 47 vs 50 (-3)
- **Special · Blunt Bash** (5◆) — Deal 5 DMG and SLEEP up to 3 opponents for 2 rounds.
- **Passives**
  - Revives when defeated at 24 HP once, then sleeps 1 round.
  - Hibernation — Immune to negative statuses.
- **Found at** — Bore · The Unbroken Wall
- **Lore** — _(none yet)_

#### Ironclad · `bore_steel`

Legendary · Warrior · Melee · Cost 8

- **Stats** — DMG 8 · HP 18 · Shields 5 · SP 9 · Budget 45 vs 50 (-5)
- **Tribe** — Dragon
- **Keywords** — BLOCK 2
- **Special · Magnetic Steel** (5◆) — Deal 3 DMG to all opponents, and steal up to 3 shields each from opponents in the row directly ahead and equip them.
- **Passives**
  - BLOCK 2: every incoming hit is reduced by 2 — before shields, and even against PEN.
  - Immune to negative statuses.
- **Found at** — Bore · The Unbroken Wall
- **Lore** — _(none yet)_

<!-- epic -->

#### Shift · `bore_shift`

Epic · Mage · Ranged · Cost 3

- **Stats** — DMG 2 ×3 · HP 8 · Shields 1 · SP 9 · Budget 25 vs 25 (on)
- **Special · Quaking Comet** (2◆) — Deal 2×2 DMG to all opponents.
- **Passives** — none beyond the BORE aura
- **Found at** — Bore · Faultline
- **Lore** — _(none yet)_

#### Valcana · `bore_valcana`

Epic · Mage · Ranged · Cost 3

- **Stats** — DMG 3 ×2 · HP 8 · Shields 2 · SP 7 · Budget 25 vs 25 (on)
- **Special · Magma Rock Burst** (2◆) — Deal 5 DMG and DOT 2 (2 rounds) to a target, and 2 DMG to all other opponents.
- **Passives**
  - Volcanic Fury: each landed basic grants +1 DMG, building until the Special is used (then it resets).
  - Its Special reaches any slot on the board.
- **Found at** — Bore · Faultline
- **Lore** — _(none yet)_

#### Kimberlite · `bore_sheish`

Epic · Assassin · Melee · Cost 4

- **Stats** — DMG 7 · HP 11 · Shields 2 · SP 8 · Budget 30 vs 30 (on)
- **Special · Diamond Assault** (2◆) — Deal 5 DMG to two opponents, then gain shields equal to the amount of shields broken.
- **Passives**
  - Diamond's Edge: basic attacks deal 2× damage against a shielded target.
- **Found at** — Bore · The Rolling Deep
- **Lore** — _(none yet)_

#### Krysteel · `bore_krysteel`

Epic · Ranger · Ranged · Cost 4

- **Stats** — DMG 2 ×4 · HP 10 · Shields 1 · SP 8 · Budget 28 vs 30 (-2)
- **Keywords** — CRIT
- **Special · Krystal Rain** (3◆) — Deal 3 DMG (CRIT) to every opponent in range.
- **Passives**
  - Krysteellized Field — Immune to negative statuses.
- **Found at** — Bore · Crystal Seam
- **Lore** — _(none yet)_

#### Lithara · `bore_lithara`

Epic · Support · Ranged · Cost 4

- **Stats** — DMG 4 · HP 10 · Shields 5 · SP 5 · Budget 29 vs 30 (-1)
- **Special · Earth Shatter** (2◆) — Deal 5 DMG to a single target and SLEEP it until end of round.
- **Passives**
  - Golden Resonance: each Special use grants +2 shields and +1 DMG (stacking).
  - Its Special reaches any slot on the board.
- **Found at** — Bore · Crystal Seam
- **Lore** — _(none yet)_

#### Monger · `bore_monger`

Epic · Tank · Melee · Cost 4

- **Stats** — DMG 5 · HP 21 · Shields 1 · SP 3 · Budget 31 vs 30 (+1)
- **Special · Rock Slide** (2◆) — Throw 5 boulders for 4 DMG each — 50% to hit. Every miss becomes +2 shields.
- **Passives**
  - Pride Guardian — the first time each ally is hit, gives that ally +2 shield.
- **Found at** — Bore · Crystal Seam
- **Lore** — _(none yet)_

#### Rhyolite · `bore_rhe`

Epic · Mage · Ranged · Cost 4

- **Stats** — DMG 7 · HP 9 · Shields 2 · SP 8 · Budget 28 vs 30 (-2)
- **Special · Rigid Smash** (3◆) — Deal 9 DMG and SLEEP up to 2 opponents for 2 rounds.
- **Passives**
  - Rocky Force Field: 50% chance to deflect a ranged attacker's hit.
- **Found at** — Bore · Faultline
- **Lore** — _(none yet)_

#### Rumbler · `bore_rollo`

Epic · Warrior · Melee · Cost 4

- **Stats** — DMG 4 · HP 16 · Shields 3 · SP 4 · Budget 30 vs 30 (on)
- **Special · Rolling Bash** (2◆) — Roll up to 2 slots into an opponent in range, then deal 3×3 DMG.
- **Passives**
  - Rolling Start — after each basic attack it rolls 1 slot further toward the enemy home.
  - Its Special reaches any slot on the board.
- **Found at** — Bore · The Rolling Deep
- **Lore** — _(none yet)_

#### Bolder · `bore_bolder`

Epic · Warrior · Melee · Cost 5

- **Stats** — DMG 6 · HP 20 · Shields 3 · SP 3 · Budget 35 vs 35 (on)
- **Special · Vengeance** (2◆) — Deal PEN damage equal to what Bolder took this round, and SLEEP an opponent for 2 rounds.
- **Passives**
  - Iron Ore: takes half damage from Ranger and Assassin attackers.
- **Found at** — Bore · The Rolling Deep
- **Lore** — _(none yet)_

#### Cragrider · `bore_rohojohn`

Epic · Ranger · Ranged · Cost 5

- **Stats** — DMG 7 · HP 12 · Shields 0 · SP 12 · Budget 31 vs 35 (-4)
- **Special · Cougar Pounce** (3◆) — Deal 10 DMG to an opponent in range and SLEEP them for 2 rounds.
- **Passives**
  - Mounted: moves like a chess king — a diagonal step costs 1, not 2 (lost if it dismounts).
  - War Mount — On summon, raises a 3-shield barrier.
  - War Mount — Basic attacks hit an ADJACENT target for +4 DMG.
- **Found at** — Bore · Cavernous Descent
- **Lore** — _(none yet)_

#### Magnetite · `bore_gemaga`

Epic · Support · Melee · Cost 5

- **Stats** — DMG 6 · HP 19 · Shields 2 · SP 6 · Budget 35 vs 35 (on)
- **Tribe** — Dragon Born
- **Keywords** — REFLECT 2
- **Special · Magnetic Shield** (4◆) — Give all allies in range REFLECT 1 for 2 rounds.
- **Passives**
  - REFLECT 2: returns 2 DMG to attackers.
- **Found at** — Bore · Cavernous Descent
- **Lore** — _(none yet)_

#### Obsidian · `bore_obsidi`

Epic · Assassin · Melee · Cost 5

- **Stats** — DMG 4 ×2 · HP 12 · Shields 3 · SP 8 · Budget 34 vs 35 (-1)
- **Tribe** — Cavernous
- **Keywords** — BLOCK
- **Special · Dirt Driller** (3◆) — Gain STEALTH for up to 2 rounds. Your next attack erupts for 6×2 DMG.
- **Passives**
  - BLOCK 1: every incoming hit is reduced by 1 — before shields, and even against PEN.
  - Obsidian Claws: SP becomes 11 while STEALTHed (underground).
- **Found at** — Bore · Cavernous Descent
- **Lore** — _(none yet)_

<!-- rare -->

#### CaveDweller · `bore_cavedweller`

Rare · Support · Ranged · Cost 1

- **Stats** — DMG 2 · HP 5 · Shields 1 · SP 6 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - On summon: deal 2 DMG to one enemy and apply SLEEP for 1 round.
- **Found at** — Bore · Quarry Mouth
- **Lore** — _(none yet)_

#### Cosmic · `bore_cosmic`

Rare · Mage · Ranged · Cost 1

- **Stats** — DMG 3 · HP 4 · Shields 1 · SP 6 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - Meteor — On death, calls down a meteor — 3 DMG to every opponent at the end of next round.
- **Found at** — Bore · Rubble Road
- **Lore** — _(none yet)_

#### Crock · `bore_crock`

Rare · Assassin · Melee · Cost 1

- **Stats** — DMG 5 · HP 3 · Shields 0 · SP 7 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - Deathroll — On death, deals 5 damage back to its killer if the killer is within its reach.
- **Found at** — Bore · Rubble Road
- **Lore** — _(none yet)_

#### Hillbilly · `bore_hillbilly`

Rare · Tank · Melee · Cost 1

- **Stats** — DMG 2 · HP 5 · Shields 3 · SP 2 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - Hillside — the first time each ally is hit, gives that ally +1 shield.
- **Found at** — Bore · Rubble Road
- **Lore** — _(none yet)_

#### Iron · `bore_iron`

Rare · Warrior · Melee · Cost 1

- **Stats** — DMG 3 · HP 3 · Shields 3 · SP 3 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - On summon: give nearby allies +2 shield.
- **Found at** — Bore · Quarry Mouth
- **Lore** — _(none yet)_

#### Pebble · `bore_kcor`

Rare · Ranger · Ranged · Cost 1

- **Stats** — DMG 2 ×2 · HP 2 · Shields 1 · SP 7 · Budget 15 vs 15 (on)
- **Special** — none
- **Passives**
  - On summon: hurl 5 rocks of 1 DMG at random opponents in range — each rock rolls to land.
- **Found at** — Bore · Quarry Mouth
- **Lore** — _(none yet)_

#### Clubber · `bore_clubber`

Rare · Warrior · Melee · Cost 2

- **Stats** — DMG 4 · HP 9 · Shields 2 · SP 3 · Budget 20 vs 20 (on)
- **Keywords** — REFLECT
- **Special** — none
- **Passives**
  - REFLECT 1: returns 1 DMG to attackers.
- **Found at** — Bore · The Smithy Camp
- **Lore** — _(none yet)_

#### Old Timer · `bore_old_timer`

Rare · Mage · Ranged · Cost 2

- **Stats** — DMG 4 ×2 · HP 7 · Shields 1 · SP 3 · Budget 20 vs 20 (on)
- **Keywords** — REGEN 2
- **Special** — none
- **Passives**
  - REGEN 2: heals 2 HP at the end of each round.
- **Found at** — Bore · Sand Village
- **Lore** — _(none yet)_

#### Rock Goblin · `bore_rockgoblin`

Rare · Tank · Melee · Cost 2

- **Stats** — DMG 4 · HP 9 · Shields 2 · SP 3 · Budget 20 vs 20 (on)
- **Special** — none
- **Passives**
  - Cave Guard — When an enemy is summoned within range, hits it with 4 DMG.
- **Found at** — Bore · The Smithy Camp
- **Lore** — _(none yet)_

#### Sling · `bore_sling`

Rare · Ranger · Ranged · Cost 2

- **Stats** — DMG 2 ×2 · HP 3 · Shields 1 · SP 11 · Budget 20 vs 20 (on)
- **Keywords** — CRIT
- **Special** — none
- **Passives**
  - Crack Shot — its CRIT can fire even at a shielded target — and when it lands, the shot pierces the shield instead of being stopped by it.
- **Found at** — Bore · Sand Village
- **Lore** — _(none yet)_

#### Smith · `bore_smith`

Rare · Support · Ranged · Cost 2

- **Stats** — DMG 2 · HP 10 · Shields 1 · SP 6 · Budget 20 vs 20 (on)
- **Special** — none
- **Passives**
  - On summon: give nearby allies +2 shield.
- **Found at** — Bore · The Smithy Camp
- **Lore** — _(none yet)_

#### Thorny Ripper · `bore_thorny_ripper`

Rare · Assassin · Melee · Cost 2

- **Stats** — DMG 4 · HP 4 · Shields 2 · SP 8 · Budget 20 vs 20 (on)
- **Tribe** — Sand Village
- **Keywords** — REFLECT 2
- **Special** — none
- **Passives**
  - REFLECT 2: returns 2 DMG to attackers.
  - False Head — once per game, the first BASIC attack against it hits a decoy head and deals no damage. Specials go through.
- **Found at** — Bore · Sand Village
- **Lore** — _(none yet)_

#### Granite Ankylosaur · `bore_ankylosaur`

Rare · Tank · Melee · Cost 3

- **Stats** — DMG 4 · HP 11 · Shields 4 · SP 2 · Budget 25 vs 25 (on)
- **Tribe** — Mountain Beasts
- **Keywords** — BLOCK
- **Special** — none
- **Passives**
  - BLOCK 1: every incoming hit is reduced by 1 — before shields, and even against PEN.
  - Tail Club — Basic hits 50% chance to apply SLEEP for 2 rounds.
- **Found at** — Bore · Mountain Beast Range
- **Lore** — _(none yet)_

#### Granite Armadillo · `bore_armadillo`

Rare · Tank · Melee · Cost 3

- **Stats** — DMG 1 · HP 15 · Shields 4 · SP 1 · Budget 25 vs 25 (on)
- **Keywords** — BLOCK 2
- **Special** — none
- **Passives**
  - BLOCK 2: every incoming hit is reduced by 2 — before shields, and even against PEN.
- **Found at** — Bore · Mountain Beast Range
- **Lore** — _(none yet)_

#### Slugger · `bore_rock`

Rare · Assassin · Melee · Cost 3

- **Stats** — DMG 5 · HP 11 · Shields 0 · SP 9 · Budget 25 vs 25 (on)
- **Special** — none
- **Passives**
  - Punch Drunk — Basic hits 30% chance to apply SLEEP for 2 rounds.
  - Talent (free · once per game) — Roll Out Combo Killer: Once per game, free: hit with a 1 → 2 → 3 → 4 DMG combo.
- **Found at** — Bore · The Standing Stones
- **Lore** — _(none yet)_

#### Stone · `bore_stone`

Rare · Ranger · Ranged · Cost 3

- **Stats** — DMG 5 · HP 5 · Shields 2 · SP 11 · Budget 25 vs 25 (on)
- **Special** — none
- **Passives**
  - Talent (free · once per game) — Search and Rescue: Once per game, free: trade board positions with an ally.
  - Basic attacks deal bonus damage (once): +2 on every basic.
  - Quartz Hound — On summon, raises a 3-shield barrier.
- **Found at** — Bore · The Standing Stones
- **Lore** — _(none yet)_

#### UFO · `bore_ufo`

Rare · Support · Ranged · Cost 3

- **Stats** — DMG 2 · HP 2 · Shields 5 · SP 12 · Budget 26 vs 25 (+1)
- **Keywords** — FLYING
- **Special** — none
- **Passives**
  - End of round: deals 1 DMG to every opponent in range (pierces shields).
- **Found at** — Bore · The Standing Stones
- **Lore** — _(none yet)_

#### Warthog · `bore_warthog`

Rare · Warrior · Melee · Cost 3

- **Stats** — DMG 5 · HP 13 · Shields 2 · SP 3 · Budget 25 vs 25 (on)
- **Special** — none
- **Passives**
  - Tusk Rush — On summon: rolls 2 slots forward toward the enemy home (until blocked).
  - On summon: deal 5 DMG to enemies in the area ahead.
- **Found at** — Bore · Mountain Beast Range
- **Lore** — _(none yet)_

### BORE — spells

#### Pebble Toss · `bore_pebble_toss`

Damage · Cost 1✦

- **Text** — Deal 3 DMG to a target and give a BORE ally +1 shield.
- **Lore** — _(none yet)_

#### Sand Trap · `bore_sand_trap`

Area · Cost 2✦ · area: row

- **Text** — SLEEP every opponent in a chosen row for 1 round.
- **Lore** — _(none yet)_

#### Bulwark · `bore_bulwark`

Heal · Cost 3✦

- **Text** — Give a BORE ally +3 shield.
- **Lore** — _(none yet)_

#### Stone Wall · `bore_stone_wall`

Wall · Cost 4✦

- **Text** — Wall of stone across your OWN Home row for 3 rounds. A card that MOVES in loses 1 shield then takes 3 DMG. BORE allies in the row gain BLOCK 2. Ranged attacks and FLYING cards pass over.
- **Lore** — _(none yet)_

#### Fortify · `bore_fortify`

Heal · Cost 5✦

- **Text** — Give ALL BORE allies +2 shield.
- **Lore** — _(none yet)_

#### Bedrock · `bore_bedrock`

Field · Cost 6✦ · 3 rounds

- **Text** — Field (3 rounds): your BORE allies gain BLOCK 1 and REFLECT 1.
- **Lore** — _(none yet)_

#### Shatterpoint · `bore_shatterpoint`

Damage · Cost 7✦

- **Text** — Deal 12 DMG (PEN) to a target — ignores shields entirely.
- **Lore** — _(none yet)_

#### Landslide · `bore_landslide`

Area · Cost 8✦ · area: tworows

- **Text** — SLEEP every opponent across two adjacent rows for 1 round, and give BORE allies in those rows +2 shield.
- **Lore** — _(none yet)_

#### Tremor · `bore_tremor`

Area · Cost 9✦ · area: board

- **Text** — Deal 8 DMG to every opponent — double (16) to any with no shields.
- **Lore** — _(none yet)_

#### Mountain's Fall · `bore_mountains_fall`

Area · Cost 10✦ · area: board

- **Text** — Deal 15 DMG to every opponent and give all BORE allies +5 shield. For the rest of the game, BORE allies gain +1 shield at the start of each round.
- **Lore** — _(none yet)_
