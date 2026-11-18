"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { lookupApplication, verifyApplication } from "@/lib/api/application";
import { ApiError } from "@/lib/api/publicClient";
import { ApplicationLookupResponse } from "@/lib/interfaces/application";
import { cn } from "@/lib/utils";
import {
  Chip,
  Field,
  applyStyles as styles,
  formatDot,
} from "@/components/custom/apply/apply-ui";

export default function ApplicationLookupPage() {
  const router = useRouter();

  // Step 1: Search fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Step 2: Verify field
  const [password, setPassword] = useState("");

  const [foundApplication, setFoundApplication] = useState<ApplicationLookupResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError("모든 정보를 입력해주세요.");
      return;
    }

    try {
      setIsLoading(true);
      const application = await lookupApplication({ name: name.trim(), email: email.trim() });
      setFoundApplication(application);
      setError(null);
    } catch (searchError: unknown) {
      console.error("Failed to search application:", searchError);
      setError(
        searchError instanceof ApiError && searchError.status === 429
          ? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
          : "입력하신 정보와 일치하는 지원서를 찾을 수 없습니다",
      );
      setFoundApplication(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!foundApplication) {
      setError("먼저 지원서를 검색해주세요.");
      return;
    }

    if (!password.trim()) {
      setError("비밀번호를 입력해주세요.");
      return;
    }

    try {
      setIsLoading(true);
      const verification = await verifyApplication(foundApplication.id, password);

      // The short-lived token limits the impact of browser storage exposure.
      sessionStorage.setItem("current_application", JSON.stringify(verification.application));
      sessionStorage.setItem("current_application_token", verification.accessToken);
      sessionStorage.removeItem("current_application_pwd");

      // Navigate to detail page (no ID in URL)
      router.push("/apply/my/application");
    } catch (verifyError: unknown) {
      console.error("Failed to verify application:", verifyError);
      setError(
        verifyError instanceof ApiError && verifyError.status === 429
          ? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
          : "비밀번호가 올바르지 않습니다.",
      );
      setIsLoading(false);
    }
  };

  const resetSearch = () => {
    setFoundApplication(null);
    setPassword("");
    setError(null);
  };

  const errorAlert = error && (
    <p className={cn(styles.alert, styles.alertError)} role="alert">{error}</p>
  );

  const foundSummary = foundApplication && (
    <dl className={styles.stack}>
      <div className={styles.info}>
        <dt>이름</dt>
        <dd>{foundApplication.name}</dd>
      </div>
      <div className={styles.info}>
        <dt>이메일</dt>
        <dd>{foundApplication.email}</dd>
      </div>
      <div className={styles.info}>
        <dt>제출일</dt>
        <dd>{formatDot(foundApplication.createdAt)}</dd>
      </div>
    </dl>
  );

  return (
    <main className={styles.page}>
      <div className={styles.split}>
        <section className={styles.splitIntro} aria-labelledby="lookup-title">
          <nav className={styles.crumbs} aria-label="위치">
            <Link href="/apply">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              지원 안내
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">내 지원서 조회</span>
          </nav>
          <p className={styles.bigTitle} aria-hidden="true" lang="en">Lookup</p>
          <h1 id="lookup-title" className="sr-only">내 지원서 조회</h1>
          <p>{"지원서 제출 시 입력한 이름과 이메일로\n지원서를 찾을 수 있습니다."}</p>
        </section>

        <div className={styles.splitPanel}>
          {!foundApplication ? (
            <form className={styles.stack} onSubmit={handleSearch} noValidate>
              <span className={styles.tag}>01 · 지원서 검색</span>
              <Field
                label="이름"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="홍길동"
                disabled={isLoading}
                autoFocus
              />
              <Field
                label="이메일"
                required
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="example@email.com"
                disabled={isLoading}
              />
              {errorAlert}
              <button type="submit" className={styles.button} disabled={isLoading}>
                {isLoading ? "검색 중..." : "지원서 검색"}
              </button>
            </form>
          ) : foundApplication.status === "CANCELED" ? (
            <section className={styles.panel} aria-labelledby="lookup-canceled">
              <div className={styles.panelHead}>
                <div>
                  <span className={styles.tag}>02 · 조회 결과</span>
                  <h2 id="lookup-canceled" className="sr-only">취소된 지원서</h2>
                </div>
                <Chip>취소된 지원서입니다</Chip>
              </div>
              {foundSummary}
              <button type="button" className={styles.buttonOutlined} onClick={resetSearch}>
                다시 검색
              </button>
            </section>
          ) : (
            <form className={styles.panel} onSubmit={handleVerify} noValidate aria-labelledby="lookup-verify">
              <div className={styles.panelHead}>
                <div>
                  <span className={styles.tag}>02 · 비밀번호 확인</span>
                  <h2 id="lookup-verify" className="sr-only">비밀번호 확인</h2>
                </div>
                <Chip active>지원서를 찾았습니다</Chip>
              </div>
              {foundSummary}
              <Field
                label="비밀번호"
                required
                secret
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                support="지원서 제출 시 설정한 비밀번호"
                disabled={isLoading}
                autoFocus
              />
              {errorAlert}
              <div className={styles.actions}>
                <button type="button" className={styles.buttonOutlined} onClick={resetSearch} disabled={isLoading}>
                  다시 검색
                </button>
                <button type="submit" className={styles.button} disabled={isLoading}>
                  {isLoading ? "확인 중..." : "확인"}
                </button>
              </div>
            </form>
          )}

          <section className={styles.notice} aria-labelledby="lookup-notice">
            <h2 id="lookup-notice">안내사항</h2>
            <ul>
              <li>지원서 제출 시 입력한 정보와 동일하게 입력해 주세요.</li>
              <li>검토가 시작된 지원서는 수정할 수 없습니다.</li>
              <li>
                <span>비밀번호를 잊으신 경우 <a href="mailto:admin@cnu.team">admin@cnu.team</a>으로 문의해 주세요.</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
