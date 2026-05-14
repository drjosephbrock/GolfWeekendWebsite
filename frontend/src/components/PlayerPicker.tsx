import { useState, useEffect } from "react";
import { api, fmtHdcp, type Player } from "../api";

const STORAGE_KEY = "golf_player";

interface Props {
  onSelect: (player: Player) => void;
}

export default function PlayerPicker({ onSelect }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.players.list()
      .then((ps) => setPlayers(ps.filter((p) => p.is_active)))
      .catch(() => setError("Could not load players. Is the server running?"))
      .finally(() => setLoading(false));
  }, []);

  function pick(player: Player) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
    onSelect(player);
  }

  if (loading) return <div style={styles.center}>Loading players...</div>;
  if (error) return <div style={styles.center}>{error}</div>;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>⛳</div>
        <h1 style={styles.title}>Golf Weekend</h1>
        <p style={styles.sub}>Who are you?</p>
        <div style={styles.grid}>
          {players.map((p) => (
            <button key={p.id} style={styles.btn} onClick={() => pick(p)}>
              <span style={styles.btnName}>{p.name}</span>
              <span style={styles.btnHdcp}>HCP {fmtHdcp(p.handicap)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function loadStoredPlayer(): Player | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
    background: "linear-gradient(160deg, var(--green-dark), var(--green))",
  },
  card: {
    background: "var(--surface)",
    borderRadius: "1rem",
    padding: "2rem 1.5rem",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
    textAlign: "center",
  },
  logo: { fontSize: "3rem", marginBottom: "0.5rem" },
  title: { fontSize: "1.75rem", fontWeight: 700, color: "var(--green-dark)" },
  sub: { color: "var(--text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.6rem",
  },
  btn: {
    background: "var(--bg)",
    border: "2px solid var(--border)",
    borderRadius: "0.6rem",
    padding: "0.75rem 0.5rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.2rem",
    transition: "border-color 0.15s, background 0.15s",
  },
  btnName: { fontWeight: 600, fontSize: "0.95rem" },
  btnHdcp: { fontSize: "0.75rem", color: "var(--text-muted)" },
};
