"use client";

import { ChevronDown, Download } from "lucide-react";
import { Fragment, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { AuthButton } from "@/components/auth/auth-button";
import {
  ClassListPagination,
  type ClassListPageSize,
} from "@/components/classroom/class-list-pagination";
import { cn } from "@/lib/utils/cn";
import type {
  ClassStudentPlayRecord,
  ClassStudentSessionSummary,
  ClassStudentSessionsFilters,
} from "@/app/(auth)/classes/[id]/_types";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const inputClassName = cn(
  "h-10 w-full rounded-lg border bg-white px-3 text-sm text-[#1A1714] outline-none transition",
  "placeholder:text-[#A39E94]",
  "focus:border-[#3D6B52] focus:ring-2 focus:ring-[#3D6B52]/15",
);

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

function formatScenarioTitle(session: ClassStudentPlayRecord) {
  if (session.scenario_sort_order == null) {
    return session.scenario_title;
  }
  const prefix = String(session.scenario_sort_order + 1).padStart(2, "0");
  return `${prefix}·${session.scenario_title}`;
}

type ClassStudentSessionsPanelProps = {
  filters: ClassStudentSessionsFilters;
  isEmptyClass?: boolean;
  isDownloading?: boolean;
  isLoading?: boolean;
  onDownload: () => void;
  onFiltersChange: Dispatch<SetStateAction<ClassStudentSessionsFilters>>;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: ClassListPageSize) => void;
  onReset: () => void;
  onSearch: () => void;
  page: number;
  pageSize: ClassListPageSize;
  students: ClassStudentSessionSummary[];
  submittedFilters: ClassStudentSessionsFilters;
  total: number;
  totalPages: number;
};

