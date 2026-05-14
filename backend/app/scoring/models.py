from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class HoleSetup:
    number: int       # 1-18
    par: int
    hdcp_index: int   # 1-18, difficulty ranking (1 = hardest)


@dataclass(frozen=True)
class PlayerScore:
    player_id: int
    gross: int        # strokes taken on hole


# ── Stroke play ──────────────────────────────────────────────────────────────

@dataclass
class StrokeHoleResult:
    hole: HoleSetup
    scores: dict[int, int]          # player_id -> gross strokes
    net_scores: dict[int, int]      # player_id -> net strokes (after hdcp)


@dataclass
class StrokeRoundResult:
    holes: list[StrokeHoleResult]
    gross_totals: dict[int, int]    # player_id -> total gross
    net_totals: dict[int, int]      # player_id -> total net


# ── Best-ball ─────────────────────────────────────────────────────────────────

@dataclass
class BestBallHoleResult:
    hole: HoleSetup
    team_a_scores: dict[int, int]   # player_id -> net score
    team_b_scores: dict[int, int]
    team_a_best: int
    team_b_best: int
    winner: Optional[str]           # "A", "B", or None (halved)


@dataclass
class BestBallRoundResult:
    holes: list[BestBallHoleResult]
    team_a_points: float
    team_b_points: float


# ── Match play ────────────────────────────────────────────────────────────────

@dataclass
class MatchHoleResult:
    hole: HoleSetup
    player_a_net: int
    player_b_net: int
    winner: Optional[int]           # player_id or None (halved)
    running_status: int             # positive = A leads, negative = B leads


@dataclass
class MatchRoundResult:
    holes: list[MatchHoleResult]
    winner: Optional[int]           # player_id or None (all square / unfinished)
    margin: int                     # holes up at finish
    status_display: str             # e.g. "3&2", "All Square", "1 Up"


# ── TILT ──────────────────────────────────────────────────────────────────────

@dataclass
class TiltHoleResult:
    hole: HoleSetup
    gross: int
    score_vs_par: int               # gross - par
    multiplier_applied: int         # tilt factor used this hole
    base_points: int
    actual_points: int
    on_tilt_after: bool             # tilt state heading into next hole
    multiplier_after: int


@dataclass
class TiltPlayerResult:
    player_id: int
    holes: list[TiltHoleResult]
    total_points: int


# ── Skins ─────────────────────────────────────────────────────────────────────

@dataclass
class SkinsHoleResult:
    hole: HoleSetup
    gross_scores: dict[int, int]    # player_id -> gross
    skin_winner: Optional[int]      # player_id or None (tied = carry)
    pot_value: int                  # dollar value of pot this hole
    carried_over: bool


@dataclass
class SkinsRoundResult:
    holes: list[SkinsHoleResult]
    dollars_per_skin: int
    winnings: dict[int, int]        # player_id -> dollars won
