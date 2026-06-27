'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock, BarChart2 } from 'lucide-react';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { storyPageBackground } from '@/components/layout/storyPageBackground';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

const detailCache = new Map<string, CharacterDetailPayload>();
const detailRequestCache = new Map<string, Promise<CharacterDetailPayload>>();

type ApiMbtiDetails = Partial<Record<'E_I' | 'S_N' | 'T_F' | 'J_P', string>>;

interface ApiStat {
  name: string;
  value: number;
  desc: string;
}

interface ApiScenarioTurn {
  title?: string;
}

interface ApiScenario {
  id?: number | string;
  scenario_id?: number | string;
  title: string;
  description: string;
  historical_facts?: string;
  turns?: ApiScenarioTurn[];
  image_url?: string;
}

interface ApiCharacterDetail {
  name: string;
  category?: string;
  era?: string;
  era_tag?: string;
  role?: string;
  keywords?: string[];
  years?: string;
  image_url?: string;
  situation?: string;
  one_line_summary?: string;
  mbti?: string;
  mbti_nickname?: string;
  mbti_details?: ApiMbtiDetails;
  stats?: ApiStat[];
  intro_quote?: string;
  intro_desc?: string;
  scenarios?: ApiScenario[];
}

interface CharacterDetailPayload {
  char: CharacterData;
  scenarios: ScenarioMeta[];
}

interface Strength {
  name: string;
  score: number;
  max: number;
  value: number;
  desc: string;
}

interface MbtiType {
  letter: string;
  label: string;
  desc: string;
}

interface CharacterData {
  id: string;
  name: string;
  role: string;
  tagline: string;
  era: string;
  years: string;
  situation: string;
  summary: string;
  mbti: string;
  mbtiTitle: string;
  mbtiSubtitle: string;
  strengths: Strength[];
  mbtiTypes: MbtiType[];
  quote: string;
  storyIntro: string;
  img: string;
  bgImg: string;
  tags: string[];
  region: string;
}

interface ScenarioMeta {
  id: string;
  charId: string;
  index: number;
  title: string;
  subtitle: string;
  period: string;
  difficulty: '입문' | '중급' | '심화';
  desc: string;
  themeIcon: string;
  stepCount: number;
  imageUrl?: string;
}

const MBTI_LABELS: Record<string, string> = {
  E: '외향형',
  I: '내향형',
  S: '감각형',
  N: '직관형',
  T: '사고형',
  F: '감정형',
  J: '판단형',
  P: '인식형',
};

const MBTI_DETAIL_KEYS = ['E_I', 'S_N', 'T_F', 'J_P'] as const;
const DIFFICULTIES = ['입문', '중급', '심화'] as const;

function getApiName(charId: string) {
  return decodeURIComponent(charId);
}

function normalizeQuote(quote?: string) {
  return quote?.replace(/^["“]|["”]$/g, '') ?? '';
}

function toTag(keyword: string) {
  return keyword.startsWith('#') ? keyword : `#${keyword}`;
}

function toScore(value: number) {
  return Math.max(1, Math.min(5, Math.round(value / 20)));
}

