import { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Share2, ChevronRight, MapPin } from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { storyPageBackground } from "@/components/layout/storyPageBackground";

/* ─── 아이콘 배지 ─── */
function ComboIcon({ isReal, step }: { isReal: boolean; step: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: isReal ? "rgba(42,150,80,0.18)" : "rgba(180,100,20,0.18)",
          border: isReal ? "2px solid rgba(42,150,80,0.5)" : "2px solid rgba(180,100,20,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(4px)",
        }}
      >
        <span style={{ fontSize: "17px", lineHeight: 1 }}>{isReal ? "🅾️" : "❎"}</span>
      </div>
      <span
        style={{
          fontFamily: "'Noto Sans KR', sans-serif",
          fontSize: "0.58rem",
          color: "rgba(255,255,255,0.5)",
          letterSpacing: "0.04em",
        }}
      >
        STEP {step}
      </span>
    </div>
  );
}

/* ─── 능력치 바 ─── */
function StatBar({ icon, label, value, isPercent, max }: { icon: string; label: string; value: number; isPercent?: boolean; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = value >= 80 ? "#4CAF72" : value >= 50 ? "#C9933A" : value >= 20 ? "#A0856A" : "#8B4040";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ fontSize: "14px" }}>{icon}</span>
          <span style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: "0.7rem", color: "#7A7060" }}>{label}</span>
        </div>
        <span style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 700, fontSize: "0.85rem", color }}>
          {value > 0 && isPercent !== true ? "" : ""}{value}{isPercent ? "%" : ""}
        </span>
      </div>
      <div style={{ height: "6px", borderRadius: "3px", background: "rgba(42,66,50,0.1)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: "3px",
            background: color,
            transition: "width 0.8s ease",
          }}
        />
      </div>
    </div>
  );
}

/* ─── 메인 컴포넌트 ─── */
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
  history_score?: number;
  history_accuracy?: number;
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

