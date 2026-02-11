from fastapi import APIRouter, Request, Form, BackgroundTasks
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session, select
from app.database import engine
from app.models import Inventory
from app.config import templates, get_config, run_backup_job

router = APIRouter()

@router.get("/inventory", response_class=HTMLResponse)
def list_inventory(request: Request):
    with Session(engine) as session:
        items = session.exec(select(Inventory).order_by(Inventory.name)).all()
        return templates.TemplateResponse("inventory.html", {"request": request, "items": items, "config": get_config(session)})

@router.post("/inventory/create", response_class=RedirectResponse)
def create_inventory_item(background_tasks: BackgroundTasks, name: str = Form(...), category: str = Form(...), quantity: int = Form(0), location: str = Form(""), label_code: str = Form(None)):
    with Session(engine) as session:
        session.add(Inventory(name=name, category=category, quantity=quantity, location=location, label_code=label_code))
        session.commit()
        background_tasks.add_task(run_backup_job)
    return RedirectResponse(url="/inventory", status_code=303)

@router.delete("/inventory/{item_id}")
def delete_inventory_item(item_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        item = session.get(Inventory, item_id)
        if item:
            session.delete(item)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return ""

@router.post("/inventory/{item_id}/update_field/{field}", response_class=HTMLResponse)
def update_inventory_field(item_id: int, field: str, background_tasks: BackgroundTasks, value: str = Form("")):
    with Session(engine) as session:
        item = session.get(Inventory, item_id)
        setattr(item, field, value)
        session.add(item)
        session.commit()
        background_tasks.add_task(run_backup_job)
        return f"""<div hx-get="/inventory/{item_id}/edit_field/{field}" hx-trigger="click" hx-swap="outerHTML" class="cursor-pointer hover:text-indigo-600 px-1">{value}</div>"""

@router.get("/inventory/{item_id}/edit_field/{field}", response_class=HTMLResponse)
def get_edit_inventory(item_id: int, field: str):
    with Session(engine) as session:
        item = session.get(Inventory, item_id)
        val = getattr(item, field) or ""
        return f"""<form hx-post="/inventory/{item_id}/update_field/{field}" hx-target="this" hx-swap="outerHTML" hx-trigger="submit, blur from:find input"><input type="text" name="value" value="{val}" class="w-full bg-white border-b-2 border-indigo-500 outline-none px-1 text-sm" autofocus></form>"""