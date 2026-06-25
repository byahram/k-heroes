"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAuthApiJson } from "@/lib/auth/auth-api";
import type { ClassListPageSize } from "@/components/classroom/class-list-pagination";
import type { ClassRoom, ClassRoomDetail, ClassRoomListResponse } from "@/lib/classroom/types";

export const TEACHER_CLASS_PAGE_SIZE: ClassListPageSize = 10;

export const teacherClassKeys = {
  all: ["teacher", "classes"] as const,
  list: (page: number, pageSize: number, name: string) =>
    [...teacherClassKeys.all, "list", { page, pageSize, name }] as const,
  detail: (classId: number) => [...teacherClassKeys.all, "detail", classId] as const,
};

function classesPath(page: number, pageSize: number, name: string) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (name.trim()) {
    params.set("name", name.trim());
  }
  return `/api/v2/classes?${params.toString()}`;
}

export function useTeacherClasses(
  page: number,
  pageSize: ClassListPageSize = TEACHER_CLASS_PAGE_SIZE,
  name = "",
  enabled = true,
) {
  return useQuery({
    queryKey: teacherClassKeys.list(page, pageSize, name),
    queryFn: () => fetchAuthApiJson<ClassRoomListResponse>(classesPath(page, pageSize, name)),
    enabled,
  });
}

export function useTeacherClass(classId: number, enabled = true) {
  return useQuery({
    queryKey: teacherClassKeys.detail(classId),
    queryFn: () => fetchAuthApiJson<ClassRoomDetail>(`/api/v2/classes/${classId}`),
    enabled: enabled && classId > 0,
  });
}

export function useCreateTeacherClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; entry_code_suffix: string }) =>
      fetchAuthApiJson<ClassRoom>("/api/v2/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teacherClassKeys.all }),
  });
}

export function useUpdateTeacherClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: { name?: string; is_active?: boolean } }) =>
      fetchAuthApiJson<ClassRoom>(`/api/v2/classes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teacherClassKeys.all }),
  });
}

export function useDeleteTeacherClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchAuthApiJson<ClassRoom>(`/api/v2/classes/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teacherClassKeys.all }),
  });
}
