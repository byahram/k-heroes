"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, Mail, RotateCcw, Shield, UserRound } from "lucide-react";
import { ChoicePathSteps } from "@/components/mypage/choice-path-steps";
import { MypageCollapsibleSection } from "@/components/mypage/mypage-collapsible-section";
import {
  MypageSessionFilters,
  type SessionHistoryFilters,
} from "@/components/mypage/mypage-session-filters";
import { PagePagination } from "@/components/ui/page-pagination";
import {
  gradeLabels,
  type PlaySessionItem,
  type UserProfile,
} from "@/lib/auth/types";
import { AuthProviderBadge } from "@/components/auth/auth-provider-badge";
import { getSessionActions, type SessionLinkAction } from "@/lib/mypage/session-links";
import { cn } from "@/lib/utils/cn";

const SESSION_PAGE_SIZE = 5;

type MypageProfileCardProps = {
  user: UserProfile;
  completedCount: number;
  averageHistoryScore: number | null;
};

export function MypageProfileCard({ user, completedCount, averageHistoryScore }: MypageProfileCardProps) {
  const displayName = user.nickname || user.name || user.login_id || "회원";
  const initials = displayName.slice(0, 2);

  return (
    <section
      className="rounded-2xl border p-6 sm:p-8"
      style={{
        background: "rgba(253,250,244,0.94)",
        borderColor: "rgba(42,66,50,0.12)",
      }}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #2A4232 0%, #3D6B52 100%)" }}
          >
            {initials}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="text-2xl font-semibold text-[#1A1714]"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                {displayName}
              </h1>
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ background: "rgba(42,66,50,0.08)", color: "#3D6B52" }}
              >
                {gradeLabels[user.grade]}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#6B6458]">가입일 {formatDate(user.created_at)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:min-w-[220px]">
          <StatBox label="완료한 이야기" value={`${completedCount}`} />
          <StatBox
            label="평균 역사 점수"
            value={`${Math.round(averageHistoryScore ?? 0)}점`}
          />
        </div>
      </div>
    </section>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border px-4 py-3 text-center"
      style={{ borderColor: "rgba(42,66,50,0.1)", background: "rgba(42,66,50,0.03)" }}
    >
      <p className="text-lg font-semibold text-[#2A4232]">{value}</p>
      <p className="mt-1 text-xs text-[#8A847C]">{label}</p>
    </div>
  );
}

type MypageAccountInfoProps = {
  user: UserProfile;
  footer?: ReactNode;
};

export function MypageAccountInfo({ user, footer }: MypageAccountInfoProps) {
  const rows = [
    { icon: UserRound, label: "아이디", value: user.login_id || "-" },
    { icon: Shield, label: "닉네임", value: user.nickname || "미등록" },
    { icon: UserRound, label: "이름", value: user.name || "미등록" },
    { icon: Mail, label: "이메일", value: user.email || "미등록" },
    { icon: CalendarDays, label: "최근 업데이트", value: formatDateTime(user.updated_at) },
  ];

  return (
    <MypageCollapsibleSection
      headerAction={
        <Link
          className="rounded-lg border px-3 py-1.5 text-sm font-medium text-[#2A4232] transition hover:bg-[rgba(42,66,50,0.06)]"
          href="/mypage/settings"
          style={{ borderColor: "rgba(42,66,50,0.18)" }}
        >
          정보 수정
        </Link>
      }
      title="계정 정보"
    >
      <dl className="space-y-4">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-start gap-3 border-b pb-4 last:border-b-0 last:pb-0"
            style={{ borderColor: "rgba(42,66,50,0.08)" }}
          >
            <row.icon aria-hidden className="mt-0.5 size-4 shrink-0 text-[#8A847C]" />
            <div className="min-w-0 flex-1">
              <dt className="text-xs text-[#8A847C]">{row.label}</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#3A3530]">
                <span>{row.value}</span>
                {row.label === "아이디" ? <AuthProviderBadge provider={user.auth_provider} /> : null}
              </dd>
            </div>
          </div>
        ))}
      </dl>

      {footer ? (
        <div
          className="mt-5 space-y-3 border-t pt-5"
          style={{ borderColor: "rgba(42,66,50,0.08)" }}
        >
          {footer}
        </div>
      ) : null}
    </MypageCollapsibleSection>
  );
}

type MypageSessionHistoryProps = {
  currentPage: number;
  errorMessage?: string | null;
  isLoading?: boolean;
  onPageChange: Dispatch<SetStateAction<number>>;
  onReset: () => void;
  onSearch: () => void;
  onFiltersChange: Dispatch<SetStateAction<SessionHistoryFilters>>;
  sessions: PlaySessionItem[];
  total: number;
  totalPages: number;
  values: SessionHistoryFilters;
};

