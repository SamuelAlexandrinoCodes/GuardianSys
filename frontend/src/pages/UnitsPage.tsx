import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Building2,
  Search,
  User,
  Phone,
  Mail,
  Car,
  PawPrint,
  FileText,
  CalendarDays,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Accessibility,
} from "lucide-react";
import type { UnitSummary, UnitDetailData } from "../types";
import { api } from "../lib/api";
import { SideSheet } from "../components/ui/SideSheet";
import { Modal } from "../components/ui/Modal";

export function UnitsPage() {
  const [units, setUnits] = useState<UnitSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [occupied, setOccupied] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);

  const fetchUnits = useCallback(async () => {
    try {
      const res = await api.getUnits();
      setUnits(res.units);
      setTotal(res.total);
      setOccupied(res.occupied);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  const filtered = search.trim()
    ? units.filter((u) =>
        u.number.includes(search) ||
        u.head_of_household.toLowerCase().includes(search.toLowerCase())
      )
    : units;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} strokeWidth={1.5} className="animate-spin text-slate-300 dark:text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200/60 bg-white px-8 py-4 dark:border-white/[0.06] dark:bg-zinc-950">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">Mapa de Unidades</h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
              Visao tatica
            </p>
          </div>
          <div className="flex gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-slate-50 px-3 py-1 text-[10px] font-bold text-slate-500 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Total: {total}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ocupadas: {occupied}
            </span>
          </div>
        </div>
        <div className="relative w-64">
          <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-zinc-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar unidade ou morador..."
            className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium text-slate-700 outline-none placeholder:text-slate-300 focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300 dark:placeholder:text-zinc-600"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-none p-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          <AnimatePresence mode="popLayout">
            {filtered.map((u) => (
              <UnitCard key={u.id} unit={u} onClick={() => setSelectedUnit(u.id)} />
            ))}
          </AnimatePresence>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <Building2 size={40} strokeWidth={1} className="mb-4 text-slate-200 dark:text-zinc-700" />
            <p className="text-sm font-semibold text-slate-300 dark:text-zinc-600">Nenhuma unidade encontrada.</p>
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      <UnitDetailSheet
        unitId={selectedUnit}
        onClose={() => setSelectedUnit(null)}
        onNavigate={(id) => setSelectedUnit(id)}
        onUnitsChanged={fetchUnits}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unit Card
// ---------------------------------------------------------------------------

function UnitCard({ unit: u, onClick }: { unit: UnitSummary; onClick: () => void }) {
  const statusDot =
    u.status === "Ocupado" ? "bg-emerald-500" :
    u.status === "Invadido" ? "bg-red-500 animate-pulse" :
    "bg-slate-300 dark:bg-zinc-600";

  const borderClass =
    u.status === "Invadido" ? "border-red-200 dark:border-red-500/20" :
    u.status === "Vazio" ? "opacity-60 hover:opacity-100" : "";

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      className={`group flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md dark:border-white/[0.06] dark:bg-zinc-900 ${borderClass}`}
    >
      <div className="mb-3 flex items-start justify-between">
        <span className="font-mono text-2xl font-bold text-slate-800 dark:text-zinc-200">{u.number}</span>
        <span className={`h-2 w-2 rounded-full ${statusDot}`} title={u.status} />
      </div>
      <div>
        {u.is_occupied ? (
          <>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400">
              <User size={11} strokeWidth={1.5} />
              <span className="truncate">{u.head_of_household.split(" ")[0]}</span>
            </div>
            <span className="mt-1.5 inline-block rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400">
              {u.residents_count} morador{u.residents_count !== 1 ? "es" : ""}
            </span>
          </>
        ) : u.status === "Invadido" ? (
          <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400">
            <ShieldAlert size={12} strokeWidth={1.5} /> ALERTA
          </span>
        ) : (
          <span className="text-[11px] italic text-slate-300 dark:text-zinc-600">Vazio</span>
        )}
      </div>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Unit Detail Side Sheet
// ---------------------------------------------------------------------------

function UnitDetailSheet({ unitId, onClose, onNavigate, onUnitsChanged }: {
  unitId: number | null; onClose: () => void;
  onNavigate: (id: number) => void;
  onUnitsChanged: () => void;
}) {
  const [data, setData] = useState<UnitDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddResident, setShowAddResident] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddPet, setShowAddPet] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    try {
      const res = await api.getUnit(unitId);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const refresh = useCallback(() => { fetchDetail(); onUnitsChanged(); }, [fetchDetail, onUnitsChanged]);

  return (
    <>
      <SideSheet open={!!unitId} onClose={onClose} title="Detalhes da Unidade">
        {loading || !data ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-slate-300 dark:text-zinc-600" />
          </div>
        ) : (
          <div className="space-y-6 p-6">
            {/* Unit header + nav */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                  {data.unit.number}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                  Bloco {data.unit.block}
                </p>
              </div>
              <div className="flex gap-1.5">
                {data.nav.prev_id && (
                  <button onClick={() => onNavigate(data.nav.prev_id!)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/60 text-slate-400 transition-colors hover:bg-slate-50 dark:border-white/[0.06] dark:text-zinc-500 dark:hover:bg-zinc-800">
                    <ChevronLeft size={14} strokeWidth={1.5} />
                  </button>
                )}
                {data.nav.next_id && (
                  <button onClick={() => onNavigate(data.nav.next_id!)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/60 text-slate-400 transition-colors hover:bg-slate-50 dark:border-white/[0.06] dark:text-zinc-500 dark:hover:bg-zinc-800">
                    <ChevronRight size={14} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </div>

            {/* Residents */}
            <Section icon={User} label="Moradores" count={data.residents.length} onAdd={() => setShowAddResident(true)}>
              {data.residents.map((r) => (
                <div key={r.id} className="group flex items-start justify-between rounded-xl border border-slate-100/60 bg-slate-50/50 p-3.5 transition-colors hover:bg-white dark:border-white/[0.04] dark:bg-zinc-800/30 dark:hover:bg-zinc-800/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{r.full_name}</p>
                      <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        r.profile_type === "PROPRIETARIO"
                          ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                          : "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                      }`}>
                        {r.profile_type}
                      </span>
                      {r.is_pcd && <Accessibility size={12} className="text-blue-500" />}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      {r.phone && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-500">
                          <Phone size={10} strokeWidth={1.5} /> {r.phone}
                        </span>
                      )}
                      {r.email && (
                        <span className="flex items-center gap-1 truncate text-[11px] text-slate-400 dark:text-zinc-600">
                          <Mail size={10} strokeWidth={1.5} /> {r.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={async () => { await api.deleteResident(r.id); refresh(); }} className="text-slate-200 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400 dark:text-zinc-700 dark:hover:text-red-400">
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
              {data.residents.length === 0 && <EmptyState label="Nenhum morador ativo." />}
            </Section>

            {/* Vehicles */}
            <Section icon={Car} label="Veiculos" count={data.vehicles.length} onAdd={() => setShowAddVehicle(true)}>
              {data.vehicles.map((v) => (
                <div key={v.id} className="group flex items-center justify-between rounded-xl border border-slate-100/60 bg-slate-50/50 p-3 dark:border-white/[0.04] dark:bg-zinc-800/30">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{v.model}</p>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500">{v.type} — {v.plate || "S/ Placa"} {v.tag ? `(${v.tag})` : ""}</p>
                  </div>
                  <button onClick={async () => { await api.deleteVehicle(v.id); refresh(); }} className="text-slate-200 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400 dark:text-zinc-700">
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
              {data.vehicles.length === 0 && <EmptyState label="Nenhum veiculo." />}
            </Section>

            {/* Pets */}
            <Section icon={PawPrint} label="Pets" count={data.pets.length} onAdd={() => setShowAddPet(true)}>
              {data.pets.map((p) => (
                <div key={p.id} className="group flex items-center justify-between rounded-xl border border-slate-100/60 bg-slate-50/50 p-3 dark:border-white/[0.04] dark:bg-zinc-800/30">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{p.name}</p>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500">{p.breed} {p.notes ? `— ${p.notes}` : ""}</p>
                  </div>
                  <button onClick={async () => { await api.deletePet(p.id); refresh(); }} className="text-slate-200 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400 dark:text-zinc-700">
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
              {data.pets.length === 0 && <EmptyState label="Nenhum pet." />}
            </Section>

            {/* Documents */}
            {data.documents.length > 0 && (
              <Section icon={FileText} label="Documentos" count={data.documents.length}>
                {data.documents.map((d) => (
                  <div key={d.id} className="group flex items-center justify-between rounded-xl border border-slate-100/60 bg-slate-50/50 p-3 dark:border-white/[0.04] dark:bg-zinc-800/30">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700 dark:text-zinc-300">{d.filename}</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">{d.category}</p>
                    </div>
                    <button onClick={async () => { await api.deleteDocument(d.id); refresh(); }} className="text-slate-200 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400 dark:text-zinc-700">
                      <Trash2 size={13} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </Section>
            )}

            {/* Upcoming reservations */}
            {data.reservations.length > 0 && (
              <Section icon={CalendarDays} label="Reservas Futuras" count={data.reservations.length}>
                {data.reservations.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-100/60 bg-slate-50/50 p-3 dark:border-white/[0.04] dark:bg-zinc-800/30">
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{r.area_name.replace("_", " ")}</p>
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                        {new Date(r.reservation_date + "T00:00:00").toLocaleDateString("pt-BR")} — {r.status}
                      </p>
                    </div>
                  </div>
                ))}
              </Section>
            )}
          </div>
        )}
      </SideSheet>

      {/* Add modals */}
      <AddResidentModal open={showAddResident} onClose={() => setShowAddResident(false)} unitId={unitId} onRefresh={refresh} />
      <AddVehicleModal open={showAddVehicle} onClose={() => setShowAddVehicle(false)} unitId={unitId} onRefresh={refresh} />
      <AddPetModal open={showAddPet} onClose={() => setShowAddPet(false)} unitId={unitId} onRefresh={refresh} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ icon: Icon, label, count, children, onAdd }: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string; count?: number; children: React.ReactNode; onAdd?: () => void;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon size={12} strokeWidth={1.5} className="text-slate-400 dark:text-zinc-500" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">{label}</span>
          {count !== undefined && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">{count}</span>
          )}
        </div>
        {onAdd && (
          <button onClick={onAdd} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-indigo-500 transition-colors hover:text-indigo-600 dark:text-indigo-400">
            <Plus size={11} strokeWidth={2} /> Adicionar
          </button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="py-3 text-center text-xs font-medium text-slate-300 dark:text-zinc-600">{label}</p>;
}

// ---------------------------------------------------------------------------
// Add Resident Modal
// ---------------------------------------------------------------------------

function AddResidentModal({ open, onClose, unitId, onRefresh }: {
  open: boolean; onClose: () => void; unitId: number | null; onRefresh: () => void;
}) {
  const [name, setName] = useState("");
  const [profile, setProfile] = useState("PROPRIETARIO");
  const [birth, setBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const submit = async () => {
    if (!name.trim() || !unitId) return;
    await api.createResident({
      unit_id: unitId, full_name: name.trim(), profile_type: profile,
      birth_date: birth || null, phone: phone || null, email: email || null,
    });
    setName(""); setProfile("PROPRIETARIO"); setBirth(""); setPhone(""); setEmail("");
    onClose(); onRefresh();
  };

  return (
    <Modal open={open} onClose={onClose} title="Adicionar Morador">
      <div className="space-y-4">
        <Input label="Nome completo" value={name} onChange={setName} placeholder="Nome do morador" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Perfil</label>
            <select value={profile} onChange={(e) => setProfile(e.target.value)} className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200">
              <option value="PROPRIETARIO">Proprietario</option>
              <option value="INQUILINO">Inquilino</option>
            </select>
          </div>
          <Input label="Nascimento" value={birth} onChange={setBirth} type="date" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Telefone" value={phone} onChange={setPhone} placeholder="(11) 99999-0000" />
          <Input label="Email" value={email} onChange={setEmail} placeholder="email@exemplo.com" />
        </div>
        <ModalButtons onCancel={onClose} onSubmit={submit} />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Add Vehicle Modal
// ---------------------------------------------------------------------------

function AddVehicleModal({ open, onClose, unitId, onRefresh }: {
  open: boolean; onClose: () => void; unitId: number | null; onRefresh: () => void;
}) {
  const [type, setType] = useState("Carro");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [tag, setTag] = useState("");

  const submit = async () => {
    if (!model.trim() || !unitId) return;
    await api.createVehicle(unitId, { type, model: model.trim(), plate: plate || null, tag: tag || null });
    setType("Carro"); setModel(""); setPlate(""); setTag("");
    onClose(); onRefresh();
  };

  return (
    <Modal open={open} onClose={onClose} title="Adicionar Veiculo">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200">
            <option>Carro</option><option>Moto</option><option>Bicicleta</option>
          </select>
        </div>
        <Input label="Modelo/Cor" value={model} onChange={setModel} placeholder="Gol Prata" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Placa" value={plate} onChange={setPlate} placeholder="ABC-1234" />
          <Input label="TAG" value={tag} onChange={setTag} placeholder="Opcional" />
        </div>
        <ModalButtons onCancel={onClose} onSubmit={submit} />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Add Pet Modal
// ---------------------------------------------------------------------------

function AddPetModal({ open, onClose, unitId, onRefresh }: {
  open: boolean; onClose: () => void; unitId: number | null; onRefresh: () => void;
}) {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async () => {
    if (!name.trim() || !breed.trim() || !unitId) return;
    await api.createPet(unitId, { name: name.trim(), breed: breed.trim(), notes: notes || null });
    setName(""); setBreed(""); setNotes("");
    onClose(); onRefresh();
  };

  return (
    <Modal open={open} onClose={onClose} title="Adicionar Pet">
      <div className="space-y-4">
        <Input label="Nome" value={name} onChange={setName} placeholder="Nome do pet" />
        <Input label="Especie/Raca" value={breed} onChange={setBreed} placeholder="Gato Persa" />
        <Input label="Observacoes" value={notes} onChange={setNotes} placeholder="Ex: Bravo, Vacina OK" />
        <ModalButtons onCancel={onClose} onSubmit={submit} />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Shared UI bits
// ---------------------------------------------------------------------------

function Input({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300 focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-600" />
    </div>
  );
}

function ModalButtons({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button onClick={onCancel} className="rounded-xl px-5 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button>
      <button onClick={onSubmit} className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">Salvar</button>
    </div>
  );
}
