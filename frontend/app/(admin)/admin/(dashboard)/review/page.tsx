"use client";

import { useState } from "react";
import { Eye, Clock, Search, Trash2, Calendar, FileText, CheckCircle2, RefreshCw } from "lucide-react";
import { AdminPageHeader } from "@/app/(admin)/_components/admin-page-header";
import { AdminButton } from "@/app/(admin)/_components/admin-button";
import { AdminInput } from "@/app/(admin)/_components/admin-input";
import Link from "next/link";

type DraftScenario = {
  id: string;
  characterName: string;
  era: string;
  status: "ready_for_review" | "text_only";
  createdAt: string;
  turnsCount: number;
  hasImages: boolean;
};

const INITIAL_DRAFTS: DraftScenario[] = [
  {
    id: "song-man-gap",
    characterName: "송만갑",
    era: "근현대",
    status: "ready_for_review",
    createdAt: "2026-06-26 10:20",
    turnsCount: 3,
    hasImages: true,
  },
  {
    id: "gojong",
    characterName: "고종",
    era: "근현대",
    status: "ready_for_review",
    createdAt: "2026-06-26 09:40",
    turnsCount: 3,
    hasImages: true,
  },
  {
    id: "ahn-jung-geun",
    characterName: "안중근",
    era: "일제강점기",
    status: "text_only",
    createdAt: "2026-06-26 11:35",
    turnsCount: 3,
    hasImages: false,
  },
];

export default function ReviewListPage() {
  const [drafts, setDrafts] = useState<DraftScenario[]>(INITIAL_DRAFTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "ready" | "text_only">("all");

  const filteredDrafts = drafts.filter((draft) => {
    const matchesSearch = draft.characterName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          draft.era.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterTab === "all") return matchesSearch;
    if (filterTab === "ready") return matchesSearch && draft.status === "ready_for_review";
    if (filterTab === "text_only") return matchesSearch && draft.status === "text_only";
    return matchesSearch;
  });

  const handleDeleteDraft = (id: string) => {
    if (confirm("정말 이 임시 생성된 시나리오 초안을 삭제하시겠습니까?")) {
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="시나리오 검수 및 배포"
        description="AI 파이프라인으로 생성된 시나리오 초안(Draft)을 검수하고, 실제 유저가 이용 가능하도록 최종 배포를 제어합니다."
      />

      {/* 검색 및 탭 필터 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 border-b border-[#E8E4DC] pb-px">
          <button
            onClick={() => setFilterTab("all")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
              filterTab === "all"
                ? "border-[#2A4232] text-[#2A4232]"
                : "border-transparent text-[#8A847C] hover:text-[#3A3530]"
            }`}
          >
            전체 ({drafts.length})
          </button>
          <button
            onClick={() => setFilterTab("ready")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
              filterTab === "ready"
                ? "border-[#2A4232] text-[#2A4232]"
                : "border-transparent text-[#8A847C] hover:text-[#3A3530]"
            }`}
          >
            검수 대기 ({drafts.filter(d => d.status === "ready_for_review").length})
          </button>
          <button
            onClick={() => setFilterTab("text_only")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
              filterTab === "text_only"
                ? "border-[#2A4232] text-[#2A4232]"
                : "border-transparent text-[#8A847C] hover:text-[#3A3530]"
            }`}
          >
            이미지 미생성 ({drafts.filter(d => d.status === "text_only").length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#8A847C]">
            <Search className="size-4" />
          </div>
          <input
            type="text"
            placeholder="인물명 또는 시대 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#E8E4DC] text-[#1A1714] placeholder-[#8A847C] focus:border-[#2A4232] focus:outline-none"
          />
        </div>
      </div>

      {/* 초안 목록 카드 리스트 */}
      {filteredDrafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#E8E4DC] bg-white py-16 text-center text-[#8A847C]">
          <FileText className="size-12 stroke-1 mb-3" />
          <p className="text-sm font-medium">검수 대기 중인 초안이 없습니다.</p>
          <p className="text-xs mt-1">AI 파이프라인에서 시나리오를 먼저 생성해 주세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDrafts.map((draft) => (
            <div
              key={draft.id}
              className="group flex flex-col justify-between rounded-xl border border-[#E8E4DC] bg-white p-5 hover:shadow-md hover:border-[#8A847C] transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex rounded-md bg-[#F4F1EA] px-2.5 py-0.5 text-xs font-semibold text-[#3A3530] border border-[#E8E4DC]">
                    {draft.era}
                  </span>
                  
                  {draft.status === "ready_for_review" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="size-3" />
                      검수 가능
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md animate-pulse">
                      <RefreshCw className="size-3" />
                      이미지 없음
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-lg font-bold text-[#1A1714]" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                    {draft.characterName}
                  </h4>
                  <p className="text-xs text-[#8A847C] mt-1">
                    총 {draft.turnsCount}개의 플레이 턴 구성
                  </p>
                </div>
              </div>

              <div className="border-t border-[#F0ECE4] mt-5 pt-4 flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-[#8A847C]">
                  <Calendar className="size-3.5" />
                  <span>{draft.createdAt}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    aria-label="삭제"
                    onClick={() => handleDeleteDraft(draft.id)}
                    className="flex size-8 items-center justify-center rounded-md border border-[#E8E4DC] text-red-600 bg-white hover:bg-red-50 hover:border-red-200 transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>

                  <Link href={`/admin/review/${draft.id}`}>
                    <span className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-md bg-[#2A4232] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#1E3024] transition-colors">
                      <Eye className="size-3.5" />
                      검수하기
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
