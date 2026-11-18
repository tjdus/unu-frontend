"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Lecture, ReservationGroup } from "@/lib/online-lecture/types";
import { durationLabel, shortDateLabel, timeRangeLabel } from "@/lib/online-lecture/date";
import styles from "./booking.module.css";

interface Props {
  lectures: Lecture[];
  upcoming: ReservationGroup[];
  onOpenLecture: (lecture: Lecture) => void;
  onGoMy: () => void;
  tabs?: ReactNode;
}

const RULES = [
  "30분 단위로 예약할 수 있어요.",
  "강의당 일주일에 최대 4시간 예약할 수 있어요.",
  "한 번에 최대 2시간까지 연속 예약할 수 있어요.",
  "오늘부터 3주 이내 날짜를 예약할 수 있어요.",
];

export default function MainScreen({ lectures, upcoming, onOpenLecture, onGoMy, tabs }: Props) {
  const previewReservations = upcoming.slice(0, 2);
  const extraDates = new Set(upcoming.slice(2).map((item) => item.res_date)).size;

  return (
    <div>
      <header className={styles.heading}>
        <h1>인강 예약</h1>
        <p>신청한 강의의 수강 시간을 예약하고 내 예약을 확인하세요.</p>
      </header>
      {tabs}
      <div className={styles.listing}>
        <section aria-labelledby="reservable-lectures">
          <h2 id="reservable-lectures" className={styles.sectionTitle}>강의 목록</h2>
          {lectures.length === 0 && <p className={`${styles.small} py-6`}>등록된 강의가 없습니다.</p>}
          {lectures.map((course) => (
            <div key={course.id} className={styles.courseRow}>
              <div className="space-y-1">
                <h3>{course.name}</h3>
                {(course.category || course.level) && <p className={styles.small}>{[course.category, course.level].filter(Boolean).join(" · ")}</p>}
                {course.description && <p className={`${styles.small} line-clamp-1`}>{course.description}</p>}
              </div>
              {course.enrolled ? (
                <Button type="button" variant="link" size="sm" onClick={() => onOpenLecture(course)} aria-label={`${course.name} 예약하기`}>예약하기 <ArrowRight size={14} /></Button>
              ) : <span className={styles.small}>미신청</span>}
            </div>
          ))}
        </section>
        <aside className={styles.rail}>
          <section className={styles.panel}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2>예약 요약</h2>
              <button type="button" className="inline-flex items-center gap-1 py-1 text-sm text-brand-dark hover:underline" onClick={onGoMy}>내 예약 <ArrowRight size={14} /></button>
            </div>
            {previewReservations.length === 0 ? <p className={`${styles.small} mt-3`}>예정된 예약이 없습니다.</p> : (
              <ul className="mt-2 divide-y divide-line-divider">
                {previewReservations.map((item) => (
                  <li key={item.key} className="space-y-1 py-2.5">
                    <p className="wrap-anywhere text-sm font-semibold">{item.lecture}</p>
                    <p className={styles.small}>{shortDateLabel(item.res_date)} · {timeRangeLabel(item.times)} · {durationLabel(item.times.length)}</p>
                  </li>
                ))}
              </ul>
            )}
            {extraDates > 0 && <p className={`${styles.small} border-t border-line-divider pt-2`}>그 외 {extraDates}개 날짜의 예약이 더 있어요.</p>}
          </section>
          <section className={styles.panel}>
            <h2>예약 정책</h2>
            <ul className={`${styles.small} mt-3 list-disc space-y-2 pl-4`}>
              {RULES.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
