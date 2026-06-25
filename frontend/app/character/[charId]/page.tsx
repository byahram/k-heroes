"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CharacterDetailPage } from "@/components/character-detail/CharacterDetailPage";

function normalizeCharId(charId: string) {
  return decodeURIComponent(charId);
}

function SimulationEnterOverlay() {
  return (
    <div className="fixed inset-0 z-[90] overflow-hidden">
      <style>{`
        @keyframes khEnterMist {
          0% { transform: translateX(-72%) skewX(-7deg); opacity: 0; }
          22% { opacity: 0.72; }
          100% { transform: translateX(78%) skewX(-7deg); opacity: 0; }
        }
        @keyframes khEnterSettle {
          from { opacity: 0; transform: translateY(8px); filter: blur(2px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
      `}</style>
      <div
        className="absolute inset-y-0 w-[56%]"
        style={{
          animation: "khEnterMist 1.05s ease-in-out infinite",
          background:
            "linear-gradient(100deg, rgba(253,250,244,0) 0%, rgba(253,250,244,0.86) 42%, rgba(224,211,184,0.42) 58%, rgba(253,250,244,0) 100%)",
        }}
      />
      <div
        className="absolute inset-0 flex items-center justify-center px-6 text-center"
        style={{
          background:
            "radial-gradient(circle at center, rgba(253,250,244,0.72) 0%, rgba(253,250,244,0.38) 40%, transparent 76%)",
          backdropFilter: "blur(1px)",
          WebkitBackdropFilter: "blur(1px)",
        }}
      >
        <div
          className="rounded-2xl px-7 py-6"
          style={{
            animation: "khEnterSettle 0.42s ease both",
            background: "rgba(253,250,244,0.76)",
            border: "1px solid rgba(42,66,50,0.08)",
            boxShadow: "0 16px 44px rgba(42,66,50,0.08)",
          }}
        >
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#2A4232] border-t-transparent" />
          <p
            style={{
              fontFamily: "'Noto Sans KR', sans-serif",
              color: "#2A4232",
              fontSize: "0.95rem",
              fontWeight: 800,
            }}
          >
            시뮬레이션 진입중...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CharacterDetailRoutePage() {
  const router = useRouter();
  const params = useParams<{ charId: string }>();
  const charId = normalizeCharId(params.charId);
  const [isEnteringSimulation, setIsEnteringSimulation] = useState(false);

  const handleStartScenario = async (scenarioIdx: number) => {
    if (isEnteringSimulation) return;
    setIsEnteringSimulation(true);
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    router.push(`/simulation/${encodeURIComponent(charId)}?scenario=${scenarioIdx + 1}`);
  };

  return (
    <>
      <CharacterDetailPage
        charId={charId}
        onBack={() => router.push("/map")}
        onStartScenario={handleStartScenario}
      />
      {isEnteringSimulation && <SimulationEnterOverlay />}
    </>
  );
}
