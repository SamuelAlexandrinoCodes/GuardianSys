from fastapi import APIRouter, Request
from sqlmodel import Session, select, extract
from datetime import date, timedelta
from typing import Optional
from app.database import engine
from app.models import Reservation, Meeting, Payable
from app.config import templates, get_config
from app.routers.dashboard import _get_calendar_events

router = APIRouter()

@router.get("/calendar")
def calendar_page(request: Request, d: Optional[str] = None):
    view_date = date.today()
    if d:
        try:
            view_date = date.fromisoformat(d)
        except ValueError:
            pass

    with Session(engine) as session:
        config = get_config(session)
        calendar_events = _get_calendar_events(session, view_date.year, view_date.month)

        prev_month = view_date.replace(day=1) - timedelta(days=1)
        next_m = view_date.month + 1
        next_y = view_date.year
        if next_m > 12:
            next_m, next_y = 1, next_y + 1
        next_month = view_date.replace(year=next_y, month=next_m, day=1)

    return templates.TemplateResponse("calendar.html", {
        "request": request, "title": "Calendário", "view_date": view_date, "today": date.today(),
        "calendar_events": calendar_events, "config": config,
        "prev_month_url": f"/calendar?d={prev_month.isoformat()}",
        "next_month_url": f"/calendar?d={next_month.isoformat()}",
    })
