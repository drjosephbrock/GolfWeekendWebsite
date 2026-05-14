import { useState } from "react";

type Tab = "itinerary" | "formats";

export default function InfoPage() {
  const [tab, setTab] = useState<Tab>("itinerary");

  return (
    <div className="page">
      <h1 style={s.title}>Weekend Info</h1>

      <div style={s.tabs}>
        <button style={{ ...s.tab, ...(tab === "itinerary" ? s.tabActive : {}) }} onClick={() => setTab("itinerary")}>
          Itinerary
        </button>
        <button style={{ ...s.tab, ...(tab === "formats" ? s.tabActive : {}) }} onClick={() => setTab("formats")}>
          Formats & Rules
        </button>
      </div>

      {tab === "itinerary" && <ItineraryTab />}
      {tab === "formats" && <FormatsTab />}
    </div>
  );
}

// ── Itinerary ─────────────────────────────────────────────────────────────────

const SCHEDULE = [
  {
    day: "Friday",
    events: [
      {
        time: "Morning",
        icon: "🌅",
        title: "Warm-Up Round",
        detail: "9-hole stroke play — shake off the rust. Optional bets in play.",
      },
      {
        time: "Afternoon",
        icon: "⛳",
        title: "Full Round",
        detail: "18-hole stroke play — the real thing. Optional bets in play.",
      },
      {
        time: "Evening",
        icon: "🍺",
        title: "Team Draft",
        detail: "Two teams of 8 are picked. Your Ryder Cup fate is sealed.",
      },
    ],
  },
  {
    day: "Saturday",
    events: [
      {
        time: "Session 1",
        icon: "🤝",
        title: "Alternate Shot",
        detail: "One ball, two players, alternating shots. No handicap. 1 point per match.",
      },
      {
        time: "Session 2",
        icon: "🌀",
        title: "Scramble",
        detail: "Both hit, pick the best, repeat. No handicap. 1 point per match.",
      },
      {
        time: "Session 3",
        icon: "🎯",
        title: "Best Ball",
        detail: "Each player plays their own ball — best net score counts. Handicap applies. 1 point per match.",
      },
      {
        time: "Session 4",
        icon: "⚔️",
        title: "Singles — Match Play",
        detail: "1v1 head-to-head, hole by hole. Handicap applies. 2 points per group (1 per singles match).",
      },
      {
        time: "Evening",
        icon: "🏆",
        title: "Cup Ceremony",
        detail: "20 total points available. First to 10.5 wins. Settle up.",
      },
    ],
  },
  {
    day: "Sunday",
    events: [
      {
        time: "All day",
        icon: "😎",
        title: "Casual Round(s)",
        detail: "Individual or group setup. Optional bets — whatever the group agrees on.",
      },
    ],
  },
];

