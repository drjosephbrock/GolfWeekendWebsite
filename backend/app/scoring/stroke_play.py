"""Stroke play scoring engine."""

from .models import HoleSetup, StrokeHoleResult, StrokeRoundResult
from .handicap import net_score


def score_stroke_round(
    player_handicaps: dict[int, int],   # player_id -> handicap
    holes: list[HoleSetup],
    gross_scores: dict[int, list[int]], # player_id -> list of gross per hole
) -> StrokeRoundResult:
    hole_results: list[StrokeHoleResult] = []
    gross_totals: dict[int, int] = {pid: 0 for pid in player_handicaps}
    net_totals: dict[int, int] = {pid: 0 for pid in player_handicaps}

    for i, hole in enumerate(holes):
        gross_map: dict[int, int] = {}
        net_map: dict[int, int] = {}

        for pid, hdcp in player_handicaps.items():
            gross = gross_scores[pid][i]
            net = net_score(gross, hdcp, hole)
            gross_map[pid] = gross
            net_map[pid] = net
            gross_totals[pid] += gross
            net_totals[pid] += net

        hole_results.append(StrokeHoleResult(hole=hole, scores=gross_map, net_scores=net_map))

    return StrokeRoundResult(holes=hole_results, gross_totals=gross_totals, net_totals=net_totals)
