"""Skins scoring engine with carry-over on ties."""

from typing import Optional
from .models import HoleSetup, SkinsHoleResult, SkinsRoundResult


def score_skins(
    player_ids: list[int],
    holes: list[HoleSetup],
    gross_scores: dict[int, list[int]],  # player_id -> list of gross per hole
    dollars_per_skin: int,
) -> SkinsRoundResult:
    hole_results: list[SkinsHoleResult] = []
    winnings: dict[int, int] = {pid: 0 for pid in player_ids}
    carry = 0  # accumulated pot from tied holes

    for i, hole in enumerate(holes):
        pot = dollars_per_skin + carry
        scores = {pid: gross_scores[pid][i] for pid in player_ids}
        low = min(scores.values())
        winners = [pid for pid, s in scores.items() if s == low]

        if len(winners) == 1:
            winner: Optional[int] = winners[0]
            winnings[winners[0]] += pot
            carried = False
            carry = 0
        else:
            winner = None
            carried = True
            carry = pot

        hole_results.append(SkinsHoleResult(
            hole=hole,
            gross_scores=scores,
            skin_winner=winner,
            pot_value=pot,
            carried_over=carried,
        ))

    return SkinsRoundResult(
        holes=hole_results,
        dollars_per_skin=dollars_per_skin,
        winnings=winnings,
    )
