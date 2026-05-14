import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Home", icon: "⛳" },
  { to: "/rounds", label: "Rounds", icon: "📋" },
  { to: "/scoreboard", label: "Cup", icon: "🏆" },
  { to: "/ledger", label: "Ledger", icon: "💰" },
  { to: "/admin", label: "Admin", icon: "⚙️" },
];

export default function Nav() {
  return (
    <nav style={s.nav}>
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} end style={({ isActive }) => ({
          ...s.link,
          ...(isActive ? s.active : {}),
        })}>
          <span style={s.icon}>{l.icon}</span>
          <span style={s.label}>{l.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

const s: Record<string, React.CSSProperties> = {
  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: "var(--nav-h)",
    background: "var(--surface)",
    borderTop: "1px solid var(--border)",
    display: "flex",
    zIndex: 100,
  },
  link: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.15rem",
    color: "var(--text-muted)",
    fontSize: "0.7rem",
    fontWeight: 600,
  },
  active: { color: "var(--green)" },
  icon: { fontSize: "1.4rem" },
  label: {},
};
