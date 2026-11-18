"use client";

import { ArrowLeft } from "lucide-react";
import type { Lecture, ReservationCartItem, ReservationGroup } from "@/lib/online-lecture/types";
import { TIME_SLOTS, dateLabel, durationLabel, minutesOf, shortDateLabel, timeRangeLabel, todayStr, weekStartStr } from "@/lib/online-lecture/date";
import Calendar from "./Calendar";
import styles from "./booking.module.css";

interface Props {
  lecture: Lecture;
  selectedDate: string;
  desiredTimes: string[];
  reservedTimes: string[];
  myTimes: string[];
  /** 같은 날짜에 다른 강의로 이미 잡혀 있거나 예약 목록에 담긴 시간 */
  otherLectureBusyTimes: string[];

  toAdd: string[];
  toRemove: string[];

  cartItems: ReservationCartItem[];
  windowReservations: ReservationGroup[];
  weeklyRemaining: { weekStart: string; label: string; remaining: number }[];
  loading: boolean;
  onSelectDate: (date: string) => void;
  onToggleTime: (time: string) => void;
  onAddToCart: () => void;
  onRemoveCartItem: (key: string) => void;
  onSubmitCart: () => void;
  onBack: () => void;
}

function sameTimes(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((time, index) => time === right[index]);
}

