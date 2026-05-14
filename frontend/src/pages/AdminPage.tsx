import { useState, useEffect, useCallback } from "react";
import { api, type Player, type CourseOut, type LedgerEntryOut, type RoundOut, type RoundCreate } from "../api";

const SESSION_KEY = "golf_admin_pw";

// ── Password gate ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [pw, setPw] = useState(() => sessionStorage.getItem(SESSION_KEY) ?? "");
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(!!sessionStorage.getItem(SESSION_KEY));
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!checking) return;
    api.admin.verify(pw)
      .then(() => setAuthed(true))
      .catch(() => { sessionStorage.removeItem(SESSION_KEY); setPw(""); })
      .finally(() => setChecking(false));
  }, []);

  async function login() {
    setErr("");
    try {
      await api.admin.verify(pw);
      sessionStorage.setItem(SESSION_KEY, pw);
      setAuthed(true);
    } catch {
      setErr("Wrong password.");
    }
  }

  if (checking) return <div className="page"><p style={{ color: "var(--text-muted)" }}>Checking…</p></div>;

  if (!authed) return (
    <div style={s.gate}>
      <div style={s.gateCard}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔐</div>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "1rem" }}>Admin</h1>
        <input
          style={s.input}
          type="password"
          placeholder="Admin password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
          autoFocus
        />
        {err && <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginTop: "0.4rem" }}>{err}</p>}
        <button className="btn btn-primary btn-full" style={{ marginTop: "0.75rem" }} onClick={login}>
          Unlock
        </button>
      </div>
    </div>
  );

  return <AdminDashboard pw={pw} onLogout={() => { sessionStorage.removeItem(SESSION_KEY); setAuthed(false); setPw(""); }} />;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

type Tab = "players" | "teams" | "courses" | "rounds" | "ledger" | "danger";

