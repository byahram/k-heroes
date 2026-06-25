"use client";

import { useQuery } from "@tanstack/react-query";
import type { AdminPageSize } from "@/app/(admin)/_components/admin-pagination";
import {
  fetchAdminApiJson,
  type PaginatedResponse,
} from "@/app/(admin)/_lib/admin-api";
import { adminListQueryOptions } from "@/app/(admin)/_lib/admin-query-config";
import type {
  AdminClassDetailItem,
  AdminClassListItem,
  ClassListFilters,
} from "@/app/(admin)/admin/(dashboard)/classes/_types";

export const adminClassKeys = {
  all: ["admin", "classes"] as const,
  list: (page: number, pageSize: AdminPageSize, filters: ClassListFilters) =>
    [...adminClassKeys.all, "list", { page, pageSize, filters }] as const,
  detail: (classId: number) => [...adminClassKeys.all, "detail", classId] as const,
};

function classesPath(page: number, pageSize: AdminPageSize, filters: ClassListFilters) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (filters.isActive === "active") params.set("is_active", "true");
  if (filters.isActive === "inactive") params.set("is_active", "false");
  if (filters.teacherLoginId.trim()) params.set("teacher_login_id", filters.teacherLoginId.trim());
  if (filters.name.trim()) params.set("name", filters.name.trim());
  if (filters.entryCode.trim()) params.set("entry_code", filters.entryCode.trim());
  return `/api/v2/admin/classes?${params.toString()}`;
}

function fetchClassList(
  page: number,
  pageSize: AdminPageSize,
  filters: ClassListFilters,
  signal?: AbortSignal,
) {
  return fetchAdminApiJson<PaginatedResponse<AdminClassListItem>>(
    classesPath(page, pageSize, filters),
    {
      cache: "no-store",
      signal,
    },
  );
}

export function useAdminClasses(page: number, pageSize: AdminPageSize, filters: ClassListFilters) {
  return useQuery({
    queryKey: adminClassKeys.list(page, pageSize, filters),
    queryFn: ({ signal }) => fetchClassList(page, pageSize, filters, signal),
    ...adminListQueryOptions,
  });
}

export function useAdminClass(classId: number, enabled = true) {
  return useQuery({
    queryKey: adminClassKeys.detail(classId),
    queryFn: ({ signal }) =>
      fetchAdminApiJson<AdminClassDetailItem>(`/api/v2/admin/classes/${classId}`, {
        cache: "no-store",
        signal,
      }),
    enabled: enabled && classId > 0,
    ...adminListQueryOptions,
  });
}
