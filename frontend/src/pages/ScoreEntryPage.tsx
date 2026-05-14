import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, type RoundOut, type CourseOut, type HoleOut } from "../api";
import type { Player } from "../api";

interface Props { player: Player }

export default function ScoreEntryPage({ player }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const roundId = Number(id);

  const [round, setRound] = useState<RoundOut | null>(null);
  const [course, setCourse] = useState<CourseOut | null>(null);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.rounds.get(roundId).then((r) => {
      setRound(r);
      return api.courses.get(r.course_id);
    }).then(setCourse).catch(() => setError("Could not load round."));
  }, [roundId]);

  const isParticipant = round?.participants.some((p) => p.player_id === player.id) ?? false;

  const holes = course?.holes.slice(0, round?.holes_count ?? 18) ?? [];

  const adjust = useCallback((holeNum: number, delta: number) => {
    setScores((prev) => {
      const hole = holes.find((h) => h.number === holeNum)!;
      const current = prev[holeNum] ?? hole.par;
      return { ...prev, [holeNum]: Math.max(1, current + delta) };
    });
    setSaved(false);
  }, [holes]);

  const setValue = useCallback((holeNum: number, val: string) => {
    const n = parseInt(val);
    if (!isNaN(n) && n >= 1) {
      setScores((prev) => ({ ...prev, [holeNum]: n }));
      setSaved(false);
    }
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = holes
        .filter((h) => scores[h.number] !== undefined)
        .map((h) => ({ hole_number: h.number, gross: scores[h.number] }));
      await api.rounds.submitScores(roundId, player.id, payload);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <div className="page"><div className="card" style={{ color: "var(--danger)" }}>{error}</div></div>;
  if (!round || !course) return <div className="page"><p style={{ color: "var(--text-muted)" }}>Loading…</p></div>;
  if (!isParticipant) return (
    <div className="page">
      <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
        <p>You are not a participant in this round.</p>
        <Link to="/rounds" className="btn btn-ghost" style={{ marginTop: "1rem" }}>Back</Link>
      </div>
    </div>
  );

  const enteredCount = holes.filter((h) => scores[h.number] !== undefined).length;
  const totalGross = holes.reduce((sum, h) => sum + (scores[h.number] ?? 0), 0);
  const totalPar = holes.reduce((sum, h) => sum + h.par, 0);
  const vsPar = totalGross - totalPar;

  return (
    <div className="page">
      <div style={s.header}>
        <Link to="/rounds" style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>← Rounds</Link>
        <h1 style={s.title}>{round.label ?? round.format}</h1>
        <p style={s.sub}>{course.name} · {round.holes_count} holes</p>
      </div>

      {/* Summary bar */}
      <div className="card" style={s.summaryBar}>
        <Stat label="Entered" value={`${enteredCount}/${holes.length}`} />
        <Stat label="Gross" value={enteredCount > 0 ? String(totalGross) : "—"} />
        <Stat label="vs Par" value={enteredCount > 0 ? fmtVsPar(vsPar) : "—"} highlight={enteredCount > 0} vs={vsPar} />
      </div>

      {/* Hole list */}
      <div style={s.holeList}>
        {holes.map((hole) => (
          <HoleRow
            key={hole.number}
            hole={hole}
            value={scores[hole.number] ?? null}
            onAdjust={(d) => adjust(hole.number, d)}
            onChange={(v) => setValue(hole.number, v)}
          />
        ))}
      </div>

      {/* Save button */}
      <div style={s.footer}>
        {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{error}</p>}
        <button
          className="btn btn-primary btn-full"
          onClick={handleSave}
          disabled={saving || enteredCount === 0}
        >
          {saving ? "Saving…" : saved ? "✓ Saved" : `Save ${enteredCount > 0 ? enteredCount : ""} Scores`}
        </button>
        {saved && (
          <Link to={`/rounds/${roundId}/scorecard`} className="btn btn-ghost btn-full" style={{ marginTop: "0.5rem" }}>
            View Scorecard →
          </Link>
        )}
      </div>
    </div>
  );
}

function HoleRow({
  hole, value, onAdjust, onChange,
}: {
  hole: HoleOut;
  value: number | null;
  onAdjust: (d: number) => void;
  onChange: (v: string) => void;
}) {
  const vsParNow = value !== null ? value - hole.par : null;
  const color = vsParNow === null ? "var(--text-muted)"
    : vsParNow < -1 ? "#6d28d9"
    : vsParNow === -1 ? "var(--green)"
    : vsParNow === 0 ? "var(--text)"
    : vsParNow === 1 ? "var(--text-muted)"
    : "var(--danger)";

  return (
    <div className="card" style={s.holeRow}>
      <div style={s.holeInfo}>
        <span style={s.holeNum}>H{hole.number}</span>
        <span style={s.holeMeta}>Par {hole.par}</span>
        <span style={{ ...s.holeMeta, fontSize: "0.7rem" }}>Hdcp {hole.hdcp_index}</span>
      </div>
      <div style={s.stepper}>
        <button style={s.stepBtn} onClick={() => onAdjust(-1)}>−</button>
        <input
          type="number"
          min={1}
          max={20}
          value={value ?? ""}
          placeholder={String(hole.par)}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...s.scoreInput, color }}
        />
        <button style={s.stepBtn} onClick={() => onAdjust(1)}>+</button>
      </div>
      {vsParNow !== null && (
        <div style={{ ...s.badge, color }}>
          {fmtVsPar(vsParNow)}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight, vs }: { label: string; value: string; highlight?: boolean; vs?: number }) {
  const color = !highlight ? "var(--text)"
    : vs! < 0 ? "var(--green)" : vs! > 0 ? "var(--danger)" : "var(--text)";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: "1.2rem", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function fmtVsPar(n: number) {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : String(n);
}

const s: Record<string, React.CSSProperties> = {
  header: { marginBottom: "1rem" },
  title: { fontSize: "1.3rem", fontWeight: 800, color: "var(--green-dark)", marginTop: "0.25rem" },
  sub: { fontSize: "0.8rem", color: "var(--text-muted)" },
  summaryBar: {
    display: "flex",
    justifyContent: "space-around",
    padding: "0.75rem 1rem",
    marginBottom: "0.75rem",
  },
  holeList: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  holeRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.65rem 0.85rem",
  },
  holeInfo: { display: "flex", flexDirection: "column", gap: "0.1rem", minWidth: "52px" },
  holeNum: { fontWeight: 700, fontSize: "0.95rem" },
  holeMeta: { fontSize: "0.75rem", color: "var(--text-muted)" },
  stepper: { display: "flex", alignItems: "center", gap: "0.4rem", flex: 1 },
  stepBtn: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "var(--bg)",
    fontSize: "1.25rem",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  scoreInput: {
    width: "52px",
    height: "40px",
    textAlign: "center",
    fontSize: "1.2rem",
    fontWeight: 700,
    border: "2px solid var(--border)",
    borderRadius: "0.5rem",
    background: "var(--surface)",
    outline: "none",
  },
  badge: {
    width: "36px",
    textAlign: "right",
    fontWeight: 700,
    fontSize: "0.9rem",
    flexShrink: 0,
  },
  footer: { marginTop: "1rem", position: "sticky", bottom: "calc(var(--nav-h) + 0.75rem)" },
};
