# WeekendGolfWebsite

## Project Overview
We are building a website that I can host for my 16 friends. The website will have access to player profiles, 
various game formats descriptions(best-ball, alternate shot, scramble, TILT, etc), course information, 
itinerary for the weekend, and a ledger section to enter bets. There should be a master ledger that keeps track 
of group expenses like food, beer, gatorade, and buy-in for the ryder-cup style tournament. Teams will be made on
Fiday night, so the website should have some form of SQL database to keep track of changes and allow for the teams
to be made and saved. Finally, there should be a scoring page that each player/group can access and enter their scores. 
Based on the game selected, the strokes will be summed or points assigned if match-play.

## PROMPT.md
fill in the PROMPT.md file as we complete the requirements for this project. 

## Tech Stack
- **Backend:** FastAPI (Python)
- **Frontend:** React (mobile-first, TypeScript)
- **Database:** PostgreSQL
- **Hosting:** Railway (backend + DB), static frontend can be served from Railway or a CDN

## Architecture Principles
- Format library and scoring engine are persistent; player/ledger/match data is wiped after each weekend
- Single active state — no multi-season or multi-event history
- Scoring logic lives in the backend; frontend only renders results
- Bet types and game formats must be extensible — new types should require only adding a new module, not restructuring the DB
- Mobile-first UI: all score entry and ledger flows optimized for phone use on a golf course
- Ownership enforced server-side: players can only edit/delete their own entries
- Identity via localStorage name selection (no auth system)

## Python Scripting API (target surface)
- FastAPI REST API
- Endpoints for: rounds, scores, players, teams, ledger, courses, formats, bets
- Admin endpoints for: wiping seasonal data, populating course data, setting team assignments

## Coding Conventions
- Python: follow PEP 8, use type hints throughout
- FastAPI: use Pydantic models for all request/response schemas
- PostgreSQL: use SQLAlchemy ORM with Alembic for migrations
- React: functional components, TypeScript strict mode
- No comments unless the WHY is non-obvious

## Linux/WSL-Specific Notes
- Development on WSL2 (Linux 6.6.x)
- Use absolute paths when referencing files across Windows/Linux boundary

## Agent Rules
- Always update PROMPT.md as requirements are confirmed or change
- Do not add features beyond confirmed requirements
- When adding a new game format or bet type, create a new module rather than modifying existing ones

## Build Notes
- See PROMPT.md for full requirements and open questions before building any feature
