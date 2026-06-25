"use client";

import { Download } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { AuthButton } from "@/components/auth/auth-button";
import {
  ClassListPagination,
  type ClassListPageSize,
} from "@/components/classroom/class-list-pagination";
import { cn } from "@/lib/utils/cn";
import type {
  ClassStudentPlayRecord,
  ClassStudentSessionsFilters,
} from "@/app/(auth)/classes/[id]/_types";

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const inputClassName = cn(
  "h-10 w-full rounded-lg border bg-white px-3 text-sm text-[#1A1714] outline-none transition",
  "placeholder:text-[#A39E94]",
  "focus:border-[#3D6B52] focus:ring-2 focus:ring-[#3D6B52]/15",
);

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

function formatStudentLabel(record: ClassStudentPlayRecord) {
  const loginId = record.student_login_id?.trim();
  const name = record.student_name?.trim();
  const nickname = record.student_nickname?.trim();
  const detailParts = [loginId, name].filter((value): value is string => Boolean(value));

  if (nickname && detailParts.length > 0) {
    return `${nickname} (${detailParts.join(", ")})`;
  }
  if (nickname) return nickname;
  if (detailParts.length > 0) return detailParts.join(", ");
  return "—";
}

function formatScenarioTitle(record: ClassStudentPlayRecord) {
  if (record.scenario_sort_order == null) {
    return record.scenario_title;
  }
  const prefix = String(record.scenario_sort_order + 1).padStart(2, "0");
  return `${prefix} · ${record.scenario_title}`;
}

type ClassRecordsPanelProps = {
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
  records: ClassStudentPlayRecord[];
  total: number;
  totalPages: number;
};

export function ClassRecordsPanel({
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
  total,
  totalPages,
}: ClassRecordsPanelProps) {
  return (
    <section
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: "rgba(42,66,50,0.12)", background: "rgba(253,250,244,0.8)" }}
    >
      <div className="border-b px-5 py-4" style={{ borderColor: "rgba(42,66,50,0.12)" }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1A1714]">시뮬레이션 기록</h2>
            <p className="mt-1 text-sm text-[#6B6458]">
              이 클래스 학생들의 완료 기록을 최신순으로 보여 줍니다.
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

      <div className="px-5 pt-4">
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

      {isLoading ? (
        <div className="px-5 py-12 text-center text-sm text-[#6B6458]">
          시뮬레이션 기록을 불러오는 중입니다.
        </div>
      ) : total === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-[#6B6458]">
          {isEmptyClass
            ? "아직 이 클래스에 참여한 학생이 없습니다."
            : "검색 조건에 맞는 시뮬레이션 기록이 없습니다."}
        </div>
      ) : (
        <div className="overflow-x-auto px-5 pb-5">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F4F1EA] text-[#6B6458]">
              <tr>
                <th className="px-4 py-3 font-medium">학생</th>
                <th className="px-4 py-3 font-medium">인물</th>
                <th className="px-4 py-3 font-medium">시나리오</th>
                <th className="px-4 py-3 font-medium">역사 점수</th>
                <th className="px-4 py-3 font-medium">완료일</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-t border-[rgba(42,66,50,0.08)]">
                  <td className="px-4 py-3 font-medium text-[#1A1714]">
                    {formatStudentLabel(record)}
                  </td>
                  <td className="px-4 py-3 text-[#3A3530]">{record.character_name}</td>
                  <td className="px-4 py-3 text-[#6B6458]">{formatScenarioTitle(record)}</td>
                  <td className="px-4 py-3 font-medium text-[#2A4232]">{record.history_score}점</td>
                  <td className="px-4 py-3 text-[#8A847C]">
                    {formatDateTime(record.completed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
