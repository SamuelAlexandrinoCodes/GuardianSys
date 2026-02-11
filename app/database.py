from sqlmodel import SQLModel, create_engine, Session, text
import os

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
    
    # --- OTIMIZAÇÃO: ATIVAR MODO WAL (TURBO) ---
    with engine.connect() as connection:
        connection.execute(text("PRAGMA journal_mode=WAL;"))
        connection.execute(text("PRAGMA synchronous=NORMAL;"))

def get_session():
    with Session(engine) as session:
        yield session