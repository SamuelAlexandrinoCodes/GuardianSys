from typing import Optional, List
from datetime import date, datetime
from sqlmodel import SQLModel, Field, Relationship

class SystemConfig(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    condo_name: str = Field(default="Condomínio Residencial")
    user_name: Optional[str] = Field(default=None)  # Nome para "Bom dia, [Nome]"
    total_floors: int = Field(default=18)
    units_per_floor: int = Field(default=12)
    backup_path: Optional[str] = None

class Unit(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    block: str = Field(index=True)
    number: str = Field(index=True)
    status: str = Field(default="Vazio")
    
    residents: List["Resident"] = Relationship(back_populates="unit")
    documents: List["Document"] = Relationship(back_populates="unit")
    reservations: List["Reservation"] = Relationship(back_populates="unit")
    vehicles: List["Vehicle"] = Relationship(back_populates="unit")
    pets: List["Pet"] = Relationship(back_populates="unit")

class Resident(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    unit_id: int = Field(foreign_key="unit.id")
    full_name: str = Field(index=True)
    birth_date: date
    phone: Optional[str] = None
    email: Optional[str] = None
    profile_type: str
    photo_path: Optional[str] = None 
    pool_access_expiry: Optional[date] = None 
    is_active: bool = Field(default=True)
    observations: Optional[str] = None  
    is_pcd: bool = Field(default=False) 
    pcd_tag: Optional[str] = None       
    
    unit: Unit = Relationship(back_populates="residents")
    reservations: List["Reservation"] = Relationship(back_populates="resident")

class Vehicle(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    unit_id: int = Field(foreign_key="unit.id")
    type: str  
    model: str 
    plate: Optional[str] = None
    tag: Optional[str] = None 
    unit: Unit = Relationship(back_populates="vehicles")

class Pet(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    unit_id: int = Field(foreign_key="unit.id")
    name: str
    breed: str 
    notes: Optional[str] = None 
    unit: Unit = Relationship(back_populates="pets")

class Inventory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    category: str 
    label_code: Optional[str] = None 
    quantity: int = Field(default=0)
    location: Optional[str] = None 
    purchase_link: Optional[str] = None 
    
    # NOVOS ATRIBUTOS DA MISSÃO 3A
    entry_date: Optional[date] = None
    write_off_date: Optional[date] = None
    
    last_updated: datetime = Field(default_factory=datetime.now)

class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: Optional[str] = None
    details: Optional[str] = None  # JSON: subtarefas, notas ricas
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    completed_at: Optional[datetime] = None
    type: str = Field(default="TAREFA")
    status: str = Field(default="PENDENTE")

class Meeting(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    meeting_date: date
    meeting_time: Optional[str] = None  # "14:00"
    reminder_date: Optional[date] = None
    company: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    participants: Optional[str] = None  # JSON: [{name, phone, email}]
    created_at: datetime = Field(default_factory=datetime.now)

class Payable(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    description: str
    subject: Optional[str] = None  # sobre o que é a conta
    payee: Optional[str] = None  # para quem pagamos
    amount: float
    due_date: date
    regularity: str = Field(default="MENSAL")  # MENSAL, ANUAL, IRREGULAR
    notify_days_before: int = Field(default=7)
    barcode: Optional[str] = None
    status: str = Field(default="ABERTO") 

class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    unit_id: int = Field(foreign_key="unit.id")
    reservation_id: Optional[int] = Field(default=None, foreign_key="reservation.id")
    filename: str
    filepath: str
    category: str
    upload_date: datetime = Field(default_factory=datetime.now)
    unit: Unit = Relationship(back_populates="documents")
    reservation: Optional["Reservation"] = Relationship(back_populates="documents")

class Reservation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    unit_id: int = Field(foreign_key="unit.id")
    resident_id: Optional[int] = Field(default=None, foreign_key="resident.id")
    area_name: str
    reservation_date: date
    status: str = Field(default="Fazer boleto") 
    cancelled_by: Optional[str] = None 
    created_at: datetime = Field(default_factory=datetime.now)
    confirmed_at: Optional[datetime] = None  # quando status = Pago/Confirmado
    
    unit: Unit = Relationship(back_populates="reservations")
    resident: Optional[Resident] = Relationship(back_populates="reservations")
    documents: List["Document"] = Relationship(back_populates="reservation")