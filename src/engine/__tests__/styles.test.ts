/** Guards on the stylesheet itself.
 *
 *  styles.css is 3,000 lines carrying heavy prose comments, and a comment that
 *  does not balance is close to invisible: the browser drops from the error to
 *  the next recoverable point, so a rule stops applying while the file still
 *  LOOKS right. That happened twice while landing the mobile redesign — once
 *  killing the whole sheet (every custom property resolved empty), once
 *  silently disabling two rules and leaving a popover clipped off the left edge
 *  of the screen. Neither was caught by tsc, by the engine tests, or by the
 *  Vite build, because none of them parse CSS.
 *
 *  ONE scanner does all the checks, and it skips COMMENTS BEFORE STRINGS. That
 *  order is the whole trick: this file's comments are English prose full of
 *  apostrophes ("the bar's height"), and a scanner that looks for strings first
 *  treats one as a quote, swallows everything to the next apostrophe, and
 *  miscounts whatever braces were in between. The first version of this test
 *  made exactly that mistake and reported a phantom imbalance.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Read from DISK, not through Vite.  looks
// tidier and is a trap: Vitest stubs CSS imports, so it hands back an EMPTY
// STRING and every check below passes against nothing. Three of these guards
// did exactly that, silently, until the fourth — which asserts specific values
// exist rather than that nothing is wrong — failed and gave it away.
// (Types for these two come from src/node-shims.d.ts.)
import { RARITY_STYLE } from "../../ui/shared";

const CSS = readFileSync(join(__dirname, "..", "..", "ui", "styles.css"), "utf8");
const BACKSLASH = String.fromCharCode(92);

interface Scan {
  /** Lines carrying a `*​/` that closes nothing. */
  strayCommentCloses: number[];
  /** Comment left open at EOF. */
  unclosedComment: boolean;
  /** Lines where a `}` closes nothing. */
  strayBraceCloses: number[];
  /** Blocks left open at EOF. */
  unclosedBraces: number;
  /** Every z-index declaration found in real CSS (not in a comment). */
  zIndexValues: { line: number; value: number }[];
}

function scan(src: string): Scan {
  const out: Scan = {
    strayCommentCloses: [], unclosedComment: false,
    strayBraceCloses: [], unclosedBraces: 0, zIndexValues: [],
  };
  let i = 0, line = 1, depth = 0, inComment = false, decl = "";
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; decl += " "; continue; }

    // Comments first — see the header.
    if (!inComment && src.startsWith("/*", i)) { inComment = true; i += 2; continue; }
    if (inComment) {
      if (src.startsWith("*/", i)) { inComment = false; i += 2; } else { i++; }
      continue;
    }
    if (src.startsWith("*/", i)) { out.strayCommentCloses.push(line); i += 2; continue; }

    // Strings, only once we know we are in real CSS.
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === BACKSLASH ? 2 : 1;
      i = j + 1;
      continue;
    }

    if (c === "{") { depth++; decl = ""; i++; continue; }
    if (c === "}") {
      if (depth === 0) out.strayBraceCloses.push(line);
      else depth--;
      decl = "";
      i++;
      continue;
    }
    if (c === ";") {
      const m = /z-index:\s*([0-9]+)\s*(?:!important)?\s*$/.exec(decl.trim());
      if (m) out.zIndexValues.push({ line, value: Number(m[1]) });
      decl = "";
      i++;
      continue;
    }
    decl += c;
    i++;
  }
  out.unclosedComment = inComment;
  out.unclosedBraces = depth;
  return out;
}

const S = scan(CSS);

describe("the guard is actually reading the stylesheet", () => {
  // Every check below is an assertion that something is ABSENT, and absence is
  // exactly what an empty string gives you. This one asserts presence, so the
  // suite can never again pass because it read nothing.
  it("loaded a stylesheet with real content in it", () => {
    expect(CSS.length).toBeGreaterThan(50_000);
    expect(CSS).toContain("--z-modal");
    expect(S.zIndexValues.length).toBeGreaterThan(30);
  });
});

describe("styles.css structure", () => {
  it("has no comment that closes nothing, and none left open", () => {
    expect({ strays: S.strayCommentCloses, unclosed: S.unclosedComment })
      .toEqual({ strays: [], unclosed: false });
  });

  it("has balanced braces", () => {
    // An unbalanced brace inside a @media block silently drops every rule after
    // it OUT of the query, which is how a phone-only rule reaches desktop.
    expect({ strays: S.strayBraceCloses, unclosed: S.unclosedBraces })
      .toEqual({ strays: [], unclosed: 0 });
  });

  it("keeps every cross-component z-index on the named ladder", () => {
    // The bottom nav has shipped underneath an overlay three times. A raw
    // z-index is legal only as a small sort order INSIDE a component, where it
    // cannot escape its own stacking context; anything reaching into the
    // full-screen band has to come from a --z-* variable, where the ordering is
    // written down and the gaps are too wide to squeeze a new number into.
    const raw = S.zIndexValues.filter((z) => z.value >= 100);
    expect(raw).toEqual([]);
  });

  it("declares the z-layer ladder in strictly increasing order", () => {
    const LADDER = ["--z-queue", "--z-hand", "--z-frame", "--z-drawer", "--z-sheet",
                    "--z-hud", "--z-overlay", "--z-nav", "--z-toast", "--z-guide",
                    "--z-modal"];
    const values = LADDER.map((name) => {
      const m = new RegExp(`${name}:\\s*(\\d+)`).exec(CSS);
      return { name, value: m ? Number(m[1]) : NaN };
    });
    expect(values.filter((v) => Number.isNaN(v.value))).toEqual([]);
    const ordered = values.every((v, i) => i === 0 || v.value > values[i - 1].value);
    expect({ ordered, values: values.map((v) => `${v.name}=${v.value}`) })
      .toEqual({ ordered: true, values: values.map((v) => `${v.name}=${v.value}`) });
  });
});

