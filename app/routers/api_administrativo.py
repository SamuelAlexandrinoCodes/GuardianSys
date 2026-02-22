"""
API REST JSON — Módulo Administrativo (Tarefas, Reuniões, Contas a Pagar).

Regra de Ouro: ZERO alteração em models.py ou database.py.
Toda lógica de negócio e queries SQLAlchemy são IDÊNTICAS ao administrativo.py original.
A única diferença é que TUDO retorna JSON puro em vez de HTML/TemplateResponse.
"""
from datetime import date, datetime
from typing import Optional, List
import os

from fastapi import APIRouter, BackgroundTasks, Body, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import Session, select, or_

from app.database import engine
from app.models import Task, TaskStep, TaskList, Meeting, Payable, Reservation, Unit, Resident
from app.config import get_config, run_backup_job, STORAGE_DIR
from app.smart_dates import resolve_date_or_smart, resolve_datetime_or_smart
from app.recurrence import run_recreate_recurring_tasks

router = APIRouter(prefix="/api", tags=["api-administrativo"])


# ---------------------------------------------------------------------------
# Pydantic Schemas (entrada)
# ---------------------------------------------------------------------------

class TaskCreate(BaseModel):
    title: str
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    is_important: Optional[bool] = None
    is_assigned: Optional[bool] = None
    list_id: Optional[int] = None
    description: Optional[str] = None
    details: Optional[str] = None
    reminder_at: Optional[str] = None
    repeat: str = "NONE"
    repeat_interval_days: Optional[int] = None
    in_agenda: bool = True

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    start_date: Optional[str] = None
    is_important: Optional[bool] = None
    is_assigned: Optional[bool] = None
    list_id: Optional[int] = None
    due_date: Optional[str] = None
    details: Optional[str] = None
    notes: Optional[str] = None
    reminder_at: Optional[str] = None
    repeat: Optional[str] = None
    repeat_interval_days: Optional[int] = None
    color: Optional[str] = None
    in_agenda: Optional[bool] = None

class StepCreate(BaseModel):
    title: Optional[str] = None

class StepUpdate(BaseModel):
    title: Optional[str] = None
    done: Optional[bool] = None

class MeetingCreate(BaseModel):
    title: str
    meeting_date: str
    meeting_time: Optional[str] = None
    reminder_date: Optional[str] = None
    company: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    participants: Optional[str] = None

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    meeting_date: Optional[str] = None
    meeting_time: Optional[str] = None
    company: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    participants: Optional[str] = None

class PayableCreate(BaseModel):
    description: str
    subject: Optional[str] = None
    payee: Optional[str] = None
    amount: float
    due_date: str
    regularity: str = "MENSAL"
    notify_days_before: int = 7


# ---------------------------------------------------------------------------
# Helpers de serialização
# ---------------------------------------------------------------------------

def _serialize_task(t: Task, steps: list[TaskStep] | None = None) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "details": t.details,
        "start_date": t.start_date.isoformat() if t.start_date else None,
        "due_date": t.due_date.isoformat() if t.due_date else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        "type": t.type,
        "status": t.status,
        "reminder_at": t.reminder_at.isoformat() if t.reminder_at else None,
        "reminder_sent": getattr(t, "reminder_sent", False),
        "repeat": t.repeat or "NONE",
        "repeat_interval_days": t.repeat_interval_days,
        "color": t.color,
        "custom_sound": getattr(t, "custom_sound", None),
        "in_agenda": t.in_agenda,
        "is_important": getattr(t, "is_important", False),
        "is_assigned": getattr(t, "is_assigned", False),
        "list_id": getattr(t, "list_id", None),
        "notes": t.notes,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "files_folder": t.files_folder,
        "order_index": t.order_index,
        "steps": [_serialize_step(s) for s in steps] if steps is not None else [],
    }

