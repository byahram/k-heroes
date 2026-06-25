"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAuthApiJson } from "@/lib/auth/auth-api";
import type { ClassListPageSize } from "@/components/classroom/class-list-pagination";
import type {
  ClassActivitySummary,
  ClassPlaySessionListResponse,
  ClassRoom,
  ClassRoomDetail,
  ClassRoomListResponse,
} from "@/lib/classroom/types";
import type {
  ClassCharacterRecordStudent,
  ClassCharacterRecordSummary,
  ClassCharacterRecordsFilters,
  ClassStudentSessionSummary,
  ClassStudentSessionsFilters,
} from "@/app/(auth)/classes/[id]/_types";

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

function classActivitySummaryPath(classId: number, dateFrom: string, dateTo: string) {
  const params = new URLSearchParams();
  if (dateFrom.trim()) {
    params.set("date_from", dateFrom.trim());
  }
  if (dateTo.trim()) {
    params.set("date_to", dateTo.trim());
  }
  const query = params.toString();
  return query
    ? `/api/v2/classes/${classId}/activity-summary?${query}`
    : `/api/v2/classes/${classId}/activity-summary`;
}

export function useTeacherClassActivitySummary(
  classId: number,
  dateFrom = "",
  dateTo = "",
  enabled = true,
) {
  return useQuery({
    queryKey: [...teacherClassKeys.detail(classId), "activity-summary", { dateFrom, dateTo }] as const,
    queryFn: () =>
      fetchAuthApiJson<ClassActivitySummary>(classActivitySummaryPath(classId, dateFrom, dateTo)),
    enabled: enabled && classId > 0,
  });
}

export type ClassStudentSessionListResponse = {
  items: ClassStudentSessionSummary[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

function classStudentSessionsPath(
  classId: number,
  page: number,
  pageSize: number,
  filters: ClassStudentSessionsFilters,
) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (filters.name.trim()) {
    params.set("name", filters.name.trim());
  }
  if (filters.nickname.trim()) {
    params.set("nickname", filters.nickname.trim());
  }
  if (filters.dateFrom.trim()) {
    params.set("date_from", filters.dateFrom.trim());
  }
  if (filters.dateTo.trim()) {
    params.set("date_to", filters.dateTo.trim());
  }
  return `/api/v2/classes/${classId}/student-sessions?${params.toString()}`;
}

export function useTeacherClassStudentSessions(
  classId: number,
  page: number,
  pageSize: ClassListPageSize,
  filters: ClassStudentSessionsFilters,
  enabled = true,
) {
  const apiPage = page + 1;

  return useQuery({
    queryKey: [
      ...teacherClassKeys.detail(classId),
      "student-sessions",
      { page: apiPage, pageSize, filters },
    ] as const,
    queryFn: () =>
      fetchAuthApiJson<ClassStudentSessionListResponse>(
        classStudentSessionsPath(classId, apiPage, pageSize, filters),
      ),
    enabled: enabled && classId > 0,
  });
}

export type ClassCharacterRecordListResponse = {
  items: ClassCharacterRecordSummary[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

function classCharacterRecordsPath(
  classId: number,
  page: number,
  pageSize: number,
  filters: ClassCharacterRecordsFilters,
) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (filters.characterName.trim()) {
    params.set("character_name", filters.characterName.trim());
  }
  if (filters.dateFrom.trim()) {
    params.set("date_from", filters.dateFrom.trim());
  }
  if (filters.dateTo.trim()) {
    params.set("date_to", filters.dateTo.trim());
  }
  return `/api/v2/classes/${classId}/character-records?${params.toString()}`;
}

export function useTeacherClassCharacterRecords(
  classId: number,
  page: number,
  pageSize: ClassListPageSize,
  filters: ClassCharacterRecordsFilters,
  enabled = true,
) {
  const apiPage = page + 1;

  return useQuery({
    queryKey: [
      ...teacherClassKeys.detail(classId),
      "character-records",
      { page: apiPage, pageSize, filters },
    ] as const,
    queryFn: () =>
      fetchAuthApiJson<ClassCharacterRecordListResponse>(
        classCharacterRecordsPath(classId, apiPage, pageSize, filters),
      ),
    enabled: enabled && classId > 0,
  });
}

export type ClassCharacterRecordStudentListResponse = {
  items: ClassCharacterRecordStudent[];
};

function classCharacterRecordStudentsPath(
  classId: number,
  recordId: string,
  dateFrom: string,
  dateTo: string,
) {
  const params = new URLSearchParams();
  if (dateFrom.trim()) {
    params.set("date_from", dateFrom.trim());
  }
  if (dateTo.trim()) {
    params.set("date_to", dateTo.trim());
  }
  const query = params.toString();
  const encodedRecordId = encodeURIComponent(recordId);
  return query
    ? `/api/v2/classes/${classId}/character-records/${encodedRecordId}/students?${query}`
    : `/api/v2/classes/${classId}/character-records/${encodedRecordId}/students`;
}

export function useTeacherClassCharacterRecordStudents(
  classId: number,
  recordId: string,
  dateFrom: string,
  dateTo: string,
  enabled = true,
) {
  return useQuery({
    queryKey: [
      ...teacherClassKeys.detail(classId),
      "character-records",
      recordId,
      "students",
      { dateFrom, dateTo },
    ] as const,
    queryFn: () =>
      fetchAuthApiJson<ClassCharacterRecordStudentListResponse>(
        classCharacterRecordStudentsPath(classId, recordId, dateFrom, dateTo),
      ),
    enabled: enabled && classId > 0 && recordId.length > 0,
  });
}

function classPlaySessionsPath(
  classId: number,
  page: number,
  pageSize: number,
  filters: {
    name: string;
    nickname: string;
    dateFrom: string;
    dateTo: string;
  },
) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (filters.name.trim()) {
    params.set("name", filters.name.trim());
  }
  if (filters.nickname.trim()) {
    params.set("nickname", filters.nickname.trim());
  }
  if (filters.dateFrom.trim()) {
    params.set("date_from", filters.dateFrom.trim());
  }
  if (filters.dateTo.trim()) {
    params.set("date_to", filters.dateTo.trim());
  }
  return `/api/v2/classes/${classId}/play-sessions?${params.toString()}`;
}

export function useTeacherClassPlaySessions(
  classId: number,
  page: number,
  pageSize: number,
  filters: {
    name: string;
    nickname: string;
    dateFrom: string;
    dateTo: string;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: [
      ...teacherClassKeys.detail(classId),
      "play-sessions",
      { page, pageSize, ...filters },
    ] as const,
    queryFn: () =>
      fetchAuthApiJson<ClassPlaySessionListResponse>(
        classPlaySessionsPath(classId, page, pageSize, filters),
      ),
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
