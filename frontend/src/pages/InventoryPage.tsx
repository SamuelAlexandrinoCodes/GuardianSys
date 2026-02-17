import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Package,
  Plus,
  Minus,
  Trash2,
  Search,
  Filter,
  Edit3,
  ExternalLink,
  Tag,
  MapPin,
} from "lucide-react";
import type { InventoryItem } from "../types";
import { api } from "../lib/api";
import { Modal } from "../components/ui/Modal";

function stockDot(qty: number): string {
  if (qty <= 0) return "bg-red-500";
  if (qty <= 3) return "bg-yellow-400";
  return "bg-emerald-500";
}

export function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [locFilter, setLocFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getInventory(search || undefined, catFilter || undefined, locFilter || undefined);
      setItems(res.items);
      setCategories(res.categories);
      setLocations(res.locations);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, catFilter, locFilter]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200/60 bg-white px-8 py-4 dark:border-white/[0.06] dark:bg-zinc-950">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">Inventario</h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Patrimonio do condominio</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-48">
            <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-zinc-600" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar item..." className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium outline-none placeholder:text-slate-300 focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300 dark:placeholder:text-zinc-600" />
          </div>
          {/* Category filter */}
          <div className="relative">
            <Filter size={12} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-zinc-600" />
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="rounded-xl border border-slate-200/60 bg-slate-50 py-2 pl-8 pr-3 text-xs font-semibold text-slate-700 outline-none dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300">
              <option value="">Categoria</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {/* Location filter */}
          <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className="rounded-xl border border-slate-200/60 bg-slate-50 py-2 pl-3 pr-3 text-xs font-semibold text-slate-700 outline-none dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300">
            <option value="">Local</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
            <Plus size={14} strokeWidth={2} /> Novo Item
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-none p-8">
        {loading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 size={20} className="animate-spin text-slate-300 dark:text-zinc-600" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Package size={40} strokeWidth={1} className="mb-4 text-slate-200 dark:text-zinc-700" />
            <p className="text-sm font-semibold text-slate-300 dark:text-zinc-600">Nenhum item encontrado.</p>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl">
            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-white/[0.06] dark:bg-zinc-900">
              <div className="sticky top-0 z-10 grid grid-cols-[1fr_120px_80px_100px_100px_64px] gap-4 border-b border-slate-100/80 bg-white/80 px-5 py-3 backdrop-blur-sm dark:border-white/[0.04] dark:bg-zinc-900/80">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Item</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Categoria</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500 text-center">Qtd</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Local</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500 text-center">Estoque</span>
                <span />
              </div>
              <div className="divide-y divide-slate-100/60 dark:divide-white/[0.04]">
                <AnimatePresence mode="popLayout">
                  {items.map((item) => (
                    <ItemRow key={item.id} item={item} onRefresh={fetchData} onEdit={() => setEditing(item)} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </div>

      <CreateItemModal open={showCreate} onClose={() => setShowCreate(false)} onRefresh={fetchData} categories={categories} locations={locations} />
      <EditItemModal item={editing} onClose={() => setEditing(null)} onRefresh={fetchData} categories={categories} locations={locations} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item Row
// ---------------------------------------------------------------------------

function ItemRow({ item, onRefresh, onEdit }: { item: InventoryItem; onRefresh: () => void; onEdit: () => void }) {
  const stockIn = async () => { await api.stockOperation(item.id, "in"); onRefresh(); };
  const stockOut = async () => { await api.stockOperation(item.id, "out"); onRefresh(); };
  const remove = async () => { await api.deleteInventoryItem(item.id); onRefresh(); };

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="group grid grid-cols-[1fr_120px_80px_100px_100px_64px] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50/50 dark:hover:bg-zinc-800/30"
    >
      {/* Name + label */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${stockDot(item.quantity)}`} title={item.quantity <= 0 ? "Zerado" : item.quantity <= 3 ? "Baixo" : "Normal"} />
          <p className="truncate text-sm font-medium text-slate-800 dark:text-zinc-200">{item.name}</p>
        </div>
        {item.label_code && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 dark:text-zinc-500">
            <Tag size={9} strokeWidth={1.5} /> {item.label_code}
          </span>
        )}
      </div>

      {/* Category */}
      <span className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
        {item.category}
      </span>

      {/* Quantity + controls */}
      <div className="flex items-center justify-center gap-1">
        <button onClick={stockOut} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
          <Minus size={12} strokeWidth={2} />
        </button>
        <span className="min-w-[28px] text-center text-sm font-bold tabular-nums text-slate-800 dark:text-zinc-200">{item.quantity}</span>
        <button onClick={stockIn} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
          <Plus size={12} strokeWidth={2} />
        </button>
      </div>

      {/* Location */}
      <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-zinc-500">
        <MapPin size={10} strokeWidth={1.5} /> {item.location || "—"}
      </span>

      {/* Stock visual */}
      <div className="flex justify-center">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
          <div className={`h-full rounded-full transition-all ${item.quantity <= 0 ? "bg-red-500 w-[5%]" : item.quantity <= 3 ? "bg-yellow-400" : "bg-emerald-500"}`} style={{ width: `${Math.min(item.quantity * 10, 100)}%` }} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        {item.purchase_link && (
          <a href={item.purchase_link} target="_blank" rel="noopener noreferrer" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-200 opacity-0 transition-all group-hover:opacity-100 hover:text-indigo-500 dark:text-zinc-700 dark:hover:text-indigo-400">
            <ExternalLink size={12} strokeWidth={1.5} />
          </a>
        )}
        <button onClick={onEdit} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-200 opacity-0 transition-all group-hover:opacity-100 hover:text-slate-600 dark:text-zinc-700 dark:hover:text-zinc-300">
          <Edit3 size={12} strokeWidth={1.5} />
        </button>
        <button onClick={remove} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-200 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400 dark:text-zinc-700 dark:hover:text-red-400">
          <Trash2 size={12} strokeWidth={1.5} />
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Create Item Modal
// ---------------------------------------------------------------------------

function CreateItemModal({ open, onClose, onRefresh, categories, locations }: {
  open: boolean; onClose: () => void; onRefresh: () => void;
  categories: string[]; locations: string[];
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [qty, setQty] = useState("0");
  const [location, setLocation] = useState("");
  const [labelCode, setLabelCode] = useState("");
  const [link, setLink] = useState("");

  const submit = async () => {
    if (!name.trim() || !category.trim()) return;
    await api.createInventoryItem({
      name: name.trim(), category: category.trim(),
      quantity: parseInt(qty) || 0, location: location || null,
      label_code: labelCode || null, purchase_link: link || null,
    });
    setName(""); setCategory(""); setQty("0"); setLocation(""); setLabelCode(""); setLink("");
    onClose(); onRefresh();
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo Item">
      <div className="space-y-4">
        <IInput label="Nome" value={name} onChange={setName} placeholder="Nome do item" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Categoria</label>
            <input list="cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoria" className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300 focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-600" />
            <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <IInput label="Quantidade" value={qty} onChange={setQty} type="number" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Local</label>
            <input list="locs" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Local" className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300 focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-600" />
            <datalist id="locs">{locations.map((l) => <option key={l} value={l} />)}</datalist>
          </div>
          <IInput label="Etiqueta" value={labelCode} onChange={setLabelCode} placeholder="Codigo" />
        </div>
        <IInput label="Link de Compra" value={link} onChange={setLink} placeholder="https://..." />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button>
          <button onClick={submit} className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">Salvar</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Edit Item Modal
// ---------------------------------------------------------------------------

function EditItemModal({ item, onClose, onRefresh, categories, locations }: {
  item: InventoryItem | null; onClose: () => void; onRefresh: () => void;
  categories: string[]; locations: string[];
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [qty, setQty] = useState("0");
  const [location, setLocation] = useState("");
  const [labelCode, setLabelCode] = useState("");
  const [link, setLink] = useState("");

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category);
      setQty(String(item.quantity));
      setLocation(item.location || "");
      setLabelCode(item.label_code || "");
      setLink(item.purchase_link || "");
    }
  }, [item]);

  const submit = async () => {
    if (!item || !name.trim() || !category.trim()) return;
    await api.updateInventoryItem(item.id, {
      name: name.trim(), category: category.trim(),
      quantity: parseInt(qty) || 0, location: location || null,
      label_code: labelCode || null, purchase_link: link || null,
    });
    onClose(); onRefresh();
  };

  return (
    <Modal open={!!item} onClose={onClose} title="Editar Item">
      <div className="space-y-4">
        <IInput label="Nome" value={name} onChange={setName} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Categoria</label>
            <input list="cats-edit" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200" />
            <datalist id="cats-edit">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <IInput label="Quantidade" value={qty} onChange={setQty} type="number" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Local</label>
            <input list="locs-edit" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200" />
            <datalist id="locs-edit">{locations.map((l) => <option key={l} value={l} />)}</datalist>
          </div>
          <IInput label="Etiqueta" value={labelCode} onChange={setLabelCode} />
        </div>
        <IInput label="Link de Compra" value={link} onChange={setLink} />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button>
          <button onClick={submit} className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">Salvar</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function IInput({ label, value, onChange, placeholder, type = "text" }: {
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
