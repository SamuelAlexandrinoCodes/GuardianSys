"""
API REST JSON — Financeiro (Contas a Pagar global).
Regra de Ouro: ZERO alteracao em models.py ou database.py.
"""
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import Session, select
from typing import Optional

from app.database import engine
from app.models import Payable
from app.config import get_config, run_backup_job

router = APIRouter(prefix="/api", tags=["api-finance"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class PayableCreate(BaseModel):
    description: str
    amount: float
    due_date: str
    payee: Optional[str] = None
    subject: Optional[str] = None
    regularity: str = "MENSAL"
    notify_days_before: int = 7
    barcode: Optional[str] = None


class PayableUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[str] = None
    payee: Optional[str] = None
    subject: Optional[str] = None
    regularity: Optional[str] = None
    notify_days_before: Optional[int] = None
    barcode: Optional[str] = None
    status: Optional[str] = None


# ---------------------------------------------------------------------------
# Serializer
# ---------------------------------------------------------------------------

def _ser(p: Payable) -> dict:
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


# ---------------------------------------------------------------------------
# Listagem com metricas
# ---------------------------------------------------------------------------

@router.get("/finance")
def list_finance():
    with Session(engine) as session:
        config = get_config(session)
        payables = session.exec(select(Payable).order_by(Payable.due_date)).all()

        total_open = sum(p.amount for p in payables if p.status == "ABERTO")
        total_paid = sum(p.amount for p in payables if p.status == "PAGO")
        count_open = sum(1 for p in payables if p.status == "ABERTO")
        count_paid = sum(1 for p in payables if p.status == "PAGO")

    return JSONResponse({
        "config": {"condo_name": config.condo_name if config else "Condominio"},
        "payables": [_ser(p) for p in payables],
        "metrics": {
            "total_open": total_open,
            "total_paid": total_paid,
            "count_open": count_open,
            "count_paid": count_paid,
            "balance": total_paid - total_open,
        },
    })


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.post("/finance")
def create_payable(payload: PayableCreate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        dd = datetime.strptime(payload.due_date, "%Y-%m-%d").date()
        p = Payable(
            description=payload.description, amount=payload.amount,
            due_date=dd, payee=payload.payee, subject=payload.subject,
            regularity=payload.regularity, notify_days_before=payload.notify_days_before,
            barcode=payload.barcode, status="ABERTO",
        )
        session.add(p)
        session.commit()
        session.refresh(p)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser(p), status_code=201)


@router.patch("/finance/{pid}")
def update_payable(pid: int, payload: PayableUpdate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        p = session.get(Payable, pid)
        if not p:
            return JSONResponse({"error": "Conta nao encontrada"}, status_code=404)
        if payload.description is not None:
            p.description = payload.description
        if payload.amount is not None:
            p.amount = payload.amount
        if payload.due_date is not None:
            p.due_date = datetime.strptime(payload.due_date, "%Y-%m-%d").date()
        if payload.payee is not None:
            p.payee = payload.payee
        if payload.subject is not None:
            p.subject = payload.subject
        if payload.regularity is not None:
            p.regularity = payload.regularity
        if payload.notify_days_before is not None:
            p.notify_days_before = payload.notify_days_before
        if payload.barcode is not None:
            p.barcode = payload.barcode
        if payload.status is not None:
            p.status = payload.status
        session.add(p)
        session.commit()
        session.refresh(p)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser(p))


@router.post("/finance/{pid}/toggle")
def toggle_payable(pid: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        p = session.get(Payable, pid)
        if not p:
            return JSONResponse({"error": "Conta nao encontrada"}, status_code=404)
        p.status = "PAGO" if p.status == "ABERTO" else "ABERTO"
        session.add(p)
        session.commit()
        session.refresh(p)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser(p))


@router.delete("/finance/{pid}")
def delete_payable(pid: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        p = session.get(Payable, pid)
        if p:
            session.delete(p)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return JSONResponse({"ok": True})
