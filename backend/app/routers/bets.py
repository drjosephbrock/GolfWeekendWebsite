from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional, List

from ..database import get_db
from ..models import Bet, BetParticipant, BetType, Round, Hole, HoleScore, Player, RoundParticipant
from ..schemas import (
    BetCreate, BetOut,
    SkinsResultOut, SkinsHoleOut,
    StrokeMatchResultOut, StrokeMatchHoleOut, StrokeMatchSideOut,
)
from ..config import settings
from ..scoring.skins import score_skins
from ..scoring.models import HoleSetup
from ..scoring.handicap import net_score

router = APIRouter(prefix="/api/rounds", tags=["bets"])


def require_admin(x_admin_password: Optional[str] = Header(None)):
    if x_admin_password != settings.admin_password:
        raise HTTPException(status_code=403, detail="Admin access required")


def _get_bet_or_404(bet_id: int, round_id: int, db: Session) -> Bet:
    bet = db.query(Bet).filter(Bet.id == bet_id, Bet.round_id == round_id).first()
    if not bet:
        raise HTTPException(status_code=404, detail="Bet not found")
    return bet


def _load_round_holes(round_: Round, db: Session) -> list[Hole]:
    return (
        db.query(Hole)
        .filter(Hole.course_id == round_.course_id, Hole.number <= round_.holes_count)
        .order_by(Hole.number)
        .all()
    )


