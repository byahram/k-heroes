"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Play, Menu, X } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { useAuthMe } from "@/hooks/use-auth-me";
import { useLogout } from "@/hooks/use-logout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NAV_LINKS = [
  { label: "인트로", target: "top" },
  { label: "서비스 소개", target: "service" },
  { label: "대표 인물", target: "characters" },
  { label: "활용 데이터", target: "data" },
];

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/mypage/settings")) return "설정";
  if (pathname.startsWith("/mypage")) return "마이페이지";
  if (pathname.startsWith("/faq")) return "자주 묻는 질문";
  if (pathname.startsWith("/classes")) return "클래스";
  if (pathname.startsWith("/map")) return "인물 선택";
  if (pathname.startsWith("/character")) return "인물 상세";
  if (pathname.startsWith("/simulation")) return "시뮬레이션";
  if (pathname.startsWith("/ending")) return "결과";
  if (pathname.startsWith("/legal/privacy")) return "개인정보처리방침";
  if (pathname.startsWith("/legal/terms")) return "이용약관";
  return "K-Heroes";
}

export function NavBar({ onStart }: { onStart?: () => void }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: user, isLoading: isCheckingAuth } = useAuthMe();
  const { handleLogout, isLoggingOut, logoutDialogOpen, setLogoutDialogOpen } = useLogout();
  const isLoggedIn = Boolean(user);
  const displayName = user?.nickname || user?.name || user?.login_id || "회원";
  const isHome = pathname === "/";
  const pageTitle = getPageTitle(pathname);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const scrollToSection = (target: string) => {
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileOpen(false);
  };

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          background: scrolled
            ? "rgba(253,250,244,0.94)"
            : "transparent",
          backdropFilter: scrolled ? "blur(14px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(42,66,50,0.1)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <BrandLogo showBeta />

          {isHome ? (
            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => scrollToSection(item.target)}
                  className="transition-colors text-sm"
                  style={{ color: "#4A4438", fontFamily: "'Noto Sans KR', sans-serif" }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : (
            <div
              className="pointer-events-none absolute left-1/2 max-w-[42vw] -translate-x-1/2 truncate text-center"
              style={{
                color: "#2A4232",
                fontFamily: "'Noto Serif KR', serif",
                fontSize: "0.98rem",
                fontWeight: 800,
              }}
            >
              {pageTitle}
            </div>
          )}

          {/* CTA */}
          <div className="flex items-center gap-3">
            {!isCheckingAuth && (
              isLoggedIn ? (
                <Link
                  href="/mypage"
                  className="hidden md:inline-flex max-w-40 truncate text-sm font-medium transition-colors hover:text-[#2A4232]"
                  style={{ color: "#4A4438", fontFamily: "'Noto Sans KR', sans-serif" }}
                  title={`${displayName}님 마이페이지로 이동`}
                >
                  {displayName}님 환영합니다
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="hidden md:inline-flex text-sm transition-colors hover:text-[#2A4232]"
                  style={{ color: "#4A4438", fontFamily: "'Noto Sans KR', sans-serif" }}
                >
                  로그인
                </Link>
              )
            )}
            <button
              onClick={onStart}
              className="hidden md:flex items-center gap-2 text-white text-sm px-4 py-2 rounded-lg transition-all hover:opacity-90"
              style={{
                background: "#2A4232",
                fontFamily: "'Noto Sans KR', sans-serif",
                fontWeight: 500,
                border: "1px solid rgba(61,107,82,0.5)",
              }}
            >
              <Play className="w-3 h-3 fill-current" />
              이야기 시작하기
            </button>
            <button
              className="md:hidden p-1"
              style={{ color: "#2A4232" }}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div
            className="md:hidden px-6 pb-4"
            style={{ background: "rgba(253,250,244,0.97)", borderTop: "1px solid rgba(42,66,50,0.08)" }}
          >
            {isHome &&
              NAV_LINKS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => scrollToSection(item.target)}
                  className="block py-3 text-sm border-b"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    color: "#4A4438",
                    borderColor: "rgba(42,66,50,0.08)",
                    fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                >
                  {item.label}
                </button>
              ))}
            {!isCheckingAuth && (
              <div className="mt-4 space-y-2">
                {isLoggedIn ? (
                  <>
                    <Link
                      href="/mypage"
                      className="block w-full truncate rounded-lg border bg-[rgba(42,66,50,0.04)] px-4 py-3 text-center text-sm font-medium transition-colors hover:bg-[rgba(42,66,50,0.08)]"
                      onClick={() => setMobileOpen(false)}
                      style={{
                        color: "#4A4438",
                        borderColor: "rgba(42,66,50,0.18)",
                        fontFamily: "'Noto Sans KR', sans-serif",
                      }}
                      title={`${displayName}님 마이페이지로 이동`}
                    >
                      {displayName}님 환영합니다
                    </Link>
                    <button
                      className="block w-full rounded-lg border px-4 py-2.5 text-center text-sm transition-colors hover:bg-[rgba(42,66,50,0.04)] disabled:opacity-60"
                      disabled={isLoggingOut}
                      onClick={() => {
                        setMobileOpen(false);
                        void handleLogout();
                      }}
                      style={{
                        color: "#4A4438",
                        borderColor: "rgba(42,66,50,0.18)",
                        fontFamily: "'Noto Sans KR', sans-serif",
                      }}
                      type="button"
                    >
                      {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="block w-full rounded-lg border py-2.5 text-center text-sm transition-colors hover:bg-[rgba(42,66,50,0.04)]"
                    onClick={() => setMobileOpen(false)}
                    style={{
                      color: "#4A4438",
                      borderColor: "rgba(42,66,50,0.18)",
                      fontFamily: "'Noto Sans KR', sans-serif",
                    }}
                  >
                    로그인
                  </Link>
                )}
              </div>
            )}
            <button
              onClick={onStart}
              className="mt-2 w-full flex items-center justify-center gap-2 text-white text-sm px-4 py-2.5 rounded-lg"
              style={{ background: "#2A4232" }}
            >
              <Play className="w-3 h-3 fill-current" />
              이야기 시작하기
            </button>
          </div>
        )}
      </nav>

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
            <button
              className="w-full rounded-lg bg-[#2A4232] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              onClick={() => setLogoutDialogOpen(false)}
              style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
              type="button"
            >
              확인
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