function AdminDashboard({ pw, onLogout }: { pw: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("players");

  const tabs: { id: Tab; label: string }[] = [
    { id: "players", label: "Players" },
    { id: "teams", label: "Teams" },
    { id: "courses", label: "Courses" },
    { id: "rounds", label: "Rounds" },
    { id: "ledger", label: "Ledger" },
    { id: "danger", label: "⚠️" },
  ];

  return (
    <div className="page">
      <div style={s.topbar}>
        <h1 style={s.title}>Admin</h1>
        <button className="btn btn-ghost" style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }} onClick={onLogout}>
          Lock
        </button>
      </div>

      <div style={s.tabBar}>
        {tabs.map((t) => (
          <button
            key={t.id}
            style={{ ...s.tabBtn, ...(tab === t.id ? s.tabActive : {}) }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "players" && <PlayersTab pw={pw} />}
      {tab === "teams"   && <TeamsTab pw={pw} />}
      {tab === "courses" && <CoursesTab pw={pw} />}
      {tab === "rounds"  && <RoundsTab pw={pw} />}
      {tab === "ledger"  && <LedgerTab pw={pw} />}
      {tab === "danger"  && <DangerTab pw={pw} />}
    </div>
  );
}

// ── Players tab ───────────────────────────────────────────────────────────────

interface EditState {
  name: string;
  handicap: string;
  nickname: string;
  hometown: string;
  fun_fact: string;
}

function PlayersTab({ pw }: { pw: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: "", handicap: "", nickname: "", hometown: "", fun_fact: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHdcp, setNewHdcp] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api.players.list().then(setPlayers), []);
  useEffect(() => { load(); }, [load]);

  function startEdit(p: Player) {
    setEditing(p.id);
    setEditState({ name: p.name, handicap: String(p.handicap), nickname: p.nickname ?? "", hometown: p.hometown ?? "", fun_fact: p.fun_fact ?? "" });
  }

  function setField(key: keyof EditState, val: string) {
    setEditState((prev) => ({ ...prev, [key]: val }));
  }

  async function saveEdit(id: number) {
    setSaving(true);
    await api.admin.updatePlayer(id, {
      name: editState.name,
      handicap: parseFloat(editState.handicap),
      nickname: editState.nickname || undefined,
      hometown: editState.hometown || undefined,
      fun_fact: editState.fun_fact || undefined,
    }, pw);
    setEditing(null);
    await load();
    setSaving(false);
  }

  async function toggleActive(p: Player) {
    await api.admin.updatePlayer(p.id, { is_active: !p.is_active }, pw);
    load();
  }

  async function addPlayer() {
    if (!newName.trim() || isNaN(parseFloat(newHdcp))) return;
    setSaving(true);
    await api.admin.createPlayer(newName.trim(), parseFloat(newHdcp), pw);
    setNewName(""); setNewHdcp(""); setShowAdd(false);
    await load();
    setSaving(false);
  }

  const all = [...players].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <p className="section-title">Players ({players.filter(p => p.is_active).length} active)</p>
      {all.map((p) => (
        <div key={p.id} className="card" style={{ marginBottom: "0.5rem", opacity: p.is_active ? 1 : 0.5 }}>
          {editing === p.id ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <input style={{ ...s.input, flex: 2 }} value={editState.name} onChange={(e) => setField("name", e.target.value)} placeholder="Name" />
                <input style={{ ...s.input, flex: 1 }} type="number" value={editState.handicap} onChange={(e) => setField("handicap", e.target.value)} placeholder="HCP" />
              </div>
              <input style={s.input} value={editState.nickname} onChange={(e) => setField("nickname", e.target.value)} placeholder='Nickname (e.g. "The Machine")' />
              <input style={s.input} value={editState.hometown} onChange={(e) => setField("hometown", e.target.value)} placeholder="Hometown (e.g. Minneapolis, MN)" />
              <input style={s.input} value={editState.fun_fact} onChange={(e) => setField("fun_fact", e.target.value)} placeholder="Fun fact / bio" />
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveEdit(p.id)} disabled={saving}>Save</button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={s.playerRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700 }}>{p.name}</span>
                {p.nickname && <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontStyle: "italic", marginLeft: "0.4rem" }}>"{p.nickname}"</span>}
                <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginLeft: "0.5rem" }}>HCP {p.handicap}</span>
                {p.team && <span className="pill green" style={{ marginLeft: "0.4rem" }}>Team {p.team}</span>}
                {p.hometown && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>📍 {p.hometown}</div>}
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                <button className="btn btn-ghost" style={s.smBtn} onClick={() => startEdit(p)}>Edit</button>
                <button className="btn btn-ghost" style={{ ...s.smBtn, color: p.is_active ? "var(--danger)" : "var(--green)" }}
                  onClick={() => toggleActive(p)}>
                  {p.is_active ? "Off" : "On"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showAdd ? (
        <div className="card" style={{ marginTop: "0.5rem" }}>
          <p className="section-title">Add Player</p>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <input style={{ ...s.input, flex: 2 }} placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input style={{ ...s.input, flex: 1 }} type="number" placeholder="HCP" value={newHdcp} onChange={(e) => setNewHdcp(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={addPlayer} disabled={saving}>Add</button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost btn-full" style={{ marginTop: "0.5rem" }} onClick={() => setShowAdd(true)}>
          + Add Player
        </button>
      )}
    </>
  );
}

// ── Teams tab ─────────────────────────────────────────────────────────────────

