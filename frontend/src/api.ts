export interface Player {
  id: number;
  name: string;
  handicap: number;
  team: string | null;
  is_active: boolean;
  nickname: string | null;
  hometown: string | null;
  fun_fact: string | null;
}

export interface HoleOut {
  id: number;
  course_id: number;
  number: number;
  par: number;
  yardage: number | null;
  hdcp_index: number;
}

export interface CourseOut {
  id: number;
  name: string;
  location: string | null;
  holes: HoleOut[];
}

export interface ParticipantOut {
  player_id: number;
  player_name: string;
  team: string | null;
  handicap_snapshot: number;
}

export interface RoundOut {
  id: number;
  course_id: number;
  format: string;
  holes_count: number;
  label: string | null;
  date: string;
  is_complete: boolean;
  is_ryder_cup: boolean;
  tee_time_group: number | null;
  participants: ParticipantOut[];
}

export interface HoleScoreIn {
  hole_number: number;
  gross: number;
}

// ── Scorecard result shapes ───────────────────────────────────────────────────

export interface TiltHole {
  hole: { number: number; par: number; hdcp_index: number };
  gross: number;
  score_vs_par: number;
  multiplier_applied: number;
  base_points: number;
  actual_points: number;
  on_tilt_after: boolean;
  multiplier_after: number;
}

export interface TiltPlayerResult {
  player_id: number;
  holes: TiltHole[];
  total_points: number;
}

export interface MatchHole {
  hole: { number: number; par: number };
  player_a_net: number;
  player_b_net: number;
  winner: number | null;
  running_status: number;
}

export interface MatchResult {
  holes: MatchHole[];
  winner: number | null;
  margin: number;
  status_display: string;
}

export interface StrokeHole {
  hole: { number: number; par: number };
  scores: Record<string, number>;
  net_scores: Record<string, number>;
}

export interface StrokeResult {
  holes: StrokeHole[];
  gross_totals: Record<string, number>;
  net_totals: Record<string, number>;
}

export interface BestBallHole {
  hole: { number: number; par: number };
  team_a_scores: Record<string, number>;
  team_b_scores: Record<string, number>;
  team_a_best: number;
  team_b_best: number;
  winner: "A" | "B" | null;
}

export interface BestBallResult {
  holes: BestBallHole[];
  team_a_points: number;
  team_b_points: number;
}

// ── Ledger ────────────────────────────────────────────────────────────────────

export type LedgerCategory = "food" | "beer" | "buy_in" | "bet" | "settlement" | "other";

export interface SplitOut {
  player_id: number;
  player_name: string;
  amount: number;
}

export interface LedgerEntryOut {
  id: number;
  created_by: number;
  creator_name: string;
  payer_id: number;
  payer_name: string;
  amount: number;
  description: string;
  category: LedgerCategory;
  round_id: number | null;
  created_at: string;
  splits: SplitOut[];
}

export interface Balance {
  from_player_id: number;
  from_player_name: string;
  to_player_id: number;
  to_player_name: string;
  amount: number;
}

// ── Ryder Cup ─────────────────────────────────────────────────────────────────

export interface RyderMatch {
  round_id: number;
  tee_time_group: number | null;
  format: string;
  team_a_players: string[];
  team_b_players: string[];
  team_a_points: number;
  team_b_points: number;
  is_complete: boolean;
  status_display: string;
}

export interface RyderSession {
  format: string;
  label: string;
  team_a_points: number;
  team_b_points: number;
  matches: RyderMatch[];
}

export interface Scoreboard {
  team_a_total: number;
  team_b_total: number;
  points_available: number;
  sessions: RyderSession[];
}

// ── Bets ──────────────────────────────────────────────────────────────────────

export type BetType = "skins" | "stroke_match" | "nassau" | "dots";

export interface BetParticipantOut {
  player_id: number;
  player_name: string;
}

export interface BetOut {
  id: number;
  round_id: number;
  type: BetType;
  dollars_per_unit: number;
  participants: BetParticipantOut[];
}

export interface SkinsHole {
  hole_number: number;
  par: number;
  gross_scores: Record<string, number>;
  skin_winner_id: number | null;
  pot_value: number;
  carried_over: boolean;
}

export interface StrokeMatchHole {
  hole_number: number;
  par: number;
  gross_scores: Record<string, number>;
  net_scores: Record<string, number>;
}

export interface StrokeMatchSide {
  team: string;
  player_ids: number[];
  player_names: string[];
  gross_total: number;
  net_total: number;
}

export interface StrokeMatchResult {
  bet_id: number;
  dollars: number;
  holes: StrokeMatchHole[];
  sides: StrokeMatchSide[];
  winning_team: string | null;
  margin: number;
  is_partial: boolean;
}

export interface SkinsResult {
  bet_id: number;
  dollars_per_skin: number;
  holes: SkinsHole[];
  winnings: Record<string, number>;
  is_partial: boolean;
  participant_ids: number[];
}

export interface LedgerEntryCreate {
  payer_id: number;
  amount: number;
  description: string;
  category: LedgerCategory;
  round_id?: number | null;
  splits: { player_id: number; amount: number }[];
}

export interface ParticipantIn {
  player_id: number;
  team?: string | null;
  handicap_override?: number | null;
}

export interface RoundCreate {
  course_id: number;
  format: string;
  holes_count?: number;
  label?: string;
  is_ryder_cup?: boolean;
  tee_time_group?: number;
  participants: ParticipantIn[];
}

