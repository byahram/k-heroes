"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Send, Image as ImageIcon, Sparkles, RefreshCw, CheckCircle, HelpCircle, ShieldAlert } from "lucide-react";
import { AdminPageHeader } from "@/app/(admin)/_components/admin-page-header";
import { AdminButton } from "@/app/(admin)/_components/admin-button";

type Choice = {
  title: string;
  description: string;
  stats: {
    "국력": number;
    "백성의 지지": number;
    "성공 확률": number;
  };
  result_text: string;
  choice_image: string;
};

type Turn = {
  turn_no: number;
  title: string;
  situation: string;
  tip_title: string;
  tip_desc: string;
  turn_image: string;
  choices: {
    A: Choice;
    B: Choice;
  };
};

type DraftData = {
  character_name: string;
  years: string;
  era: string;
  intro_quote: string;
  intro_desc: string;
  image_url: string;
  turns: Turn[];
};

// 송만갑 mock 데이터 바인딩
const MOCK_SONG_MAN_GAP: DraftData = {
  character_name: "송만갑",
  years: "1865-1939",
  era: "근현대",
  intro_quote: "서슬 퍼런 시대, 판소리로 백성의 억눌린 피를 끓게 하리라.",
  intro_desc: "구한말과 일제강점기에 활동한 판소리 명창. 동편제의 가풍을 계승하면서도 서편제와 계면조의 요소를 수용해 판소리의 변혁을 이끈 개척자입니다.",
  image_url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=60",
  turns: [
    {
      turn_no: 1,
      title: "동편제의 계승자 (1890년대)",
      situation: "어린 시절부터 가풍에 따라 혹독한 소리 수련을 받으며 동편제의 전통을 익혔습니다. 장년이 되어 명창으로서 이름을 떨치기 시작했으나, 시대는 급격한 근대화의 물결과 일본의 국권 침탈 위협 속에 놓이게 됩니다. 이때 대궐에서 명창들을 부르는 어전 광대 소집령이 내립니다.",
      tip_title: "송만갑의 동편제는 어떤 특징이 있을까?",
      tip_desc: "송만갑은 남원 송씨 소리 광대 가문에서 태어나 가풍인 동편제를 이어받았습니다. 동편제는 기교보다는 기백과 우람한 성음을 중시하는 기법이지만, 그는 시대에 맞춰 서편제적인 기교도 융합했습니다.",
      turn_image: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800&auto=format&fit=crop&q=60",
      choices: {
        A: {
          title: "어전 소집에 응해 고종과 명성황후 앞에서 소리를 한다",
          description: "왕실의 어전 광대로 들어가 궁중에서 대접을 받으며 정통 동편제의 진수를 궁궐에 널리 알립니다.",
          stats: { "국력": 10, "백성의 지지": -5, "성공 확률": 80 },
          result_text: "왕실의 극진한 총애를 얻어 '오수(국가 광대)' 벼슬을 얻고 동편제의 격조를 크게 높였습니다. 그러나 밖에서는 굶주리고 핍박받는 백성들의 원망 섞인 소리가 들려옵니다.",
          choice_image: "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=400&auto=format&fit=crop&q=60",
        },
        B: {
          title: "어전 소집을 거부하고 전국의 장터를 돌며 소리를 전한다",
          description: "권력의 품을 거부하고 서민들의 애환이 담긴 시장통과 저자거리를 돌며 일반 백성들과 아픔을 함께합니다.",
          stats: { "국력": -5, "백성의 지지": 25, "성공 확률": 50 },
          result_text: "왕실의 노여움을 사 피신을 다녀야 했지만, 억눌린 조선 백성들 사이에서 최고의 소리꾼으로 떠오르며 들불처럼 민중의 정신적 지지를 얻게 됩니다.",
          choice_image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&auto=format&fit=crop&q=60",
        }
      }
    },
    {
      turn_no: 2,
      title: "협률사와 원각사, 판소리의 근대화 (1900년대)",
      situation: "조선의 국권이 허물어지고 대한제국이 선포된 혼란기 속에서, 소리꾼들을 모아 최초의 근대식 국립 극장인 '협률사'가 설립되었습니다. 판소리를 1인 입창이 아닌 여러 배역이 나누어 노래하는 '창극' 형태로 바꾸자는 제안이 들어옵니다.",
      tip_title: "협률사와 창극의 출현 배경",
      tip_desc: "1902년 최초의 극장인 협률사가 설립되면서 판소리는 극장 무대에 오르게 되었습니다. 송만갑은 연극적 요소를 가미한 창극의 태동을 함께 이끌며 판소리의 근대 무대 대중화에 기여했습니다.",
      turn_image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=60",
      choices: {
        A: {
          title: "전통적인 1인 입창 판소리 양식을 끝까지 고수한다",
          description: "서양식 극장에 올리는 변칙 연출을 거부하고 고수 한 명의 북장단에 맞추어 홀로 완창하는 전통의 순수성을 지킵니다.",
          stats: { "국력": 5, "백성의 지지": 10, "성공 확률": 70 },
          result_text: "정통 동편제의 고결함을 지켜 소리의 원류를 보존하는 공을 세웠으나, 서양 문화가 밀려오는 시대적 흐름 속에서 대중들의 관심에서 서서히 밀려나는 아쉬움을 겪습니다.",
          choice_image: "https://images.unsplash.com/photo-1460881680858-30d872d5b530?w=400&auto=format&fit=crop&q=60",
        },
        B: {
          title: "창극 형태의 다역 분할 연창 방식을 전면 수용한다",
          description: "여러 소리꾼이 무대에서 직접 배역을 맡아 연기하며 입체적으로 소리를 나누는 근대적 창극의 연출을 주도합니다.",
          stats: { "국력": 15, "백성의 지지": 15, "성공 확률": 90 },
          result_text: "무대는 엄청난 인기를 얻어 대성황을 이뤘고, 판소리가 낡은 예술이 아닌 근대 종합 극예술로 탈바꿈하며 수많은 젊은 관객을 극장으로 끌어들였습니다.",
          choice_image: "https://images.unsplash.com/photo-1503095391757-11200249074b?w=400&auto=format&fit=crop&q=60",
        }
      }
    }
  ]
};

