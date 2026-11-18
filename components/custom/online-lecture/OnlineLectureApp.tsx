"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "@/lib/online-lecture/api";
import { messageFor } from "@/lib/online-lecture/api";
import { groupReservations, splitByTime } from "@/lib/online-lecture/group";
import { addDaysToDateStr, compareTimes, dateLabel, durationLabel, isReservableDate, isSameWeek, maxContinuous, maxReservationDateStr, todayStr, weekOfMonthLabel, weekStartStr } from "@/lib/online-lecture/date";
import type {
  Booking,
  BookingItem,
  Lecture,
  LectureAccountStatus,
  Reservation,
  ReservationCartItem,
  Screen,
} from "@/lib/online-lecture/types";

import MainScreen from "./MainScreen";
import DetailScreen from "./DetailScreen";
import ConfirmScreen from "./ConfirmScreen";
import MyScreen from "./MyScreen";

const CONTINUOUS_SLOT_LIMIT = 4; 
const WEEKLY_SLOT_LIMIT = 8; 
const SLOT_REFRESH_INTERVAL_MS = 5000;
const SCREENS: Screen[] = ["auth", "main", "detail", "confirm", "my"];

type ToastTone = "info" | "success" | "error";

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ConfirmState {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  tone: "default" | "danger";
  resolve: (confirmed: boolean) => void;
}

function cartKey(lecture: string, date: string): string {
  return `${lecture}::${date}`;
}

function isScreen(value: unknown): value is Screen {
  return typeof value === "string" && SCREENS.includes(value as Screen);
}

function sameTimes(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort(compareTimes);
  const right = [...b].sort(compareTimes);
  return left.every((time, index) => time === right[index]);
}

