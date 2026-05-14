from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
import dataclasses

from ..database import get_db
from ..models import Round, RoundParticipant, Hole, HoleScore, Player, GameFormat
from ..schemas import RoundCreate, RoundOut, ScoresBatch, ParticipantOut
from ..config import settings
from ..scoring.models import HoleSetup
from ..scoring import (
    score_tilt_round,
    score_match,
    score_stroke_round,
    score_best_ball,
    score_skins,
)

router = APIRouter(prefix="/api/rounds", tags=["rounds"])


def require_admin(x_admin_password: Optional[str] = Header(None)):
    if x_admin_password != settings.admin_password:
        raise HTTPException(status_code=403, detail="Admin access required")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_round_or_404(round_id: int, db: Session) -> Round:
    r = db.query(Round).filter(Round.id == round_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Round not found")
    return r


def _holes_for_round(round: Round, db: Session) -> list[Hole]:
    holes = (
        db.query(Hole)
        .filter(Hole.course_id == round.course_id)
        .order_by(Hole.number)
        .limit(round.holes_count)
        .all()
    )
    if len(holes) < round.holes_count:
        raise HTTPException(
            status_code=422,
            detail=f"Course only has {len(holes)} holes, round requires {round.holes_count}",
        )
    return holes


def _to_hole_setup(hole: Hole) -> HoleSetup:
    return HoleSetup(number=hole.number, par=hole.par, hdcp_index=hole.hdcp_index)


def _scores_map(round_id: int, db: Session) -> dict[int, dict[int, int]]:
    """Returns {player_id: {hole_number: gross}}."""
    scores = db.query(HoleScore).filter(HoleScore.round_id == round_id).all()
    result: dict[int, dict[int, int]] = {}
    for s in scores:
        result.setdefault(s.player_id, {})[s.hole.number] = s.gross
    return result


def _scores_as_lists(
    participants: list[RoundParticipant],
    holes: list[Hole],
    scores_map: dict[int, dict[int, int]],
) -> dict[int, list[int]]:
    """Convert scores_map to {player_id: [gross_per_hole_in_order]}."""
    result = {}
    for p in participants:
        hole_scores = scores_map.get(p.player_id, {})
        result[p.player_id] = [hole_scores.get(h.number, 0) for h in holes]
    return result


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[RoundOut])
def list_rounds(db: Session = Depends(get_db)):
    return db.query(Round).order_by(Round.date.desc()).all()


@router.get("/{round_id}", response_model=RoundOut)
def get_round(round_id: int, db: Session = Depends(get_db)):
    return _get_round_or_404(round_id, db)


