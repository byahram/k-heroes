"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type MemberPanelCollapsibleSectionProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  meta?: ReactNode;
  title: string;
};

export function MemberPanelCollapsibleSection({
  children,
  defaultOpen = true,
  meta,
  title,
}: MemberPanelCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-t border-[#F0EBE3] pt-5">
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <ChevronDown
          aria-hidden
          className={cn("size-4 shrink-0 text-[#8A847C] transition-transform", open && "rotate-180")}
        />
        <h3 className="text-sm font-semibold text-[#1A1714]">{title}</h3>
        {meta ? <span className="ml-auto shrink-0 text-xs text-[#8A847C]">{meta}</span> : null}
      </button>

      {open ? <div className="mt-3 space-y-3">{children}</div> : null}
    </section>
  );
}
