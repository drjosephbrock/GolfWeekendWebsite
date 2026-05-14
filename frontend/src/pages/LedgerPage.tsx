import { useEffect, useState, useCallback } from "react";
import { api, type LedgerEntryOut, type Balance, type LedgerCategory, type Player } from "../api";

const CATEGORY_LABELS: Record<LedgerCategory, string> = {
  food: "🍔 Food",
  beer: "🍺 Beer",
  gatorade: "🥤 Gatorade",
  buy_in: "🏆 Buy-in",
  bet: "💰 Bet",
  settlement: "✅ Settlement",
  other: "📌 Other",
};

const CATEGORY_COLORS: Record<LedgerCategory, string> = {
  food: "#d97706",
  beer: "#b45309",
  gatorade: "#0891b2",
  buy_in: "#7c3aed",
  bet: "#059669",
  settlement: "#6b7280",
  other: "#374151",
};

interface Props { player: Player }

type Tab = "entries" | "balances";

export default function LedgerPage({ player }: Props) {
  const [tab, setTab] = useState<Tab>("entries");
  const [entries, setEntries] = useState<LedgerEntryOut[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    Promise.all([api.ledger.list(), api.ledger.balances(), api.players.list()])
      .then(([e, b, p]) => { setEntries(e); setBalances(b); setPlayers(p); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleDelete(id: number) {
    if (!confirm("Delete this entry?")) return;
    await api.ledger.delete(id, player.id);
    refresh();
  }

  // Net balance for current player: positive = owed to you, negative = you owe
  const myNet = balances.reduce((sum, b) => {
    if (b.to_player_id === player.id) return sum + b.amount;
    if (b.from_player_id === player.id) return sum - b.amount;
    return sum;
  }, 0);

  return (
    <div className="page">
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Ledger</h1>
          {!loading && (
            <div style={{ fontSize: "0.85rem", color: myNet >= 0 ? "var(--green)" : "var(--danger)", fontWeight: 700 }}>
              {myNet === 0 ? "You're all square" : myNet > 0 ? `You are owed $${myNet.toFixed(2)}` : `You owe $${Math.abs(myNet).toFixed(2)}`}
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)} style={{ flexShrink: 0 }}>
          + Add
        </button>
      </div>

      {/* Tab switcher */}
      <div style={s.tabs}>
        <button style={{ ...s.tab, ...(tab === "entries" ? s.tabActive : {}) }} onClick={() => setTab("entries")}>
          Entries
        </button>
        <button style={{ ...s.tab, ...(tab === "balances" ? s.tabActive : {}) }} onClick={() => setTab("balances")}>
          Balances
        </button>
      </div>

      {loading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}

      {!loading && tab === "entries" && (
        entries.length === 0
          ? <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>No entries yet.</div>
          : entries.map((e) => (
            <EntryCard key={e.id} entry={e} currentPlayer={player} onDelete={handleDelete} />
          ))
      )}

      {!loading && tab === "balances" && (
        <BalancesView balances={balances} playerId={player.id} />
      )}

      {showAdd && (
        <AddEntryModal
          currentPlayer={player}
          players={players}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); refresh(); }}
        />
      )}
    </div>
  );
}

// ── Entry card ────────────────────────────────────────────────────────────────

