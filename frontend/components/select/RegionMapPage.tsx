import { useState, useMemo, useEffect } from "react";
import { ArrowLeft, ChevronRight, Search, X, ChevronLeft } from "lucide-react";
import mapBg from "@/public/images/image-15.png";
import { PagePagination } from "@/components/ui/page-pagination";
import { BrandLogo } from "@/components/layout/BrandLogo";

/* ──────────────────────────────────────────
   키워드 데이터
────────────────────────────────────────── */
interface Keyword {
  id: string;
  label: string;
  sublabel: string;
  hanja: string;
  accent: string;
  category?: CharacterCategory;
}

const KEYWORDS: Keyword[] = [
  {
    id: "all",
    label: "전체 보기",
    sublabel: "모든 역사 인물",
    hanja: "全",
    accent: "#5A4A32",
  },
  {
    id: "politics",
    label: "정치 / 외교",
    sublabel: "나라를 이끄는 결단",
    hanja: "政",
    accent: "#2A4232",
    category: "정치 / 외교",
  },
  {
    id: "independence",
    label: "독립 / 호국",
    sublabel: "조국을 지킨 영혼들",
    hanja: "義",
    accent: "#7A3020",
    category: "독립 / 호국",
  },
  {
    id: "art",
    label: "예술 / 문학",
    sublabel: "시대를 수놓은 아름다움",
    hanja: "藝",
    accent: "#50407A",
    category: "예술 / 문학",
  },
  {
    id: "sirhak",
    label: "사상 / 학문",
    sublabel: "지식으로 세상을 바꾸다",
    hanja: "學",
    accent: "#28506E",
    category: "사상 / 학문",
  },
];

type CharacterCategory = "정치 / 외교" | "독립 / 호국" | "예술 / 문학" | "사상 / 학문";

interface ApiCharacter {
  name: string;
  category: CharacterCategory;
  era: string;
  era_tag: string;
  role: string;
  keywords: string[];
  years: string;
  image_url?: string;
  situation: string;
  one_line_summary: string;
  mbti: string;
  mbti_nickname: string;
  mbti_details: {
    E_I: string;
    S_N: string;
    T_F: string;
    J_P: string;
  };
  stats: Array<{
    name: string;
    value: number;
    desc: string;
  }>;
  intro_quote: string;
  intro_desc: string;
  associated_stories?: unknown;
  scenarios?: unknown[];
}

interface CharacterCardData {
  id: string;
  name: string;
  category: string;
  era: string;
  role: string;
  tagline: string;
  mbti: string;
  imageUrl: string;
  keywords: string[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
let allCharactersCache: CharacterCardData[] | null = null;
let allCharactersRequest: Promise<CharacterCardData[]> | null = null;

function toCharacterCardData(char: ApiCharacter): CharacterCardData {
  return {
    id: char.name,
    name: char.name,
    category: char.category,
    era: char.era_tag || char.era,
    role: char.role,
    tagline: char.one_line_summary || char.intro_desc,
    mbti: char.mbti,
    imageUrl: char.image_url || "/logo.svg",
    keywords: char.keywords ?? [],
  };
}

async function fetchAllCharacters() {
  if (allCharactersCache) return allCharactersCache;
  if (allCharactersRequest) return allCharactersRequest;

  allCharactersRequest = fetch(`${API_BASE_URL}/api/v2/characters`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`캐릭터 조회 실패 (${response.status})`);
      }
      return response.json() as Promise<ApiCharacter[]>;
    })
    .then((data) => {
      const characters = data.map(toCharacterCardData);
      allCharactersCache = characters;
      return characters;
    })
    .finally(() => {
      allCharactersRequest = null;
    });

  return allCharactersRequest;
}

/* MBTI 유형 그룹 */
const MBTI_GROUPS = [
  { label: "분석가형", types: ["INTJ", "INTP", "ENTJ", "ENTP"], color: "#4A3A6A" },
  { label: "외교관형", types: ["INFJ", "INFP", "ENFJ", "ENFP"], color: "#2A5A4A" },
  { label: "관리자형", types: ["ISTJ", "ISFJ", "ESTJ", "ESFJ"], color: "#3A4A6A" },
  { label: "탐험가형", types: ["ISTP", "ISFP", "ESTP", "ESFP"], color: "#6A3A2A" },
];

function getMbtiColor(type: string | null) {
  return MBTI_GROUPS.find((group) => type && group.types.includes(type))?.color ?? "#A06C1A";
}

