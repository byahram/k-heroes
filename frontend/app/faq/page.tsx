import { SitePageShell } from "@/components/layout/site-page-shell";

const FAQS = [
  {
    question: "K-Heroes는 어떤 서비스인가요?",
    answer:
      "문화빅데이터를 기반으로 한국 역사 인물과 지역 이야기를 연결해 선택형 시뮬레이션으로 체험하는 교육 서비스입니다.",
  },
  {
    question: "어떤 데이터를 활용하나요?",
    answer:
      "문화 빅데이터 플랫폼의 지역이야기와 역사인물, 지역이야기와 예술인 데이터를 통합해 인물·지역·문화 키워드 맥락을 구성합니다.",
  },
  {
    question: "교육기관에서 활용할 수 있나요?",
    answer:
      "수업, 역사 체험 활동, 지역 문화 교육 콘텐츠로 활용할 수 있습니다. 도입 문의는 nightbonus@outlook.com으로 연락해 주세요.",
  },
  {
    question: "시뮬레이션 결과는 실제 역사와 같나요?",
    answer:
      "사용자의 선택에 따라 가상의 흐름이 만들어질 수 있으며, 실제 역사적 맥락과 비교하며 이해할 수 있도록 구성합니다.",
  },
];

export default function FaqPage() {
  return (
    <SitePageShell>
      <section className="mx-auto max-w-4xl px-6 py-20">
        <span
          className="mb-5 inline-flex rounded-full px-4 py-1.5 text-xs"
          style={{
            background: "rgba(42,66,50,0.1)",
            border: "1px solid rgba(42,66,50,0.18)",
            color: "#2A4232",
            fontFamily: "'Noto Sans KR', sans-serif",
            letterSpacing: "0.08em",
          }}
        >
          FAQ
        </span>
        <h1
          className="mb-4"
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: "clamp(2rem, 5vw, 3rem)",
            fontWeight: 800,
            color: "#1A1714",
            lineHeight: 1.25,
          }}
        >
          자주 묻는 질문
        </h1>
        <p
          className="mb-10 max-w-2xl"
          style={{
            color: "#6B6355",
            fontFamily: "'Noto Sans KR', sans-serif",
            fontSize: "0.95rem",
            lineHeight: 1.85,
          }}
        >
          K-Heroes 이용과 교육기관 활용에 대해 자주 묻는 내용을 정리했습니다.
          추가 문의는 nightbonus@outlook.com으로 보내주세요.
        </p>

        <div className="space-y-4">
          {FAQS.map((item) => (
            <article
              key={item.question}
              className="rounded-2xl px-6 py-5"
              style={{
                background: "rgba(253,250,244,0.72)",
                border: "1px solid rgba(42,66,50,0.1)",
                boxShadow: "0 12px 32px rgba(42,66,50,0.08)",
                backdropFilter: "blur(6px)",
              }}
            >
              <h2
                className="mb-2"
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  color: "#1A1714",
                }}
              >
                {item.question}
              </h2>
              <p
                style={{
                  color: "#5F574D",
                  fontFamily: "'Noto Sans KR', sans-serif",
                  fontSize: "0.9rem",
                  lineHeight: 1.8,
                }}
              >
                {item.answer}
              </p>
            </article>
          ))}
        </div>
      </section>
    </SitePageShell>
  );
}
