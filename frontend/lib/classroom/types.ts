export type ClassRoom = {
  id: number;
  teacher_user_id: number;
  name: string;
  entry_code: string;
  is_active: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
};

export type ClassMember = {
  membership_id: number;
  user_id: number;
  login_id: string | null;
  name: string | null;
  nickname: string | null;
  joined_at: string;
  is_active: boolean;
};

export type ClassRoomDetail = ClassRoom & {
  members: ClassMember[];
};

export type ClassActivitySummary = {
  total_students: number;
  participating_students: number;
  completed_sessions: number;
  average_history_score: number | null;
};

export type ClassPlaySessionRecord = {
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

export type ClassRoomListResponse = {
  items: ClassRoom[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type StudentClassItem = {
  membership_id: number;
  class_id: number;
  class_name: string;
  entry_code: string;
  joined_at: string;
  is_class_active: boolean;
};

export type StudentClassListResponse = {
  items: StudentClassItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type ClassPlaySessionListResponse = {
  items: ClassPlaySessionRecord[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export const STUDENT_CLASS_PAGE_SIZE = 5;
