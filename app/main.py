from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from app.database import create_db_and_tables, engine
from app.models import SystemConfig
from app.config import STATIC_DIR, STORAGE_DIR

# Importação LIMPA dos routers (Sem duplicatas)
from app.routers import dashboard, reservations, units, inventory, tasks, finance, system

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    with Session(engine) as session:
        if not session.exec(select(SystemConfig)).first():
            session.add(SystemConfig(condo_name="Meu Condomínio"))
            session.commit()
    yield

app = FastAPI(lifespan=lifespan)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/storage", StaticFiles(directory=STORAGE_DIR), name="storage")

app.include_router(dashboard.router)
app.include_router(units.router)
app.include_router(reservations.router)
app.include_router(inventory.router)
app.include_router(tasks.router)
app.include_router(finance.router)
app.include_router(system.router)