from datetime import datetime, timedelta
from sqlmodel import Session, select
from app.database import engine
from app.models import Task


def _repeat_days(task: Task) -> int:
    if task.repeat == "DAILY":
        return 1
    if task.repeat == "WEEKLY":
        return 7
    if task.repeat == "MONTHLY":
        return 30
    if task.repeat == "CUSTOM" and task.repeat_interval_days and task.repeat_interval_days > 0:
        return task.repeat_interval_days
    return 0


def run_recreate_recurring_tasks() -> None:
    now = datetime.now()
    with Session(engine) as session:
        rows = session.exec(
            select(Task).where(
                Task.type == "TAREFA",
                Task.status == "CONCLUIDO",
                Task.repeat != "NONE",
                Task.completed_at.isnot(None),
            )
        ).all()
        for t in rows:
            days = _repeat_days(t)
            if days <= 0 or not t.completed_at:
                continue
            reference = t.recurrence_spawned_at or t.completed_at
            if reference and now >= (reference + timedelta(days=days)):
                session.add(
                    Task(
                        title=t.title,
                        description=t.description,
                        details=t.details,
                        start_date=t.start_date,
                        due_date=t.due_date,
                        type="TAREFA",
                        status="PENDENTE",
                        reminder_at=t.reminder_at,
                        repeat=t.repeat,
                        repeat_interval_days=t.repeat_interval_days,
                        in_agenda=t.in_agenda,
                        notes=t.notes,
                    )
                )
                t.recurrence_spawned_at = now
                session.add(t)
        session.commit()
