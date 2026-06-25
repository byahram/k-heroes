"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthFormField } from "@/components/auth/auth-form-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { teacherGradeApplicationQueryKey } from "@/hooks/use-teacher-grade-application";
import { AuthApiError, fetchAuthApiJson } from "@/lib/auth/auth-api";
import {
  getSchoolNameValidationMessage,
  getTeacherProfileValidationMessage,
  SCHOOL_NAME_MAX_LENGTH,
} from "@/lib/auth/teacher-profile-policy";
import type { TeacherGradeApplication } from "@/lib/auth/teacher-grade-application-types";
import { teacherGradeApplicationStatusLabels } from "@/lib/auth/teacher-grade-application-types";
import type { UserProfile } from "@/lib/auth/types";

function formatApplicationDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

type TeacherGradeApplyDialogProps = {
  user: UserProfile;
  application: TeacherGradeApplication | null;
  disabled?: boolean;
};

type ApplyDialogStep = "confirm" | "profile_required";

export function TeacherGradeApplyDialog({
  user,
  application,
  disabled = false,
}: TeacherGradeApplyDialogProps) {
  const queryClient = useQueryClient();
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [step, setStep] = useState<ApplyDialogStep>("confirm");
  const [schoolName, setSchoolName] = useState("");
  const [schoolNameError, setSchoolNameError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const profileValidationMessage = getTeacherProfileValidationMessage(user);
  const isPending = application?.status === "pending";
  const isRejected = application?.status === "rejected";

  function handleApplyModalOpenChange(nextOpen: boolean) {
    setApplyModalOpen(nextOpen);
    if (!nextOpen) {
      setStep("confirm");
      setSchoolName("");
      setSchoolNameError("");
      setIsSubmitting(false);
      setErrorMessage("");
    }
  }

  function handleCompletionModalOpenChange(nextOpen: boolean) {
    setCompletionModalOpen(nextOpen);
    if (!nextOpen) {
      setSubmittedAt(null);
      void queryClient.invalidateQueries({ queryKey: teacherGradeApplicationQueryKey });
    }
  }

  function handleOpen() {
    if (profileValidationMessage) {
      setStep("profile_required");
    } else {
      setStep("confirm");
    }
    setSchoolName("");
    setSchoolNameError("");
    setErrorMessage("");
    setApplyModalOpen(true);
  }

  async function handleConfirm() {
    const validationMessage = getTeacherProfileValidationMessage(user);
    if (validationMessage) {
      setStep("profile_required");
      setErrorMessage(validationMessage);
      return;
    }

    const schoolValidationMessage = getSchoolNameValidationMessage(schoolName);
    if (schoolValidationMessage) {
      setSchoolNameError(schoolValidationMessage);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSchoolNameError("");

    try {
      const response = await fetchAuthApiJson<TeacherGradeApplication>("/api/v2/auth/teacher-grade-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ school_name: schoolName.trim() }),
      });
      setSubmittedAt(response.created_at);
      setApplyModalOpen(false);
      setStep("confirm");
      setCompletionModalOpen(true);
    } catch (error) {
      setErrorMessage(
        error instanceof AuthApiError ? error.message : "지도자 등급 신청을 처리하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {isPending && !completionModalOpen && application ? (
        <p className="text-sm text-[#6B6458]">
          지도자 등급 신청이 <strong className="font-medium text-[#2A4232]">완료</strong>되었습니다. 현재{" "}
          <strong className="font-medium text-[#2A4232]">검토 중</strong>입니다.
          <br />
          <span className="mt-1 inline-block text-xs text-[#8A847C]">
            신청일 {formatApplicationDate(application.created_at)}
          </span>
        </p>
      ) : null}

      {isRejected && !applyModalOpen && !completionModalOpen && application ? (
        <p className="mb-3 text-sm text-[#6B6458]">
          지도자 등급 신청이{" "}
          <strong className="font-medium text-[#9A3F38]">
            {teacherGradeApplicationStatusLabels.rejected}
          </strong>
          되었습니다. 정보를 수정한 뒤 다시 신청할 수 있습니다.
          <br />
          <span className="mt-1 inline-block text-xs text-[#8A847C]">
            신청일 {formatApplicationDate(application.created_at)}
          </span>
        </p>
      ) : null}

      {!isPending ? (
        <AuthButton disabled={disabled} onClick={handleOpen} size="sm" type="button" variant="secondary">
          {isRejected ? "지도자 등급 변경 재신청" : "지도자 등급 변경 신청"}
        </AuthButton>
      ) : null}

      <ApplyDialog
        errorMessage={errorMessage}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirm}
        onOpenChange={handleApplyModalOpenChange}
        onSchoolNameChange={(value) => {
          setSchoolName(value);
          if (schoolNameError) {
            setSchoolNameError(getSchoolNameValidationMessage(value) ?? "");
          }
        }}
        open={applyModalOpen}
        schoolName={schoolName}
        schoolNameError={schoolNameError}
        step={step}
        user={user}
      />

      <Dialog onOpenChange={handleCompletionModalOpenChange} open={completionModalOpen}>
        <DialogContent
          className="border-[rgba(42,66,50,0.12)] bg-[#FDFAF4] sm:max-w-md"
          style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
        >
          <DialogHeader>
            <DialogTitle className="text-[#1A1714]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              신청이 완료되었습니다
            </DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed text-[#6B6458]">
              지도자 등급 변경 신청이 정상적으로 접수되었습니다.
              {submittedAt ? (
                <>
                  <br />
                  <br />
                  신청일 {formatApplicationDate(submittedAt)}
                </>
              ) : null}
              <br />
              <br />
              관리자 승인까지 <strong className="font-medium text-[#2A4232]">2~3일</strong> 정도 소요될 수
              있습니다. 승인 결과는 로그인 후 마이페이지에서 확인할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <AuthButton className="w-full" onClick={() => handleCompletionModalOpenChange(false)} type="button">
              확인
            </AuthButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type ApplyDialogProps = {
  open: boolean;
  step: ApplyDialogStep;
  isSubmitting: boolean;
  errorMessage: string;
  schoolName: string;
  schoolNameError: string;
  user: UserProfile;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onSchoolNameChange: (value: string) => void;
};

function ApplyDialog({
  open,
  step,
  isSubmitting,
  errorMessage,
  schoolName,
  schoolNameError,
  user,
  onOpenChange,
  onConfirm,
  onSchoolNameChange,
}: ApplyDialogProps) {
  const router = useRouter();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="border-[rgba(42,66,50,0.12)] bg-[#FDFAF4] sm:max-w-md"
        style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
      >
        {step === "profile_required" ? (
          <>
            <DialogHeader>
              <DialogTitle
                className="text-[#1A1714]"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                정보 등록이 필요합니다
              </DialogTitle>
              <DialogDescription className="text-left text-sm leading-relaxed text-[#6B6458]">
                지도자 등급 신청에는 <strong className="font-medium text-[#2A4232]">이름</strong>과{" "}
                <strong className="font-medium text-[#2A4232]">이메일</strong>이 필요합니다.
                <br />
                <br />
                {getTeacherProfileValidationMessage(user)}
                {user.auth_provider === "google" ? (
                  <>
                    <br />
                    <br />
                    구글 계정은 연동된 이메일만 사용할 수 있습니다. 이름은 계정 설정에서 등록해 주세요.
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="grid gap-3 sm:grid-cols-2">
              <AuthButton onClick={() => onOpenChange(false)} type="button" variant="secondary">
                닫기
              </AuthButton>
              <AuthButton onClick={() => router.push("/mypage/settings")} type="button">
                계정 설정으로 이동
              </AuthButton>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle
                className="text-[#1A1714]"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                지도자 등급 변경 신청
              </DialogTitle>
              <DialogDescription className="text-left text-sm leading-relaxed text-[#6B6458]">
                학생 계정을 지도자(교사) 계정으로 변경 신청하시겠습니까?
                <br />
                <br />
                신청 정보: {user.name} / {user.email}
                <br />
                <br />
                신청 후 관리자 검토를 거쳐 승인되면 클래스 개설, 학생 관리 등 지도자 기능을 사용할 수
                있습니다.
              </DialogDescription>
            </DialogHeader>

            <AuthFormField
              disabled={isSubmitting}
              error={schoolNameError}
              hint="예: OO초등학교, OO방과후학교"
              id="teacher_apply_school_name"
              label="소속 (학교/기관)"
              maxLength={SCHOOL_NAME_MAX_LENGTH}
              onChange={(event) => onSchoolNameChange(event.target.value)}
              placeholder="소속 학교 또는 기관명을 입력해 주세요"
              required
              value={schoolName}
            />

            {errorMessage ? <p className="text-sm text-[#9A3F38]">{errorMessage}</p> : null}

            <DialogFooter className="grid gap-3 sm:grid-cols-2">
              <AuthButton
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="secondary"
              >
                취소
              </AuthButton>
              <AuthButton isLoading={isSubmitting} loadingText="신청 중..." onClick={onConfirm} type="button">
                신청하기
              </AuthButton>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
