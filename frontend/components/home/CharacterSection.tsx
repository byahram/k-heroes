"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { useRevealOnView } from "@/hooks/useRevealOnView";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

interface ApiCharacter {
  name: string;
  category?: string;
  era?: string;
  era_tag?: string;
  role?: string;
  keywords?: string[];
  years?: string;
  image_url?: string;
  one_line_summary?: string;
  mbti?: string;
  mbti_nickname?: string;
}

interface LandingCharacter {
  id: string;
  name: string;
  role: string;
  era: string;
  years: string;
  summary: string;
  mbti: string;
  category: string;
  imageUrl: string;
  tags: string[];
}

const MBTI_GROUPS = [
  { types: ["INTJ", "INTP", "ENTJ", "ENTP"], color: "#4A3A6A", label: "분석가형" },
  { types: ["INFJ", "INFP", "ENFJ", "ENFP"], color: "#2A5A4A", label: "외교관형" },
  { types: ["ISTJ", "ISFJ", "ESTJ", "ESFJ"], color: "#3A4A6A", label: "관리자형" },
  { types: ["ISTP", "ISFP", "ESTP", "ESFP"], color: "#6A3A2A", label: "탐험가형" },
];

function getMbtiMeta(mbti: string) {
  return MBTI_GROUPS.find((group) => group.types.includes(mbti)) ?? MBTI_GROUPS[0];
}

function mapApiCharacter(char: ApiCharacter): LandingCharacter {
  return {
    id: char.name,
    name: char.name,
    role: char.role ?? char.category ?? "역사 인물",
    era: char.era_tag ?? char.era ?? "시대 정보",
    years: char.years ?? "",
    summary: char.one_line_summary ?? "역사 속 결정적 순간을 직접 체험해보세요.",
    mbti: char.mbti ?? "MBTI",
    category: char.category ?? "역사 인물",
    imageUrl: char.image_url || "/logo.svg",
    tags: char.keywords?.slice(0, 4).map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)) ?? [],
  };
}

