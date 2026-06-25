"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { AuthAlert } from "@/components/auth/auth-alert";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthDivider } from "@/components/auth/auth-divider";
import { AuthFormField } from "@/components/auth/auth-form-field";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { AuthFormCard, AuthFormLayout } from "@/components/layout/auth-form-layout";
import { AuthApiError, fetchAuthApiJson } from "@/lib/auth/auth-api";
import { LOGIN_ID_MAX_LENGTH, LOGIN_ID_MIN_LENGTH, validateLoginId } from "@/lib/auth/login-id-policy";
import { PASSWORD_MAX_LENGTH } from "@/lib/auth/password-policy";
import { authMeQueryKey, toUserProfile } from "@/hooks/use-auth-me";
import { useGoogleSessionLogin } from "@/hooks/use-google-session-login";
import { useGuestOnlyRedirect } from "@/hooks/use-guest-only-redirect";
import type { UserProfile } from "@/lib/auth/types";

type LoginFormValues = {
  login_id: string;
  password: string;
  remember_me: boolean;
};

type LoginResponse = {
  user: UserProfile;
};

function validateLoginPassword(password: string) {
  if (!password) {
    return "비밀번호를 입력해 주세요.";
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return "비밀번호는 128자 이하로 입력해 주세요.";
  }

  return null;
}

function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const signupSuccess = searchParams.get("signup") === "success";
  const { isCheckingAuth } = useGuestOnlyRedirect();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginFormValues>({
    defaultValues: {
      login_id: "",
      password: "",
      remember_me: false,
    },
    mode: "onChange",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { isLoggingIn: isGoogleLoggingIn, loginWithGoogleIdToken } = useGoogleSessionLogin();
  const isLoggingIn = isSubmitting || isRedirecting || isGoogleLoggingIn;

  async function handleGoogleCredential(idToken: string) {
    setErrorMessage("");

    try {
      await loginWithGoogleIdToken(idToken);
    } catch (error) {
      setErrorMessage(
        error instanceof AuthApiError
          ? error.message
          : "구글 로그인 요청 중 오류가 발생했습니다.",
      );
    }
  }

  async function submitLogin(data: LoginFormValues) {
    setErrorMessage("");
    setIsRedirecting(false);

    try {
      const response = await fetchAuthApiJson<LoginResponse>("/api/v2/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          login_id: data.login_id.trim(),
          password: data.password,
          remember_me: data.remember_me,
        }),
      });
      queryClient.setQueryData(authMeQueryKey, toUserProfile(response.user));
      setIsRedirecting(true);
      router.replace("/mypage");
      router.refresh();
    } catch (error) {
      setIsRedirecting(false);
      setErrorMessage(
        error instanceof AuthApiError
          ? error.message
          : "로그인 요청 중 오류가 발생했습니다.",
      );
    }
  }

  if (isCheckingAuth) {
    return null;
  }

  return (
    <AuthFormLayout>
      <AuthFormCard
        description="가입한 계정으로 로그인하고 나의 시뮬레이션 기록을 이어가세요."
        footer={
          <p className="text-center text-sm text-[#6B6458]">
            아직 계정이 없으신가요?{" "}
            <Link className="font-medium text-[#2A4232] underline-offset-4 hover:underline" href="/signup">
              회원가입
            </Link>
          </p>
        }
        title="로그인"
      >
        {signupSuccess ? (
          <div className="mb-5">
            <AuthAlert message="회원가입이 완료되었습니다. 로그인해 주세요." variant="info" />
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-5">
            <AuthAlert message={errorMessage} />
          </div>
        ) : null}

        <form className="space-y-5" noValidate onSubmit={handleSubmit(submitLogin)}>
          <AuthFormField
            autoComplete="username"
            error={errors.login_id?.message}
            id="login_id"
            label="아이디"
            maxLength={LOGIN_ID_MAX_LENGTH}
            minLength={LOGIN_ID_MIN_LENGTH}
            placeholder="아이디를 입력하세요"
            required
            type="text"
            {...register("login_id", {
              validate: (value) => validateLoginId(value) ?? true,
            })}
          />

          <AuthFormField
            autoComplete="current-password"
            error={errors.password?.message}
            id="password"
            label="비밀번호"
            maxLength={PASSWORD_MAX_LENGTH}
            placeholder="비밀번호를 입력하세요"
            required
            showPasswordToggle
            type="password"
            {...register("password", {
              validate: (value) => validateLoginPassword(value) ?? true,
            })}
          />

          <label
            className="flex items-center gap-2 text-sm text-[#4A4438]"
            htmlFor="remember_me"
          >
            <input
              className="size-4 rounded border-[rgba(42,66,50,0.25)] text-[#2A4232] focus:ring-[#3D6B52]/20"
              id="remember_me"
              type="checkbox"
              {...register("remember_me")}
            />
            로그인 유지하기
          </label>

          <AuthButton isLoading={isLoggingIn} loadingText="로그인 중..." type="submit">
            로그인
          </AuthButton>
        </form>

        <AuthDivider />

        <GoogleLoginButton
          isLoading={isGoogleLoggingIn}
          onCredential={handleGoogleCredential}
          onError={setErrorMessage}
        />
      </AuthFormCard>
    </AuthFormLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
