import { AdminStatusBadge } from "@/app/(admin)/_components/admin-badge";
import { MemberPanelCollapsibleSection } from "@/app/(admin)/admin/(dashboard)/users/_components/member-panel-collapsible-section";
import type { MemberClassSummary, MemberGrade } from "@/app/(admin)/admin/(dashboard)/users/_types";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
});

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

type MemberClassSectionProps = {
  classes: MemberClassSummary[];
  errorMessage?: string | null;
  grade: MemberGrade;
  isLoading?: boolean;
  total?: number;
};

export function MemberClassSection({
  classes,
  errorMessage = null,
  grade,
  isLoading = false,
  total,
}: MemberClassSectionProps) {
  const title = grade === "teacher" ? "보유 클래스" : "소속 클래스";
  const count = total ?? classes.length;
  const meta = isLoading ? "불러오는 중..." : `${count}개`;

  return (
    <MemberPanelCollapsibleSection meta={meta} title={title}>
      {errorMessage ? (
        <p className="rounded-lg border border-[#E6C9C5] bg-[#FDF6F5] px-4 py-3 text-sm text-[#9A3F38]">
          {errorMessage}
        </p>
      ) : isLoading ? (
        <p className="text-sm text-[#8A847C]">클래스 정보를 불러오는 중입니다.</p>
      ) : classes.length === 0 ? (
        <p className="rounded-lg border border-[#E8E4DC] bg-[#FAF8F4] px-4 py-8 text-center text-sm text-[#8A847C]">
          {grade === "teacher" ? "생성한 클래스가 없습니다." : "가입한 클래스가 없습니다."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E8E4DC]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#FAF8F4] text-left text-[#8A847C]">
              <tr>
                <th className="px-4 py-3 font-medium">클래스</th>
                <th className="px-4 py-3 font-medium">입장코드</th>
                <th className="px-4 py-3 font-medium">상태</th>
                {grade === "student" ? (
                  <th className="px-4 py-3 font-medium">가입일</th>
                ) : (
                  <th className="px-4 py-3 font-medium">클래스 ID</th>
                )}
              </tr>
            </thead>
            <tbody>
              {classes.map((classItem) => (
                <tr key={classItem.class_id} className="border-t border-[#F0EBE3]">
                  <td className="px-4 py-3 font-medium text-[#1A1714]">{classItem.class_name}</td>
                  <td className="px-4 py-3 font-mono tracking-wide text-[#2A4232]">
                    {classItem.entry_code}
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge isActive={classItem.is_active} />
                  </td>
                  <td className="px-4 py-3 text-[#6B6458]">
                    {grade === "student"
                      ? formatDate(classItem.joined_at)
                      : String(classItem.class_id)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MemberPanelCollapsibleSection>
  );
}