function getStatIcon(name: string): string {
  if (name.includes("자금") || name.includes("돈") || name.includes("재정")) return "💰";
  if (name.includes("팀워크") || name.includes("신뢰") || name.includes("협동") || name.includes("민심")) return "🤝";
  if (name.includes("성공") || name.includes("확률") || name.includes("명중")) return "🎯";
  if (name.includes("체력") || name.includes("건강") || name.includes("생명")) return "❤️";
  if (name.includes("명예") || name.includes("위신") || name.includes("덕망")) return "👑";
  return "⚡";
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
  const characterName = ending.character_name || charId || "인물";
  const isReal = ending.ending_type.toLowerCase().includes("true") || ending.ending_type.toLowerCase().includes("real");
  const resultNum = getResultNum(ending.result_code);
  const choicesHistory = ending.choices_history || [false, false, false];

  const [historyOpen, setHistoryOpen] = useState(false);

  const handleShare = async () => {
    const text = `K-Heroes: ${characterName} 시뮬레이션에서 최종 결과를 달성했습니다!\n"${ending.title}"`;
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

  // Convert final_stats dictionary entries to standard stats list
  const statsData = ending.final_stats && Object.keys(ending.final_stats).length > 0
    ? Object.entries(ending.final_stats).map(([name, val]) => ({
        name,
        value: val,
        isPercent: name.includes("확률"),
        icon: getStatIcon(name)
      }))
    : [];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
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
        <div className="relative mx-auto flex h-full max-w-[820px] items-center justify-between px-6">
          <button
            onClick={onBack}
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
            {characterName}
          </span>
          <BrandLogo compact />
        </div>
      </header>

      {/* ── 히어로 (다크) ── */}
      <div
        style={{
          background: isReal
            ? "linear-gradient(135deg, #1A2820 0%, #2E4A38 60%, #1E3328 100%)"
            : "linear-gradient(135deg, #1A1814 0%, #2A2420 60%, #1E1A16 100%)",
          position: "relative",
          overflow: "hidden",
          minHeight: "280px",
        }}
      >
        {/* 배경 패턴 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 20% 50%, rgba(201,147,58,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(42,66,50,0.15) 0%, transparent 50%)",
          }}
        />

        {/* 콘텐츠 */}
        <div
          className="relative max-w-[820px] mx-auto px-6"
          style={{ paddingTop: "36px", paddingBottom: "36px" }}
        >
          {/* RESULT 배지 */}
          <div className="flex items-center gap-3 mb-4">
            <div
              style={{
                background: isReal
                  ? "linear-gradient(135deg, #C9933A, #E8B84B)"
                  : "rgba(255,255,255,0.1)",
                borderRadius: "6px",
                padding: "4px 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                border: isReal ? "none" : "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {isReal && <span style={{ fontSize: "12px" }}>★</span>}
              <span
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontWeight: 800,
                  fontSize: "0.72rem",
                  color: isReal ? "#1A1714" : "rgba(255,255,255,0.7)",
                  letterSpacing: "0.08em",
                }}
              >
                RESULT {resultNum}
              </span>
            </div>

            {isReal && (
              <div
                style={{
                  background: "rgba(42,150,80,0.2)",
                  border: "1px solid rgba(42,150,80,0.4)",
                  borderRadius: "6px",
                  padding: "3px 10px",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Noto Sans KR', sans-serif",
                    fontSize: "0.62rem",
                    color: "#6ECF90",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  실제 역사 100% 일치
                </span>
              </div>
            )}
          </div>

          {/* 콤보 아이콘 */}
          <div className="flex items-center gap-3 mb-5">
            {choicesHistory.map((isR, i) => (
              <ComboIcon key={i} isReal={isR} step={i + 1} />
            ))}
          </div>

          {/* 타이틀 */}
          <div>
            {!isReal && (
              <p
                style={{
                  fontFamily: "'Noto Sans KR', sans-serif",
                  fontSize: "0.68rem",
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: "4px",
                  letterSpacing: "0.04em",
                }}
              >
                가상 시나리오
              </p>
            )}
            <h1
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 700,
                fontSize: "clamp(1.2rem, 2.8vw, 1.9rem)",
                color: isReal ? "#F5E9CC" : "rgba(255,255,255,0.88)",
                lineHeight: 1.35,
              }}
            >
              {ending.title}
            </h1>
          </div>
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className="max-w-[820px] mx-auto px-5 py-7 pb-32 flex flex-col gap-5">

        {/* ─ 최종 능력치 ─ */}
        <div
          className="rounded-2xl p-5"
          style={{
            background: "#FDFAF4",
            border: "1px solid rgba(42,66,50,0.09)",
            boxShadow: "0 2px 16px rgba(42,66,50,0.06)",
          }}
        >
          <p
            className="mb-4"
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontWeight: 700,
              fontSize: "0.88rem",
              color: "#1A1714",
            }}
          >
            최종 능력치
          </p>
          <div className="flex flex-col gap-4">
            {statsData.map((stat) => (
              <StatBar
                key={stat.name}
                icon={stat.icon}
                label={stat.name}
                value={stat.value}
                isPercent={stat.isPercent}
                max={100}
              />
            ))}
          </div>
        </div>

        {/* ─ 실제 역사와 비교 ─ */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#FDFAF4",
            border: "1px solid rgba(201,147,58,0.22)",
            boxShadow: "0 2px 16px rgba(42,66,50,0.06)",
          }}
        >
          <button
            className="w-full flex items-center gap-3 px-5 py-4 text-left"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <span style={{ fontSize: "16px", flexShrink: 0 }}>💡</span>
            <span
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 700,
                fontSize: "0.88rem",
                color: "#2A2420",
                flex: 1,
              }}
            >
              이 엔딩은 실제 역사와 어떤 차이가 있을까요?
            </span>
            {historyOpen ? (
              <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "#9A8E7E" }} />
            ) : (
              <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "#9A8E7E" }} />
            )}
          </button>
          {historyOpen && (
            <div
              className="px-5 pb-5"
              style={{ borderTop: "1px solid rgba(201,147,58,0.14)" }}
            >
              <p
                style={{
                  fontFamily: "'Noto Sans KR', sans-serif",
                  fontSize: "0.83rem",
                  color: "#5A5248",
                  lineHeight: 1.9,
                  marginTop: "12px",
                }}
              >
                {ending.history_fact}
              </p>
            </div>
          )}
        </div>

        {/* ─ 내가 만든 이야기 ─ */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#FDFAF4",
            border: "1px solid rgba(42,66,50,0.09)",
            boxShadow: "0 2px 16px rgba(42,66,50,0.06)",
          }}
        >
          {/* 헤더 */}
          <div
            className="flex items-center gap-2 px-5 py-4"
            style={{ borderBottom: "1px solid rgba(42,66,50,0.07)" }}
          >
            <span style={{ fontSize: "16px" }}>📖</span>
            <span
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 700,
                fontSize: "0.88rem",
                color: "#1A1714",
              }}
            >
              내가 만든 이야기
            </span>
          </div>

          <div className="p-5 pt-4">
            {/* 인용 */}
            <div
              className="rounded-xl px-5 py-4 mb-4"
              style={{
                background: isReal
                  ? "linear-gradient(135deg, rgba(42,66,50,0.07), rgba(42,66,50,0.04))"
                  : "rgba(42,66,50,0.03)",
                border: isReal
                  ? "1px solid rgba(42,66,50,0.15)"
                  : "1px solid rgba(42,66,50,0.07)",
              }}
            >
              <span
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: "3rem",
                  color: isReal ? "rgba(42,66,50,0.2)" : "rgba(42,66,50,0.1)",
                  lineHeight: 0.6,
                  display: "block",
                  marginBottom: "2px",
                }}
              >
                "
              </span>
              <p
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: "#1A1714",
                  lineHeight: 1.55,
                }}
              >
                {ending.story_headline}
              </p>
            </div>

            {/* 본문 */}
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
        </div>

        {/* ─ 결과 요약 ─ */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#FDFAF4",
            border: "1px solid rgba(42,66,50,0.09)",
            boxShadow: "0 2px 16px rgba(42,66,50,0.06)",
          }}
        >
          <div
            className="flex items-center gap-2 px-5 py-4"
            style={{ borderBottom: "1px solid rgba(42,66,50,0.07)" }}
          >
            <span style={{ fontSize: "16px" }}>📌</span>
            <span
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 700,
                fontSize: "0.88rem",
                color: "#1A1714",
              }}
            >
              결과 요약
            </span>
          </div>
          <div className="px-5 py-4 flex flex-col gap-3">
            {ending.summary_items.map((item, i) => {
              return (
                <div key={i} className="flex gap-3">
                  <div
                     style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: isReal
                        ? "linear-gradient(135deg, #C9933A, #E8B84B)"
                        : "rgba(42,66,50,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: "1px",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Noto Serif KR', serif",
                        fontWeight: 800,
                        fontSize: "0.65rem",
                        color: isReal ? "#1A1714" : "#5A5248",
                        lineHeight: 1,
                      }}
                    >
                      {i + 1}
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: "'Noto Sans KR', sans-serif",
                      fontSize: "0.82rem",
                      color: "#4A4035",
                      lineHeight: 1.8,
                    }}
                  >
                    {item.title && (
                      <span style={{ fontWeight: 700, color: "#2A2420" }}>{item.title}: </span>
                    )}
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─ 추천 방문지 ─ */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4" style={{ color: "#2A4232" }} />
            <span
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 700,
                fontSize: "0.95rem",
                color: "#1A1714",
              }}
            >
              추천 방문지
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ending.recommended_places.map((place) => {
              const cardContent = (
                <>
                  <div style={{ height: "140px", overflow: "hidden", background: "#EAE5DA" }}>
                    {place.image_url ? (
                      <img
                        src={place.image_url}
                        alt={place.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          filter: "grayscale(1) brightness(0.92) contrast(1.05)",
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: "#EAE5DA" }}>
                        <span
                          style={{
                            fontFamily: "'Noto Sans KR', sans-serif",
                            fontSize: "0.75rem",
                            color: "#8C8375",
                            fontWeight: 500,
                            letterSpacing: "-0.01em",
                          }}
                        >
                          이미지 없음
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start gap-1.5 mb-1">
                      <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "#C9933A" }} />
                      <p
                        style={{
                          fontFamily: "'Noto Sans KR', sans-serif",
                          fontSize: "0.65rem",
                          color: "#A89E8E",
                        }}
                      >
                        {place.address}
                      </p>
                    </div>
                    <p
                      className="mb-1.5"
                      style={{
                        fontFamily: "'Noto Serif KR', serif",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        color: "#1A1714",
                      }}
                    >
                      {place.name}
                    </p>
                    <p
                      style={{
                        fontFamily: "'Noto Sans KR', sans-serif",
                        fontSize: "0.74rem",
                        color: "#6A6055",
                        lineHeight: 1.7,
                      }}
                    >
                      {place.description}
                    </p>
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
                    className="block rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
                    style={{
                      background: "#FDFAF4",
                      border: "1px solid rgba(42,66,50,0.09)",
                      boxShadow: "0 2px 16px rgba(42,66,50,0.06)",
                      cursor: "pointer"
                    }}
                  >
                    {cardContent}
                  </a>
                );
              }

              return (
                <div
                  key={place.name}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: "#FDFAF4",
                    border: "1px solid rgba(42,66,50,0.09)",
                    boxShadow: "0 2px 16px rgba(42,66,50,0.06)",
                  }}
                >
                  {cardContent}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 하단 플로팅 버튼 ── */}
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
        <div
          style={{ maxWidth: "820px", margin: "0 auto", display: "flex", gap: "10px" }}
        >
          {/* 공유하기 */}
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl transition-all hover:opacity-80"
            style={{
              flex: "0 0 auto",
              padding: "14px 20px",
              background: "rgba(42,66,50,0.08)",
              border: "1.5px solid rgba(42,66,50,0.15)",
              fontFamily: "'Noto Sans KR', sans-serif",
              fontWeight: 700,
              fontSize: "0.85rem",
              color: "#2A4232",
              cursor: "pointer",
              borderRadius: "12px",
              whiteSpace: "nowrap",
            }}
          >
            <Share2 className="w-4 h-4" />
            공유하기
          </button>

          {/* 다음 인물 체험하기 */}
          <button
            onClick={onNextChar}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl transition-all hover:opacity-90 active:scale-[0.99]"
            style={{
              flex: 1,
              background: "linear-gradient(135deg, #1E3328 0%, #3D6B52 100%)",
              fontFamily: "'Noto Sans KR', sans-serif",
              fontWeight: 700,
              fontSize: "0.95rem",
              color: "white",
              letterSpacing: "0.02em",
              cursor: "pointer",
              borderRadius: "12px",
              boxShadow: "0 4px 20px rgba(30,51,40,0.3)",
            }}
          >
            다음 인물 체험하기
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
