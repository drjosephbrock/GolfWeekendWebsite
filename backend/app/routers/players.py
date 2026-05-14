from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models import Player
from ..schemas import PlayerCreate, PlayerUpdate, PlayerBioUpdate, Player as PlayerSchema
from ..config import settings

router = APIRouter(prefix="/api/players", tags=["players"])


def require_admin(x_admin_password: Optional[str] = Header(None)):
    if x_admin_password != settings.admin_password:
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("", response_model=List[PlayerSchema])
def list_players(db: Session = Depends(get_db)):
    return db.query(Player).filter(Player.is_active == True).order_by(Player.name).all()


@router.get("/{player_id}", response_model=PlayerSchema)
def get_player(player_id: int, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player


@router.post("", response_model=PlayerSchema)
def create_player(
    player: PlayerCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    if db.query(Player).filter(Player.name == player.name).first():
        raise HTTPException(status_code=400, detail="Player name already exists")
    db_player = Player(**player.model_dump())
    db.add(db_player)
    db.commit()
    db.refresh(db_player)
    return db_player


@router.patch("/{player_id}", response_model=PlayerSchema)
def update_player(
    player_id: int,
    update: PlayerUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(player, field, value)
    db.commit()
    db.refresh(player)
    return player


@router.patch("/{player_id}/bio", response_model=PlayerSchema)
def update_player_bio(
    player_id: int,
    update: PlayerBioUpdate,
    db: Session = Depends(get_db),
):
    player = db.query(Player).filter(Player.id == player_id, Player.is_active == True).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(player, field, value)
    db.commit()
    db.refresh(player)
    return player


@router.delete("/{player_id}")
def delete_player(
    player_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    db.delete(player)
    db.commit()
    return {"ok": True}
