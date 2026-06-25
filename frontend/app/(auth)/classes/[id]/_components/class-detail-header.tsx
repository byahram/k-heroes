"use client";

import Link from "next/link";
import { Copy, Users } from "lucide-react";
import { useState } from "react";
import type { ClassRoomDetail } from "@/lib/classroom/types";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
});

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

type ClassDetailHeaderProps = {
  classRoom: ClassRoomDetail;
};

export function ClassDetailHeader({ classRoom }: ClassDetailHeaderProps) {
  const [copiedCode, setCopiedCode] = useState(false);

  async function handleCopyEntryCode(entryCode: string) {
    try {
      await navigator.clipboard.writeText(entryCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(false);
    }
  }

  return (
    <>
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
              classRoom.is_active
                ? "bg-[#E8F0EB] text-[#2A4232]"
                : "bg-[#F4F1EA] text-[#8A847C]"
            }`}
          >
            {classRoom.is_active ? "활성" : "비활성"}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[#6B6458] sm:text-base">
          클래스 학생과 시뮬레이션 기록을 확인할 수 있습니다.
        </p>
      </header>

      <section
        className="mb-6 rounded-xl border p-5 sm:p-6"
        style={{
          borderColor: "rgba(42,66,50,0.12)",
          background: "rgba(253,250,244,0.8)",
        }}
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
    </>
  );
}
