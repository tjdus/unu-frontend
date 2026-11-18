import {
  Calendar,
  Bell,
  Settings,
  type LucideIcon,
  FileText,
  UserRound,
  UserRoundPlus,
  UsersRound,
  Activity,
  Clock,
  MonitorPlay,
  FilePen,
  ClipboardCheck,
  LibraryBig,
  BookOpen,
  BriefcaseBusiness,
  MessagesSquare,
} from "lucide-react";

export type MenuItem =
  | {
      label: string;
      href: string;
      icon: LucideIcon;
      type?: "item";
    }
  | {
      type: "separator";
    };

export interface MenuConfig {
  common: MenuItem[];
  member: MenuItem[];
  lectureRoomManager: MenuItem[];
  manager: MenuItem[];
  admin: MenuItem[];
}

export const menuConfig: MenuConfig = {
  // 모든 로그인 사용자에게 공통으로 표시되는 메뉴
  common: [
    {
      label : "내 프로필",
      href: "/profile",
      icon: UserRound, 
    },
    {
      label: "학회 공지",
      href: "/notices",
      icon: Bell,
    },
    {
      label: "학회 내부 신청/모집",
      href: "/operation-recruitments",
      icon: BriefcaseBusiness,
    },
    {
      label: "내 활동",
      href: "/home",
      icon: Activity,
    },
  ],

  // MEMBER 권한 사용자에게만 표시되는 메뉴
  member: [
    {
      label: "학회 활동",
      href: "/activities",
      icon: Calendar,
    },
    {
      label: "강의자료",
      href: "/lecture-materials",
      icon: LibraryBig,
    },
    {
      label: "보유 도서",
      href: "/books",
      icon: BookOpen,
    },
    {
      label: "인강 예약",
      href: "/online-lecture",
      icon: MonitorPlay,
    },
  ],

  // 학회실 관리 권한 사용자에게 표시되는 메뉴
  lectureRoomManager: [
    {
      label: "학회실 관리",
      href: "/manage/lecture-room",
      icon: Clock,
    },
  ],

  // MANAGER 권한 사용자에게만 표시되는 메뉴
  manager: [
    {
      label: "학회원 관리",
      href: "/manage/members",
      icon: UsersRound,
    },
    {
      label: "모집 관리",
      href: "/manage/recruitments",
      icon: UserRoundPlus,
    },
    {
      label: "면접 관리",
      href: "/manage/interviews",
      icon: MessagesSquare,
    },
    {
      label: "활동 관리",
      href: "/manage/activities",
      icon: FilePen,
    },
    {
      label: "개설 신청 관리",
      href: "/manage/activity-opening-requests",
      icon: ClipboardCheck,
    },
    {
      label: "일정 관리",
      href: "/manage",
      icon: Calendar,
    },
    {
      label: "Form 템플릿",
      href: "/manage/forms",
      icon: FileText,
    },
    {
      label: "공지 관리",
      href: "/manage/notices",
      icon: Bell,
    },
  ],

  // ADMIN 권한 사용자에게만 표시되는 메뉴
  admin: [
    {
      label: "시스템 관리",
      href: "/admin",
      icon: Settings,
    },
  ],
};

/**
 * Role에 따라 표시할 메뉴 목록을 반환
 * 권한 누적 방식: ADMIN은 MANAGER 메뉴도 볼 수 있음
 */
export function getMenuByRole(
  role: "ADMIN" | "MANAGER" | "MEMBER" | "GUEST" | "LECTURE_ROOM_MANAGER",
  roles: string[] = [],
): MenuItem[] {
  const menus: MenuItem[] = [];
  const assignedRoles = new Set([
    role,
    ...roles.map((assignedRole) =>
      assignedRole.toUpperCase().replace(/^ROLE_/, ""),
    ),
  ]);

  if (role === "GUEST") {
    return [];
  }

  // 공통 메뉴는 모든 로그인 사용자에게 표시
  menus.push(...menuConfig.common);

  // MEMBER 이상의 권한
  if (
    assignedRoles.has("MEMBER") ||
    assignedRoles.has("MANAGER") ||
    assignedRoles.has("ADMIN")
  ) {
    menus.push(...menuConfig.member);
  }

  if (
    assignedRoles.has("ADMIN") ||
    assignedRoles.has("MANAGER") ||
    assignedRoles.has("LECTURE_ROOM_MANAGER")
  ) {
    menus.push(...menuConfig.lectureRoomManager);
  }

  // MANAGER 이상의 권한
  if (assignedRoles.has("MANAGER") || assignedRoles.has("ADMIN")) {
    menus.push({ type: "separator" });
    menus.push(...menuConfig.manager);
  }

  // ADMIN 전용
  if (assignedRoles.has("ADMIN")) {
    menus.push({ type: "separator" });
    menus.push(...menuConfig.admin);
  }

  return menus;
}
