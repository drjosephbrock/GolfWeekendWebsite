import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Player, type RoundOut } from "../api";

const TEAM_COLORS: Record<string, string> = { A: "#1b6b3a", B: "#7c3aed" };

const FORMAT_LABELS: Record<string, string> = {
  stroke_play: "Stroke Play",
  best_ball: "Best Ball",
  alternate_shot: "Alternate Shot",
  scramble: "Scramble",
  match_play: "Match Play",
  tilt: "TILT",
};

interface Props { currentPlayer: Player }

interface BioEdit {
  nickname: string;
  hometown: string;
  fun_fact: string;
}

export default function PlayerProfilePage({ currentPlayer }: Props) {
  const { id } = useParams<{ id: string }>();
  const playerId = Number(id);
  const isOwn = currentPlayer.id === playerId;

  const [player, setPlayer] = useState<Player | null>(null);
  const [rounds, setRounds] = useState<RoundOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState<BioEdit>({ nickname: "", hometown: "", fun_fact: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.players.get(playerId), api.rounds.list()])
      .then(([p, r]) => {
        setPlayer(p);
        setRounds(r.filter((round) => round.participants.some((pt) => pt.player_id === playerId)));
      })
      .catch(() => setError("Player not found."));
  }, [playerId]);

  function startEdit() {
    if (!player) return;
    setBio({
      nickname: player.nickname ?? "",
      hometown: player.hometown ?? "",
      fun_fact: player.fun_fact ?? "",
    });
    setSaveError(null);
    setEditing(true);
  }

  async function saveBio() {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.players.updateBio(playerId, {
        nickname: bio.nickname.trim() || null,
        hometown: bio.hometown.trim() || null,
        fun_fact: bio.fun_fact.trim() || null,
      });
      setPlayer(updated);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (error) return (
    <div className="page">
      <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--danger)" }}>{error}</div>
    </div>
  );
  if (!player) return <div className="page"><p style={{ color: "var(--text-muted)" }}>Loading…</p></div>;

  const completedRounds = rounds.filter((r) => r.is_complete);
  const activeRounds = rounds.filter((r) => !r.is_complete);
  const teamColor = player.team ? TEAM_COLORS[player.team] : undefined;

  return (
    <div className="page">
      <Link to="/" style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>← Home</Link>

      {/* Profile header */}
      <div className="card" style={s.profileCard}>
        <div style={s.avatar}>
          {(player.nickname ?? player.name).charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={s.playerName}>{player.name}</div>
          {player.nickname && <div style={s.nickname}>"{player.nickname}"</div>}
          <div style={s.pills}>
            <span style={s.hdcpPill}>HCP {player.handicap}</span>
            {player.team && (
              <span style={{ ...s.teamPill, background: teamColor, color: "#fff" }}>
                Team {player.team}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bio section */}
      {editing ? (
        <div className="card" style={{ marginBottom: "0.75rem" }}>
          <div style={s.editTitle}>Edit Your Bio</div>

          <label style={s.fieldLabel}>Nickname</label>
          <input
            className="input"
            style={s.input}
            placeholder="What do they call you?"
            value={bio.nickname}
            onChange={(e) => setBio({ ...bio, nickname: e.target.value })}
          />

          <label style={s.fieldLabel}>Hometown</label>
          <input
            className="input"
            style={s.input}
            placeholder="Where are you from?"
            value={bio.hometown}
            onChange={(e) => setBio({ ...bio, hometown: e.target.value })}
          />

          <label style={s.fieldLabel}>Fun Fact</label>
          <textarea
            className="input"
            style={{ ...s.input, height: "4rem", resize: "vertical" }}
            placeholder="Something the group should know about you…"
            value={bio.fun_fact}
            onChange={(e) => setBio({ ...bio, fun_fact: e.target.value })}
          />

          {saveError && <p style={{ color: "var(--danger)", fontSize: "0.8rem", margin: "0.25rem 0 0" }}>{saveError}</p>}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveBio} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {(player.hometown || player.fun_fact) && (
            <div className="card" style={{ marginBottom: "0.75rem" }}>
              {player.hometown && (
                <div style={s.bioRow}>
                  <span style={s.bioIcon}>📍</span>
                  <span style={s.bioText}>{player.hometown}</span>
                </div>
              )}
              {player.fun_fact && (
                <div style={{ ...s.bioRow, marginTop: player.hometown ? "0.6rem" : 0 }}>
                  <span style={s.bioIcon}>💬</span>
                  <span style={s.bioText}>{player.fun_fact}</span>
                </div>
              )}
            </div>
          )}

          {isOwn && (
            <button
              className="btn btn-ghost"
              style={{ width: "100%", marginBottom: "0.75rem", fontSize: "0.85rem" }}
              onClick={startEdit}
            >
              {player.hometown || player.fun_fact || player.nickname ? "✏️ Edit Bio" : "✏️ Add Bio / Nickname"}
            </button>
          )}
        </>
      )}

      {/* Active rounds */}
      {activeRounds.length > 0 && (
        <>
          <p className="section-title">Active Rounds</p>
          {activeRounds.map((r) => <RoundRow key={r.id} round={r} playerId={playerId} />)}
        </>
      )}

      {/* Completed rounds */}
      {completedRounds.length > 0 && (
        <>
          <p className="section-title" style={{ marginTop: activeRounds.length > 0 ? "1rem" : 0 }}>
            Round History
          </p>
          {completedRounds.map((r) => <RoundRow key={r.id} round={r} playerId={playerId} />)}
        </>
      )}

      {rounds.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
          No rounds yet.
        </div>
      )}
    </div>
  );
}

