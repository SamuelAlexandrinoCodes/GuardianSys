const BASE = "/api";

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Administrativo — dados completos
  getAdministrativo: (tab = "tarefas") =>
    request<import("../types").AdministrativoData>(
      `/administrativo?tab=${tab}`
    ),

  // Tarefas
  createTask: (data: Record<string, unknown>) =>
    request<import("../types").Task>("/administrativo/task", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  toggleTask: (id: number) =>
    request<import("../types").Task>(`/administrativo/task/${id}/toggle`, {
      method: "POST",
    }),
  deleteTask: (id: number) =>
    request<{ ok: boolean }>(`/administrativo/task/${id}`, {
      method: "DELETE",
    }),
  updateTask: (id: number, data: Record<string, unknown>) =>
    request<import("../types").Task>(`/administrativo/task/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  reorderTasks: (order: number[]) =>
    request<{ ok: boolean }>("/administrativo/tasks/reorder", {
      method: "POST",
      body: JSON.stringify({ order }),
    }),
  getTask: (id: number) =>
    request<import("../types").Task>(`/administrativo/task/${id}`),

  // Steps
  addStep: (taskId: number, title: string) =>
    request<import("../types").TaskStep>(
      `/administrativo/task/${taskId}/step`,
      { method: "POST", body: JSON.stringify({ title }) }
    ),
  updateStep: (
    taskId: number,
    stepId: number,
    data: { title?: string; done?: boolean }
  ) =>
    request<import("../types").TaskStep>(
      `/administrativo/task/${taskId}/step/${stepId}`,
      { method: "PATCH", body: JSON.stringify(data) }
    ),
  toggleStep: (taskId: number, stepId: number) =>
    request<import("../types").TaskStep>(
      `/administrativo/task/${taskId}/step/${stepId}/toggle`,
      { method: "PATCH" }
    ),
  deleteStep: (taskId: number, stepId: number) =>
    request<{ ok: boolean }>(
      `/administrativo/task/${taskId}/step/${stepId}`,
      { method: "DELETE" }
    ),

  // Reunioes
  createMeeting: (data: Record<string, unknown>) =>
    request<import("../types").Meeting>("/administrativo/meeting", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMeeting: (id: number, data: Record<string, unknown>) =>
    request<import("../types").Meeting>(`/administrativo/meeting/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteMeeting: (id: number) =>
    request<{ ok: boolean }>(`/administrativo/meeting/${id}`, {
      method: "DELETE",
    }),

  // Contas a Pagar
  createPayable: (data: Record<string, unknown>) =>
    request<import("../types").Payable>("/administrativo/payable", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  togglePayable: (id: number) =>
    request<import("../types").Payable>(
      `/administrativo/payable/${id}/toggle`,
      { method: "POST" }
    ),
  deletePayable: (id: number) =>
    request<{ ok: boolean }>(`/administrativo/payable/${id}`, {
      method: "DELETE",
    }),

  // Reminders
  getReminders: () =>
    request<{ id: number; title: string; reminder_at: string | null }[]>(
      "/administrativo/reminders"
    ),

  // -----------------------------------------------------------------------
  // Dashboard
  // -----------------------------------------------------------------------
  getDashboard: (viewDate?: string) =>
    request<import("../types").DashboardData>(
      `/dashboard${viewDate ? `?view_date=${viewDate}` : ""}`
    ),

  // -----------------------------------------------------------------------
  // Units
  // -----------------------------------------------------------------------
  getUnits: () =>
    request<import("../types").UnitsListData>("/units"),

  getUnit: (id: number) =>
    request<import("../types").UnitDetailData>(`/unit/${id}`),

  toggleUnitStatus: (id: number) =>
    request<{ status: string }>(`/unit/${id}/toggle-status`, { method: "POST" }),

  // Residents
  createResident: (data: Record<string, unknown>) =>
    request<import("../types").Resident>("/residents", {
      method: "POST", body: JSON.stringify(data),
    }),
  updateResident: (id: number, data: Record<string, unknown>) =>
    request<import("../types").Resident>(`/resident/${id}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  deleteResident: (id: number) =>
    request<{ ok: boolean }>(`/resident/${id}`, { method: "DELETE" }),
  toggleResidentProfile: (id: number) =>
    request<import("../types").Resident>(`/resident/${id}/toggle-profile`, { method: "POST" }),
  toggleResidentPcd: (id: number) =>
    request<import("../types").Resident>(`/resident/${id}/toggle-pcd`, { method: "POST" }),
  renewPool: (id: number, days: number) =>
    request<import("../types").Resident>(`/resident/${id}/pool-renew/${days}`, { method: "POST" }),
  blockPool: (id: number) =>
    request<import("../types").Resident>(`/resident/${id}/pool-block`, { method: "POST" }),

  // Vehicles
  createVehicle: (unitId: number, data: Record<string, unknown>) =>
    request<import("../types").Vehicle>(`/unit/${unitId}/vehicle`, {
      method: "POST", body: JSON.stringify(data),
    }),
  updateVehicle: (id: number, data: Record<string, unknown>) =>
    request<import("../types").Vehicle>(`/vehicle/${id}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  deleteVehicle: (id: number) =>
    request<{ ok: boolean }>(`/vehicle/${id}`, { method: "DELETE" }),

  // Pets
  createPet: (unitId: number, data: Record<string, unknown>) =>
    request<import("../types").Pet>(`/unit/${unitId}/pet`, {
      method: "POST", body: JSON.stringify(data),
    }),
  updatePet: (id: number, data: Record<string, unknown>) =>
    request<import("../types").Pet>(`/pet/${id}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  deletePet: (id: number) =>
    request<{ ok: boolean }>(`/pet/${id}`, { method: "DELETE" }),

  // Documents
  deleteDocument: (id: number) =>
    request<{ ok: boolean }>(`/document/${id}`, { method: "DELETE" }),

  // -----------------------------------------------------------------------
  // Reservations
  // -----------------------------------------------------------------------
  getReservations: (tab = "churrasqueira", month?: number, year?: number, q?: string) => {
    const params = new URLSearchParams({ tab });
    if (month) params.set("month", String(month));
    if (year) params.set("year", String(year));
    if (q) params.set("q", q);
    return request<import("../types").ReservationsListData>(`/reservations?${params}`);
  },
  getReservation: (id: number) =>
    request<import("../types").ReservationDetail>(`/reservation/${id}`),
  getResidentsForUnit: (unitNumber: string) =>
    request<{ unit_id?: number; residents: { id: number; full_name: string }[]; error?: string }>(
      `/reservations/residents-for-unit?unit_number=${encodeURIComponent(unitNumber)}`
    ),
  createReservation: (data: Record<string, unknown>) =>
    request<import("../types").ReservationItem>("/reservations", {
      method: "POST", body: JSON.stringify(data),
    }),
  advanceReservation: (id: number) =>
    request<import("../types").ReservationItem>(`/reservation/${id}/advance`, { method: "POST" }),
  cancelReservation: (id: number, authorizedBy: string) =>
    request<import("../types").ReservationItem>(`/reservation/${id}/cancel`, {
      method: "POST", body: JSON.stringify({ authorized_by: authorizedBy }),
    }),

  // -----------------------------------------------------------------------
  // Finance
  // -----------------------------------------------------------------------
  getFinance: () =>
    request<import("../types").FinanceData>("/finance"),
  createFinancePayable: (data: Record<string, unknown>) =>
    request<import("../types").FinancePayable>("/finance", {
      method: "POST", body: JSON.stringify(data),
    }),
  updateFinancePayable: (id: number, data: Record<string, unknown>) =>
    request<import("../types").FinancePayable>(`/finance/${id}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  toggleFinancePayable: (id: number) =>
    request<import("../types").FinancePayable>(`/finance/${id}/toggle`, { method: "POST" }),
  deleteFinancePayable: (id: number) =>
    request<{ ok: boolean }>(`/finance/${id}`, { method: "DELETE" }),

  // -----------------------------------------------------------------------
  // Inventory
  // -----------------------------------------------------------------------
  getInventory: (q?: string, category?: string, location?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (location) params.set("location", location);
    const qs = params.toString();
    return request<import("../types").InventoryData>(`/inventory${qs ? `?${qs}` : ""}`);
  },
  createInventoryItem: (data: Record<string, unknown>) =>
    request<import("../types").InventoryItem>("/inventory", {
      method: "POST", body: JSON.stringify(data),
    }),
  updateInventoryItem: (id: number, data: Record<string, unknown>) =>
    request<import("../types").InventoryItem>(`/inventory/${id}`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  deleteInventoryItem: (id: number) =>
    request<{ ok: boolean }>(`/inventory/${id}`, { method: "DELETE" }),
  stockOperation: (id: number, op: "in" | "out") =>
    request<import("../types").InventoryItem>(`/inventory/${id}/stock/${op}`, { method: "POST" }),

  // -----------------------------------------------------------------------
  // Calendar
  // -----------------------------------------------------------------------
  getCalendar: (d?: string) =>
    request<import("../types").CalendarData>(`/calendar${d ? `?d=${d}` : ""}`),
  getCalendarDay: (d: string) =>
    request<import("../types").CalendarDayDetail>(`/calendar/day?d=${d}`),

  // -----------------------------------------------------------------------
  // System / Backup
  // -----------------------------------------------------------------------
  getSystemInfo: () =>
    request<import("../types").SystemInfo>("/system/info"),
  fixAllStatus: () =>
    request<{ ok: boolean; count: number }>("/system/fix-status", { method: "POST" }),

  // -----------------------------------------------------------------------
  // Settings
  // -----------------------------------------------------------------------
  getSettings: () =>
    request<import("../types").SystemSettings>("/settings"),
  updateSettings: (data: Record<string, unknown>) =>
    request<import("../types").SystemSettings>("/settings", {
      method: "PATCH", body: JSON.stringify(data),
    }),
};
