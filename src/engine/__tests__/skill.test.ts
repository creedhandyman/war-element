import { describe, it, expect } from "vitest";
import {
  AI_SKILLS, SKILL_DEMOTE_LOSSES, SKILL_PROMOTE_WINS, SKILL_PROFILES, emptySkillTrack,
  recordSkillMatch, skillOf, weSetSkillSeat,
} from "../skill";
import { advance, chooseBattleAction, createInitialState } from "../index";
import type { GameState } from "../index";
import { place, prepState } from "./helpers";
import { PREMADE_DECKS } from "../../data/custom-decks";
import {
  aiSkillIsAuto, clearAiSkill, loadAiSkill, loadAiTrack, recordAiMatch, saveAiSkill,
} from "../../data/prefs";

describe("the skill dial", () => {
  it("is sharp when nothing asked for otherwise", () => {
    // THE COMPATIBILITY GUARANTEE. Every saved game, replay and fixture in the
    // suite predates the dial and must face exactly the opponent it always did.
    const s = createInitialState(7);
    expect(s.aiSkill, "a fresh match declares nothing").toBeUndefined();
    expect(skillOf(s).key).toBe("sharp");
  });

  it("names itself, gentlest first, with every switch on at the top", () => {
    expect([...AI_SKILLS]).toEqual(["learning", "steady", "sharp"]);
    for (const k of AI_SKILLS) {
      expect(SKILL_PROFILES[k].key, `${k} names itself`).toBe(k);
      expect(SKILL_PROFILES[k].blurb.length).toBeGreaterThan(20);
    }
    const sharp = SKILL_PROFILES.sharp;
    expect(
      [sharp.spells, sharp.plans, sharp.readsLethal, sharp.readsThreat,
       sharp.guardsHome, sharp.readsCurve, sharp.readsMagic],
      "sharp is the opponent that shipped — nothing taken away",
    ).toEqual([true, true, true, true, true, true, true]);
  });

  it("gives up strictly more knowledge the gentler it gets", () => {
    // The rungs have to NEST. Two rungs that each drop a different thing are two
    // difficulties, not a ladder, and the picker would be lying about its order.
    const count = (k: (typeof AI_SKILLS)[number]) => {
      const p = SKILL_PROFILES[k];
      return [p.spells, p.plans, p.readsLethal, p.readsThreat, p.guardsHome,
              p.readsCurve, p.readsMagic].filter(Boolean).length;
    };
    expect(count("learning")).toBeLessThan(count("steady"));
    expect(count("steady")).toBeLessThan(count("sharp"));
    for (const key of ["spells", "plans", "readsLethal", "readsThreat",
                       "guardsHome", "readsCurve", "readsMagic"] as const) {
      if (SKILL_PROFILES.steady[key]) {
        expect(SKILL_PROFILES.sharp[key], `sharp keeps ${key} if steady does`).toBe(true);
      }
      if (SKILL_PROFILES.learning[key]) {
        expect(SKILL_PROFILES.steady[key], `steady keeps ${key} if learning does`).toBe(true);
      }
    }
  });

  it("lets a kill walk that the sharp opponent takes", () => {
    // THE HANDICAP, as a single observable decision rather than a win rate.
    // Two enemies in reach: one nearly dead, one a fat threat. Sharp finishes
    // the wounded card; learning swings at whatever its target list offered
    // first, which is the mistake a new player makes and recognises.
    const build = (skill: GameState["aiSkill"]) => {
      const s = prepState(7, "P2");
      s.aiSkill = skill;
      s.phase = "battle";
      const me = place(s, "bore_bastion", "P2", 2, 1);
      place(s, "leaf_sakuroot", "P1", 1, 0, { curHp: 1 });
      place(s, "leaf_sakuroot", "P1", 1, 1);
      return { s, id: me.instanceId };
    };
    const sharp = build("sharp");
    const learning = build("learning");
    const sharpPick = chooseBattleAction(sharp.s, sharp.id);
    const learnPick = chooseBattleAction(learning.s, learning.id);
    expect(sharpPick.action).toBe("basic");
    const sharpTarget = sharp.s.cards[sharpPick.targetId!];
    expect(sharpTarget.curHp, "sharp finishes the wounded one").toBe(1);
    // Learning is not required to pick the healthy one — board order decides —
    // only to have stopped consulting lethality at all.
    expect(learnPick.action).toBe("basic");
    expect(skillOf(learning.s).readsLethal).toBe(false);
  });

  it("is a handicap, measured over real matches", () => {
    // THE CONTRACT THE WHOLE FEATURE RESTS ON: the gentle rung wins less.
    //
    // `weSetSkillSeat` is what makes this a head-to-head at all. The dial is
    // table-wide by design, so in a sim where BOTH seats are AI it applies to
    // both and cancels out — the harness hook confines it to one chair, which is
    // the asymmetry a real match has for free and this one does not.
    //
    // 60 games a rung, both chairs played so the second-seat advantage cancels.
    // Sized for the gap in skill.ts's table, not for precision: the attribution
    // lives there, and this only has to catch a switch wired backwards.
    const field = PREMADE_DECKS.filter((d) => (d.boardSize ?? 4) === 4).slice(0, 10);
    const wins = (skill: GameState["aiSkill"]) => {
      let won = 0, played = 0;
      for (const seat of ["P1", "P2"] as const) {
        weSetSkillSeat(seat);
        for (let i = 0; i < field.length; i++) {
          for (let r = 0; r < 3; r++) {
            const a = field[i], b = field[(i + 1 + r) % field.length];
            const [d1, d2] = seat === "P1" ? [a, b] : [b, a];
            let s: GameState = createInitialState(
              i * 131 + r * 17 + 5, d1.cards, d2.cards, [], [], [], 4,
            );
            s.aiSkill = skill;
            let steps = 0;
            while (s.phase !== "gameover" && steps < 8000) { s = advance(s); steps++; }
            if (s.win?.winner) { played++; if (s.win.winner === seat) won++; }
          }
        }
      }
      weSetSkillSeat(null);
      return { won, played };
    };
    const sharp = wins("sharp");
    const learning = wins("learning");
    expect(learning.played, "the sample actually resolved").toBeGreaterThan(40);
    expect(
      learning.won / learning.played,
      `learning ${learning.won}/${learning.played} vs sharp ${sharp.won}/${sharp.played}`,
    ).toBeLessThan(sharp.won / sharp.played);
  }, 180_000);
});


