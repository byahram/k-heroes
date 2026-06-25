"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Plus, Users } from "lucide-react";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthFormField } from "@/components/auth/auth-form-field";
import { ClassListPagination, type ClassListPageSize } from "@/components/classroom/class-list-pagination";
import { SitePageShell } from "@/components/layout/site-page-shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TEACHER_CLASS_PAGE_SIZE,
  useCreateTeacherClass,
  useDeleteTeacherClass,
  useTeacherClasses,
  useUpdateTeacherClass,
} from "@/hooks/use-teacher-classes";
import { useRequireTeacher } from "@/hooks/use-require-teacher";
import {
  buildEntryCodePreview,
  getCurrentYearPrefix,
  getEntryCodeSuffixValidationMessage,
  isEntryCodeServerErrorMessage,
  sanitizeEntryCodeSuffixInput,
  ENTRY_CODE_SUFFIX_MAX_LENGTH,
} from "@/lib/classroom/entry-code-policy";
import type { ClassRoom } from "@/lib/classroom/types";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
});

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

export default function ClassesPage() {
  const router = useRouter();
  const authMeQuery = useRequireTeacher();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<ClassListPageSize>(TEACHER_CLASS_PAGE_SIZE);
  const [nameQuery, setNameQuery] = useState("");
  const [submittedNameQuery, setSubmittedNameQuery] = useState("");
  const classesQuery = useTeacherClasses(
    page + 1,
    pageSize,
    submittedNameQuery,
    authMeQuery.data?.grade === "teacher",
  );
  const createClass = useCreateTeacherClass();
  const updateClass = useUpdateTeacherClass();
  const deleteClass = useDeleteTeacherClass();

  const [createOpen, setCreateOpen] = useState(false);
  const [className, setClassName] = useState("");
  const [entryCodeSuffix, setEntryCodeSuffix] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [entryCodeError, setEntryCodeError] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const currentYearPrefix = getCurrentYearPrefix();
  const entryCodePreview = entryCodeSuffix.trim()
    ? buildEntryCodePreview(entryCodeSuffix)
    : `${currentYearPrefix}____`;

  const classes = classesQuery.data?.items ?? [];
  const total = classesQuery.data?.total ?? 0;
  const totalPages = classesQuery.data?.total_pages ?? 0;
  const isLoading = authMeQuery.isLoading || classesQuery.isLoading;
  const hasSearch = submittedNameQuery.trim().length > 0;

  function handleSearch() {
    setPage(0);
    setSubmittedNameQuery(nameQuery.trim());
  }

  function handleReset() {
    setNameQuery("");
    setSubmittedNameQuery("");
    setPage(0);
  }

  function handlePageSizeChange(nextPageSize: ClassListPageSize) {
    setPage(0);
    setPageSize(nextPageSize);
  }

  async function handleCreate() {
    const trimmedName = className.trim();
    const suffixValidation = getEntryCodeSuffixValidationMessage(entryCodeSuffix);

    if (!trimmedName) {
      setErrorMessage("클래스 이름을 입력해 주세요.");
      return;
    }
    if (suffixValidation) {
      setEntryCodeError(suffixValidation);
      return;
    }

    setErrorMessage("");
    setEntryCodeError("");
    try {
      await createClass.mutateAsync({
        name: trimmedName,
        entry_code_suffix: entryCodeSuffix.trim(),
      });
      setClassName("");
      setEntryCodeSuffix("");
      setCreateOpen(false);
      setPage(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "클래스를 만들지 못했습니다.";
      if (isEntryCodeServerErrorMessage(message)) {
        setEntryCodeError(message);
        setErrorMessage("");
      } else {
        setErrorMessage(message);
        setEntryCodeError("");
      }
    }
  }

  async function handleToggleActive(classRoom: ClassRoom) {
    try {
      await updateClass.mutateAsync({
        id: classRoom.id,
        body: { is_active: !classRoom.is_active },
      });
    } catch {
      // 목록 새로고침은 mutation invalidate로 처리됩니다.
    }
  }

  async function handleDelete(classRoom: ClassRoom) {
    if (!window.confirm(`"${classRoom.name}" 클래스를 삭제하시겠습니까?`)) return;

    try {
      await deleteClass.mutateAsync(classRoom.id);
      if (classes.length === 1 && page > 0) {
        setPage((current) => current - 1);
      }
    } catch {
      // 오류는 상위에서 처리하지 않고 목록 유지
    }
  }

  async function handleCopyEntryCode(entryCode: string) {
    try {
      await navigator.clipboard.writeText(entryCode);
      setCopiedCode(entryCode);
      window.setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      setCopiedCode(null);
    }
  }

  if (isLoading) {
    return null;
  }

  if (!authMeQuery.data || authMeQuery.data.grade !== "teacher") {
    return null;
  }

  return (
    <SitePageShell>
      <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
        <header className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              className="text-sm text-[#6B6458] transition hover:text-[#2A4232]"
              href="/mypage"
            >
              ← 마이페이지로 돌아가기
            </Link>
            <h1
              className="mt-4 text-3xl font-semibold text-[#1A1714] sm:text-4xl"
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              내 클래스
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#6B6458] sm:text-base">
              클래스를 만들 때 입장코드를 직접 정합니다. 앞에는 올해 연도({currentYearPrefix})가 자동으로 붙습니다.
            </p>
          </div>

          <AuthButton className="h-11 w-full px-5 sm:w-auto" onClick={() => setCreateOpen(true)} type="button">
            <Plus aria-hidden="true" className="size-4" />
            클래스 만들기
          </AuthButton>
        </header>

        <div
          className="mb-6 rounded-xl border p-5"
          style={{ borderColor: "rgba(42,66,50,0.12)", background: "rgba(253,250,244,0.8)" }}
        >
          <label className="mb-2 block text-sm font-medium text-[#3A3530]" htmlFor="class_name_search">
            클래스 이름 검색
          </label>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              handleSearch();
            }}
          >
            <input
              className="h-12 min-w-0 flex-1 rounded-lg border bg-white px-4 text-sm text-[#1A1714] outline-none transition placeholder:text-[#A39E94] focus:border-[#3D6B52] focus:ring-2 focus:ring-[#3D6B52]/15"
              id="class_name_search"
              onChange={(event) => setNameQuery(event.target.value)}
              placeholder="클래스 이름으로 검색"
              style={{ borderColor: "rgba(42,66,50,0.18)" }}
              type="search"
              value={nameQuery}
            />
            <AuthButton className="h-12 w-auto min-w-[88px] shrink-0" type="submit">
              검색
            </AuthButton>
            <AuthButton
              className="h-12 w-auto min-w-[88px] shrink-0"
              onClick={handleReset}
              type="button"
              variant="secondary"
            >
              초기화
            </AuthButton>
          </form>
        </div>

        <div className="mb-5">
          <ClassListPagination
            disabled={isLoading}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
          />
        </div>

        {classesQuery.isError ? (
          <div
            className="rounded-xl border px-4 py-10 text-center text-sm text-[#6B6458]"
            style={{ borderColor: "rgba(42,66,50,0.12)", background: "rgba(253,250,244,0.8)" }}
          >
            클래스 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </div>
        ) : total === 0 ? (
          <div
            className="rounded-xl border px-4 py-12 text-center"
            style={{ borderColor: "rgba(42,66,50,0.12)", background: "rgba(253,250,244,0.8)" }}
          >
            <p className="text-sm text-[#6B6458]">
              {hasSearch ? "검색 결과가 없습니다." : "아직 만든 클래스가 없습니다."}
            </p>
            {!hasSearch ? (
              <AuthButton className="mx-auto mt-5 h-11 w-auto px-5" onClick={() => setCreateOpen(true)} type="button">
                첫 클래스 만들기
              </AuthButton>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {classes.map((classRoom) => (
              <article
                key={classRoom.id}
                className="rounded-xl border p-5 sm:p-6"
                style={{ borderColor: "rgba(42,66,50,0.12)", background: "rgba(253,250,244,0.8)" }}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-[#1A1714]">{classRoom.name}</h2>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          classRoom.is_active
                            ? "bg-[#E8F0EB] text-[#2A4232]"
                            : "bg-[#F4F1EA] text-[#8A847C]"
                        }`}
                      >
                        {classRoom.is_active ? "활성" : "비활성"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#6B6458]">
                      <span className="inline-flex items-center gap-1.5">
                        <Users aria-hidden="true" className="size-4" />
                        학생 {classRoom.member_count}명
                      </span>
                      <span>생성일 {formatDate(classRoom.created_at)}</span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[#3A3530]">입장코드</span>
                      <code className="rounded-lg bg-white px-3 py-1.5 text-base font-semibold tracking-[0.2em] text-[#2A4232]">
                        {classRoom.entry_code}
                      </code>
                      <button
                        aria-label="입장코드 복사"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-[#6B6458] transition hover:bg-[rgba(42,66,50,0.06)] hover:text-[#2A4232]"
                        onClick={() => void handleCopyEntryCode(classRoom.entry_code)}
                        type="button"
                      >
                        <Copy aria-hidden="true" className="size-4" />
                        {copiedCode === classRoom.entry_code ? "복사됨" : "복사"}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <AuthButton
                      className="h-10 w-auto px-4"
                      onClick={() => router.push(`/classes/${classRoom.id}`)}
                      size="sm"
                      type="button"
                    >
                      학생 목록
                    </AuthButton>
                    <AuthButton
                      className="h-10 w-auto px-4"
                      onClick={() => void handleToggleActive(classRoom)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {classRoom.is_active ? "비활성화" : "활성화"}
                    </AuthButton>
                    <AuthButton
                      className="h-10 w-auto px-4"
                      onClick={() => void handleDelete(classRoom)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      삭제
                    </AuthButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

      </div>

      <Dialog
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setClassName("");
            setEntryCodeSuffix("");
            setErrorMessage("");
            setEntryCodeError("");
          }
        }}
        open={createOpen}
      >
        <DialogContent
          className="border-[rgba(42,66,50,0.12)] bg-[#FDFAF4] sm:max-w-md"
          style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
        >
          <DialogHeader>
            <DialogTitle className="text-[#1A1714]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              클래스 만들기
            </DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed text-[#6B6458]">
              클래스 이름과 입장코드를 입력해 주세요. 입장코드는 {currentYearPrefix}로 시작합니다.
            </DialogDescription>
          </DialogHeader>

          <AuthFormField
            disabled={createClass.isPending}
            error={errorMessage}
            id="class_name"
            label="클래스 이름"
            maxLength={100}
            onChange={(event) => {
              setClassName(event.target.value);
              if (errorMessage) setErrorMessage("");
            }}
            placeholder="예: 00초등학교 4학년 1반"
            required
            value={className}
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#3A3530]" htmlFor="entry_code_suffix">
              입장코드<span className="ml-0.5 text-[#9A3F38]">*</span>
            </label>
            <div
              className={`flex overflow-hidden rounded-lg border bg-white ${
                entryCodeError
                  ? "border-[#D9A39D] ring-2 ring-[#D9A39D]/20"
                  : "border-[rgba(42,66,50,0.18)]"
              }`}
            >
              <span className="flex h-12 items-center border-r border-[rgba(42,66,50,0.12)] bg-[#F4F1EA] px-4 text-sm font-semibold tracking-wide text-[#2A4232]">
                {currentYearPrefix}
              </span>
              <input
                className="h-12 min-w-0 flex-1 px-4 text-sm text-[#1A1714] outline-none placeholder:text-[#A39E94] focus:ring-2 focus:ring-[#3D6B52]/15"
                disabled={createClass.isPending}
                id="entry_code_suffix"
                maxLength={ENTRY_CODE_SUFFIX_MAX_LENGTH}
                onChange={(event) => {
                  setEntryCodeSuffix(sanitizeEntryCodeSuffixInput(event.target.value));
                  if (entryCodeError) setEntryCodeError("");
                }}
                placeholder="예: 00초4학년1반, 4A1, CODE1"
                value={entryCodeSuffix}
              />
            </div>
            <p className="text-xs text-[#8A847C]">
              2~12자, 공백 불가. 완성 코드: <strong className="font-medium text-[#2A4232]">{entryCodePreview}</strong>
            </p>
            {entryCodeError ? (
              <p className="text-xs text-[#9A3F38]" role="alert">
                {entryCodeError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="grid gap-3 sm:grid-cols-2">
            <AuthButton
              disabled={createClass.isPending}
              onClick={() => setCreateOpen(false)}
              type="button"
              variant="secondary"
            >
              취소
            </AuthButton>
            <AuthButton
              isLoading={createClass.isPending}
              loadingText="생성 중..."
              onClick={() => void handleCreate()}
              type="button"
            >
              만들기
            </AuthButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SitePageShell>
  );
}
