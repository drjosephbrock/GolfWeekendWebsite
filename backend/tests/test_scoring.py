"""Scoring engine tests. Run with: pytest tests/"""
import pytest
from app.scoring.models import HoleSetup
from app.scoring.tilt import score_tilt_round
from app.scoring.match_play import score_match, running_display
from app.scoring.best_ball import score_best_ball
from app.scoring.skins import score_skins
from app.scoring.handicap import strokes_on_hole, match_play_strokes

# ── Fixtures ──────────────────────────────────────────────────────────────────

def make_holes(pars: list[int]) -> list[HoleSetup]:
    """Build holes with hdcp_index = position (hole 1 is hardest)."""
    return [HoleSetup(number=i + 1, par=p, hdcp_index=i + 1) for i, p in enumerate(pars)]

PAR4_9 = make_holes([4] * 9)


# ── Handicap ──────────────────────────────────────────────────────────────────

class TestHandicap:
    def test_no_strokes_on_easy_hole(self):
        hole = HoleSetup(number=1, par=4, hdcp_index=15)
        assert strokes_on_hole(12, hole) == 0

    def test_stroke_on_hard_hole(self):
        hole = HoleSetup(number=1, par=4, hdcp_index=1)
        assert strokes_on_hole(12, hole) == 1

    def test_hdcp_18_gets_stroke_on_every_hole(self):
        for i in range(1, 19):
            hole = HoleSetup(number=i, par=4, hdcp_index=i)
            assert strokes_on_hole(18, hole) == 1

    def test_hdcp_24_gets_two_strokes_on_six_holes(self):
        double_stroke_holes = [HoleSetup(number=i, par=4, hdcp_index=i) for i in range(1, 7)]
        single_stroke_holes = [HoleSetup(number=i, par=4, hdcp_index=i) for i in range(7, 19)]
        for hole in double_stroke_holes:
            assert strokes_on_hole(24, hole) == 2
        for hole in single_stroke_holes:
            assert strokes_on_hole(24, hole) == 1

    def test_match_play_lower_hdcp_gets_zero(self):
        hole = HoleSetup(number=1, par=4, hdcp_index=5)
        sa, sb = match_play_strokes(8, 16, hole)
        assert sa == 0
        assert sb == 1  # diff=8, hole hdcp_index=5 <= 8

    def test_match_play_equal_handicaps(self):
        hole = HoleSetup(number=1, par=4, hdcp_index=1)
        sa, sb = match_play_strokes(12, 12, hole)
        assert sa == 0 and sb == 0


# ── TILT ──────────────────────────────────────────────────────────────────────

class TestTilt:
    def _score(self, pars: list[int], strokes: list[int]):
        holes = make_holes(pars)
        return score_tilt_round(player_id=1, holes=holes, gross_scores=strokes)

    def test_all_pars_scores_2_per_hole(self):
        result = self._score([4] * 9, [4] * 9)
        assert result.total_points == 18
        assert all(h.actual_points == 2 for h in result.holes)

    def test_birdie_scores_4_at_1x_then_activates_2x(self):
        # Hole 1: birdie (4pts at 1x). Hole 2: par (2×2=4pts at 2x). Off tilt.
        result = self._score([4, 4], [3, 4])
        h1, h2 = result.holes
        assert h1.actual_points == 4
        assert h1.multiplier_applied == 1
        assert h1.multiplier_after == 2
        assert h2.actual_points == 4   # 2 * 2x
        assert h2.multiplier_applied == 2
        assert h2.multiplier_after == 1  # par resets

    def test_two_consecutive_birdies_reach_3x(self):
        # H1 birdie (1x→2x), H2 birdie (2x→3x), H3 par resets
        result = self._score([4, 4, 4], [3, 3, 4])
        h1, h2, h3 = result.holes
        assert h1.multiplier_applied == 1
        assert h2.multiplier_applied == 2
        assert h3.multiplier_applied == 3
        assert h3.multiplier_after == 1
        assert result.total_points == 4 + 8 + 6  # 4×1, 4×2, 2×3

    def test_bogey_does_not_reset_tilt(self):
        # H1 birdie (→2x), H2 bogey (0pts but stays at 2x), H3 par (→1x)
        result = self._score([4, 4, 4], [3, 5, 4])
        h1, h2, h3 = result.holes
        assert h2.multiplier_applied == 2
        assert h2.actual_points == 0   # bogey = 0 regardless of multiplier
        assert h2.multiplier_after == 2  # still on tilt
        assert h3.multiplier_applied == 2
        assert h3.multiplier_after == 1

    def test_double_bogey_on_tilt_costs_8(self):
        # H1 birdie (→2x), H2 double bogey (-4 × 2 = -8)
        result = self._score([4, 4], [3, 6])
        h1, h2 = result.holes
        assert h2.actual_points == -8
        assert h2.multiplier_after == 2  # double bogey doesn't reset tilt

    def test_double_bogey_off_tilt_costs_4(self):
        result = self._score([4], [6])
        assert result.holes[0].actual_points == -4

    def test_eagle_scores_8_and_stacks_tilt(self):
        # Eagle at 1x = 8pts, tilt becomes 2x
        result = self._score([5, 4], [3, 4])  # eagle on par 5
        h1, h2 = result.holes
        assert h1.actual_points == 8
        assert h1.multiplier_after == 2
        assert h2.actual_points == 4  # par at 2x

    def test_tilt_does_not_carry_after_par_reset(self):
        # Birdie → 2x, par resets, next hole at 1x
        result = self._score([4, 4, 4], [3, 4, 3])
        h3 = result.holes[2]
        assert h3.multiplier_applied == 1  # back to 1x after par

    def test_full_round_no_tilt(self):
        pars = [4, 3, 5, 4, 4, 3, 5, 4, 4]
        gross = [4, 3, 5, 4, 4, 3, 5, 4, 4]
        result = self._score(pars, gross)
        assert result.total_points == 18  # 2 per hole


