import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, MapPin, Share2 } from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { storyPageBackground } from "@/components/layout/storyPageBackground";

interface SummaryItem {
  title: string;
  desc: string;
}

interface RecommendedPlace {
  address: string;
  name: string;
  description: string;
  link?: string;
  image_url?: string;
}

interface SelectedChoice {
  turn_no: number;
  turn_title: string;
  choice_key: string;
  title: string;
  is_historical: boolean;
  image_url?: string;
}

export interface EndingResponse {
  result_code: string;
  ending_type: string;
  title: string;
  history_fact: string;
  story_headline: string;
  story_contents: string;
  factual_contents?: string;
  summary_items: SummaryItem[];
  recommended_places: RecommendedPlace[];
  ending_markdown: string;
  output_file_path: string;
  ending_image?: string;
  uuid?: string;
  final_stats?: Record<string, number>;
  choices_history?: boolean[];
  character_name?: string;
  character_image?: string;
  history_score?: number;
  history_accuracy?: number;
  selected_choices?: SelectedChoice[];
}

function getResultNum(code: string) {
  const map: Record<string, number> = {
    "A-A-A": 1,
    "A-A-B": 2,
    "A-B-A": 3,
    "A-B-B": 4,
    "B-A-A": 5,
    "B-A-B": 6,
    "B-B-A": 7,
    "B-B-B": 8,
  };
  return map[code] || 1;
}

function getKoreanResultLabel(num: number) {
  const labels: Record<number, string> = {
    1: "첫 번째 결과",
    2: "두 번째 결과",
    3: "세 번째 결과",
    4: "네 번째 결과",
    5: "다섯 번째 결과",
    6: "여섯 번째 결과",
    7: "일곱 번째 결과",
    8: "여덟 번째 결과",
  };
  return labels[num] ?? `${num}번째 결과`;
}

function getAccuracyTheme(score: number) {
  if (score >= 80) {
    return {
      name: "높은 역사 일치",
      bg: "linear-gradient(135deg, #16251D 0%, #234634 58%, #17251D 100%)",
      accent: "#4CAF72",
      soft: "rgba(76,175,114,0.2)",
      text: "#E5F4E9",
    };
  }
  if (score > 35) {
    return {
      name: "엇갈린 역사",
      bg: "linear-gradient(135deg, #2A2418 0%, #6A542A 58%, #2F2518 100%)",
      accent: "#D4A33A",
      soft: "rgba(212,163,58,0.2)",
      text: "#F8EBC8",
    };
  }
  return {
    name: "새로운 분기",
    bg: "linear-gradient(135deg, #241816 0%, #65342D 58%, #211715 100%)",
    accent: "#C8564A",
    soft: "rgba(200,86,74,0.2)",
    text: "#F4D8D2",
  };
}

function getStatIcon(name: string): string {
  if (name.includes("자금") || name.includes("돈") || name.includes("재정")) return "💰";
  if (name.includes("팀워크") || name.includes("신뢰") || name.includes("협동") || name.includes("민심")) return "🤝";
  if (name.includes("성공") || name.includes("확률") || name.includes("명중")) return "🎯";
  if (name.includes("체력") || name.includes("건강") || name.includes("생명")) return "❤️";
  if (name.includes("명예") || name.includes("위신") || name.includes("덕망")) return "👑";
  return "⚡";
}

function SectionCard({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <section
      className={`kh-ending-rise rounded-2xl overflow-hidden ${className}`}
      style={{
        animationDelay: `${delay}ms`,
        background: "rgba(253,250,244,0.88)",
        border: "1px solid rgba(42,66,50,0.09)",
        boxShadow: "0 10px 34px rgba(42,66,50,0.08)",
      }}
    >
      {children}
    </section>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div
      className="flex items-center gap-2 px-5 py-4"
      style={{ borderBottom: "1px solid rgba(42,66,50,0.07)" }}
    >
      <span style={{ fontSize: "15px" }}>{icon}</span>
      <span
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontWeight: 800,
          fontSize: "0.9rem",
          color: "#1A1714",
        }}
      >
        {title}
      </span>
    </div>
  );
}

function AnimatedBar({
  value,
  color,
  delay,
}: {
  value: number;
  color: string;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px 8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-2 overflow-hidden rounded-full bg-[rgba(42,66,50,0.1)]">
      <div
        className={`kh-ending-bar h-full rounded-full ${isVisible ? "is-visible" : ""}`}
        style={{
          "--target-width": `${Math.max(0, Math.min(100, value))}%`,
          animationDelay: `${delay}ms`,
          background: color,
        } as CSSProperties}
      />
    </div>
  );
}

