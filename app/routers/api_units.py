"""
API REST JSON — Unidades, Moradores, Veiculos, Pets.
Regra de Ouro: ZERO alteração em models.py ou database.py.
"""
from datetime import date, datetime, timedelta
from typing import Optional
import os

from fastapi import APIRouter, BackgroundTasks, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import engine
from app.models import Unit, Resident, Document, Reservation, Vehicle, Pet
from app.config import get_config, run_backup_job, STORAGE_DIR, PHOTOS_DIR, get_unit_folder_name

router = APIRouter(prefix="/api", tags=["api-units"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class ResidentCreate(BaseModel):
    unit_id: int
    full_name: str
    profile_type: str
    birth_date: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    observations: Optional[str] = None
    is_pcd: bool = False

class ResidentUpdate(BaseModel):
    full_name: Optional[str] = None
    profile_type: Optional[str] = None
    birth_date: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    observations: Optional[str] = None
    is_pcd: Optional[bool] = None

class VehicleCreate(BaseModel):
    type: str
    model: str
    plate: Optional[str] = None
    tag: Optional[str] = None

class VehicleUpdate(BaseModel):
    type: Optional[str] = None
    model: Optional[str] = None
    plate: Optional[str] = None
    tag: Optional[str] = None

class PetCreate(BaseModel):
    name: str
    breed: str
    notes: Optional[str] = None

class PetUpdate(BaseModel):
    name: Optional[str] = None
    breed: Optional[str] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------

def _ser_resident(r: Resident) -> dict:
    return {
        "id": r.id, "unit_id": r.unit_id,
        "full_name": r.full_name,
        "birth_date": r.birth_date.isoformat() if r.birth_date else None,
        "phone": r.phone, "email": r.email,
        "profile_type": r.profile_type,
        "photo_path": r.photo_path,
        "pool_access_expiry": r.pool_access_expiry.isoformat() if r.pool_access_expiry else None,
        "is_active": r.is_active,
        "observations": r.observations,
        "is_pcd": r.is_pcd, "pcd_tag": r.pcd_tag,
    }

def _ser_vehicle(v: Vehicle) -> dict:
    return {"id": v.id, "unit_id": v.unit_id, "type": v.type, "model": v.model, "plate": v.plate, "tag": v.tag}

def _ser_pet(p: Pet) -> dict:
    return {"id": p.id, "unit_id": p.unit_id, "name": p.name, "breed": p.breed, "notes": p.notes}

def _ser_document(d: Document) -> dict:
    return {"id": d.id, "unit_id": d.unit_id, "filename": d.filename, "filepath": d.filepath, "category": d.category,
            "upload_date": d.upload_date.isoformat() if d.upload_date else None, "reservation_id": d.reservation_id}

def _ser_unit_summary(u: Unit, residents: list[Resident]) -> dict:
    head = residents[0].full_name if residents else "Vazio"
    return {
        "id": u.id, "block": u.block, "number": u.number, "status": u.status,
        "residents_count": len(residents),
        "head_of_household": head,
        "is_occupied": len(residents) > 0,
    }


# ---------------------------------------------------------------------------
# LISTAGEM DE UNIDADES
# ---------------------------------------------------------------------------

@router.get("/units")
def list_units():
    with Session(engine) as session:
        config = get_config(session)
        units_raw = session.exec(select(Unit).order_by(Unit.id)).all()
        all_residents = session.exec(select(Resident).where(Resident.is_active == True)).all()  # noqa: E712

        rmap: dict[int, list[Resident]] = {}
        for r in all_residents:
            rmap.setdefault(r.unit_id, []).append(r)

        units = [_ser_unit_summary(u, rmap.get(u.id, [])) for u in units_raw]
        occupied = sum(1 for u in units if u["is_occupied"])

    return JSONResponse({
        "config": {"condo_name": config.condo_name if config else "Condominio"},
        "units": units,
        "total": len(units),
        "occupied": occupied,
    })


# ---------------------------------------------------------------------------
# DETALHE DE UMA UNIDADE
# ---------------------------------------------------------------------------

@router.get("/unit/{unit_id}")
def unit_detail(unit_id: int):
    with Session(engine) as session:
        unit = session.get(Unit, unit_id)
        if not unit:
            return JSONResponse({"error": "Unidade nao encontrada"}, status_code=404)

        residents = session.exec(
            select(Resident).where(Resident.unit_id == unit_id, Resident.is_active == True)  # noqa: E712
        ).all()
        vehicles = session.exec(select(Vehicle).where(Vehicle.unit_id == unit_id)).all()
        pets = session.exec(select(Pet).where(Pet.unit_id == unit_id)).all()
        documents = session.exec(
            select(Document).where(Document.unit_id == unit_id).order_by(Document.upload_date.desc())
        ).all()

        today = date.today()
        reservations = session.exec(
            select(Reservation).where(
                Reservation.unit_id == unit_id,
                Reservation.reservation_date >= today,
                Reservation.status != "CANCELADA",
            ).order_by(Reservation.reservation_date)
        ).all()

        # Nav helpers
        prev_unit = session.exec(select(Unit).where(Unit.id < unit.id).order_by(Unit.id.desc())).first()
        next_unit = session.exec(select(Unit).where(Unit.id > unit.id).order_by(Unit.id)).first()

    return JSONResponse({
        "unit": {"id": unit.id, "block": unit.block, "number": unit.number, "status": unit.status},
        "residents": [_ser_resident(r) for r in residents],
        "vehicles": [_ser_vehicle(v) for v in vehicles],
        "pets": [_ser_pet(p) for p in pets],
        "documents": [_ser_document(d) for d in documents],
        "reservations": [{
            "id": r.id, "area_name": r.area_name,
            "reservation_date": r.reservation_date.isoformat(),
            "status": r.status,
        } for r in reservations],
        "nav": {
            "prev_id": prev_unit.id if prev_unit else None,
            "next_id": next_unit.id if next_unit else None,
        },
    })


# ---------------------------------------------------------------------------
# STATUS DA UNIDADE
# ---------------------------------------------------------------------------

@router.post("/unit/{unit_id}/toggle-status")
def toggle_unit_status(unit_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        unit = session.get(Unit, unit_id)
        if not unit:
            return JSONResponse({"error": "Unidade nao encontrada"}, status_code=404)
        cycle = {"Ocupado": "Vazio", "Vazio": "Invadido", "Invadido": "Ocupado"}
        unit.status = cycle.get(unit.status, "Ocupado")
        session.add(unit)
        session.commit()
        session.refresh(unit)
        background_tasks.add_task(run_backup_job)
    return JSONResponse({"status": unit.status})


# ---------------------------------------------------------------------------
# MORADORES CRUD
# ---------------------------------------------------------------------------

@router.post("/residents")
def create_resident(payload: ResidentCreate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        bdate = datetime.strptime(payload.birth_date, "%Y-%m-%d").date() if payload.birth_date else None
        r = Resident(
            unit_id=payload.unit_id, full_name=payload.full_name,
            profile_type=payload.profile_type, birth_date=bdate,
            phone=payload.phone, email=payload.email,
            observations=payload.observations, is_pcd=payload.is_pcd,
            is_active=True,
        )
        session.add(r)
        session.commit()
        session.refresh(r)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser_resident(r), status_code=201)


@router.patch("/resident/{resident_id}")
def update_resident(resident_id: int, payload: ResidentUpdate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        r = session.get(Resident, resident_id)
        if not r:
            return JSONResponse({"error": "Morador nao encontrado"}, status_code=404)
        if payload.full_name is not None:
            r.full_name = payload.full_name
        if payload.profile_type is not None:
            r.profile_type = payload.profile_type
        if payload.birth_date is not None:
            r.birth_date = datetime.strptime(payload.birth_date, "%Y-%m-%d").date() if payload.birth_date.strip() else None
        if payload.phone is not None:
            r.phone = payload.phone
        if payload.email is not None:
            r.email = payload.email
        if payload.observations is not None:
            r.observations = payload.observations
        if payload.is_pcd is not None:
            r.is_pcd = payload.is_pcd
        session.add(r)
        session.commit()
        session.refresh(r)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser_resident(r))


@router.delete("/resident/{resident_id}")
def delete_resident(resident_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        r = session.get(Resident, resident_id)
        if r:
            r.is_active = False
            session.add(r)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return JSONResponse({"ok": True})


@router.post("/resident/{resident_id}/toggle-profile")
def toggle_profile(resident_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        r = session.get(Resident, resident_id)
        if not r:
            return JSONResponse({"error": "Morador nao encontrado"}, status_code=404)
        r.profile_type = "INQUILINO" if r.profile_type == "PROPRIETARIO" else "PROPRIETARIO"
        session.add(r)
        session.commit()
        session.refresh(r)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser_resident(r))


@router.post("/resident/{resident_id}/toggle-pcd")
def toggle_pcd(resident_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        r = session.get(Resident, resident_id)
        if not r:
            return JSONResponse({"error": "Morador nao encontrado"}, status_code=404)
        r.is_pcd = not r.is_pcd
        session.add(r)
        session.commit()
        session.refresh(r)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser_resident(r))


# ---------------------------------------------------------------------------
# PISCINA
# ---------------------------------------------------------------------------

@router.post("/resident/{resident_id}/pool-renew/{days}")
def renew_pool(resident_id: int, days: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        r = session.get(Resident, resident_id)
        if not r:
            return JSONResponse({"error": "Morador nao encontrado"}, status_code=404)
        r.pool_access_expiry = date.today() + timedelta(days=days)
        session.add(r)
        session.commit()
        session.refresh(r)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser_resident(r))


@router.post("/resident/{resident_id}/pool-block")
def block_pool(resident_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        r = session.get(Resident, resident_id)
        if not r:
            return JSONResponse({"error": "Morador nao encontrado"}, status_code=404)
        r.pool_access_expiry = None
        session.add(r)
        session.commit()
        session.refresh(r)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser_resident(r))


# ---------------------------------------------------------------------------
# VEICULOS CRUD
# ---------------------------------------------------------------------------

@router.post("/unit/{unit_id}/vehicle")
def create_vehicle(unit_id: int, payload: VehicleCreate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        v = Vehicle(unit_id=unit_id, type=payload.type, model=payload.model,
                    plate=payload.plate or "S/ Placa", tag=payload.tag)
        session.add(v)
        session.commit()
        session.refresh(v)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser_vehicle(v), status_code=201)


@router.patch("/vehicle/{vehicle_id}")
def update_vehicle(vehicle_id: int, payload: VehicleUpdate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        v = session.get(Vehicle, vehicle_id)
        if not v:
            return JSONResponse({"error": "Veiculo nao encontrado"}, status_code=404)
        for field in ("type", "model", "plate", "tag"):
            val = getattr(payload, field, None)
            if val is not None:
                setattr(v, field, val)
        session.add(v)
        session.commit()
        session.refresh(v)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser_vehicle(v))


@router.delete("/vehicle/{vehicle_id}")
def delete_vehicle(vehicle_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        v = session.get(Vehicle, vehicle_id)
        if v:
            session.delete(v)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return JSONResponse({"ok": True})


# ---------------------------------------------------------------------------
# PETS CRUD
# ---------------------------------------------------------------------------

@router.post("/unit/{unit_id}/pet")
def create_pet(unit_id: int, payload: PetCreate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        p = Pet(unit_id=unit_id, name=payload.name, breed=payload.breed, notes=payload.notes)
        session.add(p)
        session.commit()
        session.refresh(p)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser_pet(p), status_code=201)


@router.patch("/pet/{pet_id}")
def update_pet(pet_id: int, payload: PetUpdate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        p = session.get(Pet, pet_id)
        if not p:
            return JSONResponse({"error": "Pet nao encontrado"}, status_code=404)
        for field in ("name", "breed", "notes"):
            val = getattr(payload, field, None)
            if val is not None:
                setattr(p, field, val)
        session.add(p)
        session.commit()
        session.refresh(p)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser_pet(p))


@router.delete("/pet/{pet_id}")
def delete_pet(pet_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        p = session.get(Pet, pet_id)
        if p:
            session.delete(p)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return JSONResponse({"ok": True})


# ---------------------------------------------------------------------------
# DOCUMENTOS
# ---------------------------------------------------------------------------

@router.delete("/document/{doc_id}")
def delete_document(doc_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        doc = session.get(Document, doc_id)
        if doc:
            if doc.filepath.startswith("storage/"):
                full = os.path.join(STORAGE_DIR, doc.filepath.replace("storage/", "", 1))
            else:
                unit = session.get(Unit, doc.unit_id)
                folder = get_unit_folder_name(unit) if unit else str(doc.unit_id)
                full = os.path.join(STORAGE_DIR, folder, doc.filename)
            try:
                if os.path.exists(full):
                    os.remove(full)
            except Exception:
                pass
            session.delete(doc)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return JSONResponse({"ok": True})