def _serialize_step(s: TaskStep) -> dict:
    return {
        "id": s.id,
        "task_id": s.task_id,
        "title": s.title,
        "done": s.done,
        "sort_order": s.sort_order,
    }

def _serialize_meeting(m: Meeting) -> dict:
    return {
        "id": m.id,
        "title": m.title,
        "meeting_date": m.meeting_date.isoformat(),
        "meeting_time": m.meeting_time,
        "reminder_date": m.reminder_date.isoformat() if m.reminder_date else None,
        "company": m.company,
        "reason": m.reason,
        "notes": m.notes,
        "participants": m.participants,
        "description": m.description,
        "start_time": m.start_time,
        "location": m.location,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }

def _serialize_payable(p: Payable) -> dict:
    return {
        "id": p.id,
        "description": p.description,
        "subject": p.subject,
        "payee": p.payee,
        "amount": p.amount,
        "due_date": p.due_date.isoformat(),
        "regularity": p.regularity,
        "notify_days_before": p.notify_days_before,
        "barcode": p.barcode,
        "status": p.status,
    }

def _serialize_reservation(r, unit=None, resident=None) -> dict:
    return {
        "id": r.id,
        "area_name": r.area_name,
        "reservation_date": r.reservation_date.isoformat(),
        "status": r.status,
        "unit": {"id": unit.id, "block": unit.block, "number": unit.number} if unit else None,
        "resident": {"id": resident.id, "full_name": resident.full_name} if resident else None,
    }


# ---------------------------------------------------------------------------
# GET /api/administrativo — Dados completos da tela
# ---------------------------------------------------------------------------

@router.get("/administrativo")
def get_administrativo(tab: str = "tarefas", task_filter: str = "geral"):
    if tab == "tarefas":
        run_recreate_recurring_tasks()

    with Session(engine) as session:
        config = get_config(session)
        today = date.today()

        # --- Tarefas — filtros: meu_dia, importante, planejado, geral ---
        base_pending = select(Task).where(Task.type == "TAREFA", Task.status == "PENDENTE")
        base_completed = select(Task).where(Task.type == "TAREFA", Task.status == "CONCLUIDO")

        if task_filter == "meu_dia":
            base_pending = base_pending.where(Task.start_date.isnot(None), Task.start_date <= today)
            base_completed = base_completed.where(Task.start_date.isnot(None), Task.start_date <= today)
        elif task_filter == "importante":
            base_pending = base_pending.where(Task.is_important == True)
            base_completed = base_completed.where(Task.is_important == True)
        elif task_filter == "planejado":
            base_pending = base_pending.where(Task.is_assigned == True)
            base_completed = base_completed.where(Task.is_assigned == True)
        elif task_filter.startswith("list:"):
            try:
                list_id = int(task_filter.split(":")[1])
                base_pending = base_pending.where(Task.list_id == list_id)
                base_completed = base_completed.where(Task.list_id == list_id)
            except (ValueError, IndexError):
                pass
        # geral: sem filtro adicional

        tasks_pending = session.exec(
            base_pending.order_by(Task.order_index.asc(), Task.due_date.asc().nullslast())
        ).all()

        tasks_completed = session.exec(
            base_completed.order_by(Task.order_index.asc(), Task.completed_at.desc().nullslast())
        ).all()

        all_tasks = tasks_pending + tasks_completed
        task_ids = [t.id for t in all_tasks]
        subtasks_map: dict[int, list[TaskStep]] = {}
        for tid in task_ids:
            steps = list(session.exec(
                select(TaskStep).where(TaskStep.task_id == tid)
                .order_by(TaskStep.sort_order, TaskStep.id)
            ).all())
            subtasks_map[tid] = steps

        # --- Reuniões ---
        meetings = session.exec(
            select(Meeting).order_by(Meeting.meeting_date, Meeting.meeting_time)
        ).all()

        # --- Contas a Pagar ---
        payables = session.exec(select(Payable).order_by(Payable.due_date)).all()
        total_open = sum(p.amount for p in payables if p.status == "ABERTO")

        # --- Reservas em Aberto ---
        res_query = (
            select(Reservation, Unit, Resident)
            .select_from(Reservation)
            .join(Unit, Reservation.unit_id == Unit.id)
            .outerjoin(Resident, Reservation.resident_id == Resident.id)
            .where(
                Reservation.reservation_date >= today,
                Reservation.status != "CANCELADA",
                Reservation.status != "Pago/Confirmado",
            )
            .order_by(Reservation.reservation_date)
        )
        res_rows = session.exec(res_query).all()

    return JSONResponse({
        "config": {
            "condo_name": config.condo_name if config else "Condomínio",
            "user_name": config.user_name if config else None,
        },
        "today": today.isoformat(),
        "tab": tab,
        "tasks_pending": [_serialize_task(t, subtasks_map.get(t.id, [])) for t in tasks_pending],
        "tasks_completed": [_serialize_task(t, subtasks_map.get(t.id, [])) for t in tasks_completed],
        "meetings": [_serialize_meeting(m) for m in meetings],
        "payables": [_serialize_payable(p) for p in payables],
        "total_open": total_open,
        "open_reservations": [_serialize_reservation(r, u, res) for r, u, res in res_rows],
    })


