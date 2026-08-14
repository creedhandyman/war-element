import { useState } from "react";
import { getDef } from "../engine";
import { CARDS, TOKENS } from "../data/cards";
import { EL_COLOR, EL_SIGIL, RARITY_STYLE } from "./shared";
import { SpIcon } from "./icons";

/** Rarities that get an entrance. Anything below legendary lands quietly —
 *  announcing every summon would turn the fanfare into noise. */
export const ANNOUNCE_RARITIES = new Set(["legendary", "mythic"]);

/** Every id that some card wears as a face. Built once from the data rather
 *  than listed, so a second disguised card inherits this for free. */
const DISGUISE_FACES = new Set(
  [...CARDS, ...TOKENS]
    .map((d) => d.disguise?.as)
    .filter((id): id is string => !!id),
);

/** Should summoning this card be announced?
 *
 *  A disguise is silent in BOTH directions, which is the whole point of it:
 *  announcing the true form names a card that is not what lands, and announcing
 *  the face gives a full-screen legendary entrance to something that is meant to
 *  look like furniture. Nightfang arrives as the Butler; nobody should be able
 *  to tell from the fanfare. */
export function announces(defId: string): boolean {
  const def = getDef(defId);
  if (def.disguise || DISGUISE_FACES.has(defId)) return false;
  return def.rarity != null && ANNOUNCE_RARITIES.has(def.rarity);
}

/** Full-screen announcement for a powerful creature arriving. Mirrors
 *  SpellCastFlash: App holds the SUMMON intent, mounts this for ~2s so the art
 *  gets its moment, then dispatches so the card actually lands. The opponent's
 *  legendaries are detected on arrival instead (their summons resolve outside
 *  our dispatch), so for those it reads as an entrance rather than a preview.
 *
 *  Art is optional — a card without a .png shows its element sigil, the same
 *  fallback the spell flash uses. */
export function SummonAnnounce({ defId, mine }: { defId: string; mine: boolean }) {
  const def = getDef(defId);
  const [artOk, setArtOk] = useState(true);
  const rar = def.rarity ? RARITY_STYLE[def.rarity] : null;
  return (
    <div
      className="announce"
      data-el={def.element}
      style={{ ["--rar" as string]: rar?.color ?? EL_COLOR[def.element] }}
    >
      <div className="announce-burst" />
      {/* Badge sits ABOVE the card rather than on the art. It has to live
          outside .announce-card to do that at all — the card clips its children
          (overflow: hidden), so no amount of offset would lift it clear. The
          entrance animation moved up to .announce-stack so the two still scale
          in as one piece. */}
      <div className="announce-stack">
        <div className="announce-rar">{rar?.label ?? "POWERFUL"}</div>
        <div className="announce-card">
          {artOk ? (
            <img
              className="announce-art"
              src={`/cards/${def.art ?? def.id}.webp`}
              alt={def.name}
              draggable={false}
              onError={() => setArtOk(false)}
            />
          ) : (
            <div className="announce-art announce-noart">
              <span>{EL_SIGIL[def.element]}</span>
            </div>
          )}
          <div className="announce-meta">
            <div className="announce-name">{def.name}</div>
            <div className="announce-sub">
              {def.element} · {def.cardClass} · {def.attackType}
            </div>
            <div className="announce-stats">
              <span className="s-dmg">⚔ <span className="atk-dmg">{def.dmg}</span>{def.hits > 1 ? <span className="atk-x"> ×{def.hits}</span> : ""}</span>
              <span className="s-hp">♥ {def.hp}</span>
              {def.shields > 0 && <span>🛡 {def.shields}</span>}
              <span className="s-sp"><SpIcon /> {def.sp}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="announce-who">{mine ? "You summon" : "Your opponent summons"}</div>
    </div>
  );
}
