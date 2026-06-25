"use client";

import { useTeacherClassCharacterRecordStudents } from "@/hooks/use-teacher-classes";
import type { ClassCharacterRecordStudent } from "@/app/(auth)/classes/[id]/_types";

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

function formatStudentLabel(student: ClassCharacterRecordStudent) {
  const name = student.name?.trim();
  const nickname = student.nickname?.trim();
  if (name && nickname) return `${name} (${nickname})`;
  return name || nickname || student.login_id || "—";
}

type ClassCharacterRecordStudentsDetailProps = {
  classId: number;
  dateFrom: string;
  dateTo: string;
  enabled: boolean;
  recordId: string;
};

export function ClassCharacterRecordStudentsDetail({
  classId,
  dateFrom,
  dateTo,
  enabled,
  recordId,
}: ClassCharacterRecordStudentsDetailProps) {
  const studentsQuery = useTeacherClassCharacterRecordStudents(
    classId,
    recordId,
    dateFrom,
    dateTo,
    enabled,
  );

  if (studentsQuery.isFetching) {
    return (
      <p className="text-sm text-[#8A847C]">완료 학생 목록을 불러오는 중입니다.</p>
    );
  }

  if (studentsQuery.isError) {
    return (
      <p className="text-sm text-[#8A847C]">완료 학생 목록을 불러오지 못했습니다.</p>
    );
  }

  const students = studentsQuery.data?.items ?? [];
  if (students.length === 0) {
    return (
      <p className="text-sm text-[#8A847C]">선택한 기간에 완료한 학생이 없습니다.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[rgba(42,66,50,0.1)] bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#F4F1EA] text-[#6B6458]">
          <tr>
            <th className="px-3 py-2.5 font-medium">학생</th>
            <th className="px-3 py-2.5 font-medium">역사 점수</th>
            <th className="px-3 py-2.5 font-medium">완료일</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr
              key={student.user_id}
              className="border-t border-[rgba(42,66,50,0.08)]"
            >
              <td className="px-3 py-2.5 font-medium text-[#1A1714]">
                {formatStudentLabel(student)}
              </td>
              <td className="px-3 py-2.5 text-[#2A4232]">{student.history_score}점</td>
              <td className="px-3 py-2.5 text-[#8A847C]">
                {formatDateTime(student.completed_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
