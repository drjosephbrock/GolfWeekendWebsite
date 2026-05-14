import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type RoundOut, type ScorecardResponse, type TiltPlayerResult, type MatchResult, type StrokeResult, type BestBallResult, type BetOut, type SkinsResult } from "../api";

export default function ScorecardPage() {
  const { id } = useParams<{ id: string }>();
  const roundId = Number(id);

  const [round, setRound] = useState<RoundOut | null>(null);
  const [scorecard, setScorecard] = useState<ScorecardResponse | null>(null);
  const [bets, setBets] = useState<BetOut[]>([]);
  const [skinsResults, setSkinsResults] = useState<Record<number, SkinsResult>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.rounds.get(roundId), api.rounds.scorecard(roundId), api.bets.list(roundId)])
      .then(([r, sc, bs]) => {
        setRound(r);
        setScorecard(sc);
        setBets(bs);
        const skinsBets = bs.filter((b) => b.type === "skins");
        Promise.all(skinsBets.map((b) => api.bets.skinsResult(roundId, b.id)))
          .then((results) => setSkinsResults(Object.fromEntries(results.map((r) => [r.bet_id, r]))));
      })
      .catch(() => setError("Could not load scorecard."));
  }, [roundId]);

  if (error) return <div className="page"><div className="card" style={{ color: "var(--danger)" }}>{error}</div></div>;
  if (!round || !scorecard) return <div className="page"><p style={{ color: "var(--text-muted)" }}>Loading…</p></div>;

  const nameMap = Object.fromEntries(round.participants.map((p) => [p.player_id, p.player_name]));

  return (
    <div className="page">
      <div style={{ marginBottom: "1rem" }}>
        <Link to="/rounds" style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>← Rounds</Link>
        <h1 style={s.title}>{round.label ?? round.format}</h1>
        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.25rem", alignItems: "center" }}>
          <span className={`pill ${round.is_complete ? "green" : "gold"}`}>{round.is_complete ? "Final" : "Live"}</span>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{round.holes_count} holes</span>
        </div>
      </div>

      {scorecard.format === "tilt" && <TiltView results={scorecard.results} nameMap={nameMap} />}
      {scorecard.format === "match_play" && <MatchView result={scorecard.result} nameMap={nameMap} participants={round.participants} />}
      {scorecard.format === "stroke_play" && <StrokeView result={scorecard.result} nameMap={nameMap} />}
      {scorecard.format === "best_ball" && <BestBallView result={scorecard.result} nameMap={nameMap} participants={round.participants} />}
      {(scorecard.format === "alternate_shot" || scorecard.format === "scramble") && (
        <TeamStrokeView data={scorecard as any} participants={round.participants} />
      )}

      {bets.filter((b) => b.type === "skins").map((b) => {
        const result = skinsResults[b.id];
        return result ? <SkinsView key={b.id} result={result} nameMap={nameMap} /> : null;
      })}
    </div>
  );
}

// ── TILT ─────────────────────────────────────────────────────────────────────

function TiltView({ results, nameMap }: { results: TiltPlayerResult[]; nameMap: Record<number, string> }) {
  const sorted = [...results].sort((a, b) => b.total_points - a.total_points);

  return (
    <>
      {/* Leaderboard */}
      <div className="card" style={{ marginBottom: "0.75rem" }}>
        <p className="section-title">Leaderboard</p>
        {sorted.map((r, i) => (
          <div key={r.player_id} style={s.leaderRow}>
            <span style={s.leaderPos}>{i + 1}</span>
            <span style={{ flex: 1, fontWeight: i === 0 ? 700 : 400 }}>{nameMap[r.player_id]}</span>
            <span style={{ fontWeight: 700, color: r.total_points >= 0 ? "var(--green)" : "var(--danger)" }}>
              {r.total_points} pts
            </span>
          </div>
        ))}
      </div>

      {/* Per-player hole detail */}
      {sorted.map((r) => (
        <div key={r.player_id} className="card" style={{ marginBottom: "0.75rem" }}>
          <p className="section-title">{nameMap[r.player_id]}</p>
          <div style={s.holeGrid}>
            <div style={s.gridHead}>Hole</div>
            <div style={s.gridHead}>Par</div>
            <div style={s.gridHead}>Gross</div>
            <div style={s.gridHead}>Mult</div>
            <div style={s.gridHead}>Pts</div>
            {r.holes.map((h) => (
              <>
                <div key={`n-${h.hole.number}`} style={s.gridCell}>{h.hole.number}</div>
                <div style={s.gridCell}>{h.hole.par}</div>
                <div style={{ ...s.gridCell, fontWeight: 600 }}>{h.gross || "—"}</div>
                <div style={{ ...s.gridCell, color: h.multiplier_applied > 1 ? "var(--tilt)" : "var(--text-muted)" }}>
                  {h.multiplier_applied > 1 ? `${h.multiplier_applied}×` : "—"}
                </div>
                <div style={{ ...s.gridCell, fontWeight: 700, color: h.actual_points < 0 ? "var(--danger)" : h.actual_points > 2 ? "var(--green)" : "var(--text)" }}>
                  {h.gross > 0 ? h.actual_points : "—"}
                </div>
              </>
            ))}
          </div>
          <div style={s.totalRow}>
            <span>Total</span>
            <span style={{ fontWeight: 700 }}>{r.total_points} pts</span>
          </div>
        </div>
      ))}
    </>
  );
}

