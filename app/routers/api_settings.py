"""
API REST JSON — Configuracoes do Sistema.
Regra de Ouro: ZERO alteracao em models.py ou database.py.
"""
from typing import Optional

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import engine
from app.models import SystemConfig, Unit
from app.config import get_config, run_backup_job

router = APIRouter(prefix="/api", tags=["api-settings"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SettingsUpdate(BaseModel):
    condo_name: Optional[str] = None
    user_name: Optional[str] = None
    total_floors: Optional[int] = None
    units_per_floor: Optional[int] = None
    backup_path: Optional[str] = None


# ---------------------------------------------------------------------------
# Serializer
# ---------------------------------------------------------------------------

def _ser(c: SystemConfig) -> dict:
    return {
        "id": c.id,
        "condo_name": c.condo_name,
        "user_name": c.user_name,
        "total_floors": c.total_floors,
        "units_per_floor": c.units_per_floor,
        "backup_path": c.backup_path,
    }


# ---------------------------------------------------------------------------
# GET
# ---------------------------------------------------------------------------

@router.get("/settings")
def get_settings():
    with Session(engine) as session:
        config = get_config(session)
        if not config:
            config = SystemConfig(condo_name="Meu Condominio")
            session.add(config)
            session.commit()
            session.refresh(config)
    return JSONResponse(_ser(config))


# ---------------------------------------------------------------------------
# PATCH
# ---------------------------------------------------------------------------

@router.patch("/settings")
def update_settings(payload: SettingsUpdate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        config = get_config(session)
        if not config:
            config = SystemConfig(condo_name="Meu Condominio")

        if payload.condo_name is not None:
            config.condo_name = payload.condo_name
        if payload.user_name is not None:
            config.user_name = payload.user_name.strip() or None
        if payload.total_floors is not None:
            config.total_floors = payload.total_floors
        if payload.units_per_floor is not None:
            config.units_per_floor = payload.units_per_floor
        if payload.backup_path is not None:
            config.backup_path = payload.backup_path or None

        session.add(config)

        # Auto-create units if floors/units changed
        if payload.total_floors is not None or payload.units_per_floor is not None:
            floors = config.total_floors
            upf = config.units_per_floor
            for floor in range(1, floors + 1):
                for u in range(1, upf + 1):
                    number = f"{floor}{u:02d}"
                    if not session.exec(select(Unit).where(Unit.number == number)).first():
                        session.add(Unit(block="1", number=number))

        session.commit()
        session.refresh(config)
        background_tasks.add_task(run_backup_job)

    return JSONResponse(_ser(config))
