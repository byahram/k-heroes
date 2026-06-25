"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminFilterRow } from "@/app/(admin)/_components/admin-active-filter";
import { AdminButton } from "@/app/(admin)/_components/admin-button";
import { AdminInput } from "@/app/(admin)/_components/admin-input";
import {
  AdminPagination,
  type AdminPageSize,
} from "@/app/(admin)/_components/admin-pagination";
import { AdminPageHeader } from "@/app/(admin)/_components/admin-page-header";
import { AdminSelect } from "@/app/(admin)/_components/admin-select";
import { AdminSlidePanel } from "@/app/(admin)/_components/admin-slide-panel";
import { useAdminClasses } from "@/app/(admin)/_hooks/use-admin-classes";
import { AdminApiError } from "@/app/(admin)/_lib/admin-api";
import { ClassPanel } from "@/app/(admin)/admin/(dashboard)/classes/_components/class-panel";
import { ClassTable } from "@/app/(admin)/admin/(dashboard)/classes/_components/class-table";
import type {
  AdminClassListItem,
  ClassActiveFilter,
  ClassListFilters,
} from "@/app/(admin)/admin/(dashboard)/classes/_types";

const emptyFilters: ClassListFilters = {
  isActive: "all",
  teacherLoginId: "",
  name: "",
  entryCode: "",
};

const filterInputClassName =
  "h-11 rounded-lg border-[#D6D0C6] bg-white text-sm focus:border-[#2A4232] focus:ring-4 focus:ring-[#2A4232]/10";

export default function ClassesPage() {
  const router = useRouter();
  const [selectedClass, setSelectedClass] = useState<AdminClassListItem | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<AdminPageSize>(20);
  const [activeFilter, setActiveFilter] = useState<ClassActiveFilter>("all");
  const [teacherLoginIdQuery, setTeacherLoginIdQuery] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [entryCodeQuery, setEntryCodeQuery] = useState("");
  const [submittedFilters, setSubmittedFilters] = useState<ClassListFilters>(emptyFilters);

  const classesQuery = useAdminClasses(page, pageSize, submittedFilters);

  const classes = classesQuery.data?.items ?? [];
  const total = classesQuery.data?.total ?? 0;
  const totalPages = classesQuery.data?.total_pages ?? 0;
  const isLoading = classesQuery.isPending;
  const isRefreshing = classesQuery.isFetching && !classesQuery.isPending;
  const pageError = classesQuery.error?.message ?? "";

  useEffect(() => {
    if (classesQuery.error instanceof AdminApiError && classesQuery.error.status === 401) {
      router.replace("/admin/login");
    }
  }, [classesQuery.error, router]);

  function openPanel(classRoom: AdminClassListItem) {
    setSelectedClass(classRoom);
  }

  function closePanel() {
    setSelectedClass(null);
  }

  function reloadClasses() {
    void classesQuery.refetch();
  }

  function applyActiveFilter(next: ClassActiveFilter) {
    setPage(1);
    setSubmittedFilters((current) => ({
      ...current,
      isActive: next,
    }));
  }

  function applyTextFilters() {
    setPage(1);
    setSubmittedFilters((current) => ({
      ...current,
      teacherLoginId: teacherLoginIdQuery.trim(),
      name: nameQuery.trim(),
      entryCode: entryCodeQuery.trim(),
    }));
  }

  function handleTextSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyTextFilters();
  }

  return (
    <>
      <AdminPageHeader
        description="지도자가 생성한 클래스를 조회합니다."
        title="클래스"
      />

      <div className="mb-4 space-y-4 rounded-xl border border-[#E8E4DC] bg-white px-5 py-4">
        <AdminFilterRow htmlFor="class-active-filter" label="상태">
          <AdminSelect
            className="h-11"
            id="class-active-filter"
            onChange={(event) => {
              const isActive = event.target.value as ClassActiveFilter;
              setActiveFilter(isActive);
              applyActiveFilter(isActive);
            }}
            value={activeFilter}
          >
            <option value="all">전체</option>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </AdminSelect>
        </AdminFilterRow>

        <AdminFilterRow htmlFor="class-teacher-login-id-filter" label="지도자 아이디 검색">
          <form className="min-w-0" onSubmit={handleTextSearchSubmit}>
            <AdminInput
              className={filterInputClassName}
              id="class-teacher-login-id-filter"
              onChange={(event) => setTeacherLoginIdQuery(event.target.value)}
              placeholder="지도자 아이디로 검색"
              type="search"
              value={teacherLoginIdQuery}
            />
          </form>
        </AdminFilterRow>

        <AdminFilterRow htmlFor="class-name-filter" label="클래스 이름 검색">
          <form className="min-w-0" onSubmit={handleTextSearchSubmit}>
            <AdminInput
              className={filterInputClassName}
              id="class-name-filter"
              onChange={(event) => setNameQuery(event.target.value)}
              placeholder="클래스 이름으로 검색"
              type="search"
              value={nameQuery}
            />
          </form>
        </AdminFilterRow>

        <AdminFilterRow htmlFor="class-entry-code-filter" label="입장코드 검색">
          <form className="min-w-0" onSubmit={handleTextSearchSubmit}>
            <AdminInput
              className={filterInputClassName}
              id="class-entry-code-filter"
              onChange={(event) => setEntryCodeQuery(event.target.value)}
              placeholder="입장코드로 검색"
              type="search"
              value={entryCodeQuery}
            />
          </form>
        </AdminFilterRow>
      </div>

      <AdminPagination
        disabled={isLoading}
        isRefreshing={isRefreshing}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPage(1);
          setPageSize(value);
        }}
        onRefresh={reloadClasses}
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
      />

      <ClassTable
        classes={classes}
        errorMessage={pageError}
        isLoading={isLoading}
        onRetry={reloadClasses}
        onRowClick={openPanel}
      />

      <AdminSlidePanel
        description="클래스 정보를 확인할 수 있습니다."
        footer={
          selectedClass ? (
            <div className="flex justify-end">
              <AdminButton className="w-auto" onClick={closePanel} size="sm" type="button" variant="secondary">
                닫기
              </AdminButton>
            </div>
          ) : null
        }
        onClose={closePanel}
        open={selectedClass !== null}
        title="클래스 상세"
      >
        {selectedClass ? <ClassPanel classId={selectedClass.id} /> : null}
      </AdminSlidePanel>
    </>
  );
}
