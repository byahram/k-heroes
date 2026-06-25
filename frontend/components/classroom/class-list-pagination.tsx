"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export type ClassListPageSize = 10 | 20 | 50 | 100;

const pageSizes: ClassListPageSize[] = [10, 20, 50, 100];

type ClassListPaginationProps = {
  page: number;
  pageSize: ClassListPageSize;
  total: number;
  totalPages: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: ClassListPageSize) => void;
};

export function ClassListPagination({
  disabled = false,
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  total,
  totalPages,
}: ClassListPaginationProps) {
  const displayTotalPages = Math.max(totalPages, 1);

  if (total === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: "rgba(42,66,50,0.12)", background: "rgba(253,250,244,0.8)" }}
    >
      <p className="text-sm text-[#6B6458]">총 {total.toLocaleString("ko-KR")}개</p>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        <label className="flex items-center gap-2 text-sm text-[#6B6458]">
          페이지당
          <select
            aria-label="페이지당 항목 수"
            className="h-9 rounded-lg border border-[rgba(42,66,50,0.18)] bg-white px-3 text-sm text-[#1A1714] outline-none focus:border-[#2A4232] focus:ring-2 focus:ring-[#2A4232]/10"
            disabled={disabled}
            onChange={(event) => onPageSizeChange(Number(event.target.value) as ClassListPageSize)}
            value={pageSize}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}개
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            aria-label="이전 페이지"
            className="flex size-9 items-center justify-center rounded-lg border border-[rgba(42,66,50,0.18)] bg-white text-[#3A3530] transition hover:bg-[#F4F1EA] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || page <= 0}
            onClick={() => onPageChange(page - 1)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <span className="min-w-20 text-center text-sm text-[#6B6458]">
            {page + 1} / {displayTotalPages}
          </span>
          <button
            aria-label="다음 페이지"
            className="flex size-9 items-center justify-center rounded-lg border border-[rgba(42,66,50,0.18)] bg-white text-[#3A3530] transition hover:bg-[#F4F1EA] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || totalPages === 0 || page + 1 >= totalPages}
            onClick={() => onPageChange(page + 1)}
            type="button"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
