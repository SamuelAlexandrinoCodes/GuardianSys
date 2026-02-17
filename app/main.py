from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from app.database import create_db_and_tables, engine
from app.models import SystemConfig
from app.config import STATIC_DIR, STORAGE_DIR, BASE_DIR
import os

from app.routers import (
    api_administrativo,
    api_dashboard,
    api_units,
    api_reservations,
    api_finance,
    api_inventory,
    api_calendar,
    api_system,
    api_settings,
)

REACT_DIST_DIR = os.path.join(STATIC_DIR, "dist")
REACT_INDEX = os.path.join(REACT_DIST_DIR, "index.html")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from datetime import date
    from app.database import (
        migrate_storage_to_unit_folders,
        migrate_reservation_folders_to_date_format,
        cleanup_old_reservation_documents,
        cleanup_old_task_folders,
    )
    create_db_and_tables()
    try:
        migrate_storage_to_unit_folders()
        migrate_reservation_folders_to_date_format()
    except Exception:
        pass
    today = date.today()
    if today.day == 1:
        marker = os.path.join(BASE_DIR, "data", "last_cleanup_month.txt")
        current_month = today.strftime("%Y-%m")
        try:
            last = open(marker).read().strip() if os.path.exists(marker) else ""
            if last != current_month:
                cleanup_old_reservation_documents()
                try:
                    cleanup_old_task_folders()
                except Exception:
                    pass
                open(marker, "w").write(current_month)
        except Exception:
            pass
    with Session(engine) as session:
        if not session.exec(select(SystemConfig)).first():
            session.add(SystemConfig(condo_name="Meu Condomínio"))
            session.commit()
    yield


app = FastAPI(lifespan=lifespan)

# CORS (necessario para o Vite dev server em desenvolvimento)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage (uploads, documentos)
app.mount("/storage", StaticFiles(directory=STORAGE_DIR), name="storage")

# API REST
app.include_router(api_administrativo.router)
app.include_router(api_dashboard.router)
app.include_router(api_units.router)
app.include_router(api_reservations.router)
app.include_router(api_finance.router)
app.include_router(api_inventory.router)
app.include_router(api_calendar.router)
app.include_router(api_system.router)
app.include_router(api_settings.router)

# React SPA — assets compilados
if os.path.isdir(os.path.join(REACT_DIST_DIR, "assets")):
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(REACT_DIST_DIR, "assets")),
        name="react-assets",
    )

# Estaticos gerais
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# Catch-all: serve index.html do React para SPA routing.
# Arquivos fisicos existentes no dist sao servidos diretamente.
@app.get("/{full_path:path}")
async def serve_react_spa(request: Request, full_path: str):
    if full_path:
        file_path = os.path.join(REACT_DIST_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
    return FileResponse(REACT_INDEX)