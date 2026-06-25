"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAuthApiJson } from "@/lib/auth/auth-api";
import { STUDENT_CLASS_PAGE_SIZE, type StudentClassItem, type StudentClassListResponse } from "@/lib/classroom/types";

export const studentClassKeys = {
  all: ["student", "classes"] as const,
  list: (page: number, pageSize: number) =>
    [...studentClassKeys.all, "list", { page, pageSize }] as const,
};

function myClassesPath(page: number, pageSize: number) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  return `/api/v2/my/classes?${params.toString()}`;
}

export function useStudentClasses(
  page: number,
  pageSize: number = STUDENT_CLASS_PAGE_SIZE,
  enabled = true,
) {
  return useQuery({
    queryKey: studentClassKeys.list(page, pageSize),
    queryFn: () => fetchAuthApiJson<StudentClassListResponse>(myClassesPath(page, pageSize)),
    enabled,
  });
}

export function useJoinStudentClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { entry_code: string }) =>
      fetchAuthApiJson<StudentClassItem>("/api/v2/my/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentClassKeys.all }),
  });
}
