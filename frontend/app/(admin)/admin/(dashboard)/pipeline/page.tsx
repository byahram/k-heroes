"use client";

import { useState, useEffect } from "react";
import { Sparkles, CheckCircle, AlertCircle, RefreshCw, Layers, Image as ImageIcon, Play, ArrowRight, AlertTriangle } from "lucide-react";
import { AdminPageHeader } from "@/app/(admin)/_components/admin-page-header";
import { AdminButton } from "@/app/(admin)/_components/admin-button";
import { AdminSelect } from "@/app/(admin)/_components/admin-select";
import Link from "next/link";
import { useRouter } from "next/navigation";

type TaskStep = {
  label: string;
  progress: number;
};

const GENERATION_STEPS: TaskStep[] = [
  { label: "역사 인물 인메모리 프로필 빌드 중...", progress: 15 },
  { label: "RAG 벡터 자료 검색 및 매핑 컨텍스트 작성 중...", progress: 35 },
  { label: "시나리오 1, 2, 3턴 시퀀셜 플롯 텍스트 생성 중...", progress: 55 },
  { label: "8가지 다중 엔딩 시나리오 분기 및 팩트 교정 중...", progress: 75 },
  { label: "캐릭터 전신 일러스트 및 턴별 상황 이미지(DALL-E 3) 생성 중...", progress: 95 },
  { label: "시나리오 검수 대기(Draft) 상태로 저장 완료!", progress: 100 },
];

