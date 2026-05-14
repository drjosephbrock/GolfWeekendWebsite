from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .models import GameFormat, LedgerCategory, BetType


# ── Players ───────────────────────────────────────────────────────────────────

class PlayerBase(BaseModel):
    name: str
    handicap: float
    team: Optional[str] = None
    nickname: Optional[str] = None
    hometown: Optional[str] = None
    fun_fact: Optional[str] = None


class PlayerCreate(PlayerBase):
    pass


class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    handicap: Optional[float] = None
    team: Optional[str] = None
    is_active: Optional[bool] = None
    nickname: Optional[str] = None
    hometown: Optional[str] = None
    fun_fact: Optional[str] = None


class PlayerBioUpdate(BaseModel):
    nickname: Optional[str] = None
    hometown: Optional[str] = None
    fun_fact: Optional[str] = None


class Player(PlayerBase):
    id: int
    is_active: bool

    model_config = {"from_attributes": True}


# ── Courses ───────────────────────────────────────────────────────────────────

class HoleBase(BaseModel):
    number: int
    par: int
    yardage: Optional[int] = None
    hdcp_index: int


class HoleCreate(HoleBase):
    pass


class HoleOut(HoleBase):
    id: int
    course_id: int

    model_config = {"from_attributes": True}


class CourseBase(BaseModel):
    name: str
    location: Optional[str] = None


class CourseCreate(CourseBase):
    pass


class CourseOut(CourseBase):
    id: int
    holes: list[HoleOut] = []

    model_config = {"from_attributes": True}


# ── Rounds ────────────────────────────────────────────────────────────────────

class ParticipantIn(BaseModel):
    player_id: int
    team: Optional[str] = None        # "A" or "B"
    handicap_override: Optional[float] = None  # use player's current hdcp if omitted


class RoundCreate(BaseModel):
    course_id: int
    format: GameFormat
    holes_count: int = 18
    label: Optional[str] = None
    is_ryder_cup: bool = False
    tee_time_group: Optional[int] = None
    participants: list[ParticipantIn]


class ParticipantOut(BaseModel):
    player_id: int
    player_name: str
    team: Optional[str]
    handicap_snapshot: float

    model_config = {"from_attributes": True}


class RoundOut(BaseModel):
    id: int
    course_id: int
    format: GameFormat
    holes_count: int
    label: Optional[str]
    date: datetime
    is_complete: bool
    is_ryder_cup: bool = False
    tee_time_group: Optional[int] = None
    participants: list[ParticipantOut] = []

    model_config = {"from_attributes": True}


# ── Score entry ───────────────────────────────────────────────────────────────

class HoleScoreIn(BaseModel):
    hole_number: int
    gross: int


class ScoresBatch(BaseModel):
    player_id: int
    scores: list[HoleScoreIn]   # can be partial (hole-by-hole entry)


# ── Ledger ────────────────────────────────────────────────────────────────────

class SplitIn(BaseModel):
    player_id: int
    amount: float


class LedgerEntryCreate(BaseModel):
    payer_id: int
    amount: float
    description: str
    category: LedgerCategory
    round_id: Optional[int] = None
    splits: list[SplitIn]       # must sum to amount; payer's own share included if they split with themselves


class SplitOut(BaseModel):
    player_id: int
    player_name: str
    amount: float

    model_config = {"from_attributes": True}


class LedgerEntryOut(BaseModel):
    id: int
    created_by: int
    creator_name: str
    payer_id: int
    payer_name: str
    amount: float
    description: str
    category: LedgerCategory
    round_id: Optional[int]
    created_at: datetime
    splits: list[SplitOut] = []

    model_config = {"from_attributes": True}


# ── Bets ──────────────────────────────────────────────────────────────────────

class BetParticipantOut(BaseModel):
    player_id: int
    player_name: str

    model_config = {"from_attributes": True}


class BetCreate(BaseModel):
    type: BetType
    dollars_per_unit: float
    participant_ids: list[int]


class BetOut(BaseModel):
    id: int
    round_id: int
    type: BetType
    dollars_per_unit: float
    participants: list[BetParticipantOut]

    model_config = {"from_attributes": True}


class SkinsHoleOut(BaseModel):
    hole_number: int
    par: int
    gross_scores: dict[str, int]        # player_id str -> gross
    skin_winner_id: Optional[int]
    pot_value: float
    carried_over: bool


class SkinsResultOut(BaseModel):
    bet_id: int
    dollars_per_skin: float
    holes: list[SkinsHoleOut]
    winnings: dict[str, float]          # player_id str -> dollars won
    is_partial: bool
    participant_ids: list[int]


class Balance(BaseModel):
    from_player_id: int
    from_player_name: str
    to_player_id: int
    to_player_name: str
    amount: float               # from_player owes to_player this amount
