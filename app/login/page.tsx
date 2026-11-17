"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "@/components/custom/editorial.module.css";
import { cn } from "@/lib/utils";
import { login as loginApi } from "@/lib/api/auth";
import { LoginRequest } from "@/lib/interfaces/auth";
import { useAuth } from "@/lib/contexts/AuthContext";
import { consumeSessionExpired } from "@/lib/utils/auth-session";

const LoginForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const expiredFromUrl = searchParams.get("reason") === "session-expired";
  const safeRedirect =
    redirectTo?.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : null;
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(expiredFromUrl);

  useEffect(() => {
    if (expiredFromUrl || consumeSessionExpired()) {
      setSessionExpired(true);
    }
  }, [expiredFromUrl]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = formData.get("username");
    const password = formData.get("password");

    setLoading(true);
    setError(null);

    try {
      const data: LoginRequest = {
        username: username as string,
        password: password as string,
      };
      const response = await loginApi(data);

      login(response.token);

      // 로그인이 필요해서 여기로 밀려왔다면 원래 가려던 곳으로, 아니면 홈으로
      router.push(safeRedirect || "/home");
    } catch (error: unknown) {
      const serverMessage = (
        error as { response?: { data?: string } }
      )?.response?.data;
      setError(
        serverMessage ??
          (error instanceof Error
            ? error.message
            : "로그인 중 오류가 발생했습니다."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={cn(styles.shell, styles.loginBody)}>
        <div className={styles.loginIntro}>
          <h1>Login</h1>
          <p>
            학회원 전용 공간입니다.<br />
            계정 문의는 <a href="mailto:admin@cnu.team">admin@cnu.team</a>으로 보내 주세요.
          </p>
        </div>
        <div className={styles.loginPanel}>
          {sessionExpired ? (
            <div role="status" className={styles.notice}>
              세션이 만료되어 로그아웃 되었습니다.
            </div>
          ) : safeRedirect ? (
            <div role="status" className={styles.notice}>
              로그인이 필요한 페이지입니다. 로그인 후 이어서 진행해주세요.
            </div>
          ) : null}
          <form className={styles.loginForm} onSubmit={handleSubmit}>
            <div className={styles.loginField}>
              <label htmlFor="username">이메일 또는 아이디</label>
              <Input id="username" name="username" type="text" placeholder="name@sogang.ac.kr"
                required autoComplete="username" autoCapitalize="none" spellCheck={false} />
            </div>
            <div className={styles.loginField}>
              <label htmlFor="password">비밀번호</label>
              <Input id="password" name="password" type="password" placeholder="••••••••"
                required autoComplete="current-password" />
            </div>
            {error && <div role="alert" className={cn(styles.notice, styles.error)}>{error}</div>}
            <Button type="submit" className={styles.loginSubmit} disabled={loading}>
              {loading ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
};

const LoginPage = () => (
  <Suspense fallback={<main className={styles.page} aria-busy="true" />}>
    <LoginForm />
  </Suspense>
);

export default LoginPage;