export type ScorecardResponse =
  | { format: "tilt"; results: TiltPlayerResult[] }
  | { format: "match_play"; result: MatchResult }
  | { format: "stroke_play"; result: StrokeResult }
  | { format: "best_ball"; result: BestBallResult }
  | { format: "alternate_shot" | "scramble"; team_a: unknown; team_b: unknown };

// ── Fetch helpers ─────────────────────────────────────────────────────────────

const BASE = "/api";

async function extractError(res: Response, method: string, path: string): Promise<never> {
  let detail = `${method} ${path} → ${res.status}`;
  try { const j = await res.json(); detail = j.detail ?? detail; } catch { /* ignore */ }
  throw new Error(detail);
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) return extractError(res, "GET", path);
  return res.json();
}

async function post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) return extractError(res, "POST", path);
  return res.json();
}

async function patch<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) return extractError(res, "PATCH", path);
  return res.json();
}

async function del(path: string, headers?: Record<string, string>): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", headers });
  if (!res.ok) return extractError(res, "DELETE", path);
}

export const api = {
  bets: {
    list: (roundId: number) => get<BetOut[]>(`/rounds/${roundId}/bets`),
    create: (
      roundId: number,
      type: BetType,
      dollarsPerUnit: number,
      participants: { player_id: number; team?: string | null }[],
      pw: string,
    ) => post<BetOut>(`/rounds/${roundId}/bets`, { type, dollars_per_unit: dollarsPerUnit, participants }, { "X-Admin-Password": pw }),
    delete: (roundId: number, betId: number, pw: string) =>
      del(`/rounds/${roundId}/bets/${betId}`, { "X-Admin-Password": pw }),
    skinsResult: (roundId: number, betId: number) =>
      get<SkinsResult>(`/rounds/${roundId}/bets/${betId}/skins`),
    strokeMatchResult: (roundId: number, betId: number) =>
      get<StrokeMatchResult>(`/rounds/${roundId}/bets/${betId}/stroke_match`),
  },
  players: {
    list: () => get<Player[]>("/players"),
    get: (id: number) => get<Player>(`/players/${id}`),
    updateBio: (id: number, bio: { nickname?: string | null; hometown?: string | null; fun_fact?: string | null }) =>
      patch<Player>(`/players/${id}/bio`, bio),
  },
  courses: {
    list: () => get<CourseOut[]>("/courses"),
    get: (id: number) => get<CourseOut>(`/courses/${id}`),
  },
  rounds: {
    list: () => get<RoundOut[]>("/rounds"),
    get: (id: number) => get<RoundOut>(`/rounds/${id}`),
    scorecard: (id: number) => get<ScorecardResponse>(`/rounds/${id}/scorecard`),
    submitScores: (id: number, player_id: number, scores: HoleScoreIn[]) =>
      post(`/rounds/${id}/scores`, { player_id, scores }),
    create: (round: RoundCreate, pw: string) =>
      post<RoundOut>("/rounds", round, { "X-Admin-Password": pw }),
    markComplete: (id: number, pw: string) =>
      patch<{ ok: boolean }>(`/rounds/${id}/complete`, {}, { "X-Admin-Password": pw }),
    deleteRound: (id: number, pw: string) =>
      del(`/rounds/${id}`, { "X-Admin-Password": pw }),
  },
  ledger: {
    list: () => get<LedgerEntryOut[]>("/ledger"),
    balances: () => get<Balance[]>("/ledger/balances"),
    create: (entry: LedgerEntryCreate, created_by: number) =>
      post<LedgerEntryOut>(`/ledger?created_by=${created_by}`, entry),
    delete: (id: number, player_id: number) =>
      del(`/ledger/${id}?requesting_player=${player_id}`),
    adminDelete: (id: number, pw: string) =>
      del(`/ledger/${id}`, { "X-Admin-Password": pw }),
  },
  rydercup: {
    scoreboard: () => get<Scoreboard>("/rydercup/scoreboard"),
  },
  admin: {
    verify: (pw: string) =>
      post<{ ok: boolean }>("/admin/verify", {}, { "X-Admin-Password": pw }),
    wipe: (pw: string) =>
      post<{ ok: boolean; wiped: string[] }>("/admin/wipe", {}, { "X-Admin-Password": pw }),
    createPlayer: (name: string, handicap: number, pw: string) =>
      post<Player>("/players", { name, handicap }, { "X-Admin-Password": pw }),
    updatePlayer: (id: number, update: Partial<Pick<Player, "name" | "handicap" | "team" | "is_active" | "nickname" | "hometown" | "fun_fact">>, pw: string) =>
      patch<Player>(`/players/${id}`, update, { "X-Admin-Password": pw }),
    deletePlayer: (id: number, pw: string) =>
      del(`/players/${id}`, { "X-Admin-Password": pw }),
    createCourse: (name: string, location: string | null, pw: string) =>
      post<CourseOut>("/courses", { name, location }, { "X-Admin-Password": pw }),
    deleteCourse: (id: number, pw: string) =>
      del(`/courses/${id}`, { "X-Admin-Password": pw }),
    addHole: (courseId: number, hole: { number: number; par: number; yardage?: number; hdcp_index: number }, pw: string) =>
      post<HoleOut>(`/courses/${courseId}/holes`, hole, { "X-Admin-Password": pw }),
    updateHole: (courseId: number, holeId: number, hole: { number: number; par: number; yardage?: number; hdcp_index: number }, pw: string) =>
      patch<HoleOut>(`/courses/${courseId}/holes/${holeId}`, hole, { "X-Admin-Password": pw }),
  },
};
