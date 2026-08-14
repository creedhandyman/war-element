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
                    "--z-hud", "--z-overlay", "--z-nav", "--z-toast", "--z-modal"];
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
