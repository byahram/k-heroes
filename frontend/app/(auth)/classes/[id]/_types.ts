export type ClassDetailTab = "students" | "student-sessions" | "character-records" | "records";

export type ClassActivityDateFilters = {
  dateFrom: string;
  dateTo: string;
};

export const emptyClassActivityDateFilters: ClassActivityDateFilters = {
  dateFrom: "",
  dateTo: "",
};

export type ClassStudentListFilters = {
  name: string;
  nickname: string;
};

export const emptyClassStudentListFilters: ClassStudentListFilters = {
  name: "",
  nickname: "",
};

export type ClassStudentSessionsFilters = ClassStudentListFilters & ClassActivityDateFilters;

export const emptyClassStudentSessionsFilters: ClassStudentSessionsFilters = {
  ...emptyClassStudentListFilters,
  ...emptyClassActivityDateFilters,
};

export type ClassCharacterRecordsFilters = ClassActivityDateFilters & {
  characterName: string;
};

export const emptyClassCharacterRecordsFilters: ClassCharacterRecordsFilters = {
  ...emptyClassActivityDateFilters,
  characterName: "",
};

export type ClassCharacterRecordSummary = {
  id: string;
  character_name: string;
  scenario_title: string;
  scenario_sort_order: number | null;
  average_history_score: number;
  completed_student_count: number;
  total_student_count: number;
};

export type ClassCharacterRecordStudent = {
  user_id: number;
  login_id: string | null;
  name: string | null;
  nickname: string | null;
  history_score: number;
  completed_at: string | null;
};

export type ClassActivitySummary = {
  total_students: number;
  participating_students: number | null;
  completed_sessions: number | null;
  average_history_score: number | null;
};

export type ClassStudentPlayRecord = {
  id: string;
  student_login_id: string | null;
  student_name: string | null;
  student_nickname: string | null;
  character_name: string;
  scenario_title: string;
  scenario_sort_order: number | null;
  history_score: number;
  completed_at: string | null;
};

export type ClassStudentSessionSummary = {
  membership_id: number;
  user_id: number;
  login_id: string | null;
  name: string | null;
  nickname: string | null;
  joined_at: string;
  completed_count: number;
  average_history_score: number | null;
  latest_completed_at: string | null;
  sessions: ClassStudentPlayRecord[];
};

export const CLASS_STUDENT_PAGE_SIZE = 10;
export const CLASS_STUDENT_SESSIONS_PAGE_SIZE = 10;
export const CLASS_CHARACTER_RECORD_PAGE_SIZE = 10;
export const CLASS_RECORD_PAGE_SIZE = 10;