# ── Match play ────────────────────────────────────────────────────────────────

class TestMatchPlay:
    def _match(self, gross_a, gross_b, hdcp_a=0, hdcp_b=0):
        holes = make_holes([4] * len(gross_a))
        return score_match(1, 2, hdcp_a, hdcp_b, holes, gross_a, gross_b)

    def test_a_wins_all_square_at_start(self):
        result = self._match([3], [4])
        assert result.winner == 1
        assert result.holes[0].running_status == 1

    def test_halved_hole(self):
        result = self._match([4], [4])
        assert result.holes[0].winner is None
        assert result.holes[0].running_status == 0

    def test_all_square_result(self):
        result = self._match([3, 5], [5, 3])
        assert result.winner is None
        assert result.status_display == "All Square"

    def test_match_closed_early(self):
        # A wins first 2 holes of a 2-hole match → closes 2&0 ...
        # but with only 2 holes, winning both = 2 Up with 0 remaining
        result = self._match([3, 3], [4, 4])
        assert result.winner == 1

    def test_handicap_stroke_applied(self):
        # A hdcp=0, B hdcp=18 → B gets 1 stroke on every hole
        # A shoots 4, B shoots 5 → B net=4, A net=4 → halved
        holes = [HoleSetup(number=1, par=4, hdcp_index=1)]
        result = score_match(1, 2, 0, 18, holes, [4], [5])
        assert result.holes[0].winner is None  # B's 5 - 1 stroke = 4, same as A

    def test_running_display(self):
        assert running_display(2, 9, 18) == "A 2 Up"
        assert running_display(-1, 9, 18) == "B 1 Up"
        assert running_display(0, 9, 18) == "All Square"


# ── Best-ball ─────────────────────────────────────────────────────────────────

class TestBestBall:
    def test_team_a_wins_hole(self):
        holes = make_holes([4])
        result = score_best_ball(
            team_a={1: 0, 2: 0},
            team_b={3: 0, 4: 0},
            holes=holes,
            gross_scores={1: [3], 2: [4], 3: [4], 4: [5]},
        )
        assert result.holes[0].winner == "A"
        assert result.team_a_points == 1.0
        assert result.team_b_points == 0.0

    def test_halved_hole(self):
        holes = make_holes([4])
        result = score_best_ball(
            team_a={1: 0, 2: 0},
            team_b={3: 0, 4: 0},
            holes=holes,
            gross_scores={1: [4], 2: [5], 3: [4], 4: [5]},
        )
        assert result.holes[0].winner is None

    def test_handicap_determines_best(self):
        # Player 1 (hdcp=0) shoots 4. Player 2 (hdcp=18) shoots 5 → net 4.
        # Team A best net = 4.
        holes = [HoleSetup(number=1, par=4, hdcp_index=1)]
        result = score_best_ball(
            team_a={1: 0, 2: 18},
            team_b={3: 0, 4: 0},
            holes=holes,
            gross_scores={1: [4], 2: [5], 3: [5], 4: [5]},
        )
        assert result.holes[0].winner == "A"


# ── Skins ─────────────────────────────────────────────────────────────────────

class TestSkins:
    def test_clear_winner_collects_pot(self):
        holes = make_holes([4])
        result = score_skins([1, 2, 3], holes, {1: [3], 2: [4], 3: [4]}, dollars_per_skin=2)
        assert result.winnings[1] == 2
        assert result.winnings[2] == 0

    def test_tie_carries_over(self):
        holes = make_holes([4, 4])
        result = score_skins(
            [1, 2],
            holes,
            {1: [3, 4], 2: [3, 3]},
            dollars_per_skin=2,
        )
        h1, h2 = result.holes
        assert h1.skin_winner is None
        assert h1.carried_over is True
        assert h2.pot_value == 4       # $2 original + $2 carried
        assert result.winnings[2] == 4  # player 2 wins hole 2 and collects both

    def test_three_way_carry_then_winner(self):
        holes = make_holes([4, 4])
        result = score_skins(
            [1, 2, 3],
            holes,
            {1: [4, 3], 2: [4, 4], 3: [4, 4]},
            dollars_per_skin=1,
        )
        assert result.holes[0].carried_over is True
        assert result.winnings[1] == 2  # wins carried pot on hole 2
