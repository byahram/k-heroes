"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight, Music2, Pause, Play, SkipForward, Volume2 } from "lucide-react";

const TRACKS = [
  {
    title: "K Heroes Dawn",
    subtitle: "새벽의 여정",
    src: "/audio/k-heroes-dawn.mp3",
  },
  {
    title: "하늘길의 맹세",
    subtitle: "선택의 순간",
    src: "/audio/sky-road-oath.mp3",
  },
];

export function GlobalBgmPlayer() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wantsPlaybackRef = useRef(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const currentTrack = TRACKS[currentIndex];
  const attemptPlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !wantsPlaybackRef.current) return false;

    audio.volume = 0.36;
    try {
      await audio.play();
      setIsPlaying(true);
      return true;
    } catch {
      setIsPlaying(false);
      return false;
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.36;
    audio.src = currentTrack.src;

    if (wantsPlaybackRef.current) {
      void attemptPlay();
    }
  }, [attemptPlay, currentTrack.src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.36;
    audio.src = currentTrack.src;

    void attemptPlay();

    const unlockPlay = async () => {
      if (!wantsPlaybackRef.current || !audio.paused) return;
      await attemptPlay();
    };

    const retryWhenVisible = () => {
      if (document.visibilityState === "visible") void attemptPlay();
    };

    window.addEventListener("pointerdown", unlockPlay, true);
    window.addEventListener("click", unlockPlay, true);
    window.addEventListener("keydown", unlockPlay, true);
    window.addEventListener("focus", retryWhenVisible);
    window.addEventListener("pageshow", retryWhenVisible);
    document.addEventListener("visibilitychange", retryWhenVisible);

    return () => {
      window.removeEventListener("pointerdown", unlockPlay, true);
      window.removeEventListener("click", unlockPlay, true);
      window.removeEventListener("keydown", unlockPlay, true);
      window.removeEventListener("focus", retryWhenVisible);
      window.removeEventListener("pageshow", retryWhenVisible);
      document.removeEventListener("visibilitychange", retryWhenVisible);
    };
  }, [attemptPlay, currentTrack.src]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void attemptPlay();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [attemptPlay, pathname]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setCurrentIndex((index) => (index + 1) % TRACKS.length);
      setIsPlaying(true);
    };

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, []);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      wantsPlaybackRef.current = false;
      audio.pause();
      setIsPlaying(false);
      return;
    }

    wantsPlaybackRef.current = true;
    await attemptPlay();
  };

  const playTrack = async (index: number) => {
    wantsPlaybackRef.current = true;
    setCurrentIndex(index);
    setIsPlaying(true);
    requestAnimationFrame(() => {
      void attemptPlay();
    });
  };

  const playNext = () => {
    void playTrack((currentIndex + 1) % TRACKS.length);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[85]">
      <audio ref={audioRef} preload="metadata" />
      <style>{`
        @keyframes khBgmBar {
          0%, 100% { transform: scaleY(0.34); opacity: 0.54; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes khBgmGlow {
          0%, 100% { box-shadow: 0 10px 30px rgba(42,66,50,0.18); }
          50% { box-shadow: 0 12px 38px rgba(42,66,50,0.3); }
        }
        .kh-bgm-playing {
          animation: khBgmGlow 2.4s ease-in-out infinite;
        }
        .kh-bgm-bar {
          transform-origin: bottom;
          animation: khBgmBar 0.86s ease-in-out infinite;
        }
        .kh-bgm-idle-bar {
          opacity: 0.38;
          transform: scaleY(0.42);
        }
      `}</style>

      {!isCollapsed && isOpen && (
        <div
          className="mb-2 w-[260px] overflow-hidden rounded-2xl border p-2.5"
          style={{
            background: "rgba(253,250,244,0.92)",
            borderColor: "rgba(42,66,50,0.14)",
            boxShadow: "0 18px 48px rgba(42,66,50,0.18)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
          }}
        >
          <div className="mb-2.5 flex items-start gap-2 px-1">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "rgba(42,66,50,0.1)", color: "#2A4232" }}
            >
              <Music2 className="h-3.5 w-3.5" />
            </div>
            <div>
              <p
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: "0.82rem",
                  fontWeight: 900,
                  color: "#1A1714",
                }}
              >
                K-Heroes 공식 BGM
              </p>
              <p
                className="mt-0.5"
                style={{
                  fontFamily: "'Noto Sans KR', sans-serif",
                  fontSize: "0.66rem",
                  color: "#756B5E",
                  lineHeight: 1.55,
                }}
              >
                프로젝트 분위기에 맞춰 AI로 직접 제작한 배경음악입니다.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            {TRACKS.map((track, index) => {
              const active = index === currentIndex;
              return (
                <button
                  key={track.src}
                  type="button"
                  onClick={() => playTrack(index)}
                  className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all hover:bg-[rgba(42,66,50,0.08)]"
                  style={{
                    background: active ? "rgba(42,66,50,0.1)" : "transparent",
                    border: active ? "1px solid rgba(42,66,50,0.16)" : "1px solid transparent",
                  }}
                >
                  <span>
                    <span
                      className="block"
                      style={{
                        fontFamily: "'Noto Sans KR', sans-serif",
                        fontSize: "0.76rem",
                        fontWeight: 900,
                        color: active ? "#2A4232" : "#3A332B",
                      }}
                    >
                      {track.title}
                    </span>
                    <span
                      className="block"
                      style={{
                        fontFamily: "'Noto Sans KR', sans-serif",
                        fontSize: "0.62rem",
                        color: "#8A7E70",
                      }}
                    >
                      {track.subtitle}
                    </span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" style={{ color: active ? "#2A4232" : "#A89E8E" }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isCollapsed ? (
        <button
          type="button"
          onClick={() => {
            setIsCollapsed(false);
            setIsOpen(true);
          }}
          aria-label="BGM 플레이어 펼치기"
          className={`flex items-center gap-1 rounded-full border p-1.5 ${isPlaying ? "kh-bgm-playing" : ""}`}
          style={{
            background: "rgba(253,250,244,0.9)",
            borderColor: "rgba(42,66,50,0.16)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{
              background: "linear-gradient(135deg, #1E3328 0%, #3D6B52 100%)",
              color: "#FDFAF4",
            }}
          >
            <Music2 className="h-4 w-4" />
          </span>
          <span className="flex h-7 items-end gap-0.5 px-1" aria-hidden>
            {[0, 1, 2].map((bar) => (
              <span
                key={bar}
                className={`block w-1 rounded-full ${isPlaying ? "kh-bgm-bar" : "kh-bgm-idle-bar"}`}
                style={{
                  height: `${10 + bar * 4}px`,
                  background: bar === 1 ? "#C9933A" : "#2A4232",
                  animationDelay: `${bar * 130}ms`,
                }}
              />
            ))}
          </span>
        </button>
      ) : (
      <div
        className={`flex items-center gap-1.5 rounded-full border p-1.5 ${isPlaying ? "kh-bgm-playing" : ""}`}
        style={{
          background: "rgba(253,250,244,0.9)",
          borderColor: "rgba(42,66,50,0.16)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? "BGM 정지" : "BGM 재생"}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95"
          style={{
            background: "linear-gradient(135deg, #1E3328 0%, #3D6B52 100%)",
            color: "#FDFAF4",
          }}
        >
          {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
        </button>

        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="flex max-w-[118px] items-center gap-1.5 rounded-full px-2 py-1 text-left transition-colors hover:bg-[rgba(42,66,50,0.07)]"
          aria-expanded={isOpen}
        >
          <Volume2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#2A4232" }} />
          <span className="min-w-0">
            <span
              className="block truncate"
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: "0.68rem",
                fontWeight: 900,
                color: "#2A4232",
              }}
            >
              {currentTrack.title}
            </span>
            <span
              className="block"
              style={{
                fontFamily: "'Noto Sans KR', sans-serif",
                fontSize: "0.58rem",
                color: "#8A7E70",
              }}
            >
              공식 BGM
            </span>
          </span>
        </button>

        {isPlaying && (
          <div className="hidden h-7 items-end gap-0.5 px-0.5 sm:flex" aria-hidden>
            {[0, 1, 2, 3].map((bar) => (
              <span
                key={bar}
                className="kh-bgm-bar block w-1 rounded-full"
                style={{
                  height: `${10 + bar * 3}px`,
                  background: bar % 2 === 0 ? "#2A4232" : "#C9933A",
                  animationDelay: `${bar * 120}ms`,
                }}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={playNext}
          aria-label="다음 BGM"
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[rgba(42,66,50,0.08)]"
          style={{ color: "#2A4232" }}
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setIsCollapsed(true);
          }}
          aria-label="BGM 플레이어 접기"
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[rgba(42,66,50,0.08)]"
          style={{ color: "#2A4232" }}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      )}
    </div>
  );
}
