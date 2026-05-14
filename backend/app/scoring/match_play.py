"""1v1 match play scoring engine."""

from typing import Optional
from .models import HoleSetup, MatchHoleResult, MatchRoundResult
from .handicap import match_play_strokes


def score_match(
    player_a_id: int,
    player_b_id: int,
    handicap_a: int,
    handicap_b: int,
    holes: list[HoleSetup],
    gross_a: list[int],
    gross_b: list[int],
) -> MatchRoundResult:
    results: list[MatchHoleResult] = []
    status = 0  # positive = A up, negative = B up
    holes_remaining = len(holes)
    match_over = False

    for hole, ga, gb in zip(holes, gross_a, gross_b):
        sa, sb = match_play_strokes(handicap_a, handicap_b, hole)
        net_a = ga - sa
        net_b = gb - sb

        if net_a < net_b:
            winner = player_a_id
            status += 1
        elif net_b < net_a:
            winner = player_b_id
            status -= 1
        else:
            winner = None

        holes_remaining -= 1
        results.append(MatchHoleResult(
            hole=hole,
            player_a_net=net_a,
            player_b_net=net_b,
            winner=winner,
            running_status=status,
        ))

        # Dormie / closed match detection
        lead = abs(status)
        if lead > holes_remaining and not match_over:
            match_over = True

    return _build_result(results, status, player_a_id, player_b_id)


def _build_result(
    holes: list[MatchHoleResult],
    final_status: int,
    player_a_id: int,
    player_b_id: int,
) -> MatchRoundResult:
    lead = abs(final_status)
    holes_played = len(holes)
    holes_remaining = sum(
        1 for i, h in enumerate(holes)
        if h.running_status == final_status and i == len(holes) - 1
    )

    if final_status == 0:
        return MatchRoundResult(holes=holes, winner=None, margin=0, status_display="All Square")

    winner = player_a_id if final_status > 0 else player_b_id

    # Determine display: "X&Y" if match closed before 18, else "X Up"
    holes_remaining_at_end = _holes_remaining_when_closed(holes, final_status)
    if holes_remaining_at_end > 0:
        display = f"{lead}&{holes_remaining_at_end}"
    else:
        display = f"{lead} Up"

    return MatchRoundResult(holes=holes, winner=winner, margin=lead, status_display=display)


def _holes_remaining_when_closed(holes: list[MatchHoleResult], final_status: int) -> int:
    """Return holes remaining when the match was mathematically decided, or 0."""
    total = len(holes)
    for i, h in enumerate(holes):
        remaining = total - i - 1
        if abs(h.running_status) > remaining:
            return remaining
    return 0


def running_display(status: int, holes_played: int, total_holes: int) -> str:
    """Human-readable status string for live display during a round."""
    remaining = total_holes - holes_played
    lead = abs(status)
    if status == 0:
        return "All Square"
    side = "A" if status > 0 else "B"
    if lead > remaining:
        return f"{side} wins {lead}&{remaining}"
    return f"{side} {lead} Up" if remaining > 0 else f"{side} wins {lead} Up"