function RoundRow({ round, playerId }: { round: RoundOut; playerId: number }) {
  const fmt = FORMAT_LABELS[round.format] ?? round.format;
  const date = new Date(round.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const participant = round.participants.find((p) => p.player_id === playerId);

  return (
    <div className="card" style={s.roundRow}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>{round.label ?? fmt}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {fmt} · {round.holes_count}H · {date}
          {participant?.team ? ` · Team ${participant.team}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexShrink: 0 }}>
        <span className={`pill ${round.is_complete ? "green" : "gold"}`} style={{ fontSize: "0.68rem" }}>
          {round.is_complete ? "Final" : "Live"}
        </span>
        <Link to={`/rounds/${round.id}/scorecard`} className="btn btn-ghost" style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem" }}>
          Card
        </Link>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  profileCard: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    marginTop: "0.75rem",
    marginBottom: "0.75rem",
  },
  avatar: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    background: "var(--green)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.6rem",
    fontWeight: 800,
    flexShrink: 0,
  },
  playerName: { fontSize: "1.3rem", fontWeight: 800, color: "var(--green-dark)" },
  nickname: { fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic", marginTop: "0.1rem" },
  pills: { display: "flex", gap: "0.4rem", marginTop: "0.4rem", flexWrap: "wrap" },
  hdcpPill: {
    background: "var(--green)",
    color: "#fff",
    fontSize: "0.72rem",
    fontWeight: 700,
    padding: "0.2rem 0.6rem",
    borderRadius: "999px",
  },
  teamPill: {
    fontSize: "0.72rem",
    fontWeight: 700,
    padding: "0.2rem 0.6rem",
    borderRadius: "999px",
  },
  editTitle: { fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.75rem", color: "var(--green-dark)" },
  fieldLabel: { display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.25rem", marginTop: "0.5rem" },
  input: { width: "100%", boxSizing: "border-box" as const },
  bioRow: { display: "flex", gap: "0.6rem", alignItems: "flex-start" },
  bioIcon: { fontSize: "1rem", flexShrink: 0, marginTop: "0.05rem" },
  bioText: { fontSize: "0.88rem", lineHeight: 1.5, color: "var(--text)" },
  roundRow: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" },
};
