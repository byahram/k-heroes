import { MemberPanelCollapsibleSection } from "@/app/(admin)/admin/(dashboard)/users/_components/member-panel-collapsible-section";
import type {
  MemberPlaySessionItem,
  MemberPlaySessionSummary,
} from "@/app/(admin)/admin/(dashboard)/users/_types";
import { MEMBER_PLAY_SESSION_PAGE_SIZE } from "@/app/(admin)/admin/(dashboard)/users/_types";
import { PagePagination } from "@/components/ui/page-pagination";

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

function formatScenarioTitle(session: MemberPlaySessionItem) {
  if (session.scenario_sort_order == null) {
    return session.scenario_title;
  }
  const prefix = String(session.scenario_sort_order + 1).padStart(2, "0");
  return `${prefix} · ${session.scenario_title}`;
}

function formatSummaryMeta(summary: MemberPlaySessionSummary | null, isLoading: boolean) {
  if (isLoading) return "불러오는 중...";
  if (!summary) return "0건";

  const averageScore =
    summary.average_history_score != null
      ? Math.round(summary.average_history_score)
      : null;

  if (averageScore != null) {
    return `완료 ${summary.completed_count}건 · 평균 ${averageScore}점`;
  }

  return `완료 ${summary.completed_count}건`;
}

type MemberPlaySessionSectionProps = {
  currentPage: number;
  errorMessage?: string | null;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  sessions: MemberPlaySessionItem[];
  summary: MemberPlaySessionSummary | null;
  total: number;
  totalPages: number;
};

export function MemberPlaySessionSection({
  currentPage,
  errorMessage = null,
  isLoading = false,
  onPageChange,
  sessions,
  summary,
  total,
  totalPages,
}: MemberPlaySessionSectionProps) {
  return (
    <MemberPanelCollapsibleSection
      meta={formatSummaryMeta(summary, isLoading)}
      title="시뮬레이션 기록"
    >
      {errorMessage ? (
        <p className="rounded-lg border border-[#E6C9C5] bg-[#FDF6F5] px-4 py-3 text-sm text-[#9A3F38]">
          {errorMessage}
        </p>
      ) : isLoading ? (
        <p className="text-sm text-[#8A847C]">시뮬레이션 기록을 불러오는 중입니다.</p>
      ) : total === 0 ? (
        <p className="rounded-lg border border-[#E8E4DC] bg-[#FAF8F4] px-4 py-8 text-center text-sm text-[#8A847C]">
          완료한 시뮬레이션이 없습니다.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[#E8E4DC]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#FAF8F4] text-left text-[#8A847C]">
                <tr>
                  <th className="px-4 py-3 font-medium">인물</th>
                  <th className="px-4 py-3 font-medium">시나리오</th>
                  <th className="px-4 py-3 font-medium">역사 점수</th>
                  <th className="px-4 py-3 font-medium">완료일</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="border-t border-[#F0EBE3]">
                    <td className="px-4 py-3 font-medium text-[#1A1714]">
                      {session.character_name}
                    </td>
                    <td className="px-4 py-3 text-[#6B6458]">
                      {formatScenarioTitle(session)}
                    </td>
                    <td className="px-4 py-3 text-[#2A4232]">{session.history_score}점</td>
                    <td className="px-4 py-3 text-[#6B6458]">
                      {formatDateTime(session.completed_at ?? session.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PagePagination
            alwaysShow={totalPages > 1}
            onPageChange={(nextPage) => onPageChange(nextPage)}
            page={currentPage}
            pageSize={MEMBER_PLAY_SESSION_PAGE_SIZE}
            total={total}
          />
        </>
      )}
    </MemberPanelCollapsibleSection>
  );
}
