"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminButton } from "@/app/(admin)/_components/admin-button";
import {
  AdminPagination,
  type AdminPageSize,
} from "@/app/(admin)/_components/admin-pagination";
import { AdminPageHeader } from "@/app/(admin)/_components/admin-page-header";
import { AdminSlidePanel } from "@/app/(admin)/_components/admin-slide-panel";
import {
  useAdminTeacherGradeApplications,
  useApproveTeacherGradeApplication,
  useRejectTeacherGradeApplication,
} from "@/app/(admin)/_hooks/use-admin-teacher-grade-applications";
import { AdminApiError } from "@/app/(admin)/_lib/admin-api";
import { TeacherGradeApplicationPanel } from "@/app/(admin)/admin/(dashboard)/teacher-grade-applications/_components/teacher-grade-application-panel";
import { TeacherGradeApplicationTable } from "@/app/(admin)/admin/(dashboard)/teacher-grade-applications/_components/teacher-grade-application-table";
import type {
  TeacherGradeApplicationListItem,
  TeacherGradeApplicationStatusFilter,
} from "@/app/(admin)/admin/(dashboard)/teacher-grade-applications/_types";
import { cn } from "@/lib/utils/cn";

const statusFilters: { value: TeacherGradeApplicationStatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "pending", label: "검토 대기" },
  { value: "approved", label: "승인" },
  { value: "rejected", label: "반려" },
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function TeacherGradeApplicationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<AdminPageSize>(20);
  const [statusFilter, setStatusFilter] = useState<TeacherGradeApplicationStatusFilter>("pending");
  const [selectedApplication, setSelectedApplication] =
    useState<TeacherGradeApplicationListItem | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [panelError, setPanelError] = useState("");

  const applicationsQuery = useAdminTeacherGradeApplications(page, pageSize, statusFilter);
  const approveApplication = useApproveTeacherGradeApplication();
  const rejectApplication = useRejectTeacherGradeApplication();

  const applications = applicationsQuery.data?.items ?? [];
  const total = applicationsQuery.data?.total ?? 0;
  const totalPages = applicationsQuery.data?.total_pages ?? 0;
  const isLoading = applicationsQuery.isPending;
  const isRefreshing = applicationsQuery.isFetching && !applicationsQuery.isPending;
  const isReviewing = approveApplication.isPending || rejectApplication.isPending;
  const pageError = applicationsQuery.error?.message ?? "";

  useEffect(() => {
    if (applicationsQuery.error instanceof AdminApiError && applicationsQuery.error.status === 401) {
      router.replace("/admin/login");
    }
  }, [applicationsQuery.error, router]);

  function openPanel(application: TeacherGradeApplicationListItem) {
    setSelectedApplication(application);
    setReviewNote(application.review_note ?? "");
    setPanelError("");
  }

  function closePanel() {
    if (isReviewing) return;
    setSelectedApplication(null);
    setReviewNote("");
    setPanelError("");
  }

  function reloadApplications() {
    void applicationsQuery.refetch();
  }

  async function handleApprove() {
    if (!selectedApplication || selectedApplication.status !== "pending") return;

    setPanelError("");
    try {
      await approveApplication.mutateAsync({
        id: selectedApplication.id,
        body: { review_note: reviewNote.trim() || null },
      });
      closePanel();
    } catch (error) {
      setPanelError(errorMessage(error, "승인하지 못했습니다."));
    }
  }

  async function handleReject() {
    if (!selectedApplication || selectedApplication.status !== "pending") return;
    if (!window.confirm("이 지도자 등급 신청을 반려하시겠습니까?")) return;

    setPanelError("");
    try {
      await rejectApplication.mutateAsync({
        id: selectedApplication.id,
        body: { review_note: reviewNote.trim() || null },
      });
      closePanel();
    } catch (error) {
      setPanelError(errorMessage(error, "반려하지 못했습니다."));
    }
  }

  const isPending = selectedApplication?.status === "pending";

  return (
    <>
      <AdminPageHeader
        description="학생 계정의 지도자 등급 변경 신청을 검토합니다."
        title="지도자 등급 신청"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {statusFilters.map((filter) => {
          const active = statusFilter === filter.value;
          return (
            <button
              key={filter.value}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[#2A4232] text-white"
                  : "border border-[#E8E4DC] bg-white text-[#6B6458] hover:bg-[#F4F1EA]",
              )}
              onClick={() => {
                setPage(1);
                setStatusFilter(filter.value);
              }}
              type="button"
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <AdminPagination
        disabled={isLoading}
        isRefreshing={isRefreshing}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPage(1);
          setPageSize(value);
        }}
        onRefresh={reloadApplications}
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
      />

      <TeacherGradeApplicationTable
        applications={applications}
        errorMessage={pageError}
        isLoading={isLoading}
        onRetry={reloadApplications}
        onRowClick={openPanel}
      />

      <AdminSlidePanel
        description="신청 정보를 확인하고 승인 또는 반려할 수 있습니다."
        footer={
          selectedApplication ? (
            <div className="flex items-center justify-between gap-3">
              {isPending ? (
                <AdminButton
                  className="w-auto"
                  disabled={isReviewing}
                  isLoading={rejectApplication.isPending}
                  loadingText="반려 중..."
                  onClick={handleReject}
                  size="sm"
                  type="button"
                  variant="danger"
                >
                  반려
                </AdminButton>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <AdminButton
                  className="w-auto"
                  disabled={isReviewing}
                  onClick={closePanel}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  닫기
                </AdminButton>
                {isPending ? (
                  <AdminButton
                    className="w-auto"
                    disabled={isReviewing}
                    isLoading={approveApplication.isPending}
                    loadingText="승인 중..."
                    onClick={handleApprove}
                    size="sm"
                    type="button"
                  >
                    승인
                  </AdminButton>
                ) : null}
              </div>
            </div>
          ) : null
        }
        onClose={closePanel}
        open={selectedApplication !== null}
        title="지도자 등급 신청 상세"
      >
        {selectedApplication ? (
          <div className="space-y-5">
            <TeacherGradeApplicationPanel
              application={selectedApplication}
              onReviewNoteChange={setReviewNote}
              reviewNote={reviewNote}
            />
            {panelError ? (
              <p
                aria-live="polite"
                className="rounded-lg border border-[#E6C9C5] bg-[#FDF6F5] px-4 py-3 text-sm text-[#9A3F38]"
                role="alert"
              >
                {panelError}
              </p>
            ) : null}
          </div>
        ) : null}
      </AdminSlidePanel>
    </>
  );
}
