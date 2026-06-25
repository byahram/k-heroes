"use client";

import { Download } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { AuthButton } from "@/components/auth/auth-button";
import {
  ClassListPagination,
  type ClassListPageSize,
} from "@/components/classroom/class-list-pagination";
import { cn } from "@/lib/utils/cn";
import type { ClassStudentListFilters } from "@/app/(auth)/classes/[id]/_types";
import type { ClassMember } from "@/lib/classroom/types";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
});

const inputClassName = cn(
  "h-10 w-full rounded-lg border bg-white px-3 text-sm text-[#1A1714] outline-none transition",
  "placeholder:text-[#A39E94]",
  "focus:border-[#3D6B52] focus:ring-2 focus:ring-[#3D6B52]/15",
);

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

type ClassStudentListPanelProps = {
  filters: ClassStudentListFilters;
  isLoading?: boolean;
  isDownloading?: boolean;
  members: ClassMember[];
  isEmptyClass?: boolean;
  onDownload: () => void;
  onFiltersChange: Dispatch<SetStateAction<ClassStudentListFilters>>;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: ClassListPageSize) => void;
  onReset: () => void;
  onSearch: () => void;
  page: number;
  pageSize: ClassListPageSize;
  total: number;
  totalPages: number;
};

export function ClassStudentListPanel({
  filters,
  isLoading = false,
  isDownloading = false,
  isEmptyClass = false,
  members,
  onDownload,
  onFiltersChange,
  onPageChange,
  onPageSizeChange,
  onReset,
  onSearch,
  page,
  pageSize,
  total,
  totalPages,
}: ClassStudentListPanelProps) {
  return (
    <section
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: "rgba(42,66,50,0.12)", background: "rgba(253,250,244,0.8)" }}
    >
      <div className="border-b px-5 py-4" style={{ borderColor: "rgba(42,66,50,0.12)" }}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#1A1714]">학생 목록</h2>
          <AuthButton
            className="h-9 w-auto shrink-0 whitespace-nowrap gap-1.5 px-3 text-sm"
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
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
        >
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

      {total === 0 ? (
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
                <th className="px-4 py-3 font-medium">아이디</th>
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">닉네임</th>
                <th className="px-4 py-3 font-medium">참여일</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.membership_id} className="border-t border-[rgba(42,66,50,0.08)]">
                  <td className="px-4 py-3 font-medium text-[#1A1714]">
                    {member.login_id || "—"}
                  </td>
                  <td className="px-4 py-3 text-[#3A3530]">{member.name || "—"}</td>
                  <td className="px-4 py-3 text-[#3A3530]">{member.nickname || "—"}</td>
                  <td className="px-4 py-3 text-[#8A847C]">{formatDate(member.joined_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