export default function PipelinePage() {
  const router = useRouter();
  const [charName, setCharName] = useState("");
  const [era, setEra] = useState("근현대");
  const [selectedRag, setSelectedRag] = useState("history_db.pkl");
  const [genImages, setGenImages] = useState(true);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const handleStartPipeline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim()) {
      setErrorMsg("대상 인물 이름을 입력해 주세요.");
      return;
    }
    setErrorMsg("");
    setStatus("running");
    setProgress(0);
    setCurrentStepIdx(0);
  };

  // 모의 진행률 증가 로직
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "running") {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setStatus("success");
            return 100;
          }
          const nextVal = prev + Math.floor(Math.random() * 5) + 2;
          const cappedVal = Math.min(nextVal, 100);

          // 단계별 문구 매핑
          const matchedStep = GENERATION_STEPS.findIndex(step => cappedVal <= step.progress);
          if (matchedStep !== -1) {
            setCurrentStepIdx(matchedStep);
          }
          return cappedVal;
        });
      }, 200);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleReset = () => {
    setStatus("idle");
    setCharName("");
    setProgress(0);
    setCurrentStepIdx(0);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="AI 시나리오 생성 파이프라인"
        description="RAG 데이터를 기반으로 역사 속 인물의 3턴짜리 게임 시나리오, 8가지 엔딩 및 연동 이미지를 자동 생성합니다."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 입력 및 설정 폼 */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleStartPipeline} className="rounded-xl border border-[#E8E4DC] bg-white p-6 space-y-5">
            <h3 className="text-base font-semibold text-[#1A1714] flex items-center gap-2">
              <Sparkles className="size-4 text-[#8A847C]" />
              파이프라인 실행 매개변수 설정
            </h3>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#8A847C] uppercase tracking-wider mb-1">
                  대상 역사 인물 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="예: 안중근, 김구, 허난설헌 등"
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  disabled={status === "running"}
                  className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#1A1714] placeholder-[#8A847C] focus:border-[#2A4232] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#8A847C] uppercase tracking-wider mb-1">
                    시대 태그 (Era)
                  </label>
                  <AdminSelect
                    value={era}
                    onChange={(e) => setEra(e.target.value)}
                    disabled={status === "running"}
                  >
                    <option value="조선 시대">조선 시대</option>
                    <option value="조선 후기">조선 후기</option>
                    <option value="일제강점기">일제강점기</option>
                    <option value="근현대">근현대</option>
                    <option value="고려 시대">고려 시대</option>
                  </AdminSelect>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#8A847C] uppercase tracking-wider mb-1">
                    RAG 데이터베이스 파일
                  </label>
                  <AdminSelect
                    value={selectedRag}
                    onChange={(e) => setSelectedRag(e.target.value)}
                    disabled={status === "running"}
                  >
                    <option value="history_db.pkl">history_db.pkl (국사교과서)</option>
                    <option value="rebels_db.pkl">대한제국_의병운동_연구자료 (PDF 추가본)</option>
                  </AdminSelect>
                </div>
              </div>

              <div className="border-t border-[#F0ECE4] pt-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={genImages}
                    onChange={(e) => setGenImages(e.target.checked)}
                    disabled={status === "running"}
                    className="size-4 rounded border-[#E8E4DC] text-[#2A4232] focus:ring-[#2A4232]"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-[#1A1714] flex items-center gap-1">
                      <ImageIcon className="size-3.5" />
                      DALL-E 3 일러스트 자동 생성 활성화
                    </span>
                    <span className="text-xs text-[#8A847C]">
                      캐릭터 전신 일러스트 및 상황별 16:9 일러스트를 함께 백그라운드로 자동 생성합니다. (비활성화 시 생성 시간 대폭 감소)
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <AdminButton
                type="submit"
                variant="primary"
                disabled={status === "running"}
                className="!bg-[#2A4232] hover:!bg-[#1E3024] flex items-center gap-1.5"
              >
                <Play className="size-4" />
                AI 생성 시작
              </AdminButton>
            </div>
          </form>
        </div>

        {/* 파이프라인 진행 현황 모니터링 */}
        <div className="space-y-6">
          <div className="rounded-xl border border-[#E8E4DC] bg-white p-6 space-y-4">
            <h3 className="text-base font-semibold text-[#1A1714] flex items-center gap-2">
              <Layers className="size-4 text-[#8A847C]" />
              파이프라인 실행 상태
            </h3>

            {status === "idle" && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-[#8A847C]">
                <Sparkles className="size-10 stroke-1 animate-pulse mb-3" />
                <p className="text-sm font-medium">대기 중</p>
                <p className="text-xs mt-1">왼쪽 패널에서 매개변수를 입력한 후 시나리오 생성을 시작해 주세요.</p>
              </div>
            )}

            {status === "running" && (
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-[#2A4232] flex items-center gap-1.5 font-semibold">
                      <RefreshCw className="size-3.5 animate-spin" />
                      생성 진행 중...
                    </span>
                    <span className="text-[#1A1714] font-bold">{progress}%</span>
                  </div>
                  
                  <div className="w-full bg-[#F4F1EA] rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-[#2A4232] h-2.5 rounded-full transition-all duration-200" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="rounded-lg bg-[#FDFDFC] border border-[#F0ECE4] p-4">
                  <p className="text-xs font-semibold text-[#8A847C] uppercase tracking-wider">현재 단계</p>
                  <p className="text-sm font-semibold text-[#1A1714] mt-1">
                    {GENERATION_STEPS[currentStepIdx]?.label}
                  </p>
                  <p className="text-xs text-[#8A847C] mt-2">
                    이 작업은 수십 개의 프롬프트 체인과 이미지 생성을 동반하므로 완료까지 약 1~2분이 걸릴 수 있습니다.
                  </p>
                </div>
              </div>
            )}

            {status === "success" && (
              <div className="space-y-6 py-4 text-center">
                <div className="flex flex-col items-center justify-center">
                  <div className="size-12 rounded-full bg-green-50 border border-green-200 flex items-center justify-center text-green-600 mb-3">
                    <CheckCircle className="size-6" />
                  </div>
                  <h4 className="text-base font-semibold text-[#1A1714]">{charName} 시나리오 생성 완료!</h4>
                  <p className="text-xs text-[#8A847C] mt-1">
                    성공적으로 3턴 시나리오, 8가지 엔딩 및 {genImages ? "일러스트" : "텍스트"}가 임시 저장고에 보관되었습니다.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Link href="/admin/review/mock-id" className="w-full">
                    <span className="w-full inline-flex justify-center items-center gap-1.5 rounded-lg bg-[#2A4232] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#1E3024] transition-colors cursor-pointer">
                      생성된 시나리오 검수하러 가기
                      <ArrowRight className="size-4" />
                    </span>
                  </Link>
                  <button
                    onClick={handleReset}
                    className="w-full text-xs text-[#8A847C] hover:text-[#3A3530] font-semibold underline"
                  >
                    다른 인물 새로 생성하기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 개발/업데이트 중 안내 오버레이 (비활성화 불가, 확인 클릭 시 인물 카테고리로 리다이렉트) */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#FDFDFC]/35 backdrop-blur-[5px] p-4">
        <div className="w-full max-w-sm bg-white border border-[#E8E4DC] rounded-xl p-6 shadow-2xl space-y-4 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 border border-amber-200 animate-pulse">
            <AlertTriangle className="size-5" />
          </div>
          
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#1A1714]">
              개발 및 업데이트 중
            </h3>
            <p className="text-xs text-[#8A847C] leading-relaxed">
              현재 시나리오 일괄 생성 기능은 백엔드 RAG 엔진 패치 및 최적화 작업으로 인해 임시 업데이트 중입니다. 신속하게 완료하겠습니다.
            </p>
          </div>

          <div className="pt-1">
            <button
              onClick={() => router.push("/admin/character-categories")}
              className="w-full inline-flex justify-center items-center rounded-lg bg-[#2A4232] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1E3024] transition-colors cursor-pointer"
            >
              인물 카테고리로 이동
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
