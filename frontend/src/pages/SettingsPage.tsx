import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Save,
  Building,
  User,
  Layers,
  DoorOpen,
  FolderSync,
  Check,
  Bell,
  Volume2,
} from "lucide-react";
import type { SystemSettings } from "../types";
import { api } from "../lib/api";
import { useTheme } from "../context/ThemeContext";

export function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [condoName, setCondoName] = useState("");
  const [userName, setUserName] = useState("");
  const [floors, setFloors] = useState(18);
  const [units, setUnits] = useState(12);
  const [backupPath, setBackupPath] = useState("");
  const [reminderSound, setReminderSound] = useState<string>("chimes1");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.getSettings();
      setSettings(res);
      setCondoName(res.condo_name);
      setUserName(res.user_name || "");
      setFloors(res.total_floors);
      setUnits(res.units_per_floor);
      setBackupPath(res.backup_path || "");
      setReminderSound(res.reminder_sound || "chimes1");
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await api.updateSettings({
        condo_name: condoName,
        user_name: userName || null,
        total_floors: floors,
        units_per_floor: units,
        backup_path: backupPath || null,
        reminder_sound: reminderSound,
      });
      setSettings(res);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const { mode, setMode } = useTheme();

  if (loading || !settings) {
    return <div className="flex h-full items-center justify-center"><Loader2 size={24} className="animate-spin text-slate-300 dark:text-zinc-600" /></div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200/60 bg-white px-8 py-4 dark:border-white/[0.06] dark:bg-zinc-950">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">Configuracoes</h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Preferencias do sistema</p>
        </div>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} strokeWidth={2} /> : <Save size={14} strokeWidth={1.5} />}
          {saved ? "Salvo" : "Salvar"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div className="mx-auto max-w-2xl px-8 py-6">
          <div className="divide-y divide-slate-100/60 rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:divide-white/[0.04] dark:border-white/[0.06] dark:bg-zinc-900">

            {/* Dados do Condominio */}
            <FormSection icon={Building} label="Dados do Condominio">
              <SettingRow label="Nome do Condominio" description="Exibido no cabecalho e relatorios.">
                <SettingsInput value={condoName} onChange={setCondoName} />
              </SettingRow>
              <SettingRow label="Seu Nome" description='Nome exibido na saudacao "Bom dia, ...".'>
                <SettingsInput value={userName} onChange={setUserName} placeholder="Ex: Samuel" />
              </SettingRow>
            </FormSection>

            {/* Estrutura */}
            <FormSection icon={Layers} label="Estrutura do Predio">
              <SettingRow label="Total de Andares" description="Numero de andares do predio.">
                <SettingsInput value={String(floors)} onChange={(v) => setFloors(parseInt(v) || 0)} type="number" />
              </SettingRow>
              <SettingRow label="Unidades por Andar" description="Quantidade de apartamentos por andar.">
                <SettingsInput value={String(units)} onChange={(v) => setUnits(parseInt(v) || 0)} type="number" />
              </SettingRow>
              <SettingRow label="Total de Unidades" description="Calculado automaticamente.">
                <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  {floors * units}
                </span>
              </SettingRow>
            </FormSection>

            {/* Som dos Lembretes */}
            <FormSection icon={Bell} label="Lembretes > Sons">
              <SettingRow label="Som padrao" description="Clique para ouvir. A selecao e salva como padrao do sistema.">
                <div className="space-y-3">
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      Chimes
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(["chimes1", "chimes2", "chimes3", "chimes4"] as const).map((id) => (
                        <SoundButton
                          key={id}
                          id={id}
                          label={id.replace("chimes", "")}
                          selected={reminderSound === id}
                          onSelect={() => setReminderSound(id)}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      Modern
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(["modern1", "modern2", "modern3"] as const).map((id) => (
                        <SoundButton
                          key={id}
                          id={id}
                          label={id.replace("modern", "")}
                          selected={reminderSound === id}
                          onSelect={() => setReminderSound(id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </SettingRow>
            </FormSection>

            {/* Backup */}
            <FormSection icon={FolderSync} label="Backup Automatico">
              <SettingRow label="Caminho do Espelho" description="Pasta para backup automatico (VACUUM INTO). Deixe vazio para desativar.">
                <SettingsInput value={backupPath} onChange={setBackupPath} placeholder="C:\Backups\Guardian" />
              </SettingRow>
            </FormSection>

            {/* Aparencia */}
            <FormSection icon={DoorOpen} label="Aparencia">
              <SettingRow label="Tema" description="Escolha entre claro, escuro ou acompanhar o sistema.">
                <div className="flex gap-1 rounded-xl border border-slate-200/60 bg-slate-50 p-1 dark:border-white/[0.06] dark:bg-zinc-800">
                  {(["light", "dark", "system"] as const).map((m) => (
                    <button key={m} onClick={() => setMode(m)} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${mode === m ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100" : "text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"}`}>
                      {m === "light" ? "Claro" : m === "dark" ? "Escuro" : "Sistema"}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow label="Modo Escuro" description="Ative para usar o tema escuro.">
                <ToggleSwitch enabled={mode === "dark"} onChange={(on) => setMode(on ? "dark" : "light")} />
              </SettingRow>
            </FormSection>

            {/* Info */}
            <FormSection icon={User} label="Sobre">
              <SettingRow label="Sistema" description="GuardianSys — Sistema de Gestao Condominial">
                <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">v2.0.0</span>
              </SettingRow>
            </FormSection>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sound Button (preview + select)
// ---------------------------------------------------------------------------

function SoundButton({
  id,
  label,
  selected,
  onSelect,
}: {
  id: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseDown={() => {
        const a = new Audio(`/sounds/${id}.mp3`);
        a.play().catch(() => {});
      }}
      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
        selected
          ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-400"
          : "border-slate-200/60 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      }`}
    >
      <Volume2 size={12} strokeWidth={1.5} />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Toggle Switch (iOS style)
// ---------------------------------------------------------------------------

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!enabled)} className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ${enabled ? "bg-green-500" : "bg-slate-200 dark:bg-zinc-700"}`}>
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-md ${enabled ? "ml-[22px]" : "ml-[3px]"}`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Form helpers
// ---------------------------------------------------------------------------

function FormSection({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string; children: React.ReactNode;
}) {
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={14} strokeWidth={1.5} className="text-slate-400 dark:text-zinc-500" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">{label}</span>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function SettingRow({ label, description, children }: {
  label: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-8">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{label}</p>
        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SettingsInput({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-52 rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2 text-right text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300 focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-600" />
  );
}
