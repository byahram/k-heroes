import {
  MemberAuthProviderBadge,
  MemberGradeBadge,
} from "@/app/(admin)/_components/admin-badge";
import {
  AdminDataTable,
  AdminTableCell,
  AdminTableRow,
  type AdminTableColumn,
} from "@/app/(admin)/_components/admin-data-table";
import type { MemberListItem } from "@/app/(admin)/admin/(dashboard)/users/_types";

const columns: AdminTableColumn[] = [
  { key: "id", header: "ID", className: "w-16" },
  { key: "login_id", header: "아이디", className: "w-36" },
  { key: "name", header: "이름", className: "w-28" },
  { key: "email", header: "이메일", className: "w-48" },
  { key: "auth_provider", header: "가입", className: "w-24" },
  { key: "grade", header: "등급", className: "w-24" },
  { key: "created_at", header: "가입일", className: "w-32" },
];

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
});

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

type MemberTableProps = {
  members: MemberListItem[];
  errorMessage?: string;
  isLoading?: boolean;
  onRowClick: (member: MemberListItem) => void;
  onRetry?: () => void;
};

export function MemberTable({
  errorMessage,
  isLoading,
  members,
  onRetry,
  onRowClick,
}: MemberTableProps) {
  return (
    <AdminDataTable
      columns={columns}
      emptyMessage="등록된 회원이 없습니다."
      errorMessage={errorMessage}
      isEmpty={members.length === 0}
      isLoading={isLoading}
      loadingMessage="회원 목록을 불러오고 있습니다."
      onRetry={onRetry}
    >
      {members.map((member) => (
        <AdminTableRow key={member.id} onClick={() => onRowClick(member)}>
          <AdminTableCell className="text-[#8A847C]">{member.id}</AdminTableCell>
          <AdminTableCell className="max-w-36 truncate font-medium text-[#1A1714]">
            {member.login_id || "—"}
          </AdminTableCell>
          <AdminTableCell className="max-w-28 truncate">{member.name || "—"}</AdminTableCell>
          <AdminTableCell className="max-w-48 truncate text-[#6B6458]">
            {member.email || "—"}
          </AdminTableCell>
          <AdminTableCell>
            <MemberAuthProviderBadge authProvider={member.auth_provider} />
          </AdminTableCell>
          <AdminTableCell>
            <MemberGradeBadge grade={member.grade} />
          </AdminTableCell>
          <AdminTableCell className="text-[#8A847C]">{formatDate(member.created_at)}</AdminTableCell>
        </AdminTableRow>
      ))}
    </AdminDataTable>
  );
}
