export function getRoleLabel(role?: string): string {
  switch (role) {
    case "ADMIN":
      return "관리자";
    case "MANAGER":
      return "운영자";
    case "MEMBER":
      return "학회원";
    case "LECTURE_ROOM_MANAGER":
      return "학회실 관리자";
    case "BLOG_MANAGER":
      return "블로그 에디터";
    case "ALUMNI":
      return "Alumni";
    default:
      return "없음";
  }
}

export function getRoleBadgeVariant(
  role?: string,
): "destructive" | "default" | "secondary" | "outline" {
  switch (role) {
    case "ADMIN":
      return "destructive";
    case "MANAGER":
      return "default";
    case "MEMBER":
      return "secondary";
    case "LECTURE_ROOM_MANAGER":
      return "secondary";
    case "BLOG_MANAGER":
      return "secondary";
    case "ALUMNI":
      return "secondary";
    default:
      return "outline";
  }
}