function toCharacterData(data: ApiCharacterDetail, routeCharId: string): CharacterData {
  const mbti = data.mbti ?? '----';
  const keywords = data.keywords?.length ? data.keywords : [data.category ?? '역사 인물'];
  const stats = data.stats?.length
    ? data.stats
    : [{ name: '영향력', value: 80, desc: '역사 속에서 의미 있는 영향을 남겼습니다.' }];

  return {
    id: data.name || routeCharId,
    name: data.name || routeCharId,
    role: data.role ?? data.category ?? '역사 인물',
    tagline: data.one_line_summary ?? data.intro_desc ?? '역사 속 선택의 순간을 만나보세요.',
    era: data.era_tag ?? data.era ?? '시대 정보',
    years: data.years ?? '연대 미상',
    situation: data.situation ?? data.intro_desc ?? '상세 상황을 준비 중입니다.',
    summary: data.one_line_summary ?? data.intro_desc ?? '상세 요약을 준비 중입니다.',
    mbti,
    mbtiTitle: data.mbti_nickname ?? '역사 속 성향',
    mbtiSubtitle: data.category ?? 'K-Heroes',
    strengths: stats.map((stat) => ({
      name: stat.name,
      score: toScore(stat.value),
      max: 5,
      value: stat.value,
      desc: stat.desc,
    })),
    mbtiTypes: mbti
      .split('')
      .slice(0, 4)
      .map((letter, index) => {
        const labels = [
          '외향적/내향적(E/I)',
          '감각적/직관적(S/N)',
          '사고적/감정적(T/F)',
          '판단적/인식적(J/P)',
        ];
        return {
          letter,
          label: labels[index] ?? '성향',
          desc:
            data.mbti_details?.[MBTI_DETAIL_KEYS[index]] ??
            '역사적 기록과 행동을 바탕으로 해석한 성향입니다.',
        };
      }),
    quote: normalizeQuote(data.intro_quote) || data.one_line_summary || '역사 속 선택의 순간',
    storyIntro: data.intro_desc ?? data.situation ?? '',
    img: data.image_url || '/logo.svg',
    bgImg: data.image_url || '',
    tags: keywords.map(toTag),
    region: data.category ?? data.era_tag ?? data.era ?? '역사',
  };
}

function getScenarioIcon(category: string | undefined, index: number) {
  const categoryIcon =
    category?.includes('호국') || category?.includes('독립')
      ? '⚔️'
      : category?.includes('정치') || category?.includes('외교')
        ? '👑'
        : category?.includes('예술') || category?.includes('문학')
          ? '🎨'
          : category?.includes('학문') || category?.includes('실학')
            ? '📚'
            : '📜';
  const alternates = [categoryIcon, '🧭', '⚖️'];
  return alternates[index % alternates.length];
}

function extractPeriod(scenario: ApiScenario, fallback: string) {
  const source = [
    scenario.title,
    scenario.description,
    scenario.historical_facts,
    scenario.turns?.[0]?.title,
  ]
    .filter(Boolean)
    .join(' ');
  return source.match(/\d{3,4}년(?:\s*\d{1,2}월)?/)?.[0] ?? fallback;
}

function makeSubtitle(scenario: ApiScenario) {
  const fact = scenario.historical_facts?.split(/[.!?。]/)[0]?.trim();
  if (fact && fact.length <= 42) return fact;
  return '역사적 선택의 순간';
}

function toScenarioMetas(data: ApiCharacterDetail, charId: string): ScenarioMeta[] {
  return (data.scenarios ?? []).map((scenario, index) => ({
    id: `${charId}-${scenario.id ?? scenario.scenario_id ?? index}`,
    charId,
    index,
    title: scenario.title,
    subtitle: makeSubtitle(scenario),
    period: extractPeriod(scenario, data.era_tag ?? data.era ?? '역사'),
    difficulty: DIFFICULTIES[Math.min(index, DIFFICULTIES.length - 1)],
    desc: scenario.description,
    themeIcon: getScenarioIcon(data.category, index),
    stepCount: scenario.turns?.length ?? 0,
    imageUrl: scenario.image_url,
  }));
}

