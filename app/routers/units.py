import os
import shutil
from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Request, Form, UploadFile, File, BackgroundTasks
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session, select
from app.database import engine
from app.models import Unit, Resident, Document, Reservation, Vehicle, Pet
from app.config import templates, get_config, run_backup_job, STORAGE_DIR, PHOTOS_DIR, get_unit_folder_name

router = APIRouter()

# --- LISTAGEM E DETALHES ---

@router.get("/units")
def list_units(request: Request):
    with Session(engine) as session:
        config = get_config(session)
        units_raw = session.exec(select(Unit).order_by(Unit.id)).all()
        all_residents = session.exec(select(Resident).where(Resident.is_active == True)).all()
        
        residents_map = {}
        for res in all_residents:
            residents_map.setdefault(res.unit_id, []).append(res)
            
        units_data = []
        for u in units_raw:
            unit_residents = residents_map.get(u.id, [])
            head = unit_residents[0].full_name if unit_residents else "Vazio"
            
            units_data.append({
                "unit": u, 
                "residents_count": len(unit_residents),
                "head_of_household": head,
                "is_occupied": len(unit_residents) > 0,
                "status": u.status 
            })
            
    return templates.TemplateResponse("units_list.html", {"request": request, "units": units_data, "title": "Mapa de Unidades", "config": config})

@router.get("/unit/{unit_id}", response_class=HTMLResponse)
def unit_details(request: Request, unit_id: int):
    with Session(engine) as session:
        config = get_config(session)
        unit = session.get(Unit, unit_id)
        if not unit: return "Unidade não encontrada"
        
        prev_unit = session.exec(select(Unit).where(Unit.id < unit.id).order_by(Unit.id.desc())).first()
        next_unit = session.exec(select(Unit).where(Unit.id > unit.id).order_by(Unit.id)).first()
        up_unit, down_unit = None, None
        try:
            if len(unit.number) >= 2:
                current_num = int(unit.number)
                up_unit = session.exec(select(Unit).where(Unit.number == str(current_num - 100))).first()
                down_unit = session.exec(select(Unit).where(Unit.number == str(current_num + 100))).first()
        except: pass

        residents = session.exec(select(Resident).where(Resident.unit_id == unit_id, Resident.is_active == True)).all()
        documents = session.exec(select(Document).where(Document.unit_id == unit_id).order_by(Document.upload_date.desc())).all()
        res_labels = {}
        for doc in documents:
            if doc.reservation_id and doc.reservation_id not in res_labels:
                r = session.get(Reservation, doc.reservation_id)
                if r:
                    res_labels[doc.reservation_id] = f"{r.reservation_date.strftime('%d/%m')} — {r.area_name.replace('_', ' ')}"
        vehicles = session.exec(select(Vehicle).where(Vehicle.unit_id == unit_id)).all()
        pets = session.exec(select(Pet).where(Pet.unit_id == unit_id)).all()
        
        today = date.today()
        unit_reservations = session.exec(
            select(Reservation)
            .where(Reservation.unit_id == unit_id, Reservation.reservation_date >= today, Reservation.status != "CANCELADA")
            .order_by(Reservation.reservation_date)
        ).all()
        
        context = {
            "request": request, "unit": unit, "residents": residents, "documents": documents,
            "res_labels": res_labels, "vehicles": vehicles, "pets": pets, "unit_reservations": unit_reservations,
            "title": "Detalhes da Unidade",
            "config": config, "nav": {"prev": prev_unit, "next": next_unit, "up": up_unit, "down": down_unit}
        }
        if request.headers.get("HX-Request"):
            return templates.TemplateResponse("partials/unit_content.html", context)
        
        return templates.TemplateResponse("unit_details.html", context)

