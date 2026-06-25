"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminPageSize } from "@/app/(admin)/_components/admin-pagination";
import {
  fetchAdminApiJson,
  type PaginatedResponse,
} from "@/app/(admin)/_lib/admin-api";
import { adminListQueryOptions } from "@/app/(admin)/_lib/admin-query-config";
import type {
  TeacherGradeApplicationListItem,
  TeacherGradeApplicationStatusFilter,
} from "@/app/(admin)/admin/(dashboard)/teacher-grade-applications/_types";

export const adminTeacherGradeApplicationKeys = {
  all: ["admin", "teacher-grade-applications"] as const,
  list: (page: number, pageSize: AdminPageSize, status: TeacherGradeApplicationStatusFilter) =>
    [...adminTeacherGradeApplicationKeys.all, "list", { page, pageSize, status }] as const,
};

function applicationsPath(
  page: number,
  pageSize: AdminPageSize,
  status: TeacherGradeApplicationStatusFilter,
) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (status !== "all") {
    params.set("status", status);
  }
  return `/api/v2/admin/teacher-grade-applications?${params.toString()}`;
}

function fetchApplicationList(
  page: number,
  pageSize: AdminPageSize,
  status: TeacherGradeApplicationStatusFilter,
  signal?: AbortSignal,
) {
  return fetchAdminApiJson<PaginatedResponse<TeacherGradeApplicationListItem>>(
    applicationsPath(page, pageSize, status),
    { cache: "no-store", signal },
  );
}

export function useAdminTeacherGradeApplications(
  page: number,
  pageSize: AdminPageSize,
  status: TeacherGradeApplicationStatusFilter,
) {
  return useQuery({
    queryKey: adminTeacherGradeApplicationKeys.list(page, pageSize, status),
    queryFn: ({ signal }) => fetchApplicationList(page, pageSize, status, signal),
    ...adminListQueryOptions,
  });
}

type ReviewBody = {
  review_note?: string | null;
};

export function useApproveTeacherGradeApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body?: ReviewBody }) =>
      fetchAdminApiJson<TeacherGradeApplicationListItem>(
        `/api/v2/admin/teacher-grade-applications/${id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminTeacherGradeApplicationKeys.all }),
  });
}

export function useRejectTeacherGradeApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body?: ReviewBody }) =>
      fetchAdminApiJson<TeacherGradeApplicationListItem>(
        `/api/v2/admin/teacher-grade-applications/${id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminTeacherGradeApplicationKeys.all }),
  });
}
