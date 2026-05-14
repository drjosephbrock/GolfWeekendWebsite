import { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import PlayerPicker, { loadStoredPlayer } from "./components/PlayerPicker";
import Nav from "./components/Nav";
import HomePage from "./pages/HomePage";
import RoundsPage from "./pages/RoundsPage";
import ScoreEntryPage from "./pages/ScoreEntryPage";
import ScorecardPage from "./pages/ScorecardPage";
import LedgerPage from "./pages/LedgerPage";
import AdminPage from "./pages/AdminPage";
import ScoreboardPage from "./pages/ScoreboardPage";
import InfoPage from "./pages/InfoPage";
import PlayerProfilePage from "./pages/PlayerProfilePage";
import type { Player } from "./api";

export default function App() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [checking, setChecking] = useState(true);
  const location = useLocation();

  useEffect(() => {
    setPlayer(loadStoredPlayer());
    setChecking(false);
  }, []);

  if (checking) return null;

  if (!player) {
    if (location.pathname === "/admin") return <AdminPage />;
    return <PlayerPicker onSelect={setPlayer} />;
  }

  return (
    <>
      <header style={s.header}>
        <span style={s.logo}>⛳</span>
        <span style={s.name}>{player.name}</span>
        <button
          style={s.switchBtn}
          onClick={() => { localStorage.removeItem("golf_player"); setPlayer(null); }}
        >
          Switch
        </button>
      </header>

      <Routes>
        <Route path="/" element={<HomePage player={player} />} />
        <Route path="/rounds" element={<RoundsPage />} />
        <Route path="/rounds/:id/score" element={<ScoreEntryPage player={player} />} />
        <Route path="/rounds/:id/scorecard" element={<ScorecardPage />} />
        <Route path="/ledger" element={<LedgerPage player={player} />} />
        <Route path="/scoreboard" element={<ScoreboardPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/info" element={<InfoPage />} />
        <Route path="/players/:id" element={<PlayerProfilePage currentPlayer={player} />} />
      </Routes>

      <Nav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: {
    background: "var(--green-dark)",
    color: "#fff",
    padding: "0.75rem 1.25rem",
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    position: "sticky",
    top: 0,
    zIndex: 99,
  },
  logo: { fontSize: "1.25rem" },
  name: { fontWeight: 700, flex: 1, fontSize: "1rem" },
  switchBtn: {
    background: "rgba(255,255,255,0.15)",
    color: "#fff",
    borderRadius: "0.4rem",
    padding: "0.3rem 0.75rem",
    fontSize: "0.8rem",
  },
};
