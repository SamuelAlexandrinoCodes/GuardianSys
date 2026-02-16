"""
Smart Dates: lógica backend para interpretar datas em linguagem natural.
Usa apenas a biblioteca padrão datetime.
Suporta: Hoje, Amanhã, Próxima semana (segunda-feira), etc.
"""
from datetime import date, datetime, timedelta
from typing import Optional


def _normalize(s: str) -> str:
    if not s:
        return ""
    return s.strip().lower().replace("ã", "a").replace("ç", "c").replace("é", "e")


def _next_weekday(base: date, weekday: int) -> date:
    """weekday: 0=segunda, 6=domingo (ISO: 1=segunda, 7=domingo)."""
    # Python: Monday=0, Sunday=6. Queremos "próxima segunda" = próximo dia 0.
    days_ahead = weekday - base.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    return base + timedelta(days=days_ahead)


def parse_smart_date(value: str, base: Optional[date] = None) -> Optional[date]:
    """
    Converte uma string de data "smart" em date.
    value: "hoje", "amanha", "amanhã", "tomorrow", "proxima_semana", "proxima segunda", etc.
    base: data de referência (default: hoje).
    Retorna None se não reconhecer.
    """
    if not value or not isinstance(value, str):
        return None
    base = base or date.today()
    n = _normalize(value)

    if n in ("hoje", "today"):
        return base
    if n in ("amanha", "amanhã", "tomorrow"):
        return base + timedelta(days=1)
    if n in ("depois de amanha", "depois de amanhã", "day_after_tomorrow"):
        return base + timedelta(days=2)

    # Próxima semana (segunda-feira por padrão, ou dia explícito)
    if n in ("proxima_semana", "proxima semana", "next_week", "next week"):
        return _next_weekday(base, 0)  # próxima segunda
    if "proxima segunda" in n or "next monday" in n:
        return _next_weekday(base, 0)
    if "proxima terca" in n or "proxima terça" in n or "next tuesday" in n:
        return _next_weekday(base, 1)
    if "proxima quarta" in n or "next wednesday" in n:
        return _next_weekday(base, 2)
    if "proxima quinta" in n or "next thursday" in n:
        return _next_weekday(base, 3)
    if "proxima sexta" in n or "next friday" in n:
        return _next_weekday(base, 4)
    if "proximo sabado" in n or "próximo sábado" in n or "next saturday" in n:
        return _next_weekday(base, 5)
    if "proximo domingo" in n or "next sunday" in n:
        return _next_weekday(base, 6)

    # Próximo mês (primeiro dia)
    if n in ("proximo_mes", "proximo mes", "next_month"):
        y, m = base.year, base.month
        if m == 12:
            return date(y + 1, 1, 1)
        return date(y, m + 1, 1)

    return None


def parse_smart_datetime(
    value: str,
    base: Optional[datetime] = None,
    default_time: tuple = (9, 0),
) -> Optional[datetime]:
    """
    Converte uma string smart em datetime (para lembrete).
    value: "amanha", "amanhã 20:00", "proxima segunda 09:00", etc.
    default_time: (hora, minuto) quando não especificado.
    """
    if not value or not isinstance(value, str):
        return None
    base = base or datetime.now()
    base_date = base.date() if isinstance(base, datetime) else base
    n = _normalize(value)
    hour, minute = default_time[0], default_time[1]

    # Tenta extrair hora do valor (ex: "amanha 20:00")
    parts = n.split()
    for p in parts:
        if ":" in p:
            try:
                h, m = p.split(":")[:2]
                hour, minute = int(h), int(m)
            except (ValueError, IndexError):
                pass
            break

    # Data: primeiro token ou valor inteiro
    first = parts[0] if parts else n
    target_date = parse_smart_date(first, base_date)
    if target_date is None:
        return None
    return datetime(target_date.year, target_date.month, target_date.day, hour, minute, 0, 0)


def resolve_date_or_smart(value: str, base: Optional[date] = None) -> Optional[date]:
    """
    Aceita tanto ISO (YYYY-MM-DD) quanto smart string.
    Útil no backend ao receber due_date ou start_date do formulário.
    """
    if not value or not value.strip():
        return None
    v = value.strip()
    # ISO
    if len(v) == 10 and v[4] == "-" and v[7] == "-":
        try:
            return datetime.strptime(v, "%Y-%m-%d").date()
        except ValueError:
            pass
    return parse_smart_date(v, base or date.today())


def resolve_datetime_or_smart(value: str, base: Optional[datetime] = None) -> Optional[datetime]:
    """
    Aceita ISO datetime (YYYY-MM-DDTHH:MM) ou smart string.
    Útil para reminder_at.
    """
    if not value or not value.strip():
        return None
    v = value.strip()
    if "T" in v and len(v) >= 16:
        try:
            return datetime.strptime(v[:16], "%Y-%m-%dT%H:%M")
        except ValueError:
            pass
    return parse_smart_datetime(v, base or datetime.now())
