import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, type Scoreboard, type RyderSession, type RyderMatch } from "../api";

const TEAM_A_COLOR = "#1b6b3a";
const TEAM_B_COLOR = "#7c3aed";

export default function ScoreboardPage() {
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setRefreshing(true);
    api.rydercup.scoreboard()
      .then(setBoard)
      .catch(() => setError("Could not load scoreboard."))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return (
    <div className="page">
      <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
        <p style={{ color: "var(--text-muted)" }}>{error}</p>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
          No Ryder Cup rounds have been created yet.
        </p>
      </div>
    </div>
  );

  if (!board) return <div className="page"><p style={{ color: "var(--text-muted)" }}>Loading…</p></div>;

  const { team_a_total: a, team_b_total: b, points_available, sessions } = board;
  const toWin = Math.ceil(points_available / 2 + 0.5);
  const aWins = a >= toWin;
  const bWins = b >= toWin;
  const tied = a === b;
  const allDone = sessions.every((s) => s.matches.every((m) => m.is_complete));

  return (
    <div className="page">
      {/* Hero score */}
      <div style={s.hero}>
        <TeamScore name="Team A" points={a} color={TEAM_A_COLOR} winner={aWins} />
        <div style={s.heroCenter}>
          <div style={s.heroVs}>RYDER CUP</div>
          <div style={s.heroRemaining}>
            {allDone
              ? aWins ? "Team A wins!" : bWins ? "Team B wins!" : "Tied"
              : `${points_available - a - b} pts left`}
          </div>
        </div>
        <TeamScore name="Team B" points={b} color={TEAM_B_COLOR} winner={bWins} flip />
      </div>

      {/* To-win bar */}
      {!allDone && (
        <div style={s.toWinBar}>
          <span style={{ color: TEAM_A_COLOR, fontWeight: 700 }}>
            {a >= toWin ? "✓ Clinched" : `Need ${(toWin - a).toFixed(1)} more`}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
            {toWin} to win
          </span>
          <span style={{ color: TEAM_B_COLOR, fontWeight: 700 }}>
            {b >= toWin ? "✓ Clinched" : `Need ${(toWin - b).toFixed(1)} more`}
          </span>
        </div>
      )}

      {/* Progress bar */}
      <ProgressBar a={a} b={b} total={points_available} />

      {/* Refresh */}
      <button
        className="btn btn-ghost btn-full"
        style={{ marginBottom: "0.75rem", fontSize: "0.85rem" }}
        onClick={load}
        disabled={refreshing}
      >
        {refreshing ? "Refreshing…" : "↻ Refresh"}
      </button>

      {/* Sessions */}
      {sessions.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
          No matches recorded yet.
        </div>
      ) : (
        sessions.map((session) => (
          <SessionCard key={session.format} session={session} />
        ))
      )}
    </div>
  );
}

