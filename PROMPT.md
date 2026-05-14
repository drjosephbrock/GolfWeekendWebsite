# Current Task

Core app is built and working end-to-end. Next priorities: static content pages, bet tracking, bulk hole entry.

## Build Status (2026-05-14)

### Done
- FastAPI backend with all routers: players, courses, rounds, ledger, admin, rydercup
- Scoring engines: stroke play, best ball, match play, TILT, skins (skins engine exists, not wired to UI)
- Frontend: Home, Rounds, Score Entry, Scorecard, Ledger, Admin (6 tabs), Ryder Cup Scoreboard
- Admin: create rounds (with course/format/player/team picker), mark complete, delete
- Course dropdown shows hole count; warns if course has too few holes for chosen round length
- Ledger: entries, splits, balances (bilateral debt collapse), delete own entries
- All backend error messages surfaced in the UI

### Not Yet Built
- Static content pages (itinerary, format rule descriptions)
- Bet tracking (no DB tables yet): skins/$, stroke match, Nassau, Wolf, dots/junk
- Wolf format scorer
- Bulk hole entry (currently one hole at a time in admin)

---

# Requirements Gathered (via design interview)

## Hosting
- Free cloud hosting: **Railway** (Python + PostgreSQL, no spin-down on free tier)
- Players access via cellular on the golf course — site must be publicly reachable
- Home desktop available as fallback if needed

## Identity / Auth
- Name picker on first visit: player selects their name from the list of 16, stored in browser localStorage
- No accounts, no passwords
- Ownership model: players can create ledger entries and scores, but cannot edit or delete entries they did not create

## Data Lifecycle
- Format library and scoring engine persist across weekends
- Player data, ledger, and match history are wiped by admin after each weekend once everyone is settled
- No multi-season or multi-event history needed — single active state at any time

## Weekend Schedule
- **Friday morning:** Warm-up 9-hole round (stroke play + optional bets)
- **Friday afternoon:** Full 18-hole round (stroke play + optional bets)
- **Friday evening:** Team draft — 2 teams of 8 assigned and saved to database
- **Saturday:** Ryder Cup-style team tournament (4 sessions × 4 tee-time groups)
- **Sunday:** Casual round(s), individual setup, optional bets

## Courses
- 3 courses total across the weekend
- Admin populates each course: hole number, par, yardage, handicap index
- Course data is static (not editable by players)

## Rounds (General)
- Rounds are created with: course, format, players/groupings, bet types
- Tee-time groupings are admin-set (not player-assigned)
- Players choose hole-by-hole or total score entry per round
- Rounds can be: stroke play, best-ball, alternate shot, scramble, TILT, match play

## Game Formats (Format Library — persistent, extensible)

### Stroke Play
- Standard stroke play, handicap-adjusted where applicable
- Handicap: max 24

### Best-Ball (4-Ball)
- Each player plays their own ball; best net score on each hole counts for the team
- Handicap applies (max 24)

### Alternate Shot
- Team plays one ball, alternating shots
- No handicap

### Scramble
- Both players hit; team selects best shot and both play from there
- No handicap

### Match Play (1v1)
- Hole-by-hole win/loss/halve
- App tracks live status (e.g., "3 up with 4 to play")
- Handicap applies (max 24)

### TILT (Modified Stableford)
- Base points per hole (net score):
  - Albatross = 16, Eagle = 8, Birdie = 4, Par = 2, Bogey = 0, Double bogey or worse = -4
- Tilt mechanic (stateful multiplier per player):
  - Net birdie → player goes ON TILT; multiplier increases by 1 (starts at 2x)
  - Additional consecutive net birdies stack the multiplier (+1x each)
  - Net par → ONLY result that resets multiplier to 1x (player goes off tilt)
  - All other results (bogey, double, eagle, etc.) leave multiplier unchanged
  - Points on any hole = base points × current tilt multiplier

## Bet Types (extensible, selectable per round)

### Skins
- Set dollar value per skin at round creation
- Multiple players can be in the same skins game (e.g., all 4 in a tee-time)
- Ties carry over to next hole (pot grows)
- Display: running hole-by-hole view showing carry-over skin value and who won each skin
- Running total at the end

### Stroke Match
- Flat wager set upfront (e.g., $5 match)
- Can be 1v1 or 2v2

### Nassau
- Selected at round creation with fixed values
- Three bets in one: front 9, back 9, full 18
- Presses optional (TBD)

### Wolf
- 4-player rotating format (fits naturally with 4-player tee-time groups)
- Wolf order set at round creation; Wolf role rotates each hole
- Each hole, the Wolf decides (before each opponent tees off) whether to take them as a partner
- If Wolf picks a partner: 2v2, winners earn 1 point each (set dollar value per point at round creation)
- If Wolf goes Lone Wolf: Wolf alone vs. 3 others; Wolf wins or loses at 2x multiplier

### Dots / Junk
- Per-hole bonus tracking; dollar value per dot set at round creation
- **Greenie:** closest to the pin on a par 3, must make par or better to collect
- **Sandy:** up and down from a bunker for par or better
- **Snake:** 3-putt (negative — player owes a dot to each other player in the game)

### Multiple Simultaneous Bets
- A single round can have multiple bet types active with different player groupings
- Example: Players A+B in a stroke match, while A+B+C+D all play $2 skins

## Saturday — Ryder Cup Tournament
- 2 teams of 8
- 4 tee-time groups: each group is 2 players from Team A vs 2 players from Team B
- Each tee-time group plays all 4 sessions (treated as individual tracked rounds):
  1. Alternate Shot — 1 match per group (no handicap)
  2. Scramble — 1 match per group (no handicap)
  3. Best-Ball — 1 match per group (handicap applies)
  4. 1v1 Match Play — 2 singles matches per group (handicap applies)
- Points: 1 per match won, 0.5 per halved match
- **Total points available: 20** (5 per group × 4 groups)
- Team membership set Friday night; Saturday matches auto-organized by team

## Handicaps
- Max: 24 per player
- Applied in: Best-Ball, 1v1 Match Play
- Not applied in: Alternate Shot, Scramble, TILT

## Ledger
- **Group expenses:** food, beer, Gatorade, Ryder Cup buy-in — tracked and splittable
- **Bet settlements:** players can mark debts as settled against other ledger entries
  - Example: Player A paid for Player B's lunch → Player B logs it as settling Player A's skins loss
- Players can create entries, cannot edit or delete others' entries
- Running balance visible showing who owes what to whom

## Player Profiles
- Name (primary identifier, selected at first visit from list of 16)
- Handicap index (max 24)
- Team assignment (set Friday night)

## Static Content
- Weekend itinerary
- Game format rules/descriptions (one page per format including TILT)
- Course details: hole-by-hole par, yardage, handicap index — admin-populated

## Tech Stack
- **Backend:** FastAPI (Python)
- **Frontend:** React (mobile-first)
- **Database:** PostgreSQL
- **Hosting:** Railway

## Admin Mode
- Password-protected admin route in the app (not just DB access)
- Admin capabilities:
  - Manage player list (add/remove/edit players and handicaps)
  - Set and edit team assignments
  - Populate and edit course data (hole par, yardage, handicap index)
  - Edit or delete any ledger entry (to correct player mistakes)
  - Wipe seasonal data (players, rounds, ledger) to reset for next weekend

## Open Questions (still to resolve)
1. Nassau: do you use presses?
2. Player profile: any fields beyond name and handicap?