function TeamsTab({ pw }: { pw: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  const load = useCallback(() => api.players.list().then((p) => setPlayers(p.filter(x => x.is_active))), []);
  useEffect(() => { load(); }, [load]);

  async function setTeam(id: number, team: string | null) {
    setSaving(id);
    await api.admin.updatePlayer(id, { team: team ?? undefined }, pw);
    await load();
    setSaving(null);
  }

  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");
  const unassigned = players.filter((p) => !p.team);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <TeamColumn label="Team A" players={teamA} color="var(--green)" />
        <TeamColumn label="Team B" players={teamB} color="#7c3aed" />
      </div>

      {unassigned.length > 0 && (
        <>
          <p className="section-title">Unassigned</p>
          {unassigned.map((p) => (
            <div key={p.id} className="card" style={{ ...s.playerRow, marginBottom: "0.4rem" }}>
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button className="btn btn-ghost" style={{ ...s.smBtn, background: "#d1fae5", color: "var(--green-dark)" }}
                  onClick={() => setTeam(p.id, "A")} disabled={saving === p.id}>A</button>
                <button className="btn btn-ghost" style={{ ...s.smBtn, background: "#ede9fe", color: "#6d28d9" }}
                  onClick={() => setTeam(p.id, "B")} disabled={saving === p.id}>B</button>
              </div>
            </div>
          ))}
        </>
      )}

      {players.every((p) => p.team) && players.length > 0 && (
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <span className="pill green" style={{ fontSize: "0.9rem", padding: "0.4rem 1rem" }}>All players assigned ✓</span>
        </div>
      )}

      <button className="btn btn-ghost btn-full" style={{ marginTop: "1rem", color: "var(--danger)" }}
        onClick={async () => {
          if (!confirm("Clear all team assignments?")) return;
          await Promise.all(players.map((p) => api.admin.updatePlayer(p.id, { team: undefined }, pw)));
          load();
        }}>
        Clear All Teams
      </button>
    </>
  );
}

function TeamColumn({ label, players, color }: { label: string; players: Player[]; color: string }) {
  return (
    <div className="card" style={{ borderTop: `3px solid ${color}` }}>
      <p style={{ fontWeight: 700, color, marginBottom: "0.5rem" }}>{label}</p>
      {players.length === 0
        ? <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No players</p>
        : players.map((p) => <div key={p.id} style={{ fontSize: "0.88rem", padding: "0.2rem 0" }}>{p.name}</div>)
      }
    </div>
  );
}

// ── Courses tab ───────────────────────────────────────────────────────────────

type HoleMode = "none" | "single" | "bulk";

