"use client";

import { ChevronDown, Download } from "lucide-react";
import { Fragment, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { ClassCharacterRecordStudentsDetail } from "@/app/(auth)/classes/[id]/_components/class-character-record-students-detail";
import { AuthButton } from "@/components/auth/auth-button";
import {
  ClassListPagination,
  type ClassListPageSize,
} from "@/components/classroom/class-list-pagination";
import { cn } from "@/lib/utils/cn";
import type {
  ClassCharacterRecordSummary,
  ClassCharacterRecordsFilters,
} from "@/app/(auth)/classes/[id]/_types";

const inputClassName = cn(
  "h-10 w-full rounded-lg border bg-white px-3 text-sm text-[#1A1714] outline-none transition",
  "placeholder:text-[#A39E94]",
  "focus:border-[#3D6B52] focus:ring-2 focus:ring-[#3D6B52]/15",
);

function formatScenarioTitle(record: ClassCharacterRecordSummary) {
  if (record.scenario_sort_order == null) {
    return record.scenario_title;
  }
  const prefix = String(record.scenario_sort_order + 1).padStart(2, "0");
  return `${prefix}·${record.scenario_title}`;
}

type ClassCharacterRecordsPanelProps = {
  classId: number;
  filters: ClassCharacterRecordsFilters;
  isEmptyClass?: boolean;
  isDownloading?: boolean;
  isLoading?: boolean;
  onDownload: () => void;
  onFiltersChange: Dispatch<SetStateAction<ClassCharacterRecordsFilters>>;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: ClassListPageSize) => void;
  onReset: () => void;
  onSearch: () => void;
  page: number;
  pageSize: ClassListPageSize;
  records: ClassCharacterRecordSummary[];
  submittedFilters: ClassCharacterRecordsFilters;
  total: number;
  totalPages: number;
};

export function ClassCharacterRecordsPanel({
  classId,
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
  records,
  submittedFilters,
  total,
  totalPages,
}: ClassCharacterRecordsPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpandedIds(new Set());
  }, [page, pageSize, submittedFilters]);

  const pageRecordIds = records.map((record) => record.id);
  const isAllExpanded =
    pageRecordIds.length > 0 && pageRecordIds.every((id) => expandedIds.has(id));

  function toggleExpanded(recordId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  }

  function toggleExpandAll() {
    if (isAllExpanded) {
      setExpandedIds((current) => {
        const next = new Set(current);
        pageRecordIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }

    setExpandedIds((current) => new Set([...current, ...pageRecordIds]));
  }

  return (
    <section
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: "rgba(42,66,50,0.12)", background: "rgba(253,250,244,0.8)" }}
    >
      <div className="border-b px-5 py-4" style={{ borderColor: "rgba(42,66,50,0.12)" }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1A1714]">인물 기록</h2>
            <p className="mt-1 text-sm text-[#6B6458]">
              인물·시나리오별 평균 역사 점수와 완료 학생 수를 확인할 수 있습니다. 행을 펼치면
              완료한 학생 목록을 볼 수 있습니다.
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
            <p className="text-xs font-medium text-[#6B6458]">인물 검색</p>
            <label className="block space-y-2">
              <span className="text-xs text-[#8A847C]">인물명</span>
              <input
                className={inputClassName}
                disabled={isLoading}
                onChange={(event) =>
                  onFiltersChange((current) => ({ ...current, characterName: event.target.value }))
                }
                placeholder="인물명으로 검색"
                type="search"
                value={filters.characterName}
                style={{ borderColor: "rgba(42,66,50,0.18)" }}
              />
            </label>
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
          인물 기록을 불러오는 중입니다.
        </div>
      ) : total === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-[#6B6458]">
          {isEmptyClass
            ? "아직 이 클래스에 참여한 학생이 없습니다."
            : "검색 조건에 맞는 인물 기록이 없습니다."}
        </div>
      ) : (
        <div className="overflow-x-auto px-5 pb-5">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F4F1EA] text-[#6B6458]">
              <tr>
                <th aria-hidden className="w-10 px-2 py-3" />
                <th className="px-4 py-3 font-medium">인물</th>
                <th className="px-4 py-3 font-medium">시나리오</th>
                <th className="px-4 py-3 font-medium">평균 역사 점수</th>
                <th className="px-4 py-3 font-medium">완료 학생</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const isExpanded = expandedIds.has(record.id);
                const canExpand = record.completed_student_count > 0;

                return (
                  <Fragment key={record.id}>
                    <tr
                      className={cn(
                        "border-t border-[rgba(42,66,50,0.08)]",
                        canExpand && "cursor-pointer transition hover:bg-[rgba(42,66,50,0.03)]",
                      )}
                      onClick={canExpand ? () => toggleExpanded(record.id) : undefined}
                    >
                      <td className="px-2 py-3 text-center">
                        <button
                          aria-expanded={isExpanded}
                          aria-label={`${record.character_name} 완료 학생 ${canExpand ? "펼치기" : "없음"}`}
                          className={cn(
                            "inline-flex size-7 items-center justify-center rounded-md transition",
                            canExpand
                              ? "text-[#6B6458] hover:bg-[rgba(42,66,50,0.08)]"
                              : "cursor-default text-[#C8C2B8]",
                          )}
                          disabled={!canExpand}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (canExpand) toggleExpanded(record.id);
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
                        {record.character_name}
                      </td>
                      <td className="px-4 py-3 text-[#6B6458]">
                        {formatScenarioTitle(record)}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#2A4232]">
                        {Math.round(record.average_history_score)}점
                      </td>
                      <td className="px-4 py-3 text-[#3A3530]">
                        {record.completed_student_count}/{record.total_student_count}명
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-t border-[rgba(42,66,50,0.08)] bg-[rgba(42,66,50,0.02)]">
                        <td colSpan={5} className="px-4 py-4">
                          <ClassCharacterRecordStudentsDetail
                            classId={classId}
                            dateFrom={submittedFilters.dateFrom}
                            dateTo={submittedFilters.dateTo}
                            enabled={isExpanded}
                            recordId={record.id}
                          />
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