function EntryCard({ entry, currentPlayer, onDelete }: {
  entry: LedgerEntryOut;
  currentPlayer: Player;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = CATEGORY_COLORS[entry.category];
  const canDelete = entry.created_by === currentPlayer.id;
  const date = new Date(entry.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  // Who owes who from this entry (excluding payer's own split)
  const debtors = entry.splits.filter((s) => s.player_id !== entry.payer_id);

  return (
    <div className="card" style={{ marginBottom: "0.6rem" }}>
      <div style={s.entryRow} onClick={() => setExpanded((x) => !x)}>
        <div style={{ ...s.categoryDot, background: color }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.entryDesc}>{entry.description}</div>
          <div style={s.entryMeta}>
            {CATEGORY_LABELS[entry.category]} · {entry.payer_name} paid · {date}
          </div>
        </div>
        <div style={s.entryAmount}>${entry.amount.toFixed(2)}</div>
        {canDelete && (
          <button
            style={s.deleteBtn}
            onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
          >✕</button>
        )}
      </div>

      {expanded && (
        <div style={s.splits}>
          {debtors.length === 0
            ? <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No splits recorded</span>
            : debtors.map((sp) => (
              <div key={sp.player_id} style={s.splitRow}>
                <span>{sp.player_name}</span>
                <span style={{ color: "var(--danger)", fontWeight: 600 }}>owes ${sp.amount.toFixed(2)}</span>
              </div>
            ))
          }
          {entry.payer_name !== entry.creator_name && (
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
              Added by {entry.creator_name}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Balances ──────────────────────────────────────────────────────────────────

function BalancesView({ balances, playerId }: { balances: Balance[]; playerId: number }) {
  if (balances.length === 0) {
    return <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>All square — no outstanding balances.</div>;
  }

  const mine = balances.filter((b) => b.from_player_id === playerId || b.to_player_id === playerId);
  const others = balances.filter((b) => b.from_player_id !== playerId && b.to_player_id !== playerId);

  return (
    <>
      {mine.length > 0 && (
        <>
          <p className="section-title">Your Balances</p>
          {mine.map((b, i) => <BalanceRow key={i} balance={b} playerId={playerId} />)}
        </>
      )}
      {others.length > 0 && (
        <>
          <p className="section-title" style={{ marginTop: "1rem" }}>Group</p>
          {others.map((b, i) => <BalanceRow key={i} balance={b} playerId={playerId} />)}
        </>
      )}
    </>
  );
}

function BalanceRow({ balance, playerId }: { balance: Balance; playerId: number }) {
  const isMyDebt = balance.from_player_id === playerId;
  const isMyCredit = balance.to_player_id === playerId;

  return (
    <div className="card" style={{ ...s.balanceRow, marginBottom: "0.5rem" }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 600, color: isMyDebt ? "var(--danger)" : "inherit" }}>
          {balance.from_player_name}
        </span>
        <span style={{ color: "var(--text-muted)", margin: "0 0.4rem" }}>→</span>
        <span style={{ fontWeight: 600, color: isMyCredit ? "var(--green)" : "inherit" }}>
          {balance.to_player_name}
        </span>
      </div>
      <span style={{ fontWeight: 700, fontSize: "1rem", color: isMyDebt ? "var(--danger)" : isMyCredit ? "var(--green)" : "var(--text)" }}>
        ${balance.amount.toFixed(2)}
      </span>
    </div>
  );
}

// ── Add entry modal ───────────────────────────────────────────────────────────

function AddEntryModal({ currentPlayer, players, onClose, onSaved }: {
  currentPlayer: Player;
  players: Player[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [payer, setPayer] = useState(currentPlayer.id);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<LedgerCategory>("food");
  const [splitIds, setSplitIds] = useState<Set<number>>(new Set([currentPlayer.id]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSplit(id: number) {
    setSplitIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    const total = parseFloat(amount);
    if (isNaN(total) || total <= 0) { setError("Enter a valid amount."); return; }
    if (!desc.trim()) { setError("Add a description."); return; }
    if (splitIds.size === 0) { setError("Select at least one person to split with."); return; }

    const share = parseFloat((total / splitIds.size).toFixed(2));
    const splitArr = [...splitIds].map((id, i, arr) => ({
      player_id: id,
      // last person gets remainder to avoid rounding gaps
      amount: i === arr.length - 1 ? parseFloat((total - share * (arr.length - 1)).toFixed(2)) : share,
    }));

    setSaving(true);
    setError(null);
    try {
      await api.ledger.create({ payer_id: payer, amount: total, description: desc.trim(), category, splits: splitArr }, currentPlayer.id);
      onSaved();
    } catch {
      setError("Failed to save. Try again.");
      setSaving(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>Add Entry</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <Field label="Paid by">
          <select style={s.select} value={payer} onChange={(e) => setPayer(Number(e.target.value))}>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>

        <Field label="Amount ($)">
          <input style={s.input} type="number" min="0.01" step="0.01" placeholder="0.00"
            value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>

        <Field label="Description">
          <input style={s.input} type="text" placeholder="e.g. Lunch at the turn"
            value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>

        <Field label="Category">
          <select style={s.select} value={category} onChange={(e) => setCategory(e.target.value as LedgerCategory)}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>

        <Field label="Split equally among">
          <div style={s.splitGrid}>
            {players.map((p) => (
              <button
                key={p.id}
                style={{ ...s.splitToggle, ...(splitIds.has(p.id) ? s.splitSelected : {}) }}
                onClick={() => toggleSplit(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
          {splitIds.size > 0 && amount && !isNaN(parseFloat(amount)) && (
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
              ${(parseFloat(amount) / splitIds.size).toFixed(2)} each ({splitIds.size} {splitIds.size === 1 ? "person" : "people"})
            </div>
          )}
        </Field>

        {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</p>}

        <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={saving} style={{ marginTop: "0.5rem" }}>
          {saving ? "Saving…" : "Save Entry"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", paddingTop: "0.5rem" },
  title: { fontSize: "1.4rem", fontWeight: 800, color: "var(--green-dark)" },
  tabs: { display: "flex", background: "var(--surface)", borderRadius: "0.6rem", padding: "0.2rem", marginBottom: "0.75rem", gap: "0.2rem" },
  tab: { flex: 1, padding: "0.5rem", borderRadius: "0.4rem", fontWeight: 600, fontSize: "0.85rem", color: "var(--text-muted)", background: "transparent" },
  tabActive: { background: "var(--green)", color: "#fff" },
  entryRow: { display: "flex", alignItems: "center", gap: "0.65rem", cursor: "pointer" },
  categoryDot: { width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0 },
  entryDesc: { fontWeight: 600, fontSize: "0.92rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  entryMeta: { fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.1rem" },
  entryAmount: { fontWeight: 700, fontSize: "1rem", flexShrink: 0 },
  deleteBtn: { background: "none", color: "var(--text-muted)", fontSize: "0.8rem", padding: "0.2rem 0.4rem", borderRadius: "4px", flexShrink: 0 },
  splits: { borderTop: "1px solid var(--border)", marginTop: "0.65rem", paddingTop: "0.65rem", display: "flex", flexDirection: "column", gap: "0.3rem" },
  splitRow: { display: "flex", justifyContent: "space-between", fontSize: "0.85rem" },
  balanceRow: { display: "flex", alignItems: "center" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "flex-end" },
  modal: { background: "var(--surface)", borderRadius: "1.25rem 1.25rem 0 0", padding: "1.25rem", width: "100%", maxHeight: "90dvh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.1rem" },
  closeBtn: { background: "var(--bg)", borderRadius: "50%", width: "32px", height: "32px", fontSize: "0.85rem", color: "var(--text-muted)" },
  input: { width: "100%", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid var(--border)", fontSize: "0.95rem", background: "var(--bg)", outline: "none" },
  select: { width: "100%", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid var(--border)", fontSize: "0.95rem", background: "var(--bg)", outline: "none" },
  splitGrid: { display: "flex", flexWrap: "wrap", gap: "0.4rem" },
  splitToggle: { padding: "0.4rem 0.75rem", borderRadius: "999px", fontSize: "0.85rem", fontWeight: 600, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text-muted)" },
  splitSelected: { background: "var(--green)", color: "#fff", borderColor: "var(--green)" },
};
