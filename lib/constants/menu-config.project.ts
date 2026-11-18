/**
 * 현재 프로젝트의 실제 라우팅 구조에 맞춘 메뉴 설정
 *
 * 프로젝트 구조:
 * - /apply - 공개 지원 페이지
 * - /apply/my - 내 지원서 조회
 * - /activities - 활동 관리
 * - /manage - 관리자 페이지
 *
 * 이 파일을 사용하려면:
 * lib/constants/menu-config.ts를 이 내용으로 교체하세요.
 */

import {
  Home,
  User,
  Calendar,
  Users,
  Bell,
  UserPlus,
  Settings,
  FileText,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

export interface MenuItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface MenuConfig {
  common: MenuItem[];
  member: MenuItem[];
  manager: MenuItem[];
  admin: MenuItem[];
}

export const menuConfig: MenuConfig = {
  // 모든 로그인 사용자에게 공통으로 표시되는 메뉴
  common: [
    {
      label: "홈",
      href: "/",
      icon: Home,
    },
    {
      label: "지원하기",
      href: "/apply",
      icon: ClipboardList,
    },
    {
      label: "내 지원서",
      href: "/apply/my",
      icon: FileText,
    },
  ],

  // MEMBER 권한 사용자에게만 표시되는 메뉴
  member: [
    {
      label: "활동 관리",
      href: "/activities",
      icon: Calendar,
    },
  ],

  // MANAGER 권한 사용자에게만 표시되는 메뉴
  manager: [
    {
      label: "활동 관리",
      href: "/activities",
      icon: Calendar,
    },
    {
      label: "모집 관리",
      href: "/manage/recruitment",
      icon: UserPlus,
    },
  ],

  // ADMIN 권한 사용자에게만 표시되는 메뉴
  admin: [
    {
      label: "관리자 페이지",
      href: "/manage",
      icon: Settings,
    },
    {
      label: "Form 템플릿",
      href: "/manage/forms",
      icon: FileText,
    },
  ],
};

/**
 * Role에 따라 표시할 메뉴 목록을 반환
 * 권한 누적 방식: ADMIN은 MANAGER 메뉴도 볼 수 있음
 */
export function getMenuByRole(
  role: "ADMIN" | "MANAGER" | "MEMBER" | "GUEST",
): MenuItem[] {
  const menus: MenuItem[] = [];

  if (role === "GUEST") {
    // 비로그인 사용자는 공개 페이지만
    return [
      {
        label: "지원하기",
        href: "/apply",
        icon: ClipboardList,
      },
    ];
  }

  // 공통 메뉴는 모든 로그인 사용자에게 표시
  menus.push(...menuConfig.common);

  // MEMBER 이상의 권한
  if (role === "MEMBER" || role === "MANAGER" || role === "ADMIN") {
    // member 메뉴와 manager 메뉴에 중복이 있으면 제거
    const memberMenus = menuConfig.member.filter(
      (m) => !menus.some((existing) => existing.href === m.href),
    );
    menus.push(...memberMenus);
  }

  // MANAGER 이상의 권한
  if (role === "MANAGER" || role === "ADMIN") {
    const managerMenus = menuConfig.manager.filter(
      (m) => !menus.some((existing) => existing.href === m.href),
    );
    menus.push(...managerMenus);
  }

  // ADMIN 전용
  if (role === "ADMIN") {
    const adminMenus = menuConfig.admin.filter(
      (m) => !menus.some((existing) => existing.href === m.href),
    );
    menus.push(...adminMenus);
  }

  return menus;
}
