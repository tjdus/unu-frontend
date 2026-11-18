"use client";

import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Booking, BookingItem } from "@/lib/online-lecture/types";
import { dateLabel, durationLabel, timeRangeLabel } from "@/lib/online-lecture/date";
import CourseAccount from "./CourseAccount";
import styles from "./booking.module.css";

interface Props {
  booking: Booking;
  onGoMain: () => void;
  onGoMy: () => void;
}

export default function ConfirmScreen({ booking, onGoMain, onGoMy }: Props) {
  const items = booking.items ?? [booking];
  const hasAdditions = items.some((item) => item.addTimes.length > 0);
  const hasRemovals = items.some((item) => item.removeTimes.length > 0);
  const status = hasAdditions ? (hasRemovals ? "변경" : "예약") : "취소";
  const title = status === "변경" ? "예약이 변경되었습니다" : status === "취소" ? "예약이 취소되었습니다" : "예약이 완료되었습니다";
  const sections = new Map<string, BookingItem[]>();
  for (const item of items) {
    const group = sections.get(item.lecture) ?? [];
    group.push(item);
    sections.set(item.lecture, group);
  }
  const total = items.filter((item) => item.addTimes.length > 0).reduce((sum, item) => sum + item.finalTimes.length, 0);

  return (
    <div>
      <button type="button" onClick={onGoMain} className={styles.back}><ArrowLeft size={16} /> 강의 목록으로</button>
      <header className={styles.heading}>
        <h1>{title}</h1>
        <p>{hasAdditions ? "예약 시간과 수강 계정 정보를 확인해 주세요." : "남은 예약은 내 예약에서 확인할 수 있어요."}</p>
      </header>
      <div className={`${styles.result} space-y-7`}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand-dark">
          <Check size={15} /> {status} 완료
        </span>
        {[...sections].map(([lecture, entries]) => {
          const additions = entries.filter((entry) => entry.addTimes.length > 0);
          const account = additions.find((entry) => entry.account) ?? additions[0];
          return (
            <section key={lecture} className="grid gap-3">
              <h2 className={`${styles.sectionTitle} wrap-anywhere`}>{lecture}</h2>
              <table className={styles.table}>
                <colgroup><col className="w-[32%]" /><col /><col className="w-[22%]" /></colgroup>
                <thead><tr><th scope="col">날짜</th><th scope="col">{hasRemovals ? "시간 및 변동사항" : "시간"}</th><th scope="col">이용 시간</th></tr></thead>
                <tbody>
                  {entries.map((item) => (
                    <tr key={item.date}>
                      <td>{dateLabel(item.date)}</td>
                      <td className="space-y-1">
                        {item.addTimes.length > 0 && <p>{timeRangeLabel(item.finalTimes)}</p>}
                        {hasRemovals && item.addTimes.length > 0 && <p className="text-xs text-brand-dark">+ {timeRangeLabel(item.addTimes)} 추가</p>}
                        {item.removeTimes.length > 0 && <p className="text-xs text-danger">{timeRangeLabel(item.removeTimes)} 취소</p>}
                      </td>
                      <td>{item.addTimes.length > 0 ? durationLabel(item.finalTimes.length) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {account && <CourseAccount account={account.account} error={account.accountError} />}
            </section>
          );
        })}
        {hasAdditions && <p className="text-sm">총 예약 시간 <strong className="ml-2 text-brand-dark">{durationLabel(total)}</strong></p>}
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={onGoMy}>내 예약 보기</Button>
          <Button type="button" variant="outline" onClick={onGoMain}>다른 강의 예약</Button>
        </div>
      </div>
    </div>
  );
}