describe("the CSS tier and the JS that mirrors it", () => {
  it("agree on where the stacked layout starts", () => {
    // These are two literals in two files that MUST match. When they drifted —
    // the CSS widened to the grid's real minimum, the JS stayed at 760px — an
    // 853px phone got the strip from CSS and no click handler from JS, so the
    // battle log rendered as a tap target that did nothing. A comment saying
    // "mirror this exactly" did not prevent it; this does.
    const css = readFileSync(join(__dirname, "../../ui/styles.css"), "utf8");
    const app = readFileSync(join(__dirname, "../../ui/App.tsx"), "utf8");

    const fromJs = app.match(/const PORTRAIT_QUERY = "([^"]+)"/)?.[1];
    expect(fromJs, "PORTRAIT_QUERY not found in App.tsx").toBeTruthy();

    // The stacked tier is the one media block that sets --hud-budget.
    const queries = [...css.matchAll(/@media ([^{]+)\{/g)].map((m) => m[1].trim());
    // `\(*` rather than `\(`: the tier gained a grouping paren when the
    // short-and-narrow arm was added — `and ((min-height: 541px) or ...)`. The
    // finder locates the block; the assertion below is what pins its text.
    const stacked = queries.filter((q) => /max-width:\s*\d+px\)?\s+and\s+\(*min-height:\s*541px/.test(q));
    expect(stacked, "no stacked-tier @media found").toHaveLength(1);

    expect(stacked[0], `CSS tier "${stacked[0]}" vs JS "${fromJs}"`).toBe(fromJs);
  });
});

describe("the rarity palette has ONE source", () => {
  it("styles.css `--rar-*` matches RARITY_STYLE exactly", () => {
    // The TSX sets rarity colours inline from RARITY_STYLE; the CSS sets them
    // from `--rar-*`. Nothing makes those agree except this test, and before it
    // existed the sheet carried FIVE different rarity palettes — with mythic as
    // #d08bff (violet) and epic as #6aa6ff (blue) in four of them, when the
    // canonical epic IS the violet. A Mythic read as an Epic in the spell rows,
    // the shop grid and the pack chips simultaneously.
    for (const [rarity, { color }] of Object.entries(RARITY_STYLE)) {
      if (rarity === "common") continue; // not a pack/deck rarity; no token
      const m = CSS.match(new RegExp(`--rar-${rarity}:\s*([^;]+);`));
      expect(m, `styles.css has no --rar-${rarity}`).toBeTruthy();
      expect(m![1].trim().toLowerCase(), `--rar-${rarity} vs RARITY_STYLE`)
        .toBe(color.toLowerCase());
    }
  });

  it("no rule hardcodes a rarity colour instead of using the token", () => {
    // Every one of the five palettes got there by someone writing a hex next to
    // `.r-mythic` rather than reaching for the shared value. The rules may only
    // name the token.
    const offenders: string[] = [];
    for (const line of CSS.split("\n")) {
      if (!/\.r-(rare|epic|legendary|mythic)\b/.test(line)) continue;
      if (/#[0-9a-f]{3,8}\b/i.test(line) && !/--rar-/.test(line)) offenders.push(line.trim());
    }
    expect(offenders).toEqual([]);
  });
});


describe("a foil is one finish, everywhere", () => {
  const nlChar = String.fromCharCode(10);
  /** The declaration block of a rule, by selector. */
  const rule = (sel: string) => {
    // Anchored to a LINE START. A bare indexOf(".foil::after {") also matches
    // ".cd-art.foil::after {" - a different rule, three lines above, whose whole
    // body is one border-radius - and the test then reports that the foil has no
    // gradient. Any selector that ENDS with the one asked for is a false hit.
    const at = CSS.indexOf(nlChar + sel + " {");
    expect(at, `no rule for ${sel}`).toBeGreaterThan(-1);
    const open = CSS.indexOf("{", at);
    let depth = 0;
    for (let i = open; i < CSS.length; i++) {
      if (CSS[i] === "{") depth++;
      else if (CSS[i] === "}" && --depth === 0) return CSS.slice(open + 1, i);
    }
    throw new Error(`unterminated rule ${sel}`);
  };
  /** Its gradient, with comments and whitespace flattened out so only the
   *  colour stops are compared. */
  const gradient = (sel: string) => {
    const body = rule(sel).replace(/\/\*[\s\S]*?\*\//g, "");
    const at = body.indexOf("linear-gradient(");
    expect(at, `no gradient in ${sel}`).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = body.indexOf("(", at); i < body.length; i++) {
      if (body[i] === "(") depth++;
      else if (body[i] === ")" && --depth === 0)
        return body.slice(at, i + 1).replace(/\s+/g, " ").trim();
    }
    throw new Error(`unterminated gradient in ${sel}`);
  };

  it("shines the same sheen in a fight as in the collection", () => {
    // `.tk-foil` used to be a DIMMED copy of `.foil::after` - same shape, lower
    // opacities - so the same card read as two different finishes depending on
    // which screen you were looking at. They are one gradient now, and this is
    // what stops the two drifting apart again the next time either is tuned.
    expect(gradient(".tk-foil")).toBe(gradient(".foil::after"));
  });

  it("keeps the sweep in step with the tile it was derived from", () => {
    // The one-tile shift in `foilSweep` is computed from a 260% tile. A rule
    // that animates with foilSweep and sizes its tile differently does not look
    // slightly off, it snaps back mid-loop - which is the flicker the comment
    // above the keyframes exists to explain.
    for (const sel of [".foil::after", ".tk-foil"]) {
      const body = rule(sel);
      expect(body, `${sel} rides foilSweep`).toContain("foilSweep");
      expect(body, `${sel} sizes its tile to match`).toContain("260% 100%");
    }
  });
});

// An always-on animation is a battery decision, not a style one.
//
// Reported from the device as heat and lag. 22 of the sheet's 34 infinite
// animations animated `box-shadow`, which cannot be GPU-composited: every frame
// the browser repaints the element AND recomputes the blur on the main thread.
// The worst were the BOARD STATES — every movable card wears `.movable` and
// every legal destination wears `.legal`, so a dozen-plus tiles on a 5x5 board
// repainted at 60fps while the player sat still deciding.
//
// The five board cues now paint their shadow ONCE onto `.slot-glow` and animate
// only its opacity. These two tests are what stop that drifting back.
describe("board-state cues are composited, not repainted", () => {
  const NL = String.fromCharCode(10);
  /** Keyframe name -> the properties it animates. */
  const keyframes = (): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    const re = /@keyframes\s+([\w-]+)\s*\{/g;
    for (let m = re.exec(CSS); m; m = re.exec(CSS)) {
      const open = m.index + m[0].length - 1;
      let depth = 0, end = open;
      for (let i = open; i < CSS.length; i++) {
        if (CSS[i] === "{") depth++;
        else if (CSS[i] === "}" && --depth === 0) { end = i; break; }
      }
      out[m[1]] = [...new Set(
        [...CSS.slice(open, end).matchAll(/([a-zA-Z-]+)\s*:/g)].map((p) => p[1]),
      )].sort();
    }
    return out;
  };
  const GPU = new Set(["transform", "opacity", "translate", "scale", "rotate"]);

  it("no slot STATE animates the slot itself", () => {
    // The cue moved to a child layer; an `animation` back on `.slot.<state>`
    // means a shadow is being repainted again.
    for (const state of ["acting", "legal", "movable", "target", "preview"]) {
      const line = CSS.split(NL).find((l) => l.startsWith(`.slot.${state} {`));
      expect(line, `no rule for .slot.${state}`).toBeTruthy();
      expect(line, `.slot.${state} animates itself again`).not.toContain("animation:");
    }
  });

  it("the glow layer animates opacity and nothing else", () => {
    expect(keyframes().glowpulse, "glowpulse must stay compositable").toEqual(["opacity"]);
    // Every `.slot-glow` rule drives that one keyframe.
    for (const l of CSS.split(NL).filter((l) => l.includes("> .slot-glow")))
      expect(CSS.slice(CSS.indexOf(l)).slice(0, 400), l).toContain("glowpulse");
  });

  it("the set of always-on animations that force a repaint does not grow", () => {
    // A ratchet, not a ban: these are the ones that were already here, several
    // of them on rare or short-lived elements where the cost is fine. What is
    // NOT fine is adding a new one without noticing, which is how the board got
    // into this state. A new name here means: animate opacity on a layer, or
    // add it to this list deliberately.
    const kf = keyframes();
    const used = [...new Set(
      [...CSS.matchAll(/animation:\s*([\w-]+)[^;]*infinite/g)].map((m) => m[1]),
    )];
    const repaints = used
      .filter((n) => (kf[n] ?? ["?"]).some((p) => !GPU.has(p)))
      .sort();
    expect(repaints).toEqual([
      "bdrage", "blastpulse", "cardglow", "chipready", "clocknow", "foilSweep",
      "gd-pulse", "movepulse", "mvpulse", "objpulse", "passnudge", "qnext",
      "rarBreathe", "readyglow", "readyglowGold", "threatpulse", "wellpulse",
    ]);
  });
});
