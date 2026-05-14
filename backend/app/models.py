from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .database import Base


class GameFormat(str, enum.Enum):
    stroke_play = "stroke_play"
    best_ball = "best_ball"
    alternate_shot = "alternate_shot"
    scramble = "scramble"
    match_play = "match_play"
    tilt = "tilt"


class BetType(str, enum.Enum):
    skins = "skins"
    stroke_match = "stroke_match"
    nassau = "nassau"
    dots = "dots"


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    handicap = Column(Float, nullable=False, default=0.0)
    team = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    nickname = Column(String, nullable=True)
    hometown = Column(String, nullable=True)
    fun_fact = Column(String, nullable=True)


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    holes = relationship("Hole", back_populates="course", order_by="Hole.number")


class Hole(Base):
    __tablename__ = "holes"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    number = Column(Integer, nullable=False)   # 1-18
    par = Column(Integer, nullable=False)
    yardage = Column(Integer, nullable=True)
    hdcp_index = Column(Integer, nullable=False)  # 1-18, difficulty rank

    course = relationship("Course", back_populates="holes")


class Round(Base):
    __tablename__ = "rounds"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    format = Column(SAEnum(GameFormat), nullable=False)
    holes_count = Column(Integer, nullable=False, default=18)  # 9 or 18
    date = Column(DateTime, default=datetime.utcnow)
    is_complete = Column(Boolean, default=False)
    label = Column(String, nullable=True)
    is_ryder_cup = Column(Boolean, default=False)
    tee_time_group = Column(Integer, nullable=True)  # 1-4, for Ryder Cup grouping

    course = relationship("Course")
    participants = relationship("RoundParticipant", back_populates="round")
    hole_scores = relationship("HoleScore", back_populates="round")
    bets = relationship("Bet", back_populates="round", cascade="all, delete-orphan")


class RoundParticipant(Base):
    __tablename__ = "round_participants"

    id = Column(Integer, primary_key=True, index=True)
    round_id = Column(Integer, ForeignKey("rounds.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    # "A" or "B" for team formats; "A"/"B" for match play sides
    team = Column(String, nullable=True)
    # Snapshot of handicap at time of round (may differ from current)
    handicap_snapshot = Column(Float, nullable=False)

    round = relationship("Round", back_populates="participants")
    player = relationship("Player")

    @property
    def player_name(self) -> str:
        return self.player.name if self.player else ""


class LedgerCategory(str, enum.Enum):
    food = "food"
    beer = "beer"
    gatorade = "gatorade"
    buy_in = "buy_in"
    bet = "bet"
    settlement = "settlement"
    other = "other"


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    created_by = Column(Integer, ForeignKey("players.id"), nullable=False)
    payer_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    amount = Column(Float, nullable=False)         # total amount paid
    description = Column(String, nullable=False)
    category = Column(SAEnum(LedgerCategory), nullable=False)
    round_id = Column(Integer, ForeignKey("rounds.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("Player", foreign_keys=[created_by])
    payer = relationship("Player", foreign_keys=[payer_id])
    splits = relationship("LedgerSplit", back_populates="entry", cascade="all, delete-orphan")

    @property
    def payer_name(self) -> str:
        return self.payer.name if self.payer else ""

    @property
    def creator_name(self) -> str:
        return self.creator.name if self.creator else ""


class LedgerSplit(Base):
    __tablename__ = "ledger_splits"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("ledger_entries.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    amount = Column(Float, nullable=False)         # this player's share of the expense

    entry = relationship("LedgerEntry", back_populates="splits")
    player = relationship("Player")

    @property
    def player_name(self) -> str:
        return self.player.name if self.player else ""


class Bet(Base):
    __tablename__ = "bets"

    id = Column(Integer, primary_key=True, index=True)
    round_id = Column(Integer, ForeignKey("rounds.id"), nullable=False)
    type = Column(SAEnum(BetType), nullable=False)
    dollars_per_unit = Column(Float, nullable=False)

    round = relationship("Round", back_populates="bets")
    participants = relationship("BetParticipant", back_populates="bet", cascade="all, delete-orphan")


class BetParticipant(Base):
    __tablename__ = "bet_participants"

    id = Column(Integer, primary_key=True, index=True)
    bet_id = Column(Integer, ForeignKey("bets.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)

    bet = relationship("Bet", back_populates="participants")
    player = relationship("Player")

    @property
    def player_name(self) -> str:
        return self.player.name if self.player else ""


class HoleScore(Base):
    __tablename__ = "hole_scores"

    id = Column(Integer, primary_key=True, index=True)
    round_id = Column(Integer, ForeignKey("rounds.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    hole_id = Column(Integer, ForeignKey("holes.id"), nullable=False)
    gross = Column(Integer, nullable=False)

    round = relationship("Round", back_populates="hole_scores")
    hole = relationship("Hole")
    player = relationship("Player")
