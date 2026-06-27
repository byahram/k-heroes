"use client";

import { Database, ExternalLink, MapPinned, UserRound } from "lucide-react";
import { useRevealOnView } from "@/hooks/useRevealOnView";

const DATASETS = [
  {
    title: "지역이야기와 역사인물",
    type: "역사 인물 데이터",
    desc: "지역문화 이야기자료와 연관된 역사 인물 정보를 연결해 시대·지역·역할 맥락을 구성합니다.",
    href: "https://www.bigdata-culture.kr/bigdata/user/data_market/detail.do?id=fd2fe140-5180-11ec-9c54-b54b4d3d7cd0",
    icon: UserRound,
    color: "#2A5A4A",
  },
  {
    title: "지역이야기와 예술인",
    type: "예술 인물 데이터",
    desc: "지역 고유문화와 예술인의 활동 정보를 연결해 문학·예술 기반 인물 체험으로 확장합니다.",
    href: "https://www.bigdata-culture.kr/bigdata/user/data_market/detail.do?id=0a101560-5181-11ec-9c54-b54b4d3d7cd0",
    icon: MapPinned,
    color: "#6A3A2A",
  },
];

const PIPELINE = [
  "지역 이야기 수집",
  "인물·예술인 매칭",
  "시대·역할 구조화",
  "선택형 시나리오 생성",
];

export function DataSection() {
  const { ref, isVisible } = useRevealOnView<HTMLElement>();

  return (
    <section
      ref={ref}
      id="data"
      data-visible={isVisible}
      className="kh-data-section relative overflow-hidden"
      style={{
        padding: "104px 0",
        background:
          "linear-gradient(rgba(244,239,228,0.5), rgba(244,239,228,0.78)), url('/story-background.png') center/cover fixed",
      }}
    >
      <style>{`
        @keyframes khDataReveal {
          from { opacity: 0; transform: translateY(16px); filter: blur(3px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        .kh-data-section [data-reveal] {
          opacity: 0;
        }
        .kh-data-section[data-visible="true"] [data-reveal] {
          animation: khDataReveal 0.68s cubic-bezier(0.22, 0.8, 0.28, 1) both;
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div data-reveal>
            <span
              className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs"
              style={{
                background: "rgba(42,66,50,0.1)",
                color: "#2A4232",
                border: "1px solid rgba(42,66,50,0.2)",
                fontFamily: "'Noto Sans KR', sans-serif",
                letterSpacing: "0.08em",
              }}
            >
              <Database className="h-3.5 w-3.5" />
              활용 데이터
            </span>
            <h2
              className="mb-5"
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 800,
                color: "#1A1714",
                fontSize: "clamp(1.9rem, 4vw, 2.8rem)",
                lineHeight: 1.32,
              }}
            >
              문화빅데이터로 연결한
              <br />
              지역 역사 체험
            </h2>
            <p
              className="max-w-xl"
              style={{
                color: "#6B6355",
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: "0.94rem",
                lineHeight: 1.9,
              }}
            >
              K-Heroes는 문화빅데이터의 지역 이야기·역사인물·예술인 정보를
              연결해 인물 중심의 선택형 역사 시뮬레이션으로 재구성합니다.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              {["지역 맥락", "인물 정보", "문화 키워드", "시나리오 소재"].map((item) => (
                <div
                  key={item}
                  className="rounded-xl px-4 py-3"
                  style={{
                    background: "rgba(253,250,244,0.55)",
                    border: "1px solid rgba(42,66,50,0.1)",
                    fontFamily: "'Noto Sans KR', sans-serif",
                    color: "#2A4232",
                    fontWeight: 800,
                    fontSize: "0.8rem",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div data-reveal className="mb-5" style={{ animationDelay: "90ms" }}>
              <p
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontWeight: 800,
                  fontSize: "1.18rem",
                  color: "#1A1714",
                }}
              >
                데이터 연결 방식
              </p>
              <p
                className="mt-1"
                style={{
                  fontFamily: "'Noto Sans KR', sans-serif",
                  fontSize: "0.82rem",
                  color: "#7A7060",
                  lineHeight: 1.7,
                }}
              >
                지역 이야기에서 인물과 예술인 맥락을 찾고, 체험 흐름으로 정리합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {DATASETS.map((dataset, index) => {
                const Icon = dataset.icon;
                return (
                  <a
                    key={dataset.title}
                    href={dataset.href}
                    target="_blank"
                    rel="noreferrer"
                    data-reveal
                    className="group rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5"
                    style={{
                      animationDelay: `${170 + index * 90}ms`,
                      background: "#2A4232",
                      border: "1px solid rgba(255,255,255,0.12)",
                      boxShadow: "0 16px 34px rgba(42,66,50,0.16)",
                    }}
                  >
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-xl"
                          style={{ background: "rgba(255,255,255,0.12)" }}
                        >
                          <Icon className="h-5 w-5" style={{ color: "#F4EFE4" }} />
                        </span>
                        <span
                          style={{
                            fontFamily: "'Noto Sans KR', sans-serif",
                            color: "rgba(244,239,228,0.82)",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                          }}
                        >
                          {dataset.type}
                        </span>
                      </div>
                      <ExternalLink
                        className="h-4 w-4 opacity-45 transition-opacity group-hover:opacity-100"
                        style={{ color: "rgba(244,239,228,0.82)" }}
                      />
                    </div>
                    <h3
                      style={{
                        fontFamily: "'Noto Serif KR', serif",
                        color: "#FFFDF8",
                        fontWeight: 800,
                        fontSize: "1.16rem",
                        marginBottom: "10px",
                      }}
                    >
                      {dataset.title}
                    </h3>
                    <p
                      style={{
                        fontFamily: "'Noto Sans KR', sans-serif",
                        color: "rgba(244,239,228,0.78)",
                        fontSize: "0.82rem",
                        lineHeight: 1.75,
                      }}
                    >
                      {dataset.desc}
                    </p>
                  </a>
                );
              })}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
              {PIPELINE.map((item, index) => (
                <div
                  key={item}
                  data-reveal
                  className="rounded-2xl px-4 py-4"
                  style={{
                    animationDelay: `${360 + index * 70}ms`,
                    background: "rgba(255,255,255,0.72)",
                    border: "1px solid rgba(42,66,50,0.1)",
                    boxShadow: "0 10px 24px rgba(42,66,50,0.06)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Noto Serif KR', serif",
                      color: "#2A4232",
                      fontWeight: 900,
                      fontSize: "0.82rem",
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p
                    className="mt-2"
                    style={{
                      fontFamily: "'Noto Sans KR', sans-serif",
                      fontSize: "0.76rem",
                      lineHeight: 1.5,
                      color: "#4E5A4B",
                      fontWeight: 800,
                    }}
                  >
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