function ItineraryTab() {
  return (
    <>
      {SCHEDULE.map((section) => (
        <div key={section.day} style={{ marginBottom: "1.25rem" }}>
          <p className="section-title">{section.day}</p>
          {section.events.map((ev) => (
            <div key={ev.title} className="card" style={s.eventCard}>
              <div style={s.eventIcon}>{ev.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={s.eventTime}>{ev.time}</div>
                <div style={s.eventTitle}>{ev.title}</div>
                <div style={s.eventDetail}>{ev.detail}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

// ── Format rules ──────────────────────────────────────────────────────────────

const FORMATS = [
  {
    name: "Stroke Play",
    icon: "📝",
    color: "#1b6b3a",
    summary: "Count every stroke. Lowest total net score wins.",
    rules: [
      "Each player plays their own ball for the entire round.",
      "Gross score = actual strokes taken.",
      "Net score = gross − course handicap strokes (max handicap 24).",
      "Handicap strokes are applied hole-by-hole based on each hole's hdcp index.",
      "Lowest net total wins.",
    ],
  },
  {
    name: "Best Ball (4-Ball)",
    icon: "🎯",
    color: "#0891b2",
    summary: "Each player plays their own ball. Best net score on each hole counts for the team.",
    rules: [
      "2v2 team format.",
      "All four players play their own ball on every hole.",
      "Each team uses the better (lower) net score of their two players per hole.",
      "Team with more holes won takes the match. Halved holes count as ½ each.",
      "Handicap applies (max 24) — strokes allocated by hole hdcp index.",
    ],
  },
  {
    name: "Alternate Shot",
    icon: "🔄",
    color: "#7c3aed",
    summary: "One ball. You and your partner take turns hitting it.",
    rules: [
      "2v2 team format.",
      "Each team plays a single ball, alternating shots.",
      "One player tees off on odd holes, the other on even holes.",
      "No handicap — raw strokes only.",
      "Lowest gross total wins the match.",
    ],
  },
  {
    name: "Scramble",
    icon: "🌀",
    color: "#d97706",
    summary: "Both players hit every shot. Pick the best one. Repeat.",
    rules: [
      "2v2 team format.",
      "Both players tee off on every hole.",
      "The team selects the best drive and both play from that spot.",
      "Continue selecting the best shot until holed out.",
      "No handicap — raw strokes only.",
      "Lowest gross total wins the match.",
    ],
  },
  {
    name: "Match Play",
    icon: "⚔️",
    color: "#dc2626",
    summary: "1v1. Win holes, not strokes. Go X up or fall X down.",
    rules: [
      "Head-to-head, one player vs. one player.",
      "Each hole is worth one point: win it, lose it, or halve it.",
      "Player with the lower net score wins the hole.",
      "Match ends when one player leads by more holes than remain (e.g., 3&2 = 3 up with 2 to play).",
      "If all 18 are played and it's tied: All Square.",
      "Handicap applies (max 24). Strokes allocated by hole hdcp index.",
    ],
  },
  {
    name: "TILT (Modified Stableford)",
    icon: "🔥",
    color: "#b45309",
    summary: "Points per hole based on your net score — with a multiplier if you're on fire.",
    rules: [
      "Each hole earns base points based on net score vs. par:",
      "  Albatross +3 = 16 pts · Eagle −2 = 8 pts · Birdie −1 = 4 pts",
      "  Par = 2 pts · Bogey = 0 pts · Double bogey or worse = −4 pts",
      "TILT mechanic — your multiplier starts at 1×:",
      "  Net birdie → you go ON TILT. Multiplier increases by +1 (min 2×).",
      "  Additional consecutive net birdies → multiplier stacks (+1× each).",
      "  Net par → you go OFF TILT. Multiplier resets to 1×.",
      "  Any other result (bogey, eagle, etc.) → multiplier unchanged.",
      "Points earned on any hole = base points × your current multiplier.",
      "Highest total points wins.",
    ],
  },
];

function FormatsTab() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      {FORMATS.map((f) => {
        const open = expanded === f.name;
        return (
          <div key={f.name} className="card" style={{ ...s.fmtCard, borderLeft: `4px solid ${f.color}` }}>
            <button style={s.fmtHeader} onClick={() => setExpanded(open ? null : f.name)}>
              <span style={s.fmtIcon}>{f.icon}</span>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{f.name}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>{f.summary}</div>
              </div>
              <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
            </button>

            {open && (
              <div style={s.fmtRules}>
                {f.rules.map((r, i) => (
                  <div key={i} style={s.ruleRow}>
                    {r.startsWith("  ") ? (
                      <span style={{ ...s.ruleText, paddingLeft: "0.75rem", color: "var(--text-muted)" }}>{r.trim()}</span>
                    ) : (
                      <>
                        <span style={s.ruleBullet}>•</span>
                        <span style={s.ruleText}>{r}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  title: { fontSize: "1.4rem", fontWeight: 800, color: "var(--green-dark)", marginBottom: "0.75rem" },
  tabs: { display: "flex", background: "var(--surface)", borderRadius: "0.6rem", padding: "0.2rem", marginBottom: "0.75rem", gap: "0.2rem" },
  tab: { flex: 1, padding: "0.5rem", borderRadius: "0.4rem", fontWeight: 600, fontSize: "0.85rem", color: "var(--text-muted)", background: "transparent" },
  tabActive: { background: "var(--green)", color: "#fff" },
  eventCard: { display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.5rem" },
  eventIcon: { fontSize: "1.4rem", flexShrink: 0, width: "2rem", textAlign: "center", marginTop: "0.05rem" },
  eventTime: { fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" },
  eventTitle: { fontWeight: 700, fontSize: "0.95rem", marginTop: "0.1rem" },
  eventDetail: { fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem", lineHeight: 1.45 },
  fmtCard: { marginBottom: "0.6rem", padding: "0" },
  fmtHeader: { display: "flex", alignItems: "center", gap: "0.75rem", width: "100%", background: "none", cursor: "pointer", padding: "0.85rem 1rem", textAlign: "left" },
  fmtIcon: { fontSize: "1.3rem", flexShrink: 0 },
  fmtRules: { borderTop: "1px solid var(--border)", padding: "0.75rem 1rem 0.85rem", display: "flex", flexDirection: "column", gap: "0.35rem" },
  ruleRow: { display: "flex", gap: "0.5rem", alignItems: "flex-start" },
  ruleBullet: { color: "var(--green)", fontWeight: 700, flexShrink: 0, marginTop: "0.05rem" },
  ruleText: { fontSize: "0.83rem", color: "var(--text)", lineHeight: 1.5 },
};
