"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AccountPage } from "@/components/custom/account-page";
import { NavigationBar } from "@/components/custom/navigation-bar";
import { useAuth } from "@/lib/contexts/AuthContext";
import styles from "@/components/custom/account-page.module.css";

export default function NotFound() {
  const { userRole } = useAuth();
  const authenticated = userRole !== "GUEST";

  return (
    <>
      <NavigationBar forceDeep />
      <AccountPage title="404" intro="요청하신 페이지를 찾을 수 없습니다." notFound>
        <div className={styles.message}>
          <span className={styles.eyebrow}>PAGE NOT FOUND</span>
          <h2>페이지가 이동되었거나 삭제되었어요.</h2>
          <p>입력하신 주소를 확인하거나 아래 링크에서 계속 이용해 주세요.</p>
          <div className={styles.actions}>
            <Link href="/" className={styles.primary}>홈으로 돌아가기 <ArrowRight size={16} /></Link>
            <Link href={authenticated ? "/home" : "/apply"} className={styles.secondary}>
              {authenticated ? "대시보드로 이동" : "지원 안내"}
            </Link>
          </div>
        </div>
      </AccountPage>
    </>
  );
}
