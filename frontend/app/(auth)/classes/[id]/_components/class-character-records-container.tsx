"use client";

import { useState } from "react";
import { ClassCharacterRecordsPanel } from "@/app/(auth)/classes/[id]/_components/class-character-records-panel";
import { useListControls } from "@/app/(auth)/classes/[id]/_hooks/use-list-controls";
import { buildClassCharacterRecordsExportPath } from "@/app/(auth)/classes/[id]/_lib/export-paths";
import {
  CLASS_CHARACTER_RECORD_PAGE_SIZE,
  emptyClassCharacterRecordsFilters,
} from "@/app/(auth)/classes/[id]/_types";
import { useTeacherClassCharacterRecords } from "@/hooks/use-teacher-classes";
import { downloadAuthApiFile } from "@/lib/auth/auth-api";

type ClassCharacterRecordsContainerProps = {
  classId: number;
  enabled: boolean;
  isEmptyClass: boolean;
};

export function ClassCharacterRecordsContainer({
  classId,
  enabled,
  isEmptyClass,
}: ClassCharacterRecordsContainerProps) {
  const controls = useListControls({
    initialFilters: emptyClassCharacterRecordsFilters,
    initialPageSize: CLASS_CHARACTER_RECORD_PAGE_SIZE,
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const query = useTeacherClassCharacterRecords(
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
        buildClassCharacterRecordsExportPath(classId, controls.submittedFilters),
        `class-${classId}-character-records.xlsx`,
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
    <ClassCharacterRecordsPanel
      classId={classId}
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
      submittedFilters={controls.submittedFilters}
      total={query.data?.total ?? 0}
      totalPages={query.data?.total_pages ?? 0}
    />
  );
}
