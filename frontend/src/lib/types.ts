export type Kpi = {
  key: string;
  label_en: string;
  label_fa: string;
  value: number;
  unit: string;
  delta_pct: number;
  direction: "up" | "down" | "flat";
  good_when: "up" | "down";
  baseline: number | null;
  target: number | null;
};

export type Overview = {
  generated_at: string;
  hospital_name_en: string;
  hospital_name_fa: string;
  kpis: Kpi[];
  active_patients: number;
  beds_total: number;
  beds_occupied: number;
  open_alerts: number;
  pathway_adherence: number;
};

export type DepartmentLoad = {
  id: number;
  code: string;
  name_en: string;
  name_fa: string;
  kind: string;
  bed_capacity: number;
  staff_count: number;
  occupied_beds: number;
  occupancy_rate: number;
  admissions_today: number;
  discharges_today: number;
  avg_discharge_minutes: number;
  trend_pct: number;
};

export type SeriesPoint = {
  day: string;
  occupied: number;
  capacity: number;
  admissions: number;
  discharges: number;
  ed_arrivals: number;
  occupancy_rate: number;
};

export type ForecastPoint = { day: string; value: number; lower: number; upper: number };

export type Occupancy = {
  department_id: number | null;
  department_en: string;
  department_fa: string;
  capacity: number;
  history: SeriesPoint[];
  forecast: ForecastPoint[];
  trend_pct: number;
  peak_day: string | null;
  peak_value: number;
};

export type Alert = {
  id: number;
  severity: "good" | "warning" | "serious" | "critical";
  kind: string;
  title_en: string;
  title_fa: string;
  detail_en: string;
  detail_fa: string;
  metric: string;
  value: number;
  acknowledged: boolean;
  created_at: string;
  department_en: string | null;
  department_fa: string | null;
};

export type Patient = {
  id: number;
  mrn: string;
  name_en: string;
  name_fa: string;
  age: number;
  sex: string;
  bed: string;
  acuity: 1 | 2 | 3 | 4 | 5;
  status: string;
  diagnosis_en: string;
  diagnosis_fa: string;
  admitted_at: string;
  expected_discharge_at: string | null;
  risk_score: number;
  department_id: number;
  department_en: string;
  department_fa: string;
  pathway_en: string;
  pathway_fa: string;
  progress: number;
  current_step_en: string | null;
  current_step_fa: string | null;
  blocked: boolean;
  los_hours: number;
};

export type CaseStep = {
  id: number;
  position: number;
  status: "pending" | "active" | "done" | "blocked";
  name_en: string;
  name_fa: string;
  owner_role: "nurse" | "physician" | "manager";
  target_minutes: number;
  started_at: string | null;
  completed_at: string | null;
  assignee_name_en: string | null;
  assignee_name_fa: string | null;
  elapsed_minutes: number | null;
  overdue: boolean;
};

export type CareTeamMember = {
  user_id: number;
  name_en: string;
  name_fa: string;
  role_en: string;
  role_fa: string;
  avatar_hue: number;
};

export type Message = {
  id: number;
  author_id: number;
  author_name_en: string;
  author_name_fa: string;
  author_role: string;
  avatar_hue: number;
  body: string;
  kind: "note" | "request" | "decision" | "alert";
  created_at: string;
};

export type PatientDetail = Patient & {
  steps: CaseStep[];
  care_team: CareTeamMember[];
  messages: Message[];
};

export type PathwayStep = {
  id: number;
  position: number;
  name_en: string;
  name_fa: string;
  owner_role: "nurse" | "physician" | "manager";
  target_minutes: number;
};

export type Pathway = {
  id: number;
  code: string;
  name_en: string;
  name_fa: string;
  description_en: string;
  description_fa: string;
  target_hours: number;
  department_en: string | null;
  department_fa: string | null;
  steps: PathwayStep[];
  active_cases: number;
  adherence: number;
  avg_hours: number;
};

export type BoardCase = {
  patient_id: number;
  case_step_id: number;
  name_en: string;
  name_fa: string;
  mrn: string;
  bed: string;
  acuity: number;
  status: string;
  department_en: string;
  department_fa: string;
  elapsed_minutes: number;
};

export type BoardColumn = {
  step_id: number;
  position: number;
  name_en: string;
  name_fa: string;
  owner_role: "nurse" | "physician" | "manager";
  target_minutes: number;
  cases: BoardCase[];
};

export type Board = { pathway: Pathway; columns: BoardColumn[] };

export type Integration = {
  id: number;
  code: string;
  name_en: string;
  name_fa: string;
  kind: string;
  vendor: string;
  status: "connected" | "degraded" | "offline";
  protocol: string;
  latency_ms: number;
  records_per_day: number;
  last_sync_at: string;
};

export type ResourceRow = {
  department_id: number;
  name_en: string;
  name_fa: string;
  kind: string;
  capacity: number;
  current: number;
  peak_forecast: number;
  peak_rate: number;
  nurses_required: number;
  nurses_available: number;
  gap: number;
};

export type EmergencyLoad = {
  department_en: string;
  department_fa: string;
  history: { day: string; value: number }[];
  forecast: { day: string; value: number; lower: number; upper: number }[];
  trend_pct: number;
};

export type Seasonality = {
  average: number;
  weekdays: { index: number; label_en: string; label_fa: string; value: number; delta_pct: number }[];
};

export type RoiLine = {
  key: string;
  label_en: string;
  label_fa: string;
  value: number;
  detail_en: string;
  detail_fa: string;
};

export type RoiResult = {
  currency: string;
  lines: RoiLine[];
  annual_benefit: number;
  annual_cost: number;
  net_benefit: number;
  first_year_benefit: number;
  first_year_cost: number;
  roi_pct: number;
  steady_state_roi_pct: number;
  payback_months: number;
  bed_days_released: number;
  staff_hours_recovered: number;
  assumptions_en: string[];
  assumptions_fa: string[];
};
