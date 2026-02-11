from sqlmodel import SQLModel, create_engine, Session, text, select
from datetime import date, timedelta
import os
import shutil
import re

# Define o caminho absoluto para garantir que funcione em qualquer Windows
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_FOLDER = os.path.join(BASE_DIR, "data")
DB_FILE = os.path.join(DB_FOLDER, "guardian.db")
sqlite_url = f"sqlite:///{DB_FILE}"

# check_same_thread=False é necessário para SQLite com FastAPI
engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

def create_db_and_tables():
    # Cria a pasta 'data' se não existir
    if not os.path.exists(DB_FOLDER):
        os.makedirs(DB_FOLDER)
    
    # Cria as tabelas
    SQLModel.metadata.create_all(engine)
    
    # --- MIGRAÇÕES: adicionar colunas novas se não existirem ---
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL;"))
        conn.execute(text("PRAGMA synchronous=NORMAL;"))
        migs = [
            "ALTER TABLE reservation ADD COLUMN confirmed_at DATETIME",
            "ALTER TABLE document ADD COLUMN reservation_id INTEGER REFERENCES reservation(id)",
            "ALTER TABLE task ADD COLUMN details TEXT",
            "ALTER TABLE task ADD COLUMN start_date DATE",
            "ALTER TABLE task ADD COLUMN completed_at DATETIME",
            "ALTER TABLE payable ADD COLUMN subject TEXT",
            "ALTER TABLE payable ADD COLUMN payee TEXT",
            "ALTER TABLE payable ADD COLUMN regularity TEXT DEFAULT 'MENSAL'",
            "ALTER TABLE payable ADD COLUMN notify_days_before INTEGER DEFAULT 7",
        ]
        for col_sql in migs:
            try:
                conn.execute(text(col_sql))
                conn.commit()
            except Exception:
                conn.rollback()

def migrate_storage_to_unit_folders():
    """Migra storage/{unit_id}/ para storage/apto_{block}_{number}/"""
    from app.models import Document, Unit
    from app.config import STORAGE_DIR, get_unit_folder_name

    with Session(engine) as session:
        for doc in session.exec(select(Document)).all():
            unit = session.get(Unit, doc.unit_id)
            if not unit:
                continue
            new_folder = get_unit_folder_name(unit)
            old_path = os.path.join(STORAGE_DIR, str(doc.unit_id), doc.filename)
            new_dir = os.path.join(STORAGE_DIR, new_folder)
            new_path = os.path.join(new_dir, doc.filename)

            if os.path.exists(old_path) and old_path != new_path:
                if not os.path.exists(new_dir):
                    os.makedirs(new_dir)
                try:
                    shutil.copy2(old_path, new_path)
                    if os.path.exists(new_path):
                        os.remove(old_path)
                    doc.filepath = f"storage/{new_folder}/{doc.filename}"
                    session.add(doc)
                except Exception:
                    pass
        session.commit()
        # Remove pastas vazias antigas (unit_id numérico)
        try:
            for name in os.listdir(STORAGE_DIR):
                path = os.path.join(STORAGE_DIR, name)
                if os.path.isdir(path) and name.isdigit():
                    if not os.listdir(path):
                        os.rmdir(path)
        except Exception:
            pass

def migrate_reservation_folders_to_date_format():
    """Migra reservas/{id}/ para reservas/{data}_{area}/"""
    from app.models import Document, Reservation, Unit
    from app.config import STORAGE_DIR, get_unit_folder_name, get_reservation_folder_name

    with Session(engine) as session:
        for doc in session.exec(select(Document).where(Document.reservation_id.isnot(None))).all():
            if not doc.reservation_id:
                continue
            res = session.get(Reservation, doc.reservation_id)
            if not res:
                continue
            # filepath antigo: storage/apto_X_Y/reservas/123/file.pdf → migrar para reservas/2025-02-15_churrasqueira/
            match = re.search(r"reservas/(\d+)/", doc.filepath)
            if not match:
                continue  # formato inesperado
            if match.group(1) != str(doc.reservation_id):
                continue
            # é o formato antigo por id
            unit = session.get(Unit, doc.unit_id)
            folder_name = get_unit_folder_name(unit) if unit else str(doc.unit_id)
            new_subfolder = get_reservation_folder_name(res.reservation_date, res.area_name)
            old_path = os.path.join(STORAGE_DIR, doc.filepath.replace("storage/", "", 1))
            new_dir = os.path.join(STORAGE_DIR, folder_name, "reservas", new_subfolder)
            new_path = os.path.join(new_dir, doc.filename)
            if os.path.exists(old_path) and old_path != new_path:
                os.makedirs(new_dir, exist_ok=True)
                try:
                    shutil.copy2(old_path, new_path)
                    if os.path.exists(new_path):
                        os.remove(old_path)
                    doc.filepath = f"storage/{folder_name}/reservas/{new_subfolder}/{doc.filename}"
                    session.add(doc)
                except Exception:
                    pass
        session.commit()

def cleanup_old_reservation_documents():
    """Remove documentos de reservas com mais de 6 meses. Roda no dia 1 de cada mês."""
    from app.models import Document, Reservation
    from app.config import STORAGE_DIR

    cutoff = date.today() - timedelta(days=180)
    with Session(engine) as session:
        old_reservations = session.exec(
            select(Reservation).where(Reservation.reservation_date < cutoff)
        ).all()
        res_ids = {r.id for r in old_reservations}
        for doc in session.exec(select(Document).where(Document.reservation_id.isnot(None))).all():
            if doc.reservation_id not in res_ids:
                continue
            full_path = os.path.join(STORAGE_DIR, doc.filepath.replace("storage/", "", 1))
            try:
                if os.path.exists(full_path):
                    os.remove(full_path)
            except Exception:
                pass
            session.delete(doc)
        session.commit()
    # Remove pastas vazias em reservas/
    try:
        for unit_folder in os.listdir(STORAGE_DIR):
            res_path = os.path.join(STORAGE_DIR, unit_folder, "reservas")
            if not os.path.isdir(res_path):
                continue
            for sub in os.listdir(res_path):
                sub_path = os.path.join(res_path, sub)
                if os.path.isdir(sub_path) and not os.listdir(sub_path):
                    os.rmdir(sub_path)
            if os.path.isdir(res_path) and not os.listdir(res_path):
                os.rmdir(res_path)
    except Exception:
        pass

def get_session():
    with Session(engine) as session:
        yield session