from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from .database import engine
from .models import Base
from .routers import players, courses, rounds, ledger, admin, rydercup

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Golf Weekend")

app.include_router(players.router)
app.include_router(courses.router)
app.include_router(rounds.router)
app.include_router(ledger.router)
app.include_router(admin.router)
app.include_router(rydercup.router)

# Serve React build in production
static_dir = Path(__file__).parent.parent.parent / "frontend" / "dist"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        return FileResponse(static_dir / "index.html")
