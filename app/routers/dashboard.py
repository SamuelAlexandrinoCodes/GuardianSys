from fastapi import APIRouter, Request
from sqlmodel import Session, select, func, or_, extract
from datetime import date, timedelta
from typing import Optional
from app.database import engine
from app.models import Unit, Resident, SystemConfig, Task, Meeting, Payable, Reservation
from app.config import templates, get_config

router = APIRouter()

def get_life_stage(birth_date: date):
    today = date.today()
    age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    if age < 18: return "CRIANÇA"
    if age >= 62: return "IDOSO"
    return "ADULTO"

def get_birthdays_day(session, d: date):
    results = session.exec(select(Resident, Unit).where(Resident.unit_id == Unit.id, Resident.is_active == True)).all()
    out = []
    for res, unit in results:
        if res.birth_date.month == d.month and res.birth_date.day == d.day:
            age = d.year - res.birth_date.year
            out.append({"name": res.full_name, "age": age, "unit_id": unit.id, "unit_number": unit.number})
    return out

def get_birthdays_month(session, year: int, month: int):
    results = session.exec(select(Resident, Unit).where(Resident.unit_id == Unit.id, Resident.is_active == True)).all()
    out = []
    for res, unit in results:
        if res.birth_date.month == month:
            out.append({"name": res.full_name, "day": res.birth_date.day, "unit_id": unit.id, "unit_number": unit.number})
    return sorted(out, key=lambda x: x["day"])

@router.get("/")
def dashboard(request: Request, d: Optional[str] = None):
    view_date = date.today()
    if d:
        try:
            view_date = date.fromisoformat(d)
        except ValueError:
            pass

    with Session(engine) as session:
        config = get_config(session)
        total_units = session.exec(select(func.count(Unit.id))).one()
        active_residents = session.exec(select(Resident).where(Resident.is_active == True)).all()
        total_residents = len(active_residents)
        owners = sum(1 for r in active_residents if r.profile_type == "PROPRIETARIO")
        tenants = sum(1 for r in active_residents if r.profile_type == "INQUILINO")
        criancas = sum(1 for r in active_residents if get_life_stage(r.birth_date) == "CRIANÇA")
        idosos = sum(1 for r in active_residents if get_life_stage(r.birth_date) == "IDOSO")
        adultos = total_residents - criancas - idosos
        occupied_units = session.exec(select(func.count(func.distinct(Resident.unit_id))).where(Resident.is_active == True)).one()
        occupancy = int((occupied_units / total_units) * 100) if total_units > 0 else 0

        birthdays_today = get_birthdays_day(session, view_date)
        birthdays_month = get_birthdays_month(session, view_date.year, view_date.month)

        payables_due = session.exec(select(Payable).where(Payable.status == "ABERTO")).all()
        payables_pending = []
        for p in payables_due:
            notify = getattr(p, 'notify_days_before', 7)
            window_start = p.due_date - timedelta(days=notify)
            if p.due_date <= view_date or (window_start <= view_date <= p.due_date):
                payables_pending.append(p)

        reservations_today = session.exec(select(Reservation, Unit, Resident)
            .select_from(Reservation).join(Unit).outerjoin(Resident, Reservation.resident_id == Resident.id)
            .where(Reservation.reservation_date == view_date, Reservation.status != "CANCELADA")).all()
        res_list = []
        for r, u, res in reservations_today:
            r.unit = u
            r.resident = res
            res_list.append(r)

        tasks_pending = session.exec(select(Task).where(
            Task.type == "TAREFA", Task.status == "PENDENTE",
            or_(Task.start_date.is_(None), Task.start_date <= view_date),
            or_(Task.due_date.is_(None), Task.due_date >= view_date)
        )).all()

        meetings_today = list(session.exec(select(Meeting).where(Meeting.meeting_date == view_date)).all())
        meetings_reminder = session.exec(select(Meeting).where(
            Meeting.reminder_date.isnot(None),
            Meeting.reminder_date <= view_date,
            Meeting.meeting_date >= view_date
        )).all()
        seen = {m.id for m in meetings_today}
        meetings_pending = meetings_today + [m for m in meetings_reminder if m.id not in seen]

    meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"]
    dias = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"]
    di = view_date.weekday()
    view_date_label = f"{dias[di]}, {view_date.day} de {meses[view_date.month-1]}"

    return templates.TemplateResponse("dashboard.html", {
        "request": request, "title": "Visão Geral", "view_date": view_date, "today": date.today(), "view_date_label": view_date_label,
        "stats": {"total_units": total_units, "total_residents": total_residents, "owners": owners,
                  "tenants": tenants, "occupancy": occupancy, "demography": {"kids": criancas, "adults": adultos, "seniors": idosos}},
        "birthdays_today": birthdays_today, "birthdays_month": birthdays_month,
        "payables_pending": payables_pending, "reservations_today": res_list, "tasks_pending": tasks_pending,
        "meetings_today": meetings_today, "meetings_reminder": meetings_reminder, "meetings_pending": meetings_pending,
        "config": config
    })

def _get_calendar_events(session, year: int, month: int):
    events = {}
    res = session.exec(select(Reservation).where(
        extract("month", Reservation.reservation_date) == month,
        extract("year", Reservation.reservation_date) == year,
        Reservation.status != "CANCELADA"
    )).all()
    for r in res:
        k = r.reservation_date.day
        if k not in events:
            events[k] = []
        color = "yellow" if r.area_name == "CHURRASQUEIRA" else ("blue" if r.area_name == "SALAO_FESTAS" else "purple")
        events[k].append(("reservation", color, r.area_name))
    meet = session.exec(select(Meeting).where(
        extract("month", Meeting.meeting_date) == month,
        extract("year", Meeting.meeting_date) == year
    )).all()
    for m in meet:
        k = m.meeting_date.day
        if k not in events:
            events[k] = []
        events[k].append(("meeting", "green", m.title))
    pay = session.exec(select(Payable).where(
        extract("month", Payable.due_date) == month,
        extract("year", Payable.due_date) == year,
        Payable.status == "ABERTO"
    )).all()
    for p in pay:
        k = p.due_date.day
        if k not in events:
            events[k] = []
        events[k].append(("payable", "red", p.description))
    return events