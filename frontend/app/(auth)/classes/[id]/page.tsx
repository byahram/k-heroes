"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Copy, Users } from "lucide-react";
import { useState } from "react";
import { SitePageShell } from "@/components/layout/site-page-shell";
import { useRequireTeacher } from "@/hooks/use-require-teacher";
import { useTeacherClass } from "@/hooks/use-teacher-classes";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
});

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

export default function ClassDetailPage() {
  const params = useParams();
  const classId = Number(params.id);
  const authMeQuery = useRequireTeacher();
  const classQuery = useTeacherClass(classId, authMeQuery.data?.grade === "teacher");
  const [copiedCode, setCopiedCode] = useState(false);

  const classRoom = classQuery.data;
  const activeMembers = classRoom?.members.filter((member) => member.is_active) ?? [];

  async function handleCopyEntryCode(entryCode: string) {
    try {
      await navigator.clipboard.writeText(entryCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(false);
    }
  }

  if (authMeQuery.isLoading || classQuery.isLoading) {
    return null;
  }

  if (!authMeQuery.data || authMeQuery.data.grade !== "teacher") {
    return null;
  }

  if (classQuery.isError || !classRoom) {
    return (
      <SitePageShell>
        <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
          <Link
            className="text-sm text-[#6B6458] transition hover:text-[#2A4232]"
            href="/classes"
          >
            ← 내 클래스로 돌아가기
          </Link>
          <div
            className="mt-8 rounded-xl border px-4 py-10 text-center text-sm text-[#6B6458]"
            style={{ borderColor: "rgba(42,66,50,0.12)", background: "rgba(253,250,244,0.8)" }}
          >
            클래스 정보를 불러오지 못했습니다.
          </div>
        </div>
      </SitePageShell>
    );
  }

  return (
    <SitePageShell>
      <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
        <header className="mb-8">
          <Link
            className="text-sm text-[#6B6458] transition hover:text-[#2A4232]"
            href="/classes"
          >
            ← 내 클래스로 돌아가기
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h1
              className="text-3xl font-semibold text-[#1A1714] sm:text-4xl"
              style={{ fontFamily: "'Noto Serif KR', serif" }}
            >
              {classRoom.name}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                classRoom.is_active ? "bg-[#E8F0EB] text-[#2A4232]" : "bg-[#F4F1EA] text-[#8A847C]"
              }`}
            >
              {classRoom.is_active ? "활성" : "비활성"}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#6B6458] sm:text-base">
            이 클래스에 소속된 학생 목록입니다.
          </p>
        </header>

        <section
          className="mb-6 rounded-xl border p-5 sm:p-6"
          style={{ borderColor: "rgba(42,66,50,0.12)", background: "rgba(253,250,244,0.8)" }}
        >
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#6B6458]">
            <span className="inline-flex items-center gap-1.5">
              <Users aria-hidden="true" className="size-4" />
              학생 {classRoom.member_count}명
            </span>
            <span>생성일 {formatDate(classRoom.created_at)}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[#3A3530]">입장코드</span>
            <code className="rounded-lg bg-white px-3 py-1.5 text-base font-semibold tracking-[0.2em] text-[#2A4232]">
              {classRoom.entry_code}
            </code>
            <button
              aria-label="입장코드 복사"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-[#6B6458] transition hover:bg-[rgba(42,66,50,0.06)] hover:text-[#2A4232]"
              onClick={() => void handleCopyEntryCode(classRoom.entry_code)}
              type="button"
            >
              <Copy aria-hidden="true" className="size-4" />
              {copiedCode ? "복사됨" : "복사"}
            </button>
          </div>
        </section>

        <section
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: "rgba(42,66,50,0.12)", background: "rgba(253,250,244,0.8)" }}
        >
          <div className="border-b px-5 py-4" style={{ borderColor: "rgba(42,66,50,0.12)" }}>
            <h2 className="text-lg font-semibold text-[#1A1714]">학생 목록</h2>
          </div>

          {activeMembers.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-[#6B6458]">
              아직 이 클래스에 참여한 학생이 없습니다.
              <br />
              입장코드를 공유해 학생이 가입할 수 있도록 안내해 주세요.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#F4F1EA] text-[#6B6458]">
                  <tr>
                    <th className="px-5 py-3 font-medium">아이디</th>
                    <th className="px-5 py-3 font-medium">이름</th>
                    <th className="px-5 py-3 font-medium">닉네임</th>
                    <th className="px-5 py-3 font-medium">참여일</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMembers.map((member) => (
                    <tr
                      key={member.membership_id}
                      className="border-t border-[rgba(42,66,50,0.08)]"
                    >
                      <td className="px-5 py-3 font-medium text-[#1A1714]">
                        {member.login_id || "—"}
                      </td>
                      <td className="px-5 py-3 text-[#3A3530]">{member.name || "—"}</td>
                      <td className="px-5 py-3 text-[#3A3530]">{member.nickname || "—"}</td>
                      <td className="px-5 py-3 text-[#8A847C]">{formatDate(member.joined_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-6">
          <Link
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[rgba(42,66,50,0.18)] bg-white px-5 text-sm font-semibold text-[#3A3530] transition hover:bg-[#F4F1EA]"
            href="/classes"
          >
            목록으로
          </Link>
        </div>
      </div>
    </SitePageShell>
  );
}
