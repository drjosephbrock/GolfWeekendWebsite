from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
from collections import defaultdict

from ..database import get_db
from ..models import LedgerEntry, LedgerSplit, Player
from ..schemas import LedgerEntryCreate, LedgerEntryOut, Balance
from ..config import settings

router = APIRouter(prefix="/api/ledger", tags=["ledger"])


def require_admin(x_admin_password: Optional[str] = Header(None)):
    if x_admin_password != settings.admin_password:
        raise HTTPException(status_code=403, detail="Admin access required")


# ── Entries ───────────────────────────────────────────────────────────────────

@router.get("", response_model=list[LedgerEntryOut])
def list_entries(db: Session = Depends(get_db)):
    return (
        db.query(LedgerEntry)
        .order_by(LedgerEntry.created_at.desc())
        .all()
    )


@router.post("", response_model=LedgerEntryOut)
def create_entry(
    payload: LedgerEntryCreate,
    created_by: int,            # passed as query param (from localStorage identity)
    db: Session = Depends(get_db),
):
    # Validate players exist
    all_ids = {payload.payer_id, created_by} | {s.player_id for s in payload.splits}
    players = {p.id for p in db.query(Player).filter(Player.id.in_(all_ids)).all()}
    missing = all_ids - players
    if missing:
        raise HTTPException(status_code=404, detail=f"Players not found: {missing}")

    # Validate splits sum to amount (within $0.01 rounding)
    split_total = sum(s.amount for s in payload.splits)
    if abs(split_total - payload.amount) > 0.01:
        raise HTTPException(
            status_code=422,
            detail=f"Splits total ${split_total:.2f} must equal amount ${payload.amount:.2f}",
        )

    entry = LedgerEntry(
        created_by=created_by,
        payer_id=payload.payer_id,
        amount=payload.amount,
        description=payload.description,
        category=payload.category,
        round_id=payload.round_id,
    )
    db.add(entry)
    db.flush()

    for s in payload.splits:
        db.add(LedgerSplit(entry_id=entry.id, player_id=s.player_id, amount=s.amount))

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}")
def delete_entry(
    entry_id: int,
    requesting_player: Optional[int] = None,
    x_admin_password: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    is_admin = x_admin_password == settings.admin_password
    is_owner = requesting_player == entry.created_by

    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="You can only delete your own entries")

    db.delete(entry)
    db.commit()
    return {"ok": True}


@router.patch("/{entry_id}", response_model=LedgerEntryOut)
def update_entry(
    entry_id: int,
    payload: LedgerEntryCreate,
    requesting_player: Optional[int] = None,
    x_admin_password: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    is_admin = x_admin_password == settings.admin_password
    is_owner = requesting_player == entry.created_by

    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="You can only edit your own entries")

    split_total = sum(s.amount for s in payload.splits)
    if abs(split_total - payload.amount) > 0.01:
        raise HTTPException(status_code=422, detail=f"Splits total ${split_total:.2f} ≠ amount ${payload.amount:.2f}")

    entry.payer_id = payload.payer_id
    entry.amount = payload.amount
    entry.description = payload.description
    entry.category = payload.category
    entry.round_id = payload.round_id

    # Replace splits
    for s in entry.splits:
        db.delete(s)
    db.flush()
    for s in payload.splits:
        db.add(LedgerSplit(entry_id=entry.id, player_id=s.player_id, amount=s.amount))

    db.commit()
    db.refresh(entry)
    return entry


# ── Balances ──────────────────────────────────────────────────────────────────

@router.get("/balances", response_model=list[Balance])
def get_balances(db: Session = Depends(get_db)):
    """
    For every ledger entry: payer is owed money by each split recipient (excluding self-splits).
    net[a][b] = amount b owes a.
    Return only positive net balances as (from=b, to=a, amount).
    """
    entries = db.query(LedgerEntry).all()
    players = {p.id: p.name for p in db.query(Player).all()}

    # net[debtor][creditor] = amount debtor owes creditor
    net: dict[int, dict[int, float]] = defaultdict(lambda: defaultdict(float))

    for entry in entries:
        payer = entry.payer_id
        for split in entry.splits:
            debtor = split.player_id
            if debtor == payer:
                continue                    # payer doesn't owe themselves
            net[debtor][payer] += split.amount

    # Collapse bilateral debts: if A owes B $30 and B owes A $10, net is A owes B $20
    balances: list[Balance] = []
    seen: set[tuple[int, int]] = set()

    for debtor, creditors in net.items():
        for creditor, amount in creditors.items():
            if (creditor, debtor) in seen:
                continue
            seen.add((debtor, creditor))
            reverse = net.get(creditor, {}).get(debtor, 0.0)
            net_amount = round(amount - reverse, 2)
            if net_amount > 0.005:
                balances.append(Balance(
                    from_player_id=debtor,
                    from_player_name=players.get(debtor, f"#{debtor}"),
                    to_player_id=creditor,
                    to_player_name=players.get(creditor, f"#{creditor}"),
                    amount=net_amount,
                ))
            elif net_amount < -0.005:
                balances.append(Balance(
                    from_player_id=creditor,
                    from_player_name=players.get(creditor, f"#{creditor}"),
                    to_player_id=debtor,
                    to_player_name=players.get(debtor, f"#{debtor}"),
                    amount=round(-net_amount, 2),
                ))

    return sorted(balances, key=lambda b: -b.amount)
