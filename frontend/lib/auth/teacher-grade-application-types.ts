export type TeacherGradeApplicationStatus = "pending" | "approved" | "rejected";

export type TeacherGradeApplication = {
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

export const teacherGradeApplicationStatusLabels: Record<TeacherGradeApplicationStatus, string> = {
  pending: "검토 중",
  approved: "승인됨",
  rejected: "반려됨",
};
