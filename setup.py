import os
from sqlmodel import Session, select
from app.database import create_db_and_tables, engine
from app.models import Unit, SystemConfig

# 1. Apaga o banco antigo se existir (Terra Arrasada)
db_path = os.path.join("data", "guardian.db")
if os.path.exists(db_path):
    os.remove(db_path)
    print("💥 Banco de dados antigo apagado.")

# 2. Cria as tabelas novinhas
create_db_and_tables()
print("🏗️ Tabelas recriadas.")

def create_structure():
    with Session(engine) as session:
        # 3. Cria a Configuração Inicial
        if not session.exec(select(SystemConfig)).first():
            # Ajuste aqui o nome real do condomínio do cliente
            conf = SystemConfig(condo_name="Moradas do Itanhangá", total_floors=18, units_per_floor=12)
            session.add(conf)
            print("⚙️ Configuração do sistema aplicada.")

        # 4. Cria as Unidades (Apartamentos) VAZIOS
        # Vou assumir a estrutura que vimos nos prints (18 andares, 12 por andar)
        # Se houver blocos, podemos ajustar. Aqui farei um loop padrão.
        
        floors = 18
        units_per_floor = 12
        blocks = ["1"] # Se tiver Bloco 2, adicione na lista: ["1", "2"]

        print("🏢 Construindo apartamentos...")
        count = 0
        for block in blocks:
            for floor in range(1, floors + 1):
                for u in range(1, units_per_floor + 1):
                    # Gera números como 101, 102... 1001, 1002...
                    unit_number = f"{floor}{u:02d}" 
                    
                    unit = Unit(block=block, number=unit_number)
                    session.add(unit)
                    count += 1
        
        session.commit()
        print(f"✅ {count} Unidades criadas com sucesso (sem moradores).")

if __name__ == "__main__":
    create_structure()
    print("\n🚀 SISTEMA PRONTO PARA ENTREGA AO CLIENTE!")