/* -- THE DIAL MOVES ITSELF --------------------------------------------------
   The three rungs were only reachable from a menu, and the default was picked
   once and frozen for the life of the save. A player does not stay a beginner,
   so the rung now tracks them: two wins up, three losses down. */
describe("the opponent adjusts in the background", () => {
  /** Play a string of results: "W" win, "L" loss. */
  const run = (from: (typeof AI_SKILLS)[number], results: string) =>
    [...results].reduce((t, r) => recordSkillMatch(t, r === "W"), emptySkillTrack(from));

  it("two wins in a row moves up a rung", () => {
    expect(SKILL_PROMOTE_WINS).toBe(2);
    expect(run("learning", "W").skill, "one win is not evidence").toBe("learning");
    expect(run("learning", "W").wins).toBe(1);
    expect(run("learning", "WW").skill).toBe("steady");
    expect(run("learning", "WWWW").skill).toBe("sharp");
    // ...and the counters start clean on the new rung, so the next promotion
    // is judged on the new opponent rather than on the one already beaten.
    expect(run("learning", "WW")).toEqual({ skill: "steady", wins: 0, losses: 0 });
  });

  it("three losses in a row gives one back, not the whole ladder", () => {
    expect(SKILL_DEMOTE_LOSSES).toBe(3);
    expect(run("sharp", "LL").skill, "two losses is a bad night, not a pattern").toBe("sharp");
    expect(run("sharp", "LLL").skill).toBe("steady");
    expect(run("sharp", "LLLLLL").skill).toBe("learning");
  });

  it("demotion is RELUCTANT where promotion is EAGER — that asymmetry is the design", () => {
    // An invisible difficulty DROP is the more insulting mistake, so it takes
    // more evidence than a climb does.
    expect(SKILL_DEMOTE_LOSSES).toBeGreaterThan(SKILL_PROMOTE_WINS);
  });

  it("trading wins and losses HOLDS the rung", () => {
    // The definition of the right rung: the one you can almost beat. A player
    // at roughly even should sit still, not oscillate.
    expect(run("steady", "WLWLWLWL").skill).toBe("steady");
    expect(run("steady", "LWLWLWLW").skill).toBe("steady");
  });

  it("a single result clears the opposite run", () => {
    // One win wipes a losing streak and one loss wipes a winning one, so a
    // demotion always takes three CONSECUTIVE losses.
    expect(run("sharp", "LLWL")).toEqual({ skill: "sharp", wins: 0, losses: 1 });
    expect(run("sharp", "LLWLL").skill, "the count restarted at the win").toBe("sharp");
    expect(run("learning", "WLW")).toEqual({ skill: "learning", wins: 1, losses: 0 });
  });

  it("clamps at both ends instead of walking off the ladder", () => {
    expect(run("sharp", "WWWWWW").skill).toBe("sharp");
    expect(run("learning", "LLLLLL").skill).toBe("learning");
    // The counter still climbs at the floor — it costs nothing, and a player
    // who claws back to a win starts their next climb from a clean slate
    // rather than from a buried count.
    expect(run("learning", "LLLLLL").losses).toBe(6);
    expect(run("learning", "LLLLLLW").wins).toBe(1);
  });

  it("a hand-edited rung is discarded rather than computed on", () => {
    // localStorage is editable and predates this field; an unknown rung would
    // otherwise index SKILL_PROFILES as undefined.
    const bogus = { skill: "godlike" as (typeof AI_SKILLS)[number], wins: 9, losses: 9 };
    expect(recordSkillMatch(bogus, true)).toEqual({ skill: "learning", wins: 0, losses: 0 });
  });

  it("every rung it can land on is a real profile", () => {
    // The whole point of the tracker is that nothing else has to validate it.
    let t = emptySkillTrack("learning");
    for (const r of "WWWWLLLLLLWWWWWWLLL") {
      t = recordSkillMatch(t, r === "W");
      expect(SKILL_PROFILES[t.skill], `landed on ${t.skill}`).toBeTruthy();
      expect(AI_SKILLS).toContain(t.skill);
      expect(t.wins).toBeGreaterThanOrEqual(0);
      expect(t.losses).toBeGreaterThanOrEqual(0);
      expect(Math.min(t.wins, t.losses), "only one run is ever live").toBe(0);
    }
  });
});


