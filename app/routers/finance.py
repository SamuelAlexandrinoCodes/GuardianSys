from datetime import datetime, date # <-- CORREÇÃO: Importamos o 'date'
from fastapi import APIRouter, Request, Form, BackgroundTasks
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session, select
from app.database import engine
from app.models import Payable
from app.config import templates, get_config, run_backup_job

router = APIRouter()

@router.get("/finance", response_class=HTMLResponse)
def list_finance(request: Request):
    with Session(engine) as session:
        payables = session.exec(select(Payable).order_by(Payable.due_date)).all()
        total_open = sum(p.amount for p in payables if p.status == "ABERTO")
        
        # CORREÇÃO: Enviamos a variável "date" para o HTML
        return templates.TemplateResponse("finance.html", {
            "request": request, 
            "payables": payables, 
            "total_open": total_open, 
            "config": get_config(session),
            "date": date
        })

@router.post("/finance/create", response_class=RedirectResponse)
def create_payable(background_tasks: BackgroundTasks, description: str = Form(...), amount: float = Form(...), due_date: str = Form(...)):
    with Session(engine) as session:
        dd = datetime.strptime(due_date, "%Y-%m-%d").date()
        session.add(Payable(description=description, amount=amount, due_date=dd, status="ABERTO"))
        session.commit()
        background_tasks.add_task(run_backup_job)
    return RedirectResponse(url="/finance", status_code=303)

@router.post("/finance/{pid}/toggle_status", response_class=HTMLResponse)
def toggle_payable_status(pid: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        p = session.get(Payable, pid)
        p.status = "PAGO" if p.status == "ABERTO" else "ABERTO"
        session.add(p)
        session.commit()
        background_tasks.add_task(run_backup_job)
        color = "bg-green-100 text-green-700" if p.status == "PAGO" else "bg-red-100 text-red-700"
        return f"""<button hx-post="/finance/{pid}/toggle_status" hx-swap="outerHTML" class="{color} px-3 py-1 rounded-full text-xs font-bold border hover:scale-105 transition shadow-sm w-24">{p.status}</button>"""

@router.delete("/finance/{pid}")
def delete_payable(pid: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        p = session.get(Payable, pid)
        if p:
            session.delete(p)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return ""