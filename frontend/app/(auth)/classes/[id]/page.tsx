"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ClassActivitySummaryContainer } from "@/app/(auth)/classes/[id]/_components/class-activity-summary-container";
import { ClassCharacterRecordsContainer } from "@/app/(auth)/classes/[id]/_components/class-character-records-container";
import { ClassDetailHeader } from "@/app/(auth)/classes/[id]/_components/class-detail-header";
import { ClassDetailLoadingState } from "@/app/(auth)/classes/[id]/_components/class-detail-loading-state";
import { ClassDetailTabBar } from "@/app/(auth)/classes/[id]/_components/class-detail-tab-bar";
import { ClassRecordsContainer } from "@/app/(auth)/classes/[id]/_components/class-records-container";
import { ClassStudentListContainer } from "@/app/(auth)/classes/[id]/_components/class-student-list-container";
import { ClassStudentSessionsContainer } from "@/app/(auth)/classes/[id]/_components/class-student-sessions-container";
import {
  CLASS_RECORD_PAGE_SIZE,
  CLASS_CHARACTER_RECORD_PAGE_SIZE,
  emptyClassCharacterRecordsFilters,
  emptyClassStudentSessionsFilters,
  type ClassDetailTab,
} from "@/app/(auth)/classes/[id]/_types";
import { SitePageShell } from "@/components/layout/site-page-shell";
import { useRequireTeacher } from "@/hooks/use-require-teacher";
import {
  useTeacherClass,
  useTeacherClassCharacterRecords,
  useTeacherClassPlaySessions,
} from "@/hooks/use-teacher-classes";

export default function ClassDetailPage() {
  const params = useParams();
  const classId = Number(params.id);
  const authMeQuery = useRequireTeacher();
  const [activeTab, setActiveTab] = useState<ClassDetailTab>("students");
  const isTeacher = authMeQuery.data?.grade === "teacher";

  const classQuery = useTeacherClass(classId, isTeacher);
  const characterRecordCountQuery = useTeacherClassCharacterRecords(
    classId,
    0,
    CLASS_CHARACTER_RECORD_PAGE_SIZE,
    emptyClassCharacterRecordsFilters,
    isTeacher,
  );
  const recordCountQuery = useTeacherClassPlaySessions(
    classId,
    1,
    CLASS_RECORD_PAGE_SIZE,
    emptyClassStudentSessionsFilters,
    isTeacher,
  );

  const classRoom = classQuery.data;
  const activeMembers = useMemo(
    () => classRoom?.members.filter((member) => member.is_active) ?? [],
    [classRoom?.members],
  );

  if (authMeQuery.isLoading || classQuery.isLoading) {
    return <ClassDetailLoadingState />;
  }

  if (!authMeQuery.data || !isTeacher) {
    return <ClassDetailLoadingState />;
  }

  if (classQuery.isError || !classRoom) {
    return (
      <SitePageShell>
        <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
          <Link
            className="text-sm text-[#6B6458] transition hover:text-[#2A4232]"
            href="/classes"
          >
            ← 내 클래스로 돌아가기
          </Link>
          <div
            className="mt-8 rounded-xl border px-4 py-10 text-center text-sm text-[#6B6458]"
            style={{
              borderColor: "rgba(42,66,50,0.12)",
              background: "rgba(253,250,244,0.8)",
            }}
          >
            클래스 정보를 불러오지 못했습니다.
          </div>
        </div>
      </SitePageShell>
    );
  }

  return (
    <SitePageShell>
      <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
        <ClassDetailHeader classRoom={classRoom} />

        <ClassActivitySummaryContainer
          classId={classId}
          enabled={isTeacher}
          totalStudents={activeMembers.length}
        />

        <ClassDetailTabBar
          activeTab={activeTab}
          characterRecordCount={characterRecordCountQuery.data?.total ?? 0}
          onTabChange={setActiveTab}
          recordCount={recordCountQuery.data?.total ?? 0}
          studentCount={activeMembers.length}
        />

        {activeTab === "students" ? (
          <ClassStudentListContainer classId={classId} members={activeMembers} />
        ) : activeTab === "student-sessions" ? (
          <ClassStudentSessionsContainer
            classId={classId}
            enabled={isTeacher && activeTab === "student-sessions"}
            isEmptyClass={activeMembers.length === 0}
          />
        ) : activeTab === "character-records" ? (
          <ClassCharacterRecordsContainer
            classId={classId}
            enabled={isTeacher && activeTab === "character-records"}
            isEmptyClass={activeMembers.length === 0}
          />
        ) : (
          <ClassRecordsContainer
            classId={classId}
            enabled={isTeacher && activeTab === "records"}
            isEmptyClass={activeMembers.length === 0}
          />
        )}
      </div>
    </SitePageShell>
  );
}
