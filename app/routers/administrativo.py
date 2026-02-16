"""Módulo Administrativo: Tarefas, Reuniões e Contas a Pagar."""
from datetime import date, datetime
from types import SimpleNamespace
from typing import Optional
import os
from fastapi import APIRouter, Request, Form, BackgroundTasks, Query, Body
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from sqlmodel import Session, select, or_
from app.database import engine
from app.models import Task, TaskStep, Meeting, Payable, Reservation, Unit, Resident
from app.config import templates, get_config, run_backup_job, STORAGE_DIR
from app.smart_dates import resolve_date_or_smart, resolve_datetime_or_smart

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
            ).order_by(Task.order_index.asc(), Task.due_date.asc().nullslast())
        ).all()
        tasks_completed = session.exec(
            select(Task).where(Task.type == "TAREFA", Task.status == "CONCLUIDO").order_by(Task.order_index.asc(), Task.completed_at.desc().nullslast())
        ).all()
        task_ids = [t.id for t in tasks_pending] + [t.id for t in tasks_completed]
        subtasks_by_task_id = {}
        for tid in task_ids:
            steps = list(session.exec(select(TaskStep).where(TaskStep.task_id == tid).order_by(TaskStep.sort_order, TaskStep.id)).all())
            subtasks_by_task_id[tid] = steps
            subtasks_by_task_id[str(tid)] = steps  # chave string para compatibilidade com Jinja2

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
        "subtasks_by_task_id": subtasks_by_task_id,
        "meetings": meetings, "payables": payables, "total_open": total_open,
        "open_reservations": open_reservations, "today": today, "date": date,
        "title": "Administrativo"
    })


@router.get("/administrativo/smart-date")
def get_smart_date(
    type: str = Query("date", description="date ou datetime"),
    value: str = Query(..., description="Ex: amanha, proxima_semana, hoje 20:00"),
):
    """Retorna data/datetime interpretada a partir de Smart Date (linguagem natural)."""
    from app.smart_dates import parse_smart_date, parse_smart_datetime
    if type == "datetime":
        dt = parse_smart_datetime(value)
        if dt is None:
            return JSONResponse({"error": "Não reconhecido", "value": None}, status_code=400)
        return JSONResponse({"value": dt.strftime("%Y-%m-%dT%H:%M"), "iso": dt.isoformat()})
    d = parse_smart_date(value)
    if d is None:
        return JSONResponse({"error": "Não reconhecido", "value": None}, status_code=400)
    return JSONResponse({"value": d.isoformat(), "display": d.strftime("%d/%m/%Y")})


@router.post("/administrativo/task/create")
def create_task(request: Request, background_tasks: BackgroundTasks,
                title: str = Form(...), start_date: str = Form(None), due_date: str = Form(None),
                description: str = Form(None), details: str = Form(None),
                reminder_at: str = Form(None), repeat: str = Form("NONE"), in_agenda: str = Form("1")):
    with Session(engine) as session:
        sd = resolve_date_or_smart(start_date) if start_date and start_date.strip() else None
        dd = resolve_date_or_smart(due_date) if due_date and due_date.strip() else None
        rem = resolve_datetime_or_smart(reminder_at) if reminder_at and reminder_at.strip() else None
        task = Task(
            title=title, type="TAREFA", start_date=sd, due_date=dd,
            description=description, details=details, status="PENDENTE",
            reminder_at=rem, repeat=repeat or "NONE", in_agenda=(in_agenda == "1" or in_agenda == "on")
        )
        session.add(task)
        session.commit()
        session.refresh(task)
        background_tasks.add_task(run_backup_job)
        if request.headers.get("HX-Request"):
            today = date.today()
            html = templates.get_template("partials/task_row_pending.html").render({"request": request, "task": task, "today": today})
            return HTMLResponse(html, status_code=201)
    return RedirectResponse(url="/administrativo?tab=tarefas", status_code=303)


