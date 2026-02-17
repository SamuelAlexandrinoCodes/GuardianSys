"""
API REST JSON — Dashboard.
Regra de Ouro: ZERO alteração em models.py ou database.py.
"""
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from sqlmodel import Session, select, func, or_

from app.database import engine
from app.models import Unit, Resident, Task, Meeting, Payable, Reservation
from app.config import get_config

router = APIRouter(prefix="/api", tags=["api-dashboard"])


def _life_stage(birth_date: Optional[date]) -> str:
    if birth_date is None:
        return "ADULTO"
    today = date.today()
    age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    if age < 18:
        return "CRIANCA"
    if age >= 62:
        return "IDOSO"
    return "ADULTO"


def _birthdays_day(session, d: date) -> list[dict]:
    rows = session.exec(
        select(Resident, Unit).where(Resident.unit_id == Unit.id, Resident.is_active == True)  # noqa: E712
    ).all()
    out = []
    for res, unit in rows:
        if res.birth_date and res.birth_date.month == d.month and res.birth_date.day == d.day:
            age = d.year - res.birth_date.year
            out.append({"name": res.full_name, "age": age, "unit_id": unit.id, "unit_number": unit.number})
    return out


def _birthdays_month(session, year: int, month: int) -> list[dict]:
    rows = session.exec(
        select(Resident, Unit).where(Resident.unit_id == Unit.id, Resident.is_active == True)  # noqa: E712
    ).all()
    out = []
    for res, unit in rows:
        if res.birth_date and res.birth_date.month == month:
            out.append({"name": res.full_name, "day": res.birth_date.day, "unit_id": unit.id, "unit_number": unit.number})
    return sorted(out, key=lambda x: x["day"])


@router.get("/dashboard")
def get_dashboard(view_date: Optional[str] = Query(None)):
    vd = date.today()
    if view_date:
        try:
            vd = date.fromisoformat(view_date)
        except ValueError:
            pass

    today = date.today()
    DAYS_PT = ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado", "Domingo"]
    MONTHS_PT = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho",
                 "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]

    with Session(engine) as session:
        config = get_config(session)
        total_units = session.exec(select(func.count(Unit.id))).one()
        active_residents = session.exec(select(Resident).where(Resident.is_active == True)).all()  # noqa: E712
        total_residents = len(active_residents)
        owners = sum(1 for r in active_residents if r.profile_type == "PROPRIETARIO")
        tenants = sum(1 for r in active_residents if r.profile_type == "INQUILINO")
        kids = sum(1 for r in active_residents if _life_stage(r.birth_date) == "CRIANCA")
        seniors = sum(1 for r in active_residents if _life_stage(r.birth_date) == "IDOSO")
        adults = total_residents - kids - seniors
        occupied = session.exec(
            select(func.count(func.distinct(Resident.unit_id))).where(Resident.is_active == True)  # noqa: E712
        ).one()
        occupancy = int((occupied / total_units) * 100) if total_units > 0 else 0

        birthdays_today = _birthdays_day(session, vd)
        birthdays_month = _birthdays_month(session, vd.year, vd.month)

        # Payables in alert window
        payables_open = session.exec(select(Payable).where(Payable.status == "ABERTO")).all()
        payables_pending = []
        for p in payables_open:
            notify = getattr(p, "notify_days_before", 7)
            window_start = p.due_date - timedelta(days=notify)
            if p.due_date <= vd or (window_start <= vd <= p.due_date):
                payables_pending.append({
                    "id": p.id, "description": p.description,
                    "amount": p.amount, "due_date": p.due_date.isoformat(),
                    "payee": p.payee, "status": p.status,
                })

        # Reservations of the view date
        res_rows = session.exec(
            select(Reservation, Unit, Resident)
            .select_from(Reservation).join(Unit).outerjoin(Resident, Reservation.resident_id == Resident.id)
            .where(Reservation.reservation_date == vd, Reservation.status != "CANCELADA")
        ).all()
        reservations_today = []
        for r, u, res in res_rows:
            reservations_today.append({
                "id": r.id, "area_name": r.area_name,
                "reservation_date": r.reservation_date.isoformat(),
                "status": r.status,
                "unit": {"id": u.id, "number": u.number, "block": u.block},
                "resident": {"id": res.id, "full_name": res.full_name} if res else None,
            })

        # Tasks
        tasks_pending = session.exec(select(Task).where(
            Task.type == "TAREFA", Task.status == "PENDENTE",
            or_(Task.start_date.is_(None), Task.start_date <= vd),
            or_(Task.due_date.is_(None), Task.due_date >= vd),
        )).all()
        tasks_overdue = session.exec(select(Task).where(
            Task.type == "TAREFA", Task.status == "PENDENTE",
            Task.due_date.isnot(None), Task.due_date < vd,
        )).all()

        # Meetings
        meetings_today = list(session.exec(select(Meeting).where(Meeting.meeting_date == vd)).all())
        meetings_reminder = session.exec(select(Meeting).where(
            Meeting.reminder_date.isnot(None),
            Meeting.reminder_date <= vd,
            Meeting.meeting_date >= vd,
        )).all()
        seen = {m.id for m in meetings_today}
        meetings_all = meetings_today + [m for m in meetings_reminder if m.id not in seen]

    def _task_json(t: Task) -> dict:
        return {
            "id": t.id, "title": t.title, "status": t.status,
            "due_date": t.due_date.isoformat() if t.due_date else None,
        }

    def _meeting_json(m: Meeting) -> dict:
        return {
            "id": m.id, "title": m.title,
            "meeting_date": m.meeting_date.isoformat(),
            "meeting_time": m.meeting_time,
            "reason": m.reason, "notes": m.notes,
        }

    view_date_label = f"{DAYS_PT[vd.weekday()]}, {vd.day} de {MONTHS_PT[vd.month - 1]}"

    return JSONResponse({
        "config": {
            "condo_name": config.condo_name if config else "Condominio",
            "user_name": config.user_name if config else None,
        },
        "view_date": vd.isoformat(),
        "today": today.isoformat(),
        "is_today": vd == today,
        "view_date_label": view_date_label,
        "stats": {
            "total_units": total_units,
            "total_residents": total_residents,
            "owners": owners,
            "tenants": tenants,
            "occupancy": occupancy,
            "demography": {"kids": kids, "adults": adults, "seniors": seniors},
        },
        "birthdays_today": birthdays_today,
        "birthdays_month": birthdays_month,
        "payables_pending": payables_pending,
        "reservations_today": reservations_today,
        "tasks_pending": [_task_json(t) for t in tasks_pending],
        "tasks_overdue": [_task_json(t) for t in tasks_overdue],
        "meetings_today": [_meeting_json(m) for m in meetings_all],
    })
