"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthButton } from "@/components/auth/auth-button";
import { SitePageShell } from "@/components/layout/site-page-shell";
import { MypageMyClasses } from "@/components/mypage/mypage-my-classes";
import { STUDENT_CLASS_PAGE_SIZE } from "@/lib/classroom/types";
import {
  MypageAccountInfo,
  MypageProfileCard,
  MypageSessionHistory,
} from "@/components/mypage/mypage-sections";
import { emptySessionHistoryFilters, type SessionHistoryFilters } from "@/components/mypage/mypage-session-filters";
import { TeacherGradeApplyDialog } from "@/components/mypage/teacher-grade-apply";
import { useTeacherGradeApplication } from "@/hooks/use-teacher-grade-application";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthMe } from "@/hooks/use-auth-me";
import { useJoinStudentClass, useStudentClasses } from "@/hooks/use-student-classes";
import { useMySessions } from "@/hooks/use-my-sessions";
import { useLogout } from "@/hooks/use-logout";
const SESSION_PAGE_SIZE = 5;

export default function MypagePage() {
  const router = useRouter();
  const authMeQuery = useAuthMe();
  const teacherGradeApplicationQuery = useTeacherGradeApplication(Boolean(authMeQuery.data));
  const [filters, setFilters] = useState<SessionHistoryFilters>(emptySessionHistoryFilters);
  const [submittedFilters, setSubmittedFilters] = useState<SessionHistoryFilters>(emptySessionHistoryFilters);
  const [page, setPage] = useState(0);
  const [classPage, setClassPage] = useState(0);
  const { handleLogout, isLoggingOut, logoutDialogOpen, setLogoutDialogOpen } = useLogout();
  const sessionsQuery = useMySessions(
    {
      page: page + 1,
      pageSize: SESSION_PAGE_SIZE,
      dateFrom: submittedFilters.dateFrom || undefined,
      dateTo: submittedFilters.dateTo || undefined,
      characterName: submittedFilters.characterName.trim() || undefined,
      scenarioTitle: submittedFilters.scenarioTitle.trim() || undefined,
    },
    Boolean(authMeQuery.data),
  );

  const sessionsData = sessionsQuery.data;
  const isStudent = authMeQuery.data?.grade === "student";
  const studentClassesQuery = useStudentClasses(
    classPage + 1,
    STUDENT_CLASS_PAGE_SIZE,
    Boolean(authMeQuery.data && isStudent),
  );
  const joinStudentClass = useJoinStudentClass();
  const studentClassesData = studentClassesQuery.data;

  useEffect(() => {
    if (!authMeQuery.isLoading && authMeQuery.data === null) {
      router.replace("/login");
    }
  }, [authMeQuery.data, authMeQuery.isLoading, router]);

  if (authMeQuery.isLoading) {
    return null;
  }

  if (authMeQuery.isError) {
    return (
      <SitePageShell>
        <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
          <div
            className="rounded-xl border px-4 py-10 text-center text-sm text-[#6B6458]"
            style={{ borderColor: "rgba(42,66,50,0.12)", background: "rgba(253,250,244,0.8)" }}
          >
            회원 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </div>
        </div>
      </SitePageShell>
    );
  }

  const user = authMeQuery.data;

  function handleSearch() {
    setPage(0);
    setSubmittedFilters(filters);
  }

  function handleReset() {
    setFilters(emptySessionHistoryFilters);
    setSubmittedFilters(emptySessionHistoryFilters);
    setPage(0);
  }

  async function handleJoinClass(entryCode: string) {
    await joinStudentClass.mutateAsync({ entry_code: entryCode });
    setClassPage(0);
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <SitePageShell>
        <div className="mx-auto max-w-4xl px-6 py-10 pb-28 sm:py-14 sm:pb-32">
          <header className="mb-8 sm:mb-10">
            <p
              className="text-sm font-medium text-[#3D6B52]"
              style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
            >
              MY PAGE
            </p>
            <h1
              className="mt-2 text-3xl font-semibold text-[#1A1714] sm:text-4xl"
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              마이페이지
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#6B6458] sm:text-base">
              {user.grade === "student"
                ? "나의 계정 정보, 클래스, 완료한 시뮬레이션 기록을 확인할 수 있습니다."
                : "나의 계정 정보와 완료한 시뮬레이션 기록을 확인할 수 있습니다."}
            </p>
          </header>

          <div className="space-y-6">
            <MypageProfileCard
              averageHistoryScore={sessionsData?.summary.average_history_score ?? null}
              completedCount={sessionsData?.summary.completed_count ?? 0}
              user={user}
            />

            <MypageAccountInfo
              footer={
                <>
                  {user.grade === "student" ? (
                    <TeacherGradeApplyDialog
                      application={teacherGradeApplicationQuery.data ?? null}
                      user={user}
                    />
                  ) : (
                    <AuthButton
                      className="h-11 w-auto px-5"
                      onClick={() => router.push("/classes")}
                      type="button"
                    >
                      내 클래스 관리
                    </AuthButton>
                  )}
                </>
              }
              user={user}
            />

            {user.grade === "student" ? (
              <MypageMyClasses
                classes={studentClassesData?.items ?? []}
                currentPage={classPage}
                errorMessage={
                  studentClassesQuery.isError
                    ? "클래스 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
                    : null
                }
                isJoining={joinStudentClass.isPending}
                isLoading={studentClassesQuery.isLoading}
                onJoin={handleJoinClass}
                onPageChange={setClassPage}
                total={studentClassesData?.total ?? 0}
                totalPages={studentClassesData?.total_pages ?? 0}
              />
            ) : null}

            <MypageSessionHistory
              currentPage={page}
              errorMessage={sessionsQuery.isError ? "시뮬레이션 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." : null}
              isLoading={sessionsQuery.isLoading}
              onFiltersChange={setFilters}
              onPageChange={setPage}
              onReset={handleReset}
              onSearch={handleSearch}
              sessions={sessionsData?.items ?? []}
              total={sessionsData?.total ?? 0}
              totalPages={sessionsData?.total_pages ?? 0}
              values={filters}
            />
          </div>
        </div>

        <div
          className="fixed inset-x-0 bottom-0 z-40"
        >
          <div className="mx-auto flex max-w-4xl gap-3 px-6 py-4">
            <AuthButton className="min-w-0 flex-1" onClick={() => router.push("/map")} type="button">
              새 이야기 시작하기
            </AuthButton>
            <AuthButton
              className="min-w-0 flex-1"
              isLoading={isLoggingOut}
              loadingText="로그아웃 중..."
              onClick={handleLogout}
              type="button"
              variant="secondary"
            >
              로그아웃
            </AuthButton>
          </div>
        </div>
      </SitePageShell>

      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent className="border-[rgba(42,66,50,0.12)] bg-[#FDFAF4] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A1714]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              로그아웃 실패
            </DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed text-[#6B6458]">
              로그아웃을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <AuthButton className="w-full" onClick={() => setLogoutDialogOpen(false)} type="button">
              확인
            </AuthButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
