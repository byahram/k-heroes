"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthButton } from "@/components/auth/auth-button";
import { getGoogleClientId } from "@/lib/auth/google-config";
import { cn } from "@/lib/utils/cn";

type GoogleLoginButtonProps = {
  disabled?: boolean;
  isLoading?: boolean;
  label?: string;
  onBeforeSignIn?: () => boolean | Promise<boolean>;
  onCredential: (idToken: string) => void | Promise<void>;
  onError?: (message: string) => void;
};

export function GoogleLoginButton({
  disabled = false,
  isLoading = false,
  label = "Google로 계속하기",
  onBeforeSignIn,
  onCredential,
  onError,
}: GoogleLoginButtonProps) {
  const clientId = getGoogleClientId();
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const onCredentialRef = useRef(onCredential);
  const onBeforeSignInRef = useRef(onBeforeSignIn);
  const onErrorRef = useRef(onError);
  const disabledRef = useRef(disabled);
  const isLoadingRef = useRef(isLoading);
  const [scriptReady, setScriptReady] = useState(false);
  const [buttonWidth, setButtonWidth] = useState(0);

  onCredentialRef.current = onCredential;
  onBeforeSignInRef.current = onBeforeSignIn;
  onErrorRef.current = onError;
  disabledRef.current = disabled;
  isLoadingRef.current = isLoading;

  const handleCredential = useCallback(async (response: CredentialResponse) => {
    if (disabledRef.current || isLoadingRef.current) {
      return;
    }

    if (onBeforeSignInRef.current) {
      const allowed = await onBeforeSignInRef.current();
      if (!allowed) {
        return;
      }
    }

    const idToken = response.credential?.trim();
    if (!idToken) {
      onErrorRef.current?.("구글 로그인 정보를 받지 못했습니다.");
      return;
    }

    try {
      await onCredentialRef.current(idToken);
    } catch {
      // 상위에서 에러 메시지를 처리합니다.
    }
  }, []);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setButtonWidth(element.offsetWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!scriptReady || !clientId || !window.google || initializedRef.current) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
    });
    initializedRef.current = true;
  }, [clientId, handleCredential, scriptReady]);

  useEffect(() => {
    if (
      !scriptReady ||
      !clientId ||
      !containerRef.current ||
      !window.google ||
      !initializedRef.current ||
      buttonWidth <= 0
    ) {
      return;
    }

    containerRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(containerRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      width: buttonWidth,
      locale: "ko",
    });
  }, [buttonWidth, clientId, scriptReady]);

  if (!clientId) {
    return (
      <AuthButton
        className="w-full font-medium"
        disabled={disabled || isLoading}
        onClick={() => onError?.("구글 로그인이 설정되지 않았습니다.")}
        type="button"
        variant="secondary"
      >
        <GoogleIcon />
        {label}
      </AuthButton>
    );
  }

  return (
    <>
      <Script
        onLoad={() => setScriptReady(true)}
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
      />

      <div
        className={cn(
          "relative w-full",
          (disabled || isLoading) && "pointer-events-none opacity-60",
        )}
        ref={wrapperRef}
      >
        <AuthButton
          aria-hidden
          className="pointer-events-none w-full font-medium"
          tabIndex={-1}
          type="button"
          variant="secondary"
        >
          <GoogleIcon />
          {isLoading ? "로그인 중..." : label}
        </AuthButton>

        <div className="absolute inset-0 overflow-hidden opacity-[0.01]">
          <div className="size-full" ref={containerRef} />
        </div>
      </div>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden className="size-5" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