/* ──────────────────────────────────────────
   인물 카드
────────────────────────────────────────── */
function CharacterCard({
  character,
  onDetail,
  mbtiMatch,
}: {
  character: CharacterCardData;
  onDetail: (id: string) => void;
  mbtiMatch?: boolean;
}) {
  const mbtiColor = getMbtiColor(character.mbti);

  return (
    <div
      className="flex overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
      style={{
        background: "rgba(252,248,238,0.98)",
        border: "1.5px solid rgba(110,80,40,0.22)",
        boxShadow: "0 4px 20px rgba(90,60,20,0.1)",
        minHeight: "136px",
      }}
      onClick={() => onDetail(character.id)}
    >
      {/* 왼쪽: 초상화 */}
      <div
        className="flex-shrink-0 relative overflow-hidden"
        style={{
          width: "136px",
          minHeight: "136px",
          background:
            "radial-gradient(circle at 50% 28%, rgba(253,250,244,0.74), rgba(210,190,146,0.42) 58%, rgba(120,92,52,0.14)), linear-gradient(170deg, #EDE0C4 0%, #D9C99A 100%)",
          alignSelf: "stretch",
        }}
      >
        <img
          src={character.imageUrl}
          alt={character.name}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 10%",
            display: "block",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "38%",
            background:
              "linear-gradient(to bottom, rgba(217,201,154,0) 0%, rgba(217,201,154,0.72) 60%, rgba(217,201,154,0.98) 100%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to right, transparent 58%, rgba(252,248,238,0.72) 100%)",
            pointerEvents: "none",
          }}
        />
        {/* MBTI 일치 뱃지 */}
        {mbtiMatch && (
          <div
            className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full"
            style={{
              background: "#C9931A",
              fontSize: "0.58rem",
              color: "white",
              fontFamily: "'Noto Sans KR', sans-serif",
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            MBTI 일치
          </div>
        )}
      </div>

      {/* 오른쪽: 정보 */}
      <div className="flex-1 px-4 py-3.5 flex flex-col justify-between min-w-0">
        <div>
          <div className="flex gap-1.5 mb-1.5 flex-wrap">
            <span
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: "0.6rem",
                background: "rgba(42,66,50,0.08)",
                color: "#4A6040",
                borderRadius: "99px",
                padding: "1px 7px",
              }}
            >
              {character.era}
            </span>
            <span
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: "0.6rem",
                background: `${mbtiColor}${mbtiMatch ? "26" : "14"}`,
                color: mbtiColor,
                borderRadius: "99px",
                padding: "1px 7px",
                fontWeight: 700,
                border: mbtiMatch ? `1px solid ${mbtiColor}44` : "none",
              }}
            >
              {character.mbti}
            </span>
          </div>
          <h3
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontWeight: 700,
              fontSize: "0.95rem",
              color: "#1A1714",
              marginBottom: "2px",
              lineHeight: 1.3,
            }}
          >
            {character.name}
          </h3>
          <p
            style={{
              fontFamily: "'Noto Sans KR', sans-serif",
              fontSize: "0.68rem",
              color: "#7A7060",
              marginBottom: "5px",
            }}
          >
            {character.role.split(" · ")[0]}
          </p>
          <p
            style={{
              fontFamily: "'Noto Sans KR', sans-serif",
              fontSize: "0.72rem",
              color: "#5A5248",
              lineHeight: 1.6,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {character.tagline}
          </p>
        </div>

        <button
          className="mt-2.5 flex items-center gap-1 transition-opacity hover:opacity-70 self-start"
          style={{
            color: "#2A4232",
            fontFamily: "'Noto Sans KR', sans-serif",
            fontWeight: 700,
            fontSize: "0.78rem",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onDetail(character.id);
          }}
        >
          체험하기
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   키워드 버튼
────────────────────────────────────────── */
function KeywordButton({
  kw,
  selected,
  count,
  onClick,
}: {
  kw: Keyword;
  selected: boolean;
  count?: number;
  onClick: () => void;
}) {
  const accentRgb =
    kw.accent === "#2A4232" ? "42,66,50"
    : kw.accent === "#7A3020" ? "122,48,32"
    : kw.accent === "#50407A" ? "80,64,122"
    : kw.accent === "#28506E" ? "40,80,110"
    : "90,74,50";

  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-3 w-full text-left transition-all duration-200"
      style={{
        background: selected
          ? `rgba(${accentRgb},0.11)`
          : "rgba(248,242,228,0.5)",
        border: selected
          ? `1.5px solid ${kw.accent}40`
          : "1.5px solid rgba(110,80,40,0.10)",
        borderRadius: "14px",
        padding: "11px 14px",
        backdropFilter: "blur(4px)",
        boxShadow: selected
          ? `0 3px 14px ${kw.accent}1A`
          : "0 1px 6px rgba(90,60,20,0.05)",
        transform: selected ? "translateX(3px)" : "translateX(0)",
      }}
    >
      {/* 좌측 선택 인디케이터 */}
      {selected && (
        <div
          className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-full"
          style={{ background: kw.accent }}
        />
      )}

      {/* 한자 배지 */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full"
        style={{
          width: "40px",
          height: "40px",
          background: selected ? kw.accent : "rgba(220,205,178,0.55)",
          border: `1px solid ${selected ? "transparent" : "rgba(110,80,40,0.15)"}`,
          transition: "all 0.2s",
        }}
      >
        <span
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: "1.15rem",
            fontWeight: 700,
            color: selected ? "white" : kw.accent,
            lineHeight: 1,
          }}
        >
          {kw.hanja}
        </span>
      </div>

      {/* 텍스트 */}
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontWeight: 700,
            fontSize: "0.88rem",
            color: selected ? kw.accent : "#2A2420",
            lineHeight: 1.2,
            marginBottom: "2px",
          }}
        >
          {kw.label}
        </div>
        <div
          style={{
            fontFamily: "'Noto Sans KR', sans-serif",
            fontSize: "0.68rem",
            color: selected ? kw.accent + "BB" : "#8A7E6E",
          }}
        >
          {kw.sublabel}
        </div>
      </div>

      {/* 인물 수 + 화살표 */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: "22px",
            height: "22px",
            background: selected ? kw.accent + "22" : "rgba(200,185,158,0.35)",
          }}
        >
          <span
            style={{
              fontFamily: "'Noto Sans KR', sans-serif",
              fontSize: "0.65rem",
              fontWeight: 700,
              color: selected ? kw.accent : "#7A7060",
            }}
          >
            {count ?? "…"}
          </span>
        </div>
        <ChevronRight
          className="w-3.5 h-3.5 transition-transform duration-200"
          style={{
            color: selected ? kw.accent : "#B0A090",
            transform: selected ? "translateX(2px)" : "none",
          }}
        />
      </div>
    </button>
  );
}

