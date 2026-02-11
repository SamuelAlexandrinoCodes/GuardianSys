from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Request, Form, BackgroundTasks
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session, select, or_
from app.database import engine
from app.models import Inventory
from app.config import templates, get_config, run_backup_job

router = APIRouter()

@router.get("/inventory", response_class=HTMLResponse)
def list_inventory(request: Request, q: Optional[str] = None, category: Optional[str] = None, location: Optional[str] = None):
    with Session(engine) as session:
        query = select(Inventory)
        
        if q:
            query = query.where(or_(
                Inventory.name.contains(q),
                Inventory.label_code.contains(q),
                Inventory.category.contains(q),
                Inventory.location.contains(q)
            ))
            
        if category: query = query.where(Inventory.category == category)
        if location: query = query.where(Inventory.location == location)
            
        items = session.exec(query.order_by(Inventory.name)).all()
        
        all_categories = session.exec(select(Inventory.category).distinct()).all()
        all_locations = session.exec(select(Inventory.location).distinct()).all()
        
        return templates.TemplateResponse("inventory.html", {
            "request": request, 
            "items": items, 
            "categories": [c for c in all_categories if c],
            "locations": [l for l in all_locations if l],
            "config": get_config(session),
            "current_q": q or "",
            "current_cat": category or "",
            "current_loc": location or ""
        })

@router.post("/inventory/create", response_class=RedirectResponse)
def create_inventory_item(
    background_tasks: BackgroundTasks, 
    name: str = Form(...), 
    category: str = Form(...), 
    quantity: int = Form(0), 
    location: str = Form(""), 
    label_code: str = Form(None),
    purchase_link: str = Form(None),
    entry_date: str = Form(None)
):
    with Session(engine) as session:
        ed = datetime.strptime(entry_date, "%Y-%m-%d").date() if entry_date else None
        session.add(Inventory(
            name=name, category=category, quantity=quantity, 
            location=location, label_code=label_code, 
            purchase_link=purchase_link, entry_date=ed
        ))
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

