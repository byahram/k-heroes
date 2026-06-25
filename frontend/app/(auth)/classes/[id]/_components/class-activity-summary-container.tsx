"use client";

import { useState } from "react";
import { ClassActivitySummaryPanel } from "@/app/(auth)/classes/[id]/_components/class-activity-summary-panel";
import {
  emptyClassActivityDateFilters,
  type ClassActivityDateFilters,
} from "@/app/(auth)/classes/[id]/_types";
import { useTeacherClassActivitySummary } from "@/hooks/use-teacher-classes";

type ClassActivitySummaryContainerProps = {
  classId: number;
  enabled: boolean;
  totalStudents: number;
};

export function ClassActivitySummaryContainer({
  classId,
  enabled,
  totalStudents,
}: ClassActivitySummaryContainerProps) {
  const [filters, setFilters] = useState<ClassActivityDateFilters>(
    emptyClassActivityDateFilters,
  );
  const [submittedFilters, setSubmittedFilters] = useState<ClassActivityDateFilters>(
    emptyClassActivityDateFilters,
  );
  const query = useTeacherClassActivitySummary(
    classId,
    submittedFilters.dateFrom,
    submittedFilters.dateTo,
    enabled,
  );

  function handleSearch() {
    setSubmittedFilters(filters);
  }

  function handleReset() {
    setFilters(emptyClassActivityDateFilters);
    setSubmittedFilters(emptyClassActivityDateFilters);
  }

  const summary = query.data ?? {
    total_students: totalStudents,
    participating_students: 0,
    completed_sessions: 0,
    average_history_score: null,
  };

  const hasSubmittedDateRange =
    submittedFilters.dateFrom.trim().length > 0 ||
    submittedFilters.dateTo.trim().length > 0;

  return (
    <>
      <ClassActivitySummaryPanel
        filters={filters}
        isLoading={query.isFetching}
        onFiltersChange={setFilters}
        onRefresh={() => {
          void query.refetch();
        }}
        onReset={handleReset}
        onSearch={handleSearch}
        summary={summary}
      />

      {hasSubmittedDateRange ? (
        <p className="mb-4 text-xs text-[#8A847C]">
          클래스 활동 요약은 {submittedFilters.dateFrom || "처음"} ~{" "}
          {submittedFilters.dateTo || "현재"} 기간 기준으로 표시됩니다.
        </p>
      ) : null}
    </>
  );
}