/* ──────────────────────────────────────────
   장식 구분선
────────────────────────────────────────── */
function InkDivider() {
  return (
    <div className="flex items-center gap-2.5 my-4">
      <div
        className="flex-1 h-px"
        style={{
          background: "linear-gradient(to right, transparent, rgba(110,80,40,0.22))",
        }}
      />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: i === 1 ? "4px" : "2.5px",
            height: i === 1 ? "4px" : "2.5px",
            background: "rgba(110,80,40,0.28)",
          }}
        />
      ))}
      <div
        className="flex-1 h-px"
        style={{
          background: "linear-gradient(to left, transparent, rgba(110,80,40,0.22))",
        }}
      />
    </div>
  );
}

/* ──────────────────────────────────────────
   MBTI 선택 팝오버
────────────────────────────────────────── */
function MbtiPicker({
  selected,
  availableMbtiTypes,
  onSelect,
}: {
  selected: string | null;
  availableMbtiTypes: Set<string>;
  onSelect: (mbti: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedColor = getMbtiColor(selected);

  return (
    <div className="relative w-[38%] min-w-[150px] max-w-[190px]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="kh-mbti-curiosity relative flex w-full items-center justify-between gap-2 overflow-hidden px-3 py-2 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-sm"
        style={{
          background: selected
            ? `${selectedColor}18`
            : "linear-gradient(135deg, rgba(42,66,50,0.14), rgba(61,107,82,0.22))",
          border: selected
            ? `1.5px solid ${selectedColor}44`
            : "1.5px solid rgba(42,66,50,0.28)",
          fontFamily: "'Noto Sans KR', sans-serif",
          fontSize: "0.78rem",
          color: selected ? selectedColor : "#2A4232",
          fontWeight: selected ? 700 : 400,
          whiteSpace: "nowrap",
          boxShadow: selected ? "none" : "0 3px 12px rgba(42,66,50,0.1)",
        }}
      >
        {selected ? (
          <>
            <span style={{ fontWeight: 800 }}>{selected}</span>
            <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>일치</span>
            <X
              className="w-3 h-3 ml-0.5 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
                setOpen(false);
              }}
            />
          </>
        ) : (
          <>
            <span className="relative z-10 min-w-0 truncate">
              내 MBTI 영웅은?
            </span>
            <ChevronRight
              className="relative z-10 w-3.5 h-3.5 flex-shrink-0"
              style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
            />
          </>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full mt-1.5 right-0 z-50 rounded-2xl overflow-hidden"
          style={{
            background: "rgba(248,244,234,0.98)",
            border: "1.5px solid rgba(110,80,40,0.2)",
            boxShadow: "0 8px 32px rgba(60,40,10,0.18)",
            backdropFilter: "blur(12px)",
            minWidth: "280px",
          }}
        >
          {/* 헤더 */}
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: "rgba(110,80,40,0.12)" }}
          >
            <p
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "#1A1714",
                marginBottom: "2px",
              }}
            >
              나의 MBTI로 인물 찾기
            </p>
            <p
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: "0.68rem",
                color: "#8A7E6E",
              }}
            >
              유형을 선택하면 성격이 비슷한 역사 인물을 강조합니다
            </p>
          </div>

          {/* MBTI 그룹별 목록 */}
          <div className="p-3 flex flex-col gap-2.5">
            {MBTI_GROUPS.map((group) => (
              <div key={group.label}>
                <p
                  className="mb-1.5"
                  style={{
                    fontFamily: "'Noto Sans KR', sans-serif",
                    fontSize: "0.62rem",
                    color: group.color,
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                  }}
                >
                  {group.label}
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {group.types.map((type) => {
                    const isSelected = selected === type;
                    const hasMatch = availableMbtiTypes.has(type);
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          onSelect(isSelected ? null : type);
                          setOpen(false);
                        }}
                        className="px-2.5 py-1 rounded-lg transition-all"
                        style={{
                          fontFamily: "'Noto Sans KR', sans-serif",
                          fontSize: "0.72rem",
                          fontWeight: isSelected ? 700 : 500,
                          background: isSelected
                            ? group.color
                            : hasMatch
                            ? `${group.color}14`
                            : "rgba(220,210,195,0.4)",
                          color: isSelected
                            ? "white"
                            : hasMatch
                            ? group.color
                            : "#B0A090",
                          border: `1px solid ${isSelected ? "transparent" : hasMatch ? `${group.color}30` : "transparent"}`,
                          position: "relative",
                        }}
                      >
                        {type}
                        {hasMatch && !isSelected && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
                            style={{ background: "#C9931A" }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 바깥 클릭 닫기 */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}

const PAGE_SIZE_DESKTOP = 6;

/* ──────────────────────────────────────────
   메인 컴포넌트
────────────────────────────────────────── */
const PAGE_SIZE_MOBILE = 4;

export function RegionMapPage({
  onBack,
  onDetail,
}: {
  onBack: () => void;
  onDetail: (id: string) => void;
}) {
  const [selectedKeyword, setSelectedKeyword] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mbtiFilter, setMbtiFilter] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"keywords" | "chars">("keywords");
  const [desktopPage, setDesktopPage] = useState(0);
  const [mobileShown, setMobileShown] = useState(PAGE_SIZE_MOBILE);
  const [allCharacters, setAllCharacters] = useState<CharacterCardData[]>(
    allCharactersCache ?? []
  );
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(!allCharactersCache);
  const [characterError, setCharacterError] = useState<string | null>(null);
  const [introReady, setIntroReady] = useState(false);

  const activeKw = KEYWORDS.find((k) => k.id === selectedKeyword) ?? KEYWORDS[0];
  const activeCategory = activeKw.category;
  const mbtiFilterColor = getMbtiColor(mbtiFilter);

  useEffect(() => {
    const timer = setTimeout(() => setIntroReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let ignore = false;

    if (allCharactersCache) {
      setAllCharacters(allCharactersCache);
      setCharacterError(null);
      setIsLoadingCharacters(false);
      return;
    }

    setIsLoadingCharacters(true);
    setCharacterError(null);

    fetchAllCharacters()
      .then((nextCharacters) => {
        if (ignore) return;
        setAllCharacters(nextCharacters);
      })
      .catch((error: unknown) => {
        if (ignore) return;
        console.error(error);
        setAllCharacters([]);
        setCharacterError("인물 API를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!ignore) setIsLoadingCharacters(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const categoryCounts = useMemo(() => {
    return KEYWORDS.reduce<Record<string, number>>((acc, kw) => {
      acc[kw.id] = kw.category
        ? allCharacters.filter((char) => char.category === kw.category).length
        : allCharacters.length;
      return acc;
    }, {});
  }, [allCharacters]);

  const characters = useMemo(() => {
    return activeCategory
      ? allCharacters.filter((char) => char.category === activeCategory)
      : allCharacters;
  }, [activeCategory, allCharacters]);

  /* 필터링: 키워드 + 검색 + MBTI 모두 통과해야 표시 */
  const filteredChars = useMemo(() => {
    return characters.filter((char) => {
      // 검색어 필터
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const match =
          char.name.includes(q) ||
          char.role.toLowerCase().includes(q) ||
          char.mbti.toLowerCase().includes(q) ||
          char.era.includes(q) ||
          char.tagline.includes(q) ||
          char.category.includes(q) ||
          char.keywords.some((keyword) => keyword.toLowerCase().includes(q));
        if (!match) return false;
      }

      // MBTI 필터
      if (mbtiFilter && char.mbti !== mbtiFilter) return false;

      return true;
    });
  }, [characters, searchQuery, mbtiFilter]);

  const availableMbtiTypes = useMemo(() => {
    return new Set(characters.map((char) => char.mbti));
  }, [characters]);

  const isMbtiMatch = (character: CharacterCardData) =>
    mbtiFilter ? character.mbti === mbtiFilter : false;

  /* 필터 바뀌면 페이지 리셋 */
  useEffect(() => {
    setDesktopPage(0);
    setMobileShown(PAGE_SIZE_MOBILE);
  }, [selectedKeyword, searchQuery, mbtiFilter]);

  /* PC 페이지네이션 */
  const desktopChars = filteredChars.slice(
    desktopPage * PAGE_SIZE_DESKTOP,
    (desktopPage + 1) * PAGE_SIZE_DESKTOP
  );

  /* 모바일 더보기 */
  const mobileChars = filteredChars.slice(0, mobileShown);
  const hasMobileMore = mobileShown < filteredChars.length;

  const getKeywordCount = (kw: Keyword) => {
    return categoryCounts[kw.id] ?? 0;
  };

  const panelBase = {
    background: "rgba(236,224,198,0.38)",
    backdropFilter: "blur(6px)",
  } as const;
  const layerClass = introReady ? "kh-layer-visible" : "kh-layer-hidden";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
    >
      <style>{`
        @media (min-width: 768px) {
          .kh-kw-panel {
            width: 40% !important;
            border-right: 1px solid rgba(110,80,40,0.15) !important;
            border-bottom: none !important;
          }
          .kh-char-panel {
            width: 60% !important;
          }
        }
        .kh-search-input:focus {
          outline: none;
        }
        @keyframes khMapReveal {
          0% {
            opacity: 0;
            clip-path: circle(0% at 46% 48%);
            filter: blur(3px) contrast(0.96) saturate(0.88);
          }
          35% {
            opacity: 0.42;
            clip-path: circle(36% at 42% 45%);
          }
          68% {
            opacity: 0.78;
            clip-path: circle(80% at 52% 50%);
            filter: blur(1.6px) contrast(0.98) saturate(0.92);
          }
          88% {
            opacity: 0.94;
            clip-path: circle(128% at 50% 50%);
          }
          100% {
            opacity: 1;
            clip-path: circle(145% at 50% 50%);
            filter: blur(1.2px) contrast(1) saturate(0.95);
          }
        }
        @keyframes khInkBloom {
          0% {
            opacity: 0;
            transform: scale(0.52);
            filter: blur(30px) saturate(0.72);
          }
          28% {
            opacity: 0.82;
            transform: scale(0.9);
          }
          70% {
            opacity: 0.42;
            transform: scale(1.32);
            filter: blur(28px) saturate(0.86);
          }
          100% {
            opacity: 0.08;
            transform: scale(1.68);
            filter: blur(40px) saturate(0.78);
          }
        }
        @keyframes khDarkWash {
          0% {
            opacity: 0.72;
          }
          54% {
            opacity: 0.34;
          }
          100% {
            opacity: 0;
          }
        }
        @keyframes khLayerFadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes khCardRise {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .kh-ink-wash {
          animation: khInkBloom 1.5s cubic-bezier(0.19, 0.72, 0.22, 1) both;
        }
        .kh-map-reveal {
          animation: khMapReveal 1.5s cubic-bezier(0.19, 0.72, 0.22, 1) both;
        }
        .kh-dark-wash {
          animation: khDarkWash 1.5s ease-out both;
        }
        .kh-bg-ready {
          filter: none;
          transform: none;
        }
        .kh-layer-hidden {
          opacity: 0;
          transform: translateY(10px);
          pointer-events: none;
        }
        .kh-layer-visible {
          animation: khLayerFadeIn 0.72s ease-out both;
        }
        .kh-card-stagger {
          opacity: 0;
          animation: khCardRise 0.58s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .kh-ink-wash,
          .kh-dark-wash,
          .kh-map-reveal,
          .kh-layer-visible,
          .kh-card-stagger {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .kh-layer-hidden {
            opacity: 1 !important;
            transform: none !important;
            pointer-events: auto !important;
          }
        }
        .kh-mbti-curiosity::after {
          content: "";
          position: absolute;
          inset: 2px;
          border-radius: 10px;
          background: linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.32) 44%, transparent 72%);
          transform: translateX(-130%);
          transition: transform 0.7s ease;
          pointer-events: none;
        }
        .kh-mbti-curiosity:hover::after {
          transform: translateX(130%);
        }
        .kh-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(90, 74, 50, 0.34) rgba(248, 242, 228, 0.34);
        }
        .kh-scrollbar::-webkit-scrollbar {
          width: 9px;
        }
        .kh-scrollbar::-webkit-scrollbar-track {
          background: rgba(248, 242, 228, 0.34);
          border-radius: 999px;
        }
        .kh-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(90, 74, 50, 0.24), rgba(42, 66, 50, 0.34));
          border: 2px solid rgba(248, 242, 228, 0.56);
          border-radius: 999px;
        }
        .kh-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(90, 74, 50, 0.36), rgba(42, 66, 50, 0.48));
        }
        @keyframes khSelectSkeletonPulse {
          0%, 100% { opacity: 0.34; }
          50% { opacity: 0.68; }
        }
        @keyframes khSelectSkeletonWash {
          0% { opacity: 0; transform: translateX(-86%) skewX(-7deg); }
          24% { opacity: 0.72; }
          100% { opacity: 0; transform: translateX(138%) skewX(-7deg); }
        }
        .kh-select-skeleton {
          background: rgba(42,66,50,0.08);
          animation: khSelectSkeletonPulse 1.2s ease-in-out infinite;
        }
        .kh-select-skeleton-wash {
          animation: khSelectSkeletonWash 1.2s ease-in-out infinite;
        }
      `}</style>

      {/* ── 배경 고지도 ── */}
      <div className={`absolute inset-0 transition-[filter,transform] duration-700 ${introReady ? "kh-bg-ready" : ""}`}>
        <img
          src={mapBg.src}
          alt="한국 고지도"
          className="kh-map-reveal w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0" style={{ background: "rgba(232,218,190,0.06)" }} />
        <div
          className="kh-ink-wash absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 34% 38%, rgba(26,37,32,0.42), transparent 24%), radial-gradient(circle at 58% 50%, rgba(90,74,50,0.36), transparent 34%), radial-gradient(circle at 70% 58%, rgba(122,48,32,0.2), transparent 28%)",
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* ── 헤더 ── */}
      <header
        className={`relative flex-shrink-0 h-14 border-b ${layerClass}`}
        style={{
          background: "rgba(240,230,208,0.62)",
          borderColor: "rgba(110,80,40,0.18)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="mx-auto flex h-full w-full max-w-[1440px] items-center justify-between px-5">
          <button
            onClick={onBack}
            className="flex items-center gap-2 transition-opacity hover:opacity-60"
            style={{ color: "#4A4035", fontSize: "13px" }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">돌아가기</span>
          </button>
          <div
            className="flex items-center gap-2 px-3 py-1 rounded-full"
            style={{ background: "rgba(42,66,50,0.1)" }}
          >
            <span
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: activeKw.accent,
              }}
            >
              {activeKw.hanja}
            </span>
            <span
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: "0.75rem",
                color: "#2A4232",
                fontWeight: 600,
              }}
            >
              {activeKw.label}
            </span>
          </div>
          <BrandLogo compact />
        </div>
      </header>

      {/* ── 모바일 탭 바 ── */}
      <div
        className={`relative md:hidden flex-shrink-0 flex border-b ${layerClass}`}
        style={{
          background: "rgba(240,230,208,0.72)",
          backdropFilter: "blur(8px)",
          borderColor: "rgba(110,80,40,0.15)",
        }}
      >
        {(["keywords", "chars"] as const).map((tab) => {
          const active = mobileTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className="flex-1 py-3 text-sm transition-all"
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontWeight: active ? 700 : 400,
                color: active ? "#2A4232" : "#7A7060",
                borderBottom: active ? "2px solid #3D6B52" : "2px solid transparent",
              }}
            >
              {tab === "keywords" ? "🪷 주제 선택" : `👤 인물 선택`}
            </button>
          );
        })}
      </div>

      {/* ── 본문 ── */}
      <div className={`relative flex-1 flex flex-col md:flex-row overflow-hidden ${layerClass}`}>

        {/* ══ 키워드 패널 (40%) ══ */}
        <div
          className={`kh-kw-panel ${mobileTab === "keywords" ? "flex" : "hidden"} md:flex flex-col overflow-y-auto px-5 py-5 md:px-8 md:py-7`}
          style={{
            ...panelBase,
            width: "100%",
            borderBottom: "1px solid rgba(110,80,40,0.12)",
          }}
        >
          {/* 제목 */}
          <div className="mb-1">
            <p
              style={{
                fontSize: "10px",
                color: "#9A8E7E",
                letterSpacing: "0.12em",
                marginBottom: "8px",
                fontWeight: 500,
              }}
            >
              STEP 1 · 주제 선택
            </p>
            <h2
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 700,
                fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)",
                color: "#1A1714",
                lineHeight: 1.3,
                marginBottom: "6px",
              }}
            >
              어떤 이야기를<br />체험하시겠어요?
            </h2>
            <p style={{ fontSize: "12px", color: "#8A7E6E", lineHeight: 1.7 }}>
              관심 주제를 선택해 역사 인물을 만나보세요.
            </p>
          </div>

          <InkDivider />

          {/* 키워드 목록 */}
          <div className="flex flex-col gap-2">
            {KEYWORDS.map((kw) => (
              <KeywordButton
                key={kw.id}
                kw={kw}
                count={getKeywordCount(kw)}
                selected={selectedKeyword === kw.id}
                onClick={() => {
                  setSelectedKeyword(kw.id);
                  setMobileTab("chars");
                }}
              />
            ))}
          </div>

          <InkDivider />

          {/* 하단 안내 */}
          <div
            className="rounded-xl px-3.5 py-2.5"
            style={{
              background: "rgba(248,242,228,0.6)",
              border: "1px solid rgba(110,80,40,0.1)",
            }}
          >
            <p style={{ fontSize: "11px", color: "#8A7E6E", lineHeight: 1.7 }}>
              💡 각 인물은 실제 역사적 결정의 순간을 담고 있습니다. 주제를 선택해 당신만의 역사 체험을 시작하세요.
            </p>
          </div>

          {/* 모바일 – 다음 버튼 */}
          <button
            onClick={() => setMobileTab("chars")}
            className="md:hidden mt-4 flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
            style={{
              background: "linear-gradient(135deg,#2A4232 0%,#3D6B52 100%)",
              color: "white",
              fontFamily: "'Noto Sans KR', sans-serif",
              fontWeight: 700,
              boxShadow: "0 3px 12px rgba(42,66,50,0.28)",
            }}
          >
            인물 선택하기 <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* ══ 인물 패널 (60%) ══ */}
        <div
          className={`kh-char-panel ${mobileTab === "chars" ? "flex" : "hidden"} md:flex flex-1 flex-col overflow-hidden px-5 py-5 md:px-7 md:py-6`}
          style={{ background: "rgba(248,242,230,0.32)", backdropFilter: "blur(6px)" }}
        >
          {/* 패널 타이틀 + 검색 영역 */}
          <div className="mb-4">
            {/* 선택 키워드 배지 */}
            <div className="flex items-center gap-2 mb-2.5">
              <div
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full"
                style={{
                  background: activeKw.accent + "18",
                  border: `1px solid ${activeKw.accent}28`,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Noto Serif KR', serif",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: activeKw.accent,
                  }}
                >
                  {activeKw.hanja}
                </span>
                <span
                  style={{
                    fontFamily: "'Noto Sans KR', sans-serif",
                    fontSize: "0.68rem",
                    color: activeKw.accent,
                    fontWeight: 600,
                  }}
                >
                  {activeKw.label}
                </span>
              </div>
              {mbtiFilter && (
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                  style={{
                    background: `${mbtiFilterColor}18`,
                    border: `1px solid ${mbtiFilterColor}44`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Noto Sans KR', sans-serif",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      color: mbtiFilterColor,
                    }}
                  >
                    {mbtiFilter} 일치
                  </span>
                </div>
              )}
            </div>

            <p
              style={{
                fontSize: "10px",
                color: "#9A8E7E",
                letterSpacing: "0.08em",
                marginBottom: "3px",
              }}
            >
              STEP 2 · 인물 선택
            </p>
            <h2
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 600,
                fontSize: "clamp(0.95rem, 1.8vw, 1.25rem)",
                color: "#1A1714",
                lineHeight: 1.35,
                marginBottom: "12px",
              }}
            >
              체험할 인물을 선택하세요
            </h2>

            {/* 검색 + MBTI 필터 행 */}
            <div className="flex gap-2">
              {/* 검색 인풋 */}
              <div
                className="flex min-w-0 flex-[1.65] items-center gap-2 px-3 py-2 rounded-xl"
                style={{
                  background: "rgba(248,242,228,0.88)",
                  border: "1.5px solid rgba(110,80,40,0.18)",
                }}
              >
                <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#9A8E7E" }} />
                <input
                  type="text"
                  placeholder="이름, 시대, 역할로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="kh-search-input flex-1 bg-transparent border-none text-sm"
                  style={{
                    fontFamily: "'Noto Sans KR', sans-serif",
                    fontSize: "0.78rem",
                    color: "#2A2420",
                    caretColor: "#2A4232",
                  }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")}>
                    <X className="w-3.5 h-3.5" style={{ color: "#9A8E7E" }} />
                  </button>
                )}
              </div>

              {/* MBTI 선택 */}
              <MbtiPicker
                selected={mbtiFilter}
                availableMbtiTypes={availableMbtiTypes}
                onSelect={setMbtiFilter}
              />
            </div>

            {/* 활성 필터 요약 */}
            {(searchQuery || mbtiFilter) && (
              <div className="mt-2 flex items-center gap-1.5">
                <span style={{ fontSize: "0.68rem", color: "#9A8E7E" }}>필터:</span>
                {searchQuery && (
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{
                      fontSize: "0.68rem",
                      background: "rgba(42,66,50,0.08)",
                      color: "#2A4232",
                      fontWeight: 600,
                    }}
                  >
                    "{searchQuery}"
                  </span>
                )}
                {mbtiFilter && (
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{
                      fontSize: "0.68rem",
                      background: `${mbtiFilterColor}14`,
                      color: mbtiFilterColor,
                      fontWeight: 600,
                    }}
                  >
                    MBTI {mbtiFilter}
                  </span>
                )}
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setMbtiFilter(null);
                  }}
                  style={{ fontSize: "0.68rem", color: "#9A8E7E", textDecoration: "underline" }}
                >
                  초기화
                </button>
              </div>
            )}
            {(isLoadingCharacters || characterError) && (
              <div
                className="mt-2 rounded-lg px-2.5 py-1.5"
                style={{
                  background: characterError ? "rgba(122,48,32,0.08)" : "rgba(42,66,50,0.08)",
                  color: characterError ? "#7A3020" : "#2A4232",
                  fontFamily: "'Noto Sans KR', sans-serif",
                  fontSize: "0.68rem",
                  lineHeight: 1.5,
                }}
              >
                {characterError ?? "인물 데이터를 불러오는 중입니다..."}
              </div>
            )}
          </div>

          {/* ── PC: 카드 목록 + 페이지네이션 ── */}
          <div className="hidden md:flex flex-1 flex-col overflow-hidden">
            {isLoadingCharacters ? (
              <CharacterListSkeleton count={PAGE_SIZE_DESKTOP} />
            ) : filteredChars.length === 0 ? (
              <EmptyState onReset={() => { setSearchQuery(""); setMbtiFilter(null); setSelectedKeyword("all"); }} />
            ) : (
              <>
                {/* 결과 수 */}
                <p className="mb-3" style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: "0.72rem", color: "#9A8E7E" }}>
                  총 <strong style={{ color: activeKw.accent }}>{filteredChars.length}</strong>명의 인물
                </p>
                <div className="kh-scrollbar flex-1 flex flex-col gap-3 overflow-y-auto pr-2">
                  {desktopChars.map((character, idx) => (
                    <div
                      key={character.id}
                      className={introReady ? "kh-card-stagger" : ""}
                      style={{ animationDelay: `${idx * 85}ms` }}
                    >
                      <CharacterCard
                        character={character}
                        onDetail={onDetail}
                        mbtiMatch={isMbtiMatch(character)}
                      />
                    </div>
                  ))}
                </div>
                <PagePagination
                  accentColor={activeKw.accent}
                  onPageChange={setDesktopPage}
                  page={desktopPage}
                  pageSize={PAGE_SIZE_DESKTOP}
                  total={filteredChars.length}
                />
              </>
            )}
          </div>

          {/* ── 모바일: 카드 목록 + 더보기 ── */}
          <div className="kh-scrollbar md:hidden flex-1 flex flex-col overflow-y-auto gap-3 pr-2">
            {isLoadingCharacters ? (
              <CharacterListSkeleton count={PAGE_SIZE_MOBILE} />
            ) : filteredChars.length === 0 ? (
              <EmptyState onReset={() => { setSearchQuery(""); setMbtiFilter(null); setSelectedKeyword("all"); }} />
            ) : (
              <>
                <p style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: "0.72rem", color: "#9A8E7E" }}>
                  총 <strong style={{ color: activeKw.accent }}>{filteredChars.length}</strong>명의 인물
                </p>
                {mobileChars.map((character, idx) => (
                  <div
                    key={character.id}
                    className={introReady ? "kh-card-stagger" : ""}
                    style={{ animationDelay: `${idx * 85}ms` }}
                  >
                    <CharacterCard
                      character={character}
                      onDetail={onDetail}
                      mbtiMatch={isMbtiMatch(character)}
                    />
                  </div>
                ))}
                {hasMobileMore && (
                  <button
                    onClick={() => setMobileShown((v) => v + PAGE_SIZE_MOBILE)}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl transition-all"
                    style={{
                      background: "rgba(248,242,228,0.85)",
                      border: "1.5px solid rgba(110,80,40,0.18)",
                      fontFamily: "'Noto Sans KR', sans-serif",
                      fontSize: "0.82rem",
                      color: "#4A4035",
                      fontWeight: 600,
                    }}
                  >
                    더보기 ({filteredChars.length - mobileShown}명 더)
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   빈 결과 상태
────────────────────────────────────────── */
function CharacterListSkeleton({ count }: { count: number }) {
  return (
    <>
      <div className="kh-select-skeleton mb-3 h-4 w-28 rounded-full" />
      <div className="kh-scrollbar flex-1 flex flex-col gap-3 overflow-y-auto pr-2">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className="relative overflow-hidden rounded-2xl"
            style={{
              minHeight: "150px",
              background: "rgba(248,242,228,0.64)",
              border: "1px solid rgba(110,80,40,0.13)",
              boxShadow: "0 4px 18px rgba(90,74,50,0.08)",
            }}
          >
            <div
              className="absolute inset-y-0 left-0 w-[34%]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(42,66,50,0.08), rgba(154,142,126,0.13), rgba(42,66,50,0.06))",
              }}
            />
            <div className="relative ml-[34%] p-5">
              <div className="mb-3 flex gap-2">
                <div className="kh-select-skeleton h-6 w-24 rounded-full" />
                <div className="kh-select-skeleton h-6 w-14 rounded-full" />
              </div>
              <div className="kh-select-skeleton mb-3 h-7 w-24 rounded-lg" />
              <div className="kh-select-skeleton mb-2 h-4 w-[84%] rounded-full" />
              <div className="kh-select-skeleton mb-4 h-4 w-[62%] rounded-full" />
              <div className="flex gap-2">
                <div className="kh-select-skeleton h-6 w-20 rounded-full" />
                <div className="kh-select-skeleton h-6 w-16 rounded-full" />
              </div>
            </div>
            <div
              aria-hidden
              className="kh-select-skeleton-wash absolute inset-y-0 w-[56%]"
              style={{
                background:
                  "linear-gradient(100deg, rgba(253,250,244,0) 0%, rgba(253,250,244,0.78) 46%, rgba(230,218,190,0.42) 58%, rgba(253,250,244,0) 100%)",
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-10 rounded-2xl"
      style={{
        background: "rgba(248,242,228,0.5)",
        border: "1px dashed rgba(110,80,40,0.2)",
      }}
    >
      <p style={{ fontFamily: "'Noto Serif KR', serif", fontSize: "1.5rem", marginBottom: "8px" }}>
        🔍
      </p>
      <p style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: "0.82rem", color: "#8A7E6E", textAlign: "center" }}>
        조건에 맞는 인물이 없습니다.<br />
        <button className="underline mt-1" style={{ color: "#2A4232" }} onClick={onReset}>
          필터 초기화하기
        </button>
      </p>
    </div>
  );
}
