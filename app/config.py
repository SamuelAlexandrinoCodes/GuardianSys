import os
import sys
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select, text
from app.models import SystemConfig
from app.database import engine

# --- LÓGICA DO TERMINAL (INTELIGENTE) ---
if getattr(sys, 'frozen', False):
    # Se for .exe, silencia tudo para não travar
    sys.stdout = open(os.devnull, 'w')
    sys.stderr = open(os.devnull, 'w')
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # Se for desenvolvimento, mantém terminal ativo
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --- CAMINHOS ---
TEMPLATES_DIR = os.path.join(BASE_DIR, "app", "templates")
STATIC_DIR = os.path.join(BASE_DIR, "app", "static")
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
PHOTOS_DIR = os.path.join(STORAGE_DIR, "photos")
DATA_DIR = os.path.join(BASE_DIR, "data")

# Garante pastas
for folder in [STORAGE_DIR, PHOTOS_DIR, DATA_DIR]:
    if not os.path.exists(folder):
        os.makedirs(folder)

# --- OBJETOS COMPARTILHADOS ---
templates = Jinja2Templates(directory=TEMPLATES_DIR)

# --- FUNÇÕES UTILITÁRIAS ---

def get_config(session):
    return session.exec(select(SystemConfig)).first()

def run_backup_job():
    """
    Esta função roda em SEGUNDO PLANO (Background Task).
    Ela abre sua própria conexão com o banco e faz o backup sem travar a tela.
    """
    try:
        with Session(engine) as session:
            config = session.exec(select(SystemConfig)).first()
            
            # Só faz backup se tiver caminho configurado
            if config and config.backup_path:
                if not os.path.exists(config.backup_path):
                    return # Pasta não existe
                
                dst = os.path.join(config.backup_path, "guardian_auto_mirror.db")
                
                # Remove arquivo antigo se existir (VACUUM INTO exige destino limpo)
                if os.path.exists(dst):
                    try:
                        os.remove(dst)
                    except:
                        return # Arquivo em uso, aborta silenciosamente
                
                # Comando SQL nativo para backup (Mais leve que copiar arquivo)
                session.exec(text(f"VACUUM INTO '{dst}'"))
                
                # Feedback apenas no terminal de desenvolvimento
                if not getattr(sys, 'frozen', False):
                    print(f"[Background] Backup espelho realizado em: {dst}")
    except Exception:
        pass # Silêncio absoluto em caso de erro para não derrubar a thread principal