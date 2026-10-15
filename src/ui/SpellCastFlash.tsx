import { useState } from "react";
import { getSpell } from "../engine";
import { EL_SIGIL, spellArtSrc } from "./shared";

/** Full-screen cast animation. When the human casts a spell, App holds the
 *  intent, mounts this for ~2s (the art flashes up big + glows in the element
 *  color), then dispatches CAST_SPELL so the effect resolves. Art is optional —
 *  spells without art show an element sigil on a tinted card instead.
 *
 *  `ms`: how long it will be up, when that is not the usual 2s (a sprung
 *  trap's). Its animation is timed to it, so it has faded out by the time it
 *  is taken down instead of vanishing while the screen is still dark. */
export function SpellCastFlash({ spellId, ms }: { spellId: string; ms?: number }) {
  const spell = getSpell(spellId);
  const [artOk, setArtOk] = useState(true);
  return (
    <div className="castflash" data-el={spell.element} style={ms ? { ["--flash" as string]: `${ms}ms` } : undefined}>
      <div className="castflash-burst" />
      {/* A round medallion, to match the spell art (painted for a circle):
          the picture in an element ring, a slow rune ring around it, the cost
          as a gem on the rim, and the name on a plaque hung beneath. */}
      <div className="castflash-card">
        <div className="castflash-medal">
          <span className="castflash-runes" aria-hidden="true" />
          {artOk ? (
            <img
              className="castflash-art"
              src={spellArtSrc(spellId)}
              alt={spell.name}
              draggable={false}
              onError={() => setArtOk(false)}
            />
          ) : (
            <div className="castflash-art castflash-noart">
              <span>{EL_SIGIL[spell.element]}</span>
            </div>
          )}
          <div className="castflash-cost">{spell.cost}</div>
        </div>
        <div className="castflash-meta">
          <div className="castflash-name">{spell.name}</div>
          <div className="castflash-text">{spell.text}</div>
        </div>
      </div>
    </div>
  );
}
