import type { MemberAuthProvider, MemberGrade } from "@/app/(admin)/_components/admin-badge";

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

export type MemberGradeFilter = MemberGrade | "all";
export type MemberAuthProviderFilter = MemberAuthProvider | "all";

export type MemberListFilters = {
  grade: MemberGradeFilter;
  authProvider: MemberAuthProviderFilter;
  loginId: string;
  name: string;
  email: string;
};
