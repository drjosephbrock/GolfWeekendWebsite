"""TILT scoring engine — modified Stableford with a stateful multiplier.

Rules:
  Base points:  Albatross=16, Eagle=8, Birdie=4, Par=2, Bogey=0, Double+=−4
  Tilt state:   Starts at multiplier=1 (off tilt).
                A score BETTER than par raises the multiplier by 1 heading into
                the next hole (birdie → 2x, two consecutive → 3x, etc.).
                A par RESETS the multiplier to 1 (only par resets).
                Any other result (bogey, double, eagle, albatross after tilt
                is already active) leaves the multiplier unchanged.
  Points:       actual = base * current_multiplier (applied before update).
"""

from .models import HoleSetup, TiltHoleResult, TiltPlayerResult

_BASE_POINTS: dict[int, int] = {
    -3: 16,   # albatross
    -2: 8,    # eagle
    -1: 4,    # birdie
    0:  2,    # par
    1:  0,    # bogey
}
_DOUBLE_OR_WORSE = -4


def _base_points(score_vs_par: int) -> int:
    return _BASE_POINTS.get(score_vs_par, _DOUBLE_OR_WORSE)


def _next_multiplier(score_vs_par: int, current: int) -> int:
    if score_vs_par < 0:     # better than par → increase tilt
        return current + 1
    if score_vs_par == 0:    # par → reset
        return 1
    return current           # bogey or worse → unchanged


def score_tilt_round(
    player_id: int,
    holes: list[HoleSetup],
    gross_scores: list[int],   # parallel to holes
) -> TiltPlayerResult:
    """Score a complete TILT round. No handicap applied (per house rules)."""
    assert len(holes) == len(gross_scores), "holes and scores must be same length"

    results: list[TiltHoleResult] = []
    multiplier = 1
    total = 0

    for hole, gross in zip(holes, gross_scores):
        vs_par = gross - hole.par
        base = _base_points(vs_par)
        actual = base * multiplier
        total += actual
        next_mult = _next_multiplier(vs_par, multiplier)

        results.append(TiltHoleResult(
            hole=hole,
            gross=gross,
            score_vs_par=vs_par,
            multiplier_applied=multiplier,
            base_points=base,
            actual_points=actual,
            on_tilt_after=next_mult > 1,
            multiplier_after=next_mult,
        ))
        multiplier = next_mult

    return TiltPlayerResult(player_id=player_id, holes=results, total_points=total)
