"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { ResultPage, EndingResponse } from "@/components/result/ResultPage";
import { storyPageBackground } from "@/components/layout/storyPageBackground";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function ResultInner() {
  const router = useRouter();
  const params = useParams<{ uuid: string }>();
  const uuid = params.uuid;

  const [ending, setEnding] = useState<EndingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uuid) return;

    let active = true;

    async function fetchResult() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v2/simulation/result/${uuid}`);
        if (!res.ok) {
          throw new Error(`결과를 불러오지 못했습니다 (상태 코드: ${res.status})`);
        }
        const data = await res.json();
        if (active) {
          setEnding(data);
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "오류가 발생했습니다.");
          setLoading(false);
        }
      }
    }

    fetchResult();

    return () => {
      active = false;
    };
  }, [uuid]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FDFAF4]" style={storyPageBackground}>
        <div className="w-8 h-8 border-4 border-[#2A4232] border-t-transparent rounded-full animate-spin mb-4" />
        <p style={{ fontFamily: "'Noto Sans KR', sans-serif", color: "#7A7060", fontSize: "0.9rem" }}>
          시뮬레이션 결과를 가져오는 중...
        </p>
      </div>
    );
  }

  if (error || !ending) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FDFAF4] px-6 text-center" style={storyPageBackground}>
        <span className="text-4xl mb-4">⚠️</span>
        <p className="mb-6" style={{ fontFamily: "'Noto Sans KR', sans-serif", color: "#8B2525", fontSize: "1rem", fontWeight: 700 }}>
          {error || "결과를 표시할 수 없습니다."}
        </p>
        <button
          onClick={() => router.push("/map")}
          className="px-6 py-2.5 rounded-xl text-white font-bold transition-opacity"
          style={{ background: "linear-gradient(135deg, #1E3328 0%, #3D6B52 100%)", fontSize: "0.85rem" }}
        >
          선택 화면으로 이동
        </button>
      </div>
    );
  }

  const charId = ending.character_name?.trim() ?? "";
  const simulationPath = charId ? `/simulation/${encodeURIComponent(charId)}` : "/map";

  return (
    <ResultPage
      charId={charId}
      ending={ending}
      onBack={() => router.push(simulationPath)}
      onNextChar={() => router.push("/map")}
    />
  );
}

export default function ResultRoutePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#FDFAF4] text-[#7A7060]" style={storyPageBackground}>
        로딩 중...
      </div>
    }>
      <ResultInner />
    </Suspense>
  );
}
