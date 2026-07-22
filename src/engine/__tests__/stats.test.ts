// Post-match stat tallying — damage/heal/kill attribution through the funnels.

import { describe, expect, it } from "vitest";
import { applyStatus, resolveHit } from "../combat";
import { healCard } from "../state";
import { advance } from "../phases";
import { atCleanup, place, prepState } from "./helpers";

describe("match stats", () => {
  it("credits HP damage + a kill to the attacker (card + side total)", () => {
    const s = prepState();
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const t = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 4, maxHp: 4, curShields: 0 });
    resolveHit(s, a, t, { kind: "special", dmg: 4, hits: 1, pen: false, crit: false });
    expect(s.stats.byPlayer.P1.dmg).toBe(4);
    expect(s.stats.byPlayer.P1.kills).toBe(1);
    expect(s.stats.byCard[a.instanceId].dmg).toBe(4);
    expect(s.stats.byCard[a.instanceId].kills).toBe(1);
  });

  it("a support heal credits the HEALER, and the patient only as RECEIVED", () => {
    // The bug this replaces: healCard defaulted its source to the recipient, so
    // the report could only ever show who got healed, never who did the healing.
    const s = prepState();
    const healer = place(s, "dawn_amble", "P1", 2, 1);
    const ally = place(s, "leaf_nettle", "P1", 2, 2, { curHp: 2, maxHp: 20 });
    healCard(s, ally, 3, healer);
    expect(s.stats.byCard[healer.instanceId].heal).toBe(3);
    expect(s.stats.byCard[healer.instanceId].healRecv).toBe(0); // it healed, it wasn't healed
    expect(s.stats.byCard[ally.instanceId].healRecv).toBe(3);
    expect(s.stats.byCard[ally.instanceId].heal).toBe(0); // the patient healed nobody
    expect(s.stats.byPlayer.P1.heal).toBe(3);
    expect(s.stats.byPlayer.P1.healRecv).toBe(3);
  });

  it("a self-heal names itself, so it lands on both sides of the ledger", () => {
    const s = prepState();
    const self = place(s, "leaf_alpha", "P1", 2, 0, { curHp: 5, maxHp: 20 });
    healCard(s, self, 7, self);
    expect(s.stats.byCard[self.instanceId].heal).toBe(7);
    expect(s.stats.byCard[self.instanceId].healRecv).toBe(7);
  });

  it("an UNATTRIBUTED heal credits nobody as the healer", () => {
    // Guards the old fallback from creeping back: a heal with no named source
    // must stay unattributed rather than being filed as the patient's own work.
    const s = prepState();
    const self = place(s, "leaf_alpha", "P1", 2, 0, { curHp: 5, maxHp: 20 });
    healCard(s, self, 7);
    expect(s.stats.byPlayer.P1.heal).toBe(0);
    expect(s.stats.byCard[self.instanceId].heal).toBe(0);
    expect(s.stats.byCard[self.instanceId].healRecv).toBe(7); // still visible as received
  });

  it("Morning Dew credits the card providing it, not the allies it lands on", () => {
    // The one live mis-credit the audit turned up: roundHealElement called
    // healCard with no source, so a dedicated healer's whole output was filed
    // under whichever allies happened to be standing in the dew.
    const s = prepState();
    const dew = place(s, "leaf_sprinu", "P1", 2, 0); // Morning Dew: +1 to LEAF allies
    const ally = place(s, "leaf_nettle", "P1", 2, 1, { curHp: 1, maxHp: 20 });
    place(s, "dusk_gool", "P2", 0, 0); // keep P2 on the board
    const n = advance(atCleanup(s));
    const sprinu = n.stats.byCard[dew.instanceId];
    const nettle = n.stats.byCard[ally.instanceId];
    // Nettle is restored 2: 1 from the dew, 1 from its own LEAF Photosynthesis.
    expect(nettle.healRecv).toBe(2);
    // Of that, exactly 1 is Nettle's OWN work (Photosynthesis). Before the fix
    // it read 2, because the dew was filed under whoever it landed on.
    expect(nettle.heal).toBe(1);
    // ...and the dew is credited to Sprinu, which used to show 0 healing done
    // despite being the only dedicated healer on the board.
    expect(sprinu.heal).toBe(1);
  });

  it("damage records the DEFENDER too, not just the attacker", () => {
    // A tank's entire contribution used to be invisible: the report knew who
    // dealt damage and nothing about who soaked it.
    const s = prepState();
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const t = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 40, maxHp: 40, curShields: 0 });
    resolveHit(s, a, t, { kind: "special", dmg: 6, hits: 1, pen: false, crit: false });
    expect(s.stats.byCard[t.instanceId].taken).toBe(6);
    expect(s.stats.byPlayer.P2.taken).toBe(6);
    expect(s.stats.byCard[t.instanceId].dmg).toBe(0); // it dealt none of it
    expect(s.stats.byPlayer.P1.taken).toBe(0);
  });

  it("counts control landed, and only once it survives the fizzle gates", () => {
    const s = prepState();
    const t = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 40, maxHp: 40 });
    applyStatus(s, t, "ROOT", 2, 0, "LEAF");
    applyStatus(s, t, "BLEED", 2, 1, "LEAF");
    expect(s.stats.byCard[t.instanceId].debuffs).toBe(2);
    expect(s.stats.byPlayer.P2.debuffs).toBe(2);
    // STEALTH is a BUFF status — it must not read as having been controlled.
    applyStatus(s, t, "STEALTH", 1, 0, "DUSK");
    expect(s.stats.byCard[t.instanceId].debuffs).toBe(2);
  });

  it("counts losses on the side that lost the card", () => {
    const s = prepState();
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const t = place(s, "dusk_vamp", "P2", 2, 1, { curHp: 3, maxHp: 3, curShields: 0 });
    resolveHit(s, a, t, { kind: "special", dmg: 9, hits: 1, pen: false, crit: false });
    expect(s.stats.byPlayer.P2.deaths).toBe(1); // P2 lost it...
    expect(s.stats.byPlayer.P1.kills).toBe(1); // ...and P1 gets the kill
    expect(s.stats.byPlayer.P1.deaths).toBe(0);
    expect(s.stats.byCard[t.instanceId].deaths).toBe(1);
  });

  it("does not credit friendly fire", () => {
    const s = prepState();
    const a = place(s, "leaf_alpha", "P1", 2, 0);
    const friend = place(s, "leaf_nettle", "P1", 2, 1, { curHp: 10, maxHp: 10, curShields: 0 });
    resolveHit(s, a, friend, { kind: "special", dmg: 3, hits: 1, pen: false, crit: false });
    expect(s.stats.byPlayer.P1.dmg).toBe(0);
  });
});