function AccuracyMeter({
  accuracy,
  color,
}: {
  accuracy: number;
  color: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [displayedAccuracy, setDisplayedAccuracy] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px 8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let animationFrame = 0;
    const duration = 1150;
    const start = performance.now();
    const target = Math.round(Math.max(0, Math.min(100, accuracy)));

    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayedAccuracy(Math.round(target * eased));

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(animate);
      } else {
        setDisplayedAccuracy(target);
      }
    };

    animationFrame = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [accuracy, isVisible]);

  return (
    <div ref={ref}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p
            style={{
              fontFamily: "'Noto Sans KR', sans-serif",
              color: "#5A5248",
              fontSize: "0.75rem",
              fontWeight: 900,
            }}
          >
            역사 일치도
          </p>
          <strong
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: "2.1rem",
              color: "#1A1714",
              lineHeight: 1,
            }}
          >
            {displayedAccuracy}%
          </strong>
        </div>
        <p
          className="hidden flex-1 sm:block"
          style={{
            fontFamily: "'Noto Sans KR', sans-serif",
            color: "#7A7060",
            fontSize: "0.78rem",
            fontWeight: 700,
          }}
        >
          실제 역사와 {displayedAccuracy}% 일치하는 선택입니다.
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[rgba(42,66,50,0.1)]">
        <div
          className={`kh-ending-bar h-full rounded-full ${isVisible ? "is-visible" : ""}`}
          style={{
            "--target-width": `${Math.max(0, Math.min(100, accuracy))}%`,
            background: color,
          } as CSSProperties}
        />
      </div>
    </div>
  );
}

function StatRow({
  name,
  value,
  index,
}: {
  name: string;
  value: number;
  index: number;
}) {
  const isPercent = name.includes("확률") || name.includes("%");
  const color = value >= 70 ? "#2F6E4D" : value >= 40 ? "#C9933A" : "#9A4B4B";

  return (
    <div
      className="kh-ending-rise grid grid-cols-[96px_1fr_44px] items-center gap-4"
      style={{ animationDelay: `${520 + index * 120}ms` }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span style={{ fontSize: "14px" }}>{getStatIcon(name)}</span>
        <span
          className="truncate"
          style={{
            fontFamily: "'Noto Sans KR', sans-serif",
            fontWeight: 800,
            fontSize: "0.78rem",
            color: "#4A4035",
          }}
        >
          {name}
        </span>
      </div>
      <AnimatedBar value={value} color={color} delay={720 + index * 120} />
      <span
        className="text-right"
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontWeight: 900,
          fontSize: "0.82rem",
          color,
        }}
      >
        {value}
        {isPercent ? "%" : ""}
      </span>
    </div>
  );
}

