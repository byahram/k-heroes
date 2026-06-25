import { AdminStatusBadge } from "@/app/(admin)/_components/admin-badge";
import {
  AdminDataTable,
  AdminTableCell,
  AdminTableRow,
  type AdminTableColumn,
} from "@/app/(admin)/_components/admin-data-table";
import type { AdminClassListItem } from "@/app/(admin)/admin/(dashboard)/classes/_types";

const columns: AdminTableColumn[] = [
  { key: "id", header: "ID", className: "w-16" },
  { key: "name", header: "클래스 이름", className: "w-48" },
  { key: "entry_code", header: "입장코드", className: "w-40" },
  { key: "teacher_login_id", header: "지도자 아이디", className: "w-36" },
  { key: "teacher_name", header: "지도자 이름", className: "w-28" },
  { key: "member_count", header: "멤버", className: "w-20" },
  { key: "is_active", header: "상태", className: "w-24" },
  { key: "created_at", header: "생성일", className: "w-32" },
];

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
});

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

type ClassTableProps = {
  classes: AdminClassListItem[];
  errorMessage?: string;
  isLoading?: boolean;
  onRowClick: (classRoom: AdminClassListItem) => void;
  onRetry?: () => void;
};

export function ClassTable({
  classes,
  errorMessage,
  isLoading,
  onRetry,
  onRowClick,
}: ClassTableProps) {
  return (
    <AdminDataTable
      columns={columns}
      emptyMessage="등록된 클래스가 없습니다."
      errorMessage={errorMessage}
      isEmpty={classes.length === 0}
      isLoading={isLoading}
      loadingMessage="클래스 목록을 불러오고 있습니다."
      onRetry={onRetry}
    >
      {classes.map((classRoom) => (
        <AdminTableRow key={classRoom.id} onClick={() => onRowClick(classRoom)}>
          <AdminTableCell className="text-[#8A847C]">{classRoom.id}</AdminTableCell>
          <AdminTableCell className="max-w-48 truncate font-medium text-[#1A1714]">
            {classRoom.name}
          </AdminTableCell>
          <AdminTableCell className="max-w-40 truncate font-mono text-sm text-[#2A4232]">
            {classRoom.entry_code}
          </AdminTableCell>
          <AdminTableCell className="max-w-36 truncate">{classRoom.teacher_login_id || "—"}</AdminTableCell>
          <AdminTableCell className="max-w-28 truncate">{classRoom.teacher_name || "—"}</AdminTableCell>
          <AdminTableCell>{classRoom.member_count}</AdminTableCell>
          <AdminTableCell>
            <AdminStatusBadge isActive={classRoom.is_active} />
          </AdminTableCell>
          <AdminTableCell className="text-[#8A847C]">{formatDate(classRoom.created_at)}</AdminTableCell>
        </AdminTableRow>
      ))}
    </AdminDataTable>
  );
}
