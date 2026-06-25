import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronUp, ChevronRight, Check } from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { storyPageBackground } from "@/components/layout/storyPageBackground";
import { authSessionsQueryKeyPrefix } from "@/hooks/use-my-sessions";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function getApiName(charId: string) {
  return decodeURIComponent(charId);
}

function preloadImage(src?: string) {
  if (!src || src === "/logo.svg" || typeof window === "undefined") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}

function preloadTurnAssets(turnData: any, fallbackImage?: string) {
  return Promise.all([
    preloadImage(turnData?.turn_image || fallbackImage),
    preloadImage(turnData?.choice_a?.choice_image || fallbackImage),
    preloadImage(turnData?.choice_b?.choice_image || fallbackImage),
  ]);
}

function getStatIcon(name: string): string {
  if (name.includes("자금") || name.includes("국력") || name.includes("돈")) return "💰";
  if (name.includes("팀워크") || name.includes("지지") || name.includes("동료") || name.includes("위로") || name.includes("백성")) return "🤝";
  if (name.includes("확률") || name.includes("성공")) return "🎯";
  if (name.includes("전투") || name.includes("무력")) return "⚔️";
  if (name.includes("예술") || name.includes("문학")) return "🎨";
  if (name.includes("학문") || name.includes("지식") || name.includes("실용")) return "📚";
  return "📊";
}


/* ────────────────────────────
   타입
──────────────────────────── */
interface Indicator {
  icon: string;
  label: string;
  value: number;
  isPercent?: boolean;
}

interface ChoiceData {
  id: "A" | "B";
  tag: "실제 역사" | "가상 분기";
  title: string;
  desc: string;
  img: string;
  indicators: Indicator[];
}

interface StepData {
  step: number;
  title: string;
  year: string;
  situation: string;
  img: string;
  toggleQ: string;
  toggleA: string;
  choices: [ChoiceData, ChoiceData];
}