@router.post("", response_model=RoundOut)
def create_round(payload: RoundCreate, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    player_ids = [p.player_id for p in payload.participants]
    players = {p.id: p for p in db.query(Player).filter(Player.id.in_(player_ids)).all()}

    missing = set(player_ids) - set(players.keys())
    if missing:
        raise HTTPException(status_code=404, detail=f"Players not found: {missing}")

    db_round = Round(
        course_id=payload.course_id,
        format=payload.format,
        holes_count=payload.holes_count,
        label=payload.label,
        is_ryder_cup=payload.is_ryder_cup,
        tee_time_group=payload.tee_time_group,
    )
    db.add(db_round)
    db.flush()

    for p in payload.participants:
        hdcp = p.handicap_override if p.handicap_override is not None else players[p.player_id].handicap
        db.add(RoundParticipant(
            round_id=db_round.id,
            player_id=p.player_id,
            team=p.team,
            handicap_snapshot=hdcp,
        ))

    db.commit()
    db.refresh(db_round)
    return db_round


@router.patch("/{round_id}/complete")
def mark_complete(round_id: int, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    r = _get_round_or_404(round_id, db)
    r.is_complete = True
    db.commit()
    return {"ok": True}


@router.delete("/{round_id}")
def delete_round(round_id: int, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    r = _get_round_or_404(round_id, db)
    db.query(HoleScore).filter(HoleScore.round_id == round_id).delete()
    db.query(RoundParticipant).filter(RoundParticipant.round_id == round_id).delete()
    db.delete(r)
    db.commit()
    return {"ok": True}


# ── Score entry ───────────────────────────────────────────────────────────────

@router.post("/{round_id}/scores")
def enter_scores(round_id: int, payload: ScoresBatch, db: Session = Depends(get_db)):
    r = _get_round_or_404(round_id, db)

    participant = next(
        (p for p in r.participants if p.player_id == payload.player_id), None
    )
    if not participant:
        raise HTTPException(status_code=403, detail="Player is not in this round")

    holes = {h.number: h for h in _holes_for_round(r, db)}

    for entry in payload.scores:
        hole = holes.get(entry.hole_number)
        if not hole:
            raise HTTPException(
                status_code=404, detail=f"Hole {entry.hole_number} not found on this course"
            )
        existing = (
            db.query(HoleScore)
            .filter_by(round_id=round_id, player_id=payload.player_id, hole_id=hole.id)
            .first()
        )
        if existing:
            existing.gross = entry.gross
        else:
            db.add(HoleScore(
                round_id=round_id,
                player_id=payload.player_id,
                hole_id=hole.id,
                gross=entry.gross,
            ))

    db.commit()
    return {"ok": True, "holes_entered": len(payload.scores)}


# ── Scorecard ─────────────────────────────────────────────────────────────────

@router.get("/{round_id}/scorecard")
def get_scorecard(round_id: int, db: Session = Depends(get_db)):
    r = _get_round_or_404(round_id, db)
    holes = _holes_for_round(r, db)
    setups = [_to_hole_setup(h) for h in holes]
    participants = r.participants
    scores_map = _scores_map(round_id, db)
    gross_lists = _scores_as_lists(participants, holes, scores_map)

    hdcps = {p.player_id: int(p.handicap_snapshot) for p in participants}

    if r.format == GameFormat.tilt:
        results = [
            dataclasses.asdict(score_tilt_round(
                player_id=p.player_id,
                holes=setups,
                gross_scores=gross_lists[p.player_id],
            ))
            for p in participants
        ]
        return {"format": r.format, "results": results}

    if r.format == GameFormat.stroke_play:
        result = score_stroke_round(
            player_handicaps=hdcps,
            holes=setups,
            gross_scores=gross_lists,
        )
        return {"format": r.format, "result": dataclasses.asdict(result)}

    if r.format == GameFormat.match_play:
        team_a = [p for p in participants if p.team == "A"]
        team_b = [p for p in participants if p.team == "B"]
        if len(team_a) != 1 or len(team_b) != 1:
            raise HTTPException(status_code=422, detail="Match play requires exactly 1 player per team")
        pa, pb = team_a[0], team_b[0]
        result = score_match(
            player_a_id=pa.player_id,
            player_b_id=pb.player_id,
            handicap_a=int(pa.handicap_snapshot),
            handicap_b=int(pb.handicap_snapshot),
            holes=setups,
            gross_a=gross_lists[pa.player_id],
            gross_b=gross_lists[pb.player_id],
        )
        return {"format": r.format, "result": dataclasses.asdict(result)}

    if r.format == GameFormat.best_ball:
        team_a = {p.player_id: int(p.handicap_snapshot) for p in participants if p.team == "A"}
        team_b = {p.player_id: int(p.handicap_snapshot) for p in participants if p.team == "B"}
        if not team_a or not team_b:
            raise HTTPException(status_code=422, detail="Best-ball requires players on team A and team B")
        result = score_best_ball(
            team_a=team_a,
            team_b=team_b,
            holes=setups,
            gross_scores=gross_lists,
        )
        return {"format": r.format, "result": dataclasses.asdict(result)}

    if r.format in (GameFormat.alternate_shot, GameFormat.scramble):
        # One score per team per hole — stored under one player, applied as team score.
        # Return raw stroke totals per team side.
        team_a = [p for p in participants if p.team == "A"]
        team_b = [p for p in participants if p.team == "B"]

        def team_totals(team: list[RoundParticipant]) -> dict:
            # Use first player's scores as the team score (both are identical for alt/scramble)
            if not team:
                return {}
            gross = gross_lists[team[0].player_id]
            pars = [h.par for h in holes]
            return {
                "gross_total": sum(gross),
                "vs_par": sum(g - p for g, p in zip(gross, pars)),
                "hole_scores": [
                    {"hole": h.number, "par": h.par, "gross": g}
                    for h, g in zip(holes, gross)
                ],
            }

        return {
            "format": r.format,
            "team_a": team_totals(team_a),
            "team_b": team_totals(team_b),
        }

    raise HTTPException(status_code=422, detail=f"Unsupported format: {r.format}")
