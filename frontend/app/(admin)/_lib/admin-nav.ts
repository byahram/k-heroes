import {
  BookOpen,
  Contact,
  Database,
  Eye,
  Flag,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  School,
  Sparkles,
  Tags,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const adminNavGroups: AdminNavGroup[] = [
  {
    label: "개요",
    items: [{ title: "대시보드", href: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "AI 생성 파이프라인",
    items: [
      { title: "RAG 자료 관리", href: "/admin/rag", icon: Database },
      { title: "시나리오 일괄 생성", href: "/admin/pipeline", icon: Sparkles },
      { title: "시나리오 검수 및 배포", href: "/admin/review", icon: Eye },
    ],
  },
  {
    label: "콘텐츠",
    items: [
      { title: "인물 카테고리", href: "/admin/character-categories", icon: Tags },
      { title: "인물", href: "/admin/characters", icon: Users },
      { title: "시나리오", href: "/admin/scenarios", icon: BookOpen },
      { title: "턴", href: "/admin/turns", icon: GitBranch },
      { title: "엔딩", href: "/admin/endings", icon: Flag },
    ],
  },
  {
    label: "회원",
    items: [
      { title: "회원", href: "/admin/users", icon: Contact },
      { title: "지도자 등급 신청", href: "/admin/teacher-grade-applications", icon: GraduationCap },
      { title: "클래스", href: "/admin/classes", icon: School },
    ],
  },
  {
    label: "어드민",
    items: [{ title: "어드민 회원", href: "/admin/admins", icon: UserCog }],
  },
];

export function isAdminNavActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
