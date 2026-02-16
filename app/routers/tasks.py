from datetime import datetime, date # <-- CORREÇÃO: Importamos o 'date'
from fastapi import APIRouter, Request, Form, BackgroundTasks
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session, select
from app.database import engine
from app.models import Task
from app.config import templates, get_config, run_backup_job

router = APIRouter()

@router.get("/tasks", response_class=HTMLResponse)
def list_tasks(request: Request):
    with Session(engine) as session:
        tasks = session.exec(select(Task).where(Task.type == "TAREFA").order_by(Task.due_date)).all()
        meetings = session.exec(select(Task).where(Task.type == "REUNIAO").order_by(Task.due_date)).all()
        
        # CORREÇÃO: Enviamos a variável "date" para o HTML conseguir calcular o atraso
        return templates.TemplateResponse("tasks.html", {
            "request": request, 
            "tasks": tasks, 
            "meetings": meetings, 
            "config": get_config(session),
            "date": date 
        })

@router.post("/tasks/create")
def create_task(request: Request, background_tasks: BackgroundTasks, title: str = Form(...), type: str = Form(...), due_date: str = Form(None), description: str = Form(None)):
    with Session(engine) as session:
        dd = datetime.strptime(due_date, "%Y-%m-%d").date() if (due_date and due_date.strip()) else None
        task = Task(title=title, type=type, due_date=dd, description=description or None, status="PENDENTE")
        session.add(task)
        session.commit()
        session.refresh(task)
        background_tasks.add_task(run_backup_job)
        if request.headers.get("HX-Request"):
            if type == "TAREFA":
                html = templates.get_template("partials/task_row_tasks_page.html").render({
                    "request": request, "task": task, "date": date
                })
            else:
                html = templates.get_template("partials/meeting_card_tasks_page.html").render({
                    "request": request, "meeting": task
                })
            return HTMLResponse(html, status_code=201, headers={"HX-Trigger": "closeTaskModal"})
    return RedirectResponse(url="/tasks", status_code=303)

@router.post("/tasks/{task_id}/toggle_status")
def toggle_task_status(task_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        task = session.get(Task, task_id)
        if not task:
            return HTMLResponse("", status_code=404)
        task.status = "CONCLUIDO" if task.status == "PENDENTE" else "PENDENTE"
        task.completed_at = datetime.now() if task.status == "CONCLUIDO" else None
        session.add(task)
        session.commit()
        background_tasks.add_task(run_backup_job)
    return HTMLResponse("")

@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        task = session.get(Task, task_id)
        if task:
            session.delete(task)
            session.commit()
            background_tasks.add_task(run_backup_job)
    return HTMLResponse("")