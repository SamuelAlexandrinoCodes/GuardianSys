import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  CalendarDays,
  Building2,
  MessageSquare,
  Users,
} from "lucide-react";
import type { Meeting } from "../../types";
import { api } from "../../lib/api";
import { Modal } from "../ui/Modal";

interface MeetingAgendaProps {
  meetings: Meeting[];
  onRefresh: () => void;
}

export function MeetingAgenda({ meetings, onRefresh }: MeetingAgendaProps) {
  const [showModal, setShowModal] = useState(false);

  const handleDelete = useCallback(
    async (id: number) => {
      await api.deleteMeeting(id);
      onRefresh();
    },
    [onRefresh]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Reunioes
          </h2>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
            Agenda corporativa
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          <Plus size={14} strokeWidth={1.5} />
          Nova Reuniao
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-6 pb-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {meetings.map((m) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-white/[0.06] dark:bg-zinc-900"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-white dark:bg-zinc-800">
                    <CalendarDays size={10} strokeWidth={1.5} />
                    {new Date(m.meeting_date + "T00:00:00").toLocaleDateString(
                      "pt-BR",
                      { day: "2-digit", month: "short" }
                    )}
                    {m.meeting_time && ` ${m.meeting_time}`}
                  </span>
                </div>

                <h4 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                  {m.title}
                </h4>

                {m.company && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
                    <Building2 size={11} strokeWidth={1.5} />
                    {m.company}
                  </p>
                )}
                {m.reason && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400">
                    <MessageSquare size={11} strokeWidth={1.5} />
                    {m.reason}
                  </p>
                )}
                {m.participants && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-zinc-500">
                    <Users size={11} strokeWidth={1.5} />
                    {m.participants}
                  </p>
                )}

                <button
                  onClick={() => handleDelete(m.id)}
                  className="absolute right-3 top-3 text-slate-200 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400 dark:text-zinc-700 dark:hover:text-red-400"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {meetings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <CalendarDays
              size={40}
              strokeWidth={1}
              className="mb-4 text-slate-200 dark:text-zinc-700"
            />
            <p className="text-sm font-bold tracking-tight text-slate-300 dark:text-zinc-600">
              Nenhuma reuniao agendada.
            </p>
          </div>
        )}
      </div>

      {/* Create modal */}
      <CreateMeetingModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onRefresh={onRefresh}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create modal
// ---------------------------------------------------------------------------

function CreateMeetingModal({
  open,
  onClose,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [company, setCompany] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = async () => {
    if (!title.trim() || !meetingDate) return;
    await api.createMeeting({
      title: title.trim(),
      meeting_date: meetingDate,
      meeting_time: meetingTime || null,
      company: company.trim() || null,
      reason: reason.trim() || null,
    });
    setTitle("");
    setMeetingDate("");
    setMeetingTime("");
    setCompany("");
    setReason("");
    onClose();
    onRefresh();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nova Reuniao">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
            Titulo
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Reuniao com administradora"
            className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
              Data
            </label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
              Horario
            </label>
            <input
              type="time"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
              className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
              Empresa
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
              Motivo
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}