@router.post("/administrativo/task/{task_id}/toggle")
def toggle_task(request: Request, task_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if not t:
            return HTMLResponse("", status_code=404)
        if t.status == "PENDENTE":
            t.status = "CONCLUIDO"
            t.completed_at = datetime.now()
        else:
            t.status = "PENDENTE"
            t.completed_at = None
        session.add(t)
        session.commit()
        session.refresh(t)
        background_tasks.add_task(run_backup_job)
        if request.headers.get("HX-Request"):
            today = date.today()
            steps = list(session.exec(select(TaskStep).where(TaskStep.task_id == t.id).order_by(TaskStep.sort_order, TaskStep.id)).all())
            task_steps = steps
            subtasks_by_task_id = {t.id: steps, str(t.id): steps}
            html = templates.get_template("partials/task_toggle_response.html").render({
                "request": request, "task": t, "today": today, "new_status": t.status,
                "task_steps": task_steps, "subtasks_by_task_id": subtasks_by_task_id
            })
            return HTMLResponse(html)
    return HTMLResponse("")


@router.delete("/administrativo/task/{task_id}")
def delete_task(task_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if t:
            session.delete(t)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return HTMLResponse("")


@router.post("/administrativo/tasks/reorder")
def reorder_tasks(background_tasks: BackgroundTasks, order: list[int] = Body(..., embed=True, alias="order")):
    """Recebe a nova ordem dos IDs de tarefas e atualiza order_index."""
    with Session(engine) as session:
        for idx, task_id in enumerate(order):
            t = session.get(Task, task_id)
            if t and t.type == "TAREFA":
                t.order_index = idx
                session.add(t)
        session.commit()
        background_tasks.add_task(run_backup_job)
    return JSONResponse({"ok": True})


@router.get("/administrativo/reminders")
def get_reminders():
    """Retorna tarefas com lembrete nos próximos 2 minutos (para notificação)."""
    from datetime import timedelta
    with Session(engine) as session:
        now = datetime.now()
        window_end = now + timedelta(minutes=2)
        tasks = session.exec(
            select(Task).where(
                Task.type == "TAREFA",
                Task.status == "PENDENTE",
                Task.reminder_at.isnot(None),
                Task.reminder_at >= now - timedelta(minutes=1),
                Task.reminder_at <= window_end
            )
        ).all()
        return JSONResponse([{"id": t.id, "title": t.title, "reminder_at": t.reminder_at.isoformat() if t.reminder_at else None} for t in tasks])


@router.get("/administrativo/task/{task_id}/sheet")
def task_sheet(request: Request, task_id: int):
    """Retorna o HTML do conteúdo do Side Sheet da tarefa."""
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if not t:
            return HTMLResponse("", status_code=404)
        steps = session.exec(select(TaskStep).where(TaskStep.task_id == task_id).order_by(TaskStep.sort_order, TaskStep.id)).all()
        today = date.today()
        html = templates.get_template("partials/task_sheet.html").render({
            "request": request, "task": t, "steps": steps, "today": today
        })
        return HTMLResponse(html)


@router.patch("/administrativo/task/{task_id}")
def update_task(request: Request, task_id: int, background_tasks: BackgroundTasks,
                title: str = Form(None), start_date: str = Form(None), due_date: str = Form(None),
                details: str = Form(None), notes: str = Form(None), reminder_at: str = Form(None),
                repeat: str = Form(None), in_agenda: str = Form(None)):
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if not t:
            return HTMLResponse("", status_code=404)
        if title is not None and title.strip():
            t.title = title.strip()
        if start_date is not None:
            t.start_date = resolve_date_or_smart(start_date) if (start_date and start_date.strip()) else None
        if due_date is not None:
            t.due_date = resolve_date_or_smart(due_date) if (due_date and due_date.strip()) else None
        if details is not None:
            t.details = details.strip() or None
        if notes is not None:
            t.notes = notes.strip() or None
        if reminder_at is not None:
            t.reminder_at = resolve_datetime_or_smart(reminder_at) if (reminder_at and reminder_at.strip()) else None
        if repeat is not None:
            t.repeat = repeat.strip() or "NONE"
        if in_agenda is not None:
            t.in_agenda = in_agenda in ("1", "on", "true")
        session.add(t)
        session.commit()
        session.refresh(t)
        background_tasks.add_task(run_backup_job)
        today = date.today()
        if t.status == "CONCLUIDO":
            html = templates.get_template("partials/task_row_completed.html").render({"request": request, "task": t, "today": today})
        else:
            html = templates.get_template("partials/task_row_pending.html").render({"request": request, "task": t, "today": today})
        return HTMLResponse(html)


@router.post("/administrativo/task/{task_id}/step")
def add_task_step(request: Request, task_id: int, background_tasks: BackgroundTasks, title: str = Form(None)):
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if not t:
            return HTMLResponse("", status_code=404)
        title_val = (title or "").strip() or "Nova etapa"
        last = session.exec(select(TaskStep).where(TaskStep.task_id == task_id).order_by(TaskStep.sort_order.desc())).first()
        order = (last.sort_order + 1) if last else 0
        step = TaskStep(task_id=task_id, title=title_val, sort_order=order)
        session.add(step)
        session.commit()
        session.refresh(step)
        background_tasks.add_task(run_backup_job)
    html = templates.get_template("partials/task_step_row.html").render({
        "request": request, "task": t, "step": step
    })
    return HTMLResponse(html, status_code=201)


@router.patch("/administrativo/task/{task_id}/step/{step_id}/toggle")
def toggle_task_step(request: Request, task_id: int, step_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        step = session.get(TaskStep, step_id)
        if not step or step.task_id != task_id:
            return HTMLResponse("", status_code=404)
        step.done = not step.done
        session.add(step)
        session.commit()
        session.refresh(step)
        background_tasks.add_task(run_backup_job)
    task_ref = SimpleNamespace(id=task_id)
    html = templates.get_template("partials/task_step_row.html").render({
        "request": request, "task": task_ref, "step": step
    })
    return HTMLResponse(html)


@router.delete("/administrativo/task/{task_id}/step/{step_id}")
def delete_task_step(task_id: int, step_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        step = session.get(TaskStep, step_id)
        if step and step.task_id == task_id:
            session.delete(step)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return HTMLResponse("")


@router.post("/administrativo/task/{task_id}/my-day")
def toggle_my_day(request: Request, task_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if not t:
            return HTMLResponse("", status_code=404)
        t.in_agenda = not t.in_agenda
        session.add(t)
        session.commit()
        session.refresh(t)
        background_tasks.add_task(run_backup_job)
    return HTMLResponse("1" if t.in_agenda else "0")


@router.post("/administrativo/task/{task_id}/ensure-folder")
def ensure_task_folder(task_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if not t:
            return HTMLResponse("", status_code=404)
        tasks_dir = os.path.join(STORAGE_DIR, "tasks")
        folder_name = f"task_{task_id}"
        folder_path = os.path.join(tasks_dir, folder_name)
        if not os.path.exists(folder_path):
            os.makedirs(folder_path)
        t.files_folder = f"tasks/{folder_name}"
        session.add(t)
        session.commit()
        background_tasks.add_task(run_backup_job)
    return HTMLResponse(t.files_folder or "")


# --- REUNIÕES ---

@router.get("/administrativo/meeting/{meeting_id}/sheet")
def meeting_sheet(request: Request, meeting_id: int):
    with Session(engine) as session:
        m = session.get(Meeting, meeting_id)
        if not m:
            return HTMLResponse("", status_code=404)
        html = templates.get_template("partials/meeting_sheet.html").render({"request": request, "m": m})
        return HTMLResponse(html)


@router.patch("/administrativo/meeting/{meeting_id}")
def update_meeting(request: Request, meeting_id: int, background_tasks: BackgroundTasks,
                  title: str = Form(None), meeting_date: str = Form(None), meeting_time: str = Form(None),
                  company: str = Form(None), reason: str = Form(None), notes: str = Form(None), participants: str = Form(None)):
    with Session(engine) as session:
        m = session.get(Meeting, meeting_id)
        if not m:
            return HTMLResponse("", status_code=404)
        if title is not None and title.strip():
            m.title = title.strip()
        if meeting_date and meeting_date.strip():
            m.meeting_date = datetime.strptime(meeting_date.strip(), "%Y-%m-%d").date()
        if meeting_time is not None:
            m.meeting_time = meeting_time.strip() or None
        if company is not None:
            m.company = company.strip() or None
        if reason is not None:
            m.reason = reason.strip() or None
        if notes is not None:
            m.notes = notes.strip() or None
        if participants is not None:
            m.participants = participants.strip() or None
        session.add(m)
        session.commit()
        background_tasks.add_task(run_backup_job)
    return HTMLResponse("OK")


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
    return HTMLResponse("")


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
            return HTMLResponse("", status_code=404)
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
    return HTMLResponse("")