export default function OnlineLectureApp({ tabs }: { tabs?: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>("auth");
  const [initialized, setInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);

  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  /** 저장 후의 최종 시간표. 기존 예약으로 초기화되고, 켜고 끄는 대로 바뀐다. */
  const [desiredTimes, setDesiredTimes] = useState<string[]>([]);
  const [reservedTimes, setReservedTimes] = useState<string[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [accountByLecture, setAccountByLecture] = useState<Record<string, LectureAccountStatus>>({});
  const [cartItems, setCartItems] = useState<ReservationCartItem[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone = "info") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const askConfirm = useCallback(
    (
      message: string,
      options: Partial<Pick<ConfirmState, "title" | "cancelLabel" | "confirmLabel" | "tone">> = {},
    ) =>
      new Promise<boolean>((resolve) => {
        setConfirmDialog({
          title: options.title ?? "확인",
          message,
          cancelLabel: options.cancelLabel ?? "닫기",
          confirmLabel: options.confirmLabel ?? "확인",
          tone: options.tone ?? "default",
          resolve,
        });
      }),
    [],
  );

  const closeConfirm = (confirmed: boolean) => {
    const dialog = confirmDialog;
    if (!dialog) return;
    setConfirmDialog(null);
    dialog.resolve(confirmed);
  };

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const go = useCallback((next: Screen, mode: "push" | "replace" = "push") => {
    setScreen(next);
    const state = { lectureReservation: true, screen: next };
    if (mode === "replace") {
      window.history.replaceState(state, "", window.location.href);
    } else {
      window.history.pushState(state, "", window.location.href);
    }
    window.scrollTo(0, 0);
  }, []);

  const goMain = useCallback(() => {
    go("main", "replace");
  }, [go]);

  const goMy = useCallback(() => {
    go("my", screen === "main" ? "push" : "replace");
  }, [go, screen]);

  useEffect(() => {
    window.history.replaceState({ lectureReservation: true, screen: "auth" }, "", window.location.href);

    const onPopState = (event: PopStateEvent) => {
      const next = event.state?.lectureReservation && isScreen(event.state.screen)
        ? event.state.screen
        : null;
      if (!next) return;

      setScreen(next);
      window.scrollTo(0, 0);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const refreshMine = useCallback(async () => {
    setMyReservations(await api.getMyReservations());
  }, []);

  /** 이 강의·날짜에 찬 시간(내 것 포함)을 다시 읽는다. 저장 후 명령형으로 호출한다. */
  const refreshReservedSlots = useCallback(async (lectureName: string, date: string) => {
    try {
      setReservedTimes(await api.getReservedSlots(lectureName, date));
    } catch {
      setReservedTimes([]);
    }
  }, []);

  // ── 서버 인증 및 초기 데이터 ────────────────────────────────────────────────
  const initialize = useCallback(async () => {
    setLoading(true);
    setInitializationError(null);
    try {
      const data = await api.bootstrap();
      setLectures(data.lectures);
      setMyReservations(data.reservations);
      setInitialized(true);
      go("main", "replace");
    } catch (err) {
      setInitialized(false);
      setInitializationError(
        messageFor(err, "인강 예약 정보를 불러오지 못했습니다."),
      );
    } finally {
      setLoading(false);
    }
  }, [go]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // ── 강의 선택 ──────────────────────────────────────────────────────────────
  const openLecture = (l: Lecture) => {
    setLecture(l);
    setSelectedDate(todayStr());
    setReservedTimes([]);
    go("detail");
  };

  useEffect(() => {
    if (screen !== "detail" || !lecture) return;

    let cancelled = false;
    let inFlight = false;

    const loadSlots = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const slots = await api.getReservedSlots(lecture.name, selectedDate);
        if (!cancelled) setReservedTimes(slots);
      } catch {
        if (!cancelled) setReservedTimes([]);
      } finally {
        inFlight = false;
      }
    };

    void loadSlots();
    const intervalId = window.setInterval(loadSlots, SLOT_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [screen, lecture, selectedDate]);

  const myTimes = useMemo(() => {
    if (!lecture) return [];
    return myReservations
      .filter((r) => r.lecture === lecture.name && r.res_date === selectedDate)
      .map((r) => r.res_time)
      .sort();
  }, [myReservations, lecture, selectedDate]);

  const currentCartItem = useMemo(() => {
    if (!lecture) return null;
    return cartItems.find((item) => item.key === cartKey(lecture.name, selectedDate)) ?? null;
  }, [cartItems, lecture, selectedDate]);

  const otherLectureBusyTimes = useMemo(() => {
    if (!lecture) return [];

    const busy = new Set<string>();
    const currentKey = cartKey(lecture.name, selectedDate);
    const cartByKey = new Map(cartItems.map((item) => [item.key, item]));

    for (const reservation of myReservations) {
      if (reservation.res_date !== selectedDate || reservation.lecture === lecture.name) continue;

      const key = cartKey(reservation.lecture, reservation.res_date);
      if (!cartByKey.has(key)) busy.add(reservation.res_time);
    }

    for (const item of cartItems) {
      if (item.date !== selectedDate || item.key === currentKey) continue;
      for (const time of item.times) busy.add(time);
    }

    return [...busy].sort();
  }, [cartItems, lecture, myReservations, selectedDate]);

  
  useEffect(() => {
    setDesiredTimes(currentCartItem?.times ?? myTimes);
  }, [currentCartItem, myTimes]);


  useEffect(() => {
    if (screen !== "detail") return;

    setDesiredTimes((prev) => {
      const next = prev.filter((time) => myTimes.includes(time) || !reservedTimes.includes(time));
      return next.length === prev.length ? prev : next;
    });
  }, [screen, myTimes, reservedTimes]);

  const toAdd = useMemo(
    () => desiredTimes.filter((t) => !myTimes.includes(t)),
    [desiredTimes, myTimes],
  );
  const toRemove = useMemo(
    () => myTimes.filter((t) => !desiredTimes.includes(t)),
    [desiredTimes, myTimes],
  );
  const isDirty = toAdd.length > 0 || toRemove.length > 0;

  const handleSelectDate = async (date: string) => {
    if (!isReservableDate(date)) {
      showToast("오늘부터 3주 이내 날짜만 예약할 수 있어요.", "error");
      return;
    }

    if (date === selectedDate) return;

    if (lecture) {
      const currentKey = cartKey(lecture.name, selectedDate);
      const hasCurrentCartItem = !!currentCartItem;
      const selectionMatchesServer = sameTimes(desiredTimes, myTimes);
      const selectionMatchesCart = !!currentCartItem && sameTimes(desiredTimes, currentCartItem.times);
      const hasUncommittedSelection = hasCurrentCartItem
        ? !selectionMatchesCart
        : !selectionMatchesServer;

      if (hasUncommittedSelection) {
        const listLabel = toRemove.length > 0 ? "변경 목록" : "예약 목록";
        const shouldApply = await askConfirm(
          `현재 선택을 ${listLabel}에 반영하지 않고 날짜를 이동하면 변경사항이 사라집니다.`,
          {
            title: "변경사항이 반영되지 않았습니다",
            cancelLabel: "반영하지 않고 이동",
            confirmLabel: "목록에 반영",
          },
        );

        if (shouldApply) {
          if (hasCurrentCartItem && selectionMatchesServer) {
            setCartItems((prev) => prev.filter((item) => item.key !== currentKey));
          } else {
            const item = currentCartItemForSelection();
            if (!item) return;

            setCartItems((prev) => {
              const rest = prev.filter((existing) => existing.key !== item.key);
              return [...rest, item].sort(
                (a, b) => a.date.localeCompare(b.date) || a.lecture.localeCompare(b.lecture),
              );
            });
          }
        }
      }
    }

    setSelectedDate(date);
    // desiredTimes는 위 useEffect가 새 날짜의 myTimes로 다시 맞춘다
  };

  // ── 시간 선택 (규칙은 RPC에도 있 여긴 즉시 피드백용) ────────────────────
  const toggleTime = (time: string) => {
  
    if (desiredTimes.includes(time)) {
      setDesiredTimes((prev) => prev.filter((t) => t !== time));
      return;
    }

    if (otherLectureBusyTimes.includes(time)) {
      showToast("같은 시간에 다른 강의가 예약되어 있습니다.", "error");
      return;
    }


    const currentKey = lecture ? cartKey(lecture.name, selectedDate) : "";
    const cartByKey = new Map(cartItems.map((item) => [item.key, item]));
    const existingDayTimes = myReservations
      .filter((r) => {
        if (r.res_date !== selectedDate) return false;
        const key = cartKey(r.lecture, r.res_date);
        return key !== currentKey && !cartByKey.has(key);
      })
      .map((r) => r.res_time);
    const otherCartDayTimes = cartItems
      .filter((item) => item.date === selectedDate && item.key !== currentKey)
      .flatMap((item) => item.times);
    const existingUntouchedWeeklyCount = myReservations.filter((r) => {
      if (!isSameWeek(r.res_date, selectedDate)) return false;
      if (r.lecture !== lecture?.name) return false;
      const key = cartKey(r.lecture, r.res_date);
      return key !== currentKey && !cartByKey.has(key);
    }).length;
    const otherCartWeeklyCount = cartItems
      .filter(
        (item) =>
          item.lecture === lecture?.name &&
          isSameWeek(item.date, selectedDate) &&
          item.key !== currentKey,
      )
      .reduce((sum, item) => sum + item.times.length, 0);
    const nextDesiredTimes = [...desiredTimes, time].sort(compareTimes);
    const nextDayTimes = [...existingDayTimes, ...otherCartDayTimes, ...nextDesiredTimes];

    if (maxContinuous(nextDayTimes) > CONTINUOUS_SLOT_LIMIT) {
      showToast(`연속 예약은 최대 ${durationLabel(CONTINUOUS_SLOT_LIMIT)}까지 가능합니다.`, "error");
      return;
    }

    if (existingUntouchedWeeklyCount + otherCartWeeklyCount + nextDesiredTimes.length > WEEKLY_SLOT_LIMIT) {
      showToast(`강의별 일주일 예약은 최대 ${durationLabel(WEEKLY_SLOT_LIMIT)}까지 가능합니다.`, "error");
      return;
    }

    setDesiredTimes(nextDesiredTimes);
  };

  const currentCartItemForSelection = (): ReservationCartItem | null => {
    if (!lecture || !isDirty) return null;
    if (!isReservableDate(selectedDate)) {
      showToast("오늘부터 3주 이내 날짜만 예약할 수 있어요.", "error");
      return null;
    }

    const currentKey = cartKey(lecture.name, selectedDate);
    const cartByKey = new Map(cartItems.map((item) => [item.key, item]));
    const existingDayTimes = myReservations
      .filter((r) => {
      if (r.res_date !== selectedDate) return false;
      const key = cartKey(r.lecture, r.res_date);
      return key !== currentKey && !cartByKey.has(key);
      })
      .map((r) => r.res_time);
    const otherCartDayTimes = cartItems
      .filter((item) => item.date === selectedDate && item.key !== currentKey)
      .flatMap((item) => item.times);
    const existingUntouchedWeeklyCount = myReservations.filter((r) => {
      if (!isSameWeek(r.res_date, selectedDate)) return false;
      if (r.lecture !== lecture.name) return false;
      const key = cartKey(r.lecture, r.res_date);
      return key !== currentKey && !cartByKey.has(key);
    }).length;
    const otherCartWeeklyCount = cartItems
      .filter(
        (item) =>
          item.lecture === lecture.name &&
          isSameWeek(item.date, selectedDate) &&
          item.key !== currentKey,
      )
      .reduce((sum, item) => sum + item.times.length, 0);

    if (maxContinuous([...existingDayTimes, ...otherCartDayTimes, ...desiredTimes]) > CONTINUOUS_SLOT_LIMIT) {
      showToast(`연속 예약은 최대 ${durationLabel(CONTINUOUS_SLOT_LIMIT)}까지 가능합니다.`, "error");
      return null;
    }

    if (existingUntouchedWeeklyCount + otherCartWeeklyCount + desiredTimes.length > WEEKLY_SLOT_LIMIT) {
      showToast(`강의별 일주일 예약은 최대 ${durationLabel(WEEKLY_SLOT_LIMIT)}까지 가능합니다.`, "error");
      return null;
    }

    const conflictingTimes = desiredTimes.filter(
      (time) => otherLectureBusyTimes.includes(time) && !myTimes.includes(time),
    );
    if (conflictingTimes.length > 0) {
      showToast(`같은 시간에 다른 강의가 예약되어 있습니다: ${conflictingTimes.join(", ")}`, "error");
      return null;
    }

    return {
      key: cartKey(lecture.name, selectedDate),
      lecture: lecture.name,
      date: selectedDate,
      times: [...desiredTimes].sort(compareTimes),
      addTimes: [...toAdd].sort(compareTimes),
      removeTimes: [...toRemove].sort(compareTimes),
    };
  };

  const addToCart = () => {
    const item = currentCartItemForSelection();
    if (!item) return;
    const replacing = cartItems.some((existing) => existing.key === item.key);

    setCartItems((prev) => {
      const rest = prev.filter((existing) => existing.key !== item.key);
      return [...rest, item].sort(
        (a, b) => a.date.localeCompare(b.date) || a.lecture.localeCompare(b.lecture),
      );
    });
    const listLabel = item.removeTimes.length > 0 ? "변경 목록" : "예약 목록";
    showToast(replacing ? `${listLabel}에 반영되었습니다.` : `${listLabel}에 담았습니다.`, "success");
  };

  const removeCartItem = (key: string) => {
    setCartItems((prev) => prev.filter((item) => item.key !== key));
  };

  const buildBookingItem = async (
    lectureName: string,
    date: string,
    finalTimes: string[],
    addTimes: string[],
    removeTimes: string[],
  ): Promise<BookingItem> => {
    let account = null;
    let accountError = null;
    try {
      account = await api.getLectureAccount(lectureName, date);
    } catch (err) {
      accountError = messageFor(err, "계정 정보를 불러오지 못했습니다.");
    }

    return {
      lecture: lectureName,
      date,
      finalTimes,
      addTimes,
      removeTimes,
      account,
      accountError,
    };
  };

  const submitCart = async () => {
    if (!initialized) return;

    const items = [...cartItems];

    if (items.length === 0) return;
    const outOfRangeItem = items.find((item) => !isReservableDate(item.date));
    if (outOfRangeItem) {
      showToast(`${dateLabel(outOfRangeItem.date)} 예약은 오늘부터 3주 이내 날짜만 가능해요.`, "error");
      return;
    }
    const hasAdditions = items.some((item) => item.addTimes.length > 0);
    const hasRemovals = items.some((item) => item.removeTimes.length > 0);
    const confirmCopy = hasAdditions
      ? hasRemovals
        ? {
            title: "예약 변경",
            message: `${items.length}개 예약 변경을 진행하시겠습니까?`,
            confirmLabel: "변경하기",
            tone: "default" as const,
          }
        : {
            title: "예약 확정",
            message: `${items.length}개 예약을 확정하시겠습니까?`,
            confirmLabel: "확정",
            tone: "default" as const,
          }
      : {
          title: "예약 취소",
          message: `${items.length}개 예약 취소를 진행하시겠습니까?`,
          confirmLabel: "취소하기",
          tone: "danger" as const,
        };

    if (
      !(await askConfirm(confirmCopy.message, {
        title: confirmCopy.title,
        confirmLabel: confirmCopy.confirmLabel,
        tone: confirmCopy.tone,
      }))
    ) {
      return;
    }

    setLoading(true);
    try {
      await api.saveReservationCart(items);

      await refreshMine();
      if (lecture) await refreshReservedSlots(lecture.name, selectedDate);

      const bookingItems = await Promise.all(
        items.map((item) =>
          buildBookingItem(item.lecture, item.date, item.times, item.addTimes, item.removeTimes),
        ),
      );
      const first = bookingItems[0];
      setCartItems([]);
      setBooking({ ...first, items: bookingItems });
      go("confirm", "replace");
    } catch (err) {
      const listLabel = hasRemovals ? "변경 목록" : "예약 목록";
      showToast(messageFor(err, `${listLabel} 처리 중 오류가 발생했습니다.`), "error");
      if (lecture) {
        try {
          setReservedTimes(await api.getReservedSlots(lecture.name, selectedDate));
        } catch {
          /* 갱신 실패는 조용히 넘긴다 — 이미 위에서 알렸다 */
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // ── 취소
  const handleCancel = async (ids: number[], confirmMessage = "선택하신 예약을 취소하시겠습니까?") => {
    if (!initialized || ids.length === 0) return false;
    if (
      !(await askConfirm(confirmMessage, {
        title: "예약 취소",
        confirmLabel: "취소하기",
        tone: "danger",
      }))
    ) {
      return false;
    }

    setLoading(true);
    try {
      const deleted = await api.cancelReservations(ids);
      if (deleted === 0) showToast("취소된 예약이 없습니다. 목록을 새로고침합니다.", "info");
      else showToast("선택하신 예약이 취소되었습니다.", "success");
      await refreshMine();
      return true;
    } catch (err) {
      showToast(messageFor(err, "취소 중 오류가 발생했습니다."), "error");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const { upcoming, past } = useMemo(
    () => splitByTime(groupReservations(myReservations)),
    [myReservations],
  );

  const windowReservations = useMemo(
    () => groupReservations(myReservations).filter((g) => isReservableDate(g.res_date)),
    [myReservations],
  );

  const weeklyRemaining = useMemo(() => {
    if (!lecture) return [];
    const weeks: { weekStart: string; label: string; remaining: number }[] = [];
    const lastWeekStart = weekStartStr(maxReservationDateStr());
    let ws = weekStartStr(todayStr());
    while (ws <= lastWeekStart) {
      const weekEnd = addDaysToDateStr(ws, 6);
      const used = myReservations.filter(
        (r) => r.lecture === lecture.name && r.res_date >= ws && r.res_date <= weekEnd,
      ).length;
      weeks.push({
        weekStart: ws,
        label: weekOfMonthLabel(ws),
        remaining: Math.max(0, WEEKLY_SLOT_LIMIT - used),
      });
      ws = addDaysToDateStr(ws, 7);
    }
    return weeks;
  }, [myReservations, lecture]);

  useEffect(() => {
    if (screen !== "my" || !initialized || upcoming.length === 0) {
      setAccountByLecture({});
      return;
    }

    const firstReservationByLecture = new Map<string, Reservation>();
    for (const group of upcoming) {
      if (!firstReservationByLecture.has(group.lecture)) {
        firstReservationByLecture.set(group.lecture, {
          id: group.ids[0],
          lecture: group.lecture,
          res_date: group.res_date,
          res_time: group.times[0],
        });
      }
    }

    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        [...firstReservationByLecture.values()].map(async (reservation) => {
          try {
            const account = await api.getLectureAccount(
              reservation.lecture,
              reservation.res_date,
            );
            return [reservation.lecture, { account, error: null }] as const;
          } catch (err) {
            return [
              reservation.lecture,
              {
                account: null,
                error: messageFor(err, "계정 정보를 불러오지 못했습니다."),
              },
            ] as const;
          }
        }),
      );

      if (!cancelled) setAccountByLecture(Object.fromEntries(entries));
    })();

    return () => {
      cancelled = true;
    };
  }, [screen, initialized, upcoming]);

  const sortedLectures = useMemo(
    () => [...lectures].sort((a, b) => Number(b.enrolled) - Number(a.enrolled)),
    [lectures],
  );

  return (
    <div>
      {screen === "auth" && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-5 text-center">
          <p className="text-sm font-semibold text-hint">
            {loading ? "확인 중…" : initializationError}
          </p>
          {!loading && initializationError && (
            <button
              type="button"
              onClick={() => void initialize()}
              className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-bold text-white hover:bg-brand"
            >
              다시 시도
            </button>
          )}
        </div>
      )}

      {screen === "main" && (
        <MainScreen
          lectures={sortedLectures}
          upcoming={upcoming}
          onOpenLecture={openLecture}
          onGoMy={goMy}
          tabs={tabs}
        />
      )}

      {screen === "detail" && lecture && (
        <DetailScreen
          lecture={lecture}
          selectedDate={selectedDate}
          desiredTimes={desiredTimes}
          reservedTimes={reservedTimes}
          myTimes={myTimes}
          otherLectureBusyTimes={otherLectureBusyTimes}
          toAdd={toAdd}
          toRemove={toRemove}
          cartItems={cartItems}
          windowReservations={windowReservations}
          weeklyRemaining={weeklyRemaining}
          loading={loading}
          onSelectDate={handleSelectDate}
          onToggleTime={toggleTime}
          onAddToCart={addToCart}
          onRemoveCartItem={removeCartItem}
          onSubmitCart={submitCart}
          onBack={goMain}
        />
      )}

      {screen === "confirm" && booking && (
        <ConfirmScreen booking={booking} onGoMain={goMain} onGoMy={goMy} />
      )}

      {screen === "my" && (
        <MyScreen
          upcoming={upcoming}
          past={past}
          accountByLecture={accountByLecture}
          loading={loading}
          onCancel={handleCancel}
          onGoMain={goMain}
        />
      )}

      {toast && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className="fixed top-5 left-1/2 z-50 max-w-[calc(100vw-32px)] -translate-x-1/2"
        >
          <div
            className={`w-[min(360px,calc(100vw-32px))] rounded-xl border bg-white px-4 py-3 text-[13.5px] shadow-[0_18px_50px_rgba(22,30,46,0.16)] ${
              toast.tone === "success"
                ? "border-brand-line font-medium text-brand-dark"
                : toast.tone === "error"
                  ? "border-danger-line font-bold text-danger"
                  : "border-line font-bold text-ink-2"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {confirmDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="w-full max-w-[390px] rounded-2xl border border-line bg-white p-5 shadow-[0_24px_70px_rgba(16,24,40,0.24)]">
            <h2 id="confirm-title" className="mb-2 text-[17px] font-extrabold tracking-[-0.4px] text-ink">
              {confirmDialog.title}
            </h2>
            <p className="whitespace-pre-line text-[14px] leading-relaxed font-semibold text-ink-3">
              {confirmDialog.message}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => closeConfirm(false)}
                className="cursor-pointer rounded-xl border border-line-input bg-white px-4 py-2.5 text-[13.5px] font-bold text-ink-3 hover:border-line"
              >
                {confirmDialog.cancelLabel}
              </button>
              <button
                onClick={() => closeConfirm(true)}
                className={`cursor-pointer rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-white ${
                  confirmDialog.tone === "danger"
                    ? "bg-danger hover:bg-[#c93b3b]"
                    : "bg-brand-dark hover:bg-brand"
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
