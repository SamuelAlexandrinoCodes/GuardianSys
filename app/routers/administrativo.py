"""Módulo Administrativo: Tarefas, Reuniões e Contas a Pagar."""
from datetime import date, datetime
from typing import Optional
import json
from fastapi import APIRouter, Request, Form, BackgroundTasks
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session, select, or_, extract
from app.database import engine
from app.models import Task, Meeting, Payable, Reservation, Unit, Resident
from app.config import templates, get_config, run_backup_job

router = APIRouter()

@router.get("/tasks")
def redirect_tasks():
    return RedirectResponse(url="/administrativo?tab=tarefas", status_code=302)

@router.get("/finance")
def redirect_finance():
    return RedirectResponse(url="/administrativo?tab=contas", status_code=302)

# --- TAREFAS ---

@router.get("/administrativo")
def administrativo(request: Request, tab: str = "tarefas"):
    with Session(engine) as session:
        config = get_config(session)
        today = date.today()

        tasks_pending = session.exec(
            select(Task).where(
                Task.type == "TAREFA",
                Task.status == "PENDENTE",
                or_(Task.start_date.is_(None), Task.start_date <= today)
            ).order_by(Task.due_date.asc().nullslast())
        ).all()
        tasks_completed = session.exec(
            select(Task).where(Task.type == "TAREFA", Task.status == "CONCLUIDO").order_by(Task.completed_at.desc().nullslast())
        ).all()

        meetings = session.exec(
            select(Meeting).order_by(Meeting.meeting_date, Meeting.meeting_time)
        ).all()

        payables = session.exec(select(Payable).order_by(Payable.due_date)).all()
        total_open = sum(p.amount for p in payables if p.status == "ABERTO")

        res_query = select(Reservation, Unit, Resident).select_from(Reservation).join(Unit, Reservation.unit_id == Unit.id).outerjoin(Resident, Reservation.resident_id == Resident.id).where(
            Reservation.reservation_date >= today,
            Reservation.status != "CANCELADA",
            Reservation.status != "Pago/Confirmado"
        ).order_by(Reservation.reservation_date)
        res_rows = session.exec(res_query).all()
        open_reservations = []
        for r, u, res in res_rows:
            r.unit = u
            r.resident = res
            open_reservations.append(r)

    return templates.TemplateResponse("administrativo.html", {
        "request": request, "config": config, "tab": tab,
        "tasks_pending": tasks_pending, "tasks_completed": tasks_completed,
        "meetings": meetings, "payables": payables, "total_open": total_open,
        "open_reservations": open_reservations, "today": today, "date": date,
        "title": "Administrativo"
    })


@router.post("/administrativo/task/create", response_class=RedirectResponse)
def create_task(background_tasks: BackgroundTasks,
                title: str = Form(...), start_date: str = Form(None), due_date: str = Form(None),
                description: str = Form(None), details: str = Form(None)):
    with Session(engine) as session:
        sd = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else None
        dd = datetime.strptime(due_date, "%Y-%m-%d").date() if due_date else None
        session.add(Task(title=title, type="TAREFA", start_date=sd, due_date=dd, description=description, details=details, status="PENDENTE"))
        session.commit()
        background_tasks.add_task(run_backup_job)
    return RedirectResponse(url="/administrativo?tab=tarefas", status_code=303)


@router.post("/administrativo/task/{task_id}/toggle")
def toggle_task(task_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if t:
            if t.status == "PENDENTE":
                t.status = "CONCLUIDO"
                t.completed_at = datetime.now()
            else:
                t.status = "PENDENTE"
                t.completed_at = None
            session.add(t)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return ""


@router.delete("/administrativo/task/{task_id}")
def delete_task(task_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if t:
            session.delete(t)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return ""


# --- REUNIÕES ---

@router.post("/administrativo/meeting/create", response_class=RedirectResponse)
def create_meeting(background_tasks: BackgroundTasks,
                   title: str = Form(...), meeting_date: str = Form(...), meeting_time: str = Form(None),
                   reminder_date: str = Form(None), company: str = Form(None), reason: str = Form(None),
                   notes: str = Form(None), participants: str = Form(None)):
    with Session(engine) as session:
        md = datetime.strptime(meeting_date, "%Y-%m-%d").date()
        rd = datetime.strptime(reminder_date, "%Y-%m-%d").date() if reminder_date else None
        session.add(Meeting(title=title, meeting_date=md, meeting_time=meeting_time or None,
                           reminder_date=rd, company=company or None, reason=reason or None,
                           notes=notes or None, participants=participants or None))
        session.commit()
        background_tasks.add_task(run_backup_job)
    return RedirectResponse(url="/administrativo?tab=reunioes", status_code=303)


@router.delete("/administrativo/meeting/{mid}")
def delete_meeting(mid: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        m = session.get(Meeting, mid)
        if m:
            session.delete(m)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return ""


# --- CONTAS A PAGAR ---

@router.post("/administrativo/payable/create", response_class=RedirectResponse)
def create_payable(background_tasks: BackgroundTasks,
                   description: str = Form(...), subject: str = Form(None), payee: str = Form(None),
                   amount: float = Form(...), due_date: str = Form(...),
                   regularity: str = Form("MENSAL"), notify_days_before: int = Form(7)):
    with Session(engine) as session:
        dd = datetime.strptime(due_date, "%Y-%m-%d").date()
        session.add(Payable(description=description, subject=subject or None, payee=payee or None,
                           amount=amount, due_date=dd, regularity=regularity,
                           notify_days_before=notify_days_before, status="ABERTO"))
        session.commit()
        background_tasks.add_task(run_backup_job)
    return RedirectResponse(url="/administrativo?tab=contas", status_code=303)


@router.post("/administrativo/payable/{pid}/toggle", response_class=HTMLResponse)
def toggle_payable(pid: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        p = session.get(Payable, pid)
        if not p:
            return ""
        p.status = "PAGO" if p.status == "ABERTO" else "ABERTO"
        session.add(p)
        session.commit()
        background_tasks.add_task(run_backup_job)
        color = "bg-green-100 text-green-700" if p.status == "PAGO" else "bg-red-100 text-red-700"
        return f'<button hx-post="/administrativo/payable/{p.id}/toggle" hx-swap="outerHTML" class="{color} px-3 py-1 rounded-full text-xs font-bold border">{p.status}</button>'


@router.delete("/administrativo/payable/{pid}")
def delete_payable(pid: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        p = session.get(Payable, pid)
        if p:
            session.delete(p)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return ""
