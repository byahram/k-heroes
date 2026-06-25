import type {
  ClassCharacterRecordsFilters,
  ClassStudentListFilters,
  ClassStudentSessionsFilters,
} from "@/app/(auth)/classes/[id]/_types";


function appendIfPresent(params: URLSearchParams, key: string, value: string) {
  const trimmed = value.trim();
  if (trimmed) {
    params.set(key, trimmed);
  }
}


export function buildClassStudentsExportPath(
  classId: number,
  filters: ClassStudentListFilters,
) {
  const params = new URLSearchParams();
  appendIfPresent(params, "name", filters.name);
  appendIfPresent(params, "nickname", filters.nickname);
  const query = params.toString();
  return query
    ? `/api/v2/classes/${classId}/students/export?${query}`
    : `/api/v2/classes/${classId}/students/export`;
}


export function buildClassStudentSessionsExportPath(
  classId: number,
  filters: ClassStudentSessionsFilters,
) {
  const params = new URLSearchParams();
  appendIfPresent(params, "name", filters.name);
  appendIfPresent(params, "nickname", filters.nickname);
  appendIfPresent(params, "date_from", filters.dateFrom);
  appendIfPresent(params, "date_to", filters.dateTo);
  const query = params.toString();
  return query
    ? `/api/v2/classes/${classId}/student-sessions/export?${query}`
    : `/api/v2/classes/${classId}/student-sessions/export`;
}


export function buildClassCharacterRecordsExportPath(
  classId: number,
  filters: ClassCharacterRecordsFilters,
) {
  const params = new URLSearchParams();
  appendIfPresent(params, "character_name", filters.characterName);
  appendIfPresent(params, "date_from", filters.dateFrom);
  appendIfPresent(params, "date_to", filters.dateTo);
  const query = params.toString();
  return query
    ? `/api/v2/classes/${classId}/character-records/export?${query}`
    : `/api/v2/classes/${classId}/character-records/export`;
}


export function buildClassPlaySessionsExportPath(
  classId: number,
  filters: ClassStudentSessionsFilters,
) {
  const params = new URLSearchParams();
  appendIfPresent(params, "name", filters.name);
  appendIfPresent(params, "nickname", filters.nickname);
  appendIfPresent(params, "date_from", filters.dateFrom);
  appendIfPresent(params, "date_to", filters.dateTo);
  const query = params.toString();
  return query
    ? `/api/v2/classes/${classId}/play-sessions/export?${query}`
    : `/api/v2/classes/${classId}/play-sessions/export`;
}
