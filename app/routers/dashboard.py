from fastapi import APIRouter, Request
from sqlmodel import Session, select, func
from datetime import date
from app.database import engine
from app.models import Unit, Resident, SystemConfig
from app.config import templates, get_config

router = APIRouter()

def get_life_stage(birth_date: date):
    today = date.today()
    age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    if age < 18: return "CRIANÇA"
    if age >= 62: return "IDOSO"
    return "ADULTO"

def get_birthdays(session):
    today = date.today()
    results = session.exec(select(Resident, Unit).where(Resident.unit_id == Unit.id, Resident.is_active == True)).all()
    birthdays = []
    for res, unit in results:
        if res.birth_date.month == today.month and res.birth_date.day == today.day:
            age = today.year - res.birth_date.year
            birthdays.append({"name": res.full_name, "age": age, "unit_id": unit.id, "unit_number": unit.number})
    return birthdays

@router.get("/")
def dashboard(request: Request):
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
        birthdays = get_birthdays(session)
        
    return templates.TemplateResponse("dashboard.html", {
        "request": request, 
        "title": "Visão Geral", 
        "stats": {
            "total_units": total_units, 
            "total_residents": total_residents, 
            "owners": owners, 
            "tenants": tenants, 
            "occupancy": occupancy, 
            "demography": {"kids": criancas, "adults": adultos, "seniors": idosos}
        }, 
        "birthdays": birthdays, 
        "config": config
    })