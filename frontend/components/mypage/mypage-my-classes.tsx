"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { GraduationCap, Plus } from "lucide-react";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthFormField } from "@/components/auth/auth-form-field";
import { MypageCollapsibleSection } from "@/components/mypage/mypage-collapsible-section";
import { PagePagination } from "@/components/ui/page-pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ENTRY_CODE_MAX_LENGTH,
  getEntryCodeValidationMessage,
  sanitizeEntryCodeInput,
} from "@/lib/classroom/entry-code-policy";
import type { StudentClassItem } from "@/lib/classroom/types";
import { STUDENT_CLASS_PAGE_SIZE } from "@/lib/classroom/types";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
});

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

type MypageMyClassesProps = {
  classes?: StudentClassItem[];
  currentPage?: number;
  errorMessage?: string | null;
  isJoining?: boolean;
  isLoading?: boolean;
  onJoin?: (entryCode: string) => Promise<void>;
  onPageChange?: Dispatch<SetStateAction<number>>;
  total?: number;
  totalPages?: number;
};

export function MypageMyClasses({
  classes = [],
  currentPage = 0,
  errorMessage = null,
  isJoining = false,
  isLoading = false,
  onJoin,
  onPageChange,
  total = 0,
  totalPages = 0,
}: MypageMyClassesProps) {
  const [joinOpen, setJoinOpen] = useState(false);
  const [entryCode, setEntryCode] = useState("");
  const [entryCodeError, setEntryCodeError] = useState("");
  const [joinErrorMessage, setJoinErrorMessage] = useState("");

  async function handleJoin() {
    const validationMessage = getEntryCodeValidationMessage(entryCode);
    if (validationMessage) {
      setEntryCodeError(validationMessage);
      return;
    }

    setEntryCodeError("");
    setJoinErrorMessage("");

    if (!onJoin) {
      setJoinErrorMessage("클래스 가입 기능을 준비 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    try {
      await onJoin(sanitizeEntryCodeInput(entryCode).trim());
      setEntryCode("");
      setJoinOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "클래스에 가입하지 못했습니다.";
      setJoinErrorMessage(message);
    }
  }

  function handleJoinOpenChange(open: boolean) {
    setJoinOpen(open);
    if (!open) {
      setEntryCode("");
      setEntryCodeError("");
      setJoinErrorMessage("");
    }
  }

  return (
    <>
      <MypageCollapsibleSection
        headerAction={
          <AuthButton
            className="h-9 w-auto px-3 text-sm"
            onClick={() => setJoinOpen(true)}
            size="sm"
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            클래스 가입
          </AuthButton>
        }
        meta={`총 ${total}개`}
        title="나의 클래스"
      >
        <p className="text-sm leading-relaxed text-[#6B6458]">
          선생님이 알려준 입장코드로 클래스에 가입할 수 있습니다.
        </p>

        {errorMessage ? (
          <p
            className="mt-5 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-[#8A847C]"
            style={{ borderColor: "rgba(42,66,50,0.15)" }}
          >
            {errorMessage}
          </p>
        ) : isLoading ? (
          <p
            className="mt-5 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-[#8A847C]"
            style={{ borderColor: "rgba(42,66,50,0.15)" }}
          >
            클래스 목록을 불러오는 중입니다.
          </p>
        ) : classes.length === 0 ? (
          <div
            className="mt-5 rounded-xl border border-dashed px-4 py-10 text-center"
            style={{ borderColor: "rgba(42,66,50,0.15)" }}
          >
            <p className="text-sm text-[#8A847C]">아직 가입한 클래스가 없습니다.</p>
            <AuthButton
              className="mx-auto mt-4 h-10 w-auto px-4"
              onClick={() => setJoinOpen(true)}
              size="sm"
              type="button"
            >
              입장코드로 가입하기
            </AuthButton>
          </div>
        ) : (
          <>
            <ul className="mt-5 space-y-3">
              {classes.map((classItem) => (
                <li
                  key={classItem.membership_id}
                  className="rounded-xl border px-4 py-4"
                  style={{ borderColor: "rgba(42,66,50,0.1)" }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <GraduationCap aria-hidden="true" className="size-4 text-[#3D6B52]" />
                        <p className="font-medium text-[#2A4232]">{classItem.class_name}</p>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            classItem.is_class_active
                              ? "bg-[#E8F0EB] text-[#2A4232]"
                              : "bg-[#F4F1EA] text-[#8A847C]"
                          }`}
                        >
                          {classItem.is_class_active ? "활성" : "비활성"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[#8A847C]">가입일 {formatDate(classItem.joined_at)}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-[#3A3530]">입장코드</span>
                        <code className="rounded-lg bg-white px-2.5 py-1 text-sm font-semibold tracking-[0.15em] text-[#2A4232]">
                          {classItem.entry_code}
                        </code>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {onPageChange ? (
              <PagePagination
                alwaysShow={totalPages > 1}
                onPageChange={onPageChange}
                page={currentPage}
                pageSize={STUDENT_CLASS_PAGE_SIZE}
                total={total}
              />
            ) : null}
          </>
        )}
      </MypageCollapsibleSection>

      <Dialog onOpenChange={handleJoinOpenChange} open={joinOpen}>
        <DialogContent
          className="border-[rgba(42,66,50,0.12)] bg-[#FDFAF4] sm:max-w-md"
          style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
        >
          <DialogHeader>
            <DialogTitle className="text-[#1A1714]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              클래스 가입
            </DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed text-[#6B6458]">
              선생님이 알려준 입장코드를 입력해 주세요. 연도 4자리로 시작하는 전체 코드입니다.
            </DialogDescription>
          </DialogHeader>

          <AuthFormField
            autoComplete="off"
            disabled={isJoining}
            error={joinErrorMessage}
            id="class_entry_code"
            label="입장코드"
            maxLength={ENTRY_CODE_MAX_LENGTH}
            onChange={(event) => {
              setEntryCode(sanitizeEntryCodeInput(event.target.value));
              if (entryCodeError) setEntryCodeError("");
              if (joinErrorMessage) setJoinErrorMessage("");
            }}
            placeholder="예: 20264A1, 202600초4학년1반"
            required
            value={entryCode}
          />
          {entryCodeError ? (
            <p className="-mt-2 text-xs text-[#9A3F38]" role="alert">
              {entryCodeError}
            </p>
          ) : null}

          <DialogFooter className="grid gap-3 sm:grid-cols-2">
            <AuthButton
              disabled={isJoining}
              onClick={() => handleJoinOpenChange(false)}
              type="button"
              variant="secondary"
            >
              취소
            </AuthButton>
            <AuthButton
              isLoading={isJoining}
              loadingText="가입 중..."
              onClick={() => void handleJoin()}
              type="button"
            >
              가입하기
            </AuthButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
