import { AdminStatusBadge } from "@/app/(admin)/_components/admin-badge";
import { useAdminClass } from "@/app/(admin)/_hooks/use-admin-classes";
import type { AdminClassMember } from "@/app/(admin)/admin/(dashboard)/classes/_types";

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
});

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

type DetailRowProps = {
  label: string;
  value: string;
};

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="grid gap-1 border-b border-[#F0EBE3] py-3 sm:grid-cols-[120px_1fr]">
      <dt className="text-sm font-medium text-[#8A847C]">{label}</dt>
      <dd className="break-all text-sm text-[#1A1714]">{value}</dd>
    </div>
  );
}

type MemberTableProps = {
  members: AdminClassMember[];
};

function MemberTable({ members }: MemberTableProps) {
  const activeMembers = members.filter((member) => member.is_active);

  if (activeMembers.length === 0) {
    return (
      <div className="rounded-lg border border-[#E8E4DC] bg-[#FAF8F4] px-4 py-10 text-center text-sm text-[#8A847C]">
        아직 이 클래스에 참여한 학생이 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#E8E4DC]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#F4F1EA] text-[#6B6458]">
            <tr>
              <th className="px-4 py-3 font-medium">아이디</th>
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">닉네임</th>
              <th className="px-4 py-3 font-medium">참여일</th>
            </tr>
          </thead>
          <tbody>
            {activeMembers.map((member) => (
              <tr key={member.membership_id} className="border-t border-[#F0EBE3]">
                <td className="px-4 py-3 font-medium text-[#1A1714]">
                  {member.login_id || "—"}
                </td>
                <td className="px-4 py-3 text-[#3A3530]">{member.name || "—"}</td>
                <td className="px-4 py-3 text-[#3A3530]">{member.nickname || "—"}</td>
                <td className="px-4 py-3 text-[#6B6458]">{formatDate(member.joined_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ClassPanelProps = {
  classId: number;
};

export function ClassPanel({ classId }: ClassPanelProps) {
  const classQuery = useAdminClass(classId);
  const classRoom = classQuery.data;

  if (classQuery.isPending) {
    return <p className="text-sm text-[#8A847C]">클래스 정보를 불러오는 중입니다.</p>;
  }

  if (classQuery.isError || !classRoom) {
    return (
      <p className="text-sm text-[#B45309]">클래스 정보를 불러오지 못했습니다.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <AdminStatusBadge isActive={classRoom.is_active} />
        <span className="text-sm text-[#8A847C]">클래스 ID {classRoom.id}</span>
      </div>

      <dl>
        <DetailRow label="클래스 이름" value={classRoom.name} />
        <DetailRow label="입장코드" value={classRoom.entry_code} />
        <DetailRow label="멤버 수" value={`${classRoom.member_count}명`} />
        <DetailRow label="지도자 ID" value={String(classRoom.teacher_user_id)} />
        <DetailRow label="지도자 아이디" value={classRoom.teacher_login_id || "—"} />
        <DetailRow label="지도자 이름" value={classRoom.teacher_name || "—"} />
        <DetailRow label="지도자 이메일" value={classRoom.teacher_email || "—"} />
        <DetailRow label="생성일" value={formatDateTime(classRoom.created_at)} />
        <DetailRow label="수정일" value={formatDateTime(classRoom.updated_at)} />
      </dl>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[#1A1714]">학생 목록</h3>
        <MemberTable members={classRoom.members} />
      </section>
    </div>
  );
}
