"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminPageSize } from "@/app/(admin)/_components/admin-pagination";
import {
  fetchAdminApiJson,
  type PaginatedResponse,
} from "@/app/(admin)/_lib/admin-api";
import { adminListQueryOptions } from "@/app/(admin)/_lib/admin-query-config";
import type {
  MemberListFilters,
  MemberListItem,
} from "@/app/(admin)/admin/(dashboard)/users/_types";

export const adminMemberKeys = {
  all: ["admin", "users"] as const,
  list: (page: number, pageSize: AdminPageSize, filters: MemberListFilters) =>
    [...adminMemberKeys.all, "list", { page, pageSize, filters }] as const,
};

function membersPath(page: number, pageSize: AdminPageSize, filters: MemberListFilters) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (filters.grade !== "all") params.set("grade", filters.grade);
  if (filters.authProvider !== "all") params.set("auth_provider", filters.authProvider);
  if (filters.loginId.trim()) params.set("login_id", filters.loginId.trim());
  if (filters.name.trim()) params.set("name", filters.name.trim());
  if (filters.email.trim()) params.set("email", filters.email.trim());
  return `/api/v2/admin/users?${params.toString()}`;
}

function fetchMemberList(
  page: number,
  pageSize: AdminPageSize,
  filters: MemberListFilters,
  signal?: AbortSignal,
) {
  return fetchAdminApiJson<PaginatedResponse<MemberListItem>>(membersPath(page, pageSize, filters), {
    cache: "no-store",
    signal,
  });
}

export function useAdminMembers(
  page: number,
  pageSize: AdminPageSize,
  filters: MemberListFilters,
) {
  return useQuery({
    queryKey: adminMemberKeys.list(page, pageSize, filters),
    queryFn: ({ signal }) => fetchMemberList(page, pageSize, filters, signal),
    ...adminListQueryOptions,
  });
}

type MemberUpdateBody = {
  name?: string | null;
  nickname?: string | null;
  email?: string | null;
  grade?: "student" | "teacher";
  password?: string;
};

export function useUpdateAdminMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: MemberUpdateBody }) =>
      fetchAdminApiJson<MemberListItem>(`/api/v2/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminMemberKeys.all }),
  });
}

export function useDeleteAdminMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchAdminApiJson<MemberListItem>(`/api/v2/admin/users/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminMemberKeys.all }),
  });
}
