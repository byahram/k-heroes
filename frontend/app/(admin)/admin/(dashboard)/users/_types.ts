import type { MemberAuthProvider, MemberGrade } from "@/app/(admin)/_components/admin-badge";

export type { MemberAuthProvider, MemberGrade };

export type MemberListItem = {
  id: number;
  auth_provider: MemberAuthProvider;
  login_id: string | null;
  name: string | null;
  email: string | null;
  nickname: string | null;
  grade: MemberGrade;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type MemberClassSummary = {
  class_id: number;
  class_name: string;
  entry_code: string;
  is_active: boolean;
  joined_at: string | null;
};

export type MemberDetailItem = MemberListItem & {
  classes: MemberClassSummary[];
  play_session_summary: MemberPlaySessionSummary;
};

export type MemberPlaySessionSummary = {
  completed_count: number;
  average_history_score: number | null;
};

export type MemberPlaySessionItem = {
  id: string;
  character_name: string;
  scenario_title: string;
  scenario_sort_order: number | null;
  history_score: number;
  status: string;
  completed_at: string | null;
  created_at: string;
};

export type MemberPlaySessionListResponse = {
  items: MemberPlaySessionItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  summary: MemberPlaySessionSummary;
};

export const MEMBER_PLAY_SESSION_PAGE_SIZE = 5;

export type MemberGradeFilter = MemberGrade | "all";
export type MemberAuthProviderFilter = MemberAuthProvider | "all";

export type MemberListFilters = {
  grade: MemberGradeFilter;
  authProvider: MemberAuthProviderFilter;
  loginId: string;
  name: string;
  email: string;
};