const RANDOM_HISTORICAL_IMAGES = [
  "https://images.unsplash.com/photo-1547989453-11e67ffb3885?w=800&auto=format&fit=crop&q=60", // Asian calligraphy
  "https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=800&auto=format&fit=crop&q=60", // Nature/forest
  "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=60", // Korean pavilion/night
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60", // Traditional ink art vibe
  "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&auto=format&fit=crop&q=60", // Bamboo forest
];

export default function ReviewDetailPage() {
  const router = useRouter();
  const { draftId } = useParams();
  const [data, setData] = useState<DraftData>(MOCK_SONG_MAN_GAP);
  const [activeTab, setActiveTab] = useState<"info" | "turn1" | "turn2">("info");
  const [generatingImages, setGeneratingImages] = useState<Record<string, boolean>>({});

  // 폼 입력 필드 업데이트 핸들러
  const handleInfoChange = (field: keyof DraftData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTurnChange = (turnIdx: number, field: keyof Turn, value: string) => {
    setData((prev) => {
      const newTurns = [...prev.turns];
      newTurns[turnIdx] = { ...newTurns[turnIdx], [field]: value } as Turn;
      return { ...prev, turns: newTurns };
    });
  };

  const handleChoiceChange = (turnIdx: number, choiceKey: "A" | "B", field: keyof Choice, value: any) => {
    setData((prev) => {
      const newTurns = [...prev.turns];
      const turn = newTurns[turnIdx];
      const choice = turn.choices[choiceKey];
      
      turn.choices[choiceKey] = { ...choice, [field]: value } as Choice;
      newTurns[turnIdx] = turn;
      return { ...prev, turns: newTurns };
    });
  };

  const handleChoiceStatChange = (turnIdx: number, choiceKey: "A" | "B", statKey: "국력" | "백성의 지지" | "성공 확률", value: number) => {
    setData((prev) => {
      const newTurns = [...prev.turns];
      const turn = newTurns[turnIdx];
      const choice = turn.choices[choiceKey];
      
      choice.stats[statKey] = value;
      turn.choices[choiceKey] = choice;
      newTurns[turnIdx] = turn;
      return { ...prev, turns: newTurns };
    });
  };

  // 모의 DALL-E 이미지 재생성 트리거
  const triggerImageRebuild = (key: string, callback: (newUrl: string) => void) => {
    setGeneratingImages((prev) => ({ ...prev, [key]: true }));

    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * RANDOM_HISTORICAL_IMAGES.length);
      const newUrl = RANDOM_HISTORICAL_IMAGES[randomIndex];
      callback(newUrl);
      setGeneratingImages((prev) => ({ ...prev, [key]: false }));
    }, 2500);
  };

  const handlePublish = () => {
    if (confirm("정말 이 시나리오를 배포하여 실서비스(Supabase DB)에 적재하시겠습니까?")) {
      alert("배포 완료! 시나리오와 캐릭터 카드가 성공적으로 적재되었습니다.");
      router.push("/admin/review");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/review" className="flex size-9 items-center justify-center rounded-lg border border-[#E8E4DC] bg-white text-[#3A3530] hover:bg-[#F4F1EA] transition-colors">
          <ArrowLeft className="size-4" />
        </Link>
        <AdminPageHeader
          title={`초안 검수: ${data.character_name}`}
          description="AI가 생성한 시나리오의 고증 오류 및 오타를 수정하고 일러스트를 최종 재생성한 뒤 배포합니다."
        />
      </div>

      {/* 탭 구조 네비게이션 */}
      <div className="flex gap-2 border-b border-[#E8E4DC] pb-px">
        <button
          onClick={() => setActiveTab("info")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "info"
              ? "border-[#2A4232] text-[#2A4232]"
              : "border-transparent text-[#8A847C] hover:text-[#3A3530]"
          }`}
        >
          기본 정보
        </button>
        {data.turns.map((turn, idx) => (
          <button
            key={turn.turn_no}
            onClick={() => setActiveTab(idx === 0 ? "turn1" : "turn2")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
              (idx === 0 ? activeTab === "turn1" : activeTab === "turn2")
                ? "border-[#2A4232] text-[#2A4232]"
                : "border-transparent text-[#8A847C] hover:text-[#3A3530]"
            }`}
          >
            플레이 턴 {turn.turn_no}
          </button>
        ))}
      </div>

      {/* 편집 콘텐츠 영역 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          
          {/* [탭 1] 기본 정보 편집 */}
          {activeTab === "info" && (
            <div className="rounded-xl border border-[#E8E4DC] bg-white p-6 space-y-4">
              <h3 className="text-base font-semibold text-[#1A1714]">인물 프로필 설정</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#8A847C] uppercase tracking-wider mb-1">인물명</label>
                  <input
                    type="text"
                    value={data.character_name}
                    onChange={(e) => handleInfoChange("character_name", e.target.value)}
                    className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#1A1714] focus:border-[#2A4232] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8A847C] uppercase tracking-wider mb-1">활동 생몰년도</label>
                  <input
                    type="text"
                    value={data.years}
                    onChange={(e) => handleInfoChange("years", e.target.value)}
                    className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#1A1714] focus:border-[#2A4232] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8A847C] uppercase tracking-wider mb-1">대표 한줄 대사</label>
                <input
                  type="text"
                  value={data.intro_quote}
                  onChange={(e) => handleInfoChange("intro_quote", e.target.value)}
                  className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#1A1714] focus:border-[#2A4232] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8A847C] uppercase tracking-wider mb-1">인물 소개글 (역사적 행적)</label>
                <textarea
                  rows={4}
                  value={data.intro_desc}
                  onChange={(e) => handleInfoChange("intro_desc", e.target.value)}
                  className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#1A1714] focus:border-[#2A4232] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* [탭 2 & 3] 플레이 턴 편집 */}
          {(activeTab === "turn1" || activeTab === "turn2") && (
            (() => {
              const turnIdx = activeTab === "turn1" ? 0 : 1;
              const turn = data.turns[turnIdx];
              return (
                <div className="space-y-6">
                  {/* 상황 및 역사적 고증 팁 */}
                  <div className="rounded-xl border border-[#E8E4DC] bg-white p-6 space-y-4">
                    <h3 className="text-base font-semibold text-[#1A1714] flex items-center gap-1.5">
                      <span>턴 {turn.turn_no} 상황 & 역사 가이드라인</span>
                    </h3>
                    
                    <div>
                      <label className="block text-xs font-semibold text-[#8A847C] uppercase tracking-wider mb-1">턴 제목</label>
                      <input
                        type="text"
                        value={turn.title}
                        onChange={(e) => handleTurnChange(turnIdx, "title", e.target.value)}
                        className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#1A1714] focus:border-[#2A4232] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#8A847C] uppercase tracking-wider mb-1">상황 설명 (Situation)</label>
                      <textarea
                        rows={4}
                        value={turn.situation}
                        onChange={(e) => handleTurnChange(turnIdx, "situation", e.target.value)}
                        className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#1A1714] focus:border-[#2A4232] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-[#8A847C] uppercase tracking-wider mb-1">역사 팁 제목</label>
                        <input
                          type="text"
                          value={turn.tip_title}
                          onChange={(e) => handleTurnChange(turnIdx, "tip_title", e.target.value)}
                          className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#1A1714] focus:border-[#2A4232] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#8A847C] uppercase tracking-wider mb-1">역사 고증 설명 (RAG)</label>
                        <textarea
                          rows={2}
                          value={turn.tip_desc}
                          onChange={(e) => handleTurnChange(turnIdx, "tip_desc", e.target.value)}
                          className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#1A1714] focus:border-[#2A4232] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 선택지 A & B 설정 */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {(["A", "B"] as const).map((choiceKey) => {
                      const choice = turn.choices[choiceKey];
                      return (
                        <div key={choiceKey} className="rounded-xl border border-[#E8E4DC] bg-white p-5 space-y-4">
                          <h4 className="text-sm font-bold text-[#1A1714] border-b border-[#F0ECE4] pb-2 flex items-center justify-between">
                            <span>선택지 {choiceKey}</span>
                            <span className={`text-xs px-2 py-0.5 rounded font-mono ${choiceKey === "A" ? "bg-indigo-50 text-indigo-700" : "bg-teal-50 text-teal-700"}`}>
                              Option {choiceKey}
                            </span>
                          </h4>

                          <div>
                            <label className="block text-xs font-semibold text-[#8A847C] uppercase tracking-wider mb-1">선택지명</label>
                            <input
                              type="text"
                              value={choice.title}
                              onChange={(e) => handleChoiceChange(turnIdx, choiceKey, "title", e.target.value)}
                              className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#1A1714] focus:border-[#2A4232] focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-[#8A847C] uppercase tracking-wider mb-1">행동 묘사</label>
                            <textarea
                              rows={2}
                              value={choice.description}
                              onChange={(e) => handleChoiceChange(turnIdx, choiceKey, "description", e.target.value)}
                              className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#1A1714] focus:border-[#2A4232] focus:outline-none"
                            />
                          </div>

                          {/* 스탯 변경치 수치 조정 */}
                          <div>
                            <label className="block text-xs font-semibold text-[#8A847C] uppercase tracking-wider mb-2">선택에 따른 스탯 변동치</label>
                            <div className="grid grid-cols-3 gap-2">
                              {(["국력", "백성의 지지", "성공 확률"] as const).map((statKey) => (
                                <div key={statKey} className="bg-[#FDFCFA] rounded border border-[#E8E4DC] p-2 text-center">
                                  <span className="block text-[10px] font-bold text-[#8A847C]">{statKey}</span>
                                  <input
                                    type="number"
                                    value={choice.stats[statKey]}
                                    onChange={(e) => handleChoiceStatChange(turnIdx, choiceKey, statKey, parseInt(e.target.value) || 0)}
                                    className="w-full bg-transparent text-center font-bold text-sm text-[#2A4232] focus:outline-none mt-1"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-[#8A847C] uppercase tracking-wider mb-1">행동의 역사적 결과문구 (Result)</label>
                            <textarea
                              rows={3}
                              value={choice.result_text}
                              onChange={(e) => handleChoiceChange(turnIdx, choiceKey, "result_text", e.target.value)}
                              className="w-full rounded-lg border border-[#E8E4DC] px-3 py-2 text-sm text-[#1A1714] focus:border-[#2A4232] focus:outline-none"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* 우측 이미지 프리뷰 및 제어 패널 */}
        <div className="space-y-6">
          <div className="rounded-xl border border-[#E8E4DC] bg-white p-5 space-y-4">
            <h3 className="text-base font-semibold text-[#1A1714] flex items-center gap-1.5">
              <ImageIcon className="size-4 text-[#8A847C]" />
              일러스트 프리뷰 & 재생성
            </h3>

            {/* 인물 전신 카드 (Info 탭일 때) */}
            {activeTab === "info" && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#8A847C] uppercase tracking-wider">캐릭터 카드 일러스트</p>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden border border-[#E8E4DC] bg-[#F4F1EA]">
                  <img
                    src={data.image_url}
                    alt={data.character_name}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${generatingImages["portrait"] ? "opacity-30" : "opacity-100"}`}
                  />
                  {generatingImages["portrait"] && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white p-4">
                      <RefreshCw className="size-8 animate-spin mb-2" />
                      <p className="text-xs font-semibold">DALL-E 3 전신 카드 생성 중...</p>
                    </div>
                  )}
                </div>
                
                <AdminButton
                  variant="secondary"
                  className="w-full flex items-center justify-center gap-1"
                  disabled={generatingImages["portrait"]}
                  onClick={() => triggerImageRebuild("portrait", (url) => handleInfoChange("image_url", url))}
                >
                  <Sparkles className="size-3.5" />
                  전신 카드 DALL-E 재생성
                </AdminButton>
              </div>
            )}

            {/* 턴별 상황 이미지 (Turn 탭일 때) */}
            {(activeTab === "turn1" || activeTab === "turn2") && (
              (() => {
                const turnIdx = activeTab === "turn1" ? 0 : 1;
                const turn = data.turns[turnIdx];
                return (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[#8A847C] uppercase tracking-wider">턴 {turn.turn_no} 상황 메인 이미지 (16:9)</p>
                      <div className="relative aspect-[16/9] rounded-lg overflow-hidden border border-[#E8E4DC] bg-[#F4F1EA]">
                        <img
                          src={turn.turn_image}
                          alt="Turn situation"
                          className={`w-full h-full object-cover transition-opacity duration-300 ${generatingImages[`turn_${turn.turn_no}`] ? "opacity-30" : "opacity-100"}`}
                        />
                        {generatingImages[`turn_${turn.turn_no}`] && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white p-2">
                            <RefreshCw className="size-6 animate-spin mb-1" />
                            <p className="text-[10px] font-semibold">상황 이미지 생성 중...</p>
                          </div>
                        )}
                      </div>
                      <AdminButton
                        variant="secondary"
                        size="sm"
                        className="w-full flex items-center justify-center gap-1"
                        disabled={generatingImages[`turn_${turn.turn_no}`]}
                        onClick={() => triggerImageRebuild(`turn_${turn.turn_no}`, (url) => handleTurnChange(turnIdx, "turn_image", url))}
                      >
                        <Sparkles className="size-3" />
                        상황 이미지 재생성
                      </AdminButton>
                    </div>

                    <div className="border-t border-[#F0ECE4] pt-4 space-y-3">
                      <p className="text-xs font-semibold text-[#8A847C] uppercase tracking-wider">선택지별 결과 일러스트 (1:1)</p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {/* 선택지 A */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-[#8A847C]">선택지 A 결과</span>
                          <div className="relative aspect-square rounded-md overflow-hidden border border-[#E8E4DC] bg-[#F4F1EA]">
                            <img
                              src={turn.choices.A.choice_image}
                              alt="Choice A"
                              className={`w-full h-full object-cover transition-opacity duration-300 ${generatingImages[`choice_A_${turn.turn_no}`] ? "opacity-30" : "opacity-100"}`}
                            />
                            {generatingImages[`choice_A_${turn.turn_no}`] && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white">
                                <RefreshCw className="size-4 animate-spin" />
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => triggerImageRebuild(`choice_A_${turn.turn_no}`, (url) => handleChoiceChange(turnIdx, "A", "choice_image", url))}
                            disabled={generatingImages[`choice_A_${turn.turn_no}`]}
                            className="w-full text-[10px] text-center font-bold text-[#2A4232] border border-[#E8E4DC] rounded py-1 hover:bg-[#F4F1EA] transition-colors"
                          >
                            재생성
                          </button>
                        </div>

                        {/* 선택지 B */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-[#8A847C]">선택지 B 결과</span>
                          <div className="relative aspect-square rounded-md overflow-hidden border border-[#E8E4DC] bg-[#F4F1EA]">
                            <img
                              src={turn.choices.B.choice_image}
                              alt="Choice B"
                              className={`w-full h-full object-cover transition-opacity duration-300 ${generatingImages[`choice_B_${turn.turn_no}`] ? "opacity-30" : "opacity-100"}`}
                            />
                            {generatingImages[`choice_B_${turn.turn_no}`] && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white">
                                <RefreshCw className="size-4 animate-spin" />
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => triggerImageRebuild(`choice_B_${turn.turn_no}`, (url) => handleChoiceChange(turnIdx, "B", "choice_image", url))}
                            disabled={generatingImages[`choice_B_${turn.turn_no}`]}
                            className="w-full text-[10px] text-center font-bold text-[#2A4232] border border-[#E8E4DC] rounded py-1 hover:bg-[#F4F1EA] transition-colors"
                          >
                            재생성
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>

          {/* 저장 및 배포 작업 박스 */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-4">
            <h4 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
              <ShieldAlert className="size-4" />
              최종 배포 및 관리자 확인
            </h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              본 캐릭터와 시나리오는 현재 <strong>Draft(초안)</strong> 상태입니다. 배포하기 전 역사 고증과 이미지의 품질을 꼼꼼하게 검토해 주세요. 배포를 누르면 즉시 일반 유저 서비스 데이터베이스에 반영됩니다.
            </p>
            <div className="space-y-2 pt-2">
              <AdminButton
                onClick={handlePublish}
                className="w-full !bg-[#2A4232] hover:!bg-[#1E3024] flex items-center justify-center gap-1.5"
              >
                <Send className="size-4" />
                실서비스 배포 (Publish)
              </AdminButton>
              
              <AdminButton
                variant="secondary"
                className="w-full bg-white hover:bg-[#F4F1EA]"
                onClick={() => {
                  alert("임시 저장되었습니다.");
                  router.push("/admin/review");
                }}
              >
                <Save className="size-4" />
                수정본 임시 저장 (Draft)
              </AdminButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