@router.post("/inventory/{item_id}/stock/{operation}", response_class=HTMLResponse)
def update_stock(item_id: int, operation: str, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        item = session.get(Inventory, item_id)
        if item:
            if operation == "in": item.quantity += 1
            elif operation == "out" and item.quantity > 0: item.quantity -= 1
            session.add(item); session.commit(); background_tasks.add_task(run_backup_job)
            return str(item.quantity)
    return ""

# --- CORREÇÃO DO BUG DE ESTILOS (HTMX) ---
@router.post("/inventory/{item_id}/update_field/{field}", response_class=HTMLResponse)
def update_inventory_field(item_id: int, field: str, background_tasks: BackgroundTasks, value: str = Form("")):
    with Session(engine) as session:
        item = session.get(Inventory, item_id)
        setattr(item, field, value)
        session.add(item); session.commit(); background_tasks.add_task(run_backup_job)
        
        # Devolve o HTML exato dependendo de qual campo foi editado
        if field == "name":
            return f"""<div class="font-bold text-slate-800 text-base cursor-pointer hover:text-indigo-600 transition" hx-get="/inventory/{item_id}/edit_field/name" hx-trigger="click" hx-swap="outerHTML">{value}</div>"""
        
        elif field == "label_code":
            if value:
                return f"""<div class="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded w-fit mt-1 border border-slate-200 cursor-pointer hover:text-indigo-600 transition" hx-get="/inventory/{item_id}/edit_field/label_code" hx-trigger="click" hx-swap="outerHTML">🏷️ {value}</div>"""
            else:
                return f"""<div class="text-[10px] font-mono font-bold text-slate-300 border border-dashed border-slate-300 px-2 py-0.5 rounded w-fit mt-1 cursor-pointer hover:bg-slate-100 transition" hx-get="/inventory/{item_id}/edit_field/label_code" hx-trigger="click" hx-swap="outerHTML">+ Add Etiqueta</div>"""
                
        elif field == "category":
            return f"""<span class="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition" hx-get="/inventory/{item_id}/edit_field/category" hx-trigger="click" hx-swap="outerHTML">{value}</span>"""
            
        elif field == "location":
            return f"""<div hx-get="/inventory/{item_id}/edit_field/location" hx-trigger="click" hx-swap="outerHTML" class="cursor-pointer text-slate-600 font-medium text-[11px] hover:text-indigo-600 transition">{value or 'S/ Local'}</div>"""
            
        return f"""<div hx-get="/inventory/{item_id}/edit_field/{field}" hx-trigger="click" hx-swap="outerHTML" class="cursor-pointer hover:text-indigo-600 px-1">{value}</div>"""

@router.get("/inventory/{item_id}/edit_field/{field}", response_class=HTMLResponse)
def get_edit_inventory(item_id: int, field: str):
    with Session(engine) as session:
        item = session.get(Inventory, item_id)
        val = getattr(item, field) or ""
        return f"""<form hx-post="/inventory/{item_id}/update_field/{field}" hx-target="this" hx-swap="outerHTML" hx-trigger="submit, blur from:find input"><input type="text" name="value" value="{val}" class="w-full bg-white border-b-2 border-indigo-500 outline-none px-1 text-sm font-mono" autofocus onclick="event.stopPropagation()"></form>"""

@router.get("/inventory/{item_id}/edit_date_field/{field}", response_class=HTMLResponse)
def get_edit_date_inventory(item_id: int, field: str):
    with Session(engine) as session:
        item = session.get(Inventory, item_id)
        val = getattr(item, field)
        val_str = val.isoformat() if val else ""
        return f"""<form hx-post="/inventory/{item_id}/update_date_field/{field}" hx-target="this" hx-swap="outerHTML" hx-trigger="submit, blur from:find input"><input type="date" name="value" value="{val_str}" class="bg-white border-b-2 border-indigo-500 outline-none text-[11px] w-24 px-1" autofocus onclick="event.stopPropagation()"></form>"""

@router.post("/inventory/{item_id}/update_date_field/{field}", response_class=HTMLResponse)
def update_date_inventory(item_id: int, field: str, background_tasks: BackgroundTasks, value: str = Form("")):
    with Session(engine) as session:
        item = session.get(Inventory, item_id)
        try:
            new_date = datetime.strptime(value, "%Y-%m-%d").date() if value else None
            setattr(item, field, new_date)
        except ValueError:
            pass
        session.add(item); session.commit(); background_tasks.add_task(run_backup_job)
        
        new_val = getattr(item, field)
        color = "text-red-500 hover:text-red-700" if field == "write_off_date" else "text-slate-600 hover:text-indigo-600"
        
        if new_val:
            return f"""<div hx-get="/inventory/{item_id}/edit_date_field/{field}" hx-trigger="click" hx-swap="outerHTML" class="cursor-pointer text-[11px] font-bold {color} px-2 py-1 rounded bg-slate-50 border border-transparent hover:border-slate-200 transition">{new_val.strftime('%d/%m/%Y')}</div>"""
        else:
            return f"""<div hx-get="/inventory/{item_id}/edit_date_field/{field}" hx-trigger="click" hx-swap="outerHTML" class="cursor-pointer text-[11px] font-bold text-slate-400 hover:text-indigo-600 border border-dashed border-slate-300 rounded px-2 py-1 inline-block">N/A</div>"""

@router.post("/inventory/{item_id}/save_link", response_class=RedirectResponse)
def save_inventory_link(item_id: int, background_tasks: BackgroundTasks, purchase_link: str = Form(None)):
    with Session(engine) as session:
        item = session.get(Inventory, item_id)
        if item:
            item.purchase_link = purchase_link
            session.add(item)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return RedirectResponse(url="/inventory", status_code=303)