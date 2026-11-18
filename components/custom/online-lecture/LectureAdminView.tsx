"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import styles from "./booking.module.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AdminReservation {
  id: number;
  res_time: string;
  lecture: string;
  student_id: number;
  user_name: string;
}

interface AllAdminReservation extends AdminReservation {
  res_date: string;
}

interface MemberSummary {
  student_id: number;
  user_name: string;
  primaryLecture: string;
  lectureExtraCount: number;
  primaryDate: string;
  dateExtraCount: number;
  reservationCount: number;
}

function shortDateLabel(s: string): string {
  const [, m, d] = s.split("-").map(Number);
  return `${m}월 ${d}일`;
}

function timeRangeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const endMinutes = h * 60 + m + 30;
  const endLabel =
    endMinutes === 24 * 60
      ? "24:00"
      : `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  return `${time} - ${endLabel}`;
}

function summarizeByMember(rows: AllAdminReservation[]): MemberSummary[] {
  const byStudent = new Map<number, AllAdminReservation[]>();
  for (const r of rows) {
    const list = byStudent.get(r.student_id) ?? [];
    list.push(r);
    byStudent.set(r.student_id, list);
  }

  const summaries: MemberSummary[] = [];
  for (const list of byStudent.values()) {
    const sorted = [...list].sort((a, b) =>
      a.res_date === b.res_date
        ? a.res_time.localeCompare(b.res_time)
        : a.res_date.localeCompare(b.res_date),
    );
    const earliest = sorted[0];
    const lectureCount = new Set(list.map((r) => r.lecture)).size;
    const dateCount = new Set(list.map((r) => r.res_date)).size;

    summaries.push({
      student_id: earliest.student_id,
      user_name: earliest.user_name,
      primaryLecture: earliest.lecture,
      lectureExtraCount: lectureCount - 1,
      primaryDate: earliest.res_date,
      dateExtraCount: dateCount - 1,
      reservationCount: list.length,
    });
  }

  return summaries.sort((a, b) => a.primaryDate.localeCompare(b.primaryDate));
}

const MEMBERS_PAGE_SIZE = 5;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateLabel(s: string): string {
  const d = fromDateStr(s);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

function todayStr(): string {
  return toDateStr(new Date());
}

export default function LectureAdminView({ tabs }: { tabs?: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [allReservations, setAllReservations] = useState<AllAdminReservation[]>([]);
  const [memberSummaries, setMemberSummaries] = useState<MemberSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [membersPage, setMembersPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/admin/lecture-reservations?date=${selectedDate}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const body = await res.json();
        if (!cancelled) setReservations(body.reservations ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("예약 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/lecture-reservations/summary")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const body = await res.json();
        const rows: AllAdminReservation[] = (body.reservations ?? []).filter(
          (r: AllAdminReservation) => r.res_date >= todayStr(),
        );
        if (!cancelled) {
          setAllReservations(rows);
          setMemberSummaries(summarizeByMember(rows));
        }
      })
      .catch(() => {
        if (!cancelled) setSummaryError("예약자 요약을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const membersTotalPages = Math.max(1, Math.ceil(memberSummaries.length / MEMBERS_PAGE_SIZE));
  const pagedMemberSummaries = memberSummaries.slice(
    (membersPage - 1) * MEMBERS_PAGE_SIZE,
    membersPage * MEMBERS_PAGE_SIZE,
  );

  const selectedMember = memberSummaries.find((m) => m.student_id === selectedStudentId) ?? null;
  const selectedReservations = selectedStudentId === null
    ? []
    : [...allReservations]
        .filter((r) => r.student_id === selectedStudentId)
        .sort((a, b) =>
          a.res_date === b.res_date
            ? a.res_time.localeCompare(b.res_time)
            : a.res_date.localeCompare(b.res_date),
        );

  return (
    <div>
      <header className={styles.heading}>
        <h1>인강 예약 현황</h1>
        <p>날짜별 예약자와 학회원별 예약 내역을 확인하세요.</p>
      </header>
      {tabs}

      <div className={styles.schedule}>
        <section className={styles.outlined}>
          <h2 className={styles.sectionTitle}>날짜 선택</h2>
          <Calendar
            mode="single"
            captionLayout="label"
            weekStartsOn={1}
            selected={fromDateStr(selectedDate)}
            defaultMonth={fromDateStr(selectedDate)}
            className="mx-auto mt-3 w-full p-0 [--cell-size:2rem]"
            onSelect={(date) => {
              if (!date) return;
              const next = toDateStr(date);
              if (next === selectedDate) return;
              setLoading(true);
              setError(null);
              setSelectedDate(next);
            }}
          />
        </section>
        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <h2 className={styles.sectionTitle}>{dateLabel(selectedDate)}</h2>
            <span className="text-xs font-semibold text-faint">{reservations.length}건</span>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-faint">불러오는 중…</p>
          ) : error ? (
            <p className="py-10 text-center text-sm text-danger">{error}</p>
          ) : reservations.length === 0 ? (
            <p className="py-10 text-center text-sm text-faint">예약이 없습니다.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr className="border-b border-line-divider text-left text-xs font-semibold text-faint">
                  <th scope="col" className="w-[15%]">시간</th>
                  <th scope="col" className="w-[41%]">강의</th>
                  <th scope="col" className="w-[18%]">이름</th>
                  <th scope="col">학번</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-divider">
                {reservations.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-3 font-bold text-ink">{r.res_time}</td>
                    <td className="py-2.5 pr-3 text-ink-3">{r.lecture}</td>
                    <td className="py-2.5 pr-3 text-ink-3">{r.user_name}</td>
                    <td className="py-2.5 text-faint">{r.student_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className={`${styles.quietSection} mt-8`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className={styles.sectionTitle}>학회원별 예약</h2>
          <span className="text-xs font-semibold text-faint">{memberSummaries.length}명</span>
        </div>

        {summaryLoading ? (
          <p className="py-10 text-center text-sm text-faint">불러오는 중…</p>
        ) : summaryError ? (
          <p className="py-10 text-center text-sm text-danger">{summaryError}</p>
        ) : memberSummaries.length === 0 ? (
          <p className="py-10 text-center text-sm text-faint">예약이 없습니다.</p>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr className="border-b border-line-divider text-left text-xs font-semibold text-faint">
                  <th scope="col" className="w-[22%]">학회원</th>
                  <th scope="col" className="w-[28%]">예정된 강의</th>
                  <th scope="col" className="w-[32%]">가장 가까운 날짜</th>
                  <th scope="col">예약 수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-divider">
                {pagedMemberSummaries.map((m) => (
                  <tr key={m.student_id}>
                    <td>
                      <Button type="button" variant="link" className="h-auto whitespace-normal break-all p-0 text-left" onClick={() => setSelectedStudentId(m.student_id)}>{m.user_name}</Button>
                    </td>
                    <td className="py-2.5 pr-3 text-ink-3">
                      {m.primaryLecture}
                      {m.lectureExtraCount > 0 && ` 외 ${m.lectureExtraCount}개`}
                    </td>
                    <td className="py-2.5 text-ink-3">
                      {shortDateLabel(m.primaryDate)}
                      {m.dateExtraCount > 0 && ` 외 ${m.dateExtraCount}개 날짜`}
                    </td>
                    <td>{m.reservationCount}건</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {membersTotalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => setMembersPage((p) => Math.max(1, p - 1))}
                  disabled={membersPage === 1}
                  className="h-8 rounded-lg border border-line px-3 text-xs font-semibold text-hint hover:border-brand-line disabled:cursor-not-allowed disabled:opacity-40"
                >
                  이전
                </button>
                <span className="text-xs font-semibold text-faint">
                  {membersPage} / {membersTotalPages}
                </span>
                <button
                  onClick={() => setMembersPage((p) => Math.min(membersTotalPages, p + 1))}
                  disabled={membersPage === membersTotalPages}
                  className="h-8 rounded-lg border border-line px-3 text-xs font-semibold text-hint hover:border-brand-line disabled:cursor-not-allowed disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <Dialog
        open={selectedStudentId !== null}
        onOpenChange={(open) => !open && setSelectedStudentId(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedMember?.user_name}</DialogTitle>
            <DialogDescription>
              학번 {selectedMember?.student_id} · 총 {selectedReservations.length}건
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <table className={styles.table}>
              <thead>
                <tr className="border-b border-line-divider text-left text-xs font-semibold text-faint">
                  <th className="py-2 pr-3 w-[80px]">날짜</th>
                  <th className="py-2 pr-3 w-[130px]">시간</th>
                  <th className="py-2">강의</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-divider">
                {selectedReservations.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-3 font-bold text-ink">{shortDateLabel(r.res_date)}</td>
                    <td className="py-2.5 pr-3 text-ink-3">{timeRangeLabel(r.res_time)}</td>
                    <td className="py-2.5 text-ink-3">{r.lecture}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
