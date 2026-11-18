"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import CourseAccount from "./CourseAccount";
import styles from "./booking.module.css";
import type { LectureAccountStatus, ReservationGroup } from "@/lib/online-lecture/types";
import { compareTimes, dateLabel, durationLabel, timePointLabel, timeRangeLabel } from "@/lib/online-lecture/date";

interface Props {
  upcoming: ReservationGroup[];
  past: ReservationGroup[];
  accountByLecture: Record<string, LectureAccountStatus>;
  loading: boolean;
  onCancel: (ids: number[], confirmMessage: string) => Promise<boolean>;
  onGoMain: () => void;
}

interface LectureReservationGroup {
  lecture: string;
  groups: ReservationGroup[];
  totalSlots: number;
}

function groupByLecture(groups: ReservationGroup[]): LectureReservationGroup[] {
  const map = new Map<string, ReservationGroup[]>();

  for (const group of groups) {
    const lectureGroups = map.get(group.lecture) ?? [];
    lectureGroups.push(group);
    map.set(group.lecture, lectureGroups);
  }

  return [...map.entries()].map(([lecture, lectureGroups]) => ({
    lecture,
    groups: lectureGroups,
    totalSlots: lectureGroups.reduce((sum, group) => sum + group.times.length, 0),
  }));
}

function compactDateLabel(date: string): string {
  return dateLabel(date).replace(/\s*\(.\)$/, "");
}

function selectedCancelMessage(groups: ReservationGroup[], ids: number[]): string {
  const selected = new Set(ids);
  const targets = groups
    .map((group) => {
      const times = group.times
        .filter((_, index) => selected.has(group.ids[index]))
        .sort(compareTimes);

      return { date: compactDateLabel(group.res_date), times };
    })
    .filter((target) => target.times.length > 0);

  if (targets.length === 1) {
    const target = targets[0];
    return `${target.date}의 ${target.times.map(timePointLabel).join(", ")} 예약을 취소하시겠습니까?`;
  }

  return [
    "선택한 예약을 취소하시겠습니까?",
    ...targets.map(
      (target) => `${target.date}: ${target.times.map(timePointLabel).join(", ")}`,
    ),
  ].join("\n");
}

export default function MyScreen({
  upcoming,
  past,
  accountByLecture,
  loading,
  onCancel,
  onGoMain,
}: Props) {
  // 시간 단위로 취소 대상을 고른 뒤, 카드 상단에서 한 번에 취소한다.
  const [checked, setChecked] = useState<number[]>([]);
  const upcomingByLecture = useMemo(() => groupByLecture(upcoming), [upcoming]);
  const pastByLecture = useMemo(() => groupByLecture(past), [past]);

  const toggle = (id: number) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleGroup = (g: ReservationGroup) => {
    setChecked((prev) => {
      const selected = new Set(prev);
      const allSelected = g.ids.every((id) => selected.has(id));

      if (allSelected) {
        return prev.filter((id) => !g.ids.includes(id));
      }

      for (const id of g.ids) selected.add(id);
      return [...selected];
    });
  };

  const cancelIds = async (ids: number[], confirmMessage: string) => {
    if (ids.length === 0) return;
    const didCancel = await onCancel(ids, confirmMessage);
    if (didCancel) setChecked((prev) => prev.filter((id) => !ids.includes(id)));
  };

  return (
    <div>
      <button type="button" onClick={onGoMain} className={styles.back}><ArrowLeft size={16} /> 강의 목록으로</button>
      <header className={styles.heading}>
        <h1>내 예약</h1>
        <p>예정된 예약과 지난 이용 내역을 확인할 수 있어요.</p>
      </header>
      <section aria-labelledby="my-upcoming-heading" className="space-y-4">
        <h2 id="my-upcoming-heading" className={styles.sectionTitle}>예정된 예약</h2>
        {upcomingByLecture.length === 0 && <p className={styles.small}>예정된 예약이 없습니다.</p>}
        {upcomingByLecture.map((lectureGroup) => {
          const lectureIds = lectureGroup.groups.flatMap((group) => group.ids);
          const selectedIds = lectureIds.filter((id) => checked.includes(id));
          const account = accountByLecture[lectureGroup.lecture];

          return (
            <section key={lectureGroup.lecture} className={styles.quietSection}>
              <div className={styles.myHeading}>
                <div>
                  <h3 className="wrap-anywhere text-base font-semibold">{lectureGroup.lecture}</h3>
                  <p className={styles.small}>{lectureGroup.groups.length}개 날짜 · {durationLabel(lectureGroup.totalSlots)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={loading || selectedIds.length === 0} onClick={() => void cancelIds(selectedIds, selectedCancelMessage(lectureGroup.groups, selectedIds))}>선택한 시간 취소</Button>
                  <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={loading} onClick={() => void cancelIds(lectureIds, "이 강의의 모든 예약을 취소하시겠습니까?")}>전체 예약 취소</Button>
                </div>
              </div>
              <p className={styles.small}>취소할 날짜나 시간대를 선택하세요.</p>
              <ul className="mt-2 divide-y divide-line-divider border-t border-line-divider">
                {lectureGroup.groups.map((group) => {
                  const allPicked = group.ids.every((id) => checked.includes(id));
                  const date = compactDateLabel(group.res_date);
                  return (
                    <li key={group.key} className="space-y-2 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{date}</p>
                          <p className={styles.small}>{timeRangeLabel(group.times)} · {durationLabel(group.times.length)}</p>
                        </div>
                        <Button type="button" size="sm" variant="outline" disabled={loading} aria-pressed={allPicked} aria-label={`${date} ${allPicked ? "선택 해제" : "전체 선택"}`} onClick={() => toggleGroup(group)}>
                          {allPicked ? "선택 해제" : "전체 선택"}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.times.map((time, index) => {
                          const id = group.ids[index];
                          const selected = checked.includes(id);
                          return (
                            <button type="button" key={id} aria-pressed={selected} aria-label={`${date} ${time}`} disabled={loading} onClick={() => toggle(id)}
                              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${selected ? "border-danger-line bg-danger-soft text-danger" : "border-line-input bg-surface-sunken text-ink"}`}>
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {account && <div className="mt-4 max-w-[560px]"><CourseAccount {...account} /></div>}
            </section>
          );
        })}
      </section>

      <section aria-labelledby="my-past-heading" className={`${styles.quietSection} mt-4 space-y-3`}>
        <h2 id="my-past-heading" className={styles.sectionTitle}>지난 이용 내역</h2>
        {pastByLecture.length === 0 && <p className={styles.small}>아직 지난 내역이 없습니다.</p>}
        <ul className="divide-y divide-line-divider">
          {pastByLecture.map((lectureGroup) => (
            <li key={lectureGroup.lecture} className="space-y-1 py-3">
              <h3 className="wrap-anywhere text-sm font-semibold">{lectureGroup.lecture}</h3>
              {lectureGroup.groups.map((group) => (
                <p key={group.key} className={styles.small}>{compactDateLabel(group.res_date)} · {timeRangeLabel(group.times)}</p>
              ))}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