describe("Auto is the default, and pinning a rung stops it", () => {
  /** The suite runs headless; prefs wants a Storage. Same stub the story tests
   *  use, restored afterwards so it cannot leak across files. */
  function withStorage(body: () => void) {
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try { body(); } finally { g.localStorage = prior; }
  }

  it("a fresh save opens gentle and an established one opens sharp", () => {
    withStorage(() => {
      // The seed is the guess the manual default always made — the dial did not
      // change what a new player meets first, only whether it stays there.
      expect(loadAiSkill(false)).toBe("learning");
      expect(loadAiTrack(false).skill).toBe("learning");
    });
    withStorage(() => {
      expect(loadAiSkill(true)).toBe("sharp");
    });
  });

  it("climbs on its own, and remembers where it got to", () => {
    withStorage(() => {
      expect(aiSkillIsAuto(), "nothing pinned yet").toBe(true);
      expect(recordAiMatch(true, false)).toBe("learning");   // one win: not yet
      expect(recordAiMatch(true, false)).toBe("steady");     // two in a row
      expect(loadAiSkill(false), "and it persisted").toBe("steady");
      expect(recordAiMatch(true, false)).toBe("steady");
      expect(recordAiMatch(true, false)).toBe("sharp");
      expect(loadAiSkill(false)).toBe("sharp");
    });
  });

  it("PINNING a rung freezes it — results stop counting entirely", () => {
    withStorage(() => {
      saveAiSkill("learning");
      expect(aiSkillIsAuto()).toBe(false);
      // A player showing someone the game does not want two wins taking the
      // gentle opponent off them.
      for (let i = 0; i < 6; i++) expect(recordAiMatch(true, false)).toBe("learning");
      expect(loadAiSkill(false)).toBe("learning");
    });
  });

  it("unpinning hands it back on the rung it had actually climbed to", () => {
    withStorage(() => {
      recordAiMatch(true, false);
      recordAiMatch(true, false);            // Auto reached steady
      saveAiSkill("sharp");                  // ...then the player pinned sharp
      expect(loadAiSkill(false)).toBe("sharp");
      clearAiSkill();
      expect(aiSkillIsAuto()).toBe(true);
      expect(loadAiSkill(false), "back to where Auto was, not to the seed").toBe("steady");
    });
  });

  it("a save that predates Auto reads as PINNED, with no migration", () => {
    withStorage(() => {
      // A stored rung could only ever have come from the player pressing a
      // button, so "is there a manual choice on file" is the whole test — an
      // established player is not silently handed a moving dial.
      localStorage.setItem("we_prefs_v1", JSON.stringify({ aiSkill: "steady" }));
      expect(aiSkillIsAuto()).toBe(false);
      expect(loadAiSkill(true)).toBe("steady");
      expect(recordAiMatch(false, true)).toBe("steady");
    });
  });

  it("a hand-edited track is discarded rather than trusted", () => {
    withStorage(() => {
      localStorage.setItem("we_prefs_v1", JSON.stringify({ aiTrack: { skill: "godlike", wins: 99, losses: 0 } }));
      expect(loadAiTrack(false).skill, "falls back to the seed").toBe("learning");
      localStorage.setItem("we_prefs_v1", JSON.stringify({ aiTrack: { skill: "steady", wins: -5, losses: NaN } }));
      const t = loadAiTrack(false);
      expect(t.skill).toBe("steady");
      expect(t.wins).toBe(0);
    });
  });

  it("survives storage being unavailable at all", () => {
    // Private browsing, blocked site data. The choice holds for the session
    // rather than throwing at the player.
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = undefined;
    try {
      expect(() => loadAiSkill(false)).not.toThrow();
      expect(loadAiSkill(false)).toBe("learning");
      expect(() => recordAiMatch(true, false)).not.toThrow();
    } finally { g.localStorage = prior; }
  });
});
