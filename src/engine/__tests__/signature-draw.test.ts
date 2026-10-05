// EVERY SIGNATURE DRAWS WHAT THE GAME HANDS IT. Each signature was drawn in a
// lab against hand-made moments; this casts every mythic's and legendary's
// Special through the real engine (a crowded 5x5 board, then one with a kill),
// reads the step the way the game does (spell-fx), and runs the signature's
// delivery and landing to the end against stand-in tools. Nothing may throw,
// and no geometry or alpha may be NaN. The layer drops an effect that throws
// (impact-layer `dropped`), so a bug here would show in play only as a move
// that silently does not happen. Bosses fire on their own clock rather than as
// a cast, and are left out.
import { describe, expect, it } from "vitest";
import { applyIntent } from "../phases";
import { canFireSpecial, validSpecialTargets } from "../rules";
import { CARDS, TOKENS, getDef } from "../../data/cards";
import { cardAttack, cardAttackEffects, type SpellFx } from "../../ui/vfx/spell-fx";
import { SIGNATURES } from "../../ui/vfx/signatures";
import type { SigMoment } from "../../ui/vfx/signatures/types";
import type { FxTools } from "../../ui/vfx/looks/types";
import type { CardInstance, GameState, Intent } from "../types";
import { bigPrepState, place, unmask } from "./helpers";

type At = { row: number; col: number };
type Sig = Extract<SpellFx, { kind: "signature" }>;
type DrawFn = (g: unknown, t: number, dt: number) => void;

const SQ = 80, GAP = 6, PAD = 20;
const rect = (a: At) => ({ x: PAD + a.col * (SQ + GAP), y: PAD + a.row * (SQ + GAP), w: SQ, h: SQ });
const BOARD = { x: PAD, y: PAD, w: 5 * SQ + 4 * GAP, h: 5 * SQ + 4 * GAP };
const DT = 1 / 60;

/** Where in a signature a bad number came from: the first stack frame in it. */
const site = () => (new Error().stack ?? "").split(/\n/).find((l) => l.includes("signatures"))?.trim() ?? "?";

/** Every number reachable in `v` (a few levels deep) must be finite. */
function finite(v: unknown, label: string, errs: string[], depth = 0) {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) errs.push(`${label} = ${v} ${site()}`);
  } else if (v && typeof v === "object" && depth < 3) {
    for (const x of Object.values(v)) finite(x, label, errs, depth + 1);
  }
}

/** A Graphics stand-in: any method chains, and checks its arguments. */
function graphics(errs: string[]) {
  const g: unknown = new Proxy({} as Record<string | symbol, unknown>, {
    get: (store, k) => (k in store ? store[k] : k === "then" ? undefined : (...args: unknown[]) => {
      finite(args, `g.${String(k)}()`, errs);
      return g;
    }),
    set: (store, k, v) => {
      finite(v, `g.${String(k)}`, errs);
      store[k] = v;
      return true;
    },
  });
  return g;
}

/** The tools a signature draws with, recording what it schedules. */
class Stage {
  errs: string[] = [];
  now = 0;
  draws: { start: number; end: number; fn: DrawFn }[] = [];
  laters: { at: number; fn: () => void }[] = [];

  tools(element: string): FxTools {
    const check = (name: string) => (...args: unknown[]) => finite(args, `t.${name}()`, this.errs);
    return {
      element, quality: 1,
      style: { palette: [0xffffff], gravity: 0, drag: 0.5, size: [4, 1], speed: [10, 20], life: [0.3, 0.6] },
      emit: check("emit"), spark: check("spark"), shot: check("shot"), glow: check("glow"), ring: check("ring"),
      band: check("band"), charge: check("charge"), flash: check("flash"), arcCut: check("arcCut"),
      rakes: check("rakes"), bolt: check("bolt"), arcs: check("arcs"), rays: check("rays"),
      later: (seconds: number, fn: () => void) => {
        finite(seconds, "t.later()", this.errs);
        this.laters.push({ at: this.now + seconds, fn });
      },
      draw: (seconds: number, fn: DrawFn, opts?: { delay?: number }) => {
        finite([seconds, opts], "t.draw()", this.errs);
        const start = this.now + (opts?.delay ?? 0);
        this.draws.push({ start, end: start + seconds, fn });
      },
    } as unknown as FxTools;
  }

  /** Plays everything scheduled for `span` s at 60Hz, the way the layer does. */
  play(span: number) {
    const stop = this.now + span;
    for (; this.now <= stop; this.now += DT) {
      for (const l of this.laters.filter((x) => x.at <= this.now)) {
        this.laters.splice(this.laters.indexOf(l), 1);
        this.guard("later", l.fn);
      }
      for (const d of this.draws) {
        if (this.now < d.start || this.now > d.end + DT) continue;
        const t = Math.min(1, (this.now - d.start) / Math.max(1e-6, d.end - d.start));
        if (!this.guard("draw", () => d.fn(graphics(this.errs), t, DT))) d.end = -1;
      }
    }
  }

  guard(what: string, fn: () => void): boolean {
    try {
      fn();
      return true;
    } catch (e) {
      this.errs.push(`${what} threw: ${(e as Error).message} ${(e as Error).stack?.split(/\n/)[1]?.trim() ?? ""}`);
      return false;
    }
  }
}

