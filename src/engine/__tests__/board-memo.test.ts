// A BATTLE STEP REDRAWS THE BOARD ONCE, NOT FIVE TIMES (owner report
// 2026-09-28: big boards "can't keep up"). Measured with the CPU slowed to a
// phone's, a step made App render about five times — the strike lit, the step
// landing, the effects' pacing tick, a nested update — and every one of them
// redrew all of the board's squares and cards, the speed queue with them, and
// re-read layout mid-commit. The fix is memoization, which fails SILENTLY: an
// inline array or arrow function handed to the board switches it off and
// nothing looks different. Source-level, like the other wiring tests, because
// App.tsx is not reachable from a unit test.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ui = (f: string) => readFileSync(join(__dirname, "..", "..", "ui", f), "utf8");
const APP = ui("App.tsx");
const BOARD = ui("Board.tsx");
const SLOT = ui("Slot.tsx");
const QUEUE = ui("SpeedQueue.tsx");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** The `<Board ... />` element in App's JSX, comments stripped. */
function boardElement(): string {
  const src = code(APP);
  const at = src.indexOf("<Board\n") >= 0 ? src.indexOf("<Board\n") : src.indexOf("<Board\r\n");
  expect(at, "no <Board> element in App").toBeGreaterThan(-1);
  const end = src.indexOf("/>", at);
  return src.slice(at, end);
}

describe("the board is memoized", () => {
  it("Board, Slot and the speed queue are memo components", () => {
    expect(BOARD).toMatch(/export const Board = memo\(BoardView\)/);
    expect(SLOT).toMatch(/export const Slot = memo\(SlotView, slotPropsEqual\)/);
    expect(QUEUE).toMatch(/export const SpeedQueue = memo\(SpeedQueueView\)/);
  });

  it("App hands the board nothing it rebuilds on every render", () => {
    const el = boardElement();
    // A literal array, object or function in a prop is a new value every render.
    expect(el, "an arrow function in a Board prop").not.toMatch(/=>/);
    expect(el, "an array literal in a Board prop").not.toMatch(/=\{\s*\[/);
    expect(el, "an object literal in a Board prop").not.toMatch(/=\{\s*\{/);
    expect(el, "a reduce in a Board prop").not.toMatch(/\.reduce\(/);
    for (const h of ["onSlotClick={boardHandlers.click}", "onSlotDragOver={boardHandlers.over}", "onSlotDrop={boardHandlers.drop}"])
      expect(el).toContain(h);
    expect(el).toContain("aimArea={boardAim}");
    expect(el).toContain("pickCounts={boardPickCounts}");
  });

  it("keeps the rebuilt selections by value, not identity", () => {
    // The selection state is reset with a fresh `[]` all over App; a list
    // derived from it was a new array on renders where nothing had changed.
    expect(APP).toMatch(/const boardAim = useSameValue\(/);
    expect(APP).toMatch(/const boardPickCounts = useSameValue\(/);
  });
});

describe("no layout read on a render that changed nothing", () => {
  it("the card-slide pass skips a render of the same game", () => {
    const at = BOARD.indexOf("CARDS SLIDE");
    expect(at).toBeGreaterThan(-1);
    const effect = code(BOARD.slice(at, BOARD.indexOf("return (", at)));
    const skip = effect.search(/prev\.game === game && prev\.view === props\.viewPlayer\) return;/);
    const read = effect.indexOf("offsetLeft");
    expect(skip, "the same-game skip is gone").toBeGreaterThan(-1);
    expect(skip, "offsets are read before the skip").toBeLessThan(read);
  });

  it("--bar-h follows its observer instead of measuring every render", () => {
    const src = code(APP);
    const at = src.indexOf('setProperty("--bar-h"');
    expect(at).toBeGreaterThan(-1);
    const effect = src.slice(src.lastIndexOf("useLayoutEffect(", at), at);
    expect(effect).toMatch(/bar === barNodeRef\.current\) return;/);
    expect(src.slice(at - 200, at)).toMatch(/if \(h === barHRef\.current\) return;/);
  });

  it("the spotlight keeps one resize observer for the board's life", () => {
    const src = code(BOARD);
    expect((src.match(/new ResizeObserver\(/g) ?? []).length).toBe(1);
    expect(src).toMatch(/reparkRef\.current\?\.\(\)/);
  });
});
