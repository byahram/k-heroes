import type { TeacherGradeApplicationListItem } from "@/app/(admin)/admin/(dashboard)/teacher-grade-applications/_types";
import { TeacherGradeApplicationStatusBadge } from "@/app/(admin)/_components/admin-badge";

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

type DetailRowProps = {
  label: string;
  value: string;
};

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="grid gap-1 border-b border-[#F0EBE3] py-3 sm:grid-cols-[120px_1fr]">
      <dt className="text-sm font-medium text-[#8A847C]">{label}</dt>
      <dd className="text-sm text-[#1A1714] break-all">{value}</dd>
    </div>
  );
}

type TeacherGradeApplicationPanelProps = {
  application: TeacherGradeApplicationListItem;
  reviewNote: string;
  onReviewNoteChange: (value: string) => void;
};

export function TeacherGradeApplicationPanel({
  application,
  onReviewNoteChange,
  reviewNote,
}: TeacherGradeApplicationPanelProps) {
  const isPending = application.status === "pending";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TeacherGradeApplicationStatusBadge status={application.status} />
        <span className="text-sm text-[#8A847C]">신청 ID {application.id}</span>
      </div>

      <dl>
        <DetailRow label="회원 ID" value={String(application.user_id)} />
        <DetailRow label="아이디" value={application.user_login_id || "—"} />
        <DetailRow label="이름" value={application.user_name || "—"} />
        <DetailRow label="이메일" value={application.user_email || "—"} />
        <DetailRow label="현재 등급" value={application.user_grade === "teacher" ? "지도자" : "학생"} />
        <DetailRow label="소속" value={application.school_name || "—"} />
        <DetailRow label="신청일" value={formatDateTime(application.created_at)} />
        {application.reviewed_at ? (
          <DetailRow label="검토일" value={formatDateTime(application.reviewed_at)} />
        ) : null}
        {application.review_note ? (
          <DetailRow label="검토 메모" value={application.review_note} />
        ) : null}
      </dl>

      {isPending ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#3A3530]" htmlFor="review_note">
            검토 메모 (선택)
          </label>
          <textarea
            className="min-h-28 w-full rounded-lg border border-[#D6D0C6] bg-white px-4 py-3 text-sm text-[#1A1714] outline-none transition focus:border-[#2A4232] focus:ring-2 focus:ring-[#2A4232]/10"
            id="review_note"
            maxLength={1000}
            onChange={(event) => onReviewNoteChange(event.target.value)}
            placeholder="승인 또는 반려 사유를 남길 수 있습니다."
            value={reviewNote}
          />
        </div>
      ) : null}
    </div>
  );
}
