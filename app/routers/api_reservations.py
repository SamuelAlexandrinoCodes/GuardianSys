"""
API REST JSON — Reservas.
Regra de Ouro: ZERO alteracao em models.py ou database.py.
"""
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import Session, select, or_, extract

from app.database import engine
from app.models import Unit, Reservation, Resident, Document
from app.config import get_config, run_backup_job

router = APIRouter(prefix="/api", tags=["api-reservations"])

STATUS_FLOW = [
    "Fazer boleto",
    "Aguardando retorno da imobiliaria",
    "Aguardando Pagamento",
    "Pago/Confirmado",
]
STATUS_LEGACY_MAP = {"Aguardando Boleto": "Aguardando retorno da imobiliaria"}


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class ReservationCreate(BaseModel):
    unit_number: str
    resident_id: int
    area_name: str
    reservation_date: str


class ReservationCancel(BaseModel):
    authorized_by: str


# ---------------------------------------------------------------------------
# Serializer
# ---------------------------------------------------------------------------

def _ser(r: Reservation, unit: Unit | None = None, resident: Resident | None = None) -> dict:
    return {
        "id": r.id,
        "unit_id": r.unit_id,
        "resident_id": r.resident_id,
        "area_name": r.area_name,
        "reservation_date": r.reservation_date.isoformat(),
        "status": r.status,
        "cancelled_by": r.cancelled_by,
        "confirmed_at": r.confirmed_at.isoformat() if r.confirmed_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "unit": {"id": unit.id, "number": unit.number, "block": unit.block} if unit else None,
        "resident": {"id": resident.id, "full_name": resident.full_name} if resident else None,
    }


# ---------------------------------------------------------------------------
# Listagem
# ---------------------------------------------------------------------------

@router.get("/reservations")
def list_reservations(
    tab: str = "churrasqueira",
    month: Optional[int] = None,
    year: Optional[int] = None,
    q: Optional[str] = None,
):
    today = date.today()
    m = month or today.month
    y = year or today.year

    with Session(engine) as session:
        config = get_config(session)
        query = (
            select(Reservation, Unit, Resident)
            .select_from(Reservation)
            .join(Unit, Reservation.unit_id == Unit.id)
            .outerjoin(Resident, Reservation.resident_id == Resident.id)
        )

        if tab == "historico":
            query = query.where(
                extract("month", Reservation.reservation_date) == m,
                extract("year", Reservation.reservation_date) == y,
                or_(Reservation.reservation_date < today, Reservation.status == "CANCELADA"),
            )
            query = query.order_by(Reservation.reservation_date.desc())
        elif tab == "pendentes":
            query = query.where(
                Reservation.reservation_date >= today,
                Reservation.status != "CANCELADA",
                Reservation.status != "Pago/Confirmado",
            )
            query = query.order_by(Reservation.reservation_date.asc())
        elif tab == "confirmadas":
            query = query.where(
                Reservation.reservation_date >= today,
                Reservation.status == "Pago/Confirmado",
            )
            query = query.order_by(Reservation.reservation_date.asc())
        else:
            area_map = {
                "churrasqueira": "CHURRASQUEIRA",
                "salao": "SALAO_FESTAS",
                "gourmet": "SALAO_GOURMET",
            }
            target = area_map.get(tab, "CHURRASQUEIRA")
            query = query.where(
                Reservation.reservation_date >= today,
                Reservation.area_name == target,
                Reservation.status != "CANCELADA",
            )
            query = query.order_by(Reservation.reservation_date.asc())

        if q and q.strip():
            query = query.where(or_(
                Unit.number.like(f"%{q}%"),
                Reservation.status.like(f"%{q}%"),
                Resident.full_name.like(f"%{q}%"),
            ))

        rows = session.exec(query).all()
        items = [_ser(r, u, res) for r, u, res in rows]

    return JSONResponse({
        "config": {"condo_name": config.condo_name if config else "Condominio"},
        "reservations": items,
        "active_tab": tab,
        "today": today.isoformat(),
    })


# ---------------------------------------------------------------------------
# Detalhe de uma reserva
# ---------------------------------------------------------------------------

