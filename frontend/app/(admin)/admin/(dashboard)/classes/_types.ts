export type AdminClassMember = {
  membership_id: number;
  user_id: number;
  login_id: string | null;
  name: string | null;
  nickname: string | null;
  joined_at: string;
  is_active: boolean;
};

export type AdminClassListItem = {
  id: number;
  teacher_user_id: number;
  teacher_login_id: string | null;
  teacher_name: string | null;
  teacher_email: string | null;
  name: string;
  entry_code: string;
  is_active: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminClassDetailItem = AdminClassListItem & {
  members: AdminClassMember[];
};

export type ClassActiveFilter = "all" | "active" | "inactive";

export type ClassListFilters = {
  isActive: ClassActiveFilter;
  teacherLoginId: string;
  name: string;
  entryCode: string;
};
