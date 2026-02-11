import traceback
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Request, Form, BackgroundTasks, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session, select, or_, extract, and_
import os
import shutil
from app.database import engine
from app.models import Unit, Reservation, Resident, Document
from app.config import templates, get_config, run_backup_job, STORAGE_DIR, get_unit_folder_name, get_reservation_folder_name

router = APIRouter()

STATUS_FLOW = ["Fazer boleto", "Aguardando retorno da imobiliária", "Aguardando Pagamento", "Pago/Confirmado"]
# Legado: "Aguardando Boleto" tratado como "Aguardando retorno da imobiliária"
STATUS_LEGACY_MAP = {"Aguardando Boleto": "Aguardando retorno da imobiliária"}

@router.get("/reservations")
def list_reservations(request: Request, tab: str = "churrasqueira", month: Optional[int] = None, year: Optional[int] = None,
                     q: Optional[str] = None, sort_by: Optional[str] = None, sort_dir: Optional[str] = None):
    try:
        with Session(engine) as session:
            config = get_config(session)
            today = date.today()
            selected_month = month if month else today.month
            selected_year = year if year else today.year

            query = select(Reservation, Unit, Resident)\
                .select_from(Reservation)\
                .join(Unit, Reservation.unit_id == Unit.id)\
                .outerjoin(Resident, Reservation.resident_id == Resident.id)

            if tab == "historico":
                query = query.where(
                    extract('month', Reservation.reservation_date) == selected_month,
                    extract('year', Reservation.reservation_date) == selected_year,
                    or_(Reservation.reservation_date < today, Reservation.status == "CANCELADA")
                )
                default_order = Reservation.reservation_date.desc()
            else:
                area_map = {"churrasqueira": "CHURRASQUEIRA", "salao": "SALAO_FESTAS", "gourmet": "SALAO_GOURMET"}
                target_area = area_map.get(tab, "CHURRASQUEIRA")
                query = query.where(
                    Reservation.reservation_date >= today,
                    Reservation.area_name == target_area,
                    Reservation.status != "CANCELADA"
                )
                default_order = Reservation.reservation_date.asc()

            if q and q.strip():
                q = q.strip()
                query = query.where(or_(
                    Unit.number.like(f"%{q}%"),
                    Reservation.status.like(f"%{q}%"),
                    Resident.full_name.like(f"%{q}%")
                ))

            if sort_by == "status":
                order_col = Reservation.status
                query = query.order_by(order_col.desc() if sort_dir == "desc" else order_col.asc())
            elif sort_by == "date":
                order_col = Reservation.reservation_date
                query = query.order_by(order_col.desc() if sort_dir == "desc" else order_col.asc())
            else:
                query = query.order_by(default_order)
                
            results = session.exec(query).all()
            reservations_clean = []
            for res, unit, resident in results:
                res.unit = unit
                res.resident = resident
                reservations_clean.append(res)
                
        return templates.TemplateResponse("reservations.html", {
            "request": request, "config": config, "reservations": reservations_clean, 
            "active_tab": tab, "today": today, "selected_month": selected_month, 
            "selected_year": selected_year, "search_q": q or "", "sort_by": sort_by or "", "sort_dir": sort_dir or "asc",
            "title": "Gestão de Reservas"
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

def _status_colors():
    return {
        "Fazer boleto": "bg-red-100 text-red-700 border-red-200",
        "Aguardando Boleto": "bg-yellow-100 text-yellow-700 border-yellow-200",  # legado
        "Aguardando retorno da imobiliária": "bg-yellow-100 text-yellow-700 border-yellow-200",
        "Aguardando Pagamento": "bg-orange-100 text-orange-700 border-orange-200",
        "Pago/Confirmado": "bg-green-100 text-green-700 border-green-200",
    }

def _status_tooltip(status: str) -> str:
    tips = {
        "Fazer boleto": "Envie o email de solicitação (botão 📄) e depois clique aqui",
        "Aguardando Boleto": "Clique quando o boleto chegar da imobiliária",
        "Aguardando retorno da imobiliária": "Clique quando o boleto chegar da imobiliária",
        "Aguardando Pagamento": "Envie o boleto no WhatsApp do morador e clique quando estiver pago",
        "Pago/Confirmado": "Concluído",
    }
    return tips.get(status, "Clique para avançar etapa")

@router.post("/reservation/{res_id}/advance_status", response_class=HTMLResponse)
def advance_reservation_status(res_id: int):
    with Session(engine) as session:
        res = session.get(Reservation, res_id)
        if res and res.status not in ("CANCELADA",):
            # Migra status legado e avança
            status = STATUS_LEGACY_MAP.get(res.status, res.status)
            if status in STATUS_FLOW:
                idx = STATUS_FLOW.index(status)
                if idx < len(STATUS_FLOW) - 1:
                    next_status = STATUS_FLOW[idx + 1]
                    res.status = next_status
                    if next_status == "Pago/Confirmado":
                        res.confirmed_at = datetime.now()
                else:
                    res.status = status
            elif res.status == "Aguardando Boleto":
                res.status = "Aguardando Pagamento"  # migração: pula para o próximo
            session.add(res)
            session.commit()
            run_backup_job()
        
        colors = _status_colors()
        css = colors.get(res.status, "bg-slate-100")
        tip = _status_tooltip(res.status)
        return f"""<button hx-post="/reservation/{res.id}/advance_status" hx-swap="outerHTML" class="{css} px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wide hover:scale-105 transition shadow-sm whitespace-nowrap" title="{tip}">{res.status}</button>"""

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


@router.get("/reservations/print_month", response_class=HTMLResponse)
def print_month_reservations(request: Request, month: Optional[int] = None, year: Optional[int] = None):
    """Imprime todas as reservas do mês (passadas e futuras) para rastreamento em papel."""
    today = date.today()
    now = datetime.now()
    m = month if month else today.month
    y = year if year else today.year
    with Session(engine) as session:
        config = get_config(session)
        # Todas as reservas do mês, incluindo passadas, canceladas e futuras
        query = (
            select(Reservation, Unit, Resident)
            .select_from(Reservation)
            .join(Unit, Reservation.unit_id == Unit.id)
            .outerjoin(Resident, Reservation.resident_id == Resident.id)
            .where(extract("month", Reservation.reservation_date) == m, extract("year", Reservation.reservation_date) == y)
            .order_by(Reservation.reservation_date, Reservation.area_name)
        )
        results = session.exec(query).all()
        reservations = []
        for res, unit, resident in results:
            res.unit = unit
            res.resident = resident
            reservations.append(res)
        month_names = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
        return templates.TemplateResponse("reservations_print_month.html", {
            "request": request, "config": config, "reservations": reservations,
            "month_name": month_names[m], "year": y, "now": now
        })


@router.get("/reservation/{res_id}/documents_modal", response_class=HTMLResponse)
def reservation_documents_modal(request: Request, res_id: int, tab: str = "churrasqueira", month: Optional[int] = None, year: Optional[int] = None):
    """Modal com documentos da reserva."""
    with Session(engine) as session:
        res = session.get(Reservation, res_id)
        if not res:
            return HTMLResponse("Reserva não encontrada", status_code=404)
        res.unit = session.get(Unit, res.unit_id)
        res.resident = session.get(Resident, res.resident_id)
        docs = session.exec(select(Document).where(Document.reservation_id == res_id).order_by(Document.upload_date.desc())).all()
        redirect_params = f"tab={tab}"
        if tab == "historico" and month and year:
            redirect_params += f"&month={month}&year={year}"
        return templates.TemplateResponse("partials/reservation_docs_modal.html", {
            "request": request, "res": res, "documents": docs, "redirect_params": redirect_params
        })


@router.post("/reservation/{res_id}/upload")
async def upload_reservation_document(res_id: int, background_tasks: BackgroundTasks, file: UploadFile = File(...), redirect_params: str = Form("tab=churrasqueira")):
    with Session(engine) as session:
        res = session.get(Reservation, res_id)
        if not res or not file.filename:
            return RedirectResponse(url="/reservations", status_code=303)
        unit = session.get(Unit, res.unit_id)
        folder_name = get_unit_folder_name(unit) if unit else str(res.unit_id)
        res_subfolder = get_reservation_folder_name(res.reservation_date, res.area_name)
        res_folder = os.path.join(STORAGE_DIR, folder_name, "reservas", res_subfolder)
        os.makedirs(res_folder, exist_ok=True)
        safe_filename = file.filename.replace(" ", "_")
        filepath = os.path.join(res_folder, safe_filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        rel_path = f"storage/{folder_name}/reservas/{res_subfolder}/{safe_filename}"
        session.add(Document(unit_id=res.unit_id, reservation_id=res_id, filename=safe_filename, filepath=rel_path, category="Reserva"))
        session.commit()
        background_tasks.add_task(run_backup_job)
    return RedirectResponse(url=f"/reservations?{redirect_params}", status_code=303)