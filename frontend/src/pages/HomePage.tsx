import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type RoundOut, type Player } from "../api";

interface Props { player: Player }

const FORMAT_LABELS: Record<string, string> = {
  stroke_play: "Stroke Play",
  best_ball: "Best Ball",
  alternate_shot: "Alternate Shot",
  scramble: "Scramble",
  match_play: "Match Play",
  tilt: "TILT",
};

export default function HomePage({ player }: Props) {
  const [rounds, setRounds] = useState<RoundOut[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    api.rounds.list().then(setRounds).catch(() => {});
    api.players.list().then((ps) => setPlayers(ps.filter((p) => p.is_active))).catch(() => {});
  }, []);

  const myRounds = rounds.filter((r) =>
    r.participants.some((p) => p.player_id === player.id)
  );
  const activeRounds = myRounds.filter((r) => !r.is_complete);
  const recentRounds = myRounds.filter((r) => r.is_complete).slice(0, 3);

  return (
    <div className="page">
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.greeting}>Good round,</div>
          <div style={s.name}>{player.name}</div>
          {player.nickname && <div style={s.nickname}>"{player.nickname}"</div>}
        </div>
        <Link to={`/players/${player.id}`} style={s.hdcp}>HCP {player.handicap}</Link>
      </div>

      {/* Active rounds */}
      {activeRounds.length > 0 && (
        <>
          <p className="section-title">Active Rounds</p>
          {activeRounds.map((r) => (
            <RoundCard key={r.id} round={r} playerId={player.id} />
          ))}
        </>
      )}

      {activeRounds.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>⛳</div>
          <p style={{ color: "var(--text-muted)" }}>No active rounds.</p>
        </div>
      )}

      {recentRounds.length > 0 && (
        <>
          <p className="section-title" style={{ marginTop: "1.25rem" }}>Recent</p>
          {recentRounds.map((r) => (
            <RoundCard key={r.id} round={r} playerId={player.id} />
          ))}
        </>
      )}

      {/* Quick links */}
      <p className="section-title" style={{ marginTop: "1.25rem" }}>Weekend</p>
      <div style={s.quickLinks}>
        <Link to="/info" style={s.quickCard}>
          <span style={s.quickIcon}>📅</span>
          <span style={s.quickLabel}>Itinerary</span>
        </Link>
        <Link to="/info" style={s.quickCard}>
          <span style={s.quickIcon}>📖</span>
          <span style={s.quickLabel}>Format Rules</span>
        </Link>
        <Link to="/scoreboard" style={s.quickCard}>
          <span style={s.quickIcon}>🏆</span>
          <span style={s.quickLabel}>Ryder Cup</span>
        </Link>
      </div>

      {/* Players grid */}
      {players.length > 0 && (
        <>
          <p className="section-title" style={{ marginTop: "1.25rem" }}>Players</p>
          <div style={s.playerGrid}>
            {players.map((p) => (
              <Link key={p.id} to={`/players/${p.id}`} style={{
                ...s.playerCard,
                borderTop: p.team ? `3px solid ${p.team === "A" ? "#1b6b3a" : "#7c3aed"}` : "3px solid var(--border)",
                opacity: p.id === player.id ? 1 : 0.92,
              }}>
                <div style={s.playerAvatar}>
                  {(p.nickname ?? p.name).charAt(0).toUpperCase()}
                </div>
                <div style={s.playerCardName}>{p.name}</div>
                {p.nickname && <div style={s.playerCardNick}>"{p.nickname}"</div>}
                <div style={s.playerCardHdcp}>HCP {p.handicap}</div>
                {p.team && (
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: p.team === "A" ? "#1b6b3a" : "#7c3aed", marginTop: "0.15rem" }}>
                    Team {p.team}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RoundCard({ round, playerId }: { round: RoundOut; playerId: number }) {
  const fmt = FORMAT_LABELS[round.format] ?? round.format;
  const date = new Date(round.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="card" style={s.roundCard}>
      <div style={s.roundInfo}>
        <div style={s.roundLabel}>{round.label ?? fmt}</div>
        <div style={s.roundMeta}>{fmt} · {round.holes_count} holes · {date}</div>
        <div style={{ marginTop: "0.35rem" }}>
          <span className={`pill ${round.is_complete ? "green" : "gold"}`}>
            {round.is_complete ? "Complete" : "In Progress"}
          </span>
        </div>
      </div>
      <div style={s.roundActions}>
        {!round.is_complete && (
          <Link to={`/rounds/${round.id}/score`} className="btn btn-primary" style={{ fontSize: "0.85rem", padding: "0.5rem 0.9rem" }}>
            Score
          </Link>
        )}
        <Link to={`/rounds/${round.id}/scorecard`} className="btn btn-ghost" style={{ fontSize: "0.85rem", padding: "0.5rem 0.9rem" }}>
          Card
        </Link>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1.25rem",
    paddingTop: "0.5rem",
  },
  greeting: { fontSize: "0.9rem", color: "var(--text-muted)" },
  name: { fontSize: "1.6rem", fontWeight: 800, color: "var(--green-dark)", lineHeight: 1.1 },
  nickname: { fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic", marginTop: "0.1rem" },
  hdcp: {
    background: "var(--green)",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.85rem",
    padding: "0.3rem 0.75rem",
    borderRadius: "999px",
    flexShrink: 0,
    textDecoration: "none",
  },
  roundCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
  },
  roundInfo: { flex: 1, minWidth: 0 },
  roundLabel: { fontWeight: 700, fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  roundMeta: { fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.1rem" },
  roundActions: { display: "flex", gap: "0.4rem", flexShrink: 0 },
  quickLinks: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "0.5rem",
    marginBottom: "0.25rem",
  },
  quickCard: {
    background: "var(--surface)",
    border: "1.5px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "0.75rem 0.5rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.35rem",
    textDecoration: "none",
  },
  quickIcon: { fontSize: "1.5rem" },
  quickLabel: { fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textAlign: "center" },
  playerGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.5rem",
  },
  playerCard: {
    background: "var(--surface)",
    border: "1.5px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "0.75rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textDecoration: "none",
    color: "var(--text)",
  },
  playerAvatar: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "var(--green)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.1rem",
    fontWeight: 800,
    marginBottom: "0.4rem",
  },
  playerCardName: { fontWeight: 700, fontSize: "0.88rem", textAlign: "center" },
  playerCardNick: { fontSize: "0.72rem", color: "var(--text-muted)", fontStyle: "italic", textAlign: "center" },
  playerCardHdcp: { fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.1rem" },
};
