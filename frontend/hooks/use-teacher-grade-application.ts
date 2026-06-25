"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAuthApiJson } from "@/lib/auth/auth-api";
import type { TeacherGradeApplication } from "@/lib/auth/teacher-grade-application-types";

export const teacherGradeApplicationQueryKey = ["teacher-grade-application", "me"] as const;

export function useTeacherGradeApplication(enabled = true) {
  return useQuery({
    queryKey: teacherGradeApplicationQueryKey,
    enabled,
    queryFn: () =>
      fetchAuthApiJson<TeacherGradeApplication | null>("/api/v2/auth/teacher-grade-applications/me"),
  });
}
