"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  checkApplicantNotifications,
  getApplicantNotificationSummary,
} from "@/lib/api/applicant-notification";
import { ActivityApplicantCount } from "@/lib/interfaces/applicant-notification";
import { useAuth } from "@/lib/contexts/AuthContext";

interface ApplicantNotificationState {
  totalCount: number;
  byActivity: ActivityApplicantCount[];
}

interface ApplicantNotificationContextValue extends ApplicantNotificationState {
  isLoading: boolean;
  refresh: () => Promise<void>;
  acknowledge: () => Promise<ActivityApplicantCount[]>;
}

const EMPTY_STATE: ApplicantNotificationState = { totalCount: 0, byActivity: [] };

const ApplicantNotificationContext =
  createContext<ApplicantNotificationContextValue | null>(null);

export function ApplicantNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<ApplicantNotificationState>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setState(EMPTY_STATE);
      setIsLoading(false);
      return;
    }
    try {
      const summary = await getApplicantNotificationSummary();
      setState({
        totalCount: summary.totalCount,
        byActivity: summary.activities,
      });
    } catch (error) {
      console.error("Failed to fetch applicant notification summary:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    const initialRefreshId = window.setTimeout(() => void refresh(), 0);
    if (!isAuthenticated) {
      return () => window.clearTimeout(initialRefreshId);
    }

    const intervalId = window.setInterval(() => void refresh(), 60_000);
    const handleFocus = () => void refresh();
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearTimeout(initialRefreshId);
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isAuthenticated, authLoading, refresh]);

  // 확인 처리 후, "리셋 직전에 새로 들어왔던" 목록을 호출부에 돌려준다.
  // 폴링(refresh)이 이 목록을 덮어쓰지 않도록 패널이 직접 들고 있어야 하기 때문이다.
  const acknowledge = useCallback(async (): Promise<ActivityApplicantCount[]> => {
    try {
      const summary = await checkApplicantNotifications();
      setState({ totalCount: 0, byActivity: summary.activities });
      return summary.activities;
    } catch (error) {
      console.error("Failed to acknowledge applicant notifications:", error);
      return [];
    }
  }, []);

  return (
    <ApplicantNotificationContext.Provider
      value={{ ...state, isLoading, refresh, acknowledge }}
    >
      {children}
    </ApplicantNotificationContext.Provider>
  );
}

export function useApplicantNotification() {
  const context = useContext(ApplicantNotificationContext);
  if (!context) {
    throw new Error(
      "useApplicantNotification must be used within ApplicantNotificationProvider",
    );
  }
  return context;
}