async function fetchCharacterDetail(charId: string): Promise<CharacterDetailPayload> {
  const apiName = getApiName(charId);
  const cacheKey = apiName;

  const cached = detailCache.get(cacheKey);
  if (cached) return cached;

  const pending = detailRequestCache.get(cacheKey);
  if (pending) return pending;

  const request = fetch(`${API_BASE_URL}/api/v2/characters`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`인물 목록 조회 실패: ${response.status}`);
      }
      return (await response.json()) as Array<{ id: number; name: string }>;
    })
    .then(async (list) => {
      const matched = list.find(
        (c) =>
          c.name.trim() === apiName.trim() ||
          c.name.trim() === charId.trim() ||
          apiName.trim().includes(c.name.trim()) ||
          c.name.trim().includes(apiName.trim())
      );
      if (!matched) {
        throw new Error(`매칭되는 인물을 데이터베이스에서 찾을 수 없습니다: ${apiName}`);
      }
      const response = await fetch(`${API_BASE_URL}/api/v2/characters/${matched.id}`);
      if (!response.ok) {
        throw new Error(`인물 상세 조회 실패 (${matched.id}): ${response.status}`);
      }
      return (await response.json()) as ApiCharacterDetail;
    })
    .then((data) => {
      const payload = {
        char: toCharacterData(data, charId),
        scenarios: toScenarioMetas(data, data.name || charId),
      };
      detailCache.set(cacheKey, payload);
      return payload;
    })
    .finally(() => {
      detailRequestCache.delete(cacheKey);
    });

  detailRequestCache.set(cacheKey, request);
  return request;
}

