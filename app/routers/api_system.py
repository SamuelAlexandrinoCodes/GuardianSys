"""
API REST JSON — Sistema (Backup, Restauracao, Info).
Regra de Ouro: ZERO alteracao em models.py ou database.py.
"""
import os
import zipfile
import shutil
from datetime import datetime

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
from sqlmodel import Session, select, text, func

from app.database import engine
from app.models import SystemConfig, Unit, Resident, Reservation, Task, Meeting, Payable, Inventory
from app.config import get_config, DATA_DIR, STORAGE_DIR, BASE_DIR

router = APIRouter(prefix="/api", tags=["api-system"])


def _db_path() -> str:
    return os.path.join(DATA_DIR, "guardian.db")


def _storage_size() -> int:
    total = 0
    for root, _, files in os.walk(STORAGE_DIR):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


@router.get("/system/info")
def system_info():
    """Painel de informacoes do sistema."""
    db = _db_path()
    db_size = os.path.getsize(db) if os.path.exists(db) else 0
    storage_size = _storage_size()
    db_modified = datetime.fromtimestamp(os.path.getmtime(db)).isoformat() if os.path.exists(db) else None

    with Session(engine) as session:
        config = get_config(session)
        counts = {
            "units": session.exec(select(func.count(Unit.id))).one(),
            "residents": session.exec(select(func.count(Resident.id)).where(Resident.is_active == True)).one(),  # noqa: E712
            "reservations": session.exec(select(func.count(Reservation.id))).one(),
            "tasks": session.exec(select(func.count(Task.id))).one(),
            "meetings": session.exec(select(func.count(Meeting.id))).one(),
            "payables": session.exec(select(func.count(Payable.id))).one(),
            "inventory": session.exec(select(func.count(Inventory.id))).one(),
        }

    return JSONResponse({
        "config": {
            "condo_name": config.condo_name if config else "Condominio",
            "backup_path": config.backup_path if config else None,
        },
        "db_size_bytes": db_size,
        "storage_size_bytes": storage_size,
        "db_last_modified": db_modified,
        "counts": counts,
    })


@router.get("/system/backup")
def download_backup():
    """Gera e retorna um ZIP com o banco + storage."""
    db = _db_path()
    with Session(engine) as session:
        session.exec(text("PRAGMA wal_checkpoint(FULL);"))

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    zip_filename = f"Backup_{timestamp}.zip"
    zip_path = os.path.join(DATA_DIR, zip_filename)

    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            if os.path.exists(db):
                zipf.write(db, arcname="guardian.db")
            for root, _, files in os.walk(STORAGE_DIR):
                for f in files:
                    fpath = os.path.join(root, f)
                    zipf.write(fpath, arcname=os.path.relpath(fpath, os.path.dirname(STORAGE_DIR)))
        return FileResponse(path=zip_path, filename=zip_filename, media_type="application/zip")
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/system/restore")
async def restore_backup(backup_file: UploadFile = File(...)):
    """Restaura backup a partir de um ZIP."""
    temp_zip = os.path.join(DATA_DIR, "restore_temp.zip")
    with open(temp_zip, "wb") as buffer:
        shutil.copyfileobj(backup_file.file, buffer)

    engine.dispose()
    try:
        with zipfile.ZipFile(temp_zip, "r") as zip_ref:
            if os.path.exists(STORAGE_DIR):
                shutil.rmtree(STORAGE_DIR)
            os.makedirs(STORAGE_DIR)

            for ext in ["guardian.db", "guardian.db-wal", "guardian.db-shm"]:
                target = os.path.join(DATA_DIR, ext)
                if os.path.exists(target):
                    os.remove(target)

            for member in zip_ref.namelist():
                if member == "guardian.db":
                    with open(os.path.join(DATA_DIR, "guardian.db"), "wb") as f:
                        f.write(zip_ref.read(member))
                elif member.startswith("storage/"):
                    zip_ref.extract(member, path=os.path.dirname(BASE_DIR))

        return JSONResponse({"ok": True, "message": "Backup restaurado com sucesso."})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        if os.path.exists(temp_zip):
            os.remove(temp_zip)


@router.post("/system/fix-status")
def fix_all_status():
    """Reseta todas as unidades para 'Vazio'."""
    with Session(engine) as session:
        units = session.exec(select(Unit)).all()
        for u in units:
            u.status = "Vazio"
            session.add(u)
        session.commit()
    return JSONResponse({"ok": True, "count": len(units)})
