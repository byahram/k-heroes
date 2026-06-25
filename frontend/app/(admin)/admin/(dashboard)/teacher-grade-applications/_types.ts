import type { TeacherGradeApplicationStatus } from "@/app/(admin)/_components/admin-badge";

export type TeacherGradeApplicationListItem = {
  id: number;
  user_id: number;
  user_login_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_grade: "student" | "teacher";
  school_name: string | null;
  status: TeacherGradeApplicationStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TeacherGradeApplicationStatusFilter = TeacherGradeApplicationStatus | "all";
