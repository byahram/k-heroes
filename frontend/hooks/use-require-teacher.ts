"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthMe } from "@/hooks/use-auth-me";

export function useRequireTeacher(redirectTo = "/mypage") {
  const router = useRouter();
  const authMeQuery = useAuthMe();

  useEffect(() => {
    if (authMeQuery.isLoading) return;
    if (!authMeQuery.data) {
      router.replace("/login");
      return;
    }
    if (authMeQuery.data.grade !== "teacher") {
      router.replace(redirectTo);
    }
  }, [authMeQuery.data, authMeQuery.isLoading, redirectTo, router]);

  return authMeQuery;
}
