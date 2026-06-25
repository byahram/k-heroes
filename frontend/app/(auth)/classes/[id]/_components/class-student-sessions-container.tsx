"use client";

import { useState } from "react";
import { ClassStudentSessionsPanel } from "@/app/(auth)/classes/[id]/_components/class-student-sessions-panel";
import { useListControls } from "@/app/(auth)/classes/[id]/_hooks/use-list-controls";
import { buildClassStudentSessionsExportPath } from "@/app/(auth)/classes/[id]/_lib/export-paths";
import {
  CLASS_STUDENT_SESSIONS_PAGE_SIZE,
  emptyClassStudentSessionsFilters,
} from "@/app/(auth)/classes/[id]/_types";
import { useTeacherClassStudentSessions } from "@/hooks/use-teacher-classes";
import { downloadAuthApiFile } from "@/lib/auth/auth-api";

type ClassStudentSessionsContainerProps = {
  classId: number;
  enabled: boolean;
  isEmptyClass: boolean;
};

export function ClassStudentSessionsContainer({
  classId,
  enabled,
  isEmptyClass,
}: ClassStudentSessionsContainerProps) {
  const controls = useListControls({
    initialFilters: emptyClassStudentSessionsFilters,
    initialPageSize: CLASS_STUDENT_SESSIONS_PAGE_SIZE,
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const query = useTeacherClassStudentSessions(
    classId,
    controls.page,
    controls.pageSize,
    controls.submittedFilters,
    enabled,
  );

  async function handleDownload() {
    setIsDownloading(true);
    try {
      await downloadAuthApiFile(
        buildClassStudentSessionsExportPath(classId, controls.submittedFilters),
        `class-${classId}-student-sessions.xlsx`,
      );
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "엑셀 파일을 다운로드하지 못했습니다.",
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <ClassStudentSessionsPanel
      filters={controls.filters}
      isEmptyClass={isEmptyClass}
      isDownloading={isDownloading}
      isLoading={query.isFetching}
      onDownload={() => {
        void handleDownload();
      }}
      onFiltersChange={controls.setFilters}
      onPageChange={controls.setPage}
      onPageSizeChange={controls.handlePageSizeChange}
      onReset={controls.handleReset}
      onSearch={controls.handleSearch}
      page={controls.page}
      pageSize={controls.pageSize}
      students={query.data?.items ?? []}
      submittedFilters={controls.submittedFilters}
      total={query.data?.total ?? 0}
      totalPages={query.data?.total_pages ?? 0}
    />
  );
}
