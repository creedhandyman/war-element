import { useState } from "react";
import { getDef } from "../engine";
import { EL_COLOR, EL_SIGIL, RARITY_STYLE } from "./shared";

/** Rarities that get an entrance. Anything below legendary lands quietly —
 *  announcing every summon would turn the fanfare into noise. */
export const ANNOUNCE_RARITIES = new Set(["legendary", "mythic"]);

/** Should summoning this card be announced? */
export function announces(defId: string): boolean {
  const def = getDef(defId);
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
      style={{
        ["--el" as string]: EL_COLOR[def.element],
        ["--rar" as string]: rar?.color ?? EL_COLOR[def.element],
      }}
    >
      <div className="announce-burst" />
      <div className="announce-card">
        <div className="announce-rar">{rar?.label ?? "POWERFUL"}</div>
        {artOk ? (
          <img
            className="announce-art"
            src={`/cards/${def.art ?? def.id}.png`}
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
            <span>⚔ {def.hits > 1 ? `${def.hits}×${def.dmg}` : def.dmg}</span>
            <span>♥ {def.hp}</span>
            {def.shields > 0 && <span>🛡 {def.shields}</span>}
            <span>⚡ {def.sp}</span>
          </div>
        </div>
      </div>
      <div className="announce-who">{mine ? "You summon" : "Your opponent summons"}</div>
    </div>
  );
}
