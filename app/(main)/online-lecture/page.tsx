"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import OnlineLectureApp from "@/components/custom/online-lecture/OnlineLectureApp";
import LectureAdminView from "@/components/custom/online-lecture/LectureAdminView";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useLectureParticipation } from "@/lib/hooks/useLectureParticipation";
import styles from "@/components/custom/online-lecture/booking.module.css";

type Tab = "my" | "admin";

export default function OnlineLecturePage() {
  const router = useRouter();
  const { hasRole, isAuthenticated, isLoading: authLoading } = useAuth();
  const isManager = hasRole("MANAGER");
  const { loading: participationLoading, participant } = useLectureParticipation();
  const [tab, setTab] = useState<Tab>("my");

  const canAccess = isManager || !!participant;
  const loading = authLoading || participationLoading;

  useEffect(() => {
    if (loading || canAccess || !isAuthenticated) return;
    toast.error("인강 신청자만 접근할 수 있는 페이지입니다.");
    router.replace("/home");
  }, [loading, canAccess, isAuthenticated, router]);

  if (loading || !canAccess) return null;

  const showTabs = isManager && !!participant;
  const activeTab = showTabs ? tab : isManager ? "admin" : "my";

  const tabs = showTabs ? (
    <div className={styles.tabs} role="group" aria-label="인강 예약 화면">
      <button type="button" aria-pressed={activeTab === "my"} onClick={() => setTab("my")}>강의 예약</button>
      <button type="button" aria-pressed={activeTab === "admin"} onClick={() => setTab("admin")}>예약 현황</button>
    </div>
  ) : null;

  return (
    <div className={styles.page}>
      {activeTab === "admin" ? <LectureAdminView tabs={tabs} /> : <OnlineLectureApp tabs={tabs} />}
    </div>
  );
}