function pickThree<T>(items: T[], seed: number) {
  return [...items]
    .map((item, index) => ({ item, score: Math.sin((index + 1) * 997 + seed) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(({ item }) => item);
}

function CharacterCard({
  char,
  index,
  isLeaving = false,
  onDetail,
}: {
  char: LandingCharacter;
  index: number;
  isLeaving?: boolean;
  onDetail: (id: string) => void;
}) {
  const mbti = getMbtiMeta(char.mbti);

  return (
    <article
      className={`kh-character-card group relative min-h-[560px] overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 ${
        isLeaving ? "kh-character-card-leaving" : ""
      }`}
      style={{
        animationDelay: `${index * 95}ms`,
        background: "#FDFAF4",
        border: "1px solid rgba(42,66,50,0.12)",
        borderTop: `5px solid ${mbti.color}`,
        boxShadow: "0 18px 42px rgba(42,66,50,0.1)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        aria-hidden
        className="absolute right-[-14%] top-0 h-full w-[88%] overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 54% 40%, rgba(154,106,31,0.13), transparent 62%)",
        }}
      >
        <img
          src={char.imageUrl}
          alt=""
          className="kh-featured-portrait h-full w-full object-contain object-bottom transition-all duration-500 group-hover:scale-105"
          style={{
            mixBlendMode: "multiply",
            opacity: 0.82,
            filter: "saturate(1) contrast(1)",
            transformOrigin: "bottom right",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(253,250,244,0.96) 0%, rgba(253,250,244,0.58) 36%, rgba(253,250,244,0.02) 78%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-24"
          style={{
            background: "linear-gradient(to top, rgba(253,250,244,0.82), transparent)",
          }}
        />
      </div>

      <div className="kh-card-content relative flex min-h-[560px] flex-col justify-between p-5">
        <div>
          <div className="mb-5 flex flex-wrap gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs"
              style={{
                background: "rgba(42,66,50,0.1)",
                color: "#2A4232",
                border: "1px solid rgba(42,66,50,0.16)",
                fontFamily: "'Noto Sans KR', sans-serif",
                fontWeight: 800,
              }}
            >
              {char.category}
            </span>
            <span
              className="rounded-full px-3 py-1 text-xs"
              style={{
                background: `${mbti.color}18`,
                color: mbti.color,
                border: `1px solid ${mbti.color}3d`,
                fontFamily: "'Noto Sans KR', sans-serif",
                fontWeight: 800,
              }}
            >
              {char.mbti}
            </span>
          </div>
          <span
            style={{
              fontFamily: "'Noto Sans KR', sans-serif",
              fontSize: "0.74rem",
              color: "#8A7E6E",
            }}
          >
            {char.era} {char.years && `· ${char.years}`}
          </span>
          <h3
            className="mt-3 max-w-[70%]"
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: "clamp(1.55rem, 3vw, 2rem)",
              fontWeight: 800,
              color: "#1A1714",
              lineHeight: 1.15,
            }}
          >
            {char.name}
          </h3>
          <p
            className="mt-2 mb-5"
            style={{
              fontFamily: "'Noto Sans KR', sans-serif",
              color: "#2A4232",
              fontSize: "0.82rem",
              fontWeight: 800,
            }}
          >
            {char.role}
          </p>
          <p
            className="max-w-[72%]"
            style={{
              fontFamily: "'Noto Sans KR', sans-serif",
              color: "#5F574D",
              fontSize: "0.88rem",
              lineHeight: 1.85,
            }}
          >
            {char.summary}
          </p>
          <div className="mt-6 flex max-w-[76%] flex-wrap gap-1.5">
            {char.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2.5 py-1"
                style={{
                  background: "rgba(42,66,50,0.07)",
                  color: "#4A6040",
                  fontFamily: "'Noto Sans KR', sans-serif",
                  fontSize: "0.64rem",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div
            className="mb-3 h-px w-full"
            style={{ background: "rgba(42,66,50,0.1)" }}
          />
          <button
            onClick={() => onDetail(char.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl py-3 transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #1E3328 0%, #3D6B52 100%)",
              color: "white",
              fontFamily: "'Noto Sans KR', sans-serif",
              fontWeight: 800,
              fontSize: "0.86rem",
            }}
          >
            이 인물로 시작하기
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        aria-hidden
        className="kh-card-wash absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(100deg, rgba(253,250,244,0) 0%, rgba(253,250,244,0.5) 34%, rgba(239,229,207,0.58) 54%, rgba(253,250,244,0.22) 76%, rgba(253,250,244,0) 100%)",
        }}
      />
    </article>
  );
}

function CharacterCardSkeleton({ index }: { index: number }) {
  return (
    <article
      data-reveal
      className="kh-character-card relative min-h-[560px] overflow-hidden rounded-2xl"
      style={{
        animationDelay: `${index * 95}ms`,
        background: "#FDFAF4",
        border: "1px solid rgba(42,66,50,0.12)",
        boxShadow: "0 18px 42px rgba(42,66,50,0.08)",
      }}
    >
      <div
        className="absolute inset-y-0 right-[-14%] w-[88%]"
        style={{
          background:
            "radial-gradient(circle at 54% 40%, rgba(42,66,50,0.07), transparent 62%)",
        }}
      />
      <div className="relative flex min-h-[560px] flex-col justify-between p-5">
        <div>
          <div className="mb-6 flex gap-2">
            <div className="kh-character-skeleton h-7 w-24 rounded-full" />
            <div className="kh-character-skeleton h-7 w-16 rounded-full" />
          </div>
          <div className="kh-character-skeleton mb-4 h-4 w-32 rounded-full" />
          <div className="kh-character-skeleton mb-3 h-9 w-44 rounded-xl" />
          <div className="kh-character-skeleton mb-7 h-4 w-24 rounded-full" />
          <div className="space-y-2.5">
            <div className="kh-character-skeleton h-4 w-[72%] rounded-full" />
            <div className="kh-character-skeleton h-4 w-[62%] rounded-full" />
            <div className="kh-character-skeleton h-4 w-[48%] rounded-full" />
          </div>
        </div>
        <div>
          <div className="kh-character-skeleton mb-3 h-px w-full" />
          <div className="kh-character-skeleton h-12 w-full rounded-xl" />
        </div>
      </div>
      <div
        aria-hidden
        className="kh-character-skeleton-wash absolute inset-y-0 w-[56%]"
        style={{
          background:
            "linear-gradient(100deg, rgba(253,250,244,0) 0%, rgba(253,250,244,0.8) 46%, rgba(230,218,190,0.42) 58%, rgba(253,250,244,0) 100%)",
        }}
      />
    </article>
  );
}

export function CharacterSection({
  onDetail,
}: {
  onDetail: (id: string) => void;
}) {
  const { ref, isVisible } = useRevealOnView<HTMLElement>();
  const [characters, setCharacters] = useState<LandingCharacter[]>([]);
  const [characterError, setCharacterError] = useState<string | null>(null);
  const [isCharactersLoading, setIsCharactersLoading] = useState(true);
  const [seed, setSeed] = useState(1);

  useEffect(() => {
    setSeed(Date.now());
  }, []);

  useEffect(() => {
    let isActive = true;
    setIsCharactersLoading(true);

    fetch(`${API_BASE_URL}/api/v2/characters`)
      .then(async (response) => {
        if (!response.ok) throw new Error("대표 인물 조회 실패");
        return (await response.json()) as ApiCharacter[];
      })
      .then((data) => {
        if (!isActive) return;
        setCharacters(data.map(mapApiCharacter));
        setCharacterError(null);
      })
      .catch(() => {
        if (!isActive) return;
        setCharacters([]);
        setCharacterError("인물 API를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsCharactersLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const featured = useMemo(() => pickThree(characters, seed), [characters, seed]);

  return (
    <section
      ref={ref}
      id="characters"
      data-visible={isVisible}
      className="kh-character-section relative overflow-hidden"
      style={{
        padding: "96px 0",
        background: "rgba(244,239,228,0.58)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(253,250,244,0.34) 0%, rgba(253,250,244,0.12) 48%, rgba(253,250,244,0.38) 100%)",
        }}
      />
      <style>{`
        @keyframes khCardReveal {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes khCardDissolve {
          from { opacity: 1; transform: translateY(0); filter: blur(0); }
          to { opacity: 0.68; transform: translateY(2px); filter: blur(1.4px); }
        }
        @keyframes khGradientWash {
          from { opacity: 0; transform: translateX(-95%) skewX(-5deg); }
          42% { opacity: 0.78; }
          to { opacity: 0.35; transform: translateX(54%) skewX(-5deg); }
        }
        @keyframes khCharacterSkeletonPulse {
          0%, 100% { opacity: 0.36; }
          50% { opacity: 0.68; }
        }
        @keyframes khCharacterSkeletonWash {
          0% { opacity: 0; transform: translateX(-88%) skewX(-7deg); }
          22% { opacity: 0.78; }
          100% { opacity: 0; transform: translateX(142%) skewX(-7deg); }
        }
        .kh-character-section [data-reveal],
        .kh-character-card {
          opacity: 0;
        }
        .kh-character-section[data-visible="true"] [data-reveal],
        .kh-character-section[data-visible="true"] .kh-character-card {
          animation: khCardReveal 0.58s cubic-bezier(0.22, 0.8, 0.28, 1) both;
        }
        .kh-card-wash {
          opacity: 0;
          transform: translateX(-120%) skewX(-8deg);
        }
        .kh-character-card-leaving .kh-card-wash {
          animation: khGradientWash 0.52s ease-in-out both;
        }
        .group:hover .kh-featured-portrait {
          opacity: 0.96 !important;
          filter: saturate(1.12) contrast(1.08) !important;
        }
        .kh-character-card-leaving .kh-card-content,
        .kh-character-card-leaving .kh-featured-portrait {
          animation: khCardDissolve 0.58s ease-in-out both;
        }
        .kh-character-card-leaving .kh-featured-portrait {
          opacity: 0.68 !important;
          filter: blur(1.4px) saturate(0.96) contrast(0.98) !important;
        }
        .kh-character-skeleton {
          background: rgba(42,66,50,0.08);
          animation: khCharacterSkeletonPulse 1.2s ease-in-out infinite;
        }
        .kh-character-skeleton-wash {
          animation: khCharacterSkeletonWash 1.2s ease-in-out infinite;
        }
      `}</style>
      <div className="relative max-w-7xl mx-auto px-6">
        <div
          data-reveal
          className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <span
              className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs"
              style={{
                background: "rgba(42,66,50,0.1)",
                color: "#2A4232",
                border: "1px solid rgba(42,66,50,0.2)",
                fontFamily: "'Noto Sans KR', sans-serif",
                letterSpacing: "0.08em",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              대표 인물 체험
            </span>
            <h2
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 800,
                fontSize: "clamp(1.8rem, 4vw, 2.7rem)",
                color: "#1A1714",
                lineHeight: 1.3,
              }}
            >
              오늘 만날 역사 인물
            </h2>
            <p
              className="mt-3 max-w-xl"
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                color: "#7A7060",
                fontSize: "0.92rem",
                lineHeight: 1.8,
              }}
            >
              인물 선택 데이터에서 무작위로 세 명을 뽑아 보여줍니다. 관심 가는
              인물을 고르면 바로 상세 체험으로 이어집니다.
            </p>
          </div>
          <Link
            href="/map"
            className="inline-flex items-center justify-center gap-1.5 transition-all hover:translate-x-1 hover:opacity-80"
            style={{
              color: "#2A4232",
              fontFamily: "'Noto Sans KR', sans-serif",
              fontWeight: 900,
              fontSize: "0.9rem",
            }}
          >
            더 많은 인물 만나보기
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {isCharactersLoading ? (
            [0, 1, 2].map((index) => <CharacterCardSkeleton key={index} index={index} />)
          ) : featured.length > 0 ? (
            featured.map((char, index) => (
              <CharacterCard
                key={`${char.id}-${seed}`}
                char={char}
                index={index}
                onDetail={onDetail}
              />
            ))
          ) : (
            <div
              data-reveal
              className="col-span-full rounded-2xl px-6 py-12 text-center"
              style={{
                background: "rgba(253,250,244,0.72)",
                border: "1px solid rgba(42,66,50,0.12)",
                color: "#6F665A",
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              <p style={{ fontWeight: 800, color: "#2A4232" }}>
                표시할 인물 데이터가 없습니다.
              </p>
              <p className="mt-2 text-sm">
                {characterError ?? "백엔드 API에서 인물 목록을 받아오면 이 영역에 표시됩니다."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