/** A crowded 5x5 board around the caster: foes near and far (three of them
 *  ROOTed, for the Specials that feed on a status), hurt allies round it. With
 *  `kill`, a 2-HP foe stands in front of it. The caster stands at the front of
 *  its side, or (`back`) one row behind it. */
function board(defId: string, kill: boolean, back: boolean) {
  const s = bigPrepState(7);
  s.players.P1.magicPool = 30;
  const def = getDef(defId);
  const at = (def.attackType === "Melee") !== back ? { row: 3, col: 2 } : { row: 4, col: 2 };
  const me = unmask(s, place(s, defId, "P1", at.row, at.col, { curHp: def.hp, maxHp: def.hp }));
  const foes = kill ? [[2, 2], [0, 0]] : [[2, 1], [2, 2], [2, 3], [1, 2], [0, 1], [0, 3]];
  foes.forEach(([row, col], i) => {
    const hp = kill && row === 2 ? 2 : 30;
    const f = place(s, "dusk_gool", "P2", row, col, { curHp: hp, maxHp: hp, curShields: 0 });
    if (i < 3) f.statuses = [{ kind: "ROOT", duration: 2, power: 0 } as CardInstance["statuses"][number]];
  });
  for (const [row, col] of [[3, 1], [3, 3], [4, 0], [4, 4]])
    if (row !== at.row || col !== at.col) place(s, "dusk_gool", "P1", row, col, { curHp: 10, maxHp: 30 });
  s.phase = "battle";
  s.prep = null;
  s.battle = { queue: [me.instanceId], index: 0, awaitingInput: me.instanceId };
  return { s, me };
}

/** Casts `defId`'s Special for real: the first aim the engine accepts. */
function cast(defId: string, kill: boolean): { before: GameState; after: GameState } | string {
  const why: string[] = [];
  for (const back of [false, true]) {
    const { s, me } = board(defId, kill, back);
    const can = canFireSpecial(s, me.instanceId);
    if (!can.ok) { why.push(can.reason ?? "cannot fire"); continue; }
    const valid = validSpecialTargets(s, me.instanceId).map((c) => c.instanceId);
    const n = Math.max(1, Math.min(4, Number(getDef(defId).special?.params?.targets ?? 1)));
    const aims: Partial<Intent & { type: "BATTLE_ACTION" }>[] = [
      ...valid.map((id) => ({ targetId: id, ...(n > 1 && valid.length > 1 ? { targetIds: valid.slice(0, n) } : {}) })),
      ...valid.map((id) => ({ targetId: id })),
      { targetId: me.instanceId },
      {},
    ];
    for (const aim of aims) {
      try {
        const after = applyIntent(structuredClone(s), {
          type: "BATTLE_ACTION", player: "P1", action: "special", ...aim, ...(defId === "bore_prism" ? { mode: "freezing" } : {}),
        } as Intent);
        return { before: s, after };
      } catch (e) {
        why.push((e as Error).message);
      }
    }
  }
  return [...new Set(why)].join("; ");
}

describe("every signature draws what a real cast hands it", () => {
  it("casts each mythic's and legendary's Special and plays its signature cleanly to the end", () => {
    const defs = [...CARDS, ...TOKENS];
    const ids = Object.keys(SIGNATURES).filter((k) => defs.some((c) => c.id === k && !c.boss));
    expect(ids.length).toBeGreaterThan(80);
    const problems: string[] = [];
    for (const id of ids) {
      for (const kill of [false, true]) {
        const where = `${id}${kill ? " (kill)" : ""}`;
        const step = cast(id, kill);
        if (typeof step === "string") { problems.push(`${where}: could not cast (${step})`); continue; }
        const { before, after } = step;
        const sig = cardAttackEffects(before, after).find((f): f is Sig => f.kind === "signature");
        if (!sig) { problems.push(`${where}: its Special played no signature`); continue; }
        const move = SIGNATURES[id];
        const stage = new Stage();
        const t = stage.tools(sig.element);
        const from = rect(sig.actor);
        const ahead = { x: sig.dir.dc, y: sig.dir.dr };
        // The delivery, as impact-layer `attackIn` hands it: no spawns or allies yet.
        const atk = cardAttack(before, after);
        if (atk?.signature === id && move.deliver) {
          const m: SigMoment = {
            from, to: rect(atk.lands ?? atk.actor), targets: atk.targets.map(rect), power: atk.targets.map(() => 1),
            killed: atk.targets.map(() => false), spawned: [], allies: [], ahead, board: BOARD, arriving: false, size: SQ,
          };
          stage.guard("deliver", () => move.deliver!(t, m, 0.45));
          stage.play(0.45);
        }
        const m: SigMoment = {
          from, to: rect(sig.lands), targets: sig.targets.map(rect),
          power: sig.damage.map((d) => Math.max(0.55, Math.min(2, Math.sqrt(d / 8)))), killed: sig.killed,
          spawned: sig.spawned.map(rect), allies: sig.allies.map(rect), ahead, board: BOARD, arriving: false, size: SQ,
        };
        stage.guard("land", () => move.land(t, m));
        stage.play(2.5);
        if (stage.errs.length) problems.push(`${where}: ${[...new Set(stage.errs)].slice(0, 3).join(" / ")}`);
      }
    }
    expect(problems).toEqual([]);
  }, 120_000);
});