function TeamScore({ name, points, color, winner, flip }: { name: string; points: number; color: string; winner: boolean; flip?: boolean }) {
  return (
    <div style={{ textAlign: flip ? "right" : "left", flex: 1 }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {name}
      </div>
      <div style={{ fontSize: "3rem", fontWeight: 900, color, lineHeight: 1, marginTop: "0.1rem" }}>
        {points % 1 === 0 ? points.toFixed(0) : points.toFixed(1)}
      </div>
      {winner && <div style={{ fontSize: "0.8rem", color, fontWeight: 700 }}>🏆 Wins</div>}
    </div>
  );
}

function ProgressBar({ a, b, total }: { a: number; b: number; total: number }) {
  const aW = total > 0 ? (a / total) * 100 : 0;
  const bW = total > 0 ? (b / total) * 100 : 0;
  const midW = 100 - aW - bW;

  return (
    <div style={s.bar}>
      <div style={{ ...s.barSegment, width: `${aW}%`, background: TEAM_A_COLOR }} />
      <div style={{ ...s.barSegment, width: `${midW}%`, background: "var(--border)" }} />
      <div style={{ ...s.barSegment, width: `${bW}%`, background: TEAM_B_COLOR }} />
    </div>
  );
}

function SessionCard({ session }: { session: RyderSession }) {
  const [expanded, setExpanded] = useState(true);
  const ap = session.team_a_points;
  const bp = session.team_b_points;
  const total = session.matches.length;
  const done = session.matches.filter((m) => m.is_complete).length;

  return (
    <div className="card" style={s.sessionCard}>
      <button style={s.sessionHeader} onClick={() => setExpanded((x) => !x)}>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontWeight: 800, fontSize: "1rem" }}>{session.label}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{done}/{total} complete</div>
        </div>
        <div style={s.sessionScore}>
          <span style={{ color: TEAM_A_COLOR, fontWeight: 800 }}>
            {ap % 1 === 0 ? ap : ap.toFixed(1)}
          </span>
          <span style={{ color: "var(--text-muted)", margin: "0 0.3rem" }}>–</span>
          <span style={{ color: TEAM_B_COLOR, fontWeight: 800 }}>
            {bp % 1 === 0 ? bp : bp.toFixed(1)}
          </span>
        </div>
        <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem" }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", marginTop: "0.6rem", paddingTop: "0.6rem" }}>
          {session.matches.map((match) => (
            <MatchRow key={match.round_id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchRow({ match }: { match: RyderMatch }) {
  const ap = match.team_a_points;
  const bp = match.team_b_points;
  const aWins = ap > bp;
  const bWins = bp > ap;
  const halved = match.is_complete && ap === bp;

  return (
    <div style={s.matchRow}>
      {/* Team A players */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: aWins ? 700 : 400,
          color: aWins ? TEAM_A_COLOR : "var(--text)",
          fontSize: "0.85rem",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {match.team_a_players.join(" / ") || "TBD"}
        </div>
        <div style={{
          fontWeight: bWins ? 700 : 400,
          color: bWins ? TEAM_B_COLOR : "var(--text)",
          fontSize: "0.85rem",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {match.team_b_players.join(" / ") || "TBD"}
        </div>
      </div>

      {/* Result */}
      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "0.5rem" }}>
        {match.is_complete ? (
          <div>
            <PointsBadge pts={ap} color={TEAM_A_COLOR} />
            <PointsBadge pts={bp} color={TEAM_B_COLOR} />
          </div>
        ) : (
          <span className="pill gold" style={{ fontSize: "0.7rem" }}>Live</span>
        )}
        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
          {match.status_display}
        </div>
      </div>

      {/* Scorecard link */}
      <Link
        to={`/rounds/${match.round_id}/scorecard`}
        style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginLeft: "0.5rem", flexShrink: 0 }}
      >
        →
      </Link>
    </div>
  );
}

function PointsBadge({ pts, color }: { pts: number; color: string }) {
  if (pts === 0) return null;
  return (
    <span style={{
      display: "inline-block",
      background: color,
      color: "#fff",
      borderRadius: "4px",
      padding: "0.05rem 0.35rem",
      fontSize: "0.72rem",
      fontWeight: 700,
      marginLeft: "0.25rem",
    }}>
      {pts === 0.5 ? "½" : pts}
    </span>
  );
}

const s: Record<string, React.CSSProperties> = {
  hero: {
    background: "var(--green-dark)",
    borderRadius: "var(--radius)",
    padding: "1.25rem 1.25rem 1rem",
    display: "flex",
    alignItems: "center",
    marginBottom: "0.75rem",
    color: "#fff",
  },
  heroCenter: { textAlign: "center", flexShrink: 0, padding: "0 0.75rem" },
  heroVs: { fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.15em", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" },
  heroRemaining: { fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.85)", marginTop: "0.2rem" },
  toWinBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "var(--surface)",
    borderRadius: "0.5rem",
    padding: "0.5rem 0.75rem",
    marginBottom: "0.5rem",
    fontSize: "0.8rem",
  },
  bar: {
    display: "flex",
    height: "6px",
    borderRadius: "999px",
    overflow: "hidden",
    marginBottom: "0.75rem",
    background: "var(--border)",
  },
  barSegment: { height: "100%", transition: "width 0.5s ease" },
  sessionCard: { marginBottom: "0.75rem", padding: "0.85rem 1rem" },
  sessionHeader: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    background: "none",
    cursor: "pointer",
  },
  sessionScore: { display: "flex", alignItems: "center", fontSize: "1.1rem" },
  matchRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.4rem",
    padding: "0.5rem 0",
    borderBottom: "1px solid var(--border)",
  },
};
