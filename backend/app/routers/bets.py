from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional, List

from ..database import get_db
from ..models import Bet, BetParticipant, BetType, Round, Hole, HoleScore, Player
from ..schemas import BetCreate, BetOut, SkinsResultOut, SkinsHoleOut
from ..config import settings
from ..scoring.skins import score_skins
from ..scoring.models import HoleSetup

router = APIRouter(prefix="/api/rounds", tags=["bets"])


def require_admin(x_admin_password: Optional[str] = Header(None)):
    if x_admin_password != settings.admin_password:
        raise HTTPException(status_code=403, detail="Admin access required")


@router.post("/{round_id}/bets", response_model=BetOut)
def create_bet(
    round_id: int,
    bet: BetCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    if not db.query(Round).filter(Round.id == round_id).first():
        raise HTTPException(status_code=404, detail="Round not found")

    participant_ids = list(dict.fromkeys(bet.participant_ids))  # dedupe, preserve order
    for pid in participant_ids:
        if not db.query(Player).filter(Player.id == pid).first():
            raise HTTPException(status_code=404, detail=f"Player {pid} not found")

    db_bet = Bet(round_id=round_id, type=bet.type, dollars_per_unit=bet.dollars_per_unit)
    db.add(db_bet)
    db.flush()

    for pid in participant_ids:
        db.add(BetParticipant(bet_id=db_bet.id, player_id=pid))

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
    bet = db.query(Bet).filter(Bet.id == bet_id, Bet.round_id == round_id).first()
    if not bet:
        raise HTTPException(status_code=404, detail="Bet not found")
    db.delete(bet)
    db.commit()
    return {"ok": True}


@router.get("/{round_id}/bets/{bet_id}/skins", response_model=SkinsResultOut)
def get_skins_result(round_id: int, bet_id: int, db: Session = Depends(get_db)):
    bet = db.query(Bet).filter(Bet.id == bet_id, Bet.round_id == round_id).first()
    if not bet:
        raise HTTPException(status_code=404, detail="Bet not found")
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

    # Load course holes up to round's holes_count
    holes = (
        db.query(Hole)
        .filter(Hole.course_id == round_.course_id, Hole.number <= round_.holes_count)
        .order_by(Hole.number)
        .all()
    )
    if not holes:
        return empty

    # Build {player_id -> {hole_number -> gross}}
    all_scores = (
        db.query(HoleScore)
        .filter(HoleScore.round_id == round_id, HoleScore.player_id.in_(participant_ids))
        .all()
    )
    hole_by_id = {h.id: h for h in db.query(Hole).filter(Hole.course_id == round_.course_id).all()}
    score_map: dict[int, dict[int, int]] = {pid: {} for pid in participant_ids}
    for hs in all_scores:
        h = hole_by_id.get(hs.hole_id)
        if h:
            score_map[hs.player_id][h.number] = hs.gross

    # Only score holes where every participant has entered a score
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
