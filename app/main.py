from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from app.database import create_db_and_tables, engine
from sqlmodel import Session
from app.models import SystemConfig
from app.config import STATIC_DIR, STORAGE_DIR, BASE_DIR
import os

# Importação LIMPA dos routers (Sem duplicatas)
from app.routers import dashboard, reservations, units, inventory, administrativo, system, calendar_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    from datetime import date
    from app.database import migrate_storage_to_unit_folders, migrate_reservation_folders_to_date_format, cleanup_old_reservation_documents, cleanup_old_task_folders
    create_db_and_tables()
    try:
        migrate_storage_to_unit_folders()
        migrate_reservation_folders_to_date_format()
    except Exception:
        pass
    # Cleanup documentos antigos (6+ meses) no dia 1 de cada mês
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

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/storage", StaticFiles(directory=STORAGE_DIR), name="storage")

app.include_router(dashboard.router)
app.include_router(calendar_router.router)
app.include_router(units.router)
app.include_router(reservations.router)
app.include_router(inventory.router)
app.include_router(administrativo.router)
app.include_router(system.router)