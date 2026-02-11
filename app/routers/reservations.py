import traceback
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Request, Form, BackgroundTasks
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session, select, or_, extract
from app.database import engine
from app.models import Unit, Reservation, Resident
from app.config import templates, get_config, run_backup_job

router = APIRouter()

STATUS_FLOW = ["Fazer boleto", "Aguardando Boleto", "Aguardando Pagamento", "Pago/Confirmado"]

@router.get("/reservations")
def list_reservations(request: Request, tab: str = "churrasqueira", month: Optional[int] = None, year: Optional[int] = None):
    try:
        with Session(engine) as session:
            config = get_config(session)
            today = date.today()
            selected_month = month if month else today.month
            selected_year = year if year else today.year
            
            # --- CORREÇÃO DA QUERY AMBÍGUA ---
            # 1. select_from(Reservation): Define o ponto de partida
            # 2. join(Unit, ...): Condição explícita para evitar o triângulo com Resident
            query = select(Reservation, Unit, Resident)\
                .select_from(Reservation)\
                .join(Unit, Reservation.unit_id == Unit.id)\
                .outerjoin(Resident, Reservation.resident_id == Resident.id)

            if tab == "historico":
                query = query.where(
                    or_(extract('month', Reservation.reservation_date) == selected_month),
                    extract('year', Reservation.reservation_date) == selected_year,
                    or_(Reservation.reservation_date < today, Reservation.status == "CANCELADA")
                ).order_by(Reservation.reservation_date.desc())
            else:
                area_map = {"churrasqueira": "CHURRASQUEIRA", "salao": "SALAO_FESTAS", "gourmet": "SALAO_GOURMET"}
                target_area = area_map.get(tab, "CHURRASQUEIRA")
                query = query.where(
                    Reservation.reservation_date >= today,
                    Reservation.area_name == target_area,
                    Reservation.status != "CANCELADA"
                ).order_by(Reservation.reservation_date)
                
            results = session.exec(query).all()
            
            reservations_clean = []
            for res, unit, resident in results:
                res.unit = unit
                res.resident = resident
                reservations_clean.append(res)
                
        return templates.TemplateResponse("reservations.html", {
            "request": request, "config": config, "reservations": reservations_clean, 
            "active_tab": tab, "today": today, "selected_month": selected_month, 
            "selected_year": selected_year, "title": "Gestão de Reservas"
        })
    except Exception as e:
        print("ERRO LISTAGEM:", traceback.format_exc())
        return HTMLResponse(f"<h3>Erro Interno ao listar reservas:</h3><pre>{str(e)}</pre>", status_code=500)

@router.get("/reservations/residents_options", response_class=HTMLResponse)
def get_residents_options(unit_number: str):
    """Rota HTMX para buscar moradores"""
    try:
        with Session(engine) as session:
            unit = session.exec(select(Unit).where(Unit.number == unit_number)).first()
            if not unit: return "<option value=''>Unidade não encontrada</option>"
            
            residents = session.exec(select(Resident).where(Resident.unit_id == unit.id, Resident.is_active == True)).all()
            if not residents: return "<option value=''>Nenhum morador ativo</option>"
            
            return "".join([f"<option value='{r.id}'>{r.full_name}</option>" for r in residents])
    except Exception as e:
        return HTMLResponse(f"<option value=''>Erro: {str(e)}</option>", status_code=200)

@router.post("/reservations/create", response_class=RedirectResponse)
def create_reservation(
    background_tasks: BackgroundTasks, 
    unit_number: str = Form(...), 
    resident_id: int = Form(...), 
    area_name: str = Form(...), 
    reservation_date: str = Form(...)
):
    with Session(engine) as session:
        unit = session.exec(select(Unit).where(Unit.number == unit_number)).first()
        query_params = f"tab={area_name.lower().replace('_', '')}&modal=open&form_unit={unit_number}&form_date={reservation_date}&form_area={area_name}"
        
        if not unit: return RedirectResponse(url=f"/reservations?{query_params}&error=unit_not_found", status_code=303)
        try: res_date = datetime.strptime(reservation_date, "%Y-%m-%d").date()
        except: return RedirectResponse(url=f"/reservations?{query_params}", status_code=303)

        if res_date < date.today(): return RedirectResponse(url=f"/reservations?{query_params}&error=past_date", status_code=303)

        conflict = session.exec(select(Reservation).where(
            Reservation.area_name == area_name, 
            Reservation.reservation_date == res_date, 
            Reservation.status != "CANCELADA"
        )).first()
        if conflict: return RedirectResponse(url=f"/reservations?{query_params}&error=conflict", status_code=303)
            
        session.add(Reservation(unit_id=unit.id, resident_id=resident_id, area_name=area_name, reservation_date=res_date, status="Fazer boleto"))
        session.commit()
        background_tasks.add_task(run_backup_job)
        
        tab_map = {"CHURRASQUEIRA": "churrasqueira", "SALAO_FESTAS": "salao", "SALAO_GOURMET": "gourmet"}
        return RedirectResponse(url=f"/reservations?tab={tab_map.get(area_name, 'churrasqueira')}&success=true", status_code=303)

@router.post("/reservation/{res_id}/advance_status", response_class=HTMLResponse)
def advance_reservation_status(res_id: int):
    with Session(engine) as session:
        res = session.get(Reservation, res_id)
        if res and res.status in STATUS_FLOW:
            idx = STATUS_FLOW.index(res.status)
            if idx < len(STATUS_FLOW) - 1:
                res.status = STATUS_FLOW[idx + 1]
                session.add(res); session.commit(); run_backup_job()
        
        colors = {
            "Fazer boleto": "bg-red-100 text-red-700 border-red-200", 
            "Aguardando Boleto": "bg-yellow-100 text-yellow-700 border-yellow-200", 
            "Aguardando Pagamento": "bg-orange-100 text-orange-700 border-orange-200", 
            "Pago/Confirmado": "bg-green-100 text-green-700 border-green-200"
        }
        css = colors.get(res.status, "bg-slate-100")
        return f"""<button hx-post="/reservation/{res.id}/advance_status" hx-swap="outerHTML" class="{css} px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wide hover:scale-105 transition shadow-sm whitespace-nowrap" title="Clique para avançar etapa">{res.status}</button>"""

@router.post("/reservation/{res_id}/cancel", response_class=RedirectResponse)
def cancel_reservation(res_id: int, background_tasks: BackgroundTasks, authorized_by: str = Form(...)):
    with Session(engine) as session:
        res = session.get(Reservation, res_id)
        target = "churrasqueira"
        if res:
            res.status = "CANCELADA"; res.cancelled_by = authorized_by; session.add(res); session.commit(); background_tasks.add_task(run_backup_job)
            tab_map = {"CHURRASQUEIRA": "churrasqueira", "SALAO_FESTAS": "salao", "SALAO_GOURMET": "gourmet"}
            target = tab_map.get(res.area_name, "churrasqueira")
    return RedirectResponse(url=f"/reservations?tab={target}", status_code=303)

@router.get("/reservation/{res_id}/print", response_class=HTMLResponse)
def print_reservation_term(request: Request, res_id: int):
    with Session(engine) as session:
        res = session.get(Reservation, res_id)
        if not res: return "Reserva não encontrada"
        res.unit = session.get(Unit, res.unit_id)
        res.resident = session.get(Resident, res.resident_id)
        return templates.TemplateResponse("reservation_term.html", {"request": request, "res": res, "config": get_config(session), "today": date.today()})