// ── Match play ────────────────────────────────────────────────────────────────

function MatchView({ result, nameMap, participants }: { result: MatchResult; nameMap: Record<number, string>; participants: any[] }) {
  const teamA = participants.find((p) => p.team === "A");
  const teamB = participants.find((p) => p.team === "B");
  const nameA = teamA ? nameMap[teamA.player_id] : "A";
  const nameB = teamB ? nameMap[teamB.player_id] : "B";
  const winnerName = result.winner ? nameMap[result.winner] : null;

  return (
    <>
      <div className="card" style={{ marginBottom: "0.75rem", textAlign: "center", padding: "1.25rem" }}>
        <div style={s.matchNames}>
          <span style={{ fontWeight: result.winner === teamA?.player_id ? 800 : 400 }}>{nameA}</span>
          <span style={s.vs}>vs</span>
          <span style={{ fontWeight: result.winner === teamB?.player_id ? 800 : 400 }}>{nameB}</span>
        </div>
        <div style={s.matchStatus}>{result.status_display}</div>
        {winnerName && <div style={{ color: "var(--green)", fontWeight: 600, marginTop: "0.25rem" }}>{winnerName} wins</div>}
      </div>

      <div className="card">
        <p className="section-title">Hole by Hole</p>
        <div style={{ ...s.holeGrid, gridTemplateColumns: "auto 1fr 1fr 1fr" }}>
          <div style={s.gridHead}>Hole</div>
          <div style={s.gridHead}>{nameA}</div>
          <div style={s.gridHead}>{nameB}</div>
          <div style={s.gridHead}>Status</div>
          {result.holes.map((h) => {
            const status = h.running_status;
            return (
              <>
                <div key={`n-${h.hole.number}`} style={s.gridCell}>{h.hole.number}</div>
                <div style={{ ...s.gridCell, fontWeight: h.winner === teamA?.player_id ? 700 : 400 }}>{h.player_a_net || "—"}</div>
                <div style={{ ...s.gridCell, fontWeight: h.winner === teamB?.player_id ? 700 : 400 }}>{h.player_b_net || "—"}</div>
                <div style={{ ...s.gridCell, color: status > 0 ? "var(--green)" : status < 0 ? "var(--danger)" : "var(--text-muted)", fontSize: "0.75rem" }}>
                  {status === 0 ? "AS" : status > 0 ? `A${status}↑` : `B${Math.abs(status)}↑`}
                </div>
              </>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Stroke play ───────────────────────────────────────────────────────────────

function StrokeView({ result, nameMap }: { result: StrokeResult; nameMap: Record<number, string> }) {
  const playerIds = Object.keys(result.gross_totals).map(Number);
  const sorted = [...playerIds].sort((a, b) => result.net_totals[a] - result.net_totals[b]);

  return (
    <>
      <div className="card" style={{ marginBottom: "0.75rem" }}>
        <p className="section-title">Results</p>
        {sorted.map((pid, i) => (
          <div key={pid} style={s.leaderRow}>
            <span style={s.leaderPos}>{i + 1}</span>
            <span style={{ flex: 1 }}>{nameMap[pid]}</span>
            <span style={{ color: "var(--text-muted)", marginRight: "0.5rem", fontSize: "0.85rem" }}>
              Gross {result.gross_totals[pid]}
            </span>
            <span style={{ fontWeight: 700 }}>Net {result.net_totals[pid]}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <p className="section-title">Scorecard</p>
        <div style={{ ...s.holeGrid, gridTemplateColumns: `auto ${playerIds.map(() => "1fr").join(" ")}` }}>
          <div style={s.gridHead}>Hole</div>
          {playerIds.map((pid) => <div key={pid} style={s.gridHead}>{nameMap[pid]}</div>)}
          {result.holes.map((h) => (
            <>
              <div key={`n-${h.hole.number}`} style={s.gridCell}>{h.hole.number}</div>
              {playerIds.map((pid) => (
                <div key={pid} style={s.gridCell}>{h.scores[pid] ?? "—"}</div>
              ))}
            </>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Best-ball ─────────────────────────────────────────────────────────────────

function BestBallView({ result, nameMap, participants }: { result: BestBallResult; nameMap: Record<number, string>; participants: any[] }) {
  const teamAPlayers = participants.filter((p) => p.team === "A").map((p) => nameMap[p.player_id]).join(" / ");
  const teamBPlayers = participants.filter((p) => p.team === "B").map((p) => nameMap[p.player_id]).join(" / ");

  return (
    <>
      <div className="card" style={{ marginBottom: "0.75rem", textAlign: "center", padding: "1.25rem" }}>
        <div style={s.matchNames}>
          <div>
            <div style={{ fontWeight: result.team_a_points > result.team_b_points ? 800 : 400 }}>Team A</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{teamAPlayers}</div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--green-dark)" }}>
            {result.team_a_points} – {result.team_b_points}
          </div>
          <div>
            <div style={{ fontWeight: result.team_b_points > result.team_a_points ? 800 : 400 }}>Team B</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{teamBPlayers}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="section-title">Hole by Hole</p>
        <div style={{ ...s.holeGrid, gridTemplateColumns: "auto 1fr 1fr 1fr" }}>
          <div style={s.gridHead}>Hole</div>
          <div style={s.gridHead}>A best</div>
          <div style={s.gridHead}>B best</div>
          <div style={s.gridHead}>Win</div>
          {result.holes.map((h) => (
            <>
              <div key={`n-${h.hole.number}`} style={s.gridCell}>{h.hole.number}</div>
              <div style={{ ...s.gridCell, fontWeight: h.winner === "A" ? 700 : 400 }}>{h.team_a_best || "—"}</div>
              <div style={{ ...s.gridCell, fontWeight: h.winner === "B" ? 700 : 400 }}>{h.team_b_best || "—"}</div>
              <div style={{ ...s.gridCell, color: h.winner === "A" ? "var(--green)" : h.winner === "B" ? "var(--danger)" : "var(--text-muted)" }}>
                {h.winner ?? "½"}
              </div>
            </>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Alternate shot / Scramble ─────────────────────────────────────────────────

function TeamStrokeView({ data, participants }: { data: any; participants: any[] }) {
  const teamAPlayers = participants.filter((p) => p.team === "A");
  const teamBPlayers = participants.filter((p) => p.team === "B");

  return (
    <div className="card">
      <div style={s.matchNames}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700 }}>Team A</div>
          <div style={{ fontSize: "2rem", fontWeight: 800 }}>{data.team_a?.gross_total ?? "—"}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {fmtVsPar(data.team_a?.vs_par ?? 0)}
          </div>
        </div>
        <div style={s.vs}>vs</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700 }}>Team B</div>
          <div style={{ fontSize: "2rem", fontWeight: 800 }}>{data.team_b?.gross_total ?? "—"}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {fmtVsPar(data.team_b?.vs_par ?? 0)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Skins ─────────────────────────────────────────────────────────────────────

function SkinsView({ result, nameMap }: { result: SkinsResult; nameMap: Record<number, string> }) {
  const playerIds = result.participant_ids;
  const totalHoles = result.holes.length;
  const skinsWon = result.holes.filter((h) => !h.carried_over).length;
  const carried = result.holes.filter((h) => h.carried_over).length;

  const winnersByDollars = [...playerIds]
    .map((pid) => ({ pid, name: nameMap[pid] ?? `Player ${pid}`, dollars: result.winnings[String(pid)] ?? 0 }))
    .sort((a, b) => b.dollars - a.dollars);

  return (
    <div className="card" style={{ marginTop: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <p className="section-title" style={{ margin: 0 }}>💰 Skins — ${result.dollars_per_skin}/skin</p>
        {result.is_partial && <span className="pill gold" style={{ fontSize: "0.68rem" }}>Live</span>}
      </div>

      {/* Winnings summary */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.75rem" }}>
        {winnersByDollars.map(({ pid, name, dollars }) => (
          <div key={pid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: dollars > 0 ? 700 : 400, fontSize: "0.88rem" }}>{name}</span>
            <span style={{ fontWeight: 700, color: dollars > 0 ? "var(--green)" : "var(--text-muted)", fontSize: "0.88rem" }}>
              {dollars > 0 ? `+$${dollars}` : "—"}
            </span>
          </div>
        ))}
        {totalHoles > 0 && (
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem", borderTop: "1px solid var(--border)", paddingTop: "0.25rem" }}>
            {skinsWon} skin{skinsWon !== 1 ? "s" : ""} won · {carried} carried · {totalHoles} holes scored
          </div>
        )}
      </div>

      {/* Hole-by-hole */}
      {result.holes.length > 0 && (
        <div style={{ ...s.holeGrid, gridTemplateColumns: `auto auto ${playerIds.map(() => "1fr").join(" ")} auto` }}>
          <div style={s.gridHead}>H</div>
          <div style={s.gridHead}>Par</div>
          {playerIds.map((pid) => <div key={pid} style={s.gridHead}>{(nameMap[pid] ?? "?").split(" ")[0]}</div>)}
          <div style={s.gridHead}>Pot</div>
          {result.holes.map((h) => (
            <>
              <div key={`n-${h.hole_number}`} style={s.gridCell}>{h.hole_number}</div>
              <div style={s.gridCell}>{h.par}</div>
              {playerIds.map((pid) => {
                const gross = h.gross_scores[String(pid)];
                const isWinner = h.skin_winner_id === pid;
                return (
                  <div key={pid} style={{
                    ...s.gridCell,
                    fontWeight: isWinner ? 800 : 400,
                    background: isWinner ? "#d1fae5" : h.carried_over ? "#fef9c3" : "var(--surface)",
                    color: isWinner ? "var(--green-dark)" : "var(--text)",
                  }}>
                    {gross ?? "—"}
                  </div>
                );
              })}
              <div style={{ ...s.gridCell, fontSize: "0.72rem", fontWeight: 600, color: h.carried_over ? "#92400e" : "var(--text-muted)" }}>
                ${h.pot_value}{h.carried_over ? "↑" : ""}
              </div>
            </>
          ))}
        </div>
      )}

      {result.holes.length === 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "0.5rem 0" }}>
          No scores entered yet.
        </p>
      )}
    </div>
  );
}

function fmtVsPar(n: number) {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : String(n);
}

const s: Record<string, React.CSSProperties> = {
  title: { fontSize: "1.4rem", fontWeight: 800, color: "var(--green-dark)", marginTop: "0.25rem" },
  leaderRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.5rem 0",
    borderBottom: "1px solid var(--border)",
  },
  leaderPos: { fontWeight: 700, color: "var(--text-muted)", width: "1.25rem" },
  holeGrid: {
    display: "grid",
    gridTemplateColumns: "auto 1fr 1fr 1fr 1fr",
    gap: "1px",
    background: "var(--border)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    overflow: "hidden",
    fontSize: "0.82rem",
  },
  gridHead: {
    background: "var(--bg)",
    padding: "0.4rem 0.5rem",
    fontWeight: 700,
    textAlign: "center",
    fontSize: "0.7rem",
    color: "var(--text-muted)",
  },
  gridCell: {
    background: "var(--surface)",
    padding: "0.45rem 0.5rem",
    textAlign: "center",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: "0.5rem",
    marginTop: "0.5rem",
    borderTop: "1px solid var(--border)",
    fontWeight: 600,
  },
  matchNames: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    gap: "1rem",
    fontSize: "1rem",
  },
  vs: { color: "var(--text-muted)", fontWeight: 400, fontSize: "0.85rem" },
  matchStatus: { fontSize: "1.6rem", fontWeight: 800, color: "var(--green-dark)", marginTop: "0.5rem" },
};
