"""
Vigia de Lembretes — loop que verifica tarefas com reminder_at <= agora e reminder_sent=False.
Quando em desktop (pywebview), invoca window.triggerReminder(task_data) no frontend.
"""
import time
import json
import logging
from datetime import datetime

from sqlmodel import Session, select, or_
from app.database import engine
from app.models import Task
from app.config import get_config

logger = logging.getLogger(__name__)
CHECK_INTERVAL_SEC = 15
VALID_SOUNDS = frozenset(("chimes1", "chimes2", "chimes3", "chimes4", "modern1", "modern2", "modern3"))
DEFAULT_SOUND = "chimes1"


def _sound_final(task_custom_sound: str | None, config_default: str | None) -> str:
    """Prioridade: som da tarefa > som padrão global > chimes1."""
    if task_custom_sound and task_custom_sound in VALID_SOUNDS:
        return task_custom_sound
    if config_default and config_default in VALID_SOUNDS:
        return config_default
    return DEFAULT_SOUND


def _serialize_task_for_reminder(t, default_sound: str) -> dict:
    custom = getattr(t, "custom_sound", None)
    sound = _sound_final(custom, default_sound)
    return {
        "id": t.id,
        "title": t.title or "",
        "reminder_at": t.reminder_at.isoformat() if t.reminder_at else None,
        "due_date": t.due_date.isoformat() if t.due_date else None,
        "status": t.status,
        "sound": sound,
    }


def cleanup_expired_reminders() -> int:
    """
    Faxina: tarefas com reminder_at < agora (expirados não processados).
    Define reminder_at=None e reminder_sent=False para remover lixo temporal.
    """
    with Session(engine) as session:
        now = datetime.now()
        tasks = session.exec(
            select(Task).where(
                Task.type == "TAREFA",
                Task.reminder_at.isnot(None),
                Task.reminder_at < now,
            )
        ).all()
        count = 0
        for t in tasks:
            t.reminder_at = None
            t.reminder_sent = False
            session.add(t)
            count += 1
        if count:
            session.commit()
            logger.info("Faxina: %d lembrete(s) expirado(s) removido(s)", count)
        return count


def get_due_reminders() -> list[dict]:
    """Retorna tarefas com reminder_at <= agora e reminder_sent=False.
    Cada tarefa inclui 'sound' (som_final = custom_sound ou default_reminder ou chimes1)."""
    with Session(engine) as session:
        config = get_config(session)
        default_sound = getattr(config, "reminder_sound", None) or DEFAULT_SOUND
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
        return [_serialize_task_for_reminder(t, default_sound) for t in tasks]


def mark_reminder_sent(task_id: int) -> None:
    """Marca reminder_sent=True para evitar re-disparo."""
    with Session(engine) as session:
        t = session.get(Task, task_id)
        if t:
            t.reminder_sent = True
            session.add(t)
            session.commit()


def run_vigia_loop(trigger_callback):
    """
    Loop infinito. A cada CHECK_INTERVAL_SEC, busca lembretes vencidos.
    Para cada um, chama trigger_callback(task_dict).
    O callback deve marcar reminder_sent no banco após enviar (ou o vigia marca antes de chamar).
    """
    seen_ids = set()
    while True:
        try:
            cleanup_expired_reminders()
            due = get_due_reminders()
            for task_data in due:
                tid = task_data.get("id")
                if tid and tid not in seen_ids:
                    seen_ids.add(tid)
                    try:
                        trigger_callback(task_data)
                    except Exception as e:
                        logger.exception("Erro ao disparar lembrete: %s", e)
                    # Marca como enviado para evitar re-disparo no próximo ciclo
                    mark_reminder_sent(tid)
            # Limpa IDs antigos para evitar crescimento infinito (últimos 100)
            if len(seen_ids) > 100:
                seen_ids = set(list(seen_ids)[-50:])
        except Exception as e:
            logger.exception("Erro no vigia de lembretes: %s", e)
        time.sleep(CHECK_INTERVAL_SEC)
