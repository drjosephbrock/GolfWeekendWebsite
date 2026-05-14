"""Handicap stroke allocation per hole."""

from .models import HoleSetup


def strokes_on_hole(handicap: int, hole: HoleSetup) -> int:
    """Return extra strokes a player receives on this hole given their handicap.

    Standard allocation: one stroke on each hole whose hdcp_index <= handicap.
    For handicaps > 18, a second stroke is given where hdcp_index <= (handicap - 18).
    Max supported handicap is 24 (as per house rules).
    """
    strokes = 0
    if hole.hdcp_index <= handicap:
        strokes += 1
    if handicap > 18 and hole.hdcp_index <= (handicap - 18):
        strokes += 1
    return strokes


def net_score(gross: int, handicap: int, hole: HoleSetup) -> int:
    return gross - strokes_on_hole(handicap, hole)


def match_play_strokes(handicap_a: int, handicap_b: int, hole: HoleSetup) -> tuple[int, int]:
    """Return (strokes_for_a, strokes_for_b) in a 1v1 match.

    The lower handicap player receives 0 strokes; the higher receives the
    difference, allocated by hdcp_index.
    """
    diff = abs(handicap_a - handicap_b)
    if handicap_a <= handicap_b:
        # B is the higher handicap player
        return 0, strokes_on_hole(diff, hole)
    else:
        return strokes_on_hole(diff, hole), 0