# ---------------------------------------------------------------------------
# Smart Date helper
# ---------------------------------------------------------------------------

@router.get("/administrativo/smart-date")
def get_smart_date(
    type: str = Query("date"),
    value: str = Query(...),
):
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


# ---------------------------------------------------------------------------
# TAREFAS — CRUD
# ---------------------------------------------------------------------------

@router.post("/administrativo/task")
def create_task(payload: TaskCreate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        sd = resolve_date_or_smart(payload.start_date) if payload.start_date and payload.start_date.strip() else None
        dd = resolve_date_or_smart(payload.due_date) if payload.due_date and payload.due_date.strip() else None
        rem = resolve_datetime_or_smart(payload.reminder_at) if payload.reminder_at and payload.reminder_at.strip() else None

        order_values = session.exec(
            select(Task.order_index).where(Task.type == "TAREFA", Task.status == "PENDENTE")
        ).all()
        valid_order_values = [v for v in order_values if v is not None]
        next_order_index = (min(valid_order_values) - 1) if valid_order_values else 0

        rep = (payload.repeat or "NONE").strip()
        rep_days = payload.repeat_interval_days
        if rep == "CUSTOM" and not rep_days:
            rep = "NONE"

        task = Task(
            title=payload.title,
            type="TAREFA",
            start_date=sd,
            due_date=dd,
            description=payload.description,
            details=payload.details,
            status="PENDENTE",
            reminder_at=rem,
            repeat=rep,
            repeat_interval_days=(rep_days if rep == "CUSTOM" else None),
            in_agenda=payload.in_agenda,
            order_index=next_order_index,
            is_important=payload.is_important if payload.is_important is not None else False,
            is_assigned=payload.is_assigned if payload.is_assigned is not None else False,
            list_id=payload.list_id,
        )
        session.add(task)
        session.commit()
        session.refresh(task)
        background_tasks.add_task(run_backup_job)
        return JSONResponse(_serialize_task(task, []), status_code=201)


@router.post("/administrativo/task/{task_id}/toggle")
def toggle_task(task_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if not t:
            return JSONResponse({"error": "Tarefa não encontrada"}, status_code=404)
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

        steps = list(session.exec(
            select(TaskStep).where(TaskStep.task_id == t.id)
            .order_by(TaskStep.sort_order, TaskStep.id)
        ).all())
        return JSONResponse(_serialize_task(t, steps))


@router.delete("/administrativo/task/{task_id}")
def delete_task(task_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if t:
            for step in session.exec(select(TaskStep).where(TaskStep.task_id == task_id)).all():
                session.delete(step)
            session.delete(t)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return JSONResponse({"ok": True})


@router.patch("/administrativo/task/{task_id}")
def update_task(task_id: int, payload: TaskUpdate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if not t:
            return JSONResponse({"error": "Tarefa não encontrada"}, status_code=404)

        if payload.title is not None and payload.title.strip():
            t.title = payload.title.strip()
        if payload.start_date is not None:
            t.start_date = resolve_date_or_smart(payload.start_date) if (payload.start_date and payload.start_date.strip()) else None
        if payload.due_date is not None:
            t.due_date = resolve_date_or_smart(payload.due_date) if payload.due_date.strip() else None
        if payload.details is not None:
            t.details = payload.details.strip() or None
        if payload.notes is not None:
            t.notes = payload.notes.strip() or None
        if payload.reminder_at is not None:
            t.reminder_at = resolve_datetime_or_smart(payload.reminder_at) if payload.reminder_at.strip() else None
        if payload.repeat is not None:
            rep = payload.repeat.strip() or "NONE"
            t.repeat = rep
            if rep == "CUSTOM":
                t.repeat_interval_days = payload.repeat_interval_days
            else:
                t.repeat_interval_days = None
        if payload.color is not None:
            t.color = payload.color.strip() or None
        if payload.in_agenda is not None:
            t.in_agenda = payload.in_agenda
        if payload.is_important is not None:
            t.is_important = payload.is_important
        if payload.is_assigned is not None:
            t.is_assigned = payload.is_assigned
        if payload.list_id is not None:
            t.list_id = payload.list_id

        session.add(t)
        session.commit()
        session.refresh(t)
        background_tasks.add_task(run_backup_job)

        steps = list(session.exec(
            select(TaskStep).where(TaskStep.task_id == t.id)
            .order_by(TaskStep.sort_order, TaskStep.id)
        ).all())
        return JSONResponse(_serialize_task(t, steps))


@router.post("/administrativo/tasks/reorder")
def reorder_tasks(background_tasks: BackgroundTasks, order: list[int] = Body(..., embed=True)):
    with Session(engine) as session:
        for idx, task_id in enumerate(order):
            t = session.get(Task, task_id)
            if t and t.type == "TAREFA":
                t.order_index = idx
                session.add(t)
        session.commit()
        background_tasks.add_task(run_backup_job)
    return JSONResponse({"ok": True})


# ---------------------------------------------------------------------------
# LISTAS PERSONALIZADAS
# ---------------------------------------------------------------------------

class TaskListCreate(BaseModel):
    name: str

class TaskListUpdate(BaseModel):
    name: Optional[str] = None
    order_index: Optional[int] = None

@router.get("/administrativo/lists")
def get_task_lists():
    with Session(engine) as session:
        lists = session.exec(
            select(TaskList).order_by(TaskList.order_index.asc(), TaskList.id.asc())
        ).all()
        return JSONResponse([{"id": tl.id, "name": tl.name, "order_index": tl.order_index} for tl in lists])

@router.post("/administrativo/list")
def create_task_list(payload: TaskListCreate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        orders = [o for o in session.exec(select(TaskList.order_index)) if o is not None]
        next_order = max(orders, default=0) + 1
        tl = TaskList(name=payload.name.strip() or "Nova Lista", order_index=next_order)
        session.add(tl)
        session.commit()
        session.refresh(tl)
        background_tasks.add_task(run_backup_job)
        return JSONResponse({"id": tl.id, "name": tl.name, "order_index": tl.order_index}, status_code=201)

@router.patch("/administrativo/list/{list_id}")
def update_task_list(list_id: int, payload: TaskListUpdate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        tl = session.get(TaskList, list_id)
        if not tl:
            return JSONResponse({"error": "Lista não encontrada"}, status_code=404)
        if payload.name is not None and payload.name.strip():
            tl.name = payload.name.strip()
        if payload.order_index is not None:
            tl.order_index = payload.order_index
        session.add(tl)
        session.commit()
        background_tasks.add_task(run_backup_job)
        return JSONResponse({"id": tl.id, "name": tl.name, "order_index": tl.order_index})

@router.delete("/administrativo/list/{list_id}")
def delete_task_list(list_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        tl = session.get(TaskList, list_id)
        if tl:
            # Cascade: remove todas as tarefas (e steps) desta lista
            for t in session.exec(select(Task).where(Task.list_id == list_id)).all():
                for step in session.exec(select(TaskStep).where(TaskStep.task_id == t.id)).all():
                    session.delete(step)
                session.delete(t)
            session.delete(tl)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return JSONResponse({"ok": True})


@router.get("/administrativo/task/{task_id}")
def get_task(task_id: int):
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if not t:
            return JSONResponse({"error": "Tarefa não encontrada"}, status_code=404)
        steps = list(session.exec(
            select(TaskStep).where(TaskStep.task_id == task_id)
            .order_by(TaskStep.sort_order, TaskStep.id)
        ).all())
        return JSONResponse(_serialize_task(t, steps))


@router.get("/administrativo/reminders")
def get_reminders():
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
                Task.reminder_at <= window_end,
            )
        ).all()
        return JSONResponse([
            {"id": t.id, "title": t.title, "reminder_at": t.reminder_at.isoformat() if t.reminder_at else None}
            for t in tasks
        ])


VALID_REMINDER_SOUNDS = frozenset(("chimes1", "chimes2", "chimes3", "chimes4", "modern1", "modern2", "modern3"))


def _reminder_sound_final(task_custom: str | None, config_default: str | None) -> str:
    if task_custom and task_custom in VALID_REMINDER_SOUNDS:
        return task_custom
    if config_default and config_default in VALID_REMINDER_SOUNDS:
        return config_default
    return "chimes1"


@router.get("/administrativo/reminders/due")
def get_reminders_due():
    """Tarefas com reminder_at <= agora e reminder_sent=False (para vigia/polling).
    Inclui campo 'sound' (prioridade: custom_sound > reminder_sound > chimes1)."""
    with Session(engine) as session:
        config = get_config(session)
        default_sound = getattr(config, "reminder_sound", None) or "chimes1"
        now = datetime.now()
        tasks = session.exec(
            select(Task).where(
                Task.type == "TAREFA",
                Task.status == "PENDENTE",
                Task.reminder_at.isnot(None),
                Task.reminder_at <= now,
                or_(Task.reminder_sent.is_(None), Task.reminder_sent == False),
            )
        ).all()
        result = []
        for t in tasks:
            d = _serialize_task(t, [])
            d["sound"] = _reminder_sound_final(getattr(t, "custom_sound", None), default_sound)
            result.append(d)
        return JSONResponse(result)


@router.post("/administrativo/task/{task_id}/reminder-dismiss")
def reminder_dismiss(task_id: int, background_tasks: BackgroundTasks):
    """Marca reminder_sent=True (ignorar)."""
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if not t:
            return JSONResponse({"error": "Tarefa não encontrada"}, status_code=404)
        t.reminder_sent = True
        session.add(t)
        session.commit()
        background_tasks.add_task(run_backup_job)
    return JSONResponse({"ok": True})


@router.post("/administrativo/task/{task_id}/reminder-postpone")
def reminder_postpone(task_id: int, payload: dict = Body(...), background_tasks: BackgroundTasks = None):  # noqa: B008
    """Adia o lembrete. Payload: { "minutes": 5 } ou { "minutes": 30 } ou { "hours": 1 } ou { "tomorrow": true }."""
    from datetime import timedelta, date as date_type
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if not t or not t.reminder_at:
            return JSONResponse({"error": "Tarefa ou lembrete não encontrado"}, status_code=404)
        base = t.reminder_at.replace(tzinfo=None) if t.reminder_at.tzinfo else t.reminder_at
        if payload.get("tomorrow"):
            tomorrow = date_type.today() + timedelta(days=1)
            t.reminder_at = base.replace(
                year=tomorrow.year, month=tomorrow.month, day=tomorrow.day,
                hour=9, minute=0, second=0, microsecond=0
            )
        elif "minutes" in payload:
            t.reminder_at = base + timedelta(minutes=int(payload["minutes"]))
        elif "hours" in payload:
            t.reminder_at = base + timedelta(hours=int(payload["hours"]))
        else:
            return JSONResponse({"error": "Payload inválido. Use minutes, hours ou tomorrow."}, status_code=400)
        t.reminder_sent = False
        session.add(t)
        session.commit()
        if background_tasks:
            background_tasks.add_task(run_backup_job)
        steps = list(session.exec(
            select(TaskStep).where(TaskStep.task_id == t.id)
            .order_by(TaskStep.sort_order, TaskStep.id)
        ).all())
        return JSONResponse(_serialize_task(t, steps))


@router.post("/administrativo/task/{task_id}/my-day")
def toggle_my_day(task_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if not t:
            return JSONResponse({"error": "Tarefa não encontrada"}, status_code=404)
        t.in_agenda = not t.in_agenda
        session.add(t)
        session.commit()
        session.refresh(t)
        background_tasks.add_task(run_backup_job)
    return JSONResponse({"in_agenda": t.in_agenda})


@router.post("/administrativo/task/{task_id}/ensure-folder")
def ensure_task_folder(task_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if not t:
            return JSONResponse({"error": "Tarefa não encontrada"}, status_code=404)
        tasks_dir = os.path.join(STORAGE_DIR, "tasks")
        folder_name = f"task_{task_id}"
        folder_path = os.path.join(tasks_dir, folder_name)
        if not os.path.exists(folder_path):
            os.makedirs(folder_path)
        t.files_folder = f"tasks/{folder_name}"
        session.add(t)
        session.commit()
        background_tasks.add_task(run_backup_job)
    return JSONResponse({"files_folder": t.files_folder})


# ---------------------------------------------------------------------------
# SUBTAREFAS (Steps) — CRUD
# ---------------------------------------------------------------------------

@router.post("/administrativo/task/{task_id}/step")
def add_task_step(task_id: int, payload: StepCreate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if not t:
            return JSONResponse({"error": "Tarefa não encontrada"}, status_code=404)
        title_val = (payload.title or "").strip() or "Nova etapa"
        last = session.exec(
            select(TaskStep).where(TaskStep.task_id == task_id)
            .order_by(TaskStep.sort_order.desc())
        ).first()
        order = (last.sort_order + 1) if last else 0
        step = TaskStep(task_id=task_id, title=title_val, sort_order=order)
        session.add(step)
        session.commit()
        session.refresh(step)
        background_tasks.add_task(run_backup_job)
        return JSONResponse(_serialize_step(step), status_code=201)


@router.patch("/administrativo/task/{task_id}/step/{step_id}")
def update_task_step(task_id: int, step_id: int, payload: StepUpdate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        step = session.get(TaskStep, step_id)
        if not step or step.task_id != task_id:
            return JSONResponse({"error": "Step não encontrado"}, status_code=404)
        if payload.title is not None:
            step.title = (payload.title or "").strip() or "Nova etapa"
        if payload.done is not None:
            step.done = payload.done
        session.add(step)
        session.commit()
        session.refresh(step)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_serialize_step(step))


@router.patch("/administrativo/task/{task_id}/step/{step_id}/toggle")
def toggle_task_step(task_id: int, step_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        step = session.get(TaskStep, step_id)
        if not step or step.task_id != task_id:
            return JSONResponse({"error": "Step não encontrado"}, status_code=404)
        step.done = not step.done
        session.add(step)
        session.commit()
        session.refresh(step)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_serialize_step(step))


@router.delete("/administrativo/task/{task_id}/step/{step_id}")
def delete_task_step(task_id: int, step_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        step = session.get(TaskStep, step_id)
        if step and step.task_id == task_id:
            session.delete(step)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return JSONResponse({"ok": True})


# ---------------------------------------------------------------------------
# REUNIÕES — CRUD
# ---------------------------------------------------------------------------

@router.get("/administrativo/meeting/{meeting_id}")
def get_meeting(meeting_id: int):
    with Session(engine) as session:
        m = session.get(Meeting, meeting_id)
        if not m:
            return JSONResponse({"error": "Reunião não encontrada"}, status_code=404)
        return JSONResponse(_serialize_meeting(m))


@router.post("/administrativo/meeting")
def create_meeting(payload: MeetingCreate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        md = datetime.strptime(payload.meeting_date, "%Y-%m-%d").date()
        rd = datetime.strptime(payload.reminder_date, "%Y-%m-%d").date() if payload.reminder_date else None
        m = Meeting(
            title=payload.title,
            meeting_date=md,
            meeting_time=payload.meeting_time or None,
            reminder_date=rd,
            company=payload.company or None,
            reason=payload.reason or None,
            notes=payload.notes or None,
            participants=payload.participants or None,
        )
        session.add(m)
        session.commit()
        session.refresh(m)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_serialize_meeting(m), status_code=201)


@router.patch("/administrativo/meeting/{meeting_id}")
def update_meeting(meeting_id: int, payload: MeetingUpdate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        m = session.get(Meeting, meeting_id)
        if not m:
            return JSONResponse({"error": "Reunião não encontrada"}, status_code=404)
        if payload.title is not None and payload.title.strip():
            m.title = payload.title.strip()
        if payload.meeting_date and payload.meeting_date.strip():
            m.meeting_date = datetime.strptime(payload.meeting_date.strip(), "%Y-%m-%d").date()
        if payload.meeting_time is not None:
            m.meeting_time = payload.meeting_time.strip() or None
        if payload.company is not None:
            m.company = payload.company.strip() or None
        if payload.reason is not None:
            m.reason = payload.reason.strip() or None
        if payload.notes is not None:
            m.notes = payload.notes.strip() or None
        if payload.participants is not None:
            m.participants = payload.participants.strip() or None
        session.add(m)
        session.commit()
        session.refresh(m)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_serialize_meeting(m))


@router.delete("/administrativo/meeting/{mid}")
def delete_meeting(mid: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        m = session.get(Meeting, mid)
        if m:
            session.delete(m)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return JSONResponse({"ok": True})


# ---------------------------------------------------------------------------
# CONTAS A PAGAR — CRUD
# ---------------------------------------------------------------------------

@router.post("/administrativo/payable")
def create_payable(payload: PayableCreate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        dd = datetime.strptime(payload.due_date, "%Y-%m-%d").date()
        p = Payable(
            description=payload.description,
            subject=payload.subject or None,
            payee=payload.payee or None,
            amount=payload.amount,
            due_date=dd,
            regularity=payload.regularity,
            notify_days_before=payload.notify_days_before,
            status="ABERTO",
        )
        session.add(p)
        session.commit()
        session.refresh(p)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_serialize_payable(p), status_code=201)


@router.post("/administrativo/payable/{pid}/toggle")
def toggle_payable(pid: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        p = session.get(Payable, pid)
        if not p:
            return JSONResponse({"error": "Conta não encontrada"}, status_code=404)
        p.status = "PAGO" if p.status == "ABERTO" else "ABERTO"
        session.add(p)
        session.commit()
        session.refresh(p)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_serialize_payable(p))


@router.delete("/administrativo/payable/{pid}")
def delete_payable(pid: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        p = session.get(Payable, pid)
        if p:
            session.delete(p)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return JSONResponse({"ok": True})
