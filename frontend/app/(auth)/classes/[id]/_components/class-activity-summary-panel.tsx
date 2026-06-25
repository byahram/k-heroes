"use client";

import { RotateCw } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { AuthButton } from "@/components/auth/auth-button";
import { cn } from "@/lib/utils/cn";
import type { ClassActivityDateFilters, ClassActivitySummary } from "@/app/(auth)/classes/[id]/_types";

const inputClassName = cn(
  "h-10 w-full rounded-lg border bg-white px-3 text-sm text-[#1A1714] outline-none transition",
  "placeholder:text-[#A39E94]",
  "focus:border-[#3D6B52] focus:ring-2 focus:ring-[#3D6B52]/15",
);

type ClassActivitySummaryPanelProps = {
  filters: ClassActivityDateFilters;
  isLoading?: boolean;
  onFiltersChange: Dispatch<SetStateAction<ClassActivityDateFilters>>;
  onRefresh: () => void;
  onReset: () => void;
  onSearch: () => void;
  summary: ClassActivitySummary;
};

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border px-4 py-3 text-center"
      style={{ borderColor: "rgba(42,66,50,0.1)", background: "rgba(42,66,50,0.03)" }}
    >
      <p className="text-lg font-semibold text-[#2A4232]">{value}</p>
      <p className="mt-1 text-xs text-[#8A847C]">{label}</p>
    </div>
  );
}

function formatAverageScore(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value)}점`;
}

export function ClassActivitySummaryPanel({
  filters,
  isLoading = false,
  onFiltersChange,
  onRefresh,
  onReset,
  onSearch,
  summary,
}: ClassActivitySummaryPanelProps) {
  const participatingLabel =
    summary.participating_students != null
      ? `${summary.participating_students}명`
      : "—";

  return (
    <section
      className="mb-6 rounded-xl border p-5 sm:p-6"
      style={{ borderColor: "rgba(42,66,50,0.12)", background: "rgba(253,250,244,0.8)" }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1A1714]">클래스 활동 요약</h2>
          <p className="mt-1 text-sm text-[#6B6458]">기간을 선택해 클래스 전체 활동을 확인할 수 있습니다.</p>
        </div>
        <button
          aria-label="클래스 활동 요약 새로고침"
          className="inline-flex h-10 w-10 items-center justify-center self-end rounded-lg border border-[rgba(42,66,50,0.18)] bg-white text-[#6B6458] transition hover:bg-[rgba(42,66,50,0.06)] hover:text-[#2A4232] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
          onClick={onRefresh}
          type="button"
        >
          <RotateCw aria-hidden="true" className={cn("size-4", isLoading && "animate-spin")} />
        </button>
      </div>

      <form
        className="mt-5 rounded-xl border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
        style={{ borderColor: "rgba(42,66,50,0.1)", background: "rgba(42,66,50,0.02)" }}
      >
        <p className="text-xs font-medium text-[#6B6458]">기간 검색</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
        <div className="mt-3 flex flex-wrap gap-2">
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

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="학생 수" value={`${summary.total_students}명`} />
        <SummaryStat label="참여 학생" value={participatingLabel} />
        <SummaryStat
          label="완료 기록"
          value={summary.completed_sessions != null ? `${summary.completed_sessions}건` : "—"}
        />
        <SummaryStat
          label="평균 역사 점수"
          value={formatAverageScore(summary.average_history_score)}
        />
      </div>
    </section>
  );
}