/* ─── 공통 헤더 ─── */
function PageHeader({
  onBack,
  backLabel,
  centerContent,
}: {
  onBack: () => void;
  backLabel?: string;
  centerContent?: React.ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-10 h-14 border-b"
      style={{
        background: 'rgba(248,242,230,0.32)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderColor: 'rgba(42,66,50,0.08)',
      }}
    >
      <div className="mx-auto flex h-full max-w-[820px] items-center justify-between px-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 hover:opacity-60 transition-opacity"
          style={{ color: '#5A5248', fontSize: '13px', fontFamily: "'Noto Sans KR', sans-serif" }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{backLabel ?? '돌아가기'}</span>
        </button>

        <div className="flex items-center">{centerContent}</div>

        <BrandLogo compact />
      </div>
    </header>
  );
}

/* ─── 별점 ─── */
function Stars({ score, max }: { score: number; max: number }) {
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          style={{ fontSize: '14px', color: i < score ? '#D4921E' : '#DDD5C5', lineHeight: 1 }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

/* ─── 히어로 + 인물정보 통합 배경 영역 ─── */
function CharacterBackdropSection({
  char,
  children,
}: {
  char: CharacterData;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" style={{ overflow: 'hidden' }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-8px',
          right: '2%',
          width: '58%',
          height: 'calc(100% + 16px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <img
          src={char.img}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'top center',
            display: 'block',
            mixBlendMode: 'multiply',
            opacity: 0.9,
            transform: 'scale(0.9)',
            transformOrigin: 'top right',
          }}
        />
      </div>

      <div className="relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

/* ─── 히어로 텍스트 영역 ─── */
function HeroSection({ char }: { char: CharacterData }) {
  return (
    <div style={{ padding: '36px 0 24px', maxWidth: '58%' }}>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {char.tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontFamily: "'Noto Sans KR', sans-serif",
              fontSize: '0.6rem',
              background: 'rgba(42,66,50,0.12)',
              color: '#2A4232',
              borderRadius: '99px',
              padding: '2px 8px',
              fontWeight: 600,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
      <h1
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontWeight: 700,
          fontSize: 'clamp(1.6rem, 3.2vw, 2.4rem)',
          color: '#1A1714',
          lineHeight: 1.2,
          marginBottom: '6px',
        }}
      >
        {char.name}
      </h1>
      <p
        style={{
          fontFamily: "'Noto Sans KR', sans-serif",
          fontSize: '0.78rem',
          color: '#7A7060',
          marginBottom: '12px',
        }}
      >
        {char.role}
      </p>
      <p
        style={{
          fontFamily: "'Noto Sans KR', sans-serif",
          fontSize: '0.84rem',
          color: '#5A5048',
          lineHeight: 1.75,
          maxWidth: '300px',
        }}
      >
        {char.tagline}
      </p>
    </div>
  );
}

/* ─── 인물 정보 카드 (반투명 유리 느낌) ─── */
function CharInfoCard({ char }: { char: CharacterData }) {
  const infoRows = [
    { label: '시대', value: `${char.era} (${char.years})` },
    { label: '상황', value: char.situation },
    { label: '한줄 요약', value: char.summary },
  ];
  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{
        background:
          'linear-gradient(to right, rgba(253,250,244,0.88) 0%, rgba(253,250,244,0.7) 58%, rgba(253,250,244,0.2) 100%)',
        border: '1px solid rgba(42,66,50,0.1)',
        boxShadow: '0 4px 24px rgba(42,66,50,0.08)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to right, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 52%, rgba(253,250,244,0) 100%)',
          pointerEvents: 'none',
          zIndex: 2,
          borderRadius: 'inherit',
        }}
      />
      <div className="relative px-6 pt-5 pb-1" style={{ zIndex: 3 }}>
        {infoRows.map((row, i) => (
          <div
            key={row.label}
            className="flex gap-4 py-3"
            style={{
              borderBottom: i < infoRows.length - 1 ? '1px solid rgba(42,66,50,0.07)' : 'none',
            }}
          >
            <span
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: '0.72rem',
                color: '#A89E8E',
                flexShrink: 0,
                width: '64px',
                paddingTop: '1px',
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: '0.8rem',
                color: row.label === '한줄 요약' ? '#2A4232' : '#2A2420',
                lineHeight: 1.7,
              }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
      <div
        className="relative px-6 py-4 mt-1"
        style={{
          borderTop: '1px solid rgba(42,66,50,0.08)',
          background: 'rgba(42,66,50,0.025)',
          zIndex: 3,
        }}
      >
        <p
          className="mb-3"
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontWeight: 700,
            fontSize: '0.84rem',
            color: '#1A1714',
          }}
        >
          강점
        </p>
        <div className="flex flex-col">
          {char.strengths.map((s, i) => (
            <div
              key={s.name}
              className="flex items-center gap-3 py-2.5 flex-wrap"
              style={{
                borderBottom:
                  i < char.strengths.length - 1 ? '1px solid rgba(42,66,50,0.07)' : 'none',
              }}
            >
              <span
                style={{
                  fontFamily: "'Noto Sans KR', sans-serif",
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  color: '#2A2420',
                  width: '82px',
                  flexShrink: 0,
                }}
              >
                {s.name}
              </span>
              <Stars score={s.score} max={s.max} />
              <span
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  color: '#C9933A',
                  flexShrink: 0,
                }}
              >
                {s.score}/{s.max}
              </span>
              <span
                style={{
                  fontFamily: "'Noto Sans KR', sans-serif",
                  fontSize: '0.72rem',
                  color: '#7A7060',
                  flex: 1,
                  minWidth: '100px',
                }}
              >
                {s.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getMbtiPalette(mbti: string) {
  const type = mbti.toUpperCase();
  if (['INTJ', 'INTP', 'ENTJ', 'ENTP'].includes(type)) {
    return {
      main: '#4A3A6A',
      deep: '#31264A',
      soft: 'rgba(74,58,106,0.12)',
      glow: 'rgba(74,58,106,0.22)',
      seal: '#4A3A6A',
    };
  }
  if (['INFJ', 'INFP', 'ENFJ', 'ENFP'].includes(type)) {
    return {
      main: '#2A5A4A',
      deep: '#1F4036',
      soft: 'rgba(42,90,74,0.12)',
      glow: 'rgba(42,90,74,0.22)',
      seal: '#2A5A4A',
    };
  }
  if (['ISTJ', 'ISFJ', 'ESTJ', 'ESFJ'].includes(type)) {
    return {
      main: '#3A4A6A',
      deep: '#26344F',
      soft: 'rgba(58,74,106,0.12)',
      glow: 'rgba(58,74,106,0.22)',
      seal: '#3A4A6A',
    };
  }
  return {
    main: '#6A3A2A',
    deep: '#4A2A20',
    soft: 'rgba(106,58,42,0.12)',
    glow: 'rgba(106,58,42,0.22)',
    seal: '#6A3A2A',
  };
}

/* ─── MBTI 카드 ─── */
function MbtiCard({ char }: { char: CharacterData }) {
  const palette = getMbtiPalette(char.mbti);

  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{
        background:
          'linear-gradient(to right, rgba(253,250,244,0.88) 0%, rgba(253,250,244,0.7) 58%, rgba(253,250,244,0.2) 100%)',
        border: `1px solid ${palette.glow}`,
        boxShadow: `0 18px 42px rgba(42,66,50,0.08), inset 0 1px 0 rgba(255,255,255,0.42)`,
        backdropFilter: 'blur(7px)',
        WebkitBackdropFilter: 'blur(7px)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to right, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 52%, rgba(253,250,244,0) 100%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          height: '4px',
          background: palette.main,
        }}
      />
      <div
        className="relative flex items-center justify-between gap-4 px-6 py-5"
        style={{ borderBottom: '1px solid rgba(42,66,50,0.08)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-full"
            style={{
              width: '42px',
              height: '42px',
              background: `linear-gradient(135deg, ${palette.deep}, ${palette.main})`,
              boxShadow: `0 8px 18px ${palette.glow}`,
            }}
          >
            <span
              style={{
                color: '#FFF8EA',
                fontFamily: "'Noto Serif KR', serif",
                fontSize: '0.72rem',
                fontWeight: 800,
                lineHeight: 1.1,
              }}
            >
              氣
            </span>
          </div>
          <div>
            <span
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontWeight: 700,
                fontSize: '0.64rem',
                color: palette.main,
                letterSpacing: '0.08em',
              }}
            >
              이 인물의 기질
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '10px',
                flexWrap: 'wrap',
                marginTop: '2px',
              }}
            >
              <span
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontWeight: 800,
                  fontSize: '1.22rem',
                  color: '#1A1714',
                }}
              >
                {char.mbti}
              </span>
              <span
                style={{
                  fontFamily: "'Noto Sans KR', sans-serif",
                  fontSize: '0.76rem',
                  color: '#7A7060',
                }}
              >
                {char.mbtiTitle} · {char.mbtiSubtitle}
              </span>
            </div>
          </div>
        </div>
        <div
          aria-hidden
          className="hidden sm:flex items-center justify-center"
          style={{
            width: '58px',
            height: '58px',
            border: `2px solid ${palette.seal}`,
            color: palette.seal,
            borderRadius: '14px',
            transform: 'rotate(-5deg)',
            opacity: 0.72,
          }}
        >
          <span
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontWeight: 800,
              fontSize: '0.72rem',
              lineHeight: 1.25,
              textAlign: 'center',
            }}
          >
            {char.mbti}
            <br />
            성향
          </span>
        </div>
      </div>
      <div className="relative grid grid-cols-2 sm:grid-cols-4">
        {char.mbtiTypes.map((t, i) => (
          <div
            key={t.letter}
            className="relative px-5 py-5 flex flex-col gap-2 overflow-hidden"
            style={{
              borderRight: i < char.mbtiTypes.length - 1 ? '1px solid rgba(42,66,50,0.08)' : 'none',
              borderBottom: i < 2 ? '1px solid rgba(42,66,50,0.08)' : 'none',
              background: 'transparent',
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                right: '12px',
                top: '8px',
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 900,
                fontSize: '4.2rem',
                color: palette.soft,
                lineHeight: 1,
              }}
            >
              {t.letter}
            </span>
            <span
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 800,
                fontSize: '2rem',
                color: palette.deep,
                lineHeight: 1,
                position: 'relative',
              }}
            >
              {t.letter}
            </span>
            <span
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: '0.6rem',
                color: palette.deep,
                background: palette.soft,
                border: `1px solid ${palette.glow}`,
                borderRadius: '999px',
                padding: '2px 8px',
                display: 'inline-block',
                width: 'fit-content',
                fontWeight: 700,
                position: 'relative',
              }}
            >
              {t.label}
            </span>
            <p
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: '0.68rem',
                color: '#6A6055',
                lineHeight: 1.65,
                position: 'relative',
              }}
            >
              {t.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 시나리오 카드 ─── */
function ScenarioCard({
  scenario,
  index,
  onStart,
}: {
  scenario: ScenarioMeta;
  index: number;
  onStart: () => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      style={{
        background: 'rgba(253,250,244,0.62)',
        border: '1px solid rgba(42,66,50,0.1)',
        boxShadow: '0 2px 12px rgba(42,66,50,0.07)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
      }}
    >
      <style>{`
        .kh-detail-image-skeleton {
          position: relative;
          overflow: hidden;
        }
        .kh-detail-image-skeleton::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(100deg, rgba(253,250,244,0) 0%, rgba(253,250,244,0.68) 44%, rgba(224,211,184,0.38) 58%, rgba(253,250,244,0) 100%);
          animation: khDetailImageSkeleton 1.2s ease-in-out infinite;
        }
        @keyframes khDetailImageSkeleton {
          to { transform: translateX(100%); }
        }
      `}</style>
      <div className="flex items-stretch gap-4 sm:gap-6">
        {/* 시나리오 대표 이미지 썸네일 */}
        <div
          className="relative w-40 sm:w-52 md:w-60 flex-shrink-0 overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, rgba(42,66,50,0.08), rgba(154,142,126,0.13), rgba(42,66,50,0.06))',
          }}
        >
          {scenario.imageUrl && !imageLoaded && (
            <div
              className="kh-detail-image-skeleton absolute inset-0"
              style={{
                background:
                  'linear-gradient(135deg, rgba(42,66,50,0.09), rgba(154,142,126,0.15), rgba(42,66,50,0.07))',
              }}
            />
          )}
          {scenario.imageUrl ? (
            <img
              src={scenario.imageUrl}
              alt={scenario.title}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
              className="w-full h-full object-cover transition-all duration-500 hover:scale-105"
              style={{ opacity: imageLoaded ? 1 : 0 }}
            />
          ) : null}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, rgba(26,23,20,0.2) 0%, rgba(26,23,20,0.03) 42%, rgba(253,250,244,0.2) 76%, rgba(253,250,244,0.92) 100%)',
            }}
          />
          <span
            className="absolute left-4 top-4"
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontWeight: 800,
              fontSize: '1.8rem',
              color: 'rgba(253,250,244,0.72)',
              lineHeight: 1,
              textShadow: '0 2px 10px rgba(26,23,20,0.28)',
            }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>

        {/* 본문 */}
        <div className="flex-1 px-2 py-5 pr-5 sm:py-6 sm:pr-7">
          {/* 상단 배지 */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: '0.6rem',
                color: '#8A7E6E',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Clock style={{ width: '10px', height: '10px' }} />
              {scenario.period}
            </span>
            <span
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: '0.6rem',
                color: '#8A7E6E',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <BarChart2 style={{ width: '10px', height: '10px' }} />
              {scenario.stepCount}단계
            </span>
          </div>

          {/* 제목 */}
          <h3
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontWeight: 700,
              fontSize: '1rem',
              color: '#1A1714',
              lineHeight: 1.3,
              marginBottom: '2px',
            }}
          >
            {scenario.title}
          </h3>
          <p
            style={{
              fontFamily: "'Noto Sans KR', sans-serif",
              fontSize: '0.72rem',
              color: '#7A7060',
              marginBottom: '8px',
            }}
          >
            {scenario.subtitle}
          </p>
          <p
            style={{
              fontFamily: "'Noto Sans KR', sans-serif",
              fontSize: '0.78rem',
              color: '#5A5248',
              lineHeight: 1.7,
              marginBottom: '14px',
            }}
          >
            {scenario.desc}
          </p>

          {/* CTA */}
          <button
            onClick={onStart}
            className="flex items-center px-4 py-2 rounded-xl transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #1E3328 0%, #3D6B52 100%)',
              color: 'white',
              fontFamily: "'Noto Sans KR', sans-serif",
              fontWeight: 700,
              fontSize: '0.82rem',
              boxShadow: '0 2px 10px rgba(30,51,40,0.24)',
            }}
          >
            시뮬레이션 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── 섹션 레이블 ─── */
