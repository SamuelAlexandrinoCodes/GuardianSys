import os
import zipfile
import shutil
from datetime import datetime
from fastapi import APIRouter, Request, Form, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse
from sqlmodel import Session, select, or_, text
from app.database import engine
from app.models import SystemConfig, Unit, Resident
from app.config import templates, get_config, DATA_DIR, STORAGE_DIR, BASE_DIR

router = APIRouter()

@router.get("/settings")
def settings_page(request: Request):
    with Session(engine) as session: return templates.TemplateResponse("settings.html", {"request": request, "config": get_config(session)})

@router.post("/settings/update")
def update_settings(condo_name: str = Form(...), floors: int = Form(...), units: int = Form(...), backup_path: str = Form(None), user_name: str = Form(None)):
    try:
        with Session(engine) as session:
            config = get_config(session)
            if not config: config = SystemConfig(condo_name=condo_name, total_floors=floors, units_per_floor=units, user_name=(user_name or "").strip() or None)
            else:
                config.condo_name = condo_name
                config.total_floors = floors
                config.units_per_floor = units
                config.backup_path = backup_path
                config.user_name = (user_name or "").strip() or None
            session.add(config)
            for floor in range(1, floors + 1):
                for u in range(1, units + 1):
                    unit_number = f"{floor}{u:02d}" 
                    if not session.exec(select(Unit).where(Unit.number == unit_number)).first(): session.add(Unit(block="1", number=unit_number))
            session.commit()
    except Exception: return HTMLResponse(f"<h3>Erro ao salvar.</h3>", status_code=500)
    return RedirectResponse(url="/settings?saved=true", status_code=303)

@router.get("/system_data")
def system_data_page(request: Request):
    with Session(engine) as session: return templates.TemplateResponse("system_data.html", {"request": request, "config": get_config(session)})

@router.get("/admin/backup")
def download_backup():
    with Session(engine) as session: session.exec(text("PRAGMA wal_checkpoint(FULL);")); session.exec(text("VACUUM;")) 
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M'); zip_filename = f"Backup_{timestamp}.zip"; zip_path = os.path.join(DATA_DIR, zip_filename)
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            db_path = os.path.join(DATA_DIR, "guardian.db")
            if os.path.exists(db_path): zipf.write(db_path, arcname="guardian.db")
            for root, _, files in os.walk(STORAGE_DIR):
                for file in files:
                    fpath = os.path.join(root, file)
                    zipf.write(fpath, arcname=os.path.relpath(fpath, os.path.dirname(STORAGE_DIR)))
        return FileResponse(path=zip_path, filename=zip_filename, media_type='application/zip')
    except Exception: return HTMLResponse(f"<h3>Erro ao gerar backup.</h3>", status_code=500)

@router.post("/admin/restore")
async def restore_backup(backup_file: UploadFile = File(...)):
    temp_zip = os.path.join(DATA_DIR, "restore_temp.zip")
    with open(temp_zip, "wb") as buffer: shutil.copyfileobj(backup_file.file, buffer)
    engine.dispose() 
    try:
        with zipfile.ZipFile(temp_zip, 'r') as zip_ref:
            if os.path.exists(STORAGE_DIR): shutil.rmtree(STORAGE_DIR)
            os.makedirs(STORAGE_DIR)
            for ext in ["guardian.db", "guardian.db-wal", "guardian.db-shm"]:
                target = os.path.join(DATA_DIR, ext)
                if os.path.exists(target): os.remove(target)
            for member in zip_ref.namelist():
                if member == "guardian.db":
                    target = os.path.join(DATA_DIR, "guardian.db")
                    with open(target, "wb") as f:
                        f.write(zip_ref.read(member))
                elif member.startswith("storage/"): zip_ref.extract(member, path=os.path.dirname(BASE_DIR))
    except Exception: return HTMLResponse(f"Erro na restauração.", status_code=500)
    finally:
        if os.path.exists(temp_zip): os.remove(temp_zip)
    return RedirectResponse(url="/?restored=true", status_code=303)

@router.get("/search", response_class=HTMLResponse)
def search(request: Request, q: str = ""):
    if len(q) < 2: return ""
    with Session(engine) as session:
        units = session.exec(select(Unit).where(or_(Unit.number.contains(q), Unit.block.contains(q))).limit(5)).all()
        residents = session.exec(select(Resident).where(Resident.full_name.ilike(f"%{q}%"), Resident.is_active == True).limit(5)).all()
    return templates.TemplateResponse("partials/search_results.html", {"request": request, "units": units, "residents": residents})

@router.get("/admin/fix_status")
def fix_all_status():
    with Session(engine) as session:
        units = session.exec(select(Unit)).all()
        count = 0
        for u in units:
            u.status = "Vazio"; session.add(u); count += 1
        session.commit()
    return f"Status de {count} unidades resetado para 'Vazio'."