/* ────────────────────────────
   진행도 표시
──────────────────────────── */
function ProgressIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        style={{
          fontFamily: "'Noto Sans KR', sans-serif",
          fontSize: "0.65rem",
          color: "#7A7060",
          letterSpacing: "0.06em",
        }}
      >
        STEP {current} / {total}
      </span>
      <div className="flex items-center">
        {Array.from({ length: total }).map((_, i) => {
          const isActive = i + 1 === current;
          const isDone = i + 1 < current;
          return (
            <div key={i} className="flex items-center">
              <div
                style={{
                  width: isActive ? "10px" : "8px",
                  height: isActive ? "10px" : "8px",
                  borderRadius: "50%",
                  background: isActive ? "#2A4232" : isDone ? "#6B9E7A" : "transparent",
                  border: isActive || isDone ? "none" : "1.5px solid #C0B8A8",
                  transition: "all 0.3s",
                  flexShrink: 0,
                }}
              />
              {i < total - 1 && (
                <div
                  style={{
                    width: "32px",
                    height: "1.5px",
                    background: isDone ? "#6B9E7A" : "#D8D0C4",
                    transition: "background 0.3s",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────
   시나리오 카드
──────────────────────────── */
function ScenarioCard({
  data,
  imageFadeKey,
  mediaVisible,
}: {
  data: StepData;
  imageFadeKey: number;
  mediaVisible: boolean;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden mb-3"
      style={{
        background: "#FDFAF4",
        border: "1px solid rgba(42,66,50,0.09)",
        boxShadow: "0 4px 24px rgba(42,66,50,0.09)",
      }}
    >
      <style>{`
        @media (min-width: 768px) {
          .kh-scenario-row { min-height: 196px; }
        }
        .kh-step-image-fade {
          transition: opacity 0.75s ease;
          will-change: opacity;
        }
        .kh-step-content-fade {
          transition: opacity 0.75s ease, transform 0.75s ease;
          will-change: opacity, transform;
        }
        .kh-ink-skeleton {
          position: relative;
          overflow: hidden;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(42,66,50,0.08), rgba(42,66,50,0.16), rgba(154,142,126,0.1));
        }
        .kh-ink-skeleton::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(253,250,244,0.58), transparent);
          animation: khInkSkeletonFlow 1.25s ease-in-out infinite;
        }
        @keyframes khInkSkeletonFlow {
          to { transform: translateX(100%); }
        }
      `}</style>
      <div className="kh-scenario-row flex flex-col md:flex-row">
        {/* 모바일: 이미지 상단 */}
        <div
          className="md:hidden relative overflow-hidden"
          style={{
            height: "160px",
            background:
              "linear-gradient(135deg, rgba(42,66,50,0.08), rgba(154,142,126,0.12), rgba(42,66,50,0.06))",
          }}
        >
          <img
            key={`mobile-${imageFadeKey}-${data.img}`}
            src={data.img}
            alt={data.title}
            className="kh-step-image-fade w-full h-full object-cover"
            style={{
              filter: "sepia(0.22) saturate(0.82) brightness(0.9)",
              opacity: mediaVisible ? 1 : 0,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to bottom, transparent 45%, #FDFAF4 100%)",
            }}
          />
        </div>

        {/* 텍스트 */}
        <div className="kh-scenario-text relative flex-1 px-6 py-5 md:py-6 md:pl-7 md:pr-5">
          {!mediaVisible && (
            <div className="absolute inset-0 px-6 py-5 md:py-6 md:pl-7 md:pr-5">
              <div className="kh-ink-skeleton mb-4 h-5 w-16" />
              <div className="kh-ink-skeleton mb-3 h-8 w-[58%]" />
              <div className="kh-ink-skeleton mb-2 h-3.5 w-[92%]" />
              <div className="kh-ink-skeleton mb-2 h-3.5 w-[82%]" />
              <div className="kh-ink-skeleton h-3.5 w-[68%]" />
            </div>
          )}
          <div
            className="kh-step-content-fade"
            style={{
              opacity: mediaVisible ? 1 : 0,
              transform: mediaVisible ? "translateY(0)" : "translateY(4px)",
            }}
          >
            <span
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: "0.62rem",
                color: "#2A4232",
                background: "rgba(42,66,50,0.1)",
                borderRadius: "4px",
                padding: "2px 8px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                display: "inline-block",
                marginBottom: "10px",
              }}
            >
              STEP {data.step}
            </span>
            <div className="mb-3">
              <h2
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontWeight: 700,
                  fontSize: "clamp(1.3rem, 2.5vw, 1.9rem)",
                  color: "#1A1714",
                  lineHeight: 1.2,
                  display: "inline",
                }}
              >
                {data.title}
              </h2>
              <span
                style={{
                  fontFamily: "'Noto Sans KR', sans-serif",
                  fontSize: "0.8rem",
                  color: "#9A8E7E",
                  marginLeft: "8px",
                }}
              >
                ({data.year})
              </span>
            </div>
            <div>
              {data.situation.split("\n").map((line, i) => (
                <p
                  key={i}
                  style={{
                    fontFamily: "'Noto Sans KR', sans-serif",
                    fontSize: "0.86rem",
                    color: "#4A4035",
                    lineHeight: 1.8,
                  }}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* 데스크탑: 이미지 우측 */}
        <div
          className="hidden md:block flex-shrink-0 relative overflow-hidden self-stretch"
          style={{
            width: "42%",
            background:
              "linear-gradient(135deg, rgba(42,66,50,0.08), rgba(154,142,126,0.12), rgba(42,66,50,0.06))",
          }}
        >
          <img
            key={`desktop-${imageFadeKey}-${data.img}`}
            src={data.img}
            alt={data.title}
            className="kh-step-image-fade absolute inset-0 w-full h-full object-cover"
            style={{
              filter: "sepia(0.22) saturate(0.82) brightness(0.9)",
              opacity: mediaVisible ? 1 : 0,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, #FDFAF4 0%, rgba(253,250,244,0.4) 30%, transparent 60%)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────
   역사 설명 토글
──────────────────────────── */
function HistoryToggle({
  question,
  answer,
  open,
  contentVisible,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  contentVisible: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-xl mb-5 overflow-hidden"
      style={{
        background: "rgba(253,250,244,0.88)",
        border: "1px solid rgba(201,147,58,0.22)",
        boxShadow: "0 2px 10px rgba(180,140,60,0.07)",
      }}
    >
      <button
        className="relative w-full flex items-center gap-3 px-5 py-3.5 text-left"
        onClick={onToggle}
      >
        {!contentVisible && (
          <div className="absolute inset-0 flex items-center gap-3 px-5">
            <div className="kh-ink-skeleton h-5 w-5 rounded-full" />
            <div className="kh-ink-skeleton h-4 w-[62%]" />
          </div>
        )}
        <span
          className="kh-step-content-fade"
          style={{ fontSize: "15px", flexShrink: 0, opacity: contentVisible ? 1 : 0 }}
        >
          💡
        </span>
        <span
          className="kh-step-content-fade"
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontWeight: 600,
            fontSize: "0.88rem",
            color: "#2A2420",
            flex: 1,
            opacity: contentVisible ? 1 : 0,
            transform: contentVisible ? "translateY(0)" : "translateY(3px)",
          }}
        >
          {question}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "#9A8E7E" }} />
        ) : (
          <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "#9A8E7E" }} />
        )}
      </button>
      {open && (
        <div
          className="px-5 pb-4"
          style={{ borderTop: "1px solid rgba(201,147,58,0.14)" }}
        >
          {answer.split("\n").map((line, i) => (
            <p
              key={i}
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: "0.82rem",
                color: "#5A5248",
                lineHeight: 1.85,
                marginTop: "8px",
              }}
            >
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────
   지표 아이템
──────────────────────────── */
function IndicatorRow({ indicator }: { indicator: Indicator }) {
  const { icon, label, value, isPercent } = indicator;
  const color =
    value > 0 ? "#1F6B3A" : value < 0 ? "#8B2525" : "#8A7E6E";
  const display = `${value > 0 ? "+" : ""}${value}${isPercent ? "%" : ""}`;

  return (
    <div
      className="flex items-center gap-2 py-1.5"
      style={{ borderBottom: "1px solid rgba(42,66,50,0.055)" }}
    >
      <span style={{ fontSize: "13px", flexShrink: 0 }}>{icon}</span>
      <span
        style={{
          fontFamily: "'Noto Sans KR', sans-serif",
          fontSize: "0.7rem",
          color: "#7A7060",
          flex: 1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontWeight: 700,
          fontSize: "0.78rem",
          color,
          flexShrink: 0,
        }}
      >
        {display}
      </span>
    </div>
  );
}

function StepTransitionSkeleton({
  title = "다음 이야기를 불러오는 중",
  description = "이미지와 선택지를 정리하고 있습니다.",
  ending = false,
}: {
  title?: string;
  description?: string;
  ending?: boolean;
}) {
  return (
    <div
      className={
        ending
          ? "pointer-events-auto fixed inset-0 z-[80] overflow-hidden"
          : "pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-[18px]"
      }
      style={{
        background: "transparent",
        touchAction: ending ? "none" : undefined,
      }}
    >
      <style>{`
        @keyframes khStepMist {
          0% { transform: translateX(-72%) skewX(-7deg); opacity: 0; }
          22% { opacity: 0.72; }
          100% { transform: translateX(78%) skewX(-7deg); opacity: 0; }
        }
        @keyframes khStepPulse {
          0%, 100% { opacity: 0.34; }
          50% { opacity: 0.62; }
        }
        @keyframes khBrushWrite {
          from { clip-path: inset(0 100% 0 0); opacity: 0.72; }
          to { clip-path: inset(0 0 0 0); opacity: 1; }
        }
        @keyframes khInkSettle {
          from { opacity: 0; transform: translateY(8px); filter: blur(2px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes khBrushStroke {
          from { transform: scaleX(0); opacity: 0; }
          32% { opacity: 0.8; }
          to { transform: scaleX(1); opacity: 0.52; }
        }
        .kh-step-skeleton-line,
        .kh-step-skeleton-block {
          animation: khStepPulse 1.15s ease-in-out infinite;
        }
        .kh-ending-brush {
          animation: khBrushWrite 1.15s cubic-bezier(0.24, 0.76, 0.32, 1) both;
        }
        .kh-transition-copy {
          animation: khInkSettle 0.58s ease both;
        }
      `}</style>
      <div
        className="absolute inset-y-0 w-[56%]"
        style={{
          animation: "khStepMist 1.05s ease-in-out infinite",
          background:
            "linear-gradient(100deg, rgba(253,250,244,0) 0%, rgba(253,250,244,0.86) 42%, rgba(224,211,184,0.42) 58%, rgba(253,250,244,0) 100%)",
        }}
      />
      {ending && (
      <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
        <div
          className="max-w-[560px] rounded-[18px] px-7 py-6"
          style={{
            background: "rgba(253,250,244,0.78)",
            border: "1px solid rgba(42,66,50,0.08)",
            boxShadow: "0 16px 44px rgba(42,66,50,0.08)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
          }}
        >
          {ending && (
            <div
              aria-hidden
              className="mx-auto mb-5 h-2 w-44 origin-left rounded-full"
              style={{
                animation: "khBrushStroke 1.1s cubic-bezier(0.2, 0.78, 0.24, 1) both",
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(42,66,50,0.45) 14%, rgba(42,66,50,0.7) 52%, rgba(154,106,31,0.34) 82%, transparent 100%)",
                filter: "blur(0.2px)",
              }}
            />
          )}
          <h2
            className={ending ? "kh-ending-brush" : "kh-transition-copy"}
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontWeight: 900,
              color: "#1A1714",
              fontSize: ending ? "clamp(1.55rem, 4.8vw, 2.85rem)" : "clamp(1.4rem, 4vw, 2.35rem)",
              lineHeight: 1.32,
              whiteSpace: "pre-line",
              textShadow: "0 1px 0 rgba(253,250,244,0.4)",
            }}
          >
            {title}
          </h2>
          <p
            className="kh-transition-copy mt-4"
            style={{
              animationDelay: ending ? "0.72s" : "0.08s",
              fontFamily: "'Noto Sans KR', sans-serif",
              color: "#5F574D",
              fontSize: ending ? "0.92rem" : "0.88rem",
              fontWeight: 700,
              lineHeight: 1.7,
            }}
          >
            {description}
          </p>
        </div>
      </div>
      )}
    </div>
  );
}

function InitialSimulationSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FDFAF4]" style={storyPageBackground}>
      <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#2A4232] border-t-transparent" />
      <p
        style={{
          fontFamily: "'Noto Sans KR', sans-serif",
          color: "#7A7060",
          fontSize: "0.9rem",
        }}
      >
        역사 시뮬레이션을 불러오는 중...
      </p>
    </div>
  );
}
/* ────────────────────────────
   선택 카드
──────────────────────────── */
function ChoiceCard({
  choice,
  imageFadeKey,
  mediaVisible,
  selected,
  onSelect,
}: {
  choice: ChoiceData;
  imageFadeKey: number;
  mediaVisible: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const isA = choice.id === "A";

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-200"
      style={{
        background: selected ? "rgba(218,238,226,0.72)" : "#FDFAF4",
        border: selected
          ? "2px solid rgba(42,100,60,0.72)"
          : "1.5px solid rgba(42,66,50,0.1)",
        boxShadow: selected
          ? "0 6px 24px rgba(42,100,60,0.14)"
          : "0 2px 12px rgba(42,66,50,0.07)",
        transform: selected ? "translateY(-2px)" : "none",
      }}
      onClick={onSelect}
    >
      {/* 이미지 + 배지 */}
      <div
        className="relative overflow-hidden"
        style={{
          height: "200px",
          background:
            "linear-gradient(135deg, rgba(42,66,50,0.09), rgba(154,142,126,0.13), rgba(42,66,50,0.06))",
        }}
      >
        <img
          key={`${imageFadeKey}-${choice.id}-${choice.img}`}
          src={choice.img}
          alt=""
          className="kh-step-image-fade w-full h-full object-cover"
          style={{
            filter: "sepia(0.28) saturate(0.78) brightness(0.88)",
            opacity: mediaVisible ? 1 : 0,
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "rgba(160,120,60,0.08)" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, transparent 35%, rgba(253,250,244,0.88) 100%)",
          }}
        />

        {/* 배지 */}
        <div
          className="absolute top-3 left-3 flex items-center gap-2 kh-step-content-fade"
          style={{ opacity: mediaVisible ? 1 : 0 }}
        >
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{
              width: "30px",
              height: "30px",
              background: selected
                ? "#2A4232"
                : isA
                ? "rgba(42,66,50,0.82)"
                : "rgba(160,108,26,0.82)",
              backdropFilter: "blur(6px)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            }}
          >
            {selected ? (
              <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
            ) : (
              <span
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  color: "white",
                  lineHeight: 1,
                }}
              >
                {choice.id}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 텍스트 */}
      <div className="relative p-4 pt-3.5">
        {!mediaVisible && (
          <div className="absolute inset-0 p-4 pt-3.5">
            <div className="kh-ink-skeleton mb-3 h-5 w-[74%]" />
            <div className="kh-ink-skeleton mb-2 h-3.5 w-[92%]" />
            <div className="kh-ink-skeleton mb-5 h-3.5 w-[70%]" />
            <div className="kh-ink-skeleton mb-2 h-3 w-[82%]" />
            <div className="kh-ink-skeleton mb-2 h-3 w-[76%]" />
            <div className="kh-ink-skeleton h-3 w-[64%]" />
          </div>
        )}
        <div
          className="kh-step-content-fade"
          style={{
            opacity: mediaVisible ? 1 : 0,
            transform: mediaVisible ? "translateY(0)" : "translateY(4px)",
          }}
        >
          <h3
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontWeight: 700,
              fontSize: "0.95rem",
              color: "#1A1714",
              lineHeight: 1.45,
              marginBottom: "6px",
              whiteSpace: "pre-line",
            }}
          >
            {choice.title}
          </h3>
          <p
            style={{
              fontFamily: "'Noto Sans KR', sans-serif",
              fontSize: "0.75rem",
              color: "#6A6055",
              lineHeight: 1.65,
              marginBottom: "12px",
            }}
          >
            {choice.desc}
          </p>

          {/* 지표 */}
          <div>
            {choice.indicators.map((ind) => (
              <IndicatorRow key={ind.label} indicator={ind} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────
   메인 컴포넌트
──────────────────────────── */
export function SimulationPage({
  charId,
  scenarioIdx,
  onBack,
  onComplete,
}: {
  charId: string;
  scenarioIdx: number;
  onBack: () => void;
  onComplete: (uuid: string) => void;
}) {
  const queryClient = useQueryClient();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [resolvedCharName, setResolvedCharName] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState<number | null>(null);
  const [characterCard, setCharacterCard] = useState<any | null>(null);
  const [gameState, setGameState] = useState<any | null>(null);
  const [currentTurn, setCurrentTurn] = useState<any | null>(null);
  const [choicesPath, setChoicesPath] = useState<string[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<"A" | "B" | null>(null);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [imageFadeKey, setImageFadeKey] = useState(0);
  const [mediaVisible, setMediaVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingEnding, setIsGeneratingEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollSimulationToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  };

  const revealStepMedia = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMediaVisible(true);
      });
    });
  };

  // Initialize Simulation
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setMediaVisible(false);
    setError(null);

    const init = async () => {
      try {
        const apiName = getApiName(charId);
        
        // 1. Fetch character list to find ID
        const listRes = await fetch(`${API_BASE_URL}/api/v2/characters`);
        if (!listRes.ok) throw new Error("인물 목록 조회 실패");
        const list = await listRes.json();
        
        const matched = list.find(
          (c: any) =>
            c.name.trim() === apiName.trim() ||
            c.name.trim() === charId.trim() ||
            apiName.trim().includes(c.name.trim()) ||
            c.name.trim().includes(apiName.trim())
        );
        if (!matched) throw new Error(`인물을 찾을 수 없습니다: ${apiName}`);
        
        // 2. Fetch full character details
        const detailRes = await fetch(`${API_BASE_URL}/api/v2/characters/${matched.id}`);
        if (!detailRes.ok) throw new Error("인물 상세 조회 실패");
        const detail = await detailRes.json();
        
        const scenario = detail.scenarios?.[scenarioIdx];
        if (!scenario) throw new Error(`인물에게 지정된 시나리오가 없습니다 (index: ${scenarioIdx})`);

        setResolvedCharName(detail.name);
        setScenarioId(scenario.id);

        // 3. Start simulation
        const startRes = await fetch(`${API_BASE_URL}/api/v2/simulation/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ character_name: detail.name, scenario_id: scenario.id }),
        });
        if (!startRes.ok) throw new Error("시뮬레이션 시작 실패");
        const startData = await startRes.json();
        
        setCharacterCard(startData.character_card);
        setGameState(startData.initial_state);

        // 4. Load first turn
        const turnRes = await fetch(`${API_BASE_URL}/api/v2/simulation/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            character_name: detail.name,
            scenario_id: scenario.id,
            current_step: 1,
            choices_path: [],
            game_stats: startData.initial_state.game_stats,
          }),
        });
        if (!turnRes.ok) throw new Error("첫 단계 조회 실패");
        const turnData = await turnRes.json();
        await preloadTurnAssets(turnData, detail.image_url);
        
        if (!active) return;
        setCurrentTurn(turnData);
        setImageFadeKey((key) => key + 1);
        revealStepMedia();
      } catch (e: any) {
        if (!active) return;
        console.error(e);
        setError(e.message || "시뮬레이션을 초기화하는 도중 오류가 발생했습니다.");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    init();
    return () => {
      active = false;
    };
  }, [charId, scenarioIdx]);

  const handleNext = async () => {
    if (!selectedChoice || !currentTurn || !resolvedCharName || !scenarioId || !gameState) return;
    setIsLoading(true);
    setMediaVisible(false);
    scrollSimulationToTop();

    const nextPath = [...choicesPath, selectedChoice];
    const isLast = currentTurn.current_step === currentTurn.total_steps;

    try {
      if (isLast) {
        setIsGeneratingEnding(true);
        const minimumLoading = new Promise((resolve) => window.setTimeout(resolve, 2400));

        // Generate Ending
        const endRes = await fetch(`${API_BASE_URL}/api/v2/simulation/ending`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            character_name: resolvedCharName,
            scenario_id: scenarioId,
            choices_path: nextPath,
            game_stats: gameState.game_stats,
          }),
        });
        if (!endRes.ok) throw new Error("엔딩 생성 실패");
        const endingData = await endRes.json();
        await queryClient.invalidateQueries({ queryKey: authSessionsQueryKeyPrefix });
        await minimumLoading;
        onComplete(endingData.uuid);
      } else {
        const minimumLoading = new Promise((resolve) => window.setTimeout(resolve, 1000));

        // Load next turn
        const turnRes = await fetch(`${API_BASE_URL}/api/v2/simulation/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            character_name: resolvedCharName,
            scenario_id: scenarioId,
            current_step: currentTurn.current_step + 1,
            choices_path: nextPath,
            game_stats: gameState.game_stats,
          }),
        });
        if (!turnRes.ok) throw new Error("다음 단계 조회 실패");
        const turnData = await turnRes.json();
        await preloadTurnAssets(turnData, characterCard.image_url);
        await minimumLoading;
        
        setChoicesPath(nextPath);
        setCurrentTurn(turnData);
        setImageFadeKey((key) => key + 1);
        setSelectedChoice(null);
        setToggleOpen(false);
        requestAnimationFrame(scrollSimulationToTop);
        revealStepMedia();
      }
    } catch (e: any) {
      console.error(e);
      setMediaVisible(true);
      alert(e.message || "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
      setIsGeneratingEnding(false);
    }
  };

  const handleBack = async () => {
    if (!currentTurn || !resolvedCharName || !scenarioId || !gameState) return;

    if (currentTurn.current_step === 1) {
      onBack();
      return;
    }

    setMediaVisible(false);
    scrollSimulationToTop();
    const prevPath = choicesPath.slice(0, -1);

    try {
      const turnRes = await fetch(`${API_BASE_URL}/api/v2/simulation/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          character_name: resolvedCharName,
          scenario_id: scenarioId,
          current_step: currentTurn.current_step - 1,
          choices_path: prevPath,
          game_stats: gameState.game_stats,
        }),
      });
      if (!turnRes.ok) throw new Error("이전 단계 조회 실패");
      const turnData = await turnRes.json();
      await preloadTurnAssets(turnData, characterCard.image_url);
      
      setChoicesPath(prevPath);
      setCurrentTurn(turnData);
      setImageFadeKey((key) => key + 1);
      setSelectedChoice(null);
      setToggleOpen(false);
      requestAnimationFrame(scrollSimulationToTop);
      revealStepMedia();
    } catch (e: any) {
      console.error(e);
      setMediaVisible(true);
      alert(e.message || "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !currentTurn) {
    return <InitialSimulationSkeleton />;
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FDFAF4] px-6 text-center" style={storyPageBackground}>
        <span className="text-4xl mb-4">⚠️</span>
        <p className="mb-6" style={{ fontFamily: "'Noto Sans KR', sans-serif", color: "#8B2525", fontSize: "1rem", fontWeight: 700 }}>
          {error}
        </p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl text-white font-bold transition-opacity"
          style={{ background: "linear-gradient(135deg, #1E3328 0%, #3D6B52 100%)", fontSize: "0.85rem" }}
        >
          돌아가기
        </button>
      </div>
    );
  }

  if (!currentTurn || !characterCard) return null;

  // Convert turn + card to original design shape
  const getIndicators = (choice: any) => {
    return Object.entries(choice.stat_effects || {}).map(([key, delta]) => {
      const idx = parseInt(key.replace("stat_", ""), 10) - 1;
      const statDef = characterCard.turn_stats?.[idx];
      const name = statDef ? statDef.name : "능력치";
      return {
        icon: getStatIcon(name),
        label: name,
        value: delta as number,
        isPercent: name.includes("확률"),
      };
    });
  };

  const stepData: StepData = {
    step: currentTurn.current_step,
    title: currentTurn.title,
    year: characterCard.years || "",
    situation: currentTurn.situation,
    img: currentTurn.turn_image || characterCard.image_url || "/logo.svg",
    toggleQ: currentTurn.toggle_question,
    toggleA: currentTurn.toggle_answer,
    choices: [
      {
        id: "A",
        tag: currentTurn.choice_a.is_historical ? "실제 역사" : "가상 분기",
        title: currentTurn.choice_a.title,
        desc: currentTurn.choice_a.description,
        img: currentTurn.choice_a.choice_image || characterCard.image_url || "/logo.svg",
        indicators: getIndicators(currentTurn.choice_a),
      },
      {
        id: "B",
        tag: currentTurn.choice_b.is_historical ? "실제 역사" : "가상 분기",
        title: currentTurn.choice_b.title,
        desc: currentTurn.choice_b.description,
        img: currentTurn.choice_b.choice_image || characterCard.image_url || "/logo.svg",
        indicators: getIndicators(currentTurn.choice_b),
      },
    ],
  };

  const isLast = currentTurn.current_step === currentTurn.total_steps;

  return (
    <div
      ref={scrollContainerRef}
      className={`fixed inset-0 z-50 ${isGeneratingEnding ? "overflow-hidden" : "overflow-y-auto"}`}
      style={storyPageBackground}
    >
      {/* ── 헤더 ── */}
      <header
        className="sticky top-0 z-10 h-14 border-b"
        style={{
          background: "rgba(248,242,230,0.32)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderColor: "rgba(42,66,50,0.08)",
        }}
      >
        <div className="relative mx-auto flex h-full max-w-[860px] items-center justify-between px-4 sm:px-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 hover:opacity-60 transition-opacity"
            style={{ color: "#5A5248", fontSize: "13px", fontFamily: "'Noto Sans KR', sans-serif" }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">돌아가기</span>
          </button>

          <span
            className="absolute left-1/2 max-w-[46vw] -translate-x-1/2 truncate text-center"
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontWeight: 700,
              fontSize: "0.92rem",
              color: "#2A4232",
              lineHeight: 1.2,
            }}
          >
            {resolvedCharName || characterCard.name || "시뮬레이션"}
          </span>

          <BrandLogo compact />
        </div>
      </header>

      {/* ── 본문 ── */}
      <div className="relative max-w-[860px] mx-auto px-4 sm:px-6 pt-5 pb-28">
        <div
          className="mb-4 flex justify-center px-4 py-1"
          style={{
            opacity: isLoading ? 0.42 : 1,
            transition: "opacity 0.22s ease",
          }}
        >
          <ProgressIndicator current={currentTurn.current_step} total={currentTurn.total_steps} />
        </div>

        {isLoading && (
          <StepTransitionSkeleton
            ending={isGeneratingEnding}
            title={isGeneratingEnding ? "당신의 선택이\n새로운 역사가 됩니다" : "다음 이야기를 준비하고 있습니다"}
            description={
              isGeneratingEnding
                ? "한 편의 역사책을 완성하는 중..."
                : "당신의 선택을 반영하여 다음 역사를 이어갑니다."
            }
          />
        )}

        {/* 시나리오 카드 */}
        <ScenarioCard data={stepData} imageFadeKey={imageFadeKey} mediaVisible={mediaVisible} />

        {/* 역사 토글 */}
        <HistoryToggle
          question={stepData.toggleQ}
          answer={stepData.toggleA}
          open={toggleOpen}
          contentVisible={mediaVisible}
          onToggle={() => setToggleOpen((v) => !v)}
        />

        {/* 선택 영역 */}
        <div>
          <h2
            className="kh-step-content-fade"
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontWeight: 700,
              fontSize: "1.05rem",
              color: "#1A1714",
              marginBottom: "14px",
              opacity: mediaVisible ? 1 : 0,
              transform: mediaVisible ? "translateY(0)" : "translateY(4px)",
            }}
          >
            당신의 선택
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stepData.choices.map((choice) => (
              <ChoiceCard
                key={choice.id}
                choice={choice}
                imageFadeKey={imageFadeKey}
                mediaVisible={mediaVisible}
                selected={selectedChoice === choice.id}
                onSelect={() => {
                  if (!isLoading) setSelectedChoice(choice.id);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── 하단 고정 버튼 ── */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          padding: "16px 16px 24px",
          pointerEvents: selectedChoice && !isLoading ? "auto" : "none",
        }}
      >
        <div style={{ maxWidth: "860px", margin: "0 auto" }}>
          <button
            onClick={handleNext}
            disabled={!selectedChoice || isLoading}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl transition-all"
            style={{
              background: selectedChoice && !isLoading
                ? "linear-gradient(135deg, #1E3328 0%, #3D6B52 100%)"
                : "rgba(42,66,50,0.12)",
              color: selectedChoice && !isLoading ? "white" : "#A89E8C",
              fontFamily: "'Noto Sans KR', sans-serif",
              fontWeight: 700,
              fontSize: "1rem",
              letterSpacing: "0.02em",
              cursor: selectedChoice && !isLoading ? "pointer" : "not-allowed",
              boxShadow: selectedChoice && !isLoading
                ? "0 4px 20px rgba(30,51,40,0.3)"
                : "none",
              pointerEvents: "auto",
            }}
          >
            {isLast ? "시뮬레이션 완료하기" : "선택하고 다음 단계로"}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