export function MypageSessionHistory({
  currentPage,
  errorMessage = null,
  isLoading = false,
  onFiltersChange,
  onPageChange,
  onReset,
  onSearch,
  sessions,
  total,
  totalPages,
  values,
}: MypageSessionHistoryProps) {
  return (
    <MypageCollapsibleSection meta={`총 ${total}건`} title="나의 시뮬레이션 기록">
      <MypageSessionFilters
        onChange={onFiltersChange}
        onReset={onReset}
        onSearch={onSearch}
        values={values}
      />

      {errorMessage ? (
        <p
          className="mt-8 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-[#8A847C]"
          style={{ borderColor: "rgba(42,66,50,0.15)" }}
        >
          {errorMessage}
        </p>
      ) : isLoading ? (
        <p
          className="mt-8 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-[#8A847C]"
          style={{ borderColor: "rgba(42,66,50,0.15)" }}
        >
          시뮬레이션 기록을 불러오는 중입니다.
        </p>
      ) : sessions.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-[#8A847C]" style={{ borderColor: "rgba(42,66,50,0.15)" }}>
          아직 완료한 시뮬레이션이 없습니다. 첫 이야기를 시작해 보세요.
        </p>
      ) : (
        <>
          <ul className="mt-5 space-y-3">
            {sessions.map((session, index) => (
              <SessionHistoryCard
                key={session.id}
                session={session}
                sessionNumber={total - currentPage * SESSION_PAGE_SIZE - index}
              />
            ))}
          </ul>

          <PagePagination
            alwaysShow={totalPages > 1}
            onPageChange={onPageChange}
            page={currentPage}
            pageSize={SESSION_PAGE_SIZE}
            total={total}
          />
        </>
      )}
    </MypageCollapsibleSection>
  );
}

function formatScenarioTitle(session: PlaySessionItem) {
  if (session.scenario_sort_order == null) {
    return session.scenario_title;
  }

  const prefix = String(session.scenario_sort_order + 1).padStart(2, "0");
  return `${prefix} · ${session.scenario_title}`;
}

function isScenarioUnavailable(session: PlaySessionItem) {
  return session.scenario_sort_order == null;
}

function SessionActionButtons({ actions }: { actions: SessionLinkAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-2 sm:w-[10.5rem]">
      {actions.map((action) => (
        <Link
          key={action.label}
          className={cn(
            "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition active:scale-[0.98]",
            action.variant === "primary"
              ? "text-white shadow-[0_2px_10px_rgba(30,51,40,0.2)] hover:opacity-95"
              : "border border-[rgba(42,66,50,0.14)] bg-white/80 text-[#2A4232] hover:bg-[rgba(42,66,50,0.05)]",
          )}
          href={action.href}
          style={
            action.variant === "primary"
              ? { background: "linear-gradient(135deg, #1E3328 0%, #3D6B52 100%)" }
              : undefined
          }
        >
          <span className="truncate">{action.label}</span>
          {action.label === "다시 하기" ? (
            <RotateCcw aria-hidden className="size-3.5 shrink-0 opacity-80" />
          ) : null}
          {action.label === "결과 보기" ? (
            <ChevronRight aria-hidden className="size-3.5 shrink-0 opacity-90" />
          ) : null}
        </Link>
      ))}
    </div>
  );
}

function SessionHistoryCard({
  session,
  sessionNumber,
}: {
  session: PlaySessionItem;
  sessionNumber: number;
}) {
  const unavailable = isScenarioUnavailable(session);
  const actions = unavailable ? [] : getSessionActions(session);

  return (
    <li
      className="relative overflow-hidden rounded-xl border"
      style={{ borderColor: "rgba(42,66,50,0.1)" }}
    >
      <div
        className={`px-4 py-4 transition ${unavailable ? "pointer-events-none select-none" : "hover:bg-[rgba(42,66,50,0.03)]"}`}
        style={unavailable ? { filter: "grayscale(0.35)", opacity: 0.55 } : undefined}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums"
              style={{
                background: "rgba(42,66,50,0.08)",
                color: "#3D6B52",
              }}
            >
              #{sessionNumber}
            </span>
            <p className="font-medium text-[#2A4232]">{session.character_name}</p>
            <SessionStatusBadge />
          </div>
          <p className="mt-1 text-sm text-[#4A4438]">{formatScenarioTitle(session)}</p>
          <p className="mt-2 text-xs text-[#8A847C]">
            {session.completed_at
              ? `완료 · ${formatDateTime(session.completed_at)}`
              : formatDateTime(session.created_at)}
          </p>

          {session.choices_path.length > 0 ? (
            <div className="mt-3">
              <p className="mb-2 text-xs font-medium text-[#6B6458]">
                선택 경로 · {session.choices_path.map((choice) => choice.toUpperCase()).join("-")}
              </p>
              <ChoicePathSteps
                choices={session.choices_path}
                choicesHistory={session.choices_history}
                status="completed"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end sm:text-right">
          <div>
            <p className="text-lg font-semibold text-[#2A4232]">{session.history_score}점</p>
            <p className="text-xs text-[#8A847C]">역사 이해도</p>
          </div>

          <SessionActionButtons actions={actions} />
        </div>
        </div>
      </div>

      {unavailable ? (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl"
          style={{
            background:
              "repeating-linear-gradient(-45deg, rgba(42,66,50,0.04) 0, rgba(42,66,50,0.04) 8px, rgba(253,250,244,0.55) 8px, rgba(253,250,244,0.55) 16px)",
          }}
        >
          <span
            className="rounded-lg border px-4 py-2 text-sm font-semibold tracking-[0.12em] text-[#6B6458] shadow-sm"
            style={{
              borderColor: "rgba(42,66,50,0.18)",
              background: "rgba(253,250,244,0.94)",
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            삭제된 시나리오
          </span>
        </div>
      ) : null}
    </li>
  );
}

function SessionStatusBadge() {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        background: "rgba(61,107,82,0.12)",
        color: "#3D6B52",
      }}
    >
      완료
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
