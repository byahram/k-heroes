export type UserGrade = "student" | "teacher";
export type AuthProvider = "local" | "google";

export type UserProfile = {
  id: number;
  auth_provider: AuthProvider;
  login_id: string | null;
  name: string | null;
  email: string | null;
  nickname: string | null;
  grade: UserGrade;
  created_at: string;
  updated_at: string;
};

export type PlaySessionItem = {
  id: string;
  scenario_id: number | null;
  ending_id: number | null;
  character_name: string;
  scenario_title: string;
  scenario_sort_order: number | null;
  status: string;
  history_score: number;
  choices_path: string[];
  choices_history: boolean[];
  created_at: string;
  completed_at: string | null;
};

export type PlaySessionSummary = {
  completed_count: number;
  average_history_score: number | null;
};

export type PlaySessionListResponse = {
  items: PlaySessionItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  summary: PlaySessionSummary;
};

export const gradeLabels: Record<UserGrade, string> = {
  student: "학생",
  teacher: "지도자",
};

export const authProviderLabels: Record<AuthProvider, string> = {
  local: "일반 가입",
  google: "구글 계정",
};