@router.get("/reservation/{res_id}")
def get_reservation(res_id: int):
    with Session(engine) as session:
        r = session.get(Reservation, res_id)
        if not r:
            return JSONResponse({"error": "Reserva nao encontrada"}, status_code=404)
        unit = session.get(Unit, r.unit_id)
        resident = session.get(Resident, r.resident_id) if r.resident_id else None
        docs = session.exec(
            select(Document).where(Document.reservation_id == res_id).order_by(Document.upload_date.desc())
        ).all()

        return JSONResponse({
            **_ser(r, unit, resident),
            "documents": [{
                "id": d.id, "filename": d.filename, "filepath": d.filepath,
                "category": d.category, "upload_date": d.upload_date.isoformat() if d.upload_date else None,
            } for d in docs],
        })


# ---------------------------------------------------------------------------
# Moradores de uma unidade (para dropdown de criacao)
# ---------------------------------------------------------------------------

@router.get("/reservations/residents-for-unit")
def residents_for_unit(unit_number: str):
    with Session(engine) as session:
        unit = session.exec(select(Unit).where(Unit.number == unit_number)).first()
        if not unit:
            return JSONResponse({"residents": [], "error": "Unidade nao encontrada"})
        residents = session.exec(
            select(Resident).where(Resident.unit_id == unit.id, Resident.is_active == True)  # noqa: E712
        ).all()
        return JSONResponse({
            "unit_id": unit.id,
            "residents": [{"id": r.id, "full_name": r.full_name} for r in residents],
        })


# ---------------------------------------------------------------------------
# Criar reserva
# ---------------------------------------------------------------------------

@router.post("/reservations")
def create_reservation(payload: ReservationCreate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        unit = session.exec(select(Unit).where(Unit.number == payload.unit_number)).first()
        if not unit:
            return JSONResponse({"error": "Unidade nao encontrada"}, status_code=400)

        try:
            res_date = datetime.strptime(payload.reservation_date, "%Y-%m-%d").date()
        except ValueError:
            return JSONResponse({"error": "Data invalida"}, status_code=400)

        if res_date < date.today():
            return JSONResponse({"error": "Data no passado"}, status_code=400)

        conflict = session.exec(select(Reservation).where(
            Reservation.area_name == payload.area_name,
            Reservation.reservation_date == res_date,
            Reservation.status != "CANCELADA",
        )).first()
        if conflict:
            return JSONResponse({"error": "Conflito: ja existe reserva para esta area/data"}, status_code=409)

        r = Reservation(
            unit_id=unit.id,
            resident_id=payload.resident_id,
            area_name=payload.area_name,
            reservation_date=res_date,
            status="Fazer boleto",
        )
        session.add(r)
        session.commit()
        session.refresh(r)
        background_tasks.add_task(run_backup_job)

        u = session.get(Unit, r.unit_id)
        res = session.get(Resident, r.resident_id) if r.resident_id else None
    return JSONResponse(_ser(r, u, res), status_code=201)


# ---------------------------------------------------------------------------
# Avancar status
# ---------------------------------------------------------------------------

@router.post("/reservation/{res_id}/advance")
def advance_status(res_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        r = session.get(Reservation, res_id)
        if not r:
            return JSONResponse({"error": "Reserva nao encontrada"}, status_code=404)
        if r.status == "CANCELADA":
            return JSONResponse({"error": "Reserva cancelada"}, status_code=400)

        status = STATUS_LEGACY_MAP.get(r.status, r.status)
        if status in STATUS_FLOW:
            idx = STATUS_FLOW.index(status)
            if idx < len(STATUS_FLOW) - 1:
                r.status = STATUS_FLOW[idx + 1]
                if r.status == "Pago/Confirmado":
                    r.confirmed_at = datetime.now()
        session.add(r)
        session.commit()
        session.refresh(r)
        background_tasks.add_task(run_backup_job)

        u = session.get(Unit, r.unit_id)
        res = session.get(Resident, r.resident_id) if r.resident_id else None
    return JSONResponse(_ser(r, u, res))


# ---------------------------------------------------------------------------
# Cancelar
# ---------------------------------------------------------------------------

@router.post("/reservation/{res_id}/cancel")
def cancel_reservation(res_id: int, payload: ReservationCancel, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        r = session.get(Reservation, res_id)
        if not r:
            return JSONResponse({"error": "Reserva nao encontrada"}, status_code=404)
        r.status = "CANCELADA"
        r.cancelled_by = payload.authorized_by
        session.add(r)
        session.commit()
        session.refresh(r)
        background_tasks.add_task(run_backup_job)

        u = session.get(Unit, r.unit_id)
        res = session.get(Resident, r.resident_id) if r.resident_id else None
    return JSONResponse(_ser(r, u, res))