export function ClassStudentSessionsPanel({
  filters,
  isEmptyClass = false,
  isDownloading = false,
  isLoading = false,
  onDownload,
  onFiltersChange,
  onPageChange,
  onPageSizeChange,
  onReset,
  onSearch,
  page,
  pageSize,
  students,
  submittedFilters,
  total,
  totalPages,
}: ClassStudentSessionsPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setExpandedIds(new Set());
  }, [page, pageSize, submittedFilters]);

  const pageMembershipIds = students.map((student) => student.membership_id);
  const isAllExpanded =
    pageMembershipIds.length > 0 && pageMembershipIds.every((id) => expandedIds.has(id));

  function toggleExpanded(membershipId: number) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(membershipId)) {
        next.delete(membershipId);
      } else {
        next.add(membershipId);
      }
      return next;
    });
  }

  function toggleExpandAll() {
    if (isAllExpanded) {
      setExpandedIds((current) => {
        const next = new Set(current);
        pageMembershipIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }

    setExpandedIds((current) => new Set([...current, ...pageMembershipIds]));
  }

  return (
    <section
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: "rgba(42,66,50,0.12)", background: "rgba(253,250,244,0.8)" }}
    >
      <div className="border-b px-5 py-4" style={{ borderColor: "rgba(42,66,50,0.12)" }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1A1714]">학생별 기록</h2>
            <p className="mt-1 text-sm text-[#6B6458]">
              학생별 완료 건수와 평균 역사 점수를 확인할 수 있습니다. 행을 펼치면 시뮬레이션
              기록을 볼 수 있습니다.
            </p>
          </div>
          <AuthButton
            className="h-9 w-auto shrink-0 whitespace-nowrap gap-1.5 self-start px-3 text-sm"
            disabled={isDownloading}
            onClick={onDownload}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Download aria-hidden="true" className="size-4" />
            {isDownloading ? "다운로드 중..." : "엑셀 다운로드"}
          </AuthButton>
        </div>
      </div>

      <div className="border-b px-5 py-4" style={{ borderColor: "rgba(42,66,50,0.08)" }}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
        >
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#6B6458]">기간 검색</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-xs text-[#8A847C]">완료일 시작</span>
                <input
                  className={inputClassName}
                  disabled={isLoading}
                  onChange={(event) =>
                    onFiltersChange((current) => ({ ...current, dateFrom: event.target.value }))
                  }
                  type="date"
                  value={filters.dateFrom}
                  style={{ borderColor: "rgba(42,66,50,0.18)" }}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs text-[#8A847C]">완료일 종료</span>
                <input
                  className={inputClassName}
                  disabled={isLoading}
                  onChange={(event) =>
                    onFiltersChange((current) => ({ ...current, dateTo: event.target.value }))
                  }
                  type="date"
                  value={filters.dateTo}
                  style={{ borderColor: "rgba(42,66,50,0.18)" }}
                />
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-[#6B6458]">학생 검색</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-xs text-[#8A847C]">이름</span>
                <input
                  className={inputClassName}
                  disabled={isLoading}
                  onChange={(event) =>
                    onFiltersChange((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="이름으로 검색"
                  type="search"
                  value={filters.name}
                  style={{ borderColor: "rgba(42,66,50,0.18)" }}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs text-[#8A847C]">닉네임</span>
                <input
                  className={inputClassName}
                  disabled={isLoading}
                  onChange={(event) =>
                    onFiltersChange((current) => ({ ...current, nickname: event.target.value }))
                  }
                  placeholder="닉네임으로 검색"
                  type="search"
                  value={filters.nickname}
                  style={{ borderColor: "rgba(42,66,50,0.18)" }}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <AuthButton className="h-10 w-auto min-w-[88px] px-4" disabled={isLoading} type="submit">
              검색
            </AuthButton>
            <AuthButton
              className="h-10 w-auto min-w-[88px] px-4"
              disabled={isLoading}
              onClick={onReset}
              type="button"
              variant="secondary"
            >
              초기화
            </AuthButton>
          </div>
        </form>
      </div>

      <div className="px-5 pt-4 pb-2">
        <ClassListPagination
          disabled={isLoading}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
        />
      </div>

      {total > 0 ? (
        <div className="flex justify-end px-5 pb-3">
          <AuthButton
            className="h-9 w-auto px-3 text-sm"
            disabled={isLoading}
            onClick={toggleExpandAll}
            size="sm"
            type="button"
            variant="secondary"
          >
            {isAllExpanded ? "전체 접기" : "전체 펼치기"}
          </AuthButton>
        </div>
      ) : null}

      {isLoading && total === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-[#6B6458]">
          학생별 기록을 불러오는 중입니다.
        </div>
      ) : total === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-[#6B6458]">
          {isEmptyClass
            ? "아직 이 클래스에 참여한 학생이 없습니다."
            : "검색 조건에 맞는 학생이 없습니다."}
        </div>
      ) : (
        <div className="overflow-x-auto px-5 pb-5">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F4F1EA] text-[#6B6458]">
              <tr>
                <th aria-hidden className="w-10 px-2 py-3" />
                <th className="px-4 py-3 font-medium">아이디</th>
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">닉네임</th>
                <th className="px-4 py-3 font-medium">참여일</th>
                <th className="px-4 py-3 font-medium">완료</th>
                <th className="px-4 py-3 font-medium">평균 역사 점수</th>
                <th className="px-4 py-3 font-medium">최근 완료</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const isExpanded = expandedIds.has(student.membership_id);
                const averageScore =
                  student.average_history_score != null
                    ? Math.round(student.average_history_score)
                    : null;

                return (
                  <Fragment key={student.membership_id}>
                    <tr
                      className="cursor-pointer border-t border-[rgba(42,66,50,0.08)] transition hover:bg-[rgba(42,66,50,0.03)]"
                      onClick={() => toggleExpanded(student.membership_id)}
                    >
                      <td className="px-2 py-3 text-center">
                        <button
                          aria-expanded={isExpanded}
                          aria-label={`${student.name || student.login_id || "학생"} 기록 펼치기`}
                          className="inline-flex size-7 items-center justify-center rounded-md text-[#6B6458] transition hover:bg-[rgba(42,66,50,0.08)]"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleExpanded(student.membership_id);
                          }}
                          type="button"
                        >
                          <ChevronDown
                            aria-hidden
                            className={cn(
                              "size-4 transition-transform",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-[#1A1714]">
                        {student.login_id || "—"}
                      </td>
                      <td className="px-4 py-3 text-[#3A3530]">{student.name?.trim() || "—"}</td>
                      <td className="px-4 py-3 text-[#3A3530]">
                        {student.nickname?.trim() || "—"}
                      </td>
                      <td className="px-4 py-3 text-[#8A847C]">{formatDate(student.joined_at)}</td>
                      <td className="px-4 py-3 text-[#3A3530]">{student.completed_count}건</td>
                      <td className="px-4 py-3 font-medium text-[#2A4232]">
                        {averageScore != null ? `${averageScore}점` : "—"}
                      </td>
                      <td className="px-4 py-3 text-[#8A847C]">
                        {formatDate(student.latest_completed_at)}
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-t border-[rgba(42,66,50,0.08)] bg-[rgba(42,66,50,0.02)]">
                        <td colSpan={8} className="px-4 py-4">
                          {student.sessions.length === 0 ? (
                            <p className="text-sm text-[#8A847C]">
                              선택한 기간에 완료한 시뮬레이션이 없습니다.
                            </p>
                          ) : (
                            <div className="overflow-x-auto rounded-lg border border-[rgba(42,66,50,0.1)] bg-white">
                              <table className="min-w-full text-left text-sm">
                                <thead className="bg-[#F4F1EA] text-[#6B6458]">
                                  <tr>
                                    <th className="px-3 py-2.5 font-medium">인물</th>
                                    <th className="px-3 py-2.5 font-medium">시나리오</th>
                                    <th className="px-3 py-2.5 font-medium">역사 점수</th>
                                    <th className="px-3 py-2.5 font-medium">완료일</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {student.sessions.map((session) => (
                                    <tr
                                      key={session.id}
                                      className="border-t border-[rgba(42,66,50,0.08)]"
                                    >
                                      <td className="px-3 py-2.5 font-medium text-[#1A1714]">
                                        {session.character_name}
                                      </td>
                                      <td className="px-3 py-2.5 text-[#6B6458]">
                                        {formatScenarioTitle(session)}
                                      </td>
                                      <td className="px-3 py-2.5 text-[#2A4232]">
                                        {session.history_score}점
                                      </td>
                                      <td className="px-3 py-2.5 text-[#8A847C]">
                                        {formatDateTime(session.completed_at)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
