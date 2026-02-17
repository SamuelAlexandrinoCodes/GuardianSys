"""
API REST JSON — Inventario / Patrimonio.
Regra de Ouro: ZERO alteracao em models.py ou database.py.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import Session, select, or_

from app.database import engine
from app.models import Inventory
from app.config import get_config, run_backup_job

router = APIRouter(prefix="/api", tags=["api-inventory"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class ItemCreate(BaseModel):
    name: str
    category: str
    quantity: int = 0
    location: Optional[str] = None
    label_code: Optional[str] = None
    purchase_link: Optional[str] = None
    entry_date: Optional[str] = None


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    location: Optional[str] = None
    label_code: Optional[str] = None
    purchase_link: Optional[str] = None
    entry_date: Optional[str] = None
    write_off_date: Optional[str] = None


# ---------------------------------------------------------------------------
# Serializer
# ---------------------------------------------------------------------------

def _ser(i: Inventory) -> dict:
    return {
        "id": i.id,
        "name": i.name,
        "category": i.category,
        "label_code": i.label_code,
        "quantity": i.quantity,
        "location": i.location,
        "purchase_link": i.purchase_link,
        "entry_date": i.entry_date.isoformat() if i.entry_date else None,
        "write_off_date": i.write_off_date.isoformat() if i.write_off_date else None,
        "last_updated": i.last_updated.isoformat() if i.last_updated else None,
    }


# ---------------------------------------------------------------------------
# Listagem com filtros
# ---------------------------------------------------------------------------

@router.get("/inventory")
def list_inventory(q: Optional[str] = None, category: Optional[str] = None, location: Optional[str] = None):
    with Session(engine) as session:
        config = get_config(session)
        query = select(Inventory)

        if q:
            query = query.where(or_(
                Inventory.name.contains(q),
                Inventory.label_code.contains(q),
                Inventory.category.contains(q),
                Inventory.location.contains(q),
            ))
        if category:
            query = query.where(Inventory.category == category)
        if location:
            query = query.where(Inventory.location == location)

        items = session.exec(query.order_by(Inventory.name)).all()
        all_categories = [c for c in session.exec(select(Inventory.category).distinct()).all() if c]
        all_locations = [loc for loc in session.exec(select(Inventory.location).distinct()).all() if loc]

    return JSONResponse({
        "config": {"condo_name": config.condo_name if config else "Condominio"},
        "items": [_ser(i) for i in items],
        "categories": all_categories,
        "locations": all_locations,
    })


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.post("/inventory")
def create_item(payload: ItemCreate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        ed = datetime.strptime(payload.entry_date, "%Y-%m-%d").date() if payload.entry_date else None
        item = Inventory(
            name=payload.name, category=payload.category,
            quantity=payload.quantity, location=payload.location,
            label_code=payload.label_code, purchase_link=payload.purchase_link,
            entry_date=ed,
        )
        session.add(item)
        session.commit()
        session.refresh(item)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser(item), status_code=201)


@router.patch("/inventory/{item_id}")
def update_item(item_id: int, payload: ItemUpdate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        item = session.get(Inventory, item_id)
        if not item:
            return JSONResponse({"error": "Item nao encontrado"}, status_code=404)

        for field in ("name", "category", "quantity", "location", "label_code", "purchase_link"):
            val = getattr(payload, field, None)
            if val is not None:
                setattr(item, field, val)

        if payload.entry_date is not None:
            item.entry_date = datetime.strptime(payload.entry_date, "%Y-%m-%d").date() if payload.entry_date else None
        if payload.write_off_date is not None:
            item.write_off_date = datetime.strptime(payload.write_off_date, "%Y-%m-%d").date() if payload.write_off_date else None

        item.last_updated = datetime.now()
        session.add(item)
        session.commit()
        session.refresh(item)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser(item))


@router.delete("/inventory/{item_id}")
def delete_item(item_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        item = session.get(Inventory, item_id)
        if item:
            session.delete(item)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return JSONResponse({"ok": True})


# ---------------------------------------------------------------------------
# Estoque +1 / -1
# ---------------------------------------------------------------------------

@router.post("/inventory/{item_id}/stock/{operation}")
def update_stock(item_id: int, operation: str, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        item = session.get(Inventory, item_id)
        if not item:
            return JSONResponse({"error": "Item nao encontrado"}, status_code=404)
        if operation == "in":
            item.quantity += 1
        elif operation == "out" and item.quantity > 0:
            item.quantity -= 1
        item.last_updated = datetime.now()
        session.add(item)
        session.commit()
        session.refresh(item)
        background_tasks.add_task(run_backup_job)
    return JSONResponse(_ser(item))
