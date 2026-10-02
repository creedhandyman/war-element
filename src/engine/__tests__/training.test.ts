import { describe, expect, it } from "vitest";
import { aiMulligan, aiPrepIntent, chooseBattleAction } from "../ai";
import { advance, applyIntent, needsP1Input } from "../phases";
import { createInitialState } from "../state";
import type { GameState } from "../types";
import { CARDS } from "../../data/cards";
import { loadStory, newSave, saveStory } from "../../data/story";
import {
  GRADUATION_PACKS, LESSONS, LESSON_BOARD, LESSON_SHARDS, completeLesson, lessonDone,
} from "../../ui/training";

const PLAYABLE = new Map(CARDS.filter((c) => !c.boss && !c.guardsHomeRow).map((c) => [c.id, c]));

describe("Training Ground lessons", () => {
  it("every lesson deck is made of real, ordinary cards, and its first cards are in it", () => {
    for (const l of LESSONS) {
      for (const id of [...l.you, ...l.foe]) expect(PLAYABLE.has(id), `${l.id}: ${id}`).toBe(true);
      for (const id of l.youFirst) expect(l.you, `${l.id} youFirst ${id}`).toContain(id);
      for (const id of l.foeFirst ?? []) expect(l.foe, `${l.id} foeFirst ${id}`).toContain(id);
    }
  });

  it("tip ids are unique and every tip has real text", () => {
    const ids = LESSONS.flatMap((l) => l.tips.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of LESSONS.flatMap((l) => l.tips)) {
      expect(t.title.length, t.id).toBeGreaterThan(0);
      expect(t.body.length, t.id).toBeGreaterThan(10);
      expect(t.body, t.id).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it("every status the Statuses lesson explains has a card in its deck that applies it", () => {
    // SLEEP, SCALD and MUTED once had no carrier, so their tips could never fire.
    const lesson = LESSONS.find((l) => l.id === "statuses")!;
    const kinds = lesson.tips.filter((t) => /^st-[A-Z]+$/.test(t.id)).map((t) => t.id.slice(3));
    // Two arrive by element aura rather than a printed on-hit status.
    const viaAura: Record<string, string> = { BURN: "PYRO", ELECTRIFIED: "BOLT" };
    for (const kind of kinds) {
      const carried = lesson.you.some((id) => {
        const d = PLAYABLE.get(id)!;
        return d.onHitStatus?.kind === kind || d.element === viaAura[kind];
      });
      expect(carried, kind).toBe(true);
    }
  });

  it("the auras lesson covers the eight playable elements and not VOID", () => {
    const auras = LESSONS.find((l) => l.id === "auras")!;
    const els = auras.tips.filter((t) => /^au-[A-Z]+$/.test(t.id)).map((t) => t.id.slice(3));
    expect(els.sort()).toEqual(["AQUA", "BOLT", "BORE", "DAWN", "DUSK", "GALE", "LEAF", "PYRO"]);
  });
});

describe("completeLesson", () => {
  it("pays the first win once, and a refight nothing", () => {
    const start = newSave();
    const shards = (s: typeof start) => s.hero?.shards ?? 0;
    const once = completeLesson(start, LESSONS[0].id);
    expect(lessonDone(once, LESSONS[0].id)).toBe(true);
    expect(shards(once) - shards(start)).toBe(LESSON_SHARDS);
    expect(completeLesson(once, LESSONS[0].id)).toBe(once);
    expect(completeLesson(once, "no-such-lesson")).toBe(once);
  });

  it("the last new lesson also pays the graduation packs", () => {
    let save = newSave();
    for (const l of LESSONS.slice(0, -1)) save = completeLesson(save, l.id);
    const packs = save.hero?.freePacks ?? 0;
    save = completeLesson(save, LESSONS[LESSONS.length - 1].id);
    expect((save.hero?.freePacks ?? 0) - packs).toBe(GRADUATION_PACKS);
  });

  it("survives a save and reload (loadStory keeps the field)", () => {
    const store = new Map<string, string>();
    const g = globalThis as { localStorage?: unknown };
    const prior = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      saveStory(completeLesson(newSave(), "crit"));
      expect(loadStory().trainingDone).toEqual(["crit"]);
    } finally { g.localStorage = prior; }
  });
});

/** P1 played by the same heuristic AI, through the public intent API. */
function driveP1(state: GameState): GameState {
  if (state.pendingFlow) {
    const card = state.cards[state.pendingFlow];
    return applyIntent(state, { type: "FLOW_CHANGE", player: card.owner, instanceId: state.pendingFlow, mode: "water" });
  }
  if (state.phase === "mulligan")
    return applyIntent(state, { type: "MULLIGAN", player: "P1", returnHandIds: aiMulligan(state, "P1") });
  if (state.phase === "prep") return applyIntent(state, aiPrepIntent(state, "P1"));
  const id = state.battle!.awaitingInput!;
  const choice = chooseBattleAction(state, id);
  return applyIntent(state, { type: "BATTLE_ACTION", player: "P1", action: choice.action, targetId: choice.targetId });
}

describe("each lesson plays out and teaches", () => {
  // Dealt exactly as App's startLesson deals it. One seed each: this guards that
  // a lesson can be played to a result and that its tips fire, not its balance
  // (measured separately; see the commit that added the Training Ground).
  it.each(LESSONS.map((l) => [l.id, l] as const))("%s", (_id, l) => {
    let s = createInitialState(7, [...l.you], [...l.foe], ["P1"], [], [], LESSON_BOARD,
      undefined, undefined, { P1: l.youFirst, ...(l.foeFirst ? { P2: l.foeFirst } : {}) });
    s.aiSkill = "learning";
    const fired = new Set<string>();
    for (let step = 0; step < 20_000 && s.phase !== "gameover"; step++) {
      s = needsP1Input(s) ? driveP1(s) : advance(s);
      for (const t of l.tips) if (t.when(s)) fired.add(t.id);
    }
    expect(s.phase).toBe("gameover");
    expect(fired.has(l.tips[0].id), "the intro").toBe(true);
    expect(fired.size, [...fired].join(",")).toBeGreaterThanOrEqual(3);
  }, 30_000);
});
