"use client";

import { useState } from "react";
import { ClassRecordsPanel } from "@/app/(auth)/classes/[id]/_components/class-records-panel";
import { useListControls } from "@/app/(auth)/classes/[id]/_hooks/use-list-controls";
import { buildClassPlaySessionsExportPath } from "@/app/(auth)/classes/[id]/_lib/export-paths";
import {
  CLASS_RECORD_PAGE_SIZE,
  emptyClassStudentSessionsFilters,
} from "@/app/(auth)/classes/[id]/_types";
import { useTeacherClassPlaySessions } from "@/hooks/use-teacher-classes";
import { downloadAuthApiFile } from "@/lib/auth/auth-api";

type ClassRecordsContainerProps = {
  classId: number;
  enabled: boolean;
  isEmptyClass: boolean;
};

export function ClassRecordsContainer({
  classId,
  enabled,
  isEmptyClass,
}: ClassRecordsContainerProps) {
  const controls = useListControls({
    initialFilters: emptyClassStudentSessionsFilters,
    initialPageSize: CLASS_RECORD_PAGE_SIZE,
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const query = useTeacherClassPlaySessions(
    classId,
    controls.page + 1,
    controls.pageSize,
    controls.submittedFilters,
    enabled,
  );

  async function handleDownload() {
    setIsDownloading(true);
    try {
      await downloadAuthApiFile(
        buildClassPlaySessionsExportPath(classId, controls.submittedFilters),
        `class-${classId}-play-sessions.xlsx`,
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
    <ClassRecordsPanel
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
      records={query.data?.items ?? []}
      total={query.data?.total ?? 0}
      totalPages={query.data?.total_pages ?? 0}
    />
  );
}
