"use client";

import { cn } from "@/lib/utils/cn";
import type { ClassDetailTab } from "@/app/(auth)/classes/[id]/_types";

type ClassDetailTabBarProps = {
  activeTab: ClassDetailTab;
  characterRecordCount: number;
  onTabChange: (tab: ClassDetailTab) => void;
  recordCount: number;
  studentCount: number;
};

const tabs: { id: ClassDetailTab; label: string }[] = [
  { id: "students", label: "학생 목록" },
  { id: "student-sessions", label: "학생별 기록" },
  { id: "character-records", label: "인물 기록" },
  { id: "records", label: "전체 기록" },
];

export function ClassDetailTabBar({
  activeTab,
  characterRecordCount,
  onTabChange,
  recordCount,
  studentCount,
}: ClassDetailTabBarProps) {
  function getMeta(tab: ClassDetailTab) {
    if (tab === "records") return `${recordCount}건`;
    if (tab === "character-records") return `${characterRecordCount}건`;
    return `${studentCount}명`;
  }

  return (
    <div
      className="mb-5 grid grid-cols-2 gap-2 rounded-xl border p-1.5"
      role="tablist"
      style={{ borderColor: "rgba(42,66,50,0.12)", background: "rgba(253,250,244,0.8)" }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            aria-selected={isActive}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium transition sm:gap-2 sm:px-4",
              isActive
                ? "bg-[#2A4232] text-white shadow-sm"
                : "text-[#6B6458] hover:bg-[rgba(42,66,50,0.06)] hover:text-[#2A4232]",
            )}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            type="button"
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                isActive ? "bg-white/15 text-white" : "bg-[rgba(42,66,50,0.08)] text-[#8A847C]",
              )}
            >
              {getMeta(tab.id)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
