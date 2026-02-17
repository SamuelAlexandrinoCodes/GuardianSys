"""
API REST JSON — Calendario Global.
Regra de Ouro: ZERO alteracao em models.py ou database.py.
"""
import calendar
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlmodel import Session, select, extract

from app.database import engine
from app.models import Reservation, Meeting, Payable, Unit, Resident, Task
from app.config import get_config

router = APIRouter(prefix="/api", tags=["api-calendar"])


def _events_for_month(session, year: int, month: int) -> dict[int, list[dict]]:
    """Retorna dict {dia: [eventos]} para micro-dots no calendario."""
    events: dict[int, list[dict]] = {}

    # Reservas
    reservations = session.exec(select(Reservation).where(
        extract("month", Reservation.reservation_date) == month,
        extract("year", Reservation.reservation_date) == year,
        Reservation.status != "CANCELADA",
    )).all()
    for r in reservations:
        k = r.reservation_date.day
        events.setdefault(k, [])
        color = "yellow" if r.area_name == "CHURRASQUEIRA" else ("blue" if r.area_name == "SALAO_FESTAS" else "purple")
        events[k].append({"type": "reservation", "color": color, "label": r.area_name.replace("_", " ")})

    # Reunioes
    meetings = session.exec(select(Meeting).where(
        extract("month", Meeting.meeting_date) == month,
        extract("year", Meeting.meeting_date) == year,
    )).all()
    for m in meetings:
        k = m.meeting_date.day
        events.setdefault(k, [])
        events[k].append({"type": "meeting", "color": "green", "label": m.title})

    # Contas a pagar (abertas)
    payables = session.exec(select(Payable).where(
        extract("month", Payable.due_date) == month,
        extract("year", Payable.due_date) == year,
        Payable.status == "ABERTO",
    )).all()
    for p in payables:
        k = p.due_date.day
        events.setdefault(k, [])
        events[k].append({"type": "payable", "color": "red", "label": p.description})

    return events


@router.get("/calendar")
def get_calendar(d: Optional[str] = None):
    """Retorna grid do calendario + eventos (micro-dots) para um mes."""
    vd = date.today()
    if d:
        try:
            vd = date.fromisoformat(d)
        except ValueError:
            pass

    year, month = vd.year, vd.month
    today = date.today()

    # Build grid: list of {day, in_month, is_today, events}
    cal = calendar.Calendar(firstweekday=6)  # Domingo = primeiro
    days_in_month = calendar.monthrange(year, month)[1]

    # Weekday of first day (0=Mon..6=Sun)
    first_weekday = date(year, month, 1).weekday()
    # Offset para grid comecando em Domingo
    offset = (first_weekday + 1) % 7

    with Session(engine) as session:
        config = get_config(session)
        events = _events_for_month(session, year, month)

    grid: list[dict] = []

    # Dias do mes anterior (padding)
    if offset > 0:
        prev_last = date(year, month, 1) - timedelta(days=1)
        prev_start = prev_last.day - offset + 1
        for d_num in range(prev_start, prev_last.day + 1):
            grid.append({"day": d_num, "in_month": False, "is_today": False, "date": None, "events": []})

    # Dias do mes atual
    for d_num in range(1, days_in_month + 1):
        current = date(year, month, d_num)
        grid.append({
            "day": d_num,
            "in_month": True,
            "is_today": current == today,
            "date": current.isoformat(),
            "events": events.get(d_num, []),
        })

    # Dias do proximo mes (padding ate completar semanas)
    remaining = (7 - len(grid) % 7) % 7
    for d_num in range(1, remaining + 1):
        grid.append({"day": d_num, "in_month": False, "is_today": False, "date": None, "events": []})

    # Nav
    prev_m = month - 1 if month > 1 else 12
    prev_y = year if month > 1 else year - 1
    next_m = month + 1 if month < 12 else 1
    next_y = year if month < 12 else year + 1

    MONTHS_PT = ["", "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
                 "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

    return JSONResponse({
        "config": {"condo_name": config.condo_name if config else "Condominio"},
        "year": year,
        "month": month,
        "month_label": MONTHS_PT[month],
        "today": today.isoformat(),
        "grid": grid,
        "prev": f"{prev_y}-{prev_m:02d}-01",
        "next": f"{next_y}-{next_m:02d}-01",
    })


@router.get("/calendar/day")
def get_day_detail(d: str):
    """Retorna a agenda detalhada de um dia especifico."""
    try:
        target = date.fromisoformat(d)
    except ValueError:
        return JSONResponse({"error": "Data invalida"}, status_code=400)

    with Session(engine) as session:
        # Reservas
        res_rows = session.exec(
            select(Reservation, Unit, Resident)
            .select_from(Reservation).join(Unit).outerjoin(Resident, Reservation.resident_id == Resident.id)
            .where(Reservation.reservation_date == target, Reservation.status != "CANCELADA")
        ).all()
        reservations = [{
            "id": r.id, "area_name": r.area_name, "status": r.status,
            "unit": {"id": u.id, "number": u.number},
            "resident": {"id": res.id, "full_name": res.full_name} if res else None,
        } for r, u, res in res_rows]

        # Reunioes
        meetings_rows = session.exec(select(Meeting).where(Meeting.meeting_date == target)).all()
        meetings = [{
            "id": m.id, "title": m.title, "meeting_time": m.meeting_time,
            "reason": m.reason, "location": m.location,
        } for m in meetings_rows]

        # Contas
        pay_rows = session.exec(select(Payable).where(Payable.due_date == target, Payable.status == "ABERTO")).all()
        payables = [{"id": p.id, "description": p.description, "amount": p.amount} for p in pay_rows]

        # Tarefas do dia
        tasks_rows = session.exec(select(Task).where(
            Task.type == "TAREFA", Task.status == "PENDENTE",
            Task.due_date == target,
        )).all()
        tasks = [{"id": t.id, "title": t.title} for t in tasks_rows]

    DAYS_PT = ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado", "Domingo"]

    return JSONResponse({
        "date": target.isoformat(),
        "day_label": DAYS_PT[target.weekday()],
        "reservations": reservations,
        "meetings": meetings,
        "payables": payables,
        "tasks": tasks,
    })
