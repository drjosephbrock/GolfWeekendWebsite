from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models import Round, RoundParticipant, HoleScore, LedgerEntry, LedgerSplit, Player, Bet, BetParticipant
from ..config import settings

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(x_admin_password: Optional[str] = Header(None)):
    if x_admin_password != settings.admin_password:
        raise HTTPException(status_code=403, detail="Admin access required")


@router.post("/verify")
def verify_password(_: None = Depends(require_admin)):
    return {"ok": True}


@router.post("/wipe")
def wipe_seasonal_data(
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """
    Wipes all seasonal data: rounds, scores, ledger.
    Preserves: player profiles, courses, holes.
    Resets all player team assignments to null.
    """
    db.query(HoleScore).delete()
    db.query(BetParticipant).delete()
    db.query(Bet).delete()
    db.query(RoundParticipant).delete()
    db.query(LedgerSplit).delete()
    db.query(LedgerEntry).delete()
    db.query(Round).delete()
    db.query(Player).update({Player.team: None})
    db.commit()
    return {"ok": True, "wiped": ["rounds", "scores", "bets", "ledger", "team_assignments"]}
