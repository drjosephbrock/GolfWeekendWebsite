from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..models import Round, GameFormat
from ..routers.rounds import (
    _get_round_or_404, _holes_for_round, _to_hole_setup,
    _scores_map, _scores_as_lists,
)
from ..scoring import score_match, score_best_ball, score_stroke_round
from ..scoring.models import HoleSetup

router = APIRouter(prefix="/api/rydercup", tags=["rydercup"])

SESSION_ORDER = [
    GameFormat.alternate_shot,
    GameFormat.scramble,
    GameFormat.best_ball,
    GameFormat.match_play,
]

SESSION_LABELS = {
    GameFormat.alternate_shot: "Alternate Shot",
    GameFormat.scramble: "Scramble",
    GameFormat.best_ball: "Best Ball",
    GameFormat.match_play: "Singles",
}


class MatchResult(BaseModel):
    round_id: int
    tee_time_group: Optional[int]
    format: str
    team_a_players: list[str]
    team_b_players: list[str]
    team_a_points: float
    team_b_points: float
    is_complete: bool
    status_display: str          # e.g. "A wins 38–41", "Brock 2&1", "In progress: A 1 up"


class SessionSummary(BaseModel):
    format: str
    label: str
    team_a_points: float
    team_b_points: float
    matches: list[MatchResult]


class Scoreboard(BaseModel):
    team_a_total: float
    team_b_total: float
    points_available: float
    sessions: list[SessionSummary]


def _extract_points(round: Round, db: Session) -> tuple[float, float, str]:
    """Return (team_a_pts, team_b_pts, status_display) for a Ryder Cup round."""
    try:
        holes = _holes_for_round(round, db)
    except HTTPException:
        return 0.0, 0.0, "Course data missing"

    setups = [_to_hole_setup(h) for h in holes]
    scores_map = _scores_map(round.id, db)
    participants = round.participants

    # Check if any scores exist
    has_scores = any(scores_map.get(p.player_id) for p in participants)
    if not has_scores:
        return 0.0, 0.0, "Not started"

    team_a = [p for p in participants if p.team == "A"]
    team_b = [p for p in participants if p.team == "B"]

    gross_lists = _scores_as_lists(participants, holes, scores_map)
    scores_entered = {pid: any(v > 0 for v in scores) for pid, scores in gross_lists.items()}
    active_players = [p for p in participants if scores_entered.get(p.player_id)]
    holes_played = max((sum(1 for v in gross_lists[p.player_id] if v > 0) for p in active_players), default=0)

    if round.format in (GameFormat.alternate_shot, GameFormat.scramble):
        if not team_a or not team_b:
            return 0.0, 0.0, "No teams set"
        a_gross = sum(v for v in gross_lists[team_a[0].player_id] if v > 0)
        b_gross = sum(v for v in gross_lists[team_b[0].player_id] if v > 0)
        a_par = sum(h.par for h, g in zip(holes, gross_lists[team_a[0].player_id]) if g > 0)
        b_par = sum(h.par for h, g in zip(holes, gross_lists[team_b[0].player_id]) if g > 0)

        if not round.is_complete:
            a_vs = a_gross - a_par; b_vs = b_gross - b_par
            return 0.0, 0.0, f"Thru {holes_played} — A: {_vs(a_gross, a_par)} B: {_vs(b_gross, b_par)}"

        if a_gross < b_gross:
            return 1.0, 0.0, f"A wins {a_gross}–{b_gross}"
        elif b_gross < a_gross:
            return 0.0, 1.0, f"B wins {b_gross}–{a_gross}"
        return 0.5, 0.5, f"Halved {a_gross}"

    if round.format == GameFormat.best_ball:
        hdcps = {p.player_id: int(p.handicap_snapshot) for p in participants}
        ta = {p.player_id: hdcps[p.player_id] for p in team_a}
        tb = {p.player_id: hdcps[p.player_id] for p in team_b}
        if not ta or not tb:
            return 0.0, 0.0, "No teams set"
        result = score_best_ball(ta, tb, setups, gross_lists)
        ap, bp = result.team_a_points, result.team_b_points

        if not round.is_complete:
            remaining = round.holes_count - holes_played
            return 0.0, 0.0, f"Thru {holes_played} — A {ap:.0f} B {bp:.0f} ({remaining} left)"

        if ap > bp:
            return 1.0, 0.0, f"A wins {ap:.0f}–{bp:.0f} holes"
        elif bp > ap:
            return 0.0, 1.0, f"B wins {bp:.0f}–{ap:.0f} holes"
        return 0.5, 0.5, "Halved"

    if round.format == GameFormat.match_play:
        if len(team_a) != 1 or len(team_b) != 1:
            return 0.0, 0.0, "Invalid match play setup"
        pa, pb = team_a[0], team_b[0]
        result = score_match(
            pa.player_id, pb.player_id,
            int(pa.handicap_snapshot), int(pb.handicap_snapshot),
            setups,
            gross_lists[pa.player_id],
            gross_lists[pb.player_id],
        )
        if not round.is_complete:
            status = result.holes[-1].running_status if result.holes else 0
            lead = abs(status)
            remaining = round.holes_count - holes_played
            if status == 0:
                disp = f"Thru {holes_played} — All Square"
            else:
                side = "A" if status > 0 else "B"
                disp = f"Thru {holes_played} — {side} {lead} up"
            return 0.0, 0.0, disp

        if result.winner == pa.player_id:
            return 1.0, 0.0, f"A {result.status_display}"
        elif result.winner == pb.player_id:
            return 0.0, 1.0, f"B {result.status_display}"
        return 0.5, 0.5, f"Halved — {result.status_display}"

    return 0.0, 0.0, "Unknown format"