function SectionLabel({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div
        className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{
          width: '22px',
          height: '22px',
          background: '#2A4232',
        }}
      >
        <span
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontWeight: 700,
            fontSize: '0.7rem',
            color: 'white',
            lineHeight: 1,
          }}
        >
          {num}
        </span>
      </div>
      <span
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontWeight: 700,
          fontSize: '0.95rem',
          color: '#1A1714',
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ─── 구분선 ─── */
function Divider() {
  return (
    <div
      style={{
        height: '1px',
        background: 'rgba(42,66,50,0.1)',
        margin: '0 0 28px',
      }}
    />
  );
}

/* ─── 메인 페이지 ─── */
export function CharacterDetailPage({
  charId,
  onBack,
  onStartScenario,
}: {
  charId: string;
  onBack: () => void;
  onStartScenario?: (scenarioIdx: number) => void;
}) {
  const [apiPayload, setApiPayload] = useState<CharacterDetailPayload | null>(
    () => detailCache.get(getApiName(charId)) ?? null,
  );
  const [isLoading, setIsLoading] = useState(!apiPayload);
  const [canShowEmptyState, setCanShowEmptyState] = useState(Boolean(apiPayload));
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const cachedPayload = detailCache.get(getApiName(charId)) ?? null;

    setApiPayload(cachedPayload);
    setIsLoading(!cachedPayload);
    setCanShowEmptyState(Boolean(cachedPayload));
    setLoadError(null);

    const emptyTimer = window.setTimeout(() => {
      if (isActive) setCanShowEmptyState(true);
    }, 1000);

    fetchCharacterDetail(charId)
      .then((payload) => {
        if (!isActive) return;
        setApiPayload(payload);
        setCanShowEmptyState(true);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setLoadError(error instanceof Error ? error.message : '인물 정보를 불러오지 못했습니다.');
        setApiPayload(null);
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
      window.clearTimeout(emptyTimer);
    };
  }, [charId]);

  const char = apiPayload?.char ?? null;
  const scenarios = apiPayload?.scenarios ?? [];

  if (!char && (isLoading || !canShowEmptyState)) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto" style={storyPageBackground}>
        <PageHeader
          onBack={onBack}
          backLabel="인물 목록으로"
          centerContent={
            <span
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 600,
                fontSize: '0.88rem',
                color: '#2A4232',
              }}
            >
              인물 정보
            </span>
          }
        />
        <div className="max-w-[820px] mx-auto px-6 py-16">
          <div
            className="rounded-2xl px-6 py-8"
            style={{
              background: 'rgba(253,250,244,0.72)',
              border: '1px solid rgba(42,66,50,0.09)',
              boxShadow: '0 2px 16px rgba(42,66,50,0.06)',
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(5px)',
            }}
          >
            <style>{`
              .kh-detail-loading-line {
                position: relative;
                overflow: hidden;
                border-radius: 999px;
                background: linear-gradient(90deg, rgba(42,66,50,0.08), rgba(42,66,50,0.15), rgba(154,142,126,0.1));
              }
              .kh-detail-loading-line::after {
                content: "";
                position: absolute;
                inset: 0;
                transform: translateX(-100%);
                background: linear-gradient(90deg, transparent, rgba(253,250,244,0.58), transparent);
                animation: khDetailLoadingFlow 1.2s ease-in-out infinite;
              }
              @keyframes khDetailLoadingFlow {
                to { transform: translateX(100%); }
              }
            `}</style>
            <div className="kh-detail-loading-line mb-4 h-5 w-32" />
            <div className="kh-detail-loading-line mb-3 h-8 w-[52%]" />
            <div className="kh-detail-loading-line mb-2 h-4 w-[88%]" />
            <div className="kh-detail-loading-line h-4 w-[64%]" />
          </div>
        </div>
      </div>
    );
  }

  if (!char) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto" style={storyPageBackground}>
        <PageHeader
          onBack={onBack}
          backLabel="인물 목록으로"
          centerContent={
            <span
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 600,
                fontSize: '0.88rem',
                color: '#2A4232',
              }}
            >
              인물 정보
            </span>
          }
        />
        <div className="max-w-[820px] mx-auto px-6 py-16">
          <div
            className="rounded-2xl px-6 py-8 text-center"
            style={{
              background: '#FDFAF4',
              border: '1px solid rgba(42,66,50,0.09)',
              boxShadow: '0 2px 16px rgba(42,66,50,0.06)',
            }}
          >
            <p
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 700,
                color: '#1A1714',
                marginBottom: '8px',
              }}
            >
              인물 정보를 찾을 수 없어요.
            </p>
            <p
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: '0.82rem',
                color: '#7A7060',
              }}
            >
              {loadError ?? '잠시 후 다시 시도해주세요.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={storyPageBackground}>
      <style>{`
        @keyframes khDetailPageEnter {
          0% {
            opacity: 0;
            transform: translate3d(-18px, 0, 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .kh-detail-enter {
            animation: none !important;
          }
        }
      `}</style>
      <PageHeader
        onBack={onBack}
        backLabel="인물 목록으로"
        centerContent={
          <span
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontWeight: 600,
              fontSize: '0.88rem',
              color: '#2A4232',
            }}
          >
            {char.name}
          </span>
        }
      />

      <div
        className="kh-detail-enter max-w-[820px] mx-auto px-6 pb-16"
        style={{
          animation: 'khDetailPageEnter 1.5s cubic-bezier(0.22, 0.8, 0.28, 1) both',
          willChange: 'opacity, transform',
        }}
      >
        <CharacterBackdropSection char={char}>
          <HeroSection char={char} />
          <div style={{ paddingBottom: '32px' }}>
            <SectionLabel num="1" label="인물 설명" />
            <CharInfoCard char={char} />
          </div>
        </CharacterBackdropSection>

        <div className="flex flex-col gap-8 mt-2">
          <div style={{ height: '1px', background: 'rgba(42,66,50,0.1)' }} />

          {/* 2. MBTI */}
          <div>
            <SectionLabel num="2" label="MBTI" />
            <MbtiCard char={char} />
          </div>

          {/* 3. 시나리오 목록 */}
          <div>
            <SectionLabel num="3" label="체험 시나리오" />
            {/* 안내 */}
            <p
              className="mb-4"
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: '0.8rem',
                color: '#8A7E6E',
                lineHeight: 1.7,
              }}
            >
              {char.name}의 생애 중 결정적인 순간 {scenarios.length}가지를 선택해 직접 체험해보세요.
              당신의 선택이 역사를 바꿀 수 있습니다.
              {isLoading && ' 인물 정보를 불러오는 중입니다.'}
            </p>

            {/* 인용구 */}
            <div
              className="mb-5 px-5 py-4 rounded-2xl"
              style={{
                background: 'rgba(42,66,50,0.04)',
                border: '1px solid rgba(42,66,50,0.1)',
              }}
            >
              <span
                style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '2.8rem',
                  color: 'rgba(42,66,50,0.15)',
                  lineHeight: 0.7,
                  display: 'block',
                  marginBottom: '-2px',
                }}
              >
                "
              </span>
              <p
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: '#1A1714',
                  lineHeight: 1.6,
                }}
              >
                {char.quote}
              </p>
            </div>

            {/* 시나리오 카드 목록 */}
            <div className="flex flex-col gap-3">
              {scenarios.map((scenario, idx) => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  index={idx}
                  onStart={() => onStartScenario?.(idx)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