def _build_score_map(round_id: int, participant_ids: list[int], db: Session) -> dict[int, dict[int, int]]:
    """Returns {player_id -> {hole_number -> gross}}."""
    all_scores = (
        db.query(HoleScore)
        .filter(HoleScore.round_id == round_id, HoleScore.player_id.in_(participant_ids))
        .all()
    )
    hole_by_id = {
        h.id: h
        for h in db.query(Hole).filter(
            Hole.course_id == db.query(Round).filter(Round.id == round_id).first().course_id
        ).all()
    }
    score_map: dict[int, dict[int, int]] = {pid: {} for pid in participant_ids}
    for hs in all_scores:
        h = hole_by_id.get(hs.hole_id)
        if h:
            score_map[hs.player_id][h.number] = hs.gross
    return score_map


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("/{round_id}/bets", response_model=BetOut)
def create_bet(
    round_id: int,
    bet: BetCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    if not db.query(Round).filter(Round.id == round_id).first():
        raise HTTPException(status_code=404, detail="Round not found")

    seen: set[int] = set()
    deduped = [p for p in bet.participants if not (p.player_id in seen or seen.add(p.player_id))]  # type: ignore[func-returns-value]

    for p in deduped:
        if not db.query(Player).filter(Player.id == p.player_id).first():
            raise HTTPException(status_code=404, detail=f"Player {p.player_id} not found")

    db_bet = Bet(round_id=round_id, type=bet.type, dollars_per_unit=bet.dollars_per_unit)
    db.add(db_bet)
    db.flush()

    for p in deduped:
        db.add(BetParticipant(bet_id=db_bet.id, player_id=p.player_id, team=p.team))

    db.commit()
    db.refresh(db_bet)
    return db_bet


@router.get("/{round_id}/bets", response_model=List[BetOut])
def list_bets(round_id: int, db: Session = Depends(get_db)):
    return db.query(Bet).filter(Bet.round_id == round_id).all()


@router.delete("/{round_id}/bets/{bet_id}")
def delete_bet(
    round_id: int,
    bet_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    bet = _get_bet_or_404(bet_id, round_id, db)
    db.delete(bet)
    db.commit()
    return {"ok": True}


# ── Skins ─────────────────────────────────────────────────────────────────────

@router.get("/{round_id}/bets/{bet_id}/skins", response_model=SkinsResultOut)
def get_skins_result(round_id: int, bet_id: int, db: Session = Depends(get_db)):
    bet = _get_bet_or_404(bet_id, round_id, db)
    if bet.type != BetType.skins:
        raise HTTPException(status_code=400, detail="Not a skins bet")

    round_ = db.query(Round).filter(Round.id == round_id).first()
    participant_ids = [p.player_id for p in bet.participants]

    empty = SkinsResultOut(
        bet_id=bet_id,
        dollars_per_skin=bet.dollars_per_unit,
        holes=[],
        winnings={str(pid): 0.0 for pid in participant_ids},
        is_partial=True,
        participant_ids=participant_ids,
    )
    if not participant_ids:
        return empty

    holes = _load_round_holes(round_, db)
    if not holes:
        return empty

    score_map = _build_score_map(round_id, participant_ids, db)
    complete_holes = [h for h in holes if all(h.number in score_map[pid] for pid in participant_ids)]
    is_partial = len(complete_holes) < len(holes) or not round_.is_complete

    if not complete_holes:
        return empty

    hole_setups = [HoleSetup(number=h.number, par=h.par, hdcp_index=h.hdcp_index) for h in complete_holes]
    gross_scores = {pid: [score_map[pid][h.number] for h in complete_holes] for pid in participant_ids}
    result = score_skins(participant_ids, hole_setups, gross_scores, int(bet.dollars_per_unit))

    return SkinsResultOut(
        bet_id=bet_id,
        dollars_per_skin=bet.dollars_per_unit,
        holes=[
            SkinsHoleOut(
                hole_number=hr.hole.number,
                par=hr.hole.par,
                gross_scores={str(pid): gross for pid, gross in hr.gross_scores.items()},
                skin_winner_id=hr.skin_winner,
                pot_value=float(hr.pot_value),
                carried_over=hr.carried_over,
            )
            for hr in result.holes
        ],
        winnings={str(pid): float(amt) for pid, amt in result.winnings.items()},
        is_partial=is_partial,
        participant_ids=participant_ids,
    )


# ── Stroke Match ──────────────────────────────────────────────────────────────

@router.get("/{round_id}/bets/{bet_id}/stroke_match", response_model=StrokeMatchResultOut)
def get_stroke_match_result(round_id: int, bet_id: int, db: Session = Depends(get_db)):
    bet = _get_bet_or_404(bet_id, round_id, db)
    if bet.type != BetType.stroke_match:
        raise HTTPException(status_code=400, detail="Not a stroke match bet")

    round_ = db.query(Round).filter(Round.id == round_id).first()

    # Group participants into teams A and B
    team_map: dict[str, list[BetParticipant]] = {"A": [], "B": []}
    for bp in bet.participants:
        t = bp.team or "A"
        team_map.setdefault(t, []).append(bp)

    all_pids = [bp.player_id for bp in bet.participants]

    # Handicap snapshots from RoundParticipant
    rp_rows = db.query(RoundParticipant).filter(
        RoundParticipant.round_id == round_id,
        RoundParticipant.player_id.in_(all_pids),
    ).all()
    hdcp_map = {rp.player_id: int(min(rp.handicap_snapshot, 24)) for rp in rp_rows}

    holes = _load_round_holes(round_, db)
    score_map = _build_score_map(round_id, all_pids, db)

    # Only score holes where every participant has entered a score
    complete_holes = [h for h in holes if all(h.number in score_map[pid] for pid in all_pids)]
    is_partial = len(complete_holes) < len(holes) or not round_.is_complete

    # Build hole-by-hole output
    hole_outs: list[StrokeMatchHoleOut] = []
    net_totals: dict[int, int] = {pid: 0 for pid in all_pids}
    gross_totals: dict[int, int] = {pid: 0 for pid in all_pids}

    for h in complete_holes:
        setup = HoleSetup(number=h.number, par=h.par, hdcp_index=h.hdcp_index)
        gross_row: dict[str, int] = {}
        net_row: dict[str, int] = {}
        for pid in all_pids:
            g = score_map[pid][h.number]
            n = net_score(g, hdcp_map.get(pid, 0), setup)
            gross_row[str(pid)] = g
            net_row[str(pid)] = n
            gross_totals[pid] += g
            net_totals[pid] += n
        hole_outs.append(StrokeMatchHoleOut(
            hole_number=h.number, par=h.par,
            gross_scores=gross_row, net_scores=net_row,
        ))

    # Build sides
    sides: list[StrokeMatchSideOut] = []
    for team_label in ("A", "B"):
        members = team_map.get(team_label, [])
        pids = [bp.player_id for bp in members]
        sides.append(StrokeMatchSideOut(
            team=team_label,
            player_ids=pids,
            player_names=[bp.player_name for bp in members],
            gross_total=sum(gross_totals.get(pid, 0) for pid in pids),
            net_total=sum(net_totals.get(pid, 0) for pid in pids),
        ))

    # Determine winner
    winning_team: Optional[str] = None
    margin = 0
    if complete_holes:
        a_net = sides[0].net_total
        b_net = sides[1].net_total if len(sides) > 1 else 0
        margin = abs(a_net - b_net)
        if a_net < b_net:
            winning_team = "A"
        elif b_net < a_net:
            winning_team = "B"

    return StrokeMatchResultOut(
        bet_id=bet_id,
        dollars=bet.dollars_per_unit,
        holes=hole_outs,
        sides=sides,
        winning_team=winning_team if not is_partial else None,
        margin=margin,
        is_partial=is_partial,
    )