def _vs(gross: int, par: int) -> str:
    diff = gross - par
    return "E" if diff == 0 else f"+{diff}" if diff > 0 else str(diff)


@router.get("/scoreboard", response_model=Scoreboard)
def get_scoreboard(db: Session = Depends(get_db)):
    rounds = (
        db.query(Round)
        .filter(Round.is_ryder_cup == True)
        .order_by(Round.tee_time_group, Round.date)
        .all()
    )

    sessions: dict[GameFormat, list[MatchResult]] = {f: [] for f in SESSION_ORDER}
    team_a_total = 0.0
    team_b_total = 0.0
    points_available = 0.0

    for r in rounds:
        fmt = r.format
        if fmt not in sessions:
            continue

        a_pts, b_pts, status = _extract_points(r, db)
        team_a_total += a_pts
        team_b_total += b_pts

        # Points available: complete matches consumed, in-progress still up for grabs
        if r.is_complete:
            points_available += 1.0  # already decided
        else:
            points_available += 1.0  # still in play

        team_a_names = [p.player_name for p in r.participants if p.team == "A"]
        team_b_names = [p.player_name for p in r.participants if p.team == "B"]

        sessions[fmt].append(MatchResult(
            round_id=r.id,
            tee_time_group=r.tee_time_group,
            format=fmt.value,
            team_a_players=team_a_names,
            team_b_players=team_b_names,
            team_a_points=a_pts,
            team_b_points=b_pts,
            is_complete=r.is_complete,
            status_display=status,
        ))

    session_summaries = []
    for fmt in SESSION_ORDER:
        matches = sessions[fmt]
        if not matches:
            continue
        session_summaries.append(SessionSummary(
            format=fmt.value,
            label=SESSION_LABELS[fmt],
            team_a_points=sum(m.team_a_points for m in matches),
            team_b_points=sum(m.team_b_points for m in matches),
            matches=sorted(matches, key=lambda m: m.tee_time_group or 0),
        ))

    return Scoreboard(
        team_a_total=team_a_total,
        team_b_total=team_b_total,
        points_available=points_available,
        sessions=session_summaries,
    )
