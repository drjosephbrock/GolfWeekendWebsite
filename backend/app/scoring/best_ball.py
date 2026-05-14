"""Best-ball (4-ball) scoring engine — 2v2, handicap applied."""

from typing import Optional
from .models import HoleSetup, BestBallHoleResult, BestBallRoundResult
from .handicap import net_score


def score_best_ball(
    team_a: dict[int, int],         # player_id -> handicap
    team_b: dict[int, int],
    holes: list[HoleSetup],
    gross_scores: dict[int, list[int]],  # player_id -> list of gross per hole
) -> BestBallRoundResult:
    hole_results: list[BestBallHoleResult] = []
    team_a_points = 0.0
    team_b_points = 0.0

    for i, hole in enumerate(holes):
        a_nets = {pid: net_score(gross_scores[pid][i], hdcp, hole) for pid, hdcp in team_a.items()}
        b_nets = {pid: net_score(gross_scores[pid][i], hdcp, hole) for pid, hdcp in team_b.items()}

        best_a = min(a_nets.values())
        best_b = min(b_nets.values())

        if best_a < best_b:
            winner: Optional[str] = "A"
            team_a_points += 1
        elif best_b < best_a:
            winner = "B"
            team_b_points += 1
        else:
            winner = None  # halved

        hole_results.append(BestBallHoleResult(
            hole=hole,
            team_a_scores=a_nets,
            team_b_scores=b_nets,
            team_a_best=best_a,
            team_b_best=best_b,
            winner=winner,
        ))

    return BestBallRoundResult(
        holes=hole_results,
        team_a_points=team_a_points,
        team_b_points=team_b_points,
    )
