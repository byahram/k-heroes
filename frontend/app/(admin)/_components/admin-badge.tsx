import { cn } from "@/lib/utils/cn";

export type AdminRole = "superadmin" | "admin" | "partner";

const roleLabels: Record<AdminRole, string> = {
  superadmin: "최고 관리자",
  admin: "관리자",
  partner: "파트너",
};

const roleStyles: Record<AdminRole, string> = {
  superadmin: "bg-[#2A4232] text-white",
  admin: "bg-[#E8F0EB] text-[#2A4232]",
  partner: "bg-[#F4F1EA] text-[#6B6560]",
};

type AdminRoleBadgeProps = {
  role: AdminRole;
  className?: string;
};

export function AdminRoleBadge({ className, role }: AdminRoleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        roleStyles[role],
        className,
      )}
    >
      {roleLabels[role]}
    </span>
  );
}

type AdminStatusBadgeProps = {
  isActive: boolean;
  className?: string;
};

export function AdminStatusBadge({ className, isActive }: AdminStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        isActive ? "bg-[#E8F0EB] text-[#2A4232]" : "bg-[#F4F1EA] text-[#8A847C]",
        className,
      )}
    >
      {isActive ? "활성" : "비활성"}
    </span>
  );
}

export type TeacherGradeApplicationStatus = "pending" | "approved" | "rejected";

const teacherGradeApplicationStatusLabels: Record<TeacherGradeApplicationStatus, string> = {
  pending: "검토 대기",
  approved: "승인",
  rejected: "반려",
};

const teacherGradeApplicationStatusStyles: Record<TeacherGradeApplicationStatus, string> = {
  pending: "bg-[#FFF7E6] text-[#9A6B00]",
  approved: "bg-[#E8F0EB] text-[#2A4232]",
  rejected: "bg-[#FDF6F5] text-[#9A3F38]",
};

type TeacherGradeApplicationStatusBadgeProps = {
  status: TeacherGradeApplicationStatus;
  className?: string;
};

export function TeacherGradeApplicationStatusBadge({
  className,
  status,
}: TeacherGradeApplicationStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        teacherGradeApplicationStatusStyles[status],
        className,
      )}
    >
      {teacherGradeApplicationStatusLabels[status]}
    </span>
  );
}

export type MemberGrade = "student" | "teacher";
export type MemberAuthProvider = "local" | "google";

const memberGradeLabels: Record<MemberGrade, string> = {
  student: "학생",
  teacher: "지도자",
};

const memberGradeStyles: Record<MemberGrade, string> = {
  student: "bg-[#F4F1EA] text-[#6B6458]",
  teacher: "bg-[#E8F0EB] text-[#2A4232]",
};

type MemberGradeBadgeProps = {
  grade: MemberGrade;
  className?: string;
};

export function MemberGradeBadge({ className, grade }: MemberGradeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        memberGradeStyles[grade],
        className,
      )}
    >
      {memberGradeLabels[grade]}
    </span>
  );
}

const memberAuthProviderLabels: Record<MemberAuthProvider, string> = {
  local: "일반",
  google: "구글",
};

const memberAuthProviderStyles: Record<MemberAuthProvider, string> = {
  local: "bg-[#F4F1EA] text-[#6B6458]",
  google: "bg-[#EEF3FB] text-[#3A4F6B]",
};

type MemberAuthProviderBadgeProps = {
  authProvider: MemberAuthProvider;
  className?: string;
};

export function MemberAuthProviderBadge({ authProvider, className }: MemberAuthProviderBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        memberAuthProviderStyles[authProvider],
        className,
      )}
    >
      {memberAuthProviderLabels[authProvider]}
    </span>
  );
}
