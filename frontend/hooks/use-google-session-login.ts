"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthApiError, fetchAuthApiJson } from "@/lib/auth/auth-api";
import { authMeQueryKey, toUserProfile } from "@/hooks/use-auth-me";
import type { UserProfile } from "@/lib/auth/types";

type GoogleSessionResponse = {
  user: UserProfile;
};

export function useGoogleSessionLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const loginWithGoogleIdToken = useCallback(
    async (idToken: string) => {
      setIsLoggingIn(true);

      try {
        const response = await fetchAuthApiJson<GoogleSessionResponse>("/api/v2/auth/google/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id_token: idToken }),
        });

        queryClient.setQueryData(authMeQueryKey, toUserProfile(response.user));
        router.replace("/mypage");
        router.refresh();
      } catch (error) {
        setIsLoggingIn(false);
        throw error instanceof AuthApiError
          ? error
          : new AuthApiError(0, "구글 로그인 요청 중 오류가 발생했습니다.");
      }
    },
    [queryClient, router],
  );

  return {
    isLoggingIn,
    loginWithGoogleIdToken,
  };
}
