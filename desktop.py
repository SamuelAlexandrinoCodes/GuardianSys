import webview
import uvicorn
import threading
import sys
import os
import socket
import time
import zipfile
import shutil
from datetime import datetime
from app.main import app

# Configuração
HOST = "127.0.0.1"
PORT = 8000

# Descobre onde estão as pastas reais (Funciona no EXE e no Python)
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_DIR = os.path.join(BASE_DIR, "data")
STORAGE_DIR = os.path.join(BASE_DIR, "storage")

class Api:
    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

    def save_backup_dialog(self):
        """
        Abre a janela nativa de 'Salvar Como' e gera o backup.
        """
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M')
        default_name = f"Backup_Guardian_{timestamp}.zip"

        # 1. Abre a janela de Salvar Como (Nativa do Windows)
        result = self._window.create_file_dialog(
            webview.FileDialog.SAVE, # <--- CORREÇÃO AQUI (Era webview.SAVE_DIALOG)
            directory=BASE_DIR, 
            save_filename=default_name,
            file_types=('Arquivos ZIP (*.zip)', 'Todos os arquivos (*.*)')
        )

        if result:
            # O result é o caminho completo escolhido pelo usuário (Ex: C:\Meus Docs\Backup.zip)
            # O create_file_dialog retorna uma string ou None
            target_path = result if isinstance(result, str) else result[0] if isinstance(result, (list, tuple)) else str(result)
            
            try:
                # 2. Cria o ZIP direto no lugar escolhido
                with zipfile.ZipFile(target_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    # Salva o Banco de Dados
                    # Incluímos WAL e SHM caso o banco esteja em uso intenso
                    for db_file in ["guardian.db", "guardian.db-wal", "guardian.db-shm"]:
                        src = os.path.join(DATA_DIR, db_file)
                        if os.path.exists(src):
                            zipf.write(src, arcname=db_file)
                    
                    # Salva a pasta Storage (Fotos/Docs)
                    for root, _, files in os.walk(STORAGE_DIR):
                        for file in files:
                            fpath = os.path.join(root, file)
                            # Caminho relativo dentro do zip
                            zipf.write(fpath, arcname=os.path.relpath(fpath, os.path.dirname(STORAGE_DIR)))
                
                return {"status": "success", "message": f"Backup salvo com sucesso em:\n{target_path}"}
            
            except Exception as e:
                return {"status": "error", "message": f"Erro ao criar backup: {str(e)}"}
        
        return {"status": "cancel", "message": "Operação cancelada."}

def start_server():
    uvicorn.run(app, host=HOST, port=PORT, log_level="critical")

def wait_for_server(host, port, timeout=5):
    start_time = time.time()
    while True:
        try:
            with socket.create_connection((host, port), timeout=1):
                return True
        except (OSError, ConnectionRefusedError):
            if time.time() - start_time > timeout:
                return False
            time.sleep(0.1)

if __name__ == '__main__':
    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    
    time.sleep(1) 
    server_ready = wait_for_server(HOST, PORT)

    if server_ready:
        api = Api()
        window = webview.create_window(
            'Guardian System', 
            f'http://{HOST}:{PORT}',
            width=1200, 
            height=800,
            min_size=(1024, 768),
            js_api=api  # Conecta a nossa API ao Javascript
        )
        api.set_window(window)
        
        icon_path = 'guardian.ico'
        if os.path.exists(icon_path):
            webview.start(icon=icon_path)
        else:
            webview.start()
    else:
        sys.exit(1)