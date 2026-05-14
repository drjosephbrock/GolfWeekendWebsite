import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type RoundOut } from "../api";

const FORMAT_LABELS: Record<string, string> = {
  stroke_play: "Stroke Play",
  best_ball: "Best Ball",
  alternate_shot: "Alternate Shot",
  scramble: "Scramble",
  match_play: "Match Play",
  tilt: "TILT",
};

export default function RoundsPage() {
  const [rounds, setRounds] = useState<RoundOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.rounds.list().then(setRounds).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <h1 style={s.title}>All Rounds</h1>

      {loading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}

      {!loading && rounds.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
          No rounds yet. Ask your admin to create one.
        </div>
      )}

      {rounds.map((r) => {
        const fmt = FORMAT_LABELS[r.format] ?? r.format;
        const date = new Date(r.date).toLocaleDateString(undefined, {
          weekday: "short", month: "short", day: "numeric",
        });
        return (
          <div key={r.id} className="card" style={s.row}>
            <div style={s.info}>
              <div style={s.label}>{r.label ?? fmt}</div>
              <div style={s.meta}>{fmt} · {r.holes_count}H · {date}</div>
              <div style={{ marginTop: "0.3rem" }}>
                <span className={`pill ${r.is_complete ? "green" : "gold"}`}>
                  {r.is_complete ? "Complete" : "In Progress"}
                </span>
              </div>
              <div style={s.players}>
                {r.participants.map((p) => (
                  <span key={p.player_id} style={s.playerTag}>
                    {p.player_name}{p.team ? ` (${p.team})` : ""}
                  </span>
                ))}
              </div>
            </div>
            <div style={s.actions}>
              {!r.is_complete && (
                <Link to={`/rounds/${r.id}/score`} className="btn btn-primary btn-full" style={s.actionBtn}>
                  Score
                </Link>
              )}
              <Link to={`/rounds/${r.id}/scorecard`} className="btn btn-ghost btn-full" style={s.actionBtn}>
                Scorecard
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  title: { fontSize: "1.4rem", fontWeight: 800, marginBottom: "1rem", color: "var(--green-dark)" },
  row: { display: "flex", gap: "0.75rem", alignItems: "flex-start" },
  info: { flex: 1, minWidth: 0 },
  label: { fontWeight: 700 },
  meta: { fontSize: "0.78rem", color: "var(--text-muted)" },
  players: { display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.4rem" },
  playerTag: {
    fontSize: "0.7rem",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    padding: "0.1rem 0.4rem",
  },
  actions: { display: "flex", flexDirection: "column", gap: "0.3rem", flexShrink: 0, minWidth: "72px" },
  actionBtn: { fontSize: "0.8rem", padding: "0.45rem 0.5rem" },
};