function CoursesTab({ pw }: { pw: string }) {
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseLocation, setNewCourseLocation] = useState("");
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [holeMode, setHoleMode] = useState<{ id: number; mode: HoleMode }>({ id: 0, mode: "none" });
  const [holeForm, setHoleForm] = useState({ number: "", par: "", yardage: "", hdcp_index: "" });
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const load = useCallback(() => api.courses.list().then(setCourses), []);
  useEffect(() => { load(); }, [load]);

  async function addCourse() {
    if (!newCourseName.trim()) return;
    await api.admin.createCourse(newCourseName.trim(), newCourseLocation.trim() || null, pw);
    setNewCourseName(""); setNewCourseLocation(""); setShowAddCourse(false);
    load();
  }

  async function addSingleHole(courseId: number) {
    const h = holeForm;
    if (!h.number || !h.par || !h.hdcp_index) return;
    await api.admin.addHole(courseId, {
      number: parseInt(h.number),
      par: parseInt(h.par),
      yardage: h.yardage ? parseInt(h.yardage) : undefined,
      hdcp_index: parseInt(h.hdcp_index),
    }, pw);
    setHoleForm({ number: "", par: "", yardage: "", hdcp_index: "" });
    setHoleMode({ id: 0, mode: "none" });
    load();
  }

  async function addBulkHoles(courseId: number) {
    setBulkError(null);
    const lines = bulkText.trim().split("\n").filter((l) => l.trim());
    const parsed: { number: number; par: number; yardage?: number; hdcp_index: number }[] = [];

    for (const [i, line] of lines.entries()) {
      const cols = line.trim().split(/[\t,\s]+/);
      const [num, par, yds, hdcp] = cols.map(Number);
      if (cols.length < 3 || isNaN(num) || isNaN(par) || isNaN(hdcp ?? yds)) {
        setBulkError(`Line ${i + 1}: need at least 3 columns (hole  par  hdcp) — got: "${line.trim()}"`);
        return;
      }
      // 3 cols: hole par hdcp, 4 cols: hole par yardage hdcp
      if (cols.length === 3) {
        parsed.push({ number: num, par, hdcp_index: yds });
      } else {
        parsed.push({ number: num, par, yardage: isNaN(yds) ? undefined : yds, hdcp_index: hdcp });
      }
    }

    if (parsed.length === 0) { setBulkError("No valid rows found."); return; }

    setBulkSaving(true);
    try {
      for (const hole of parsed) {
        await api.admin.addHole(courseId, hole, pw);
      }
      setBulkText("");
      setHoleMode({ id: 0, mode: "none" });
      load();
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Failed to save holes.");
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <>
      {courses.map((c) => {
        const isExpanded = expanded === c.id;
        const mode = holeMode.id === c.id ? holeMode.mode : "none";
        return (
          <div key={c.id} className="card" style={{ marginBottom: "0.6rem" }}>
            <div style={s.playerRow} onClick={() => setExpanded(isExpanded ? null : c.id)}>
              <div>
                <span style={{ fontWeight: 700 }}>{c.name}</span>
                {c.location && <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginLeft: "0.4rem" }}>{c.location}</span>}
                <span style={{ color: c.holes.length >= 9 ? "var(--green)" : "var(--danger)", fontSize: "0.8rem", marginLeft: "0.4rem", fontWeight: 600 }}>
                  ({c.holes.length} holes)
                </span>
              </div>
              <span style={{ color: "var(--text-muted)" }}>{isExpanded ? "▲" : "▼"}</span>
            </div>

            {isExpanded && (
              <div style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                {c.holes.length > 0 && (
                  <div style={s.holeTable}>
                    <div style={s.holeTableHead}>H</div>
                    <div style={s.holeTableHead}>Par</div>
                    <div style={s.holeTableHead}>Yds</div>
                    <div style={s.holeTableHead}>Hdcp</div>
                    {c.holes.map((h) => (
                      <>
                        <div key={`n${h.id}`} style={s.holeTableCell}>{h.number}</div>
                        <div style={s.holeTableCell}>{h.par}</div>
                        <div style={s.holeTableCell}>{h.yardage ?? "—"}</div>
                        <div style={s.holeTableCell}>{h.hdcp_index}</div>
                      </>
                    ))}
                  </div>
                )}

                {mode === "single" && (
                  <div style={{ marginTop: "0.6rem" }}>
                    <p className="section-title">Add Hole</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.4rem", marginBottom: "0.4rem" }}>
                      {(["number", "par", "yardage", "hdcp_index"] as const).map((f) => (
                        <input key={f} style={s.input} type="number"
                          placeholder={f === "hdcp_index" ? "Hdcp" : f === "yardage" ? "Yds" : f === "number" ? "Hole" : "Par"}
                          value={holeForm[f]}
                          onChange={(e) => setHoleForm((prev) => ({ ...prev, [f]: e.target.value }))} />
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => addSingleHole(c.id)}>Add</button>
                      <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setHoleMode({ id: 0, mode: "none" })}>Cancel</button>
                    </div>
                  </div>
                )}

                {mode === "bulk" && (
                  <div style={{ marginTop: "0.6rem" }}>
                    <p className="section-title">Paste All Holes</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                      One hole per line. Columns: <strong>hole  par  yardage  hdcp</strong> (or <strong>hole  par  hdcp</strong> if no yardage).
                      Separate with tabs, spaces, or commas.
                    </p>
                    <textarea
                      style={{ ...s.input, height: "160px", resize: "vertical", fontFamily: "monospace", fontSize: "0.82rem" }}
                      placeholder={"1\t4\t380\t5\n2\t3\t165\t15\n3\t5\t510\t1\n..."}
                      value={bulkText}
                      onChange={(e) => { setBulkText(e.target.value); setBulkError(null); }}
                    />
                    {bulkError && <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginTop: "0.3rem" }}>{bulkError}</p>}
                    <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
                      <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => addBulkHoles(c.id)} disabled={bulkSaving}>
                        {bulkSaving ? "Saving…" : `Add ${bulkText.trim().split("\n").filter((l) => l.trim()).length} holes`}
                      </button>
                      <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setHoleMode({ id: 0, mode: "none" }); setBulkText(""); setBulkError(null); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {mode === "none" && (
                  <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
                    <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.82rem" }}
                      onClick={() => { setHoleMode({ id: c.id, mode: "single" }); setHoleForm({ number: String(c.holes.length + 1), par: "4", yardage: "", hdcp_index: "" }); }}>
                      + Add Hole
                    </button>
                    <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.82rem" }}
                      onClick={() => { setHoleMode({ id: c.id, mode: "bulk" }); setBulkText(""); setBulkError(null); }}>
                      Paste All
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {showAddCourse ? (
        <div className="card" style={{ marginTop: "0.5rem" }}>
          <p className="section-title">New Course</p>
          <input style={{ ...s.input, marginBottom: "0.4rem" }} placeholder="Course name" value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} />
          <input style={{ ...s.input, marginBottom: "0.5rem" }} placeholder="Location (optional)" value={newCourseLocation} onChange={(e) => setNewCourseLocation(e.target.value)} />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={addCourse}>Create</button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAddCourse(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost btn-full" style={{ marginTop: "0.5rem" }} onClick={() => setShowAddCourse(true)}>
          + Add Course
        </button>
      )}
    </>
  );
}

// ── Rounds tab ────────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  stroke_play: "Stroke Play",
  best_ball: "Best Ball",
  alternate_shot: "Alternate Shot",
  scramble: "Scramble",
  match_play: "Match Play",
  tilt: "TILT",
};

const FORMATS = [
  { value: "stroke_play", label: "Stroke Play" },
  { value: "best_ball", label: "Best Ball" },
  { value: "alternate_shot", label: "Alternate Shot" },
  { value: "scramble", label: "Scramble" },
  { value: "match_play", label: "Match Play" },
  { value: "tilt", label: "TILT" },
];

function RoundsTab({ pw }: { pw: string }) {
  const [rounds, setRounds] = useState<RoundOut[]>([]);
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([api.rounds.list(), api.courses.list(), api.players.list()])
      .then(([r, c, p]) => { setRounds(r); setCourses(c); setPlayers(p); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markComplete(id: number) {
    await api.rounds.markComplete(id, pw);
    load();
  }

  async function deleteRound(id: number) {
    if (!confirm("Delete this round and all its scores?")) return;
    await api.rounds.deleteRound(id, pw);
    load();
  }

  const courseMap = Object.fromEntries(courses.map((c) => [c.id, c.name]));

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <p className="section-title" style={{ margin: 0 }}>{rounds.length} round{rounds.length !== 1 ? "s" : ""}</p>
        <button className="btn btn-primary" style={s.smBtn} onClick={() => setShowCreate(true)}>+ Create</button>
      </div>

      {loading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}

      {!loading && rounds.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
          No rounds yet.
        </div>
      )}

      {rounds.map((r) => {
        const fmt = FORMAT_LABELS[r.format] ?? r.format;
        const date = new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
        return (
          <div key={r.id} className="card" style={{ marginBottom: "0.5rem" }}>
            <div style={s.playerRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.label ?? fmt}
                  {r.is_ryder_cup && (
                    <span className="pill green" style={{ marginLeft: "0.4rem", fontSize: "0.68rem" }}>Ryder</span>
                  )}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {fmt} · {courseMap[r.course_id] ?? `Course ${r.course_id}`} · {r.holes_count}H · {date} · {r.participants.length} players
                </div>
                <div style={{ marginTop: "0.2rem" }}>
                  <span className={`pill ${r.is_complete ? "green" : "gold"}`} style={{ fontSize: "0.68rem" }}>
                    {r.is_complete ? "Complete" : "In Progress"}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flexShrink: 0, alignItems: "flex-end" }}>
                {!r.is_complete && (
                  <button className="btn btn-ghost" style={s.smBtn} onClick={() => markComplete(r.id)}>
                    ✓ Done
                  </button>
                )}
                <button
                  style={{ ...s.smBtn, color: "var(--danger)", background: "none", border: "none", padding: "0.3rem 0.5rem" }}
                  onClick={() => deleteRound(r.id)}
                >✕</button>
              </div>
            </div>
          </div>
        );
      })}

      {showCreate && (
        <CreateRoundModal
          courses={courses}
          players={players}
          pw={pw}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}
    </>
  );
}

function CreateRoundModal({ courses, players, pw, onClose, onSaved }: {
  courses: CourseOut[];
  players: Player[];
  pw: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [courseId, setCourseId] = useState<number>(courses[0]?.id ?? 0);
  const [format, setFormat] = useState("stroke_play");
  const [holesCount, setHolesCount] = useState(18);
  const [label, setLabel] = useState("");
  const [isRyderCup, setIsRyderCup] = useState(false);
  const [teeTimeGroup, setTeeTimeGroup] = useState<number | undefined>(undefined);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<number>>(new Set());
  const [playerTeams, setPlayerTeams] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsTeams = ["best_ball", "alternate_shot", "scramble", "match_play"].includes(format) || isRyderCup;

  function togglePlayer(id: number) {
    setSelectedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setPlayerTeams((t) => { const n = { ...t }; delete n[id]; return n; });
      } else {
        next.add(id);
        const player = players.find((p) => p.id === id);
        if (player?.team) {
          setPlayerTeams((t) => ({ ...t, [id]: player.team! }));
        }
      }
      return next;
    });
  }

  function setPlayerTeam(playerId: number, team: string) {
    setPlayerTeams((prev) => {
      if (prev[playerId] === team) {
        const n = { ...prev }; delete n[playerId]; return n;
      }
      return { ...prev, [playerId]: team };
    });
  }

  async function handleSubmit() {
    if (!courseId) { setError("Select a course."); return; }
    if (selectedPlayers.size === 0) { setError("Add at least one player."); return; }
    if (isRyderCup && !teeTimeGroup) { setError("Select a tee-time group for Ryder Cup."); return; }

    const payload: RoundCreate = {
      course_id: courseId,
      format,
      holes_count: holesCount,
      label: label.trim() || undefined,
      is_ryder_cup: isRyderCup,
      tee_time_group: teeTimeGroup,
      participants: [...selectedPlayers].map((pid) => ({
        player_id: pid,
        team: playerTeams[pid] || null,
      })),
    };

    setSaving(true);
    setError(null);
    try {
      await api.rounds.create(payload, pw);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create round.");
      setSaving(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>Create Round</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <RField label="Course">
          <select style={s.select} value={courseId} onChange={(e) => setCourseId(Number(e.target.value))}>
            {courses.length === 0 && <option value={0}>No courses — add one in Courses tab</option>}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.holes.length} hole{c.holes.length !== 1 ? "s" : ""})
              </option>
            ))}
          </select>
          {(() => {
            const selected = courses.find((c) => c.id === courseId);
            if (selected && selected.holes.length < holesCount) {
              return (
                <div style={{ color: "var(--danger)", fontSize: "0.78rem", marginTop: "0.3rem" }}>
                  ⚠ This course only has {selected.holes.length} hole{selected.holes.length !== 1 ? "s" : ""} — add more in the Courses tab before scoring.
                </div>
              );
            }
            return null;
          })()}
        </RField>

        <RField label="Format">
          <select style={s.select} value={format} onChange={(e) => setFormat(e.target.value)}>
            {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </RField>

        <RField label="Holes">
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {[9, 18].map((n) => (
              <button key={n} className={`btn ${holesCount === n ? "btn-primary" : "btn-ghost"}`}
                style={{ flex: 1 }} onClick={() => setHolesCount(n)}>
                {n} holes
              </button>
            ))}
          </div>
        </RField>

        <RField label="Label (optional)">
          <input style={s.input} type="text" placeholder="e.g. Friday AM Scramble"
            value={label} onChange={(e) => setLabel(e.target.value)} />
        </RField>

        <RField label="Ryder Cup match">
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {[false, true].map((v) => (
              <button key={String(v)} className={`btn ${isRyderCup === v ? "btn-primary" : "btn-ghost"}`}
                style={{ flex: 1 }} onClick={() => { setIsRyderCup(v); if (!v) setTeeTimeGroup(undefined); }}>
                {v ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </RField>

        {isRyderCup && (
          <RField label="Tee-time group">
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {[1, 2, 3, 4].map((n) => (
                <button key={n} className={`btn ${teeTimeGroup === n ? "btn-primary" : "btn-ghost"}`}
                  style={{ flex: 1 }} onClick={() => setTeeTimeGroup(n)}>
                  {n}
                </button>
              ))}
            </div>
          </RField>
        )}

        <RField label={`Players (${selectedPlayers.size} selected)`}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {players.map((p) => {
              const isSelected = selectedPlayers.has(p.id);
              const team = playerTeams[p.id];
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <button
                    style={{
                      flex: 1,
                      padding: "0.4rem 0.75rem",
                      borderRadius: "0.4rem",
                      border: `1.5px solid ${isSelected ? "var(--green)" : "var(--border)"}`,
                      background: isSelected ? "#d1fae5" : "var(--bg)",
                      color: isSelected ? "var(--green-dark)" : "var(--text-muted)",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      textAlign: "left",
                    }}
                    onClick={() => togglePlayer(p.id)}
                  >
                    {p.name}
                    <span style={{ fontWeight: 400, fontSize: "0.72rem", marginLeft: "0.4rem" }}>HCP {p.handicap}</span>
                  </button>
                  {isSelected && needsTeams && (
                    <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
                      {(["A", "B"] as const).map((t) => (
                        <button key={t}
                          style={{
                            ...s.smBtn,
                            background: team === t ? (t === "A" ? "var(--green)" : "#7c3aed") : "var(--bg)",
                            color: team === t ? "#fff" : "var(--text-muted)",
                            border: "1.5px solid var(--border)",
                          }}
                          onClick={() => setPlayerTeam(p.id, t)}
                        >{t}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </RField>

        {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginTop: "0.25rem" }}>{error}</p>}

        <button
          className="btn btn-primary btn-full"
          onClick={handleSubmit}
          disabled={saving || courses.length === 0}
          style={{ marginTop: "0.75rem" }}
        >
          {saving ? "Creating…" : "Create Round"}
        </button>
      </div>
    </div>
  );
}

function RField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "0.85rem" }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ── Ledger tab ────────────────────────────────────────────────────────────────

function LedgerTab({ pw }: { pw: string }) {
  const [entries, setEntries] = useState<LedgerEntryOut[]>([]);

  const load = useCallback(() => api.ledger.list().then(setEntries), []);
  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: number) {
    if (!confirm("Delete this entry?")) return;
    await api.ledger.adminDelete(id, pw);
    load();
  }

  if (entries.length === 0) {
    return <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>No ledger entries.</div>;
  }

  return (
    <>
      <p className="section-title">{entries.length} entries</p>
      {entries.map((e) => (
        <div key={e.id} className="card" style={{ marginBottom: "0.5rem" }}>
          <div style={s.playerRow}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.description}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {e.payer_name} paid · {e.category} · by {e.creator_name}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
              <span style={{ fontWeight: 700 }}>${e.amount.toFixed(2)}</span>
              <button style={{ ...s.smBtn, color: "var(--danger)", background: "none", border: "none" }}
                onClick={() => handleDelete(e.id)}>✕</button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// ── Danger zone ───────────────────────────────────────────────────────────────

function DangerTab({ pw }: { pw: string }) {
  const [confirm1, setConfirm1] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [done, setDone] = useState<string[] | null>(null);

  async function wipe() {
    setWiping(true);
    const res = await api.admin.wipe(pw);
    setDone(res.wiped);
    setWiping(false);
    setConfirm1(false);
  }

  return (
    <div className="card" style={{ borderTop: "3px solid var(--danger)" }}>
      <h2 style={{ fontWeight: 800, color: "var(--danger)", marginBottom: "0.5rem" }}>Danger Zone</h2>

      <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
        Wipes all rounds, scores, ledger entries, and team assignments. Player profiles and course data are preserved.
        Use this after everyone is settled up at the end of the weekend.
      </p>

      {done ? (
        <div style={{ background: "#d1fae5", borderRadius: "0.5rem", padding: "0.75rem", color: "var(--green-dark)" }}>
          <strong>Done.</strong> Wiped: {done.join(", ")}.
        </div>
      ) : !confirm1 ? (
        <button className="btn btn-full" style={{ background: "var(--danger)", color: "#fff" }}
          onClick={() => setConfirm1(true)}>
          Wipe Seasonal Data
        </button>
      ) : (
        <div>
          <p style={{ fontWeight: 700, marginBottom: "0.75rem", color: "var(--danger)" }}>
            Are you sure? This cannot be undone.
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-full" style={{ background: "var(--danger)", color: "#fff", flex: 1 }}
              onClick={wipe} disabled={wiping}>
              {wiping ? "Wiping…" : "Yes, wipe everything"}
            </button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirm1(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  gate: { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "var(--green-dark)" },
  gateCard: { background: "var(--surface)", borderRadius: "1rem", padding: "2rem", width: "100%", maxWidth: "360px", textAlign: "center" },
  topbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", paddingTop: "0.5rem" },
  title: { fontSize: "1.4rem", fontWeight: 800, color: "var(--green-dark)" },
  tabBar: { display: "flex", gap: "0.25rem", background: "var(--surface)", borderRadius: "0.6rem", padding: "0.2rem", marginBottom: "0.75rem", overflowX: "auto" },
  tabBtn: { flex: "0 0 auto", padding: "0.45rem 0.75rem", borderRadius: "0.4rem", fontWeight: 600, fontSize: "0.82rem", color: "var(--text-muted)", background: "transparent", whiteSpace: "nowrap" },
  tabActive: { background: "var(--green)", color: "#fff" },
  playerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" },
  input: { padding: "0.55rem 0.65rem", borderRadius: "0.5rem", border: "1.5px solid var(--border)", fontSize: "0.9rem", background: "var(--bg)", outline: "none", width: "100%" },
  smBtn: { padding: "0.3rem 0.6rem", borderRadius: "0.4rem", fontSize: "0.8rem", fontWeight: 600 },
  select: { width: "100%", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid var(--border)", fontSize: "0.95rem", background: "var(--bg)", outline: "none" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "flex-end" },
  modal: { background: "var(--surface)", borderRadius: "1.25rem 1.25rem 0 0", padding: "1.25rem", width: "100%", maxHeight: "90dvh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.1rem" },
  closeBtn: { background: "var(--bg)", borderRadius: "50%", width: "32px", height: "32px", fontSize: "0.85rem", color: "var(--text-muted)" },
  holeTable: { display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "0.5rem", overflow: "hidden", fontSize: "0.82rem" },
  holeTableHead: { background: "var(--bg)", padding: "0.3rem 0.5rem", fontWeight: 700, textAlign: "center", color: "var(--text-muted)", fontSize: "0.7rem" },
  holeTableCell: { background: "var(--surface)", padding: "0.35rem 0.5rem", textAlign: "center" },
};
