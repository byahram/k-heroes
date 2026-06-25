import {
  BookOpen,
  Flag,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
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
    label: "시스템",
    items: [
      { title: "지도자 등급 신청", href: "/admin/teacher-grade-applications", icon: GraduationCap },
      { title: "어드민 회원", href: "/admin/admins", icon: UserCog },
    ],
  },
];

export function isAdminNavActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
