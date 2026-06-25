import { TeacherGradeApplicationStatusBadge } from "@/app/(admin)/_components/admin-badge";
import {
  AdminDataTable,
  AdminTableCell,
  AdminTableRow,
  type AdminTableColumn,
} from "@/app/(admin)/_components/admin-data-table";
import type { TeacherGradeApplicationListItem } from "@/app/(admin)/admin/(dashboard)/teacher-grade-applications/_types";

const columns: AdminTableColumn[] = [
  { key: "id", header: "ID", className: "w-16" },
  { key: "user_login_id", header: "아이디", className: "w-36" },
  { key: "user_name", header: "이름", className: "w-28" },
  { key: "user_email", header: "이메일", className: "w-48" },
  { key: "school_name", header: "소속", className: "w-36" },
  { key: "status", header: "상태", className: "w-28" },
  { key: "created_at", header: "신청일", className: "w-36" },
];

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

type TeacherGradeApplicationTableProps = {
  applications: TeacherGradeApplicationListItem[];
  errorMessage?: string;
  isLoading?: boolean;
  onRowClick: (application: TeacherGradeApplicationListItem) => void;
  onRetry?: () => void;
};

export function TeacherGradeApplicationTable({
  applications,
  errorMessage,
  isLoading,
  onRetry,
  onRowClick,
}: TeacherGradeApplicationTableProps) {
  return (
    <AdminDataTable
      columns={columns}
      emptyMessage="지도자 등급 신청 내역이 없습니다."
      errorMessage={errorMessage}
      isEmpty={applications.length === 0}
      isLoading={isLoading}
      loadingMessage="신청 목록을 불러오고 있습니다."
      onRetry={onRetry}
    >
      {applications.map((application) => (
        <AdminTableRow key={application.id} onClick={() => onRowClick(application)}>
          <AdminTableCell className="text-[#8A847C]">{application.id}</AdminTableCell>
          <AdminTableCell className="max-w-36 truncate font-medium text-[#1A1714]">
            {application.user_login_id || "—"}
          </AdminTableCell>
          <AdminTableCell className="max-w-28 truncate">{application.user_name || "—"}</AdminTableCell>
          <AdminTableCell className="max-w-48 truncate text-[#6B6458]">
            {application.user_email || "—"}
          </AdminTableCell>
          <AdminTableCell className="max-w-36 truncate text-[#6B6458]">
            {application.school_name || "—"}
          </AdminTableCell>
          <AdminTableCell>
            <TeacherGradeApplicationStatusBadge status={application.status} />
          </AdminTableCell>
          <AdminTableCell className="whitespace-nowrap text-[#8A847C]">
            {formatDateTime(application.created_at)}
          </AdminTableCell>
        </AdminTableRow>
      ))}
    </AdminDataTable>
  );
}
