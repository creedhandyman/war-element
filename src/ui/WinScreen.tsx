import type { CardStat, GameState, PlayerId } from "../engine";

/** MVP weighting: captures win the game, kills swing it, then raw output.
 *  `taken` counts at half — soaking damage is a real contribution, but a tank
 *  that only ever got hit should not outrank the card that did the work. */
const mvpScore = (c: CardStat) =>
  c.dmg + c.heal + c.taken * 0.5 + c.kills * 4 + c.captures * 12;
const sideName = (p: PlayerId) => (p === "P1" ? "You" : "Opponent");

/** The columns of the per-card table, in display order. */
const COLS = [
  ["dmg", "⚔", "Damage dealt"],
  ["taken", "🛡", "Damage taken"],
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

export function WinScreen(props: { game: GameState; onNewGame: () => void }) {
  const { game } = props;
  const win = game.win;
  if (!win) return null;
  const youWon = win.winner === "P1";
  const drawn = win.winner === null; // timeout with nothing to separate the sides

  const s = game.stats;
  const cards = Object.values(s.byCard);
  const ranked = cards.slice().sort((a, b) => mvpScore(b) - mvpScore(a));
  const mvp = ranked.length && mvpScore(ranked[0]) > 0 ? ranked[0] : null;

  const SideCol = ({ p }: { p: PlayerId }) => {
    const t = s.byPlayer[p];
    const roster = cards
      .filter((c) => c.owner === p)
      .sort((a, b) => mvpScore(b) - mvpScore(a));
    const bestId = roster.length && mvpScore(roster[0]) > 0 ? roster[0] : null;
    return (
      <div className={`mr-side ${win.winner === p ? "won" : ""}`}>
        <div className="mr-side-h">{sideName(p)}{win.winner === p ? " · won" : ""}</div>
        <div className="mr-row"><span>Damage dealt</span><b>{t.dmg}</b></div>
        <div className="mr-row"><span>Damage taken</span><b>{t.taken}</b></div>
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
    <div className="overlay on-top">
      <div className="modal">
        <div className={`win-title ${drawn ? "" : youWon ? "win" : "lose"}`}>
          {drawn ? "DRAW" : youWon ? "VICTORY" : "DEFEAT"}
        </div>
        <p>
          {win.by === "surrender" ? (
            <>You surrendered the match on round {game.round}.</>
          ) : drawn ? (
            <>
              Time ran out on round {game.round} with{" "}
              <b style={{ color: "var(--ink)" }}>nothing to separate you</b>.
            </>
          ) : win.by === "timeout" ? (
            <>
              Time ran out on round {game.round}.{" "}
              {win.winner === "P1" ? "You take it" : "The opponent takes it"} on{" "}
              <b style={{ color: "var(--ink)" }}>the board</b> — captures first, then cards
              standing, then HP.
            </>
          ) : (
            <>
              {win.winner === "P1" ? "You" : "The opponent"} won by{" "}
              <b style={{ color: "var(--ink)" }}>
                {win.by === "capture" ? "capturing all 4 Home slots" : "elimination"}
              </b>{" "}
              on round {game.round}.
            </>
          )}
        </p>

        {mvp && (
          <div className="mr">
            <div className="mr-h">Match Report <span className="mr-h-sub">· {game.round} rounds</span></div>
            <div className="mr-mvp">
              <span className="mr-mvp-badge">MVP</span>
              <div className="mr-mvp-body">
                <div className="mr-mvp-name">{mvp.name} <span className="mr-mvp-side">· {sideName(mvp.owner)}</span></div>
                <div className="mr-mvp-line">
                  {mvp.dmg > 0 && <span title="Damage dealt">⚔ {mvp.dmg}</span>}
                  {mvp.taken > 0 && <span title="Damage taken">🛡 {mvp.taken}</span>}
                  {mvp.heal > 0 && <span title="Healing done">✚ {mvp.heal}</span>}
                  {mvp.kills > 0 && <span title="Kills">💀 {mvp.kills}</span>}
                  {mvp.captures > 0 && <span title="Home slots captured">🚩 {mvp.captures}</span>}
                </div>
              </div>
            </div>
            <div className="mr-sides">
              <SideCol p="P1" />
              <SideCol p="P2" />
            </div>
          </div>
        )}

        <button className="lockin" onClick={props.onNewGame}>
          New Match
        </button>
      </div>
    </div>
  );
}
