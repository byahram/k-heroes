"use client";

import { useMemo, useState } from "react";
import { ClassStudentListPanel } from "@/app/(auth)/classes/[id]/_components/class-student-list-panel";
import { useListControls } from "@/app/(auth)/classes/[id]/_hooks/use-list-controls";
import { buildClassStudentsExportPath } from "@/app/(auth)/classes/[id]/_lib/export-paths";
import {
  CLASS_STUDENT_PAGE_SIZE,
  emptyClassStudentListFilters,
  type ClassStudentListFilters,
} from "@/app/(auth)/classes/[id]/_types";
import { downloadAuthApiFile } from "@/lib/auth/auth-api";
import type { ClassMember } from "@/lib/classroom/types";

function filterMembers(members: ClassMember[], filters: ClassStudentListFilters) {
  const nameQuery = filters.name.trim().toLowerCase();
  const nicknameQuery = filters.nickname.trim().toLowerCase();

  return members.filter((member) => {
    if (nameQuery && !member.name?.toLowerCase().includes(nameQuery)) {
      return false;
    }
    if (nicknameQuery && !member.nickname?.toLowerCase().includes(nicknameQuery)) {
      return false;
    }
    return true;
  });
}

function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const start = page * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    totalPages,
  };
}

type ClassStudentListContainerProps = {
  classId: number;
  members: ClassMember[];
};

export function ClassStudentListContainer({
  classId,
  members,
}: ClassStudentListContainerProps) {
  const controls = useListControls({
    initialFilters: emptyClassStudentListFilters,
    initialPageSize: CLASS_STUDENT_PAGE_SIZE,
  });
  const [isDownloading, setIsDownloading] = useState(false);

  const filteredMembers = useMemo(
    () => filterMembers(members, controls.submittedFilters),
    [members, controls.submittedFilters],
  );
  const pagination = useMemo(
    () => paginateItems(filteredMembers, controls.page, controls.pageSize),
    [filteredMembers, controls.page, controls.pageSize],
  );

  async function handleDownload() {
    setIsDownloading(true);
    try {
      await downloadAuthApiFile(
        buildClassStudentsExportPath(classId, controls.submittedFilters),
        `class-${classId}-students.xlsx`,
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
    <ClassStudentListPanel
      filters={controls.filters}
      isEmptyClass={members.length === 0}
      isDownloading={isDownloading}
      members={pagination.items}
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
      total={pagination.total}
      totalPages={pagination.totalPages}
    />
  );
}
