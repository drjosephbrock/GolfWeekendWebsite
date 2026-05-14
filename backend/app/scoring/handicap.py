"""Handicap stroke allocation per hole."""

from .models import HoleSetup


def strokes_on_hole(handicap: int, hole: HoleSetup) -> int:
    """Return net strokes a player receives on this hole given their handicap.

    Positive handicap: one stroke on each hole whose hdcp_index <= handicap;
      a second stroke where hdcp_index <= (handicap - 18) for handicaps > 18.
    Plus handicap (negative value, e.g. +1 stored as -1): player gives one
      stroke on each hole whose hdcp_index <= abs(handicap).
    """
    if handicap < 0:
        return -1 if hole.hdcp_index <= abs(handicap) else 0
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