export function ResultPage({
  charId,
  ending,
  onBack,
  onNextChar,
}: {
  charId: string;
  ending: EndingResponse;
  onBack: () => void;
  onNextChar: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const characterName = ending.character_name || charId || "인물";
  const accuracy = Math.max(0, Math.min(100, ending.history_accuracy ?? ending.history_score ?? 0));
  const theme = getAccuracyTheme(accuracy);
  const resultNum = getResultNum(ending.result_code);
  const resultLabel = getKoreanResultLabel(resultNum);
  const choices = ending.selected_choices ?? [];
  const statsData = Object.entries(ending.final_stats ?? {});
  const recommendedPlaces = ending.recommended_places.slice(0, 2);

  const handleShare = async () => {
    const text = `K-Heroes: ${characterName} 시뮬레이션 결과\n"${ending.title}"`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "K-Heroes 시뮬레이션 결과", text });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
      alert("결과가 클립보드에 복사되었습니다!");
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={storyPageBackground}>
      <style>{`
        @keyframes khEndingRise {
          from { opacity: 0; transform: translateY(18px); filter: blur(3px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes khEndingBrush {
          from { clip-path: inset(0 100% 0 0); opacity: 0.74; }
          to { clip-path: inset(0 0 0 0); opacity: 1; }
        }
        @keyframes khEndingBar {
          from { width: 0; }
          to { width: var(--target-width); }
        }
        @keyframes khEndingHeroBg {
          from { opacity: 0; filter: blur(5px); }
          to { opacity: 1; filter: blur(0); }
        }
        @keyframes khEndingHeroPerson {
          from { opacity: 0; transform: translateX(28px) scale(0.98); filter: blur(4px); }
          to { opacity: 1; transform: translateX(0) scale(1); filter: blur(0); }
        }
        @keyframes khEndingHeroText {
          from { opacity: 0; transform: translateY(10px); filter: blur(2px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        .kh-ending-rise {
          opacity: 0;
          animation: khEndingRise 0.82s cubic-bezier(0.22, 0.75, 0.26, 1) forwards;
        }
        .kh-ending-scroll {
          opacity: 0;
          transform: translateY(24px);
          filter: blur(3px);
        }
        .kh-ending-scroll.is-visible {
          animation: khEndingRise 0.82s cubic-bezier(0.22, 0.75, 0.26, 1) forwards;
        }
        .kh-ending-hero-bg {
          opacity: 0;
          animation: khEndingHeroBg 0.85s ease forwards;
        }
        .kh-ending-hero-person {
          opacity: 0;
          animation: khEndingHeroPerson 0.9s cubic-bezier(0.22, 0.75, 0.26, 1) 0.32s forwards;
        }
        .kh-ending-hero-copy {
          opacity: 0;
          animation: khEndingHeroText 0.72s ease 0.32s forwards;
        }
        .kh-ending-brush {
          animation: khEndingBrush 1.08s cubic-bezier(0.2, 0.78, 0.24, 1) 0.32s both;
        }
        .kh-ending-bar {
          width: 0;
        }
        .kh-ending-bar.is-visible {
          animation: khEndingBar 1.05s cubic-bezier(0.2, 0.78, 0.24, 1) forwards;
        }
        .kh-ending-hero-section {
          min-height: 390px;
        }
        @media (max-width: 767px) {
          .kh-ending-hero-section {
            min-height: 820px;
          }
          .kh-ending-hero-grid {
            display: flex;
            flex-direction: column;
            padding-top: 142px;
          }
          .kh-ending-hero-figure {
            position: relative;
            right: auto;
            bottom: auto;
            height: 430px;
            width: 100%;
            margin-top: 22px;
            overflow: hidden;
          }
          .kh-ending-hero-person {
            bottom: -44px;
            right: -10%;
            height: 116%;
            width: 122%;
          }
          .kh-ending-hero-front-fade {
            height: 64%;
          }
        }
      `}</style>

      <header
        className="sticky top-0 z-20 h-14 border-b"
        style={{
          background: "rgba(18,18,14,0.14)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <div className="relative mx-auto flex h-full max-w-[920px] items-center justify-between px-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-60"
            style={{ color: "rgba(255,255,255,0.74)", fontSize: "13px", fontFamily: "'Noto Sans KR', sans-serif" }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">돌아가기</span>
          </button>
          <span
            className="absolute left-1/2 max-w-[46vw] -translate-x-1/2 truncate text-center"
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontWeight: 800,
              fontSize: "0.92rem",
              color: "rgba(255,255,255,0.86)",
            }}
          >
            {characterName}
          </span>
          <BrandLogo compact />
        </div>
      </header>

      <section
        className="kh-ending-hero-section relative overflow-hidden"
        style={{
          marginTop: "-56px",
          background: "#1E1A16",
        }}
      >
        <div className="kh-ending-hero-bg absolute inset-0" style={{ background: theme.bg }} />
        <div
          className="absolute inset-x-0 bottom-0 h-[54%]"
          style={{
            background: `linear-gradient(to top, ${theme.bg.includes("#16251D") ? "#17251D" : theme.bg.includes("#2A2418") ? "#2F2518" : "#211715"} 0%, ${theme.bg.includes("#16251D") ? "rgba(23,37,29,0.86)" : theme.bg.includes("#2A2418") ? "rgba(47,37,24,0.86)" : "rgba(33,23,21,0.86)"} 34%, transparent 100%)`,
          }}
        />
        <div className="kh-ending-hero-grid relative mx-auto grid max-w-[920px] grid-cols-1 px-6 pb-12 pt-[98px] md:grid-cols-[1fr_390px] md:items-start">
          <div className="relative z-[1]">
            <div className="kh-ending-hero-copy mb-8 flex items-center gap-3">
              <span
                className="rounded-xl px-4 py-2"
                style={{
                  background: "rgba(255,255,255,0.11)",
                  border: "1.5px solid rgba(255,255,255,0.2)",
                  color: "rgba(255,255,255,0.78)",
                  fontFamily: "'Noto Serif KR', serif",
                  fontWeight: 900,
                  fontSize: "0.82rem",
                  letterSpacing: "0.02em",
                  boxShadow: "inset 0 0 18px rgba(255,255,255,0.04)",
                }}
              >
                {resultLabel}
              </span>
              <span
                className="rounded-full px-4 py-2"
                style={{
                  background: theme.soft,
                  color: theme.text,
                  fontFamily: "'Noto Sans KR', sans-serif",
                  fontWeight: 900,
                  fontSize: "0.82rem",
                }}
              >
                {theme.name} · {accuracy}%
              </span>
            </div>
            <p
              className="kh-ending-hero-copy mb-2"
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: "0.72rem",
                color: "rgba(255,255,255,0.54)",
                fontWeight: 800,
                letterSpacing: "0.08em",
              }}
            >
              해당 시나리오 결과
            </p>
            <h1
              className="kh-ending-brush"
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 900,
                fontSize: "clamp(1.75rem, 4vw, 2.7rem)",
                color: theme.text,
                lineHeight: 1.28,
              }}
            >
              {ending.title}
            </h1>
            <p
              className="kh-ending-rise mt-4 max-w-[560px]"
              style={{
                animationDelay: "560ms",
                fontFamily: "'Noto Sans KR', sans-serif",
                color: "rgba(255,255,255,0.66)",
                fontSize: "0.88rem",
                lineHeight: 1.75,
                fontWeight: 600,
              }}
            >
              {ending.story_headline || "당신의 선택이 역사 속 새로운 흐름을 만들었습니다."}
            </p>
          </div>

          <div className="kh-ending-hero-figure pointer-events-none absolute bottom-0 right-[-8%] h-[116%] w-[64%] overflow-visible opacity-95 md:relative md:right-auto md:h-[390px] md:w-full">
            {ending.character_image && (
              <img
                src={ending.character_image}
                alt={characterName}
                className="kh-ending-hero-person absolute bottom-[-42px] right-[-3%] h-[121%] w-[116%] object-contain object-bottom"
                style={{ filter: "sepia(0.18) saturate(0.9) contrast(1.03)" }}
              />
            )}
          </div>
        </div>
        <div
          className="kh-ending-hero-front-fade pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[52%]"
          style={{
            background: `linear-gradient(to bottom, transparent 0%, ${theme.bg.includes("#16251D") ? "rgba(23,37,29,0.34)" : theme.bg.includes("#2A2418") ? "rgba(47,37,24,0.36)" : "rgba(33,23,21,0.36)"} 24%, ${theme.bg.includes("#16251D") ? "rgba(23,37,29,0.9)" : theme.bg.includes("#2A2418") ? "rgba(47,37,24,0.92)" : "rgba(33,23,21,0.92)"} 70%, ${theme.bg.includes("#16251D") ? "#17251D" : theme.bg.includes("#2A2418") ? "#2F2518" : "#211715"} 100%)`,
          }}
        />
      </section>

      <main className="mx-auto flex max-w-[920px] flex-col gap-5 px-5 py-7 pb-32">
        <SectionCard delay={160}>
          <SectionTitle icon="📋" title="나의 선택 결과" />
          <div className="p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {choices.map((choice, index) => (
                <div
                  key={`${choice.turn_no}-${choice.choice_key}`}
                  className="kh-ending-rise overflow-hidden rounded-xl"
                  style={{
                    animationDelay: `${340 + index * 150}ms`,
                    background: "#FFFDF8",
                    border: "1px solid rgba(42,66,50,0.1)",
                    boxShadow: "0 3px 14px rgba(42,66,50,0.05)",
                  }}
                >
                  <div className="relative h-36 overflow-hidden bg-[#EAE5DA]">
                    {choice.image_url ? (
                      <img
                        src={choice.image_url}
                        alt={choice.title}
                        className="h-full w-full object-cover"
                        style={{ filter: "sepia(0.16) saturate(0.86) brightness(0.94)" }}
                      />
                    ) : (
                      <div className="h-full w-full" style={{ background: "linear-gradient(135deg, #E8DFCF, #F8F1E4)" }} />
                    )}
                    <span
                      className="absolute left-3 top-3 rounded-md px-2 py-1"
                      style={{
                        background: "rgba(26,23,20,0.58)",
                        color: "#F8F1E4",
                        fontFamily: "'Noto Serif KR', serif",
                        fontWeight: 900,
                        fontSize: "0.68rem",
                      }}
                    >
                      {choice.turn_no}
                    </span>
                    <span
                      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full"
                      style={{
                        background: choice.is_historical ? "rgba(47,110,77,0.84)" : "rgba(154,75,75,0.84)",
                        color: "#FFFDF8",
                        fontFamily: "'Noto Serif KR', serif",
                        fontWeight: 900,
                        fontSize: "0.9rem",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                      }}
                    >
                      {choice.choice_key}
                    </span>
                  </div>
                  <div className="p-4 text-center">
                    <p
                      className="mb-2 line-clamp-2"
                      style={{
                        fontFamily: "'Noto Serif KR', serif",
                        fontWeight: 800,
                        fontSize: "0.9rem",
                        color: "#1A1714",
                        lineHeight: 1.45,
                      }}
                    >
                      {choice.title}
                    </p>
                    <span
                      className="inline-flex items-center rounded-full px-3 py-1"
                      style={{
                        background: choice.is_historical ? "rgba(47,110,77,0.1)" : "rgba(154,75,75,0.1)",
                        color: choice.is_historical ? "#2F6E4D" : "#9A4B4B",
                        fontFamily: "'Noto Sans KR', sans-serif",
                        fontWeight: 900,
                        fontSize: "0.7rem",
                      }}
                    >
                      {choice.is_historical ? "실제 역사와 일치" : "실제 역사와 다름"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="mt-5 rounded-xl px-5 py-4"
              style={{
                background: "rgba(255,253,248,0.78)",
                border: "1px solid rgba(42,66,50,0.07)",
              }}
            >
              <AccuracyMeter accuracy={accuracy} color={theme.accent} />
            </div>
          </div>
        </SectionCard>

        {statsData.length > 0 && (
          <SectionCard delay={420}>
            <SectionTitle icon="📊" title="최종 능력치" />
            <div className="flex flex-col gap-4 p-5">
              {statsData.map(([name, value], index) => (
                <StatRow key={name} name={name} value={value} index={index} />
              ))}
            </div>
          </SectionCard>
        )}

        <SectionCard delay={620}>
          <button
            className="flex w-full items-center gap-3 px-5 py-4 text-left"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <span style={{ fontSize: "16px" }}>💡</span>
            <span
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 800,
                fontSize: "0.9rem",
                color: "#2A2420",
                flex: 1,
              }}
            >
              이 엔딩은 실제 역사와 어떤 차이가 있을까요?
            </span>
            {historyOpen ? (
              <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: "#9A8E7E" }} />
            ) : (
              <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: "#9A8E7E" }} />
            )}
          </button>
          {historyOpen && (
            <div className="px-5 pb-5" style={{ borderTop: "1px solid rgba(42,66,50,0.07)" }}>
              <p
                className="mt-3"
                style={{
                  fontFamily: "'Noto Sans KR', sans-serif",
                  fontSize: "0.84rem",
                  color: "#5A5248",
                  lineHeight: 1.9,
                }}
              >
                {ending.history_fact}
              </p>
            </div>
          )}
        </SectionCard>

        <SectionCard delay={760}>
          <SectionTitle icon="📖" title="내가 만든 이야기" />
          <div className="p-5">
            <p
              className="mb-4"
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 900,
                fontSize: "1rem",
                color: "#1A1714",
                lineHeight: 1.6,
              }}
            >
              {ending.story_headline}
            </p>
            <p
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: "0.84rem",
                color: "#5A5248",
                lineHeight: 1.9,
              }}
            >
              {ending.story_contents}
            </p>
          </div>
        </SectionCard>

        {ending.summary_items.length > 0 && (
          <SectionCard delay={900}>
            <SectionTitle icon="📌" title="결과 요약" />
            <div className="flex flex-col gap-3 px-5 py-4">
              {ending.summary_items.map((item, index) => (
                <div key={`${item.title}-${index}`} className="flex gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: "rgba(42,66,50,0.1)",
                      color: "#2A4232",
                      fontFamily: "'Noto Serif KR', serif",
                      fontWeight: 900,
                      fontSize: "0.72rem",
                    }}
                  >
                    {index + 1}
                  </span>
                  <p
                    style={{
                      fontFamily: "'Noto Sans KR', sans-serif",
                      fontSize: "0.82rem",
                      color: "#4A4035",
                      lineHeight: 1.8,
                    }}
                  >
                    {item.title && <strong style={{ color: "#2A2420" }}>{item.title}: </strong>}
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {recommendedPlaces.length > 0 && (
          <div className="kh-ending-rise" style={{ animationDelay: "1040ms" }}>
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" style={{ color: "#2A4232" }} />
              <span
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  color: "#1A1714",
                }}
              >
                추천 방문지
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {recommendedPlaces.map((place) => {
                const content = (
                  <>
                    <div className="h-44 overflow-hidden bg-[#EAE5DA] sm:h-48">
                      {place.image_url ? (
                        <img
                          src={place.image_url}
                          alt={place.name}
                          className="h-full w-full object-cover"
                          style={{ filter: "grayscale(0.25) brightness(0.94) contrast(1.04)" }}
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            backgroundColor: "#F4EFE4",
                            backgroundImage:
                              "linear-gradient(rgba(244,239,228,0.22), rgba(244,239,228,0.36)), url('/story-background.png')",
                            backgroundSize: "cover",
                            backgroundPosition: "center center",
                          }}
                        />
                      )}
                    </div>
                    <div className="min-h-[132px] p-5">
                      <p
                        className="mb-1"
                        style={{
                          fontFamily: "'Noto Serif KR', serif",
                          fontWeight: 800,
                          fontSize: "1rem",
                          color: "#1A1714",
                        }}
                      >
                        {place.name}
                      </p>
                      <p
                        className="mb-2"
                        style={{
                          fontFamily: "'Noto Sans KR', sans-serif",
                          fontSize: "0.72rem",
                          color: "#9A8E7E",
                        }}
                      >
                        {place.address}
                      </p>
                      <p
                        className="mb-4"
                        style={{
                          fontFamily: "'Noto Sans KR', sans-serif",
                          fontSize: "0.82rem",
                          color: "#5A5248",
                          lineHeight: 1.75,
                        }}
                      >
                        {place.description}
                      </p>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2"
                        style={{
                          background: place.link ? "rgba(42,66,50,0.09)" : "rgba(42,66,50,0.06)",
                          color: "#2A4232",
                          fontFamily: "'Noto Sans KR', sans-serif",
                          fontSize: "0.76rem",
                          fontWeight: 900,
                        }}
                      >
                        방문지 더 알아보기
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </>
                );

                if (place.link) {
                  return (
                    <a
                      key={place.name}
                      href={place.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-2xl transition-transform duration-300 hover:scale-[1.02]"
                      style={{
                        background: "rgba(253,250,244,0.9)",
                        border: "1px solid rgba(42,66,50,0.09)",
                        boxShadow: "0 8px 24px rgba(42,66,50,0.07)",
                      }}
                    >
                      {content}
                    </a>
                  );
                }

                return (
                  <div
                    key={place.name}
                    className="overflow-hidden rounded-2xl"
                    style={{
                      background: "rgba(253,250,244,0.9)",
                      border: "1px solid rgba(42,66,50,0.09)",
                      boxShadow: "0 8px 24px rgba(42,66,50,0.07)",
                    }}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          padding: "12px 16px 28px",
        }}
      >
        <div style={{ maxWidth: "920px", margin: "0 auto", display: "flex", gap: "10px" }}>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 rounded-xl transition-opacity hover:opacity-80"
            style={{
              padding: "14px 20px",
              background: "rgba(253,250,244,0.82)",
              border: "1.5px solid rgba(42,66,50,0.15)",
              fontFamily: "'Noto Sans KR', sans-serif",
              fontWeight: 800,
              fontSize: "0.85rem",
              color: "#2A4232",
              whiteSpace: "nowrap",
              backdropFilter: "blur(8px)",
            }}
          >
            <Share2 className="h-4 w-4" />
            공유하기
          </button>
          <button
            onClick={onNextChar}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl transition-all hover:opacity-90 active:scale-[0.99]"
            style={{
              background: "linear-gradient(135deg, #1E3328 0%, #3D6B52 100%)",
              fontFamily: "'Noto Sans KR', sans-serif",
              fontWeight: 800,
              fontSize: "0.95rem",
              color: "white",
              boxShadow: "0 4px 20px rgba(30,51,40,0.3)",
            }}
          >
            다음 인물 체험하기
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
