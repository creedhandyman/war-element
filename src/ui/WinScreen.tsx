import type { CardStat, GameState, PlayerId } from "../engine";

/** MVP weighting: captures win the game, kills swing it, then raw dmg/heal. */
const mvpScore = (c: CardStat) => c.dmg + c.heal + c.kills * 4 + c.captures * 12;
const sideName = (p: PlayerId) => (p === "P1" ? "You" : "Opponent");

export function WinScreen(props: { game: GameState; onNewGame: () => void }) {
  const { game } = props;
  const win = game.win;
  if (!win) return null;
  const youWon = win.winner === "P1";

  const s = game.stats;
  const cards = Object.values(s.byCard);
  const ranked = cards.slice().sort((a, b) => mvpScore(b) - mvpScore(a));
  const mvp = ranked.length && mvpScore(ranked[0]) > 0 ? ranked[0] : null;
  const topBy = (p: PlayerId, key: "dmg" | "heal") =>
    cards.filter((c) => c.owner === p && c[key] > 0).sort((a, b) => b[key] - a[key])[0] ?? null;

  const SideCol = ({ p }: { p: PlayerId }) => {
    const t = s.byPlayer[p];
    const td = topBy(p, "dmg");
    const th = topBy(p, "heal");
    return (
      <div className={`mr-side ${win.winner === p ? "won" : ""}`}>
        <div className="mr-side-h">{sideName(p)}{win.winner === p ? " · won" : ""}</div>
        <div className="mr-row"><span>Damage</span><b>{t.dmg}</b></div>
        <div className="mr-row"><span>Healing</span><b>{t.heal}</b></div>
        <div className="mr-row"><span>Kills</span><b>{t.kills}</b></div>
        <div className="mr-row"><span>Captures</span><b>{t.captures}</b></div>
        {td && <div className="mr-top" title="Top damage">⚔ {td.name} <span>{td.dmg}</span></div>}
        {th && <div className="mr-top" title="Top healer">✚ {th.name} <span>{th.heal}</span></div>}
      </div>
    );
  };

  return (
    <div className="overlay on-top">
      <div className="modal">
        <div className={`win-title ${youWon ? "win" : "lose"}`}>
          {youWon ? "VICTORY" : "DEFEAT"}
        </div>
        <p>
          {win.by === "surrender" ? (
            <>You surrendered the match on round {game.round}.</>
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
            <div className="mr-h">Match Report</div>
            <div className="mr-mvp">
              <span className="mr-mvp-badge">MVP</span>
              <div className="mr-mvp-body">
                <div className="mr-mvp-name">{mvp.name} <span className="mr-mvp-side">· {sideName(mvp.owner)}</span></div>
                <div className="mr-mvp-line">
                  {mvp.dmg > 0 && <span>⚔ {mvp.dmg}</span>}
                  {mvp.heal > 0 && <span>✚ {mvp.heal}</span>}
                  {mvp.kills > 0 && <span>💀 {mvp.kills}</span>}
                  {mvp.captures > 0 && <span>🚩 {mvp.captures}</span>}
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