@router.post("/unit/{unit_id}/update_status", response_class=HTMLResponse)
def update_unit_status(unit_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        unit = session.get(Unit, unit_id)
        current = unit.status
        if current == "Ocupado": new_status = "Vazio"
        elif current == "Vazio": new_status = "Invadido"
        else: new_status = "Ocupado"
        
        unit.status = new_status
        session.add(unit)
        session.commit()
        background_tasks.add_task(run_backup_job)
        
        colors = {"Ocupado": "bg-green-100 text-green-700 border-green-200", "Vazio": "bg-slate-100 text-slate-500 border-slate-200", "Invadido": "bg-red-600 text-white border-red-700 animate-pulse"}
        css = colors.get(new_status, "bg-slate-100")
        
        return f"""<div hx-post="/unit/{unit_id}/update_status" hx-swap="outerHTML" class="{css} px-3 py-1 rounded-full text-xs font-bold border cursor-pointer select-none relative group text-center w-24 hover:scale-105 transition" title="Clique para alternar status">{new_status}</div>"""

# --- MORADORES CRUD ---

@router.get("/unit/{unit_id}/add_resident", response_class=HTMLResponse)
def add_resident_form(request: Request, unit_id: int):
    return templates.TemplateResponse("partials/resident_modal.html", {"request": request, "unit_id": unit_id, "resident": None})

@router.post("/residents/create", response_class=RedirectResponse)
def create_resident(background_tasks: BackgroundTasks, unit_id: int = Form(...), full_name: str = Form(...), profile_type: str = Form(...), birth_date: str = Form(None), phone: str = Form(""), email: str = Form(""), observations: str = Form(None), is_pcd: bool = Form(False)):
    with Session(engine) as session:
        bdate = datetime.strptime(birth_date, "%Y-%m-%d").date() if birth_date else None
        new_resident = Resident(unit_id=unit_id, full_name=full_name, profile_type=profile_type, birth_date=bdate, phone=phone, email=email, observations=observations, is_pcd=is_pcd, is_active=True)
        session.add(new_resident)
        session.commit()
        background_tasks.add_task(run_backup_job)
    return RedirectResponse(url=f"/unit/{unit_id}", status_code=303)

@router.delete("/resident/{resident_id}")
def delete_resident(resident_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        resident = session.get(Resident, resident_id)
        if resident:
            resident.is_active = False
            session.add(resident)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return ""

# --- MORADORES EDIÇÃO ---

@router.post("/resident/{resident_id}/toggle_profile", response_class=HTMLResponse)
def toggle_profile(resident_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        res = session.get(Resident, resident_id)
        res.profile_type = "INQUILINO" if res.profile_type == "PROPRIETARIO" else "PROPRIETARIO"
        session.add(res)
        session.commit()
        background_tasks.add_task(run_backup_job)
        
        colors = {"PROPRIETARIO": "bg-blue-100 text-blue-700 border-blue-200", "INQUILINO": "bg-orange-100 text-orange-700 border-orange-200"}
        css = colors.get(res.profile_type, "bg-slate-100")
        
        return f"""<div hx-post="/resident/{resident_id}/toggle_profile" hx-swap="outerHTML" class="cursor-pointer {css} px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border inline-block select-none hover:opacity-80 transition" title="Clique para alternar">{res.profile_type}</div>"""

@router.get("/resident/{resident_id}/edit_name", response_class=HTMLResponse)
def get_edit_name_form(resident_id: int):
    with Session(engine) as session:
        res = session.get(Resident, resident_id)
        return f"""<form hx-post="/resident/{resident_id}/update_name" hx-target="this" hx-swap="outerHTML" hx-trigger="submit, blur from:find input" class="w-full"><input type="text" name="new_name" value="{res.full_name}" class="w-full bg-white border-b-2 border-indigo-500 outline-none text-sm font-bold text-slate-700 px-1 py-0" autofocus onfocus="var val=this.value; this.value=''; this.value=val;" onclick="event.stopPropagation()"></form>"""

@router.post("/resident/{resident_id}/update_name", response_class=HTMLResponse)
def update_resident_name(resident_id: int, background_tasks: BackgroundTasks, new_name: str = Form(...)):
    with Session(engine) as session:
        resident = session.get(Resident, resident_id)
        resident.full_name = new_name
        session.add(resident)
        session.commit()
        background_tasks.add_task(run_backup_job)
        return f"""<div hx-get="/resident/{resident_id}/edit_name" hx-trigger="click" hx-swap="outerHTML" class="cursor-pointer font-bold text-slate-700 hover:text-indigo-600 text-sm mb-1 truncate">{resident.full_name}</div>"""

@router.get("/resident/{resident_id}/edit_date", response_class=HTMLResponse)
def get_edit_date(resident_id: int):
    with Session(engine) as session:
        res = session.get(Resident, resident_id)
        val = res.birth_date.strftime('%d/%m/%Y') if res.birth_date else ""
        return f"""<form hx-post="/resident/{resident_id}/update_date" hx-target="closest td" hx-swap="innerHTML" hx-trigger="submit, blur from:find input" class="w-full m-0 p-0"><input type="text" name="new_date" value="{val}" class="w-full text-xs border-b-2 border-indigo-500 bg-white px-1 py-0.5 outline-none font-medium text-center tracking-wider text-slate-700" placeholder="DD/MM/AAAA" autofocus onclick="event.stopPropagation()"></form>"""

@router.post("/resident/{resident_id}/update_date", response_class=HTMLResponse)
def update_date(resident_id: int, background_tasks: BackgroundTasks, new_date: str = Form(None)):
    with Session(engine) as session:
        res = session.get(Resident, resident_id)
        try:
            if new_date and new_date.strip():
                res.birth_date = datetime.strptime(new_date.strip(), "%d/%m/%Y").date()
            else:
                res.birth_date = None
            session.add(res)
            session.commit()
            background_tasks.add_task(run_backup_job)
        except: pass
        disp = res.birth_date.strftime('%d/%m/%Y') if res.birth_date else "—"
        return f"""<div hx-get="/resident/{resident_id}/edit_date" hx-trigger="click" hx-swap="innerHTML" class="cursor-pointer hover:bg-slate-100 hover:text-indigo-600 p-1 rounded transition text-center w-full h-full flex items-center justify-center">{disp}</div>"""

@router.get("/resident/{resident_id}/edit_field/{field}", response_class=HTMLResponse)
def get_edit_field(resident_id: int, field: str):
    with Session(engine) as session:
        res = session.get(Resident, resident_id)
        value = getattr(res, field) or ""
        font_style = "text-xs font-medium text-slate-700" if field == "phone" else "text-[10px] text-slate-500"
        return f"""<form hx-post="/resident/{resident_id}/update_field/{field}" hx-target="this" hx-swap="outerHTML" hx-trigger="submit, blur from:find input" class="block w-full"><input type="text" name="new_value" value="{value}" placeholder="Vazio..." class="w-full bg-white border-b-2 border-indigo-500 outline-none px-1 py-0 {font_style}" autofocus onfocus="var val=this.value; this.value=''; this.value=val;" onclick="event.stopPropagation()"></form>"""

@router.post("/resident/{resident_id}/update_field/{field}", response_class=HTMLResponse)
def update_field_value(resident_id: int, field: str, background_tasks: BackgroundTasks, new_value: str = Form("")):
    with Session(engine) as session:
        res = session.get(Resident, resident_id)
        setattr(res, field, new_value)
        session.add(res)
        session.commit()
        background_tasks.add_task(run_backup_job)
        
        if field == "phone":
            return f"""<div hx-get="/resident/{resident_id}/edit_field/phone" hx-trigger="click" hx-swap="outerHTML" class="cursor-pointer hover:text-indigo-600 hover:bg-slate-100 px-1 rounded text-slate-700 text-xs font-medium flex items-center gap-1">📱 {res.phone or 'S/ Tel'}</div>"""
        else:
            return f"""<div hx-get="/resident/{resident_id}/edit_field/email" hx-trigger="click" hx-swap="outerHTML" class="cursor-pointer hover:text-indigo-600 hover:bg-slate-100 px-1 rounded text-slate-400 text-[10px] truncate max-w-[140px]" title="{res.email}">📧 {res.email or 'S/ Email'}</div>"""

# --- OBS, PCD E FOTOS ---

@router.get("/resident/{resident_id}/obs_modal", response_class=HTMLResponse)
def get_obs_modal(resident_id: int):
    with Session(engine) as session:
        res = session.get(Resident, resident_id)
        return f"""<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick="this.remove()"><div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onclick="event.stopPropagation()"><h3 class="font-bold text-lg text-slate-800 mb-4">Observações: {res.full_name}</h3><form action="/resident/{resident_id}/save_obs" method="POST"><textarea name="observations" class="w-full border-2 border-slate-200 rounded-lg p-3 text-sm focus:border-indigo-500 outline-none h-32" placeholder="Digite informações médicas, avisos ou detalhes importantes...">{res.observations or ''}</textarea><div class="flex justify-end gap-2 mt-4"><button type="button" onclick="this.closest('.fixed').remove()" class="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm font-bold">Cancelar</button><button type="submit" class="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow">Salvar</button></div></form></div></div>"""

@router.post("/resident/{resident_id}/save_obs", response_class=RedirectResponse)
def save_obs(resident_id: int, background_tasks: BackgroundTasks, observations: str = Form(None)):
    with Session(engine) as session:
        res = session.get(Resident, resident_id)
        res.observations = observations
        session.add(res)
        session.commit()
        background_tasks.add_task(run_backup_job)
        return RedirectResponse(url=f"/unit/{res.unit_id}", status_code=303)

@router.post("/resident/{resident_id}/toggle_pcd", response_class=HTMLResponse)
def toggle_pcd(resident_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        res = session.get(Resident, resident_id)
        res.is_pcd = not res.is_pcd
        session.add(res)
        session.commit()
        background_tasks.add_task(run_backup_job)
        
        icon_css = "bg-blue-100 text-blue-600 border-blue-200" if res.is_pcd else "bg-slate-50 text-slate-300 border-slate-100 grayscale"
        return f"""<button hx-post="/resident/{resident_id}/toggle_pcd" hx-swap="outerHTML" class="flex items-center justify-end gap-2 w-full group transition opacity-70 hover:opacity-100"><span class="text-[10px] font-bold text-slate-400 group-hover:text-blue-600 transition">PCD</span><span class="{icon_css} border p-1 rounded-md text-xs w-6 h-6 flex items-center justify-center">♿</span></button>"""

@router.post("/resident/{resident_id}/upload_photo")
async def upload_resident_photo(background_tasks: BackgroundTasks, resident_id: int, photo: UploadFile = File(...)):
    try:
        if not photo.filename:
            return HTMLResponse("<h3>Erro: Arquivo vazio.</h3>", status_code=400)
        
        ext = photo.filename.split(".")[-1] if "." in photo.filename else "jpg"
        filename = f"photo_{resident_id}.{ext}"
        filepath = os.path.join(PHOTOS_DIR, filename)
        
        content = await photo.read()
        with open(filepath, "wb") as f:
            f.write(content)
            
        with Session(engine) as session:
            res = session.get(Resident, resident_id)
            if res:
                res.photo_path = f"storage/photos/{filename}"
                session.add(res)
                session.commit()
                background_tasks.add_task(run_backup_job)
                return RedirectResponse(url=f"/unit/{res.unit_id}", status_code=303)
    except Exception as e:
        return HTMLResponse(f"<h3>Erro ao enviar foto: {str(e)}</h3>", status_code=500)

# --- PISCINA / CARTEIRINHA ---

@router.get("/resident/{resident_id}/card", response_class=HTMLResponse)
def print_card(request: Request, resident_id: int):
    with Session(engine) as session:
        res = session.get(Resident, resident_id)
        unit = session.get(Unit, res.unit_id)
        config = get_config(session)
        status_piscina = "BLOQUEADO"
        cor_piscina = "red"
        if res.pool_access_expiry and res.pool_access_expiry >= date.today():
            status_piscina = f"VÁLIDO ATÉ {res.pool_access_expiry.strftime('%d/%m/%Y')}"
            cor_piscina = "green"
        return templates.TemplateResponse("resident_card.html", {"request": request, "res": res, "unit": unit, "status_piscina": status_piscina, "cor_piscina": cor_piscina, "config": config})

@router.get("/resident/{resident_id}/pool_status", response_class=HTMLResponse)
def get_pool_status(resident_id: int):
    with Session(engine) as session:
        res = session.get(Resident, resident_id)
        today = date.today()
        if not res.pool_access_expiry:
            css, label, icon = "bg-slate-100 text-slate-400 border-slate-200", "SEM ACESSO", "🔒"
        elif res.pool_access_expiry < today:
            css, label, icon = "bg-red-50 text-red-600 border-red-100", "VENCIDO", "🚫"
        else:
            css, label, icon = "bg-green-50 text-green-700 border-green-200", f"ATÉ {res.pool_access_expiry.strftime('%d/%m/%y')}", "✅"
        return f"""<button hx-get="/resident/{resident_id}/pool_modal" hx-target="#modal-container" hx-trigger="click" class="{css} border px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide flex items-center gap-2 hover:opacity-80 transition shadow-sm w-full justify-center"><span>{icon}</span> {label}</button>"""

@router.get("/resident/{resident_id}/pool_modal", response_class=HTMLResponse)
def get_pool_modal(request: Request, resident_id: int):
    with Session(engine) as session:
        return templates.TemplateResponse("partials/pool_modal.html", {"request": request, "res": session.get(Resident, resident_id)})

@router.post("/resident/{resident_id}/pool_renew/{days}", response_class=HTMLResponse)
def renew_pool_access(resident_id: int, days: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        res = session.get(Resident, resident_id)
        res.pool_access_expiry = date.today() + timedelta(days=days)
        session.add(res)
        session.commit()
        background_tasks.add_task(run_backup_job)
        return get_pool_status(resident_id)

@router.post("/resident/{resident_id}/pool_block", response_class=HTMLResponse)
def block_pool_access(resident_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        res = session.get(Resident, resident_id)
        res.pool_access_expiry = None
        session.add(res)
        session.commit()
        background_tasks.add_task(run_backup_job)
        return get_pool_status(resident_id)

@router.post("/resident/{resident_id}/pool_set_date", response_class=HTMLResponse)
def pool_set_date(resident_id: int, background_tasks: BackgroundTasks, expiry_date: str = Form(...)):
    with Session(engine) as session:
        try:
            res = session.get(Resident, resident_id)
            res.pool_access_expiry = datetime.strptime(expiry_date, "%Y-%m-%d").date()
            session.add(res)
            session.commit()
            background_tasks.add_task(run_backup_job)
        except: pass
        return get_pool_status(resident_id)

# --- VEICULOS E PETS ---

@router.get("/unit/{unit_id}/add_vehicle_modal", response_class=HTMLResponse)
def add_vehicle_modal(unit_id: int):
    return f"""<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick="this.remove()"><div class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onclick="event.stopPropagation()"><h3 class="font-bold text-lg text-slate-800 mb-4">Adicionar Veículo</h3><form action="/unit/{unit_id}/add_vehicle" method="POST" class="space-y-3"><select name="type" id="v-type" onchange="const isBike = this.value === 'Bicicleta'; const plate = document.getElementById('v-plate'); plate.style.display = isBike ? 'none' : 'block'; plate.required = !isBike; plate.value = isBike ? '' : plate.value;" class="w-full border p-2 rounded bg-slate-50"><option value="Carro">Carro</option><option value="Moto">Moto</option><option value="Bicicleta">Bicicleta</option></select><input type="text" name="model" placeholder="Modelo/Cor (Ex: Gol Prata)" class="w-full border p-2 rounded" required><input type="text" id="v-plate" name="plate" placeholder="Placa (ABC-1234)" class="w-full border p-2 rounded" required><input type="text" name="tag" placeholder="TAG (Opcional)" class="w-full border p-2 rounded"><div class="flex justify-end gap-2 mt-2"><button type="button" onclick="this.closest('.fixed').remove()" class="px-3 py-2 text-slate-500">Cancelar</button><button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded font-bold">Salvar</button></div></form></div></div>"""

@router.post("/unit/{unit_id}/add_vehicle", response_class=RedirectResponse)
def add_vehicle(background_tasks: BackgroundTasks, unit_id: int, type: str = Form(...), model: str = Form(...), plate: str = Form(None), tag: str = Form(None)):
    with Session(engine) as session:
        session.add(Vehicle(unit_id=unit_id, type=type, model=model, plate=plate or "S/ Placa", tag=tag))
        session.commit()
        background_tasks.add_task(run_backup_job)
    return RedirectResponse(url=f"/unit/{unit_id}", status_code=303)

@router.delete("/vehicle/{vehicle_id}")
def delete_vehicle(vehicle_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        v = session.get(Vehicle, vehicle_id)
        if v:
            session.delete(v)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return ""

@router.get("/vehicle/{v_id}/edit/{field}", response_class=HTMLResponse)
def get_edit_vehicle(v_id: int, field: str):
    with Session(engine) as session:
        v = session.get(Vehicle, v_id)
        val = getattr(v, field) or ""
        return f"""<form hx-post="/vehicle/{v_id}/update/{field}" hx-target="this" hx-swap="outerHTML" hx-trigger="submit, blur from:find input" class="w-full"><input type="text" name="value" value="{val}" class="w-full bg-white border-b-2 border-indigo-500 outline-none text-xs px-1" autofocus onclick="event.stopPropagation()"></form>"""

@router.post("/vehicle/{v_id}/update/{field}", response_class=HTMLResponse)
def update_vehicle(v_id: int, field: str, background_tasks: BackgroundTasks, value: str = Form("")):
    with Session(engine) as session:
        v = session.get(Vehicle, v_id)
        setattr(v, field, value)
        session.add(v)
        session.commit()
        background_tasks.add_task(run_backup_job)
        if field == "model": return f"""<div hx-get="/vehicle/{v_id}/edit/model" hx-trigger="click" hx-swap="outerHTML" class="font-bold text-slate-700 cursor-pointer hover:text-indigo-600">{v.model}</div>"""
        if field == "plate": return f"""<div hx-get="/vehicle/{v_id}/edit/plate" hx-trigger="click" hx-swap="outerHTML" class="cursor-pointer hover:text-indigo-600">{v.plate}</div>"""
        if field == "tag": return f"""<div hx-get="/vehicle/{v_id}/edit/tag" hx-trigger="click" hx-swap="outerHTML" class="cursor-pointer hover:text-indigo-600">{v.tag or 'S/ Tag'}</div>"""

@router.get("/unit/{unit_id}/add_pet_modal", response_class=HTMLResponse)
def add_pet_modal(unit_id: int):
    return f"""<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick="this.remove()"><div class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onclick="event.stopPropagation()"><h3 class="font-bold text-lg text-slate-800 mb-4">Adicionar Pet</h3><form action="/unit/{unit_id}/add_pet" method="POST" class="space-y-3"><input type="text" name="name" placeholder="Nome do Pet" class="w-full border p-2 rounded" required><input type="text" name="breed" placeholder="Espécie/Raça (Ex: Gato Persa)" class="w-full border p-2 rounded" required><input type="text" name="notes" placeholder="Obs (Ex: Bravo, Vacina OK)" class="w-full border p-2 rounded"><div class="flex justify-end gap-2 mt-2"><button type="button" onclick="this.closest('.fixed').remove()" class="px-3 py-2 text-slate-500">Cancelar</button><button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded font-bold">Salvar</button></div></form></div></div>"""

@router.post("/unit/{unit_id}/add_pet", response_class=RedirectResponse)
def add_pet(background_tasks: BackgroundTasks, unit_id: int, name: str = Form(...), breed: str = Form(...), notes: str = Form(None)):
    with Session(engine) as session:
        session.add(Pet(unit_id=unit_id, name=name, breed=breed, notes=notes))
        session.commit()
        background_tasks.add_task(run_backup_job)
    return RedirectResponse(url=f"/unit/{unit_id}", status_code=303)

@router.delete("/pet/{pet_id}")
def delete_pet(pet_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        p = session.get(Pet, pet_id)
        if p:
            session.delete(p)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return ""

@router.get("/pet/{p_id}/edit/{field}", response_class=HTMLResponse)
def get_edit_pet(p_id: int, field: str):
    with Session(engine) as session:
        p = session.get(Pet, p_id)
        val = getattr(p, field) or ""
        return f"""<form hx-post="/pet/{p_id}/update/{field}" hx-target="this" hx-swap="outerHTML" hx-trigger="submit, blur from:find input" class="w-full"><input type="text" name="value" value="{val}" class="w-full bg-white border-b-2 border-indigo-500 outline-none text-xs px-1" autofocus onclick="event.stopPropagation()"></form>"""

@router.post("/pet/{p_id}/update/{field}", response_class=HTMLResponse)
def update_pet(p_id: int, field: str, background_tasks: BackgroundTasks, value: str = Form("")):
    with Session(engine) as session:
        p = session.get(Pet, p_id)
        setattr(p, field, value)
        session.add(p)
        session.commit()
        background_tasks.add_task(run_backup_job)
        if field == "name": return f"""<div hx-get="/pet/{p_id}/edit/name" hx-trigger="click" hx-swap="outerHTML" class="font-bold text-slate-700 cursor-pointer hover:text-indigo-600">{p.name}</div>"""
        if field == "breed": return f"""<div hx-get="/pet/{p_id}/edit/breed" hx-trigger="click" hx-swap="outerHTML" class="text-[10px] text-slate-400 uppercase cursor-pointer hover:text-indigo-600">{p.breed}</div>"""
        if field == "notes": return f"""<div hx-get="/pet/{p_id}/edit/notes" hx-trigger="click" hx-swap="outerHTML" class="text-[10px] text-slate-500 italic mr-2 cursor-pointer hover:text-indigo-600">{p.notes or 'S/ Obs'}</div>"""

# --- DOCUMENTOS ---

@router.post("/unit/{unit_id}/upload")
async def upload_file(unit_id: int, background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    try:
        with Session(engine) as session:
            unit = session.get(Unit, unit_id)
            if not unit:
                return HTMLResponse("<h3>Unidade não encontrada.</h3>", status_code=404)
            folder_name = get_unit_folder_name(unit)
            unit_folder = os.path.join(STORAGE_DIR, folder_name)
            if not os.path.exists(unit_folder):
                os.makedirs(unit_folder)
            safe_filename = file.filename.replace(" ", "_")
            filepath = os.path.join(unit_folder, safe_filename)
            with open(filepath, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            session.add(Document(unit_id=unit_id, filename=safe_filename, filepath=f"storage/{folder_name}/{safe_filename}", category="Geral"))
            session.commit()
            background_tasks.add_task(run_backup_job)
        return RedirectResponse(url=f"/unit/{unit_id}", status_code=303)
    except:
        return HTMLResponse("<h3>Erro ao fazer upload.</h3>", status_code=500)

def _doc_full_path(doc, session) -> str:
    """Retorna o caminho físico do documento."""
    if doc.filepath.startswith("storage/"):
        return os.path.join(STORAGE_DIR, doc.filepath.replace("storage/", "", 1))
    unit = session.get(Unit, doc.unit_id)
    folder = get_unit_folder_name(unit) if unit else str(doc.unit_id)
    return os.path.join(STORAGE_DIR, folder, doc.filename)

@router.delete("/document/{doc_id}")
def delete_document(doc_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        doc = session.get(Document, doc_id)
        if doc:
            full_path = _doc_full_path(doc, session)
            try: os.remove(full_path)
            except: pass
            session.delete(doc)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return ""