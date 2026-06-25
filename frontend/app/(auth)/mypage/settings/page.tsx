"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthFormField } from "@/components/auth/auth-form-field";
import { AuthProviderBadge } from "@/components/auth/auth-provider-badge";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { SitePageShell } from "@/components/layout/site-page-shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authMeQueryKey, toUserProfile, useAuthMe } from "@/hooks/use-auth-me";
import { AuthApiError, fetchAuthApiJson } from "@/lib/auth/auth-api";
import { EMAIL_MAX_LENGTH, validateOptionalEmail } from "@/lib/auth/email-policy";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validatePassword } from "@/lib/auth/password-policy";
import type { UserProfile } from "@/lib/auth/types";

type AccountSettingsFormValues = {
  name: string;
  email: string;
  nickname: string;
  current_password: string;
  new_password: string;
  new_password_confirm: string;
};

function wantsPasswordChange(values: AccountSettingsFormValues) {
  return (
    values.current_password.length > 0 ||
    values.new_password.length > 0 ||
    values.new_password_confirm.length > 0
  );
}

type AccountSettingsFormProps = {
  user: UserProfile;
};

function AccountSettingsForm({ user }: AccountSettingsFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isLocalAccount = user.auth_provider === "local";
  const isGoogleAccount = user.auth_provider === "google";

  const {
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
    reset,
    trigger,
    watch,
  } = useForm<AccountSettingsFormValues>({
    defaultValues: {
      name: user.name ?? "",
      email: user.email ?? "",
      nickname: user.nickname ?? "",
      current_password: "",
      new_password: "",
      new_password_confirm: "",
    },
    mode: "onChange",
  });

  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorDialogMessage, setErrorDialogMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const formValues = watch();
  const newPassword = formValues.new_password;

  function openErrorDialog(message: string) {
    setErrorDialogMessage(message);
    setErrorDialogOpen(true);
  }

  function handleSuccessDialogClose() {
    setSuccessDialogOpen(false);
    router.push("/mypage");
  }

  async function submitSettings(data: AccountSettingsFormValues) {
    setErrorDialogOpen(false);
    setErrorDialogMessage("");
    setSuccessDialogOpen(false);

    const name = data.name.trim();
    const email = data.email.trim();
    const nickname = data.nickname.trim();
    const shouldChangePassword = isLocalAccount && wantsPasswordChange(data);

    try {
      const payload: {
        name: string | null;
        email?: string | null;
        nickname: string | null;
        current_password?: string;
        new_password?: string;
      } = {
        name: name || null,
        nickname: nickname || null,
      };

      if (isLocalAccount) {
        payload.email = email || null;
      }

      if (shouldChangePassword) {
        payload.current_password = data.current_password.trim();
        payload.new_password = data.new_password;
      }

      const response = await fetchAuthApiJson<UserProfile>("/api/v2/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      queryClient.setQueryData(authMeQueryKey, toUserProfile(response));
      reset({
        name: response.name ?? "",
        email: response.email ?? "",
        nickname: response.nickname ?? "",
        current_password: "",
        new_password: "",
        new_password_confirm: "",
      });
      setSuccessDialogOpen(true);
    } catch (error) {
      if (error instanceof AuthApiError) {
        openErrorDialog(error.message);
      } else {
        openErrorDialog("계정 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    }
  }

  return (
    <>
      <form
      className="space-y-8 rounded-2xl border p-6 sm:p-8"
      noValidate
      onSubmit={handleSubmit(submitSettings)}
      style={{
        background: "rgba(253,250,244,0.94)",
        borderColor: "rgba(42,66,50,0.12)",
      }}
    >
      <section className="space-y-5">
        <div>
          <h2
            className="text-lg font-semibold text-[#1A1714]"
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            기본 정보
          </h2>
          <p className="mt-1 text-xs text-[#8A847C]">
            <span className="text-[#9A3F38]">*</span> 표시는 필수 입력 항목입니다. 아이디는 변경할 수 없습니다.
          </p>
        </div>

        <AuthFormField
          autoComplete="username"
          defaultValue={user.login_id ?? ""}
          disabled
          id="login_id"
          label="아이디"
          labelAddon={<AuthProviderBadge provider={user.auth_provider} />}
          name="login_id"
          type="text"
        />

        <AuthFormField
          autoComplete="nickname"
          error={errors.nickname?.message}
          id="nickname"
          label="닉네임"
          maxLength={100}
          placeholder="닉네임을 입력하세요"
          type="text"
          {...register("nickname", {
            validate: (value) => value.trim() !== "" || "닉네임을 입력해 주세요.",
          })}
          required
        />

        <AuthFormField
          autoComplete="name"
          error={errors.name?.message}
          id="name"
          label="이름"
          maxLength={100}
          placeholder="이름 (선택)"
          type="text"
          {...register("name")}
        />

        {isGoogleAccount ? (
          <AuthFormField
            autoComplete="email"
            defaultValue={user.email ?? ""}
            disabled
            id="email"
            label="이메일"
            name="email"
            type="email"
            hint="Google 계정에서 연동된 이메일입니다. 변경할 수 없습니다."
          />
        ) : (
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
        )}
      </section>

      {isLocalAccount ? (
        <section className="space-y-5 border-t pt-8" style={{ borderColor: "rgba(42,66,50,0.08)" }}>
          <div>
            <h2
              className="text-lg font-semibold text-[#1A1714]"
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              비밀번호 변경
            </h2>
            <p className="mt-1 text-xs text-[#8A847C]">
              변경하지 않으려면 비밀번호 항목을 비워 두세요.
            </p>
          </div>

          <AuthFormField
            autoComplete="current-password"
            error={errors.current_password?.message}
            id="current_password"
            label="현재 비밀번호"
            maxLength={PASSWORD_MAX_LENGTH}
            placeholder="현재 비밀번호"
            showPasswordToggle
            type="password"
            {...register("current_password", {
              onChange: () => {
                if (getValues("new_password") || getValues("new_password_confirm")) {
                  void trigger(["current_password", "new_password", "new_password_confirm"]);
                }
              },
              validate: (value) => {
                if (!wantsPasswordChange(getValues())) {
                  return true;
                }
                return value.trim() !== "" || "현재 비밀번호를 입력해 주세요.";
              },
            })}
            required
          />

          <AuthFormField
            autoComplete="new-password"
            error={errors.new_password?.message}
            id="new_password"
            label="새 비밀번호"
            maxLength={PASSWORD_MAX_LENGTH}
            minLength={PASSWORD_MIN_LENGTH}
            placeholder="새 비밀번호"
            showPasswordToggle
            type="password"
            {...register("new_password", {
              onChange: () => {
                if (getValues("new_password_confirm")) {
                  void trigger("new_password_confirm");
                }
                void trigger(["current_password", "new_password_confirm"]);
              },
              validate: (value) => {
                if (!wantsPasswordChange(getValues())) {
                  return true;
                }
                return validatePassword(value) ?? true;
              },
            })}
            required
          />

          {newPassword ? <PasswordRequirements password={newPassword} /> : null}

          <AuthFormField
            autoComplete="new-password"
            error={errors.new_password_confirm?.message}
            id="new_password_confirm"
            label="새 비밀번호 확인"
            maxLength={PASSWORD_MAX_LENGTH}
            minLength={PASSWORD_MIN_LENGTH}
            placeholder="새 비밀번호 확인"
            showPasswordToggle
            type="password"
            {...register("new_password_confirm", {
              onChange: () => {
                void trigger(["current_password", "new_password"]);
              },
              validate: (value) => {
                if (!wantsPasswordChange(getValues())) {
                  return true;
                }
                return value === getValues("new_password") || "새 비밀번호 확인이 일치하지 않습니다.";
              },
            })}
            required
          />
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <AuthButton isLoading={isSubmitting} loadingText="저장 중..." type="submit">
          변경 사항 저장
        </AuthButton>
        <AuthButton onClick={() => router.push("/mypage")} type="button" variant="secondary">
          취소
        </AuthButton>
      </div>
    </form>

    <Dialog
      onOpenChange={(nextOpen) => {
        setErrorDialogOpen(nextOpen);
        if (!nextOpen) {
          setErrorDialogMessage("");
        }
      }}
      open={errorDialogOpen}
    >
      <DialogContent className="border-[rgba(42,66,50,0.12)] bg-[#FDFAF4] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1A1714]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            저장 실패
          </DialogTitle>
          <DialogDescription className="text-left text-sm leading-relaxed text-[#6B6458]">
            {errorDialogMessage}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <AuthButton className="w-full" onClick={() => setErrorDialogOpen(false)} type="button">
            확인
          </AuthButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleSuccessDialogClose();
        }
      }}
      open={successDialogOpen}
    >
      <DialogContent className="border-[rgba(42,66,50,0.12)] bg-[#FDFAF4] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1A1714]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            저장 완료
          </DialogTitle>
          <DialogDescription className="text-left text-sm leading-relaxed text-[#6B6458]">
            계정 정보가 저장되었습니다.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <AuthButton className="w-full" onClick={handleSuccessDialogClose} type="button">
            확인
          </AuthButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const authMeQuery = useAuthMe();
  const user = authMeQuery.data;

  useEffect(() => {
    if (!authMeQuery.isLoading && authMeQuery.data === null && !authMeQuery.isError) {
      router.replace("/login");
    }
  }, [authMeQuery.data, authMeQuery.isError, authMeQuery.isLoading, router]);

  if (authMeQuery.isLoading) {
    return null;
  }

  if (authMeQuery.isError) {
    return (
      <SitePageShell>
        <div className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
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

  if (!user) {
    return null;
  }

  return (
    <SitePageShell>
      <div className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
        <header className="mb-8">
          <Link
            className="text-sm text-[#6B6458] transition hover:text-[#2A4232]"
            href="/mypage"
          >
            ← 마이페이지로 돌아가기
          </Link>
          <h1
            className="mt-4 text-3xl font-semibold text-[#1A1714]"
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            계정 정보 변경
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#6B6458]">
            {user.auth_provider === "google"
              ? "닉네임과 이름을 수정할 수 있습니다. 이메일은 구글 계정에서 연동된 값만 표시됩니다."
              : "닉네임, 이름, 이메일과 비밀번호를 수정할 수 있습니다."}
          </p>
        </header>

        <AccountSettingsForm user={user} />
      </div>
    </SitePageShell>
  );
}
