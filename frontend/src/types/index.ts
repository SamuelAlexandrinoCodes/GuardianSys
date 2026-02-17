export interface TaskStep {
  id: number;
  task_id: number;
  title: string;
  done: boolean;
  sort_order: number;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  details: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  type: string;
  status: string;
  reminder_at: string | null;
  repeat: string;
  repeat_interval_days: number | null;
  color: string | null;
  in_agenda: boolean;
  notes: string | null;
  created_at: string | null;
  files_folder: string | null;
  order_index: number;
  steps: TaskStep[];
}

export interface Meeting {
  id: number;
  title: string;
  meeting_date: string;
  meeting_time: string | null;
  reminder_date: string | null;
  company: string | null;
  reason: string | null;
  notes: string | null;
  participants: string | null;
  description: string | null;
  start_time: string | null;
  location: string | null;
  created_at: string | null;
}

export interface Payable {
  id: number;
  description: string;
  subject: string | null;
  payee: string | null;
  amount: number;
  due_date: string;
  regularity: string;
  notify_days_before: number;
  barcode: string | null;
  status: string;
}

export interface OpenReservation {
  id: number;
  area_name: string;
  reservation_date: string;
  status: string;
  unit: { id: number; block: string; number: string } | null;
  resident: { id: number; full_name: string } | null;
}

export interface AdminConfig {
  condo_name: string;
  user_name: string | null;
}

export interface AdministrativoData {
  config: AdminConfig;
  today: string;
  tab: string;
  tasks_pending: Task[];
  tasks_completed: Task[];
  meetings: Meeting[];
  payables: Payable[];
  total_open: number;
  open_reservations: OpenReservation[];
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardStats {
  total_units: number;
  total_residents: number;
  owners: number;
  tenants: number;
  occupancy: number;
  demography: { kids: number; adults: number; seniors: number };
}

export interface BirthdayToday {
  name: string;
  age: number;
  unit_id: number;
  unit_number: string;
}

export interface BirthdayMonth {
  name: string;
  day: number;
  unit_id: number;
  unit_number: string;
}

export interface DashPayable {
  id: number;
  description: string;
  amount: number;
  due_date: string;
  payee: string | null;
  status: string;
}

export interface DashReservation {
  id: number;
  area_name: string;
  reservation_date: string;
  status: string;
  unit: { id: number; number: string; block: string };
  resident: { id: number; full_name: string } | null;
}

export interface DashTask {
  id: number;
  title: string;
  status: string;
  due_date: string | null;
}

export interface DashMeeting {
  id: number;
  title: string;
  meeting_date: string;
  meeting_time: string | null;
  reason: string | null;
  notes: string | null;
}

export interface DashboardData {
  config: AdminConfig;
  view_date: string;
  today: string;
  is_today: boolean;
  view_date_label: string;
  stats: DashboardStats;
  birthdays_today: BirthdayToday[];
  birthdays_month: BirthdayMonth[];
  payables_pending: DashPayable[];
  reservations_today: DashReservation[];
  tasks_pending: DashTask[];
  tasks_overdue: DashTask[];
  meetings_today: DashMeeting[];
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export interface UnitSummary {
  id: number;
  block: string;
  number: string;
  status: string;
  residents_count: number;
  head_of_household: string;
  is_occupied: boolean;
}

export interface UnitsListData {
  config: AdminConfig;
  units: UnitSummary[];
  total: number;
  occupied: number;
}

export interface Resident {
  id: number;
  unit_id: number;
  full_name: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  profile_type: string;
  photo_path: string | null;
  pool_access_expiry: string | null;
  is_active: boolean;
  observations: string | null;
  is_pcd: boolean;
  pcd_tag: string | null;
}

export interface Vehicle {
  id: number;
  unit_id: number;
  type: string;
  model: string;
  plate: string | null;
  tag: string | null;
}

export interface Pet {
  id: number;
  unit_id: number;
  name: string;
  breed: string;
  notes: string | null;
}

export interface UnitDocument {
  id: number;
  unit_id: number;
  filename: string;
  filepath: string;
  category: string;
  upload_date: string | null;
  reservation_id: number | null;
}

export interface UnitReservation {
  id: number;
  area_name: string;
  reservation_date: string;
  status: string;
}

export interface UnitDetailData {
  unit: { id: number; block: string; number: string; status: string };
  residents: Resident[];
  vehicles: Vehicle[];
  pets: Pet[];
  documents: UnitDocument[];
  reservations: UnitReservation[];
  nav: { prev_id: number | null; next_id: number | null };
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

export interface ReservationItem {
  id: number;
  unit_id: number;
  resident_id: number | null;
  area_name: string;
  reservation_date: string;
  status: string;
  cancelled_by: string | null;
  confirmed_at: string | null;
  created_at: string | null;
  unit: { id: number; number: string; block: string } | null;
  resident: { id: number; full_name: string } | null;
}

export interface ReservationDetail extends ReservationItem {
  documents: {
    id: number;
    filename: string;
    filepath: string;
    category: string;
    upload_date: string | null;
  }[];
}

export interface ReservationsListData {
  config: AdminConfig;
  reservations: ReservationItem[];
  active_tab: string;
  today: string;
}

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

export interface FinancePayable {
  id: number;
  description: string;
  subject: string | null;
  payee: string | null;
  amount: number;
  due_date: string;
  regularity: string;
  notify_days_before: number;
  barcode: string | null;
  status: string;
}

export interface FinanceMetrics {
  total_open: number;
  total_paid: number;
  count_open: number;
  count_paid: number;
  balance: number;
}

export interface FinanceData {
  config: AdminConfig;
  payables: FinancePayable[];
  metrics: FinanceMetrics;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  label_code: string | null;
  quantity: number;
  location: string | null;
  purchase_link: string | null;
  entry_date: string | null;
  write_off_date: string | null;
  last_updated: string | null;
}

export interface InventoryData {
  config: AdminConfig;
  items: InventoryItem[];
  categories: string[];
  locations: string[];
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  type: string;
  color: string;
  label: string;
}

export interface CalendarDay {
  day: number;
  in_month: boolean;
  is_today: boolean;
  date: string | null;
  events: CalendarEvent[];
}

export interface CalendarData {
  config: AdminConfig;
  year: number;
  month: number;
  month_label: string;
  today: string;
  grid: CalendarDay[];
  prev: string;
  next: string;
}

export interface CalendarDayDetail {
  date: string;
  day_label: string;
  reservations: {
    id: number;
    area_name: string;
    status: string;
    unit: { id: number; number: string };
    resident: { id: number; full_name: string } | null;
  }[];
  meetings: {
    id: number;
    title: string;
    meeting_time: string | null;
    reason: string | null;
    location: string | null;
  }[];
  payables: { id: number; description: string; amount: number }[];
  tasks: { id: number; title: string }[];
}

// ---------------------------------------------------------------------------
// System / Backup
// ---------------------------------------------------------------------------

export interface SystemInfo {
  config: {
    condo_name: string;
    backup_path: string | null;
  };
  db_size_bytes: number;
  storage_size_bytes: number;
  db_last_modified: string | null;
  counts: {
    units: number;
    residents: number;
    reservations: number;
    tasks: number;
    meetings: number;
    payables: number;
    inventory: number;
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface SystemSettings {
  id: number;
  condo_name: string;
  user_name: string | null;
  total_floors: number;
  units_per_floor: number;
  backup_path: string | null;
}
