// BATTLE CHAT - the wire pass.
//
// Chat is the only thing in this game where one player's raw input reaches
// another player's screen, and the room is joinable by anyone with the code.
// So the interesting cases are not "does a message arrive" but what a peer can
// put on the wire: a chat line is DATA, and `sanitizeChat` is where that is
// enforced. It runs on RECEIPT, not only on send - the sender's cap is a
// courtesy and the receiver's is the rule.
//
// The other half of the design is tested by its absence: none of this touches
// GameState. Chat rides its own broadcast event, so a message cannot advance
// the Lamport clock or re-enter the state machine, and no test here needs a
// game at all.
//
// Control characters are built with String.fromCharCode rather than written as
// escapes. An earlier cut of this file wrote them as literals and the escaping
// did not survive being written to disk: the test then asserted against text
// that was not what it appeared to be, and failed against correct code.
import { describe, expect, it } from "vitest";
import { CHAT_MAX, sanitizeChat } from "../../net/online";

const NUL = String.fromCharCode(0);
const BEL = String.fromCharCode(7);
const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const ESC = String.fromCharCode(27);
const DEL = String.fromCharCode(127);

const ok = { id: "abc", seat: "P2", name: "Frostkeep", text: "good luck", at: 1700 };

describe("sanitizeChat", () => {
  it("passes a well-formed line through unchanged", () => {
    expect(sanitizeChat(ok)).toEqual(ok);
  });

  it("refuses anything that is not a message", () => {
    for (const junk of [null, undefined, 42, "hello", [], true])
      expect(sanitizeChat(junk), String(junk)).toBeNull();
  });

  it("refuses a seat that is not a seat", () => {
    // The seat drives the name shown and the colour it is drawn in, so an
    // unknown one would render as an undefined suit rather than as a player.
    for (const seat of ["P5", "", "p1", 1, null, "__proto__"])
      expect(sanitizeChat({ ...ok, seat }), String(seat)).toBeNull();
  });

  it("drops an empty or whitespace-only line", () => {
    for (const text of ["", "   ", LF + LF, TAB, 7, null, undefined])
      expect(sanitizeChat({ ...ok, text }), JSON.stringify(text)).toBeNull();
  });

  it("caps the text, however long it arrives", () => {
    const out = sanitizeChat({ ...ok, text: "x".repeat(CHAT_MAX * 40) });
    expect(out!.text).toHaveLength(CHAT_MAX);
  });

  it("caps the NAME too - it is the other string a peer controls", () => {
    const out = sanitizeChat({ ...ok, name: "n".repeat(500) });
    expect(out!.name!.length).toBeLessThanOrEqual(24);
  });

  it("collapses newlines and control characters to spaces", () => {
    // One message is one line. A pasted thousand line breaks is a way to shove
    // everyone else's chat off the top of the panel - cheaper to prevent than
    // to scroll back through.
    const out = sanitizeChat({ ...ok, text: "a" + LF + LF + LF + "b" + BEL + "c" + ESC + "d" + DEL });
    expect(out!.text).toBe("a b c d");
  });

  it("keeps a line made only of control characters out entirely", () => {
    expect(sanitizeChat({ ...ok, text: NUL + BEL + LF + TAB })).toBeNull();
  });

  it("invents an id when one is missing, so dedupe still has a key", () => {
    const out = sanitizeChat({ seat: "P3", text: "hi" });
    expect(out!.id).toBeTruthy();
    expect(typeof out!.id).toBe("string");
  });

  it("bounds an absurd id rather than storing it as a React key", () => {
    expect(sanitizeChat({ ...ok, id: "i".repeat(9000) })!.id.length).toBeLessThanOrEqual(48);
  });

  it("does not trust a non-numeric timestamp", () => {
    // `at` only orders the display, but NaN sorts unpredictably and Infinity
    // would pin a line to one end of the log forever.
    for (const at of ["soon", NaN, Infinity, null, {}])
      expect(Number.isFinite(sanitizeChat({ ...ok, at })!.at), String(at)).toBe(true);
  });

  it("leaves the text otherwise alone - it is escaped at render, not here", () => {
    // Deliberately NOT stripped: React interpolates chat as text, so angle
    // brackets are characters rather than markup. Mangling them here would only
    // mean a player cannot type "<3" or "a > b".
    const rich = "<b>a > b</b> & <3";
    expect(sanitizeChat({ ...ok, text: rich })!.text).toBe(rich);
  });
});
