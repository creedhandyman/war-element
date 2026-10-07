// THE EDGE FACE — the pieces every card face shares with the board token
// (owner's pick, 2026-10-07): the element hairline, the name that shrinks to
// fit, and the glyphed numerals. The look itself lives in styles.css under
// "THE EDGE FACE"; these only supply the markup it needs.
import type { ReactNode } from "react";

/** A name the Edge frame cannot shrink onto one line — "Thunderfangs,
 *  Stormform" would need 5px type — goes on two, split at the space nearest
 *  the middle. Short names, and one-word names, stay whole. */
export function splitName(name: string): string[] {
  if (name.length <= 13 || !name.includes(" ")) return [name];
  let best = -1;
  for (let i = 0; i < name.length; i++) {
    if (name[i] === " " && (best < 0 || Math.abs(i - name.length / 2) < Math.abs(best - name.length / 2))) best = i;
  }
  return [name.slice(0, best), name.slice(best + 1)];
}

/** The element hairline. Goes right after the card's art. */
export function EdgeRim() {
  return <span className="ef-rim" aria-hidden="true" />;
}

/** The card's name. `--nl` (its longest line) is what lets the CSS size it to
 *  the card's width instead of cutting it off. */
export function EdgeName(props: { name: string; className: string }) {
  const lines = splitName(props.name);
  return (
    <div
      className={`${props.className} ef-name${lines.length > 1 ? " two" : ""}`}
      style={{ ["--nl" as string]: Math.max(...lines.map((l) => l.length)) }}
    >
      {lines.join("\n")}
    </div>
  );
}

/** Damage (×hits), HP and speed, each behind its tiny glyph — the board
 *  token's row. `children` trail the numbers (an in-deck tick, say). */
export function EdgeStats(props: {
  dmg: number; hits: number; hp: number; sp: number;
  className: string; children?: ReactNode;
}) {
  return (
    <div className={`${props.className} ef-stats`}>
      <span className="st-dmg" title={`Damage${props.hits > 1 ? ` ×${props.hits} hits` : ""}`}>
        {props.dmg}{props.hits > 1 && <span className="atk-x">×{props.hits}</span>}
      </span>
      <span className="st-hp" title="HP">{props.hp}</span>
      <span className="st-sp" title="Speed">{props.sp}</span>
      {props.children}
    </div>
  );
}
