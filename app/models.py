from typing import Optional, List
from datetime import date, datetime
from sqlmodel import SQLModel, Field, Relationship

class SystemConfig(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    condo_name: str = Field(default="Condomínio Residencial")
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
    last_updated: datetime = Field(default_factory=datetime.now)

class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    type: str 
    status: str = Field(default="PENDENTE") 

class Payable(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    description: str 
    amount: float
    due_date: date
    barcode: Optional[str] = None
    status: str = Field(default="ABERTO") 

class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    unit_id: int = Field(foreign_key="unit.id")
    filename: str
    filepath: str
    category: str
    upload_date: datetime = Field(default_factory=datetime.now)
    unit: Unit = Relationship(back_populates="documents")

class Reservation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    unit_id: int = Field(foreign_key="unit.id")
    
    # CAMPO NOVO QUE CAUSA O ERRO SE O BANCO FOR VELHO
    resident_id: Optional[int] = Field(default=None, foreign_key="resident.id")
    
    area_name: str
    reservation_date: date
    status: str = Field(default="Fazer boleto") 
    cancelled_by: Optional[str] = None 
    created_at: datetime = Field(default_factory=datetime.now)
    
    unit: Unit = Relationship(back_populates="reservations")
    resident: Optional[Resident] = Relationship(back_populates="reservations")