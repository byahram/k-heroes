"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthDivider } from "@/components/auth/auth-divider";
import { AuthFormField } from "@/components/auth/auth-form-field";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { AuthFormCard, AuthFormLayout } from "@/components/layout/auth-form-layout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AuthApiError, fetchAuthApiJson } from "@/lib/auth/auth-api";
import { EMAIL_MAX_LENGTH, validateOptionalEmail } from "@/lib/auth/email-policy";
import { LOGIN_ID_MAX_LENGTH, LOGIN_ID_MIN_LENGTH, validateLoginId } from "@/lib/auth/login-id-policy";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validatePassword } from "@/lib/auth/password-policy";
import { useGoogleSessionLogin } from "@/hooks/use-google-session-login";
import { useGuestOnlyRedirect } from "@/hooks/use-guest-only-redirect";
import { site } from "@/lib/site";

type SubmitDialogFocusTarget = "login_id" | "email" | null;

type SignupFormValues = {
  login_id: string;
  password: string;
  password_confirm: string;
  name: string;
  nickname: string;
  email: string;
  agreed_to_terms: boolean;
};

function getSignupErrorFocusTarget(message: string): SubmitDialogFocusTarget {
  if (message.includes("login_id")) return "login_id";
  if (message.includes("email")) return "email";
  return null;
}

function getSignupErrorMessage(message: string) {
  return message.replaceAll("login_id", "아이디").replaceAll("email", "이메일");
}

