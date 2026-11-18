import { NextRequest, NextResponse } from "next/server";
import { jwtDecode } from "jwt-decode";

interface DecodedToken {
  exp?: number;
  sub?: string;
  roles?: string[];
}

function isTokenValid(token: string): boolean {
  try {
    const decoded = jwtDecode<DecodedToken>(token);
    if (decoded.exp && decoded.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

function hasAnyRole(token: string, requiredRoles: string[]): boolean {
  try {
    const decoded = jwtDecode<DecodedToken>(token);
    return (decoded.roles ?? []).some((role) =>
      requiredRoles.includes(role.toUpperCase().replace(/^ROLE_/, "")),
    );
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  // HttpOnly refresh 쿠키는 서버(미들웨어)에서는 읽을 수 있다(브라우저 JS만 못 읽음).
  const refreshToken = request.cookies.get("refreshToken")?.value;

  const accessValid = Boolean(token && isTokenValid(token));

  // Access Token(1h)이 만료돼도 Refresh Token(8h)이 살아 있으면 클라이언트가 복구할 수 있으므로,
  // 성급히 /login으로 보내지 않고 통과시킨다. 이때 refresh JWT의 권한은 신뢰하지 않는다.
  if (!accessValid) {
    if (refreshToken) {
      return NextResponse.next();
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "redirect",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  // 여기부터는 Access Token이 유효한 경우에만 role 기반 접근을 판단한다.
  // (만료+refresh만 있는 상태에서는 role을 알 수 없으므로 판단하지 않고 Backend 인가에 맡긴다.)
  if (
    request.nextUrl.pathname.startsWith("/manage/lecture-room") &&
    !hasAnyRole(token!, ["ADMIN", "MANAGER", "LECTURE_ROOM_MANAGER"])
  ) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  if (
    request.nextUrl.pathname.startsWith("/manage/interviews") &&
    !hasAnyRole(token!, ["ADMIN", "MANAGER"])
  ) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/manage/:path*",
    "/admin/:path*",
    "/home",
    "/home/:path*",
    "/profile",
    "/notices",
    "/books",
    "/operation-recruitments/my/:path*",
    "/activities/:path*",
    "/activity-opening/:path*",
    "/lecture-materials",
    "/online-lecture",
  ],
};
