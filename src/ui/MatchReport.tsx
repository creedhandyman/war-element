import { seatsOf } from "../engine";
import type { CardStat, GameState, PlayerId } from "../engine";

/** The end-of-match stat summary: an MVP, per-side totals, and a line for every
 *  card that took the field. Lives on its own so BOTH endings can use it — the
 *  normal WinScreen and Story Mode's recruitment card, win or lose. A story
 *  fight is where the deck gets tested, so it is the one place the numbers are
 *  worth the most.
 *
 *  MVP weighting: captures win the game, kills swing it, then raw output.
 *  `taken` and `shielded` count at half — absorbing damage is a real
 *  contribution, but a tank that only ever got hit should not outrank the card
 *  that did the work. Shielded counts too, or an armour card's whole job stays
 *  invisible to the award. */
export const mvpScore = (c: CardStat) =>
  c.dmg + c.heal + (c.taken + c.shielded) * 0.5 + c.kills * 4 + c.captures * 12;

/** Viewer-relative. `me` defaults to P1, which is right for vs-AI and a fair
 *  convention in hot-seat — but online the guest sits in P2, and this used to
 *  label their own cards "Opponent" and vice versa. */
const sideName = (p: PlayerId, me: PlayerId) => (p === me ? "You" : "Opponent");

/** The columns of the per-card table, in display order. */
const COLS = [
  ["dmg", "⚔", "Damage dealt"],
  ["taken", "💥", "Damage taken"],
  ["shielded", "🛡", "Damage its shields absorbed"],
  ["heal", "✚", "Healing done"],
  ["healRecv", "♥", "Healing received"],
  ["kills", "💀", "Kills"],
  ["deaths", "☠", "Times downed"],
  ["debuffs", "🌀", "Statuses suffered"],
  ["captures", "🚩", "Home slots captured"],
] as const;

/** One card's line in the roster table. Zeroes render as a dim dash so the eye
 *  runs down the columns that actually have numbers in them. */
function CardRow({ c, best }: { c: CardStat; best: boolean }) {
  return (
    <div className={`mr-cr ${best ? "top" : ""}`}>
      <span className="mr-cr-name">{c.name}</span>
      {COLS.map(([k, , label]) => (
        <span key={k} className={`mr-cr-v ${c[k] ? "" : "nil"}`} title={label}>
          {c[k] || "·"}
        </span>
      ))}
    </div>
  );
}

/** Whether there is anything worth reporting — a match that ended before a
 *  single point of damage has no report. Lets a caller decide whether to render
 *  a "show report" affordance at all, since <MatchReport> itself renders null. */
export const hasMatchReport = (game: GameState): boolean =>
  Object.values(game.stats.byCard).some((c) => mvpScore(c) > 0);

/** Returns null when nothing measurable happened. */
export function MatchReport({ game, heading, me = "P1" }: { game: GameState; heading?: string; me?: PlayerId }) {
  const s = game.stats;
  const cards = Object.values(s.byCard);
  const ranked = cards.slice().sort((a, b) => mvpScore(b) - mvpScore(a));
  const mvp = ranked.length && mvpScore(ranked[0]) > 0 ? ranked[0] : null;
  if (!mvp) return null;

  const SideCol = ({ p }: { p: PlayerId }) => {
    const t = s.byPlayer[p];
    const roster = cards.filter((c) => c.owner === p).sort((a, b) => mvpScore(b) - mvpScore(a));
    const bestId = roster.length && mvpScore(roster[0]) > 0 ? roster[0] : null;
    return (
      <div className={`mr-side ${game.win?.winner === p ? "won" : ""}`}>
        <div className="mr-side-h">{sideName(p, me)}{game.win?.winner === p ? " · won" : ""}</div>
        <div className="mr-row"><span>Damage dealt</span><b>{t.dmg}</b></div>
        <div className="mr-row"><span>Damage taken</span><b>{t.taken}</b></div>
        <div className="mr-row"><span>Shields absorbed</span><b>{t.shielded}</b></div>
        <div className="mr-row"><span>Healing done</span><b>{t.heal}</b></div>
        <div className="mr-row"><span>Kills · losses</span><b>{t.kills} · {t.deaths}</b></div>
        <div className="mr-row"><span>Statuses suffered</span><b>{t.debuffs}</b></div>
        <div className="mr-row"><span>Captures</span><b>{t.captures}</b></div>
        {roster.length > 0 && (
          <div className="mr-roster">
            <div className="mr-cr head">
              <span className="mr-cr-name">Card</span>
              {COLS.map(([k, icon, label]) => (
                <span key={k} className="mr-cr-v" title={label}>{icon}</span>
              ))}
            </div>
            {roster.map((c, i) => (
              <CardRow key={`${c.name}-${i}`} c={c} best={c === bestId} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mr">
      <div className="mr-h">
        {heading ?? "Match Report"} <span className="mr-h-sub">· {game.round} rounds</span>
      </div>
      <div className="mr-mvp">
        <span className="mr-mvp-badge">MVP</span>
        <div className="mr-mvp-body">
          <div className="mr-mvp-name">
            {mvp.name} <span className="mr-mvp-side">· {sideName(mvp.owner, me)}</span>
          </div>
          <div className="mr-mvp-line">
            {mvp.dmg > 0 && <span title="Damage dealt">⚔ {mvp.dmg}</span>}
            {mvp.taken > 0 && <span title="Damage taken">💥 {mvp.taken}</span>}
            {mvp.shielded > 0 && <span title="Damage its shields absorbed">🛡 {mvp.shielded}</span>}
            {mvp.heal > 0 && <span title="Healing done">✚ {mvp.heal}</span>}
            {mvp.kills > 0 && <span title="Kills">💀 {mvp.kills}</span>}
            {mvp.captures > 0 && <span title="Home slots captured">🚩 {mvp.captures}</span>}
          </div>
        </div>
      </div>
      <div className="mr-sides">
        {/* Every seat. Two literal columns meant a 3-4 player report dropped
            P3 and P4 entirely - and when one of them won, `win.winner === p`
            was false for both columns rendered, so the report showed two losers
            and marked no winner at all. */}
        {seatsOf(game).map((p) => <SideCol key={p} p={p} />)}
      </div>
    </div>
  );
}