export default function SignupPage() {
  const router = useRouter();
  const { isCheckingAuth } = useGuestOnlyRedirect();
  const {
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
    setFocus,
    trigger,
    watch,
  } = useForm<SignupFormValues>({
    defaultValues: {
      login_id: "",
      password: "",
      password_confirm: "",
      name: "",
      nickname: "",
      email: "",
      agreed_to_terms: false,
    },
    mode: "onChange",
  });
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitDialogMessage, setSubmitDialogMessage] = useState("");
  const [submitDialogFocusTarget, setSubmitDialogFocusTarget] = useState<SubmitDialogFocusTarget>(null);
  const { isLoggingIn: isGoogleLoggingIn, loginWithGoogleIdToken } = useGoogleSessionLogin();
  const password = watch("password");
  const agreedToTerms = watch("agreed_to_terms");

  function openSubmitDialog(message: string, focusTarget: SubmitDialogFocusTarget = null) {
    setSubmitDialogMessage(message);
    setSubmitDialogFocusTarget(focusTarget);
    setSubmitDialogOpen(true);
  }

  async function submitSignup(data: SignupFormValues) {
    const loginId = data.login_id.trim();
    const email = data.email.trim();
    const name = data.name.trim();
    const nickname = data.nickname.trim();

    try {
      await fetchAuthApiJson("/api/v2/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          login_id: loginId,
          password: data.password,
          name: name || null,
          email: email || null,
          nickname: nickname || null,
        }),
      });
      router.replace("/login?signup=success");
    } catch (error) {
      if (error instanceof AuthApiError) {
        openSubmitDialog(getSignupErrorMessage(error.message), getSignupErrorFocusTarget(error.message));
      } else {
        openSubmitDialog("회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    }
  }

  async function handleGoogleCredential(idToken: string) {
    try {
      await loginWithGoogleIdToken(idToken);
    } catch (error) {
      if (error instanceof AuthApiError) {
        openSubmitDialog(getSignupErrorMessage(error.message));
      } else {
        openSubmitDialog("구글 회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    }
  }

  if (isCheckingAuth) {
    return null;
  }

  return (
    <>
      <AuthFormLayout>
        <AuthFormCard
          description={`간단한 정보를 입력하고 ${site.name}의 역사 시뮬레이션을 시작해 보세요.`}
          footer={
            <p className="text-center text-sm text-[#6B6458]">
              이미 계정이 있으신가요?{" "}
              <Link className="font-medium text-[#2A4232] underline-offset-4 hover:underline" href="/login">
                로그인
              </Link>
            </p>
          }
          title="회원가입"
        >
          <form className="space-y-5" noValidate onSubmit={handleSubmit(submitSignup)}>
            <p className="text-xs text-[#8A847C]">
              <span className="text-[#9A3F38]">*</span> 표시는 필수 입력 항목입니다.
            </p>

            <AuthFormField
              autoComplete="username"
              error={errors.login_id?.message}
              id="login_id"
              label="아이디"
              maxLength={LOGIN_ID_MAX_LENGTH}
              minLength={LOGIN_ID_MIN_LENGTH}
              placeholder="사용할 아이디를 입력하세요"
              required
              type="text"
              {...register("login_id", {
                validate: (value) => validateLoginId(value) ?? true,
              })}
            />

            <AuthFormField
              autoComplete="new-password"
              error={errors.password?.message}
              id="password"
              label="비밀번호"
              maxLength={PASSWORD_MAX_LENGTH}
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="비밀번호를 입력하세요"
              required
              showPasswordToggle
              type="password"
              {...register("password", {
                onChange: () => {
                  if (getValues("password_confirm")) {
                    void trigger("password_confirm");
                  }
                },
                validate: (value) => validatePassword(value) ?? true,
              })}
            />

            <PasswordRequirements password={password} />

            <AuthFormField
              autoComplete="new-password"
              error={errors.password_confirm?.message}
              id="password_confirm"
              label="비밀번호 확인"
              maxLength={PASSWORD_MAX_LENGTH}
              minLength={PASSWORD_MIN_LENGTH}
              placeholder="비밀번호를 다시 입력하세요"
              required
              showPasswordToggle
              type="password"
              {...register("password_confirm", {
                validate: (value) => value === getValues("password") || "비밀번호가 일치하지 않습니다.",
              })}
            />

            <AuthFormField
              autoComplete="nickname"
              error={errors.nickname?.message}
              id="nickname"
              label="닉네임"
              placeholder="닉네임을 입력하세요"
              required
              type="text"
              {...register("nickname", {
                validate: (value) => value.trim() !== "" || "닉네임을 입력해 주세요.",
              })}
            />

            <AuthFormField
              autoComplete="name"
              id="name"
              label="이름"
              placeholder="이름 (선택)"
              type="text"
              {...register("name")}
            />

            <AuthFormField
              autoComplete="email"
              error={errors.email?.message}
              id="email"
              label="이메일"
              maxLength={EMAIL_MAX_LENGTH}
              placeholder="이메일 (선택)"
              type="email"
              {...register("email", {
                validate: (value) => validateOptionalEmail(value) ?? true,
              })}
            />

            <label
              className="flex items-start gap-3 rounded-lg border px-4 py-3 text-sm text-[#4A4438]"
              style={{ borderColor: "rgba(42,66,50,0.12)" }}
            >
              <input
                className="mt-0.5 size-4 rounded border-[rgba(42,66,50,0.25)] text-[#2A4232] focus:ring-[#3D6B52]/20"
                type="checkbox"
                {...register("agreed_to_terms", {
                  validate: (value) => value || "서비스 이용약관 및 개인정보 처리방침에 동의해 주세요.",
                })}
              />
              <span>
                <Link
                  className="font-medium text-[#2A4232] underline-offset-4 hover:underline"
                  href="/legal/terms"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  서비스 이용약관
                </Link>
                {" 및 "}
                <Link
                  className="font-medium text-[#2A4232] underline-offset-4 hover:underline"
                  href="/legal/privacy"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  개인정보 처리방침
                </Link>
                에 동의합니다.
                <span className="ml-0.5 text-[#9A3F38]">*</span>
              </span>
            </label>

            {errors.agreed_to_terms?.message ? (
              <p className="text-xs text-[#9A3F38]">{errors.agreed_to_terms.message}</p>
            ) : null}

            <AuthButton isLoading={isSubmitting} loadingText="가입 중..." type="submit">
              회원가입
            </AuthButton>
          </form>

          <AuthDivider />

          <GoogleLoginButton
            disabled={!agreedToTerms}
            isLoading={isGoogleLoggingIn}
            label="Google로 가입하기"
            onBeforeSignIn={() => {
              if (!getValues("agreed_to_terms")) {
                openSubmitDialog("서비스 이용약관 및 개인정보 처리방침에 동의해 주세요.");
                return false;
              }
              return true;
            }}
            onCredential={handleGoogleCredential}
            onError={openSubmitDialog}
          />
        </AuthFormCard>
      </AuthFormLayout>

      <Dialog
        onOpenChange={(nextOpen) => {
          setSubmitDialogOpen(nextOpen);
          if (!nextOpen) {
            const nextFocusTarget = submitDialogFocusTarget;
            setSubmitDialogMessage("");
            setSubmitDialogFocusTarget(null);
            window.requestAnimationFrame(() => {
              if (nextFocusTarget) {
                setFocus(nextFocusTarget);
              }
            });
          }
        }}
        open={submitDialogOpen}
      >
        <DialogContent className="border-[rgba(42,66,50,0.12)] bg-[#FDFAF4] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A1714]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              회원가입 실패
            </DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed text-[#6B6458]">
              {submitDialogMessage}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <AuthButton className="w-full" onClick={() => setSubmitDialogOpen(false)} type="button">
              확인
            </AuthButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