export default function DetailScreen({
  lecture,
  selectedDate,
  desiredTimes,
  reservedTimes,
  myTimes,
  otherLectureBusyTimes,
  toAdd,
  toRemove,
  cartItems,
  windowReservations,
  weeklyRemaining,
  loading,
  onSelectDate,
  onToggleTime,
  onAddToCart,
  onRemoveCartItem,
  onSubmitCart,
  onBack,
}: Props) {
  const isToday = selectedDate === todayStr();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const isDirty = toAdd.length > 0 || toRemove.length > 0;
  const cartListLabel =
    toRemove.length > 0 || cartItems.some((item) => item.removeTimes.length > 0)
      ? "변경 목록"
      : "예약 목록";
  const currentCartItem =
    cartItems.find((item) => item.lecture === lecture.name && item.date === selectedDate) ?? null;
  const selectionMatchesServer = sameTimes(desiredTimes, myTimes);
  const selectionMatchesCart = !!currentCartItem && sameTimes(desiredTimes, currentCartItem.times);
  const shouldRemoveCurrentCart =
    !!currentCartItem && selectionMatchesServer && !selectionMatchesCart;
  const hasPendingSelection =
    shouldRemoveCurrentCart || (!currentCartItem && !selectionMatchesServer) || (!!currentCartItem && !selectionMatchesCart);
  const canSubmitCart = cartItems.length > 0 && !loading;
  const canPutSelection = hasPendingSelection && !loading;
  const canPrimary = (canPutSelection || canSubmitCart) && !loading;
  const primaryLabel = loading
    ? "처리 중…"
    : canPutSelection
      ? shouldRemoveCurrentCart
        ? `${cartListLabel}에서 제거`
        : currentCartItem
        ? `${cartListLabel}에 반영`
        : `${cartListLabel}에 담기`
      : `${cartListLabel} 확정`;

  const handlePrimary = () => {
    if (shouldRemoveCurrentCart && currentCartItem) {
      onRemoveCartItem(currentCartItem.key);
      return;
    }
    if (canPutSelection) {
      onAddToCart();
      return;
    }
    onSubmitCart();
  };

  const remaining = weeklyRemaining.find((week) => week.weekStart === weekStartStr(selectedDate));

  return (
    <div>
      <button type="button" onClick={onBack} className={styles.back}>
        <ArrowLeft size={16} /> 강의 목록으로
      </button>
      <header className={styles.heading}>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <h1 className="min-w-0 flex-1 basis-[16rem]">{lecture.name}</h1>
          {remaining && (
            <p className="pt-1">
              선택한 주 남은 시간 <strong className="ml-1 font-semibold text-brand-dark">{durationLabel(remaining.remaining)}</strong>
            </p>
          )}
        </div>
        {(lecture.category || lecture.level) && <p>{[lecture.category, lecture.level].filter(Boolean).join(" · ")}</p>}
        {lecture.description && <p className="max-w-[680px] whitespace-pre-line">{lecture.description}</p>}
      </header>

      <ul className={styles.rules}>
        <li>30분 단위</li>
        <li>강의당 주 최대 4시간</li>
        <li>연속 최대 2시간</li>
        <li>오늘부터 3주 이내</li>
      </ul>

      <div className={styles.schedule}>
        <Calendar selected={selectedDate} onSelect={onSelectDate} />
        <section className="min-w-0" aria-labelledby="lecture-time-heading">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="lecture-time-heading" className={styles.sectionTitle}>시간대 선택</h2>
            <span className={styles.small}>{dateLabel(selectedDate)}</span>
          </div>
          <div className={styles.timeGrid}>
            {TIME_SLOTS.map((time) => {
              const mine = myTimes.includes(time);
              const taken = reservedTimes.includes(time) && !mine;
              const otherBusy = otherLectureBusyTimes.includes(time);
              const past = isToday && minutesOf(time) <= currentMinutes;
              const wanted = desiredTimes.includes(time);
              const conflict = otherBusy && wanted && !mine;
              const disabled = taken || (otherBusy && !wanted) || past;
              const [variant, status] = past
                ? [mine ? styles.owned : styles.unavailable, mine ? "내 지난 예약" : "지난 시간"]
                : taken
                  ? [styles.unavailable, "예약됨"]
                  : conflict
                    ? [styles.change, "시간 중복"]
                    : otherBusy
                      ? [styles.unavailable, "다른 강의 예약"]
                      : mine && !wanted
                        ? [styles.change, "취소 예정"]
                        : mine
                          ? [styles.owned, "내 예약"]
                          : wanted
                            ? [styles.selected, "추가"]
                            : [styles.available, "예약 가능"];
              return (
                <button
                  type="button"
                  key={time}
                  disabled={disabled}
                  aria-label={`${time} ${status}`}
                  aria-pressed={wanted}
                  onClick={() => onToggleTime(time)}
                  className={`${styles.timeSlot} ${variant}`}
                >
                  <span>{time}</span>
                  {!disabled && status !== "예약 가능" && <span aria-hidden className={styles.slotStatus}>{status}</span>}
                </button>
              );
            })}
          </div>
          <p className={`${styles.small} mt-2`}>회색 시간대는 선택할 수 없습니다.</p>
        </section>
      </div>

        <section className={`${styles.panel} mt-6`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-0.5 text-xs font-semibold text-faint">
                  {shouldRemoveCurrentCart
                    ? "현재 선택이 원래 예약 상태입니다"
                    : hasPendingSelection
                      ? currentCartItem
                    ? `현재 선택이 ${cartListLabel}과 다릅니다`
                    : `현재 선택이 아직 ${cartListLabel}에 없습니다`
                  : selectionMatchesCart
                    ? `${cartListLabel}에 담긴 선택`
                : isDirty
                  ? `${dateLabel(selectedDate)} · 저장 후 ${durationLabel(desiredTimes.length)}`
                  : cartItems.length > 0
                    ? `${cartListLabel} · ${cartItems.length}개 항목`
                    : "선택한 예약"}
              </div>
              <div className="wrap-anywhere text-[15px] font-semibold text-ink">
                {shouldRemoveCurrentCart ? (
                  `${dateLabel(selectedDate)} · 변경 사항이 없습니다 · 목록에서 제거해주세요`
                ) : hasPendingSelection ? (
                  <span className="flex flex-wrap gap-x-2">
                    <span>{dateLabel(selectedDate)}</span>
                    {toAdd.length > 0 && (
                      <span className="text-brand-dark">+{timeRangeLabel(toAdd)}</span>
                    )}
                    {toRemove.length > 0 && (
                      <span className="text-danger">−{timeRangeLabel(toRemove)}</span>
                    )}
                    <span className="text-hint">목록에 반영해주세요</span>
                  </span>
                ) : selectionMatchesCart ? (
                  <span className="flex flex-wrap gap-x-2">
                    <span>{dateLabel(selectedDate)}</span>
                    {currentCartItem.addTimes.length > 0 && (
                      <span className="text-brand-dark">+{timeRangeLabel(currentCartItem.addTimes)}</span>
                    )}
                    {currentCartItem.removeTimes.length > 0 && (
                      <span className="text-danger">−{timeRangeLabel(currentCartItem.removeTimes)}</span>
                    )}
                    <span className="text-hint">목록에 담김</span>
                  </span>
                ) : !isDirty ? (
                  cartItems.length > 0
                    ? `${durationLabel(
                        cartItems.reduce(
                          (sum, item) => sum + item.addTimes.length + item.removeTimes.length,
                          0,
                        ),
                      )} 변경 대기 중`
                    : myTimes.length > 0
                    ? `${dateLabel(selectedDate)} · ${myTimes.join(", ")} · ${durationLabel(myTimes.length)} 예약 중`
                    : "시간대를 선택해 주세요"
                ) : (
                  <span className="flex flex-wrap gap-x-2">
                    {toAdd.length > 0 && (
                      <span className="text-brand-dark">+{durationLabel(toAdd.length)} 추가</span>
                    )}
                    {toRemove.length > 0 && (
                      <span className="text-danger">−{durationLabel(toRemove.length)} 취소</span>
                    )}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={handlePrimary}
                disabled={!canPrimary}
                className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                  canPrimary
                    ? "cursor-pointer bg-brand-dark text-white hover:bg-brand"
                    : "cursor-not-allowed bg-[#e4e7ee] text-[#8b93a3]"
                }`}
              >
                {primaryLabel}
              </button>
            </div>
          </div>
        </section>

        {cartItems.length > 0 && (
          <section className={`${styles.quietSection} mt-5`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[15px] font-bold tracking-[-0.3px]">{cartListLabel}</h2>
              <span className="text-[12px] font-bold text-hint">
                {durationLabel(
                  cartItems.reduce(
                    (sum, item) => sum + item.addTimes.length + item.removeTimes.length,
                    0,
                  ),
                )} 변경 대기 중
              </span>
            </div>
            <div className="flex flex-col divide-y divide-line-divider">
              {cartItems.map((item) => (
                <div key={item.key} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-ink">{item.lecture}</div>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[12.5px] font-semibold text-faint">
                      <span>{dateLabel(item.date)}</span>
                      {item.addTimes.length > 0 && (
                        <span className="text-brand-dark">
                          +{timeRangeLabel(item.addTimes)} · {durationLabel(item.addTimes.length)} 추가
                        </span>
                      )}
                      {item.removeTimes.length > 0 && (
                        <span className="text-danger">
                          −{timeRangeLabel(item.removeTimes)} · {durationLabel(item.removeTimes.length)} 취소
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveCartItem(item.key)}
                    disabled={loading}
                    className="cursor-pointer rounded-[10px] border border-line-input bg-white px-3 py-2 text-[12.5px] font-bold whitespace-nowrap text-ink-3 hover:border-danger-line hover:text-danger disabled:opacity-50"
                  >
                    목록에서 제거
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      {windowReservations.length > 0 && (
        <details className={`${styles.quietSection} mt-6`}>
          <summary className="cursor-pointer text-sm font-medium">예약 가능 기간 내 내 예약</summary>
          <ul className="mt-3 divide-y divide-line-divider">
            {windowReservations.map((group) => (
              <li key={group.key} className="wrap-anywhere py-2 text-sm">
                {shortDateLabel(group.res_date)} · {group.lecture} · {timeRangeLabel(group.times)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
