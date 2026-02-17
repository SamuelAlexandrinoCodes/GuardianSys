import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  CalendarDays,
  Plus,
  ChevronRight,
  MapPin,
  User,
  Clock,
  XCircle,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
} from "lucide-react";
import type { ReservationItem, ReservationDetail } from "../types";
import { api } from "../lib/api";
import { SideSheet } from "../components/ui/SideSheet";
import { Modal } from "../components/ui/Modal";

type Tab = "pendentes" | "confirmadas" | "historico";

const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: "pendentes", label: "Pendentes" },
  { key: "confirmadas", label: "Confirmadas" },
  { key: "historico", label: "Historico" },
];

const STATUS_STYLES: Record<string, string> = {
  "Fazer boleto": "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  "Aguardando retorno da imobiliaria": "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400",
  "Aguardando Pagamento": "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  "Pago/Confirmado": "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  "CANCELADA": "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-500 line-through",
};

const AREA_LABELS: Record<string, string> = {
  CHURRASQUEIRA: "Churrasqueira",
  SALAO_FESTAS: "Salao de Festas",
  SALAO_GOURMET: "Salao Gourmet",
};

export function ReservationsPage() {
  const [tab, setTab] = useState<Tab>("pendentes");
  const [items, setItems] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getReservations(tab, undefined, undefined, search || undefined);
      setItems(res.reservations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200/60 bg-white px-8 py-4 dark:border-white/[0.06] dark:bg-zinc-950">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">Gestao de Reservas</h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Areas comuns</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-56">
            <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-zinc-600" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium outline-none placeholder:text-slate-300 focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300 dark:placeholder:text-zinc-600" />
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
            <Plus size={14} strokeWidth={2} /> Nova Reserva
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 gap-1 border-b border-slate-200/60 bg-white px-8 dark:border-white/[0.06] dark:bg-zinc-950">
        {TAB_LABELS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} className={`relative px-4 py-3 text-xs font-semibold transition-colors ${tab === key ? "text-slate-900 dark:text-zinc-100" : "text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"}`}>
            {label}
            {tab === key && <motion.div layoutId="res-tab" className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-slate-900 dark:bg-zinc-100" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-none p-8">
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 size={20} className="animate-spin text-slate-300 dark:text-zinc-600" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <CalendarDays size={40} strokeWidth={1} className="mb-4 text-slate-200 dark:text-zinc-700" />
            <p className="text-sm font-semibold text-slate-300 dark:text-zinc-600">Nenhuma reserva encontrada.</p>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-2">
            <AnimatePresence mode="popLayout">
              {items.map((r) => (
                <motion.button key={r.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} onClick={() => setSelected(r.id)}
                  className="group flex w-full items-center justify-between rounded-2xl border border-slate-200/60 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md dark:border-white/[0.06] dark:bg-zinc-900"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 dark:bg-zinc-800">
                      <CalendarDays size={18} strokeWidth={1.5} className="text-slate-400 dark:text-zinc-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{AREA_LABELS[r.area_name] || r.area_name}</p>
                      <div className="mt-0.5 flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-500">
                          <Clock size={10} strokeWidth={1.5} /> {new Date(r.reservation_date + "T00:00:00").toLocaleDateString("pt-BR")}
                        </span>
                        {r.unit && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-500">
                            <MapPin size={10} strokeWidth={1.5} /> Apto {r.unit.number}
                          </span>
                        )}
                        {r.resident && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-600">
                            <User size={10} strokeWidth={1.5} /> {r.resident.full_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[r.status] || "bg-slate-100 text-slate-500"}`}>
                      {r.status}
                    </span>
                    <ChevronRight size={14} strokeWidth={1.5} className="text-slate-200 transition-colors group-hover:text-slate-400 dark:text-zinc-700 dark:group-hover:text-zinc-500" />
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <ReservationSideSheet resId={selected} onClose={() => setSelected(null)} onRefresh={fetchData} />
      <CreateReservationModal open={showCreate} onClose={() => setShowCreate(false)} onRefresh={fetchData} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side Sheet de Detalhe
// ---------------------------------------------------------------------------

function ReservationSideSheet({ resId, onClose, onRefresh }: {
  resId: number | null; onClose: () => void; onRefresh: () => void;
}) {
  const [data, setData] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!resId) return;
    setLoading(true);
    try {
      const d = await api.getReservation(resId);
      setData(d);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [resId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const advance = async () => {
    if (!data) return;
    await api.advanceReservation(data.id);
    fetchDetail(); onRefresh();
  };

  const cancel = async () => {
    if (!data) return;
    const who = prompt("Autorizado por:");
    if (!who) return;
    await api.cancelReservation(data.id, who);
    fetchDetail(); onRefresh();
  };

  return (
    <SideSheet open={!!resId} onClose={onClose} title="Detalhe da Reserva">
      {loading || !data ? (
        <div className="flex h-40 items-center justify-center"><Loader2 size={20} className="animate-spin text-slate-300 dark:text-zinc-600" /></div>
      ) : (
        <div className="space-y-6 p-6">
          {/* Header */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">{AREA_LABELS[data.area_name] || data.area_name}</h2>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">
              {new Date(data.reservation_date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-3">
            <span className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[data.status] || "bg-slate-100"}`}>
              {data.status}
            </span>
            {data.confirmed_at && (
              <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                Confirmado em {new Date(data.confirmed_at).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="space-y-3">
            <InfoRow icon={MapPin} label="Unidade" value={data.unit ? `Apto ${data.unit.number} — Bloco ${data.unit.block}` : "—"} />
            <InfoRow icon={User} label="Morador" value={data.resident?.full_name || "—"} />
            {data.cancelled_by && <InfoRow icon={XCircle} label="Cancelado por" value={data.cancelled_by} />}
          </div>

          {/* Actions */}
          {data.status !== "CANCELADA" && data.status !== "Pago/Confirmado" && (
            <div className="flex gap-2">
              <button onClick={advance} className="flex items-center gap-1.5 rounded-xl bg-green-50 px-4 py-2.5 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20">
                <CheckCircle2 size={13} strokeWidth={1.5} /> Avancar Etapa
              </button>
              <button onClick={cancel} className="flex items-center gap-1.5 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20">
                <XCircle size={13} strokeWidth={1.5} /> Cancelar
              </button>
            </div>
          )}

          {/* Status pipeline */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Pipeline</p>
            <div className="space-y-1.5">
              {["Fazer boleto", "Aguardando retorno da imobiliaria", "Aguardando Pagamento", "Pago/Confirmado"].map((s, i) => {
                const current = ["Fazer boleto", "Aguardando retorno da imobiliaria", "Aguardando Pagamento", "Pago/Confirmado"].indexOf(data.status);
                const isCompleted = i < current || data.status === "Pago/Confirmado";
                const isCurrent = s === data.status;
                return (
                  <div key={s} className={`flex items-center gap-2.5 rounded-lg p-2 text-xs font-medium ${isCurrent ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" : isCompleted ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-zinc-600"}`}>
                    {isCompleted ? <CheckCircle2 size={13} strokeWidth={1.5} /> : isCurrent ? <AlertCircle size={13} strokeWidth={1.5} /> : <div className="h-3 w-3 rounded-full border border-slate-200 dark:border-zinc-700" />}
                    {s}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Documents */}
          {data.documents.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Documentos</p>
              <div className="space-y-1.5">
                {data.documents.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-lg border border-slate-100/60 bg-slate-50/50 p-2.5 dark:border-white/[0.04] dark:bg-zinc-800/30">
                    <FileText size={13} strokeWidth={1.5} className="shrink-0 text-slate-400 dark:text-zinc-500" />
                    <span className="flex-1 truncate text-xs font-medium text-slate-600 dark:text-zinc-400">{d.filename}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SideSheet>
  );
}

function InfoRow({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string; value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={13} strokeWidth={1.5} className="shrink-0 text-slate-400 dark:text-zinc-500" />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">{label}</p>
        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Reservation Modal
// ---------------------------------------------------------------------------

function CreateReservationModal({ open, onClose, onRefresh }: {
  open: boolean; onClose: () => void; onRefresh: () => void;
}) {
  const [unitNumber, setUnitNumber] = useState("");
  const [residents, setResidents] = useState<{ id: number; full_name: string }[]>([]);
  const [residentId, setResidentId] = useState<number | "">("");
  const [area, setArea] = useState("CHURRASQUEIRA");
  const [resDate, setResDate] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!unitNumber.trim()) { setResidents([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.getResidentsForUnit(unitNumber.trim());
        setResidents(r.residents);
        if (r.residents.length === 1) setResidentId(r.residents[0].id);
      } catch { setResidents([]); }
    }, 400);
    return () => clearTimeout(t);
  }, [unitNumber]);

  const submit = async () => {
    if (!unitNumber.trim() || !residentId || !resDate) return;
    setErr("");
    try {
      await api.createReservation({ unit_number: unitNumber.trim(), resident_id: residentId, area_name: area, reservation_date: resDate });
      setUnitNumber(""); setResidentId(""); setResDate(""); setArea("CHURRASQUEIRA");
      onClose(); onRefresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao criar reserva");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nova Reserva">
      <div className="space-y-4">
        {err && <p className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-400">{err}</p>}
        <FormInput label="Numero da Unidade" value={unitNumber} onChange={setUnitNumber} placeholder="Ex: 101" />
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Morador</label>
          <select value={residentId} onChange={(e) => setResidentId(e.target.value ? Number(e.target.value) : "")} className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200">
            <option value="">Selecione...</option>
            {residents.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Area</label>
          <select value={area} onChange={(e) => setArea(e.target.value)} className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200">
            <option value="CHURRASQUEIRA">Churrasqueira</option>
            <option value="SALAO_FESTAS">Salao de Festas</option>
            <option value="SALAO_GOURMET">Salao Gourmet</option>
          </select>
        </div>
        <FormInput label="Data" value={resDate} onChange={setResDate} type="date" />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button>
          <button onClick={submit} className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">Criar Reserva</button>
        </div>
      </div>
    </Modal>
  );
}

function FormInput({ label, value, onChange, placeholder, type = "text" }: {
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
